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
import {
  evaluateSafetyDeliveryGate,
  loadSafetyGateInputs,
  projectSafetyOverrideOntoGateInputs,
} from './safety-delivery-gate';
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
  | 'hazards_not_subset'       // a found hazard on the asset is not in the operator's overridden set
  | 'gate2_still_held';        // (re-gate P1) Gate 2 (the marker's producer) still holds AFTER this override — another
                               // artifact (a second page, the cover, a Gate-2-only hazard) blocks. The marker may only
                               // move when the gate that PRODUCES it agrees; releasing one artifact never clears it.

/** Thrown when a release is inadmissible. Inside the readiness tx the throw rolls everything back → 409, nothing written. */
export class ReleaseAdmissibilityError extends Error {
  readonly code = 'release_admissibility';
  constructor(public readonly rule: ReleaseRefusalRule, detail?: string) {
    super(`[safety-release] refused: ${rule}${detail ? ` — ${detail}` : ''}`);
    this.name = 'ReleaseAdmissibilityError';
  }
}

/**
 * (re-gate P2) Thrown when THIS exact release already committed — recognised from durable state (the target asset's
 * override bound to these bytes AND a succeeded release audit row for this order+artifact+bytes), NOT from the marker
 * (which is cleared to null after a successful ship). It is a SUCCESS, not a refusal: the endpoint maps it to an
 * idempotent "already released" 200. Thrown inside the tx, so the replay writes nothing (the first release stands).
 */
export class ReleaseAlreadyCommittedError extends Error {
  readonly code = 'release_already_committed';
  constructor(public readonly artifactKey: string) {
    super(`[safety-release] already released: ${artifactKey}`);
    this.name = 'ReleaseAlreadyCommittedError';
  }
}

/**
 * (re-gate P2/§4) The release audit idempotency key. Includes `artifactKey` so two artifacts in the SAME order with
 * identical delivered bytes produce DISTINCT keys (both are legitimately releasable), and `caseId` so two release
 * CYCLES for the same artifact+bytes are DISTINCT too: a re-render that restores byte-identical bytes re-holds under a
 * NEW safety case (the prior case's activeKey was freed on resolve), and that legitimate re-release must not collide on
 * the prior cycle's audit row (which would misfire the manifest-revision retry → a 500). `caseId` is a fresh id minted
 * per hold cycle (a re-hold creates a new case row), so it is unconditionally unique per cycle. The marker CAS remains
 * the concurrency fence; this key is only the audit row's natural id + a backstop unique constraint. (The §3 replay
 * detector keys on override+audit fields, not this string.)
 */
export function releaseAuditIdempotencyKey(orderId: string, caseId: string, artifactKey: string, overrideSha256: string): string {
  return `operator_action:release:${orderId}:${caseId}:${artifactKey}:${overrideSha256}`;
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
): Promise<{ assetHazards: string[]; assetContentSha256: string | null; assetOverrideSha256: string | null; pageId: string | null }> {
  if (target.kind === 'cover') {
    const b = await tx.generatedBook.findUnique({ where: { orderId }, select: { coverSafetyHazards: true, coverSafetyContentSha256: true, coverSafetyOverrideSha256: true } });
    return { assetHazards: b?.coverSafetyHazards ?? [], assetContentSha256: b?.coverSafetyContentSha256 ?? null, assetOverrideSha256: b?.coverSafetyOverrideSha256 ?? null, pageId: null };
  }
  const page = await tx.bookPage.findFirst({
    where: { book: { orderId }, pageNumber: target.pageNumber },
    select: { id: true, imageAsset: { select: { safetyHazards: true, safetyContentSha256: true, safetyOverrideSha256: true } } },
  });
  return { assetHazards: page?.imageAsset?.safetyHazards ?? [], assetContentSha256: page?.imageAsset?.safetyContentSha256 ?? null, assetOverrideSha256: page?.imageAsset?.safetyOverrideSha256 ?? null, pageId: page?.id ?? null };
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

  // (re-gate P2) REPLAY of a committed release. After a successful ship the marker is cleared to null, so a replay can
  // no longer be recognised by the marker — assertReleaseAdmissible would surface a generic marker_changed. Recognise
  // committed success from DURABLE state that survives the marker clear: the target asset's override bound to THESE
  // exact bytes AND a succeeded release audit row for this order+artifact+bytes (both written in the release tx). If
  // both are present this exact release already committed → idempotent "already released", never a refusal.
  if (asset.assetOverrideSha256 != null && asset.assetOverrideSha256 === r.assetSha256) {
    const priorRelease = await tx.humanQaOperatorAction.findFirst({
      where: { orderId: rt.orderId, kind: 'release', status: 'succeeded', assetSha256: r.assetSha256, targetArtifacts: { has: r.artifactKey } },
      select: { id: true },
    });
    if (priorRelease) throw new ReleaseAlreadyCommittedError(r.artifactKey);
  }

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

  // (re-gate P1) The marker is GATE 2's output — an aggregate over EVERY cover+page hazard — but the ship guard only
  // proved the projected GATE 1 decision. Prove GATE 2 ITSELF clears BEFORE moving its marker: recompute the REAL gate
  // (evaluateSafetyDeliveryGate — the same evaluator production uses, no second implementation) over the whole book
  // with THIS override applied IN PROJECTION (in-memory, before any write). If any OTHER artifact still holds — a
  // second hazardous page, the cover, a hazard visible to Gate 2 but not to the projected Gate 1 — refuse and roll
  // back; a release clears exactly one artifact, never the whole book on Gate 1's say-so. DB read only → safe in-tx.
  const projectedGate2 = evaluateSafetyDeliveryGate(
    projectSafetyOverrideOntoGateInputs(
      await loadSafetyGateInputs(tx, rt.orderId),
      target,
      { overriddenHazards: r.overriddenHazards, overrideSha256 },
    ),
  );
  if (projectedGate2.held) throw new ReleaseAdmissibilityError('gate2_still_held', projectedGate2.reason ?? undefined);

  // (effect — only after admissibility passed on RAW data AND Gate 2 clears under the projected override)
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

  // 4. Release-only audit — the operator's OWN identity, in-tx. The marker CAS is the idempotency fence; this key is
  //    only the row's natural identity (order + ARTIFACT + released bytes — §4: two same-order artifacts with identical
  //    bytes get distinct keys, so a legitimate second release never collides on the unique constraint).
  await tx.humanQaOperatorAction.create({
    data: {
      idempotencyKey: releaseAuditIdempotencyKey(rt.orderId, activeCase!.id, r.artifactKey, overrideSha256),
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
