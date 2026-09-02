/**
 * #7-a Quality gate fail-closed — the durable per-artifact visual-QA evidence layer.
 *
 * One QualityEvidence row per REQUIRED delivered artifact (cover + every page). The render/persist seam
 * writes the verdict + a SHA-256 of the EXACT delivered bytes (presentationUrl ?? url); the readiness commit
 * reads them FAIL-CLOSED via `evaluateQualityGate`. There is NO "assume passed" default and NO production
 * escape hatch: missing / stale / hash-mismatched / non-`passed` evidence BLOCKS delivery.
 *
 * `evaluateQualityGate` is PURE (no DB, no clock, no env) so the anti-bypass matrix is unit-testable; the DB
 * helpers take an injected client/tx.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { isQualityEvidenceContractStale } from './quality-check-result';
import { SAFETY_SHA256_RE } from './asset-safety-signal';
import { QUALITY_REGEN_BUDGET } from './quality-regen-policy';
import { canonicalHash } from '@/lib/canonical-json';
import {
  HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
  humanVerifiedUnverifiedResemblanceProofDigest,
  humanVerifiedUnverifiedQualityAuthorityDigest,
  parseHumanVerifiedUnverifiedAtomicReceiptResult,
  parseHumanVerifiedUnverifiedOutcome,
  parseHumanVerifiedUnverifiedResemblanceProofs,
  parseHumanVerifiedUnverifiedReviewReason,
  type HumanVerifiedUnverifiedResemblanceProof,
} from './human-verified-unverified-contract';
import {
  deliveredUrlHash,
  hasDisqualifyingRefundOrReconciliationActivity,
  hasStrictHumanVerificationPaymentAuthority,
  paymentSnapshotDigest,
  refundAuthorityDigest,
} from './human-verified-unverified-authority';
import { getApprovedChildCanonicalAnchor } from './character-anchor-store';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from './page-child-resemblance-vision';
import type { PipelineCache } from './types';

export { QUALITY_REGEN_BUDGET } from './quality-regen-policy';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Bump when the evaluator's semantics change. Evidence carrying an older version is treated as stale (→ BLOCK,
 * re-evaluate) so a semantics change can never deliver on evidence produced by the previous evaluator.
 *
 * qa-v2 (Slice A): the delivered-verdict evaluator now folds in contract WORLD QA (wrong_zone / recurring-object
 * identity / forbidden_scene) on steered pages. Bumping invalidates any prior `passed` row produced WITHOUT world
 * QA — most importantly a pre-change steered+passed row — so it is re-QA'd under the world-QA-aware rule (recovery
 * reconstructs the page's worldExpectation) rather than delivered on stale, un-world-QA'd evidence.
 *
 * qa-v3 (Stage 1 — universal safety): the per-page visual QA now carries a UNIVERSAL physical-safety gate (child on
 * a railing / unsupported at height / dangerous proximity) folded into the durable verdict as a `safety:` reason,
 * classified as a non-soft-deliver HARD HOLD. Bumping invalidates any prior `passed` row produced WITHOUT the safety
 * gate so every artifact is re-QA'd under the safety-aware rule rather than delivered on stale, un-safety-QA'd evidence.
 */
export const QUALITY_EVALUATOR_CONTRACT_VERSION = 'qa-v3';

export const QUALITY_SCOPE = 'base_book';

export type QualityVerdict = 'passed' | 'failed' | 'evidence_unknown';

/**
 * (Stage 1 FIX / Fix 5) The KIND of hard hold, so downstream can emit a distinct, accurate top-level marker
 * (`safety_hold:` vs `contract_world_hold:`) and park each correctly. `safety` is the universal child-safety
 * invariant (a hazard OR an unconfirmed-safe image); it takes PRECEDENCE over a `contract_world` drift.
 */
export type HardHoldKind = 'safety' | 'contract_world';

export function coverArtifactKey(): string {
  return 'cover';
}
export function pageArtifactKey(pageNumber: number): string {
  return `page:${pageNumber}`;
}
/** Parse a page artifact key back to its page number (null for the cover or a malformed key). */
export function pageNumberFromArtifactKey(artifactKey: string): number | null {
  const m = /^page:(\d+)$/.exec(artifactKey);
  return m ? Number(m[1]) : null;
}

/** The full required artifact set for a book: cover + page:1..expectedPageCount. */
export function requiredArtifactKeys(expectedPageCount: number): string[] {
  const keys = [coverArtifactKey()];
  for (let n = 1; n <= expectedPageCount; n++) keys.push(pageArtifactKey(n));
  return keys;
}

/** A persisted evidence row, projected to the fields the gate reads. */
export interface QualityEvidenceRow {
  id?: string;
  artifactKey: string;
  assetSha256: string;
  verdict: string; // stored free-text (CHECK-constrained); an unrecognized value is inadmissible → BLOCK
  evaluatorContractVersion: string;
  reason: string | null;
  regenCount: number;
  providerModel?: string | null;
  /** (WS0b) The contract this row was produced against; a mismatch vs the Order's active contract → stale. */
  contractHash: string | null;
  /**
   * (release c-ii) The Gate-1 false-positive override + the delivered-bytes SHA it binds to. Read by the Gate-1
   * override branch (evaluateQualityGate) and — critically — folded into qualityEvidenceFingerprint so that CLEARING
   * an override (persistQualityEvidence on fresh evidence, P1b) DRIFTS the readiness TOCTOU fingerprint. Without that,
   * a manifest computed while an override stood could commit AFTER the override was cleared → ship an un-QA'd image.
   */
  safetyOverride: boolean;
  safetyOverrideSha256: string | null;
  evidence?: Prisma.JsonValue | null;
  evaluatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  reviewStatus?: string | null;
  reviewedAssetSha256?: string | null;
  reviewedContractHash?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewReason?: string | null;
  /** Derived only by loadQualityEvidence after validating the succeeded immutable action. */
  humanReviewVerified?: boolean;
  humanReviewActionDigest?: string | null;
}

/** Current delivered-bytes hash per artifact, from the integrity gate's `inspect` (the source of truth). */
export type ArtifactHashes = Map<string, string | null>;

export type QualityGateStatus = 'passed' | 'failed' | 'evidence_unknown';

