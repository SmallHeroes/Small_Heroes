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
import type { Prisma, PrismaClient, DeliveryOutbox } from '@prisma/client';
import { createHash } from 'crypto';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE, type IntegrityInput, type IntegrityResult } from './integrity-gate';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import { enqueueDelivery, hashPayload, type BookReadyPayload, type Disposition, type SuppressOutcome } from '@/lib/generation-chunked/delivery-outbox';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'readiness-manifest' });

export function isReadinessManifestEnabled(): boolean {
  return process.env.READINESS_MANIFEST_ENABLED === 'true';
}

type Tx = Prisma.TransactionClient;

/**
 * (P1-f contract) The SINGLE place a writer bumps Order.inputVersion — centralized here so no writer is
 * forgotten. EVERY writer of a delivery input (anything in Order/GeneratedBook/BookPage/ImageAsset that the
 * integrity gate or the delivery payload reads: page text, frozen product-truth, asset/cover URLs, readUrl,
 * customerEmail/pdfUrl/audio) MUST call this in the SAME transaction as its write, so the manifest's
 * optimistic-concurrency token (B4) actually moves and the send-time recheck can detect the drift. Wired into
 * the producers in P1-f — NOT before; chunk-runner stays untouched until then.
 */
export async function bumpOrderInputVersion(db: PrismaClient | Tx, orderId: string): Promise<void> {
  await db.order.update({ where: { id: orderId }, data: { inputVersion: { increment: 1 } } });
}

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
  let fulfillmentVersion: number | undefined;
  if (result.status === 'passed' && args.anchorAllowsDelivery) {
    // (3) enqueue the delivery IN the same transaction (enqueue != send), then (4) mark the order ready.
    // B-r3-1: enqueue may roll fulfillmentVersion forward past a terminal-dead row — persist the value it used
    // so `ready` is always backed by the live/claimable Outbox row (never a suppressed/failed one).
    const enq = await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, payload: buildPayload(payloadSourceOf(order, book)), now });
    enqueued = true; orderStatus = 'ready'; deliveryHoldReason = null; fulfillmentVersion = enq.fulfillmentVersion;
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
  const orderData: Prisma.OrderUpdateManyMutationInput = { status: orderStatus as never, packageStatus: 'done', deliveryHoldReason };
  if (fulfillmentVersion !== undefined && fulfillmentVersion !== order.fulfillmentVersion) orderData.fulfillmentVersion = fulfillmentVersion;
  const written = await tx.order.updateMany({
    where: { id: order.id, inputVersion: order.inputVersion },
    data: orderData,
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

/** Internal signal: a newer manifest replaced the one we rechecked → roll back the suppress tx (P1-e4-1). */
class ManifestSupersededError extends Error {
  constructor() { super('manifest_superseded'); this.name = 'ManifestSupersededError'; }
}

/**
 * Send-time drift (B-r3-2 + P1-e4-1): atomic, fence-gated suppression + invalidation. In ONE transaction:
 *  1. FENCE this Outbox row → terminal `suppressed` (id + status 'processing' + attempts === token);
 *  2. ONLY if the fence held → invalidate the EXACT manifest the recheck saw (currentManifestId ===
 *     expectedManifestId) and drop the order from `ready`.
 * A worker that lost its lease matches 0 rows at step 1 → returns 'lost_lease' and changes NOTHING.
 *
 * (P1-e4-1) The dangerous race: an old worker claimed this row under manifest M1; concurrently an asset-fix
 * re-committed M2, whose enqueue saw this `processing` row and adopted it as M2's live delivery. If the old
 * worker now suppresses the row, M2 is left `ready` behind a dead Outbox. So when `invalidateReadiness` is set
 * and the manifest-guarded readiness update matches 0 rows (M2 is current, not M1), we THROW to ROLL BACK the
 * WHOLE transaction — including the fenced suppress — and return 'manifest_superseded'. An old worker can never
 * kill a row that already backs a newer manifest. The global `alreadySent` count is gone — the suppressed row
 * is, by construction, `processing`/not-sent, so un-readying is correct exactly when the manifest still matches.
 */
export async function suppressAndInvalidateDelivery(
  prisma: PrismaClient,
  args: { row: Pick<DeliveryOutbox, 'id' | 'orderId' | 'scope'>; token: number; disposition: Disposition },
): Promise<SuppressOutcome> {
  const { row, token, disposition } = args;
  try {
    return await prisma.$transaction(async (tx): Promise<SuppressOutcome> => {
      const fence = await tx.deliveryOutbox.updateMany({
        where: { id: row.id, status: 'processing', attempts: token },
        data: { status: 'suppressed', leaseExpiresAt: null, lastError: disposition.reason ?? 'suppressed' },
      });
      if (fence.count === 0) return 'lost_lease'; // lost lease — invalidate NOTHING

      if (disposition.invalidateReadiness && disposition.expectedManifestId) {
        // Drift suppress: invalidate the EXACT manifest we rechecked + un-ready. If it matches 0 rows, a newer
        // manifest replaced ours → this `processing` row now backs IT. Suppressing it would orphan the new
        // delivery → ROLL BACK the whole tx (incl. the fenced suppress) so the worker reschedules, not kills it.
        const invalidated = await tx.bookReadiness.updateMany({
          where: { orderId: row.orderId, scope: row.scope, currentManifestId: disposition.expectedManifestId },
          data: { status: 'stale', reason: disposition.reason ?? 'inputs_changed_since_manifest' },
        });
        if (invalidated.count === 0) throw new ManifestSupersededError();
        await tx.order.updateMany({ where: { id: row.orderId, status: 'ready' }, data: { status: 'needs_human_qa', deliveryHoldReason: 'base_book_readiness_stale' } });
        return 'suppressed';
      }

      // No-invalidate suppress (order_not_ready / readiness_not_passed / manifest_missing / order_or_book_missing):
      // these carry no manifest guard, but the SAME orphan race applies — a newer manifest may have adopted this
      // still-`processing` row while we were rechecking. It is safe to suppress ONLY if the order is not currently
      // deliverable behind a passed manifest; if it is now `ready` + readiness `passed`, suppressing would orphan
      // that delivery → ROLL BACK so the worker reschedules and re-checks against the current manifest.
      const liveReadiness = await tx.bookReadiness.findUnique({ where: { orderId_scope: { orderId: row.orderId, scope: row.scope } }, select: { status: true } });
      const liveOrder = await tx.order.findUnique({ where: { id: row.orderId }, select: { status: true } });
      if (liveReadiness?.status === 'passed' && liveOrder?.status === 'ready') throw new ManifestSupersededError();
      return 'suppressed';
    });
  } catch (e) {
    if (e instanceof ManifestSupersededError) return 'manifest_superseded';
    throw e;
  }
}

// Asset error codes that are TRANSIENT infra (→ retry), not a real drift / persistent failure (→ suppress).
const TRANSIENT_ASSET_RE = /^(timeout|fetch_failed|http_(429|5\d\d))$/;
function hasTransientAssetError(evidence: Record<string, unknown>): boolean {
  const cover = (evidence.cover as { error?: string } | undefined)?.error;
  const pages = ((evidence.pages as Array<{ error?: string }> | undefined) ?? []).map((p) => p.error);
  return [cover, ...pages].some((e) => typeof e === 'string' && TRANSIENT_ASSET_RE.test(e));
}

/**
 * Send-time recheck for the Outbox worker (B2 disposition + P1-e4-3 CAS). Re-evaluate integrity NOW and return:
 *  - allow:    readiness still passed, manifest inputsHash still matches the live assets, snapshot still holds.
 *  - retry:    a TRANSIENT asset error, OR a concurrent re-commit replaced the manifest we evaluated
 *              (`manifest_superseded`) — try again against the CURRENT manifest; never false-hold a valid book.
 *  - suppress: real drift (assets/text/frozen/inputVersion changed under the SAME manifest, readiness blocked,
 *              order re-held) — never ship stale.
 *
 * (P1-e4-3) The manifest is read FIRST (it is the snapshot the eval runs against), and a light CAS re-read of
 * (status, inputVersion, currentManifestId) AFTER the (slow) eval disambiguates a concurrent re-commit
 * (currentManifestId moved → retry, NOT a false suppress) from real drift (inputVersion moved under the same
 * manifest → suppress). The old code compared a torn `order` read against a separately-read manifest, so an
 * Order-old + Manifest-new pair was mis-flagged as drift → a false hold (bad in a no-human-QA system).
 */
export async function recheckBaseBookDelivery(
  prisma: PrismaClient,
  orderId: string,
  scope: string,
  deps: CommitDeps = {},
  expectedPayloadHash?: string | null,
): Promise<Disposition> {
  // (P1-e4-3) Read the EXPECTED manifest FIRST — it is the snapshot the evaluation runs against.
  const readiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope } }, select: { status: true, currentManifestId: true } });
  if (!readiness || readiness.status !== 'passed' || !readiness.currentManifestId) return { outcome: 'suppress', reason: 'readiness_not_passed' };
  const expectedManifestId = readiness.currentManifestId;
  const manifest = await prisma.bookReadinessManifest.findUnique({ where: { id: expectedManifestId }, select: { inputsHash: true, inputVersion: true } });
  if (!manifest) return { outcome: 'suppress', reason: 'manifest_missing' };

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
  // (B3) Allowlist — ONLY a `ready` order may send (fail-closed; the old blacklist let `generating` through).
  if (order.status !== 'ready') return { outcome: 'suppress', reason: `order_not_ready:${order.status}` };

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

  // (P1-e4-3) CAS: re-read (status, inputVersion, currentManifestId) AFTER the eval, immediately before the
  // worker acts, and disambiguate a concurrent re-commit from real drift.
  const cas = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, inputVersion: true } });
  const casReadiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope } }, select: { currentManifestId: true } });
  if (!cas || !casReadiness || casReadiness.currentManifestId !== expectedManifestId) {
    // A newer manifest replaced the one we evaluated → re-evaluate against IT; do NOT false-suppress a valid book.
    return { outcome: 'retry', reason: 'manifest_superseded' };
  }
  if (cas.status !== 'ready') return { outcome: 'suppress', reason: `order_not_ready:${cas.status}` };
  if (cas.inputVersion !== manifest.inputVersion) {
    // inputVersion moved but the manifest did NOT — a writer changed inputs without a re-commit → real drift.
    return { outcome: 'suppress', reason: 'inputs_changed_since_manifest', invalidateReadiness: true, expectedManifestId };
  }

  // Snapshot holds → the eval verdict stands.
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
