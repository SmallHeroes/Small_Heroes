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
import { Prisma } from '@prisma/client';
import type { PrismaClient, DeliveryOutbox } from '@prisma/client';
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
  type HardHoldKind,
} from './quality-evidence';
import { enqueueDelivery, type BookReadyPayload, type CasResult } from '@/lib/generation-chunked/delivery-outbox';
import { listenUrlFromReadUrl } from '@/lib/routes';
import {
  buildQaWarningsFromAnchorHold,
  buildQaWarningsFromReadinessBlock,
  canUseQaSoftDeliver,
  mergeQaWarnings,
  type QaWarnings,
} from '@/lib/qa-soft-deliver';
import type { AnchorLowConfidence } from '@/lib/anchor-resemblance-gate';
import { runAtomicOperation, hashOperationPayload, type AtomicOperationDeps, type ReceiptSafeValue } from './atomic-operation';
import { writeOrderHoldFenced, executeReadinessShipCas } from './order-authority';
import { applyReleaseInTx, projectReleaseOntoQuality, ReleaseAdmissibilityError, type SafetyReleaseRequest, type ReleaseRuntime, type ReleaseApplied } from './safety-release';
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
  | 'character_anchors_changed'
  // (WS0b) Freeze the BookVisualContract before the cover: stamps Order.visualContractHash + persists the
  // contract into pipelineCache. Runs on 'generating' orders (before any paid image), so it never triggers the
  // ready→generating recovery branch; recoveryStageFor's default ('package') is inert for it.
  | 'visual_contract_frozen'
  // (Set Identity Board, Milestone C) Activate/bind the per-order approved set boards into
  // pipelineCache.setIdentityBoards, between the contract freeze and the first paid image. Like
  // 'visual_contract_frozen' it runs on 'generating' orders only (never on a ready order), so it never triggers
  // the ready→generating recovery branch; recoveryStageFor's default ('package') is inert for it.
  | 'set_identity_board_bound';

