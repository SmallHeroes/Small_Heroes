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
import { enqueueDelivery, hashPayload, type BookReadyPayload, type Disposition } from '@/lib/generation-chunked/delivery-outbox';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'readiness-manifest' });

export function isReadinessManifestEnabled(): boolean {
  return process.env.READINESS_MANIFEST_ENABLED === 'true';
}

type Tx = Prisma.TransactionClient;

export interface OrderTruth {
  id: string;
  fulfillmentVersion: number;
  /** Optimistic-concurrency token (B4): commit + send are conditional on this being unchanged. */
  inputVersion: number;
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

/**
 * Cheap DB-visible fingerprint — the TOCTOU guard. Covers frozen-truth + inputVersion + ALL delivery-payload
 * fields (email/name/child/readUrl/pdf/firstAudio) + cover + page [num,text,url]; NO asset bytes. (B4) Binding
 * the payload fields here means a payload change between eval and commit aborts the commit (no stale enqueue).
 */
function fingerprintOf(f: {
  expectedPageCount: number | null; storySourceHash: string | null; selectionFilename: string | null; frozenProductVersion: string | null;
  fulfillmentVersion: number; inputVersion: number;
  customerEmail: string; customerName: string | null; childName: string; readUrl: string | null; pdfUrl: string | null; firstAudioUrl: string | null;
  cover: string | null; pages: Array<[number, string, string | null]>;
}): string {
  return createHash('sha256').update(JSON.stringify({
    frozen: [f.expectedPageCount, f.storySourceHash, f.selectionFilename, f.frozenProductVersion, f.fulfillmentVersion, f.inputVersion],
    payload: [f.customerEmail, f.customerName, f.childName, f.readUrl, f.pdfUrl, f.firstAudioUrl],
    cover: f.cover, pages: f.pages,
  })).digest('hex');
}

const COMMIT_SELECT = {
  id: true, fulfillmentVersion: true, inputVersion: true, expectedPageCount: true, storySourceHash: true, selectionFilename: true, frozenProductVersion: true,
  customerEmail: true, customerName: true, childName: true,
  book: { select: { coverImageUrl: true, readUrl: true, pdfUrl: true, pages: { orderBy: { pageNumber: 'asc' as const }, select: { pageNumber: true, text: true, audioUrl: true, imageAsset: { select: { url: true, presentationUrl: true } } } } } },
} as const;

/** Load the FRESH commit inputs from the DB (never recycle stale args). Works on the client or a tx client. */
async function loadCommitInputs(db: PrismaClient | Tx, orderId: string): Promise<LoadedInputs | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: COMMIT_SELECT });
  if (!o || !o.book) return null;
  const pages = o.book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null, text: p.text }));
  const firstAudioUrl = o.book.pages.find((p) => p.audioUrl?.trim())?.audioUrl ?? null;
  const order: OrderTruth = { id: o.id, fulfillmentVersion: o.fulfillmentVersion, inputVersion: o.inputVersion, expectedPageCount: o.expectedPageCount, storySourceHash: o.storySourceHash, selectionFilename: o.selectionFilename, frozenProductVersion: o.frozenProductVersion, customerEmail: o.customerEmail, customerName: o.customerName, childName: o.childName };
  const book: BookData = { coverImageUrl: o.book.coverImageUrl, readUrl: o.book.readUrl, pdfUrl: o.book.pdfUrl, firstAudioUrl, pages };
  const fingerprint = fingerprintOf({
    ...order, readUrl: book.readUrl, pdfUrl: book.pdfUrl, firstAudioUrl: book.firstAudioUrl,
    cover: book.coverImageUrl, pages: pages.map((p) => [p.pageNumber, p.text, p.imageUrl] as [number, string, string | null]),
  });
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

/**
 * Build the delivery payload from the exact fields that determine it. The SAME function is used at enqueue
 * time (commit) and at send time (recheck) so the payloadHash comparison is apples-to-apples. (B4)
 */
interface PayloadSource { customerEmail: string; customerName: string | null; childName: string; readUrl: string | null; pdfUrl: string | null; firstAudioUrl: string | null }
function buildPayload(p: PayloadSource): BookReadyPayload {
  return {
    to: p.customerEmail,
    customerName: p.customerName ?? p.childName,
    childName: p.childName,
    readUrl: p.readUrl ?? '',
    audioUrl: p.firstAudioUrl ?? undefined,
    pdfUrl: p.pdfUrl ?? undefined,
  };
}
function payloadSourceOf(order: OrderTruth, book: BookData): PayloadSource {
  return { customerEmail: order.customerEmail, customerName: order.customerName, childName: order.childName, readUrl: book.readUrl, pdfUrl: book.pdfUrl, firstAudioUrl: book.firstAudioUrl };
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

  // (1) IMMUTABLE manifest — terminal INSERT (throws P2002 on a concurrent same-revision insert). Records the
  // Order.inputVersion this evaluation observed, so the send-time recheck can detect a later writer bump.
  const manifest = await tx.bookReadinessManifest.create({
    data: { orderId: order.id, scope, revision, status: result.status, inputsHash: result.inputsHash, inputVersion: order.inputVersion, evidence: result.evidence as unknown as Prisma.InputJsonValue, reason: result.reason },
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
    await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, payload: buildPayload(payloadSourceOf(order, book)), now });
    enqueued = true; orderStatus = 'ready'; deliveryHoldReason = null;
  } else if (result.status === 'passed') {
    // Integrity passed but the ANCHOR still holds delivery (Phase-1 keeps the anchor hold — fix #4). No enqueue.
    orderStatus = args.anchorOrderStatus; deliveryHoldReason = args.anchorReason;
  } else {
    // Integrity BLOCKED → held, no enqueue, no email; re-evaluation is a dedicated path, not a worker loop.
    orderStatus = 'needs_human_qa'; deliveryHoldReason = `base_book_integrity:${result.reason ?? 'blocked'}`;
  }

  // (4) Order write is CONDITIONAL on inputVersion being unchanged (B4 optimistic concurrency): if any writer
  // bumped Order.inputVersion since the evaluation, this matches 0 rows → abort the whole tx as a TOCTOU drift
  // (reload FRESH + re-evaluate). Stronger than the early fingerprint read: it makes the final write itself atomic.
  const written = await tx.order.updateMany({
    where: { id: order.id, inputVersion: order.inputVersion },
    data: { status: orderStatus as never, packageStatus: 'done', deliveryHoldReason },
  });
  if (written.count === 0) throw new Error(TOCTOU);
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
 * Send-time drift (B2): mark readiness `stale` and take the order OFF `ready`. Two guards so this can never
 * undo good state:
 *  - the readiness→stale write is CONDITIONAL on `currentManifestId === expectedManifestId`, so an old recheck
 *    can never stomp a NEWER manifest that a concurrent re-evaluation already committed (count 0 → no-op);
 *  - the order is un-readied only when the stale write actually applied AND the email has not already gone out
 *    (no Outbox row is `sent`).
 * The Outbox row itself is separately suppressed by the worker (fenced). Called by the cron when the pre-send
 * recheck reports real drift (inputs_changed_since_manifest OR integrity_now_* — a now-corrupt/deleted asset).
 */
