/**
 * WS0 (step 8) — the uniform per-check QA result shape + fail-closed aggregation, and the contract-hash
 * validity helper. ENFORCEMENT IS OFF: this ships the SHAPE + aggregation with NO new required checks, so
 * the aggregate feeds the EXISTING `QUALITY_REGEN_BUDGET=2` auto-repair path (Decision Gate clarification 1)
 * WITHOUT adding a second render/gate loop and WITHOUT blocking any delivery today.
 *
 * The location/cast check PRODUCERS (what actually populates these results) land in WS1/WS2 — this module is
 * only the vocabulary + the aggregation truth table, and it is PURE (no DB, no clock, no env) so the matrix
 * is unit-testable.
 */
import type { QualityVerdict } from './quality-evidence';

/**
 * One check's outcome.
 *  - `pass`            the check is satisfied.
 *  - `fail`            the check is violated (deterministic negative).
 *  - `unknown`         the check could not be evaluated (missing observation / low confidence).
 *  - `not_applicable`  the check does not apply to this artifact (e.g. a companion check on a companion-less page).
 */
export type QualityCheckStatus = 'pass' | 'fail' | 'unknown' | 'not_applicable';

export interface QualityCheckResult {
  /** Stable check id (e.g. `location_matches`, `cast_present`). WS1/WS2 define the concrete ids. */
  checkId: string;
  status: QualityCheckStatus;
  /** What the contract required (for evidence/telemetry). */
  expected?: string;
  /** What was observed at QA time (for evidence/telemetry). */
  observed?: string;
  /** 0..1 confidence in the observation (advisory). */
  confidence?: number;
}

export interface QualityCheckAggregate {
  /** Reuses the durable verdict vocabulary so the aggregate can feed the existing quality-evidence path. */
  verdict: QualityVerdict;
  failedCheckIds: string[];
  /** Required checks that are missing or `unknown`. */
  unknownCheckIds: string[];
  reason: string | null;
}

/**
 * PURE fail-closed aggregation of per-check results.
 *
 *   1. ANY `fail` (required or not)                        → `failed`.
 *   2. else ANY required check not POSITIVELY satisfied     → `evidence_unknown`.
 *   3. else                                                 → `passed`.
 *
 * A required check is satisfied ONLY when it has at least one result AND EVERY result for it is `pass`.
 * Missing, `unknown`, or `not_applicable` on a REQUIRED check → `evidence_unknown` (fail-closed): a required
 * gate cannot be bypassed by marking it N/A or by omitting its observation. `not_applicable` is meaningful for
 * NON-required (telemetry) checks and for a check that legitimately does not apply — in which case it must not
 * be in `requiredCheckIds` for that artifact.
 *
 * `requiredCheckIds` defaults to [] — so in WS0 (no required checks yet, enforcement OFF) a result set with
 * no `fail` aggregates to `passed` and nothing is blocked.
 */
export function aggregateQualityChecks(
  results: QualityCheckResult[],
  requiredCheckIds: string[] = [],
): QualityCheckAggregate {
  const resultsById = new Map<string, QualityCheckResult[]>();
  for (const r of results) {
    const arr = resultsById.get(r.checkId);
    if (arr) arr.push(r);
    else resultsById.set(r.checkId, [r]);
  }

  const uniqueFailed = Array.from(new Set(results.filter((r) => r.status === 'fail').map((r) => r.checkId)));
  const failedSet = new Set(uniqueFailed);

  const unknownCheckIds: string[] = [];
  for (const id of requiredCheckIds) {
    if (failedSet.has(id)) continue; // a failed required check is already accounted for by the `failed` verdict
    const rs = resultsById.get(id);
    const satisfied = !!rs && rs.length > 0 && rs.every((r) => r.status === 'pass');
    if (!satisfied) unknownCheckIds.push(id);
  }

  if (uniqueFailed.length > 0) {
    return {
      verdict: 'failed',
      failedCheckIds: uniqueFailed,
      unknownCheckIds,
      reason: `quality_checks_failed:${uniqueFailed.join(',')}`,
    };
  }
  if (unknownCheckIds.length > 0) {
    return {
      verdict: 'evidence_unknown',
      failedCheckIds: uniqueFailed,
      unknownCheckIds,
      reason: `quality_checks_unknown:${unknownCheckIds.join(',')}`,
    };
  }
  return { verdict: 'passed', failedCheckIds: [], unknownCheckIds: [], reason: null };
}

/**
 * Contract-hash validity (WS0 step 8): a `QualityEvidence` row is admissible only while its `contractHash`
 * matches the Order's active `visualContractHash`. A mismatch means the row was produced against a DIFFERENT
 * (superseded) contract → treat it as STALE and force a re-QA.
 *
 * Fail-closed rules:
 *  - Order HAS an active contract hash → a row is fresh ONLY when its `contractHash` matches exactly.
 *  - Order has NO active contract hash but the EVIDENCE carries one → the row was produced against a contract
 *    the order does not (or no longer) advertise → STALE (never admit evidence bound to a phantom contract).
 *  - NEITHER side carries a hash → the contract layer is genuinely inactive (the WS0 default: the producer
 *    does not stamp `contractHash` yet), so there is nothing to bind → NOT stale. Existing evidence/readiness
 *    behavior is unchanged until an order actually carries a `visualContractHash`.
 */
export function isQualityEvidenceContractStale(
  evidenceContractHash: string | null | undefined,
  orderContractHash: string | null | undefined,
): boolean {
  if (orderContractHash) return evidenceContractHash !== orderContractHash;
  // Order has no active contract hash: stale iff the evidence nonetheless claims one (phantom contract).
  return !!evidenceContractHash;
}
