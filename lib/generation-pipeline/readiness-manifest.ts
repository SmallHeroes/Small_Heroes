/**
 * Phase-1 base_book_integrity — readiness orchestration (flag READINESS_MANIFEST_ENABLED, default OFF).
 *
 * The Manifest is IMMUTABLE: one terminal INSERT per evaluation (passed|blocked); evidence + status are
 * never mutated. BookReadiness is the MUTABLE pointer to the current state. A revision is allocated
 * atomically (the unique (orderId,scope,revision) constraint + a tx-level retry guarantees two concurrent
 * evaluators never share a revision). On PASS-and-anchor-allows the whole thing — manifest INSERT,
 * readiness pointer, Outbox enqueue, Order.ready, GenerationJob done — commits in ONE transaction; the
 * email is sent later by the Outbox worker (so `ready` never depends on the mail provider being up).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE, type IntegrityInput, type IntegrityResult } from './integrity-gate';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import { enqueueDelivery, type BookReadyPayload } from '@/lib/generation-chunked/delivery-outbox';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'readiness-manifest' });

export function isReadinessManifestEnabled(): boolean {
  return process.env.READINESS_MANIFEST_ENABLED === 'true';
}

type Tx = Prisma.TransactionClient;

export interface OrderTruth {
  id: string;
  fulfillmentVersion: number;
  expectedPageCount: number | null;
  storySourceHash: string | null;
  selectionFilename: string | null;
  frozenProductVersion: string | null;
  customerEmail: string;
  customerName: string | null;
  childName: string;
}
export interface BookData {
  coverImageUrl: string | null;
  readUrl: string | null;
  pdfUrl: string | null;
  firstAudioUrl: string | null;
  pages: Array<{ pageNumber: number; imageUrl: string | null; text: string }>;
}
export interface CommitArgs {
  orderId: string;
  /** From the existing anchor delivery gate: does the anchor permit customer delivery? */
  anchorAllowsDelivery: boolean;
  anchorOrderStatus: string; // deliveryGate.orderStatus (e.g. 'ready' | 'needs_human_qa')
  anchorReason: string | null;
}
export interface CommitDeps {
  inspect?: (url: string | null | undefined) => Promise<AssetInspection>;
  now?: () => Date;
  /** App origin the readUrl is validated against (B5). Defaults to NEXT_PUBLIC_APP_URL/APP_URL. */
  appBaseUrl?: string | null;
}

/** The configured app origin (trailing slash stripped) the canonical readUrl must belong to. (B5) */
function readAppBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}
export interface CommitResult {
  manifestStatus: 'passed' | 'blocked';
  enqueued: boolean;
  orderStatus: string;
  reason: string | null;
  revision: number;
}
interface LoadedInputs { order: OrderTruth; book: BookData; fingerprint: string }

const TOCTOU = 'readiness_toctou_drift';
function isRevisionCollision(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'P2002';
}
function isToctou(e: unknown): boolean {
  return e instanceof Error && e.message === TOCTOU;
}

/** Cheap DB-visible fingerprint (frozen-truth + readUrl + cover + page [num,text,url]); NO asset bytes. */
function fingerprintOf(f: { expectedPageCount: number | null; storySourceHash: string | null; selectionFilename: string | null; frozenProductVersion: string | null; fulfillmentVersion: number; readUrl: string | null; cover: string | null; pages: Array<[number, string, string | null]> }): string {
  return createHash('sha256').update(JSON.stringify({
    frozen: [f.expectedPageCount, f.storySourceHash, f.selectionFilename, f.frozenProductVersion, f.fulfillmentVersion],
    readUrl: f.readUrl, cover: f.cover, pages: f.pages,
  })).digest('hex');
}