export interface QualityGateResult {
  status: QualityGateStatus;
  /** null only when passed. */
  reason: string | null;
  /** Artifacts with a deterministic, budget-exhausted `failed` verdict on the CURRENT bytes (→ terminal refund). */
  failedArtifacts: string[];
  /** Artifacts that are missing / stale / hash-mismatched / unknown / failed-with-budget-remaining (→ recovery). */
  unknownArtifacts: string[];
  /**
   * (Slice A) True when any blocking artifact FAILED on a deterministic drift that must HARD-hold for human QA and
   * can NEVER be QA_SOFT_DELIVER-downgraded to `ready`+qaWarnings (readiness gates its soft-deliver branch on
   * `!contractHardHold`). Two reason classes set it:
   *   - `contract_world:` — a contract-world drift (wrong_zone / recurring-object identity redesign / forbidden_scene).
   *   - `safety:`         — (Stage 1) a UNIVERSAL physical-safety hazard (child on a railing / unsupported at height /
   *                         dangerous proximity). Rides the SAME park path (name kept for back-compat) so a safety
   *                         failure is never soft-delivered, in both budget states.
   * An UNVERIFIED world (evidence_unknown) is recoverable and does NOT set this.
   *
   * (Fix 3) A `safety:` tag sets this on ANY row REGARDLESS of verdict/hash/version — so a hash/integrity downgrade
   * of a safety `failed` row to evidence_unknown, or a stale-version safety row, still hard-holds (never softens).
   */
  contractHardHold: boolean;
  /** (Fix 5) Which kind of hard hold drove `contractHardHold` (null when no hard hold). Safety takes precedence. */
  hardHoldKind: HardHoldKind | null;
  evidence: Record<string, unknown>;
}

/**
 * (release c-ii, Gate 1) True when a QualityEvidence row carries a HUMAN false-positive release that is BOUND to the
 * CURRENT delivered bytes. The single source of truth for "released", shared by evaluateQualityGate AND
 * quality-recovery so the two can NEVER disagree (a gate-release + recovery-park would loop the book forever).
 *
 * Byte-bound exactly like Gate 2: the release lapses the instant the bytes change (safetyOverrideSha256 no longer
 * equals the live hash) or the bytes cannot be hashed (currentHash null → fail-closed). It NEVER inspects the
 * `reason` — the detector's finding is never deleted, so after a release the reason still reads `safety:<hazards>`;
 * clearing the artifact is done HERE, on the byte-bound override column, not by touching the reason. Admissibility
 * (a determinate hazard, never `sha_missing` / `unverified`) is enforced where the override is WRITTEN (the release
 * action) — this predicate only honors a bound override, mirroring how Gate 2 trusts its override columns.
 */
export function isSafetyEvidenceReleased(
  row: Pick<QualityEvidenceRow, 'safetyOverride' | 'safetyOverrideSha256'>,
  currentHash: string | null,
): boolean {
  if (row.safetyOverride !== true) return false;
  // (P2) validate the SHAPE of BOTH SHAs with the SAME regex Gate 2 uses (asset-safety-signal SAFETY_SHA256_RE)
  // BEFORE the equality — the two sibling predicates must not differ in strictness. '' / null / wrong-length /
  // uppercase / non-hex all fail closed here, so `'' === ''` can never pass and an unhashable current byte is refused.
  if (!SAFETY_SHA256_RE.test(row.safetyOverrideSha256 ?? '') || !SAFETY_SHA256_RE.test(currentHash ?? '')) return false;
  return row.safetyOverrideSha256 === currentHash;
}

/**
 * (release c-ii, Gate 1 — the "safety-only" test) A `failed` verdict clears under a release ONLY when its failure is
 * exhaustively safety hazards — never when a non-safety component (a `contract_world:` drift, a base visual failure)
 * rides the SAME reason string. Do NOT infer this from `includes('safety:')` being true: that says nothing about what
 * ELSE is in the string. The producer joins components with `+`, so a reason is safety-only iff EVERY `+`-joined
 * component is a `safety:` tag. `safety:unsafe_pose` → true; `safety:unsafe_pose+contract_world:door_moved` → false;
 * `anatomy_failed+safety:railing` → false. (An `unverified` safety component is a moot input here — the release action
 * never sets an override for it, so isSafetyEvidenceReleased is already false.)
 */
export function isSafetyOnlyReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const parts = reason.split('+').map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => p.startsWith('safety:'));
}

/** The WHOLE per-artifact hold outcome. The SINGLE owner of admissibility + release + hard-hold + kind. */
export interface ArtifactHoldOutcome {
  staleVersion: boolean;
  hashMismatch: boolean;
  contractStale: boolean;
  admissible: boolean;
  /** Fully CLEARED → passed-equivalent (gate) / nowPassed (recovery): admissible + byte-bound release + safety-only. */
  released: boolean;
  humanVerified: boolean;
  passedEquivalent: boolean;
  /** Contributes a TERMINAL hard-hold (never soft-deliverable). */
  hardHold: boolean;
  /** Dominant hard-hold kind — 'safety' UNLESS the safety component was validly released (→ 'contract_world'); null when not held. */
  kind: HardHoldKind | null;
}

/**
 * (release c-ii, 2a-1) THE single owner of a per-artifact hold outcome — admissibility, the byte-bound release, the
 * safety-only clearing rule, AND the hold KIND. evaluateQualityGate (readiness) and reQaUnknownQualityEvidence
 * (recovery) BOTH consume this, so they cannot diverge on ANY dimension — not release, not hard-hold, and (the bug
 * this closes) not the kind. Before this, recovery derived the kind from the reason substring (`hardHoldKindOf`) and
 * mislabeled a released mixed-reason artifact as `safety` while the gate called it `contract_world` — presenting the
 * operator a safety case they could re-release but never ship.
 *
 * The rule that BECAME conditional with this feature and now lives in exactly one place: "safety DOMINATES
 * contract_world" holds UNLESS the safety component was validly released — then contract_world drives the kind.
 * Fix 3 is preserved: a `safety:` tag hard-holds REGARDLESS of admissibility (a hash-missed / stale safety finding
 * can never be soft-delivered) unless released; contract_world holds only on ADMISSIBLE evidence (a stale drift is
 * re-QA'd on the current bytes, not parked).
 */
