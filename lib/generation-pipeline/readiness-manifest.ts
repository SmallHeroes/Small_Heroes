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
import {
  evaluateBaseBookIntegrity,
  isTransientIntegrityFailure,
  BASE_BOOK_SCOPE,
  type IntegrityInput,
  type IntegrityResult,
} from './integrity-gate';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import {
  loadQualityEvidence,
  evaluateQualityGate,
  qualityEvidenceFingerprint,
  coverArtifactKey,
  pageArtifactKey,
  type QualityEvidenceRow,
  type QualityGateResult,
  type ArtifactHashes,
} from './quality-evidence';
import { enqueueDelivery, type BookReadyPayload, type CasResult } from '@/lib/generation-chunked/delivery-outbox';
import { createLogger } from '@/lib/logger';
import type { FrozenStoryProductTruth } from './frozen-product-truth';
import {
  openExceptionCase,
  resolveActiveRecoveryCaseInTx,
} from '@/lib/generation-chunked/exception-case';

const log = createLogger({ subsystem: 'readiness-manifest' });

export function isReadinessManifestEnabled(): boolean {
  return process.env.READINESS_MANIFEST_ENABLED === 'true';
}

type Tx = Prisma.TransactionClient;

export type DeliveryInputMutationReason =
  | 'story_text_finalized'
  | 'cover_asset_changed'
  | 'page_asset_changed'
  | 'page_audio_changed'
  | 'package_payload_changed'
  | 'single_page_regenerated'
  | 'page_assets_cleared'
  | 'debug_page_asset_changed'
  | 'character_anchors_changed';

export interface DeliveryInputMutationResult<T> {
  value: T;
  inputVersion: number;
  orderStatus: string;
  readinessInvalidated: boolean;
}

type VersionRow = { inputVersion: number; status: string; previousStatus: string };

function recoveryStageFor(reason: DeliveryInputMutationReason): 'page_images' | 'package' {
  // A cleared image is not yet a stable delivery input: it must be regenerated before packaging.
  // Every other writer in this contract persists its replacement value before entering the barrier,
  // so package + readiness re-evaluation is the correct crash-recovery boundary.
  return reason === 'page_assets_cleared' || reason === 'character_anchors_changed'
    ? 'page_images'
    : 'package';
}

/**
 * The single writer-side barrier for every field read by the base-book gate or delivery payload.
 * The callback MUST contain DB work only. Its mutation, readiness invalidation, ready→generating transition,
 * optional frozen-truth compare/fill, and inputVersion bump commit or roll back together.
 *
 * Lock order intentionally ends with BookReadiness → Order → GenerationJob, matching the readiness
 * commit's terminal writes. When flag-on removes a previously-ready order from delivery, this transaction
 * also makes its job reclaimable; callers must never have to repair a terminal job afterward.
 * Evaluation/download/decode happens only after this transaction at a logical stabilization boundary.
 */