const COMMIT_SELECT = {
  id: true, fulfillmentVersion: true, expectedPageCount: true, storySourceHash: true, selectionFilename: true, frozenProductVersion: true,
  customerEmail: true, customerName: true, childName: true,
  book: { select: { coverImageUrl: true, readUrl: true, pdfUrl: true, pages: { orderBy: { pageNumber: 'asc' as const }, select: { pageNumber: true, text: true, audioUrl: true, imageAsset: { select: { url: true, presentationUrl: true } } } } } },
} as const;

/** Load the FRESH commit inputs from the DB (never recycle stale args). Works on the client or a tx client. */
async function loadCommitInputs(db: PrismaClient | Tx, orderId: string): Promise<LoadedInputs | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: COMMIT_SELECT });
  if (!o || !o.book) return null;
  const pages = o.book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null, text: p.text }));
  const firstAudioUrl = o.book.pages.find((p) => p.audioUrl?.trim())?.audioUrl ?? null;
  const order: OrderTruth = { id: o.id, fulfillmentVersion: o.fulfillmentVersion, expectedPageCount: o.expectedPageCount, storySourceHash: o.storySourceHash, selectionFilename: o.selectionFilename, frozenProductVersion: o.frozenProductVersion, customerEmail: o.customerEmail, customerName: o.customerName, childName: o.childName };
  const book: BookData = { coverImageUrl: o.book.coverImageUrl, readUrl: o.book.readUrl, pdfUrl: o.book.pdfUrl, firstAudioUrl, pages };
  const fingerprint = fingerprintOf({ ...order, readUrl: book.readUrl, cover: book.coverImageUrl, pages: pages.map((p) => [p.pageNumber, p.text, p.imageUrl] as [number, string, string | null]) });
  return { order, book, fingerprint };
}

function buildIntegrityInput(order: OrderTruth, book: BookData, appBaseUrl: string | null): IntegrityInput {
  return {
    scope: BASE_BOOK_SCOPE,
    orderId: order.id,
    readUrl: book.readUrl,
    appBaseUrl,
    frozen: {
      expectedPageCount: order.expectedPageCount,
      storySourceHash: order.storySourceHash,
      selectionFilename: order.selectionFilename,
      frozenProductVersion: order.frozenProductVersion,
    },
    cover: { imageUrl: book.coverImageUrl },
    pages: book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl, text: p.text })),
  };
}

function buildPayload(order: OrderTruth, book: BookData): BookReadyPayload {
  return {
    to: order.customerEmail,
    customerName: order.customerName ?? order.childName,
    childName: order.childName,
    readUrl: book.readUrl ?? '',
    audioUrl: book.firstAudioUrl ?? undefined,
    pdfUrl: book.pdfUrl ?? undefined,
  };
}