export interface DeliveryInputMutationResult<T extends ReceiptSafeValue> {
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
export async function withDeliveryInputMutation<T extends ReceiptSafeValue>(
  prisma: PrismaClient,
  args: {
    orderId: string;
    reason: DeliveryInputMutationReason;
    frozenTruth?: FrozenStoryProductTruth;
    /**
     * (pooler-fix / Codex B′) Durable render/write-attempt id — the exactly-once fence key. Survives worker
     * retries and is stable across the internal P2028 retry, so an ambiguous commit (tx committed, caller saw
     * P2028) replays the recorded result instead of double-applying the mutation / double-bumping inputVersion.
     * NOT merely a content hash — each call site builds `delivery_input:<order>:<slot>:<content-addressed-url>`
     * so a genuine re-render (new bytes → new url) is a NEW operation, while an identical replay is fenced.
     * When absent (or flag-off), the legacy direct transaction runs — byte-identical to pre-B′ behavior.
     */
    operationKey?: string;
    /**
     * (Codex B′ P1 #1) The REAL mutation payload — the actual content this barrier persists (prompt, delivered
     * URL, dims, idempotencyKey, QA context, personalized text, …). Folded into the receipt payloadHash so a
     * same-operationKey retry that carries genuinely DIFFERENT content FAILS CLOSED instead of silently replaying
     * a stale result. REQUIRED on the fenced path (flag-on + an operationKey); a bare `{reason, key}` hash is
     * insufficient because the key alone cannot detect a content drift under a colliding key.
     */
    mutationPayload?: ReceiptSafeValue;
    /** Receipt `kind` label (observability only; the operationKey is the fence). Defaults to 'delivery_input'. */
    kind?: string;
    /** Test/proof injection (afterCommit ambiguous-commit hook, sleep, maxAttempts). */
    atomic?: AtomicOperationDeps;
  },
  mutate: (tx: Tx) => Promise<T>,
): Promise<DeliveryInputMutationResult<T>> {
  const readinessEnabled = isReadinessManifestEnabled();
  const staleReason = `inputs_changed:${args.reason}`;

  const runBody = async (tx: Tx): Promise<DeliveryInputMutationResult<T>> => {
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
  };

  // (Codex B′) Flag-on + a durable key → receipt-fenced exactly-once tx (survives the 6543 pooler recycling the
  // connection across the render gap: an ambiguous commit replays the recorded result, never re-bumps inputVersion).
  // The receipt row is written IN THE SAME tx as the mutation + inputVersion++ (all-or-nothing). Flag-off, or no
  // key supplied, keeps the legacy direct transaction unchanged.
  if (readinessEnabled && args.operationKey) {
    // (P1 #1) The REAL mutation payload is REQUIRED on the fenced path — fail closed on a caller that forgot it,
    // rather than fence on a weak {reason, key} hash that cannot detect a content drift under a colliding key.
    if (args.mutationPayload === undefined) {
      throw new Error(`delivery_input_mutation_payload_required:${args.reason}:${args.operationKey}`);
    }
    return runAtomicOperation(
      prisma,
      {
        operationKey: args.operationKey,
        orderId: args.orderId,
        kind: args.kind ?? 'delivery_input',
        // Fold the actual persisted content into the fence hash → a same-key/different-content retry fails closed.
        payloadHash: hashOperationPayload({ reason: args.reason, key: args.operationKey, mutation: args.mutationPayload }),
        run: runBody,
      },
      args.atomic,
    );
  }
  return prisma.$transaction(runBody);
}

export interface OrderTruth {
  id: string;
  fulfillmentVersion: number;
  /** Optimistic-concurrency token (B4): commit + send are conditional on this being unchanged. */
  inputVersion: number;
  /** (delivery fence — Codex round-4 P0) Monotonic SHARED delivery-authority token. Every hold write bumps it; the
   *  `ready` transition binds to the observed value so a hold landing during the commit aborts the ship. */
  deliveryFenceVersion: number;
  expectedPageCount: number | null;
  storySourceHash: string | null;
  selectionFilename: string | null;
  frozenProductVersion: string | null;
  customerEmail: string;
  customerName: string | null;
  childName: string;
  /** (WS0b) Active frozen visual-contract hash (null = none). Folded into the TOCTOU fingerprint + threaded to
   *  the quality gate so a row bound to a superseded contract is re-QA'd. */
  visualContractHash: string | null;
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
  /** Anchor low-confidence telemetry for QA soft-deliver warnings (optional). */
  anchorLowConfidence?: AnchorLowConfidence;
  /**
   * (re-gate round-3 P0) OPT-IN authorized-release precondition. Supplied ONLY by the flag-ON anchor-release
   * break-glass (app/api/admin/anchor-hold-release), NEVER by the normal post-generation delivery path. When set,
   * the final Order write additionally requires the row to STILL be held at EXACTLY this marker with no payment
   * fence (`status='needs_human_qa'` AND `deliveryHoldReason=<this>` AND `manualReviewRequired=false`), making the
   * guard ATOMIC with the flip. The anchor-release authorization runs in a SEPARATE, already-committed tx and
   * releases its lock before this commit; a stronger hold (safety_hold / payment fence) that lands in that window
   * does NOT bump `inputVersion`, so the plain `id+inputVersion` CAS would clobber it to `ready` + enqueue Outbox =
   * ship an unsafe book. Comparing against the authorized marker makes the CAS match 0 rows → `ReleasePreconditionError`
   * → the caller returns a typed 409, nothing ships. Callers that OMIT this are byte-unchanged.
   */
  requireHold?: { deliveryHoldReason: string };
  /**
   * (release-as-readiness-mode, 2a-2) An operator FALSE-POSITIVE safety release. When set, commitBaseBookReadiness
   * runs the release MODE: the Gate-1 override is PROJECTED onto a copy of the quality rows so the decision passes
   * (the fingerprint stays raw), and INSIDE the tx `applyReleaseInTx` re-checks admissibility on RAW data (authority),
   * writes both gate overrides, transitions the marker safety_hold:hazard: → qa_released:safety:, closes the safety
   * case, and audits — all-or-nothing with the ship. Undefined → not one line of this runs (structural inertness).
   */
  release?: SafetyReleaseRequest;
}

/**
 * (re-gate round-3 P0) Thrown by the readiness commit when a supplied `requireHold` precondition no longer holds —
 * the row is no longer `needs_human_qa` at exactly the authorized marker (a stronger hold landed, or it was already
 * released). Distinct from a TOCTOU (which retries) and from `OutboxReconciliationError`: it is NEVER retried and
 * the anchor-release route maps it to a typed 409 with no delivery of any kind.
 */
export class ReleasePreconditionError extends Error {
  readonly expectedHoldReason: string;
  readonly actual: { status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean } | null;
  constructor(
    expectedHoldReason: string,
    actual: { status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean } | null,
  ) {
    super('readiness_release_precondition_failed');
    this.name = 'ReleasePreconditionError';
    this.expectedHoldReason = expectedHoldReason;
    this.actual = actual;
  }
}

/**
 * (delivery fence — Codex round-4 P0) Thrown by runReadinessTxn's ready-CAS when the SHARED delivery fence detects
 * a competing hold at ship time — the fence moved, a terminal marker / payment fence is present, or an active
 * strong Human-QA case exists — on a NORMAL (non-requireHold) commit. It rolls back the whole readiness tx (no
 * `ready`, no Outbox row survives). commitBaseBookReadiness catches it and returns a HELD CommitResult (enqueued
 * false, not shipped) — the order stays held; the reconciler/recovery owns it. Never retried into a ship.
 */
export class DeliveryFenceError extends Error {
  readonly actual: { status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean; deliveryFenceVersion: number } | null;
  constructor(
    public readonly orderId: string,
    actual: { status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean; deliveryFenceVersion: number } | null,
  ) {
    super('readiness_delivery_fence_blocked');
    this.name = 'DeliveryFenceError';
    this.actual = actual;
  }
}
function isDeliveryFenceBlocked(e: unknown): e is DeliveryFenceError {
  return e instanceof DeliveryFenceError || (!!e && typeof e === 'object' && (e as { name?: string }).name === 'DeliveryFenceError');
}
export interface CommitDeps {
  inspect?: (url: string | null | undefined) => Promise<AssetInspection>;
  now?: () => Date;
  /** App origin the readUrl is validated against (B5). Defaults to NEXT_PUBLIC_APP_URL/APP_URL. */
  appBaseUrl?: string | null;
  /** (Codex B′) Test/proof injection for the receipt fence (afterCommit ambiguous-commit hook, sleep, maxAttempts). */
  atomic?: AtomicOperationDeps;
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

/** Pure delivery plan for a readiness commit (no DB). Drives both runReadinessTxn and receipt keying. */
export interface ReadinessDeliveryPlan {
  enqueued: boolean;
  orderStatus: string;
  deliveryHoldReason: string | null;
  skipExceptionCase: boolean;
  usesSoftDeliver: boolean;
}

export function resolveReadinessDeliveryPlan(
  args: CommitArgs,
  decision: Pick<ReadinessDecision, 'status' | 'reason' | 'contractHardHold' | 'hardHoldKind'>,
  softDeliver: boolean,
): ReadinessDeliveryPlan {
  // (Slice A) A hard hold — a deterministic contract-world drift OR (Fix 5) a physical-safety hold — is a TERMINAL
  // human-QA PARK: held at needs_human_qa with NO exception case (skipExceptionCase) → no regen-rescue redrive, no
  // auto-refund, in BOTH budget states. Never soft-delivered. Checked FIRST so neither the soft-deliver nor the
  // exception-case path can act on it. The hold clears only when a human re-renders (a fresh commit re-evaluates).
  // A DISTINCT top-level marker per kind (`safety_hold:` vs `contract_world_hold:`) is what start.ts + the
  // exception-processor key off — a universal child-safety hold must NOT be misreported as a contract-world drift.
  if (decision.status === 'blocked' && decision.contractHardHold) {
    const marker = decision.hardHoldKind === 'safety' ? 'safety_hold' : 'contract_world_hold';
    return {
      enqueued: false,
      orderStatus: 'needs_human_qa',
      deliveryHoldReason: `${marker}:${decision.reason ?? 'blocked'}`,
      skipExceptionCase: true,
      usesSoftDeliver: false,
    };
  }
  if (decision.status === 'blocked' && softDeliver) {
    return {
      enqueued: true,
      orderStatus: 'ready',
      deliveryHoldReason: `qa_soft_deliver:${decision.reason ?? 'blocked'}`,
      skipExceptionCase: true,
      usesSoftDeliver: true,
    };
  }
  if (decision.status === 'passed' && args.anchorAllowsDelivery) {
    return {
      enqueued: true,
      orderStatus: 'ready',
      deliveryHoldReason: null,
      skipExceptionCase: false,
      usesSoftDeliver: false,
    };
  }
  if (decision.status === 'passed' && softDeliver && !args.anchorAllowsDelivery) {
    return {
      enqueued: true,
      orderStatus: 'ready',
      deliveryHoldReason: `qa_soft_deliver:${args.anchorReason ?? 'anchor_hold'}`,
      skipExceptionCase: false,
      usesSoftDeliver: true,
    };
  }
  if (decision.status === 'passed') {
    return {
      enqueued: false,
      orderStatus: args.anchorOrderStatus,
      deliveryHoldReason: args.anchorReason,
      skipExceptionCase: false,
      usesSoftDeliver: false,
    };
  }
  return {
    enqueued: false,
    orderStatus: 'needs_human_qa',
    deliveryHoldReason: `base_book_integrity:${decision.reason ?? 'blocked'}`,
    skipExceptionCase: false,
    usesSoftDeliver: false,
  };
}

function buildReadinessCommitMutationPayload(
  args: CommitArgs,
  decision: ReadinessDecision,
  inputVersion: number,
  anchorDisposition: string,
  plan: ReadinessDeliveryPlan,
): Record<string, ReceiptSafeValue> {
  let qaWarningsReason: string | null = null;
  let anchorScore: number | null = null;
  if (plan.usesSoftDeliver) {
    if (decision.status === 'blocked') {
      const warnings = mergeQaWarnings(
        buildQaWarningsFromReadinessBlock({ reason: decision.reason, evidence: decision.evidence }),
        args.anchorLowConfidence
          ? buildQaWarningsFromAnchorHold(args.anchorLowConfidence)
          : null,
      );
      qaWarningsReason = warnings.wouldHaveReason;
      anchorScore = warnings.anchor?.score ?? args.anchorLowConfidence?.score ?? null;
    } else {
      const warnings = buildQaWarningsFromAnchorHold(
        args.anchorLowConfidence,
        args.anchorReason,
      );
      qaWarningsReason = warnings.wouldHaveReason;
      anchorScore = warnings.anchor?.score ?? args.anchorLowConfidence?.score ?? null;
    }
  }
  return {
    inputVersion,
    inputsHash: decision.inputsHash,
    anchor: anchorDisposition,
    status: decision.status,
    enqueued: plan.enqueued,
    orderStatus: plan.orderStatus,
    deliveryHoldReason: plan.deliveryHoldReason,
    qaWarningsReason,
    anchorScore,
  };
}

/** Receipt fence binding — keys the durable commit outcome, not the QA_SOFT_DELIVER env flag. */
export function buildReadinessCommitReceiptBinding(
  args: CommitArgs,
  inputVersion: number,
  decision: ReadinessDecision,
  softDeliver: boolean = canUseQaSoftDeliver(),
  deliveryFenceVersion: number = 0,
): { operationKey: string; payloadHash: string; plan: ReadinessDeliveryPlan } {
  const anchorDisposition = `${args.anchorAllowsDelivery ? 1 : 0}:${args.anchorOrderStatus}:${args.anchorReason ?? ''}`;
  // (delivery fence — Codex round-4 P1) The authorized-release CAPABILITY (requireHold + its exact marker) is part
  // of the receipt IDENTITY. Without it, a GUARDED anchor-release call (requireHold set) shares an operationKey with
  // an earlier UNGUARDED commit of the same payload → the fence replays the recorded result at atomic-operation.ts's
  // short-circuit and the precondition CAS never runs. Folding it into the key (and, via the key, the payloadHash)
  // means a guarded call can never be satisfied by an unguarded receipt.
  const releaseCapability = args.requireHold ? `rh:${args.requireHold.deliveryHoldReason}` : 'norh';
  const plan = resolveReadinessDeliveryPlan(args, decision, softDeliver);
  // (delivery fence — Codex round-6 Unit C) The LOAD-TIME deliveryFenceVersion belongs in the receipt IDENTITY ONLY
  // for a commit that AUTHORIZES DELIVERY — a ship or an authorized release (⇔ plan.orderStatus === 'ready', the sole
  // deliverable outcome). Splitting by outcome:
  //   • SHIP/RELEASE need it (round-5 P1): a ship computed at fence N must NOT replay its recorded `ready` once a hold
  //     has moved the world to N+1. Folding the load-time fence into the key forces a FRESH CAS at the new fence — the
  //     stale ship can never short-circuit through the receipt.
  //   • A plain HOLD must NOT carry it (this round): a hold BUMPS its own fence, so a fresh CROSS-WORKER redrive would
  //     read N+1, derive a DIFFERENT key, and APPLY THE HOLD AGAIN (a second bump) — idempotent only within one
  //     in-call P2028 retry, not across redrives. A hold's identity is (order, inputVersion, inputsHash, anchor,
  //     releaseCapability); keeping it fence-INDEPENDENT makes any redrive REPLAY the recorded hold at the atomic
  //     short-circuit (exactly-once — no double bump). Within-retry idempotency is unchanged for both — runAtomicOperation
  //     reuses the one pre-computed key.
  const authorizesDelivery = plan.orderStatus === 'ready'; // the only delivery-authorizing outcome (⇔ plan.enqueued)
  const fenceIdentity = authorizesDelivery ? `fence${deliveryFenceVersion}` : 'holdfenceNA';
  const operationKey =
    `readiness_commit:${args.orderId}:${BASE_BOOK_SCOPE}:${inputVersion}:${decision.inputsHash}:${anchorDisposition}:${releaseCapability}:${fenceIdentity}`;
  const mutationPayload = buildReadinessCommitMutationPayload(
    args,
    decision,
    inputVersion,
    anchorDisposition,
    plan,
  );
  return {
    operationKey,
    payloadHash: hashOperationPayload({ key: operationKey, mutation: mutationPayload }),
    plan,
  };
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
  fulfillmentVersion: number; inputVersion: number; deliveryFenceVersion: number;
  customerEmail: string; customerName: string | null; childName: string; readUrl: string | null; pdfUrl: string | null; firstAudioUrl: string | null;
  cover: string | null; pages: Array<[number, string, string | null]>;
  quality: string; visualContractHash: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify({
    // (delivery fence — Codex round-4 P0) deliveryFenceVersion joins the fingerprint: a hold write that bumps it
    // between the out-of-tx eval and the in-tx commit drifts this hash → early TOCTOU abort (before the manifest),
    // in addition to the final ready-CAS fence binding. Defense-in-depth against the READ COMMITTED interleave.
    frozen: [f.expectedPageCount, f.storySourceHash, f.selectionFilename, f.frozenProductVersion, f.fulfillmentVersion, f.inputVersion, f.deliveryFenceVersion],
    payload: [f.customerEmail, f.customerName, f.childName, f.readUrl, f.pdfUrl, f.firstAudioUrl],
    cover: f.cover, pages: f.pages,
    // (#7-a) Quality evidence participates in the TOCTOU fingerprint: an evidence mutation between eval and
    // commit drifts this hash → the commit aborts + re-evaluates FRESH, so a stale quality verdict never ships.
    quality: f.quality,
    // (WS0b) The active visual-contract hash participates too: a re-freeze between eval and commit drifts this →
    // TOCTOU abort + re-eval against the new contract. null (no contract frozen — today) is a constant → no effect.
    contract: f.visualContractHash,
  })).digest('hex');
}

const COMMIT_SELECT = {
  id: true, fulfillmentVersion: true, inputVersion: true, deliveryFenceVersion: true, expectedPageCount: true, storySourceHash: true, selectionFilename: true, frozenProductVersion: true,
  customerEmail: true, customerName: true, childName: true, visualContractHash: true,
  book: { select: { coverImageUrl: true, readUrl: true, pdfUrl: true, pages: { orderBy: { pageNumber: 'asc' as const }, select: { pageNumber: true, text: true, audioUrl: true, imageAsset: { select: { url: true, presentationUrl: true } } } } } },
} as const;

/** Load the FRESH commit inputs from the DB (never recycle stale args). Works on the client or a tx client. */
async function loadCommitInputs(db: PrismaClient | Tx, orderId: string): Promise<LoadedInputs | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: COMMIT_SELECT });
  if (!o || !o.book) return null;
  const pages = o.book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null, text: p.text }));
  const firstAudioUrl = o.book.pages.find((p) => p.audioUrl?.trim())?.audioUrl ?? null;
  const order: OrderTruth = { id: o.id, fulfillmentVersion: o.fulfillmentVersion, inputVersion: o.inputVersion, deliveryFenceVersion: o.deliveryFenceVersion, expectedPageCount: o.expectedPageCount, storySourceHash: o.storySourceHash, selectionFilename: o.selectionFilename, frozenProductVersion: o.frozenProductVersion, customerEmail: o.customerEmail, customerName: o.customerName, childName: o.childName, visualContractHash: o.visualContractHash };
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
interface PayloadSource { customerEmail: string; customerName: string | null; childName: string; readUrl: string | null; pdfUrl: string | null; firstAudioUrl: string | null; coverImageUrl: string | null; orderId: string }
function buildPayload(p: PayloadSource, qaWarnings?: QaWarnings): BookReadyPayload {
  return {
    to: p.customerEmail,
    customerName: p.customerName ?? p.childName,
    childName: p.childName,
    readUrl: p.readUrl ?? '',
    // Secondary CTA (audio-only listen mode) + cover hero — derived from the same canonical readUrl/book the
    // commit already fingerprints, so the payloadHash stays self-consistent. Absent fields → graceful email.
    ...(listenUrlFromReadUrl(p.readUrl, p.orderId) ? { listenUrl: listenUrlFromReadUrl(p.readUrl, p.orderId) } : {}),
    ...(p.coverImageUrl ? { coverImageUrl: p.coverImageUrl } : {}),
    audioUrl: p.firstAudioUrl ?? undefined,
    pdfUrl: p.pdfUrl ?? undefined,
    ...(qaWarnings ? { qaWarnings } : {}),
  };
}
function payloadSourceOf(order: OrderTruth, book: BookData): PayloadSource {
  return { customerEmail: order.customerEmail, customerName: order.customerName, childName: order.childName, readUrl: book.readUrl, pdfUrl: book.pdfUrl, firstAudioUrl: book.firstAudioUrl, coverImageUrl: book.coverImageUrl, orderId: order.id };
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
  /** (Slice A) A deterministic contract-world drift OR a physical-safety hold is blocking → must HARD-hold; never
   *  QA_SOFT_DELIVER-eligible. */
  contractHardHold: boolean;
  /** (Fix 5) The kind of hard hold, driving a distinct top-level marker (`safety_hold:` vs `contract_world_hold:`). */
  hardHoldKind: HardHoldKind | null;
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
    // Integrity supersedes for a contract-world drift: a broken/missing asset runs its OWN recovery (retry), not a
    // world-QA park — so contract_world is NOT propagated here. (Fix 3) SAFETY is the exception: a physical-safety
    // hold survives the integrity path and STILL hard-holds (never downgraded to soft-deliverable), because a
    // known-unsafe image must never ship regardless of an unrelated integrity failure on another artifact.
    const safetyHold = quality.hardHoldKind === 'safety';
    return {
      status: 'blocked', reason: integrity.reason, inputsHash, evidence,
      blockExceptionKind: transient ? 'infra_transient' : 'integrity_blocked',
      blockClassification: transient ? 'validator_transient' : 'deterministic_block',
      contractHardHold: safetyHold,
      hardHoldKind: safetyHold ? 'safety' : null,
    };
  }
  if (quality.status === 'passed') {
    return { status: 'passed', reason: null, inputsHash, evidence, blockExceptionKind: null, blockClassification: 'passed', contractHardHold: quality.contractHardHold, hardHoldKind: quality.hardHoldKind };
  }
  if (quality.status === 'failed') {
    return { status: 'blocked', reason: quality.reason, inputsHash, evidence, blockExceptionKind: 'quality_failed', blockClassification: 'quality_failed', contractHardHold: quality.contractHardHold, hardHoldKind: quality.hardHoldKind };
  }
  return { status: 'blocked', reason: quality.reason, inputsHash, evidence, blockExceptionKind: 'infra_transient', blockClassification: 'quality_evidence_unknown', contractHardHold: quality.contractHardHold, hardHoldKind: quality.hardHoldKind };
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
// (Codex round-5 Unit 4) The ready-transition SHIP CAS now lives in the shared authority funnel (order-authority.ts)
// so the structural guard can require ALL authority-field writes to originate there. Imported above for internal use
// (runReadinessTxn) and re-exported here for existing importers (package-delivery, the PG harness, tests).
export { executeReadinessShipCas };