export function resolveArtifactHoldOutcome(
  row: Pick<QualityEvidenceRow, 'evaluatorContractVersion' | 'assetSha256' | 'verdict' | 'reason' | 'contractHash' | 'safetyOverride' | 'safetyOverrideSha256' | 'humanReviewVerified'>,
  currentHash: string | null,
  opts: { contractVersion: string; activeContractHash?: string | null },
): ArtifactHoldOutcome {
  const staleVersion = row.evaluatorContractVersion !== opts.contractVersion;
  const hashMismatch = !currentHash || row.assetSha256 !== currentHash;
  const contractStale = isQualityEvidenceContractStale(row.contractHash, opts.activeContractHash);
  const admissible = !staleVersion && !hashMismatch && !contractStale;

  const hasSafety = row.reason?.includes('safety:') ?? false;
  const hasContractWorld = row.reason?.includes('contract_world:') ?? false;

  // A byte-bound release, honored ONLY on admissible evidence, SUPPRESSES the safety component (NOT gated on
  // safety-only — a mixed reason still suppresses the safety hazard while contract_world holds).
  const safetyReleased = admissible && isSafetyEvidenceReleased(row, currentHash);
  // Fully cleared (passed-equivalent) ADDITIONALLY requires the failure be safety-only.
  const released = safetyReleased && isSafetyOnlyReason(row.reason);
  const humanVerified =
    admissible &&
    row.verdict === 'evidence_unknown' &&
    row.humanReviewVerified === true &&
    isHumanReviewableUnverifiedReason(row.reason);

  const safetyHold = hasSafety && !safetyReleased && !humanVerified;
  const contractWorldHold = hasContractWorld && admissible; // stale drift → re-QA current bytes, not park
  const hardHold = safetyHold || contractWorldHold;
  const kind: HardHoldKind | null = safetyHold ? 'safety' : contractWorldHold ? 'contract_world' : null;

  return {
    staleVersion,
    hashMismatch,
    contractStale,
    admissible,
    released,
    humanVerified,
    passedEquivalent: released || humanVerified,
    hardHold,
    kind,
  };
}

export function isHumanReviewableUnverifiedReason(
  reason: string | null | undefined,
): boolean {
  if (!reason) return false;
  const components = reason.split('+').map((part) => part.trim()).filter(Boolean);
  const allowed = new Set([
    'safety:unverified',
    'vision_skipped',
    'vision_error',
    'vision_timeout',
    'vision_malformed',
  ]);
  return components.includes('safety:unverified') && components.every((part) => allowed.has(part));
}

/**
 * PURE fail-closed aggregate over the REQUIRED artifacts.
 *
 * Per artifact, given its persisted row and the CURRENT delivered-bytes hash:
 *  - no row                                   → unknown (missing)
 *  - evaluatorContractVersion != current      → unknown (stale_version)  [anti-bypass: old evaluator]
 *  - no current hash, or assetSha256 != it    → unknown (hash_mismatch)  [anti-bypass: a PASS for other bytes
 *                                                cannot authorize the current/delivered image]
 *  - verdict 'passed'                          → passed
 *  - verdict 'failed' & regenCount >= budget   → failed (deterministic, budget spent → terminal)
 *  - verdict 'failed' & regenCount <  budget   → unknown (recoverable: a targeted regen still has budget)
 *  - verdict 'evidence_unknown' / unrecognized → unknown
 *
 * Aggregate: any terminal-failed → 'failed'; else any unknown → 'evidence_unknown'; else 'passed'.
 */
export function evaluateQualityGate(
  requiredKeys: string[],
  rows: QualityEvidenceRow[],
  currentHashes: ArtifactHashes,
  opts: { budget?: number; contractVersion?: string; activeContractHash?: string | null } = {},
): QualityGateResult {
  const budget = opts.budget ?? QUALITY_REGEN_BUDGET;
  const contractVersion = opts.contractVersion ?? QUALITY_EVALUATOR_CONTRACT_VERSION;
  const byKey = new Map(rows.map((r) => [r.artifactKey, r]));

  const failedArtifacts: string[] = [];
  const unknownArtifacts: string[] = [];
  const perArtifact: Record<string, unknown> = {};
  let contractHardHold = false;
  let hardHoldKind: HardHoldKind | null = null;
  // Safety DOMINATES a contract-world hold (the universal child-safety invariant wins). Idempotent.
  const noteHardHold = (kind: HardHoldKind) => {
    contractHardHold = true;
    if (kind === 'safety' || hardHoldKind === null) hardHoldKind = kind;
  };

  for (const key of requiredKeys) {
    const row = byKey.get(key);
    const currentHash = currentHashes.get(key) ?? null;

    if (!row) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'missing' };
      continue;
    }

    // (release c-ii, 2a-1) The SHARED per-artifact outcome owns admissibility + release + hard-hold + kind, so this
    // gate and quality-recovery can never diverge on any of them. Fix 3 is preserved inside it: the safety hard-hold
    // is noted BEFORE the admissibility `continue`s (a hash-missed / stale safety row still hard-holds, never
    // soft-delivered) unless validly released; contract_world holds only on admissible evidence.
    const h = resolveArtifactHoldOutcome(row, currentHash, { contractVersion, activeContractHash: opts.activeContractHash });
    if (h.hardHold && h.kind) noteHardHold(h.kind);

    if (h.staleVersion) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'stale_version', have: row.evaluatorContractVersion, want: contractVersion };
      continue;
    }
    if (h.hashMismatch) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'hash_mismatch', evidenceHash: row.assetSha256, currentHash };
      continue;
    }
    // (WS0b) A row produced against a superseded contract is inadmissible → re-QA (never a stale PASS). Fail-closed
    // by default: an absent `activeContractHash` treats any hash-bound row as stale (phantom contract). null/null
    // (no contract frozen — today) → NOT stale → behavior byte-identical.
    if (h.contractStale) {
      unknownArtifacts.push(key);
      perArtifact[key] = {
        state: 'contract_stale',
        evidenceContractHash: row.contractHash,
        activeContractHash: opts.activeContractHash ?? null,
      };
      continue;
    }
    if (row.verdict === 'passed') {
      perArtifact[key] = { state: 'passed' };
      continue;
    }
    if (h.humanVerified) {
      perArtifact[key] = {
        state: 'human_verified_unverified',
        actionDigest: row.humanReviewActionDigest ?? null,
      };
      continue;
    }
    if (row.verdict === 'failed') {
      // Cleared (passed-equivalent) ONLY when the release is bound (⇒ admissible) AND the failure is safety-only. A
      // mixed `safety:…+contract_world:…` reason does NOT clear — its contract_world hard-hold was already noted above.
      if (h.released) {
        perArtifact[key] = { state: 'safety_released', verdict: row.verdict, overrideSha256: row.safetyOverrideSha256 };
        continue;
      }
      if (row.regenCount >= budget) {
        failedArtifacts.push(key);
        perArtifact[key] = { state: 'failed_terminal', reason: row.reason, regenCount: row.regenCount };
      } else {
        unknownArtifacts.push(key);
        perArtifact[key] = { state: 'failed_budget_remaining', reason: row.reason, regenCount: row.regenCount };
      }
      continue;
    }
    // 'evidence_unknown' or any unrecognized verdict string → inadmissible.
    unknownArtifacts.push(key);
    perArtifact[key] = { state: 'evidence_unknown', verdict: row.verdict, reason: row.reason };
  }

  let status: QualityGateStatus;
  let reason: string | null;
  if (failedArtifacts.length > 0) {
    status = 'failed';
    reason = `quality_failed:${failedArtifacts.join(',')}`;
  } else if (unknownArtifacts.length > 0) {
    status = 'evidence_unknown';
    reason = `quality_evidence_unknown:${unknownArtifacts.join(',')}`;
  } else {
    status = 'passed';
    reason = null;
  }
  return { status, reason, failedArtifacts, unknownArtifacts, contractHardHold, hardHoldKind, evidence: { perArtifact, contractVersion, budget } };
}