async function nextRevision(tx: Tx, orderId: string, scope: string): Promise<number> {
  const last = await tx.bookReadinessManifest.findFirst({
    where: { orderId, scope },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  return (last?.revision ?? 0) + 1;
}

/**
 * The single PASS/BLOCK transaction. First a TOCTOU guard (re-read the cheap fingerprint INSIDE the tx and
 * compare to the value the evaluation ran on); on drift it throws so the caller reloads FRESH + re-evaluates.
 * May also throw P2002 (revision collision). Both are retried by commitBaseBookReadiness.
 */
async function runReadinessTxn(tx: Tx, args: CommitArgs, loaded: LoadedInputs, result: IntegrityResult, now: Date): Promise<CommitResult> {
  // (0) TOCTOU guard — the assets/text/frozen must not have changed between the (out-of-tx) eval and now.
  const inTx = await loadCommitInputs(tx, args.orderId);
  if (!inTx || inTx.fingerprint !== loaded.fingerprint) throw new Error(TOCTOU);

  const { order, book } = loaded;
  const scope = BASE_BOOK_SCOPE;
  const revision = await nextRevision(tx, order.id, scope);

  // (1) IMMUTABLE manifest — terminal INSERT (throws P2002 on a concurrent same-revision insert).
  const manifest = await tx.bookReadinessManifest.create({
    data: { orderId: order.id, scope, revision, status: result.status, inputsHash: result.inputsHash, evidence: result.evidence as unknown as Prisma.InputJsonValue, reason: result.reason },
  });

  // (2) MUTABLE readiness pointer → current manifest.
  await tx.bookReadiness.upsert({
    where: { orderId_scope: { orderId: order.id, scope } },
    create: { orderId: order.id, scope, status: result.status, currentManifestId: manifest.id, reason: result.reason },
    update: { status: result.status, currentManifestId: manifest.id, reason: result.reason },
  });

  let enqueued = false;
  let orderStatus: string;
  let deliveryHoldReason: string | null;
  if (result.status === 'passed' && args.anchorAllowsDelivery) {
    // (3) enqueue the delivery IN the same transaction (enqueue != send), then (4) mark the order ready.
    await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, payload: buildPayload(order, book), now });
    enqueued = true; orderStatus = 'ready'; deliveryHoldReason = null;
  } else if (result.status === 'passed') {
    // Integrity passed but the ANCHOR still holds delivery (Phase-1 keeps the anchor hold — fix #4). No enqueue.
    orderStatus = args.anchorOrderStatus; deliveryHoldReason = args.anchorReason;
  } else {
    // Integrity BLOCKED → held, no enqueue, no email; re-evaluation is a dedicated path, not a worker loop.
    orderStatus = 'needs_human_qa'; deliveryHoldReason = `base_book_integrity:${result.reason ?? 'blocked'}`;
  }

  await tx.order.update({ where: { id: order.id }, data: { status: orderStatus as never, packageStatus: 'done', deliveryHoldReason } });
  // (5) GenerationJob terminal — the package stage ran.
  await tx.generationJob.update({ where: { orderId: order.id }, data: { status: 'done', currentStage: 'done', completedAt: now, packaged: true } });
  return { manifestStatus: result.status, enqueued, orderStatus, reason: deliveryHoldReason, revision };
}

/**
 * Load FRESH inputs, evaluate integrity, then commit manifest + readiness + (on pass+anchor) the Outbox
 * enqueue + Order/Job updates in ONE transaction. Retries (bounded) on a TOCTOU drift — reloading FRESH and
 * re-evaluating each time (B3) — or a revision collision.
 */
export async function commitBaseBookReadiness(prisma: PrismaClient, args: CommitArgs, deps: CommitDeps = {}): Promise<CommitResult> {
  const now = deps.now?.() ?? new Date();
  for (let attempt = 0; attempt < 6; attempt++) {
    const loaded = await loadCommitInputs(prisma, args.orderId);
    if (!loaded) throw new Error('readiness_inputs_missing');
    const appBaseUrl = deps.appBaseUrl ?? readAppBaseUrl();
    const result = await evaluateBaseBookIntegrity(buildIntegrityInput(loaded.order, loaded.book, appBaseUrl), deps.inspect ?? inspectAsset);
    try {
      return await prisma.$transaction((tx) => runReadinessTxn(tx, args, loaded, result, now));
    } catch (e) {
      if ((isToctou(e) || isRevisionCollision(e)) && attempt < 5) {
        log.warn('Readiness commit retry', { orderId: args.orderId, attempt, reason: isToctou(e) ? 'toctou_drift' : 'revision_collision' });
        continue; // reload FRESH + re-evaluate
      }
      throw e;
    }
  }
  throw new Error('readiness_commit_exhausted');
}

/**
 * Send-time drift (B3): mark readiness `stale` and take the order OFF `ready` (atomically, only when it is
 * currently `ready`). The Outbox row itself is suppressed by the worker (fenced). Called by the cron when the
 * pre-send recheck reports inputs_changed_since_manifest — the book must not remain customer-visible.
 */
