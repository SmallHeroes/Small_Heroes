import 'server-only';

import type { Prisma } from '@prisma/client';

import {
  loadQualityEvidence,
  resolveArtifactHoldOutcome,
  pageNumberFromArtifactKey,
  coverArtifactKey,
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  type QualityEvidenceRow,
} from './quality-evidence';
import { SAFETY_SHA256_RE, isSafetyShaMissing } from './asset-safety-signal';
import { writeSafetyReleaseOverride } from './asset-safety-writer';
import { executeSafetyFalsePositiveReleaseTransition, qaReleasedSafetyMarker } from './order-authority';
import { resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { hashOperationPayload } from './atomic-operation';

/**
 * (release-as-readiness-mode, 2a-2) The operator FALSE-POSITIVE safety release, as a MODE of commitBaseBookReadiness.
 *
 * PROJECTION vs AUTHORITY (Codex's headline ruling): out of the readiness tx, the release is applied to a COPY of the
 * quality rows only so Gate 1 can evaluate the intended pass (`projectReleaseOntoQuality`) — that is a projection. The
 * AUTHORITY is `assertReleaseAdmissible` re-run inside the tx on RAW data (`applyReleaseInTx`): if the raw in-tx state
 * no longer satisfies every admissibility rule, it throws BEFORE any write and the whole release rolls back — the
 * marker, case, override, audit and outbox never happen. A decision whose premise failed can never commit.
 *
 * IDEMPOTENCY is the marker CAS, not a receipt: after a release the marker reads `qa_released:safety:…`, so a replay
 * fails `marker_not_safety_hazard` / `marker_changed` (and the transition CAS matches 0 rows anyway). A replay is
 * REFUSED with its reason — never replayed as a silent success. The audit row is written ONLY on success, in-tx, so
 * "an audit row exists" always means "a release happened".
 */

export interface SafetyReleaseRequest {
  /** 'cover' | 'page:<n>' — exactly one artifact. */
  artifactKey: string;
  /** The Order.deliveryHoldReason the operator acted on — must begin `safety_hold:hazard:`. */
  expectedMarker: string;
  /** The hazards the operator explicitly overrode — the asset's found hazards must be a subset. */
  overriddenHazards: string[];
  /** The operator's submitted delivered-bytes SHA — must equal the current bytes AND the asset's bound SHA. */
  assetSha256: string;
  /** Mandatory written reason for the false-positive call. */
  overrideReason: string;
  actor: string;
  note?: string | null;
}

export type ReleaseRefusalRule =
  | 'marker_not_safety_hazard' // expectedMarker does not begin safety_hold:hazard: (never `unverified:` — cannot override ignorance)
  | 'marker_changed'           // the current Order marker != expectedMarker (a re-hold moved it / already released)
  | 'payment_fence_active'     // manualReviewRequired OR an open payment_integrity case blocks any delivery action
  | 'no_active_safety_case'    // no OPEN safety review case to resolve
  | 'sha_missing'              // the asset carries no content SHA — the bytes cannot be identified
  | 'asset_hash_mismatch'      // operator hash != current delivered bytes != the asset's bound content SHA
  | 'evidence_stale'           // the QualityEvidence is stale version / hash-mismatched / superseded-contract
  | 'not_safety_hard_hold'     // the SHARED outcome is not a determinate safety hard-hold (passed / contract_world / released)
  | 'hazards_not_subset';      // a found hazard on the asset is not in the operator's overridden set

/** Thrown when a release is inadmissible. Inside the readiness tx the throw rolls everything back → 409, nothing written. */
export class ReleaseAdmissibilityError extends Error {
  readonly code = 'release_admissibility';
  constructor(public readonly rule: ReleaseRefusalRule, detail?: string) {
    super(`[safety-release] refused: ${rule}${detail ? ` — ${detail}` : ''}`);
    this.name = 'ReleaseAdmissibilityError';
  }
}

export interface ReleaseAdmissibilityInputs {
  request: SafetyReleaseRequest;
  /** Order.deliveryHoldReason, read raw (in-tx = authority; out-of-tx = fast-fail projection). */
  currentMarker: string | null;
  /** Delivered-bytes hash for the target artifact — the integrity inspect (threaded; never re-inspected in-tx). */
  currentHash: string | null;
  /** The raw QualityEvidence row for the artifact. */
  targetRow: QualityEvidenceRow;
  /** ImageAsset.safetyHazards / GeneratedBook.coverSafetyHazards — the detector's confirmed hazards. */
  assetHazards: string[];
  /** ImageAsset.safetyContentSha256 / cover twin — the asset's bound delivered-bytes SHA. */
  assetContentSha256: string | null;
  /** True iff an OPEN safety review case exists (must be closed atomically with the release). */
  hasOpenSafetyCase: boolean;
  /** Order.manualReviewRequired OR an open payment_integrity case — any active payment fence blocks the release. */
  hasPaymentFence: boolean;
  contractVersion: string;
  activeContractHash: string | null;
}

/**
 * PURE. Every §3 rule, most-specific-refusal-first, so the operator sees WHICH rule refused. Returns the SHA the
 * override binds to (== the current bytes). Never mutates. Used BOTH out-of-tx (fast-fail) and in-tx (authority).
 */
export function assertReleaseAdmissible(a: ReleaseAdmissibilityInputs): { overrideSha256: string } {
  const r = a.request;
  if (!r.expectedMarker.startsWith('safety_hold:hazard:')) throw new ReleaseAdmissibilityError('marker_not_safety_hazard');
  if ((a.currentMarker ?? '') !== r.expectedMarker) throw new ReleaseAdmissibilityError('marker_changed');
  if (a.hasPaymentFence) throw new ReleaseAdmissibilityError('payment_fence_active');
  if (!a.hasOpenSafetyCase) throw new ReleaseAdmissibilityError('no_active_safety_case');
  // Cannot bind an override to bytes we cannot identify — checked before the hash equality.
  if (isSafetyShaMissing({ hazards: a.assetHazards, contentSha256: a.assetContentSha256 })) throw new ReleaseAdmissibilityError('sha_missing');
  // operator hash == current delivered bytes == the asset's bound content SHA (all three agree, well-formed).
  if (!SAFETY_SHA256_RE.test(r.assetSha256) || r.assetSha256 !== a.currentHash || a.assetContentSha256 !== a.currentHash) {
    throw new ReleaseAdmissibilityError('asset_hash_mismatch');
  }
  // The QualityEvidence must be a CURRENT-bytes determinate SAFETY hard-hold — decided by the SHARED outcome, never
  // re-derived from the reason string. `admissible` rejects stale version / hash mismatch / superseded contract.
  const outcome = resolveArtifactHoldOutcome(a.targetRow, a.currentHash, { contractVersion: a.contractVersion, activeContractHash: a.activeContractHash });
  if (!outcome.admissible) throw new ReleaseAdmissibilityError('evidence_stale');
  if (!outcome.hardHold || outcome.kind !== 'safety') throw new ReleaseAdmissibilityError('not_safety_hard_hold');
  // Every found hazard on the asset must be explicitly overridden (a hazard outside the set refuses).
  if (!a.assetHazards.every((h) => r.overriddenHazards.includes(h))) throw new ReleaseAdmissibilityError('hazards_not_subset');
  return { overrideSha256: r.assetSha256 };
}

/**
 * The PROJECTION: return a COPY of the quality rows with EXACTLY ONE row (the target) carrying the intended override,
 * so Gate 1 evaluates the release. Non-mutating; every other row is untouched; the raw array is never changed (so the
 * TOCTOU fingerprint, computed from the raw rows, stays raw).
 */
export function projectReleaseOntoQuality(
  quality: QualityEvidenceRow[],
  release: SafetyReleaseRequest,
): QualityEvidenceRow[] {
  return quality.map((row) =>
    row.artifactKey === release.artifactKey
      ? { ...row, safetyOverride: true, safetyOverrideSha256: release.assetSha256 }
      : row,
  );
}

/** Classify the artifactKey to its Gate-2 write target. Throws on a malformed key (the endpoint validates the shape first). */
export function releaseTargetOf(artifactKey: string): { kind: 'cover' } | { kind: 'page'; pageNumber: number } {
  if (artifactKey === coverArtifactKey()) return { kind: 'cover' };
  const pageNumber = pageNumberFromArtifactKey(artifactKey);
  if (pageNumber == null) throw new ReleaseAdmissibilityError('not_safety_hard_hold', `malformed artifactKey: ${artifactKey}`);
  return { kind: 'page', pageNumber };
}

async function loadTargetAssetSafety(
  tx: Prisma.TransactionClient,
  orderId: string,
  target: { kind: 'cover' } | { kind: 'page'; pageNumber: number },
): Promise<{ assetHazards: string[]; assetContentSha256: string | null; pageId: string | null }> {
  if (target.kind === 'cover') {
    const b = await tx.generatedBook.findUnique({ where: { orderId }, select: { coverSafetyHazards: true, coverSafetyContentSha256: true } });
    return { assetHazards: b?.coverSafetyHazards ?? [], assetContentSha256: b?.coverSafetyContentSha256 ?? null, pageId: null };
  }
  const page = await tx.bookPage.findFirst({
    where: { book: { orderId }, pageNumber: target.pageNumber },
    select: { id: true, imageAsset: { select: { safetyHazards: true, safetyContentSha256: true } } },
  });
  return { assetHazards: page?.imageAsset?.safetyHazards ?? [], assetContentSha256: page?.imageAsset?.safetyContentSha256 ?? null, pageId: page?.id ?? null };
}

export interface ReleaseRuntime {
  orderId: string;
  request: SafetyReleaseRequest;
  /** The delivered-bytes hash for the target artifact — from the out-of-tx integrity inspect (never re-inspected in-tx). */
  currentHash: string | null;
  /** Order.deliveryFenceVersion observed at load — the transition CAS binds it; the ship binds observedFence + 1. */
  observedFence: number;
  observedInputVersion: number;
  activeContractHash: string | null;
}

export interface ReleaseApplied {
  releasedMarker: string;
  /** The POST-transition fence — every downstream CAS (ship, enqueue) MUST bind this, not the pre-transition fence. */
  postFence: number;
}

/**
 * THE in-tx authority + effect. Runs inside runReadinessTxn AFTER the raw TOCTOU guard and BEFORE the manifest/ship.
 * Re-reads RAW target evidence + asset + Order marker/case INSIDE the tx, re-checks admissibility (authority) — any
 * failure throws and the tx rolls back — then writes both gate overrides, transitions the marker + closes the safety
 * case (same tx: no split state), and records the release-only audit row. Returns the post-transition fence.
 */
export async function applyReleaseInTx(tx: Prisma.TransactionClient, rt: ReleaseRuntime): Promise<ReleaseApplied> {
  const r = rt.request;
  const target = releaseTargetOf(r.artifactKey);

  // (authority) RAW in-tx reads: Order marker + payment fence + the target evidence row + asset safety + the case.
  const order = await tx.order.findUnique({ where: { id: rt.orderId }, select: { deliveryHoldReason: true, manualReviewRequired: true } });
  const targetRow = (await loadQualityEvidence(tx, rt.orderId)).find((row) => row.artifactKey === r.artifactKey);
  if (!targetRow) throw new ReleaseAdmissibilityError('not_safety_hard_hold', 'no evidence row for the target artifact');
  const asset = await loadTargetAssetSafety(tx, rt.orderId, target);
  const activeCase = await tx.humanQaReviewCase.findUnique({
    where: { activeKey: `${rt.orderId}:base_book` },
    select: { id: true, revision: true, kind: true, status: true },
  });
  const hasOpenSafetyCase = !!activeCase && activeCase.status === 'open' && activeCase.kind === 'safety';
  const paymentCase = await tx.humanQaReviewCase.findUnique({ where: { activeKey: `${rt.orderId}:payment` }, select: { status: true } });
  const hasPaymentFence = order?.manualReviewRequired === true || paymentCase?.status === 'open';

  const { overrideSha256 } = assertReleaseAdmissible({
    request: r,
    currentMarker: order?.deliveryHoldReason ?? null,
    currentHash: rt.currentHash,
    targetRow,
    assetHazards: asset.assetHazards,
    assetContentSha256: asset.assetContentSha256,
    hasOpenSafetyCase,
    hasPaymentFence,
    contractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    activeContractHash: rt.activeContractHash,
  });
  if (target.kind === 'page' && !asset.pageId) throw new ReleaseAdmissibilityError('not_safety_hard_hold', 'no rendered page asset');

  // (effect — only after admissibility passed on RAW data)
  // 1. Both gate overrides (Gate 1 QualityEvidence + Gate 2 ImageAsset/GeneratedBook), via the sanctioned writer.
  await writeSafetyReleaseOverride(tx, {
    orderId: rt.orderId,
    artifactKey: r.artifactKey,
    target: target.kind === 'cover' ? { kind: 'cover' } : { kind: 'page', pageId: asset.pageId! },
    overriddenHazards: r.overriddenHazards,
    overrideSha256,
  });

  // 2. The marker transition safety_hold:hazard: → qa_released:safety: — CAS on the exact marker + observed fence,
  //    bumps the fence. 0 rows = the marker moved / fence bumped under the lock → refuse (the CAS is the idempotency).
  const releasedMarker = qaReleasedSafetyMarker(r.expectedMarker);
  const moved = await executeSafetyFalsePositiveReleaseTransition(tx, {
    orderId: rt.orderId, expectedMarker: r.expectedMarker, observedFence: rt.observedFence, releasedMarker,
  });
  if (moved !== 1) throw new ReleaseAdmissibilityError('marker_changed', 'release transition CAS matched no row');

  // 3. Close the OPEN safety case in the SAME tx (ship CAS keys off both marker AND case → no split state).
  await resolveHumanQaCaseOnReleaseInTx(tx, { orderId: rt.orderId, scope: 'base_book', kinds: ['safety'], actor: r.actor, note: r.overrideReason });

  // 4. Release-only audit — the operator's OWN identity, in-tx. The marker CAS is the idempotency, so idempotencyKey
  //    is only this row's natural identity (order + released bytes), NOT a second dedup fence.
  await tx.humanQaOperatorAction.create({
    data: {
      idempotencyKey: `operator_action:release:${rt.orderId}:${overrideSha256}`,
      requestHash: hashOperationPayload({
        kind: 'release', artifactKey: r.artifactKey, marker: r.expectedMarker,
        overriddenHazards: [...r.overriddenHazards].sort(), overrideReason: r.overrideReason, assetSha256: r.assetSha256,
      }),
      orderId: rt.orderId,
      caseId: activeCase!.id,
      caseRevision: activeCase!.revision,
      kind: 'release',
      status: 'succeeded',
      actor: r.actor,
      note: r.note ?? null,
      targetArtifacts: [r.artifactKey],
      observedMarker: r.expectedMarker,
      observedFence: rt.observedFence,
      observedInputVersion: rt.observedInputVersion,
      overriddenHazards: r.overriddenHazards,
      overrideReason: r.overrideReason,
      assetSha256: overrideSha256,
      outcome: { released: true, artifactKey: r.artifactKey, releasedMarker },
    },
  });

  return { releasedMarker, postFence: rt.observedFence + 1 };
}