/** A stable, order-independent hash of the quality evidence — folded into the readiness inputsHash + TOCTOU
 *  fingerprint so an evidence mutation between eval and commit invalidates the manifest (anti-bypass). */
export function qualityEvidenceFingerprint(rows: QualityEvidenceRow[]): string {
  const sorted = [...rows].sort((a, b) => a.artifactKey.localeCompare(b.artifactKey));
  const canonical = sorted.map((r) => [
    r.artifactKey,
    r.assetSha256,
    r.verdict,
    r.evaluatorContractVersion,
    r.reason,
    r.regenCount,
    // (WS0b B1) contractHash IS part of the fingerprint: a late producer stamping a superseded contract onto an
    // otherwise-identical row must DRIFT the TOCTOU fingerprint → readiness aborts + re-evaluates, never commits a
    // stale-contract row as PASS. null everywhere (freeze off) → a constant → byte-identical eval-vs-commit.
    r.contractHash,
    // (release c-ii) The override IS part of the fingerprint for the SAME anti-bypass reason: a concurrent
    // override-clear (or set) between the readiness eval and its commit must drift the TOCTOU so the commit aborts +
    // re-evaluates. false/null everywhere (no release) → a constant → byte-identical to today.
    r.safetyOverride,
    r.safetyOverrideSha256,
    canonicalHash(r.evidence ?? null),
    r.evaluatedAt?.toISOString() ?? null,
    r.createdAt?.toISOString() ?? null,
    r.updatedAt?.toISOString() ?? null,
    ...(r.reviewStatus
      ? [
          r.reviewStatus,
          r.reviewedAssetSha256 ?? null,
          r.reviewedContractHash ?? null,
          r.reviewedBy ?? null,
          r.reviewedAt?.toISOString() ?? null,
          r.reviewReason ?? null,
          r.humanReviewVerified === true,
          r.humanReviewActionDigest ?? null,
        ]
      : []),
  ]);
  return JSON.stringify(canonical);
}

/**
 * (WS0b) The Order's active frozen visual-contract hash, or null when none is frozen (legacy). Bound onto each
 * QualityEvidence row at write time so a later slice (WS0b commit d) can treat a row produced against a superseded
 * contract as stale (`isQualityEvidenceContractStale`). Read-only here; NO consumer reads the column yet in (b).
 */
export async function readActiveVisualContractHash(db: Db, orderId: string): Promise<string | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { visualContractHash: true } });
  return order?.visualContractHash ?? null;
}

export interface PersistQualityEvidenceArgs {
  orderId: string;
  artifactKey: string;
  assetSha256: string;
  verdict: QualityVerdict;
  reason?: string | null;
  regenCount?: number;
  providerModel?: string | null;
  evidence?: Prisma.InputJsonValue | null;
  evaluatorContractVersion?: string;
  /** (WS0b) Active visual-contract hash to BIND this row to. Written verbatim (null = unbound/legacy). */
  contractHash?: string | null;
  now?: Date;
}

/** Upsert the authoritative evidence row for (orderId, artifactKey). Preserves regenCount unless provided. */
export async function persistQualityEvidence(db: Db, args: PersistQualityEvidenceArgs): Promise<void> {
  const now = args.now ?? new Date();
  const version = args.evaluatorContractVersion ?? QUALITY_EVALUATOR_CONTRACT_VERSION;
  const evidence = (args.evidence ?? undefined) as Prisma.InputJsonValue | undefined;
  await db.qualityEvidence.upsert({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    create: {
      orderId: args.orderId,
      artifactKey: args.artifactKey,
      assetSha256: args.assetSha256,
      verdict: args.verdict,
      evaluatorContractVersion: version,
      reason: args.reason ?? null,
      regenCount: args.regenCount ?? 0,
      providerModel: args.providerModel ?? null,
      evidence,
      // (WS0b) Bind the row to the active contract (null = legacy/unbound). No reader yet; not in the fingerprint.
      ...(args.contractHash === undefined ? {} : { contractHash: args.contractHash }),
      // (release c-ii, P1b) Fresh evidence describes new bytes/verdict → any prior operator override is void. Write
      // the cleared state explicitly so the invariant is legible, not merely inherited from the column default.
      safetyOverride: false,
      safetyOverrideSha256: null,
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
      evaluatedAt: now,
    },
    update: {
      assetSha256: args.assetSha256,
      verdict: args.verdict,
      evaluatorContractVersion: version,
      reason: args.reason ?? null,
      ...(args.regenCount === undefined ? {} : { regenCount: args.regenCount }),
      providerModel: args.providerModel ?? null,
      evidence,
      ...(args.contractHash === undefined ? {} : { contractHash: args.contractHash }),
      // (release c-ii, P1b) The invariant that matters: re-evaluating an artifact CLEARS a stale override bound to the
      // old bytes, so Gate 1 can never honor an override against evidence it did not produce.
      safetyOverride: false,
      safetyOverrideSha256: null,
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
      evaluatedAt: now,
    },
  });
}