async function runReadinessTxn(tx: Tx, args: CommitArgs, loaded: LoadedInputs, decision: ReadinessDecision, now: Date, release?: ReleaseRuntime): Promise<CommitResult> {
  // (0) TOCTOU guard — the assets/text/frozen/QUALITY-EVIDENCE must not have changed between the (out-of-tx)
  // eval and now (the fingerprint folds in the quality evidence, so a re-QA between eval and commit drifts it). The
  // fingerprint is RAW (no projected override), so this still catches any genuine concurrent input change.
  const inTx = await loadCommitInputs(tx, args.orderId);
  if (!inTx || inTx.fingerprint !== loaded.fingerprint) throw new Error(TOCTOU);

  // (release-as-readiness-mode, 2a-2) The AUTHORITY. Re-check admissibility on RAW in-tx data and, only if it passes,
  // write both overrides + transition the marker + close the case + audit — all BEFORE the manifest/ship below, so a
  // ReleaseAdmissibilityError (or a lost transition CAS) rolls the WHOLE release back (nothing written, no audit).
  // The transition bumps the fence F → F+1; every downstream CAS binds the post-transition fence.
  let releaseApplied: ReleaseApplied | null = null;
  if (release) {
    // A release COMMITS only if it SHIPS. If the projected decision does not pass — the target is not a releasable
    // safety hold, or ANOTHER artifact still blocks — refuse and roll back; never a partial release (override/marker
    // moved while the book stays held). This is checked before applyReleaseInTx writes anything.
    if (decision.status !== 'passed') {
      throw new ReleaseAdmissibilityError('not_safety_hard_hold', `readiness would not pass: ${decision.reason ?? 'blocked'}`);
    }
    releaseApplied = await applyReleaseInTx(tx, release);
  }

  const { order, book } = loaded;
  const scope = BASE_BOOK_SCOPE;
  // (§5 fence threading) the release transition bumped the fence F → F+1, so the ship CAS + every Outbox enqueue MUST
  // bind the POST-transition fence, and the ship CAS must require the transitioned qa_released marker. No release →
  // the load-time fence + the (anchor) requireHold, byte-identical to today.
  const deliveryFenceVersion = releaseApplied ? releaseApplied.postFence : order.deliveryFenceVersion;
  const requireHoldReason = releaseApplied ? releaseApplied.releasedMarker : (args.requireHold?.deliveryHoldReason ?? null);
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
    const softDeliver = canUseQaSoftDeliver();
    const plan = resolveReadinessDeliveryPlan(args, decision, softDeliver);
    if (!plan.skipExceptionCase) {
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
    } else if (decision.contractHardHold) {
      // (Slice A) Parked for human QA — no NEW case is opened (skipExceptionCase), and any ACTIVE recoverable case
      // is RESOLVED so a stale infra_transient/integrity case can never redrive or refund a contract-world-held
      // book. (The soft-deliver blocked path also skips the case but is contractHardHold=false, so it is unaffected.)
      await resolveActiveRecoveryCaseInTx(tx, {
        orderId: order.id,
        scope,
        kinds: ['infra_transient', 'integrity_blocked'],
        reason: `contract_world_parked:${manifest.id}`,
        now,
      });
    }
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
  const softDeliver = canUseQaSoftDeliver();
  let qaWarnings: QaWarnings | undefined;
  const plan = resolveReadinessDeliveryPlan(args, decision, softDeliver);

  if (decision.status === 'passed' && activeException) {
    // A refund/reconciliation/customer action is already authoritative. Do not deliver-and-refund.
    orderStatus = 'failed';
    deliveryHoldReason = `exception_case:${activeException.kind}:${activeException.status}`;
  } else if (plan.usesSoftDeliver && decision.status === 'blocked') {
    qaWarnings = buildQaWarningsFromReadinessBlock({
      reason: decision.reason,
      evidence: decision.evidence,
    });
    if (args.anchorLowConfidence) {
      qaWarnings = mergeQaWarnings(qaWarnings, buildQaWarningsFromAnchorHold(args.anchorLowConfidence));
    }
    // Immutable manifest stays blocked for audit; mutable pointer passes for Outbox CAS send-time check.
    await tx.bookReadiness.updateMany({
      where: { orderId: order.id, scope, currentManifestId: manifest.id },
      data: { status: 'passed', reason: `qa_soft_deliver:${decision.reason ?? 'blocked'}` },
    });
    await enqueueDelivery(tx, {
      orderId: order.id,
      scope,
      fulfillmentVersion: order.fulfillmentVersion,
      manifestId: manifest.id,
      inputVersion: order.inputVersion,
      deliveryFenceVersion,
      payload: buildPayload(payloadSourceOf(order, book), qaWarnings),
      now,
    });
    enqueued = plan.enqueued;
    orderStatus = plan.orderStatus;
    deliveryHoldReason = plan.deliveryHoldReason;
  } else if (plan.enqueued && decision.status === 'passed' && args.anchorAllowsDelivery) {
    // (3) enqueue the delivery IN the same transaction (enqueue != send), then (4) mark the order ready.
    await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, manifestId: manifest.id, inputVersion: order.inputVersion, deliveryFenceVersion, payload: buildPayload(payloadSourceOf(order, book)), now });
    enqueued = true; orderStatus = 'ready'; deliveryHoldReason = null;
  } else if (plan.usesSoftDeliver && decision.status === 'passed' && !args.anchorAllowsDelivery) {
    qaWarnings = buildQaWarningsFromAnchorHold(args.anchorLowConfidence ?? null, args.anchorReason);
    await enqueueDelivery(tx, {
      orderId: order.id,
      scope,
      fulfillmentVersion: order.fulfillmentVersion,
      manifestId: manifest.id,
      inputVersion: order.inputVersion,
      deliveryFenceVersion,
      payload: buildPayload(payloadSourceOf(order, book), qaWarnings),
      now,
    });
    enqueued = plan.enqueued;
    orderStatus = plan.orderStatus;
    deliveryHoldReason = plan.deliveryHoldReason;
  } else {
    orderStatus = plan.orderStatus;
    deliveryHoldReason = plan.deliveryHoldReason;
  }

  // (4) Final Order write — SHARED DELIVERY FENCE (Codex round-4 P0). The write is polymorphic on the outcome:
  //   • SHIP (orderStatus === 'ready', incl. soft-deliver): a single atomic CAS that flips to `ready` ONLY IF the
  //     order still carries NO competing hold — the shared fence is unchanged since load, no payment fence, no
  //     terminal (safety_/contract_world_) marker, and no active strong Human-QA case. Any hold that landed at ANY
  //     point during this commit moved the fence (every hold write bumps it) → 0 rows → abort, never clobber+ship.
  //     Delivery authority is thus SHARED: no caller opts in; every hold write participates via the fence.
  //   • HOLD/FAIL (readiness parks): the standard inputVersion CAS, and it BUMPS the fence (a hold write).
  if (orderStatus === 'ready') {
    const shipped = await executeReadinessShipCas(tx, {
      orderId: order.id,
      inputVersion: order.inputVersion,
      deliveryFenceVersion,
      deliveryHoldReason,
      requireHoldReason,
    });
    if (shipped === 0) {
      // Distinguish a genuine inputVersion drift (→ retry FRESH) from a competing hold (→ NEVER retry into a ship).
      const cur = await tx.order.findUnique({
        where: { id: order.id },
        select: { inputVersion: true, deliveryFenceVersion: true, status: true, deliveryHoldReason: true, manualReviewRequired: true },
      });
      if (cur && cur.inputVersion !== order.inputVersion) throw new Error(TOCTOU); // inputs changed → reload + re-eval
      const actual = cur
        ? { status: cur.status, deliveryHoldReason: cur.deliveryHoldReason, manualReviewRequired: cur.manualReviewRequired, deliveryFenceVersion: cur.deliveryFenceVersion }
        : null;
      // A competing hold blocked the ship. requireHold (anchor admin) OR a release (2a-2) → typed 409, and for a
      // release the whole tx (override + transition + case + audit) rolls back with it; normal path → held (below).
      if (args.requireHold || releaseApplied) {
        throw new ReleasePreconditionError(requireHoldReason ?? '', actual);
      }
      throw new DeliveryFenceError(order.id, actual);
    }
  } else {
    // (Codex round-5 P0-1) HOLD / FAIL outcome — readiness itself parks. This must BIND the fence + BUMP it + refuse
    // to OVERWRITE a stronger marker (a safety park may have landed after readiness read a clean order; readiness's
    // weaker anchor/integrity marker must NEVER clobber it — that clobber is what let a later ship see no terminal
    // marker and ship). `writeOrderHoldFenced` enforces bind+bump+precedence; the deliveryHoldReason CANNOT be null
    // on a hold outcome (orderStatus !== 'ready').
    const held = await writeOrderHoldFenced(tx, {
      orderId: order.id,
      inputVersion: order.inputVersion,
      newStatus: orderStatus,
      newHoldReason: deliveryHoldReason ?? `${orderStatus}:unspecified`,
      setPackageDone: true,
    });
    if (held === 'input_drift') throw new Error(TOCTOU); // inputs changed → reload FRESH + re-evaluate
    if (held === 'superseded') {
      // A STRONGER hold is already present — do NOT overwrite it. Roll back this readiness tx and surface a HELD
      // result (the stronger hold stands; the case sync then always sees the strongest marker). Never a ship.
      throw new DeliveryFenceError(order.id, null);
    }
    if (held === 'lost') throw new Error(TOCTOU); // order vanished / fence churned past the retry budget → re-eval
  }
  // (Human-QA Slice 1, re-gate P0-1) The review-case lifecycle is NOT written here. A `recordHumanQaHoldInTx`
  // read/update/throw inside THIS readiness-commit tx could roll back the hold itself (an unheld order = a safety
  // regression), and `resolveHumanQaCaseOnReleaseInTx` inside it could roll back a delivery. Both are reconciled
  // POST-COMMIT by `syncHumanQaHoldCasePostCommit` at every consumer of commitBaseBookReadiness (which re-reads the
  // committed Order status: opens the case for a terminal marker hold, resolves an anchor case on a ready outcome).
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
    // (WS0b) Thread the Order's active contract so a QualityEvidence row bound to a superseded contract is re-QA'd
    // (contract_stale → evidence_unknown). null (no contract frozen) → isQualityEvidenceContractStale(null,null) is
    // false → byte-identical to today. This is the ONLY caller that threads activeContractHash.
    // (release-as-readiness-mode, 2a-2) PROJECTION: apply the operator's override to a COPY of exactly one quality row
    // so Gate 1 evaluates the intended release. `loaded.quality` (and thus the raw TOCTOU fingerprint) is untouched.
    // This projection is NOT the authority — applyReleaseInTx re-checks admissibility on RAW data inside the tx.
    const releaseRuntime: ReleaseRuntime | undefined = args.release
      ? {
          orderId: args.orderId,
          request: args.release,
          currentHash: currentArtifactHashes(result).get(args.release.artifactKey) ?? null,
          observedFence: loaded.order.deliveryFenceVersion,
          observedInputVersion: loaded.order.inputVersion,
          activeContractHash: loaded.order.visualContractHash,
        }
      : undefined;
    const projectedQuality = args.release ? projectReleaseOntoQuality(loaded.quality, args.release) : loaded.quality;
    const quality = evaluateQualityGate(requiredKeys, projectedQuality, currentArtifactHashes(result), {
      activeContractHash: loaded.order.visualContractHash,
    });
    const decision = decideReadiness(result, quality);
    try {
      // (Codex B′) Receipt-fence the commit tx (flag-on). operationKey = order + scope + the inputVersion this
      // attempt evaluated + the combined integrity+quality inputsHash + the anchor disposition. A TOCTOU/revision
      // retry reloads FRESH → different inputVersion/inputsHash → a NEW key (correct: genuinely different inputs);
      // an ambiguous commit (P2028 after the tx committed) replays the recorded CommitResult → EXACTLY ONE
      // Manifest + ONE Outbox binding, never a duplicate. The receipt commits atomically with the manifest/outbox.
      // (release-as-readiness-mode, 2a-2) A release DELIBERATELY bypasses the readiness receipt: its idempotency is the
      // marker CAS (a replay finds the marker at qa_released → refused), NOT a receipt keyed on the load-time fence
      // (which the transition bumps → a replay would mint a different key anyway). Bypassing means a concurrent
      // duplicate re-runs the CAS and is refused, never replayed-as-success (decision §2/§3). Every OTHER commit keeps
      // the receipt fence unchanged.
      if (isReadinessManifestEnabled() && !args.release) {
        const softDeliver = canUseQaSoftDeliver();
        const receipt = buildReadinessCommitReceiptBinding(
          args,
          loaded.order.inputVersion,
          decision,
          softDeliver,
          loaded.order.deliveryFenceVersion, // (round-5 P1) load-time fence → receipt identity (see the binding)
        );
        return await runAtomicOperation(
          prisma,
          {
            operationKey: receipt.operationKey,
            orderId: args.orderId,
            kind: 'readiness_commit',
            payloadHash: receipt.payloadHash,
            run: (tx) => runReadinessTxn(tx, args, loaded, decision, now, releaseRuntime),
          },
          deps.atomic,
        );
      }
      // (release-as-readiness-mode) The release mode does more work in-tx (admissibility reads + both overrides +
      // transition + case close + audit + ship). A co-located prod DB commits it in well under a second; the wider
      // timeout guards the pathological / high-latency case without affecting the (receipt-fenced) normal path.
      return await prisma.$transaction((tx) => runReadinessTxn(tx, args, loaded, decision, now, releaseRuntime), args.release ? { timeout: 20_000, maxWait: 10_000 } : undefined);
    } catch (e) {
      if ((isToctou(e) || isRevisionCollision(e)) && attempt < 5) {
        log.warn('Readiness commit retry', { orderId: args.orderId, attempt, reason: isToctou(e) ? 'toctou_drift' : 'revision_collision' });
        continue; // reload FRESH + re-evaluate
      }
      // (delivery fence — Codex round-4 P0) A competing hold blocked the SHIP on a NORMAL commit; the tx rolled back
      // (no `ready`, no Outbox row). Do NOT retry into a ship — return a HELD, not-shipped CommitResult. The order
      // stays held by whatever landed; the reconciler/recovery owns it. (A requireHold admin call is NOT caught here
      // — it surfaces ReleasePreconditionError to the anchor-release route, which maps it to a 409.)
      if (isDeliveryFenceBlocked(e)) {
        const held = e.actual;
        log.warn('Readiness ship aborted — competing hold landed (delivery fence)', {
          orderId: args.orderId,
          fenceObserved: loaded.order.deliveryFenceVersion,
          actual: held,
        });
        return {
          manifestStatus: 'blocked',
          enqueued: false,
          orderStatus: held?.status ?? 'needs_human_qa',
          reason: held?.deliveryHoldReason ?? 'delivery_fence_blocked',
          revision: 0,
        };
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
         -- (delivery fence — Codex round-5 P1) The order must STILL be ready at the exact inputVersion AND the exact
         -- deliveryFenceVersion this delivery was enqueued under — the Outbox->fence link is now EXPLICIT here, not
         -- merely incidental to the enqueue+ready flip sharing a transaction.
         SELECT 1 FROM "Order" ord
          WHERE ord."id" = o."orderId" AND ord."status" = 'ready'
            AND ord."inputVersion" = o."inputVersion"
            AND ord."deliveryFenceVersion" = o."deliveryFenceVersion"
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