export async function withDeliveryInputMutation<T>(
  prisma: PrismaClient,
  args: {
    orderId: string;
    reason: DeliveryInputMutationReason;
    frozenTruth?: FrozenStoryProductTruth;
  },
  mutate: (tx: Tx) => Promise<T>,
): Promise<DeliveryInputMutationResult<T>> {
  const readinessEnabled = isReadinessManifestEnabled();
  const staleReason = `inputs_changed:${args.reason}`;

  return prisma.$transaction(async (tx) => {
    const value = await mutate(tx);
    const invalidated = readinessEnabled
      ? await tx.bookReadiness.updateMany({
          where: {
            orderId: args.orderId,
            scope: BASE_BOOK_SCOPE,
            status: { in: ['passed', 'blocked'] },
          },
          data: { status: 'stale', reason: staleReason },
        })
      : { count: 0 };

    let rows: VersionRow[];
    if (args.frozenTruth) {
      const frozen = args.frozenTruth;
      rows = await tx.$queryRaw<VersionRow[]>`
        WITH prior AS MATERIALIZED (
          SELECT "id", "status"::text AS "previousStatus"
            FROM "Order"
           WHERE "id" = ${args.orderId}
           FOR UPDATE
        )
        UPDATE "Order" AS target
           SET "inputVersion" = "inputVersion" + 1,
               "expectedPageCount" = COALESCE("expectedPageCount", ${frozen.expectedPageCount}),
               "storySourceHash" = COALESCE("storySourceHash", ${frozen.storySourceHash}),
               "selectionFilename" = COALESCE("selectionFilename", ${frozen.selectionFilename}),
               "frozenProductVersion" = COALESCE("frozenProductVersion", ${frozen.frozenProductVersion}),
               "status" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN 'generating'::"OrderStatus"
                 ELSE "status"
               END,
               "packageStatus" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN 'pending'::"GenerationStatus"
                 ELSE "packageStatus"
               END,
               "imageStatus" = CASE
                 WHEN ${readinessEnabled} AND ${args.reason === 'page_assets_cleared'} AND "status" = 'ready'::"OrderStatus"
                   THEN 'pending'::"GenerationStatus"
                 ELSE "imageStatus"
               END,
               "deliveryHoldReason" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN ${`base_book_integrity:${staleReason}`}
                 ELSE "deliveryHoldReason"
               END
          FROM prior
         WHERE target."id" = prior."id"
           AND (target."expectedPageCount" IS NULL OR target."expectedPageCount" = ${frozen.expectedPageCount})
           AND (target."storySourceHash" IS NULL OR target."storySourceHash" = ${frozen.storySourceHash})
           AND (target."selectionFilename" IS NULL OR target."selectionFilename" = ${frozen.selectionFilename})
           AND (target."frozenProductVersion" IS NULL OR target."frozenProductVersion" = ${frozen.frozenProductVersion})
         RETURNING target."inputVersion", target."status"::text, prior."previousStatus"`;
    } else {
      rows = await tx.$queryRaw<VersionRow[]>`
        WITH prior AS MATERIALIZED (
          SELECT "id", "status"::text AS "previousStatus"
            FROM "Order"
           WHERE "id" = ${args.orderId}
           FOR UPDATE
        )
        UPDATE "Order" AS target
           SET "inputVersion" = "inputVersion" + 1,
               "status" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN 'generating'::"OrderStatus"
                 ELSE "status"
               END,
               "packageStatus" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN 'pending'::"GenerationStatus"
                 ELSE "packageStatus"
               END,
               "imageStatus" = CASE
                 WHEN ${readinessEnabled} AND ${args.reason === 'page_assets_cleared'} AND "status" = 'ready'::"OrderStatus"
                   THEN 'pending'::"GenerationStatus"
                 ELSE "imageStatus"
               END,
               "deliveryHoldReason" = CASE
                 WHEN ${readinessEnabled} AND "status" = 'ready'::"OrderStatus"
                   THEN ${`base_book_integrity:${staleReason}`}
                 ELSE "deliveryHoldReason"
               END
          FROM prior
         WHERE target."id" = prior."id"
         RETURNING target."inputVersion", target."status"::text, prior."previousStatus"`;
    }

    if (rows.length !== 1) {
      throw new Error(args.frozenTruth ? 'frozen_product_truth_mismatch' : 'delivery_input_order_missing');
    }
    const removedFromReady =
      readinessEnabled &&
      rows[0].previousStatus === 'ready' &&
      rows[0].status === 'generating';
    if (removedFromReady) {
      const recoveryStage = recoveryStageFor(args.reason);
      await tx.generationJob.update({
        where: { orderId: args.orderId },
        data: {
          status: 'pending',
          currentStage: recoveryStage,
          packaged: false,
          completedAt: null,
          failedAt: null,
          lastError: null,
          retryable: false,
          lockedBy: null,
          leaseExpiresAt: null,
          staleReclaimCount: 0,
          lastReclaimStage: null,
          lastChainStatus: null,
          lastChainError: null,
          lastWorkerKickAt: null,
          triggerReason: `delivery_input_changed:${args.reason}`,
          ...(recoveryStage === 'page_images'
            ? {
                imagesDone: false,
                completedPageNumbers: [] as Prisma.InputJsonValue,
                failedPageNumbers: [] as Prisma.InputJsonValue,
                pageAttempts: {} as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    }
    return {
      value,
      inputVersion: rows[0].inputVersion,
      orderStatus: rows[0].status,
      readinessInvalidated: invalidated.count > 0,
    };
  });
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
interface LoadedInputs { order: OrderTruth; book: BookData; quality: QualityEvidenceRow[]; fingerprint: string }

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
  quality: string;
}): string {
  return createHash('sha256').update(JSON.stringify({
    frozen: [f.expectedPageCount, f.storySourceHash, f.selectionFilename, f.frozenProductVersion, f.fulfillmentVersion, f.inputVersion],
    payload: [f.customerEmail, f.customerName, f.childName, f.readUrl, f.pdfUrl, f.firstAudioUrl],
    cover: f.cover, pages: f.pages,
    // (#7-a) Quality evidence participates in the TOCTOU fingerprint: an evidence mutation between eval and
    // commit drifts this hash → the commit aborts + re-evaluates FRESH, so a stale quality verdict never ships.
    quality: f.quality,
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
  const quality = await loadQualityEvidence(db, orderId);
  const fingerprint = fingerprintOf({
    ...order, readUrl: book.readUrl, pdfUrl: book.pdfUrl, firstAudioUrl: book.firstAudioUrl,
    cover: book.coverImageUrl, pages: pages.map((p) => [p.pageNumber, p.text, p.imageUrl] as [number, string, string | null]),
    quality: qualityEvidenceFingerprint(quality),
  });
  return { order, book, quality, fingerprint };
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

/** (#7-a) The combined integrity+quality decision the commit tx acts on. */
interface ReadinessDecision {
  status: 'passed' | 'blocked';
  reason: string | null;
  inputsHash: string;
  evidence: Record<string, unknown>;
  /** On block: which recovery case to open. quality_failed = terminal (refund); the other two = retry-scheduled. */
  blockExceptionKind: 'quality_failed' | 'infra_transient' | 'integrity_blocked' | null;
  blockClassification: string;
}

/** The current delivered-bytes hash per artifact, taken from the integrity gate's inspect evidence (the same
 *  bytes — presentationUrl ?? url — the quality evidence was written against). The anti-bypass source of truth. */
function currentArtifactHashes(integrity: IntegrityResult): ArtifactHashes {
  const hashes: ArtifactHashes = new Map();
  const cover = integrity.evidence.cover as { sha256?: string | null } | undefined;
  hashes.set(coverArtifactKey(), cover?.sha256 ?? null);
  const pages = (integrity.evidence.pages as Array<{ pageNumber?: number; sha256?: string | null }> | undefined) ?? [];
  for (const p of pages) {
    if (typeof p.pageNumber === 'number') hashes.set(pageArtifactKey(p.pageNumber), p.sha256 ?? null);
  }
  return hashes;
}

/**
 * (#7-a) Combine the deterministic integrity gate with the durable Quality gate, FAIL-CLOSED.
 * An integrity block wins (keeps the existing transient/deterministic routing). Otherwise the Quality gate
 * decides: passed → PASS; failed-after-budget → BLOCK + terminal quality_failed (→ refund_pending);
 * evidence_unknown/missing/stale/hash-mismatch → BLOCK + infra_transient (retry QA vs the SAME asset).
 * There is NO path to PASS without a `passed` quality verdict for every required artifact. Quality evidence is
 * folded into inputsHash so a later evidence change invalidates the manifest.
 */
function decideReadiness(integrity: IntegrityResult, quality: QualityGateResult): ReadinessDecision {
  const inputsHash = createHash('sha256')
    .update(JSON.stringify({ integrity: integrity.inputsHash, quality: quality.evidence, qualityStatus: quality.status }))
    .digest('hex');
  const evidence = { ...integrity.evidence, quality: quality.evidence, qualityStatus: quality.status };
  if (integrity.status === 'blocked') {
    const transient = isTransientIntegrityFailure(integrity);
    return {
      status: 'blocked', reason: integrity.reason, inputsHash, evidence,
      blockExceptionKind: transient ? 'infra_transient' : 'integrity_blocked',
      blockClassification: transient ? 'validator_transient' : 'deterministic_block',
    };
  }
  if (quality.status === 'passed') {
    return { status: 'passed', reason: null, inputsHash, evidence, blockExceptionKind: null, blockClassification: 'passed' };
  }
  if (quality.status === 'failed') {
    return { status: 'blocked', reason: quality.reason, inputsHash, evidence, blockExceptionKind: 'quality_failed', blockClassification: 'quality_failed' };
  }
  return { status: 'blocked', reason: quality.reason, inputsHash, evidence, blockExceptionKind: 'infra_transient', blockClassification: 'quality_evidence_unknown' };
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
async function runReadinessTxn(tx: Tx, args: CommitArgs, loaded: LoadedInputs, decision: ReadinessDecision, now: Date): Promise<CommitResult> {
  // (0) TOCTOU guard — the assets/text/frozen/QUALITY-EVIDENCE must not have changed between the (out-of-tx)
  // eval and now (the fingerprint folds in the quality evidence, so a re-QA between eval and commit drifts it).
  const inTx = await loadCommitInputs(tx, args.orderId);
  if (!inTx || inTx.fingerprint !== loaded.fingerprint) throw new Error(TOCTOU);

  const { order, book } = loaded;
  const scope = BASE_BOOK_SCOPE;
  const revision = await nextRevision(tx, order.id, scope);

  // (1) IMMUTABLE manifest — terminal INSERT (throws P2002 on a concurrent same-revision insert). A BLOCKED
  // eval writes an immutable BLOCKED manifest too (durable evidence + reason); the pass/block state is never
  // mutated. Records the Order.inputVersion this evaluation observed for the send-time recheck.
  const manifest = await tx.bookReadinessManifest.create({
    data: { orderId: order.id, scope, revision, status: decision.status, inputsHash: decision.inputsHash, inputVersion: order.inputVersion, evidence: decision.evidence as unknown as Prisma.InputJsonValue, reason: decision.reason },
  });

  // (2) MUTABLE readiness pointer → current manifest.
  await tx.bookReadiness.upsert({
    where: { orderId_scope: { orderId: order.id, scope } },
    create: { orderId: order.id, scope, status: decision.status, currentManifestId: manifest.id, reason: decision.reason },
    update: { status: decision.status, currentManifestId: manifest.id, reason: decision.reason },
  });

  if (decision.status === 'blocked') {
    // (#7-a) BLOCKED manifest + readiness=blocked + order hold + ExceptionCase in ONE atomic tx; NO Outbox row on
    // any blocked path. quality_failed is a deterministic TERMINAL (→ refund_pending via its disposition);
    // infra_transient / integrity_blocked schedule a retry.
    const kind = decision.blockExceptionKind ?? 'integrity_blocked';
    const retryScheduled = kind === 'infra_transient' || kind === 'integrity_blocked';
    await openExceptionCase(tx, {
      orderId: order.id,
      scope,
      kind,
      reason: decision.reason ?? kind,
      sourceRef: `readiness:${manifest.id}`,
      now,
      ...(retryScheduled ? { initialStatus: 'retry_scheduled' as const, nextActionAt: new Date(now.getTime() + 60_000) } : {}),
      metadata: {
        manifestId: manifest.id,
        revision,
        classification: decision.blockClassification,
      },
    });
  } else {
    await resolveActiveRecoveryCaseInTx(tx, {
      orderId: order.id,
      scope,
      kinds: ['infra_transient', 'integrity_blocked'],
      reason: `readiness_passed:${manifest.id}`,
      now,
    });
  }

  const activeException = decision.status === 'passed'
    ? await tx.exceptionCase.findUnique({
        where: { activeKey: `${order.id}:${scope}` },
        select: { kind: true, status: true },
      })
    : null;

  let enqueued = false;
  let orderStatus: string;
  let deliveryHoldReason: string | null;
  if (decision.status === 'passed' && activeException) {
    // A refund/reconciliation/customer action is already authoritative. Do not deliver-and-refund.
    orderStatus = 'failed';
    deliveryHoldReason = `exception_case:${activeException.kind}:${activeException.status}`;
  } else if (decision.status === 'passed' && args.anchorAllowsDelivery) {
    // (3) enqueue the delivery IN the same transaction (enqueue != send), then (4) mark the order ready.
    // Reached ONLY when integrity AND quality both passed for every required artifact (fail-closed).
    // (P1-f #3h) A re-commit REBINDS the existing Outbox row in place (same dedupeKey → same idempotency key),
    // so fulfillmentVersion never rolls here — the delivery-intent is stable; the manifest is just its proof.
    await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, manifestId: manifest.id, inputVersion: order.inputVersion, payload: buildPayload(payloadSourceOf(order, book)), now });
    enqueued = true; orderStatus = 'ready'; deliveryHoldReason = null;
  } else if (decision.status === 'passed') {
    // Integrity + quality passed but the ANCHOR still holds delivery (Phase-1 keeps the anchor hold — fix #4). No enqueue.
    orderStatus = args.anchorOrderStatus; deliveryHoldReason = args.anchorReason;
  } else {
    // BLOCKED (integrity or quality) → held, NO enqueue, NO email; recovery is the ExceptionCase path above.
    orderStatus = 'needs_human_qa'; deliveryHoldReason = `base_book_integrity:${decision.reason ?? 'blocked'}`;
  }

  // (4) Order write is CONDITIONAL on inputVersion being unchanged (B4 optimistic concurrency): if any writer
  // bumped Order.inputVersion since the evaluation, this matches 0 rows → abort the whole tx as a TOCTOU drift
  // (reload FRESH + re-evaluate). Stronger than the early fingerprint read: it makes the final write itself atomic.
  const orderData: Prisma.OrderUpdateManyMutationInput = { status: orderStatus as never, packageStatus: 'done', deliveryHoldReason };
  const written = await tx.order.updateMany({
    where: { id: order.id, inputVersion: order.inputVersion },
    data: orderData,
  });
  if (written.count === 0) throw new Error(TOCTOU);
  // (5) GenerationJob terminal — the package stage ran.
  await tx.generationJob.update({ where: { orderId: order.id }, data: { status: 'done', currentStage: 'done', completedAt: now, packaged: true } });
  return { manifestStatus: decision.status, enqueued, orderStatus, reason: deliveryHoldReason, revision };
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
    // (#7-a) FAIL-CLOSED Quality gate. Required artifacts = cover + every rendered page. The current
    // delivered-bytes hash comes from the integrity gate's inspect (same presentationUrl ?? url bytes), so a
    // PASS row for other bytes cannot authorize the delivered image. No `passed` for every artifact → BLOCK.
    const requiredKeys = [coverArtifactKey(), ...loaded.book.pages.map((p) => pageArtifactKey(p.pageNumber))];
    const quality = evaluateQualityGate(requiredKeys, loaded.quality, currentArtifactHashes(result));
    const decision = decideReadiness(result, quality);
    try {
      return await prisma.$transaction((tx) => runReadinessTxn(tx, args, loaded, decision, now));
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
 * (P1-f) The single atomic send-time CAS. In ONE SQL statement: renew the lease + set sendAttempted +
 * increment sendAttempts + set firstSendAttemptAt (COALESCE — set once, on the first attempt; #3h) IFF the row is still ours (status
 * 'processing' + this fencing token) AND the live truth still matches the row's binding:
 *   - Order.status = 'ready' AND Order.inputVersion = row.inputVersion (the inputVersion match also covers
 *     payload-field drift, because every writer of a gate/payload input advances inputVersion in the SAME tx
 *     through withDeliveryInputMutation);
 *   - BookReadiness.status = 'passed' AND BookReadiness.currentManifestId = row.manifestId;
 *   - the stored payloadHash is unchanged (a row-integrity binding; the real payload recompute is in processDelivery).
 * No re-eval, no readiness invalidation here, no retry loop. A CAS mismatch is NEVER a business revocation — on
 * a 0-row miss it diagnoses (#3h-D), and both non-ok terminals are RECOVERABLE (rebind-eligible on a re-commit):
 *   - lost_lease             — status/token moved (another worker reclaimed).
 *   - superseded_by_manifest — defense-in-depth: STILL ours, and a newer VALID manifest owns the order (ready +
 *                              passed, different currentManifestId). Recoverable via the re-commit rebind.
 *   - delivery_blocked       — STILL ours, but the order is not-yet-deliverable for a TRANSIENT reason (order not
 *                              ready — paid/generating/needs_human_qa/partial — or readiness not passed /
 *                              inputs_stale). RECOVERABLE: a re-commit rebinds it on return to ready — but only
 *                              while sendAttempted=false (a post-send blocked row goes to reconciliation instead).
 */
export async function casClaimSendSlot(
  prisma: PrismaClient,
  row: Pick<DeliveryOutbox, 'id' | 'orderId' | 'scope' | 'manifestId' | 'inputVersion' | 'payloadHash'>,
  token: number,
  leaseExpiresAt: Date,
  now: Date,
): Promise<CasResult> {
  const updated = await prisma.$executeRaw`
    UPDATE "DeliveryOutbox" AS o
       SET "sendAttempted" = true,
           "sendAttempts" = o."sendAttempts" + 1,
           "firstSendAttemptAt" = COALESCE(o."firstSendAttemptAt", ${now}),
           "leaseExpiresAt" = ${leaseExpiresAt}
     WHERE o."id" = ${row.id}
       AND o."status" = 'processing'
       AND o."attempts" = ${token}
       AND o."payloadHash" = ${row.payloadHash}
       AND o."manifestId" = ${row.manifestId}
       AND o."inputVersion" = ${row.inputVersion}
       AND EXISTS (
         SELECT 1 FROM "Order" ord
          WHERE ord."id" = o."orderId" AND ord."status" = 'ready' AND ord."inputVersion" = o."inputVersion"
       )
       AND EXISTS (
         SELECT 1 FROM "BookReadiness" br
          WHERE br."orderId" = o."orderId" AND br."scope" = o."scope"
            AND br."status" = 'passed' AND br."currentManifestId" = o."manifestId"
       )`;
  if (updated === 1) return 'ok';
  // 0 rows: lost the lease, or the binding moved. Re-read; only if we STILL own the row (processing + this
  // token) is it a true CAS mismatch — then classify supersession-by-manifest vs a (recoverable) block (#3h-D).
  const cur = await prisma.deliveryOutbox.findUnique({ where: { id: row.id }, select: { status: true, attempts: true } });
  if (!cur || cur.status !== 'processing' || cur.attempts !== token) return 'lost_lease';
  const [order, readiness] = await Promise.all([
    prisma.order.findUnique({ where: { id: row.orderId }, select: { status: true } }),
    prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId: row.orderId, scope: row.scope } }, select: { status: true, currentManifestId: true } }),
  ]);
  // Defense-in-depth: a newer VALID manifest genuinely owns the order → recoverable via a re-commit's rebind.
  if (order?.status === 'ready' && readiness?.status === 'passed' && readiness.currentManifestId !== row.manifestId) {
    return 'superseded_by_manifest';
  }
  // Otherwise the order is not-yet-deliverable for a TRANSIENT reason (not ready, or readiness not passed). This
  // is NEVER a business revocation — the CAS cannot infer a cancellation from a generic status. RECOVERABLE.
  return 'delivery_blocked';
}
