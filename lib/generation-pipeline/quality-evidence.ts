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

/** Durable regen budget per artifact: one candidate + at most two replacements is 2 regens (#7-a: 5→2). */
export const QUALITY_REGEN_BUDGET = 2;

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
  artifactKey: string;
  assetSha256: string;
  verdict: string; // stored free-text (CHECK-constrained); an unrecognized value is inadmissible → BLOCK
  evaluatorContractVersion: string;
  reason: string | null;
  regenCount: number;
  /** (WS0b) The contract this row was produced against; a mismatch vs the Order's active contract → stale. */
  contractHash: string | null;
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

    // (Fix 3) A `safety:` tag hard-holds on ANY row REGARDLESS of verdict / hash / version — a known hazard or an
    // unconfirmed-safe image survives every downgrade (failed→evidence_unknown on a hash miss, a stale-version row)
    // and can NEVER be soft-delivered. Checked BEFORE the admissibility `continue`s below.
    if (row?.reason?.includes('safety:')) noteHardHold('safety');

    if (!row) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'missing' };
      continue;
    }
    if (row.evaluatorContractVersion !== contractVersion) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'stale_version', have: row.evaluatorContractVersion, want: contractVersion };
      continue;
    }
    if (!currentHash || row.assetSha256 !== currentHash) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'hash_mismatch', evidenceHash: row.assetSha256, currentHash };
      continue;
    }
    // (WS0b) A row produced against a superseded contract is inadmissible → re-QA (never a stale PASS). Fail-closed
    // by default: an absent `activeContractHash` treats any hash-bound row as stale (phantom contract). null/null
    // (no contract frozen — today) → NOT stale → behavior byte-identical.
    if (isQualityEvidenceContractStale(row.contractHash, opts.activeContractHash)) {
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
    if (row.verdict === 'failed') {
      // (Slice A) A deterministic contract-world drift must HARD-hold regardless of budget state (soft-deliver
      // exemption). Safety is already handled ABOVE for every verdict (Fix 3), so only contract_world here.
      if (row.reason?.includes('contract_world:')) noteHardHold('contract_world');
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
    r.regenCount,
    // (WS0b B1) contractHash IS part of the fingerprint: a late producer stamping a superseded contract onto an
    // otherwise-identical row must DRIFT the TOCTOU fingerprint → readiness aborts + re-evaluates, never commits a
    // stale-contract row as PASS. null everywhere (freeze off) → a constant → byte-identical eval-vs-commit.
    r.contractHash,
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
      evaluatedAt: now,
    },
  });
}

/** Load the evidence rows for an order, projected to what the gate reads. */
export async function loadQualityEvidence(db: Db, orderId: string): Promise<QualityEvidenceRow[]> {
  const rows = await db.qualityEvidence.findMany({
    where: { orderId },
    select: {
      artifactKey: true,
      assetSha256: true,
      verdict: true,
      evaluatorContractVersion: true,
      reason: true,
      regenCount: true,
      contractHash: true,
    },
  });
  return rows;
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
    await ensureQualityEvidenceRow(db, args);
    return reserveQualityRegen(db, args);
  };
}