export async function markBaseBookStale(prisma: PrismaClient, orderId: string, scope: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.bookReadiness.updateMany({ where: { orderId, scope }, data: { status: 'stale', reason: 'inputs_changed_since_manifest' } });
    await tx.order.updateMany({ where: { id: orderId, status: 'ready' }, data: { status: 'needs_human_qa', deliveryHoldReason: 'base_book_readiness_stale' } });
  });
}

// Asset error codes that are TRANSIENT infra (→ retry), not a real drift / persistent failure (→ suppress).
const TRANSIENT_ASSET_RE = /^(timeout|fetch_failed|http_(429|5\d\d))$/;
function hasTransientAssetError(evidence: Record<string, unknown>): boolean {
  const cover = (evidence.cover as { error?: string } | undefined)?.error;
  const pages = ((evidence.pages as Array<{ error?: string }> | undefined) ?? []).map((p) => p.error);
  return [cover, ...pages].some((e) => typeof e === 'string' && TRANSIENT_ASSET_RE.test(e));
}

/**
 * Send-time recheck for the Outbox worker (B2 disposition). Re-evaluate integrity NOW and return:
 *  - allow:    readiness still passed, manifest inputsHash still matches the live assets, order not re-held.
 *  - retry:    a TRANSIENT asset error (timeout / 5xx / 429 / network) — try later, do NOT give up.
 *  - suppress: real drift (assets/text/frozen changed, readiness blocked, order re-held) — never ship stale.
 */
export async function recheckBaseBookDelivery(
  prisma: PrismaClient,
  orderId: string,
  scope: string,
  deps: CommitDeps = {},
): Promise<{ outcome: 'allow' | 'retry' | 'suppress'; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, expectedPageCount: true, storySourceHash: true, selectionFilename: true, frozenProductVersion: true,
      book: {
        select: {
          coverImageUrl: true,
          readUrl: true,
          pages: { orderBy: { pageNumber: 'asc' }, select: { pageNumber: true, text: true, imageAsset: { select: { url: true, presentationUrl: true } } } },
        },
      },
    },
  });
  if (!order || !order.book) return { outcome: 'suppress', reason: 'order_or_book_missing' };
  if (order.status === 'needs_human_qa' || order.status === 'failed') return { outcome: 'suppress', reason: `order_re_held:${order.status}` };

  const readiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope } }, select: { status: true, currentManifestId: true } });
  if (!readiness || readiness.status !== 'passed' || !readiness.currentManifestId) return { outcome: 'suppress', reason: 'readiness_not_passed' };
  const manifest = await prisma.bookReadinessManifest.findUnique({ where: { id: readiness.currentManifestId }, select: { inputsHash: true } });
  if (!manifest) return { outcome: 'suppress', reason: 'manifest_missing' };

  const fresh = await evaluateBaseBookIntegrity(
    {
      scope: BASE_BOOK_SCOPE,
      orderId: order.id,
      readUrl: order.book.readUrl,
      appBaseUrl: deps.appBaseUrl ?? readAppBaseUrl(),
      frozen: {
        expectedPageCount: order.expectedPageCount,
        storySourceHash: order.storySourceHash,
        selectionFilename: order.selectionFilename,
        frozenProductVersion: order.frozenProductVersion,
      },
      cover: { imageUrl: order.book.coverImageUrl },
      pages: order.book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null, text: p.text })),
    },
    deps.inspect ?? inspectAsset,
  );
  if (fresh.status !== 'passed') {
    // Transient infra (timeout/5xx/network) => retry later; a real persistent failure => suppress.
    if (hasTransientAssetError(fresh.evidence)) return { outcome: 'retry', reason: `transient_asset:${fresh.reason ?? 'blocked'}` };
    return { outcome: 'suppress', reason: `integrity_now_${fresh.reason ?? 'blocked'}` };
  }
  if (fresh.inputsHash !== manifest.inputsHash) return { outcome: 'suppress', reason: 'inputs_changed_since_manifest' };
  return { outcome: 'allow' };
}