export interface HumanReviewByteAuthority {
  anchorBytesSha256: string | null;
  artifactBytesSha256: ReadonlyMap<string, string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageArtifactSort(values: readonly string[]): string[] {
  return [...values].sort((left, right) => {
    const leftPage = pageNumberFromArtifactKey(left);
    const rightPage = pageNumberFromArtifactKey(right);
    if (leftPage != null && rightPage != null) return leftPage - rightPage;
    return left.localeCompare(right);
  });
}

function currentRequiredResemblanceArtifacts(
  rows: readonly Pick<QualityEvidenceRow, 'artifactKey' | 'evidence'>[],
): string[] {
  return pageArtifactSort(rows.flatMap((row) => {
    if (pageNumberFromArtifactKey(row.artifactKey) == null || !isRecord(row.evidence)) {
      return [];
    }
    const qaContext = row.evidence.qaContext;
    const gate = row.evidence.pageResemblanceGate;
    return (
      (isRecord(qaContext) && qaContext.expectsChild === true) ||
      (isRecord(gate) && gate.required === true)
    )
      ? [row.artifactKey]
      : [];
  }));
}

interface CurrentReviewedAssetBinding {
  assetId: string;
  deliveredUrlHash: string;
  safetyVerified: boolean | null;
  safetyHazards: string[];
  safetyContentSha256: string | null;
  safetyOverriddenHazards: string[];
  safetyOverrideSha256: string | null;
}

/**
 * Rebuild the resemblance authority from the CURRENT QualityEvidence rows, asset identities/URLs and inspected
 * bytes. A historical action outcome is never accepted as the source of a sibling page's score.
 */
function reconstructCurrentResemblanceProofs(args: {
  rows: readonly Pick<QualityEvidenceRow, 'artifactKey' | 'assetSha256' | 'evidence'>[];
  requiredArtifacts: readonly string[];
  assets: ReadonlyMap<string, CurrentReviewedAssetBinding | null>;
  byteAuthority: HumanReviewByteAuthority;
}): HumanVerifiedUnverifiedResemblanceProof[] | null {
  if (args.requiredArtifacts.length === 0) return null;
  const rowsByKey = new Map(args.rows.map((row) => [row.artifactKey, row]));
  const proofs: HumanVerifiedUnverifiedResemblanceProof[] = [];
  for (const artifactKey of pageArtifactSort(args.requiredArtifacts)) {
    const row = rowsByKey.get(artifactKey);
    const asset = args.assets.get(artifactKey) ?? null;
    if (!row || !asset || !isRecord(row.evidence)) return null;
    const gate = row.evidence.pageResemblanceGate;
    if (!isRecord(gate)) return null;
    const score = gate.resemblanceScore;
    const threshold = gate.threshold;
    const deliveredBytesSha256 = gate.deliveredBytesSha256;
    const referenceBytesSha256 = gate.referenceBytesSha256;
    const referenceImageUrl = gate.referenceImageUrl;
    const source = gate.source;
    if (
      gate.required !== true ||
      gate.status !== 'passed' ||
      gate.evaluatorVersion !== PAGE_CHILD_RESEMBLANCE_VISION_VERSION ||
      typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1 ||
      typeof threshold !== 'number' || !Number.isFinite(threshold) ||
      threshold < PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD || threshold > 1 || score < threshold ||
      gate.subjectVisible !== true || gate.sameChild !== true ||
      typeof deliveredBytesSha256 !== 'string' || !SAFETY_SHA256_RE.test(deliveredBytesSha256) ||
      deliveredBytesSha256 !== row.assetSha256 ||
      deliveredBytesSha256 !== asset.safetyContentSha256 ||
      deliveredBytesSha256 !== args.byteAuthority.artifactBytesSha256.get(artifactKey) ||
      typeof referenceBytesSha256 !== 'string' || !SAFETY_SHA256_RE.test(referenceBytesSha256) ||
      typeof referenceImageUrl !== 'string' || !referenceImageUrl ||
      (source !== 'raw_same_bytes' && source !== 'delivered_bytes')
    ) return null;
    proofs.push({
      artifactKey,
      assetId: asset.assetId,
      deliveredUrlHash: asset.deliveredUrlHash,
      deliveredBytesSha256,
      referenceBytesSha256,
      referenceImageUrlHash: canonicalHash(referenceImageUrl),
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      resemblanceScore: score,
      threshold,
      subjectVisible: true,
      sameChild: true,
      source,
    });
  }
  return parseHumanVerifiedUnverifiedResemblanceProofs(proofs);
}

type HumanReviewInspect = (
  url: string | null | undefined,
) => Promise<{ sha256: string | null }>;

/**
 * Inspect only DB-selected URLs needed to revalidate an existing human review. This is an asset-byte read, never a
 * Vision/provider call. Callers pass the returned SHAs into loadQualityEvidence, which re-reads all IDs/URLs and
 * fails closed if the DB snapshot moved between inspection and validation.
 */
export async function inspectHumanReviewAuthorityBytes(
  db: Db,
  orderId: string,
  inspect: HumanReviewInspect,
): Promise<HumanReviewByteAuthority> {
  const maybeReviewed = await db.qualityEvidence.findMany({
    where: { orderId, reviewStatus: HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS },
    select: { artifactKey: true, reviewStatus: true, reviewReason: true },
  });
  const reviewed = maybeReviewed.filter(
    (row) => row.reviewStatus === HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
  );
  if (reviewed.length === 0) {
    return { anchorBytesSha256: null, artifactBytesSha256: new Map() };
  }
  const actionIds = [...new Set(reviewed.flatMap((row) => {
    const binding = parseHumanVerifiedUnverifiedReviewReason(row.reviewReason);
    return binding ? [binding.actionId] : [];
  }))];
  const actions = actionIds.length > 0
    ? await db.humanQaOperatorAction.findMany({
        where: { id: { in: actionIds } },
        select: { id: true, outcome: true },
      })
    : [];
  const proofKeys = new Set(reviewed.map((row) => row.artifactKey));
  for (const action of actions) {
    const outcome = parseHumanVerifiedUnverifiedOutcome(action.outcome);
    for (const proof of outcome?.resemblanceProofs ?? []) {
      proofKeys.add(proof.artifactKey);
    }
  }
  const pageNumbers = [...proofKeys].flatMap((key) => {
    const pageNumber = pageNumberFromArtifactKey(key);
    return pageNumber == null ? [] : [pageNumber];
  });
  const [pages, job] = await Promise.all([
    db.bookPage.findMany({
      where: { book: { orderId }, pageNumber: { in: pageNumbers } },
      select: {
        pageNumber: true,
        imageAsset: { select: { url: true, presentationUrl: true } },
      },
    }),
    db.generationJob.findUnique({
      where: { orderId },
      select: { pipelineCache: true },
    }),
  ]);
  const anchor = getApprovedChildCanonicalAnchor(
    (job?.pipelineCache ?? {}) as PipelineCache,
  );
  const [anchorInspection, ...pageInspections] = await Promise.all([
    inspect(anchor?.url ?? null),
    ...pages.map((page) =>
      inspect(page.imageAsset?.presentationUrl ?? page.imageAsset?.url ?? null),
    ),
  ]);
  return {
    anchorBytesSha256: anchorInspection.sha256,
    artifactBytesSha256: new Map(
      pages.map((page, index) => [
        pageArtifactKey(page.pageNumber),
        pageInspections[index]?.sha256 ?? null,
      ]),
    ),
  };
}

/** Load evidence and derive a human pass only from the complete current durable authority chain. */
export async function loadQualityEvidence(
  db: Db,
  orderId: string,
  byteAuthority: HumanReviewByteAuthority = {
    anchorBytesSha256: null,
    artifactBytesSha256: new Map(),
  },
): Promise<QualityEvidenceRow[]> {
  const rows = await db.qualityEvidence.findMany({
    where: { orderId },
    select: {
      id: true,
      artifactKey: true,
      assetSha256: true,
      verdict: true,
      evaluatorContractVersion: true,
      reason: true,
      regenCount: true,
      providerModel: true,
      contractHash: true,
      safetyOverride: true,
      safetyOverrideSha256: true,
      evidence: true,
      evaluatedAt: true,
      reviewStatus: true,
      reviewedAssetSha256: true,
      reviewedContractHash: true,
      reviewedBy: true,
      reviewedAt: true,
      reviewReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const reviewBindings = rows
    .map((row) => ({ row, binding: parseHumanVerifiedUnverifiedReviewReason(row.reviewReason) }))
    .filter((entry): entry is typeof entry & { binding: NonNullable<typeof entry.binding> } => !!entry.binding);
  const actionIds = [...new Set(reviewBindings.map((entry) => entry.binding.actionId))];
  const actions = actionIds.length > 0
    ? await db.humanQaOperatorAction.findMany({
        where: { id: { in: actionIds } },
        select: {
          id: true,
          idempotencyKey: true,
          requestHash: true,
          orderId: true,
          caseId: true,
          caseRevision: true,
          kind: true,
          status: true,
          actor: true,
          targetArtifacts: true,
          observedMarker: true,
          observedFence: true,
          observedInputVersion: true,
          overriddenHazards: true,
          overrideReason: true,
          assetSha256: true,
          outcome: true,
        },
      })
    : [];
  const parsedOutcomes = new Map(actions.flatMap((action) => {
    const outcome = parseHumanVerifiedUnverifiedOutcome(action.outcome);
    return outcome ? [[action.id, outcome] as const] : [];
  }));
  // Ordinary QA/recovery rows do not need the expensive human-authority joins. Reconstruct the complete current
  // proof set only when at least one row carries a syntactically valid human-review binding; an absent/malformed
  // binding already fails human authority closed and must not broaden every normal quality load into Book/payment
  // reads.
  const requiredCurrentProofArtifacts = reviewBindings.length > 0
    ? currentRequiredResemblanceArtifacts(rows)
    : [];
  const reviewedArtifactKeys = new Set(reviewBindings.map(({ row }) => row.artifactKey));
  for (const artifactKey of requiredCurrentProofArtifacts) {
    reviewedArtifactKeys.add(artifactKey);
  }
  for (const outcome of parsedOutcomes.values()) {
    for (const proof of outcome.resemblanceProofs) reviewedArtifactKeys.add(proof.artifactKey);
  }
  const reviewedPageNumbers = [...new Set([...reviewedArtifactKeys].flatMap((artifactKey) => {
    const pageNumber = pageNumberFromArtifactKey(artifactKey);
    return pageNumber == null ? [] : [pageNumber];
  }))];
  const reviewedAssets = reviewedPageNumbers.length > 0
    ? await db.bookPage.findMany({
        where: { book: { orderId }, pageNumber: { in: reviewedPageNumbers } },
        select: {
          pageNumber: true,
          imageAsset: {
            select: {
              id: true,
              url: true,
              presentationUrl: true,
              safetyVerified: true,
              safetyHazards: true,
              safetyContentSha256: true,
              safetyOverriddenHazards: true,
              safetyOverrideSha256: true,
            },
          },
        },
      })
    : [];
  const reviewedAssetByKey = new Map(reviewedAssets.map((page) => [
    pageArtifactKey(page.pageNumber),
    page.imageAsset
      ? {
          assetId: page.imageAsset.id,
          deliveredUrlHash: deliveredUrlHash(
            page.imageAsset.presentationUrl ?? page.imageAsset.url,
          ),
          safetyVerified: page.imageAsset.safetyVerified,
          safetyHazards: page.imageAsset.safetyHazards,
          safetyContentSha256: page.imageAsset.safetyContentSha256,
          safetyOverriddenHazards: page.imageAsset.safetyOverriddenHazards,
          safetyOverrideSha256: page.imageAsset.safetyOverrideSha256,
        }
      : null,
  ]));
  const reconstructedCurrentProofs = reconstructCurrentResemblanceProofs({
    rows,
    requiredArtifacts: requiredCurrentProofArtifacts,
    assets: reviewedAssetByKey,
    byteAuthority,
  });
  const reconstructedCurrentProofDigest = reconstructedCurrentProofs
    ? humanVerifiedUnverifiedResemblanceProofDigest(reconstructedCurrentProofs)
    : null;
  const operationKeys = [...new Set(actions.map((action) => action.idempotencyKey))];
  const receipts = operationKeys.length > 0
    ? await db.atomicOperationReceipt.findMany({
        where: { operationKey: { in: operationKeys } },
        select: {
          operationKey: true,
          orderId: true,
          kind: true,
          payloadHash: true,
          result: true,
        },
      })
    : [];
  const caseIds = [...new Set(actions.map((action) => action.caseId))];
  const reviewedCases = caseIds.length > 0
    ? await db.humanQaReviewCase.findMany({
        where: { id: { in: caseIds } },
        select: {
          id: true,
          activeKey: true,
          revision: true,
          kind: true,
          status: true,
          holdFingerprint: true,
          rawReason: true,
          inputVersion: true,
          contractHash: true,
        },
      })
    : [];
  const [reviewedGenerationJob, currentOrder, payment, paymentCase, activeBaseCase, exceptionCases] =
    reviewBindings.length > 0
      ? await Promise.all([
          db.generationJob.findUnique({
            where: { orderId },
            select: { pipelineCache: true },
          }),
          db.order.findUnique({
            where: { id: orderId },
            select: {
              status: true,
              deliveryHoldReason: true,
              deliveryFenceVersion: true,
              inputVersion: true,
              manualReviewRequired: true,
              visualContractHash: true,
              stripePaid: true,
              paymentProvider: true,
              paymentId: true,
              stripePaymentId: true,
              totalPrice: true,
            },
          }),
          db.paymentRecord.findUnique({
            where: { orderId },
            select: {
              id: true,
              provider: true,
              amount: true,
              currency: true,
              paid: true,
              paidAt: true,
            },
          }),
          db.humanQaReviewCase.findUnique({
            where: { activeKey: `${orderId}:payment` },
            select: { status: true },
          }),
          db.humanQaReviewCase.findUnique({
            where: { activeKey: `${orderId}:base_book` },
            select: { id: true, status: true },
          }),
          db.exceptionCase.findMany({
            where: { orderId },
            select: {
              id: true,
              activeKey: true,
              kind: true,
              status: true,
              refundKey: true,
              providerActionId: true,
              actionAttemptedAt: true,
              notificationAttemptedAt: true,
              notificationMessageId: true,
              resolution: true,
              lastError: true,
            },
          }),
        ])
      : [null, null, null, null, null, []] as const;
  const refundKeys = exceptionCases.flatMap((entry) => entry.refundKey ? [entry.refundKey] : []);
  const refundAttempts = refundKeys.length > 0
    ? await db.refundAttempt.findMany({
        where: { refundKey: { in: refundKeys } },
        select: {
          refundKey: true,
          status: true,
          providerActionId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];
  const currentRefundAuthorityDigest = refundAuthorityDigest({
    exceptionCases,
    refundAttempts,
  });
  const commercialAuthorityClean = !hasDisqualifyingRefundOrReconciliationActivity({
    exceptionCases,
    refundAttempts,
  });
  const currentPaymentSnapshotDigest = currentOrder
    ? paymentSnapshotDigest({
        order: currentOrder,
        payment,
        paymentCaseActive: paymentCase?.status === 'open',
        refundAuthorityDigest: currentRefundAuthorityDigest,
      })
    : null;
  const currentApprovedAnchor = getApprovedChildCanonicalAnchor(
    (reviewedGenerationJob?.pipelineCache ?? {}) as PipelineCache,
  );
  const currentAnchorEntryDigest = currentApprovedAnchor
    ? canonicalHash(currentApprovedAnchor)
    : null;
  const currentAnchorUrlHash = currentApprovedAnchor
    ? canonicalHash(currentApprovedAnchor.url)
    : null;
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const receiptByKey = new Map(receipts.map((receipt) => [receipt.operationKey, receipt]));
  const caseById = new Map(reviewedCases.map((reviewCase) => [reviewCase.id, reviewCase]));
  return rows.map((row) => {
    const binding = parseHumanVerifiedUnverifiedReviewReason(row.reviewReason);
    const action = binding ? actionById.get(binding.actionId) : null;
    const outcome = action ? parsedOutcomes.get(action.id) ?? null : null;
    const receipt = action ? receiptByKey.get(action.idempotencyKey) ?? null : null;
    const receiptValue = receipt
      ? parseHumanVerifiedUnverifiedAtomicReceiptResult(receipt.result)
      : null;
    const currentAsset = reviewedAssetByKey.get(row.artifactKey) ?? null;
    const currentCase = action ? caseById.get(action.caseId) ?? null : null;
    const currentProofsMatch = !!(
      outcome &&
      reconstructedCurrentProofs &&
      reconstructedCurrentProofDigest &&
      reconstructedCurrentProofDigest === outcome.resemblanceProofDigest &&
      canonicalHash(reconstructedCurrentProofs) === canonicalHash(outcome.resemblanceProofs) &&
      canonicalHash(requiredCurrentProofArtifacts) ===
        canonicalHash(outcome.resemblanceProofs.map((proof) => proof.artifactKey)) &&
      reconstructedCurrentProofs.every((proof) =>
        proof.referenceImageUrlHash === currentAnchorUrlHash &&
        proof.referenceBytesSha256 === byteAuthority.anchorBytesSha256
      )
    );
    const targetQualityDigest = row.id && row.providerModel !== undefined && row.evaluatedAt && row.createdAt && row.updatedAt
      ? humanVerifiedUnverifiedQualityAuthorityDigest({
          id: row.id,
          artifactKey: row.artifactKey,
          assetSha256: row.assetSha256,
          verdict: row.verdict,
          evaluatorContractVersion: row.evaluatorContractVersion,
          reason: row.reason,
          regenCount: row.regenCount,
          providerModel: row.providerModel ?? null,
          contractHash: row.contractHash,
          safetyOverride: row.safetyOverride,
          safetyOverrideSha256: row.safetyOverrideSha256,
          evidence: row.evidence ?? null,
          evaluatedAt: row.evaluatedAt,
          reviewStatus: row.reviewStatus ?? null,
          reviewedAssetSha256: row.reviewedAssetSha256 ?? null,
          reviewedContractHash: row.reviewedContractHash ?? null,
          reviewedBy: row.reviewedBy ?? null,
          reviewedAt: row.reviewedAt ?? null,
          reviewReason: row.reviewReason ?? null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
      : null;
    const paymentValid = !!(
      currentOrder &&
      hasStrictHumanVerificationPaymentAuthority({
        order: currentOrder,
        payment,
      }) &&
      currentOrder.manualReviewRequired === false &&
      paymentCase?.status !== 'open' &&
      commercialAuthorityClean
    );
    const humanReviewVerified = !!(
      binding &&
      action &&
      outcome &&
      receipt &&
      receiptValue &&
      currentOrder &&
      currentCase &&
      currentAsset &&
      targetQualityDigest &&
      row.reviewStatus === HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS &&
      row.reviewedAssetSha256 === row.assetSha256 &&
      row.reviewedContractHash === row.contractHash &&
      row.reviewedBy === action.actor &&
      row.reviewedAt &&
      isHumanReviewableUnverifiedReason(row.reason) &&
      row.verdict === 'evidence_unknown' &&
      row.safetyOverride === false &&
      row.safetyOverrideSha256 === null &&
      action.orderId === orderId &&
      action.kind === 'release' &&
      action.status === 'succeeded' &&
      action.targetArtifacts.length === 1 &&
      action.targetArtifacts[0] === row.artifactKey &&
      action.overriddenHazards.length === 0 &&
      action.overrideReason === binding.reason &&
      action.assetSha256 === row.assetSha256 &&
      action.idempotencyKey === outcome.receiptOperationKey &&
      action.requestHash === outcome.requestHash &&
      action.observedMarker === outcome.expectedMarker &&
      action.observedFence === outcome.observedFence &&
      action.observedInputVersion === outcome.observedInputVersion &&
      outcome.orderId === orderId &&
      outcome.actionId === action.id &&
      outcome.caseId === action.caseId &&
      outcome.caseRevision === action.caseRevision &&
      outcome.artifactKey === row.artifactKey &&
      outcome.assetSha256 === row.assetSha256 &&
      outcome.evaluatorVersion === row.evaluatorContractVersion &&
      outcome.qualityEvidenceDigest === targetQualityDigest &&
      currentAsset.assetId === outcome.assetId &&
      currentAsset.deliveredUrlHash === outcome.deliveredUrlHash &&
      currentAsset.safetyContentSha256 === outcome.assetSha256 &&
      currentAsset.safetyVerified !== true &&
      currentAsset.safetyHazards.length === 0 &&
      currentAsset.safetyOverriddenHazards.length === 0 &&
      currentAsset.safetyOverrideSha256 === null &&
      byteAuthority.artifactBytesSha256.get(row.artifactKey) === outcome.assetSha256 &&
      outcome.contractHash === row.contractHash &&
      outcome.reviewer === action.actor &&
      outcome.anchorEntryDigest === currentAnchorEntryDigest &&
      outcome.anchorUrlHash === currentAnchorUrlHash &&
      outcome.anchorBytesSha256 === byteAuthority.anchorBytesSha256 &&
      currentProofsMatch &&
      currentOrder.status === 'ready' &&
      currentOrder.deliveryHoldReason === null &&
      currentOrder.deliveryFenceVersion === outcome.postFence &&
      currentOrder.inputVersion === outcome.observedInputVersion &&
      currentOrder.visualContractHash === outcome.contractHash &&
      outcome.refundAuthorityDigest === currentRefundAuthorityDigest &&
      outcome.paymentSnapshotDigest === currentPaymentSnapshotDigest &&
      paymentValid &&
      activeBaseCase === null &&
      !exceptionCases.some((entry) => entry.activeKey === `${orderId}:base_book`) &&
      currentCase.activeKey === null &&
      currentCase.status === 'resolved' &&
      currentCase.kind === 'safety' &&
      currentCase.revision === outcome.caseRevision &&
      currentCase.holdFingerprint === outcome.caseFingerprint &&
      currentCase.rawReason === outcome.expectedMarker &&
      currentCase.inputVersion === outcome.observedInputVersion &&
      currentCase.contractHash === outcome.contractHash &&
      receipt.orderId === orderId &&
      receipt.kind === 'operator_action' &&
      receipt.payloadHash === action.requestHash &&
      receiptValue.actionId === action.id &&
      receiptValue.requestHash === action.requestHash &&
      receiptValue.inspectionDigest === outcome.inspectionDigest &&
      receiptValue.resemblanceProofDigest === outcome.resemblanceProofDigest &&
      receiptValue.qualityEvidenceDigest === outcome.qualityEvidenceDigest &&
      canonicalHash(receiptValue.result) === canonicalHash(outcome.result)
    );
    return {
      ...row,
      humanReviewVerified,
      humanReviewActionDigest: humanReviewVerified ? action!.requestHash : null,
    };
  });
}

/**
 * Durably reserve ONE regen against an artifact's budget BEFORE generating a replacement — so a crash between
 * reserve and render can never reset the budget. Atomic (a conditional increment); returns true iff a regen was
 * granted (regenCount was < budget). The row MUST already exist (the candidate render persists it first).
 * Vision transport retries must NOT call this — only a deterministic QA failure consumes image-regen budget.
 */
export async function reserveQualityRegen(
  db: Db,
  args: { orderId: string; artifactKey: string; budget?: number },
): Promise<boolean> {
  const budget = args.budget ?? QUALITY_REGEN_BUDGET;
  const bumped = await db.qualityEvidence.updateMany({
    where: { orderId: args.orderId, artifactKey: args.artifactKey, regenCount: { lt: budget } },
    data: { regenCount: { increment: 1 } },
  });
  return bumped.count === 1;
}

/**
 * (#7-a 5b) Create the evidence row at regenCount 0 if it does not exist yet, so the atomic conditional-increment
 * reserve has a row to bump. IDEMPOTENT: the update is a no-op, so it NEVER resets an existing row's regenCount
 * or verdict (carry-in #4 — the DB-reserved budget is preserved). The placeholder verdict is evidence_unknown
 * (fail-closed) until the seam persists the real verdict.
 */
export async function ensureQualityEvidenceRow(
  db: Db,
  args: { orderId: string; artifactKey: string },
): Promise<void> {
  await db.qualityEvidence.upsert({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    create: {
      orderId: args.orderId,
      artifactKey: args.artifactKey,
      assetSha256: '',
      verdict: 'evidence_unknown',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      regenCount: 0,
    },
    update: {},
  });
}

/**
 * (#7-a 5b) A durable, crash-safe regen reserver bound to ONE artifact: ensure the row exists, then atomically
 * reserve one regen (regenCount < budget → +1) BEFORE generating a replacement. Returns false when the budget is
 * spent. The caller (chunk-runner) binds this to {prisma, orderId, artifactKey} ONLY when the readiness flag is
 * on; flag-off passes no reserver, so the render loop keeps its legacy in-memory budget (byte-identical).
 */
export function makeQualityRegenReserver(
  db: Db,
  args: { orderId: string; artifactKey: string; budget?: number },
): () => Promise<boolean> {
  return async () => {
    if ('$transaction' in db && typeof db.$transaction === 'function') {
      // Dynamic import avoids the quality-evidence ↔ readiness-manifest module cycle. Production root-client
      // reservation is a delivery-input mutation: Order is locked before the regen counter, and a granted reserve
      // atomically stales readiness/advances inputVersion so a late renderer cannot invalidate a human approval
      // after Outbox commit while the send CAS remains live. TransactionClient callers already own their barrier.
      const { isReadinessManifestEnabled, withDeliveryInputMutation } =
        await import('./readiness-manifest');
      if (isReadinessManifestEnabled()) {
        const notGranted = new Error('quality_regen_not_granted');
        try {
          const mutation = await withDeliveryInputMutation(
            db,
            {
              orderId: args.orderId,
              reason: 'quality_regen_reserved',
            },
            async (tx) => {
              await ensureQualityEvidenceRow(tx, args);
              const granted = await reserveQualityRegen(tx, args);
              if (!granted) throw notGranted;
              return { granted: true };
            },
          );
          return mutation.value.granted;
        } catch (error) {
          if (error === notGranted) return false;
          throw error;
        }
      }
    }
    await ensureQualityEvidenceRow(db, args);
    return reserveQualityRegen(db, args);
  };
}