export async function markBaseBookStale(
  prisma: PrismaClient,
  orderId: string,
  scope: string,
  expectedManifestId: string,
  reason = 'inputs_changed_since_manifest',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const invalidated = await tx.bookReadiness.updateMany({
      where: { orderId, scope, currentManifestId: expectedManifestId },
      data: { status: 'stale', reason },
    });
    if (invalidated.count === 0) return; // a newer manifest replaced the one we rechecked — leave it alone
    const alreadySent = await tx.deliveryOutbox.count({ where: { orderId, scope, status: 'sent' } });
    if (alreadySent > 0) return; // the email already shipped — don't retroactively un-ready a delivered book
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
  expectedPayloadHash?: string | null,
): Promise<Disposition> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, inputVersion: true, expectedPageCount: true, storySourceHash: true, selectionFilename: true, frozenProductVersion: true,
      customerEmail: true, customerName: true, childName: true,
      book: {
        select: {
          coverImageUrl: true,
          readUrl: true,
          pdfUrl: true,
          pages: { orderBy: { pageNumber: 'asc' }, select: { pageNumber: true, text: true, audioUrl: true, imageAsset: { select: { url: true, presentationUrl: true } } } },
        },
      },
    },
  });
  if (!order || !order.book) return { outcome: 'suppress', reason: 'order_or_book_missing' };
  // (B3) Allowlist — ONLY a `ready` order may send. paid/draft/generating/needs_human_qa/failed all suppress
  // (fail-closed; the old blacklist let non-terminal states like `generating` through).
  if (order.status !== 'ready') return { outcome: 'suppress', reason: `order_not_ready:${order.status}` };

  const readiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope } }, select: { status: true, currentManifestId: true } });
  if (!readiness || readiness.status !== 'passed' || !readiness.currentManifestId) return { outcome: 'suppress', reason: 'readiness_not_passed' };
  const expectedManifestId = readiness.currentManifestId;
  const manifest = await prisma.bookReadinessManifest.findUnique({ where: { id: expectedManifestId }, select: { inputsHash: true, inputVersion: true } });
  if (!manifest) return { outcome: 'suppress', reason: 'manifest_missing' };
  // (B4) Optimistic-concurrency short-circuit: any writer that bumped Order.inputVersion since the manifest
  // means the inputs moved — suppress + invalidate, before paying for the asset re-inspection.
  if (order.inputVersion !== manifest.inputVersion) return { outcome: 'suppress', reason: 'inputs_changed_since_manifest', invalidateReadiness: true, expectedManifestId };

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
    // Transient infra (timeout/5xx/network) => retry later, do NOT invalidate readiness.
    if (hasTransientAssetError(fresh.evidence)) return { outcome: 'retry', reason: `transient_asset:${fresh.reason ?? 'blocked'}` };
    // (B2) A now-corrupt/deleted asset is REAL drift — invalidate readiness + drop from `ready`, not just suppress.
    return { outcome: 'suppress', reason: `integrity_now_${fresh.reason ?? 'blocked'}`, invalidateReadiness: true, expectedManifestId };
  }
  if (fresh.inputsHash !== manifest.inputsHash) return { outcome: 'suppress', reason: 'inputs_changed_since_manifest', invalidateReadiness: true, expectedManifestId };

  // (B4) Payload binding: never send a STALE payload. Rebuild the delivery payload from the live order with
  // the SAME builder used at enqueue; if it no longer hashes to what was enqueued (email/name/link/pdf/audio
  // changed since), suppress + invalidate rather than emailing an out-of-date book.
  if (expectedPayloadHash != null) {
    const firstAudioUrl = order.book.pages.find((p) => p.audioUrl?.trim())?.audioUrl ?? null;
    const payloadNow = buildPayload({ customerEmail: order.customerEmail, customerName: order.customerName, childName: order.childName, readUrl: order.book.readUrl, pdfUrl: order.book.pdfUrl, firstAudioUrl });
    if (hashPayload(payloadNow) !== expectedPayloadHash) return { outcome: 'suppress', reason: 'payload_changed_since_enqueue', invalidateReadiness: true, expectedManifestId };
  }
  return { outcome: 'allow' };
}
