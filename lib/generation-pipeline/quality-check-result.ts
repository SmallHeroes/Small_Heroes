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
 *   1. ANY `fail` (required or not)               → `failed`.
 *   2. else ANY required check missing or `unknown` → `evidence_unknown`.
 *   3. else                                          → `passed`  (all required checks positive; a required
 *                                                       `not_applicable` is a legitimate non-block).
 *
 * `requiredCheckIds` defaults to [] — so in WS0 (no required checks yet, enforcement OFF) a result set with
 * no `fail` aggregates to `passed` and nothing is blocked.
 */
export function aggregateQualityChecks(
  results: QualityCheckResult[],
  requiredCheckIds: string[] = [],
): QualityCheckAggregate {
  const byId = new Map<string, QualityCheckResult>();
  for (const r of results) {
    // Last writer wins for a duplicated checkId; a `fail`/`unknown` is never silently overwritten by a later
    // `pass` unless that later result is genuinely for the same check — callers should not emit duplicates.
    byId.set(r.checkId, r);
  }

  const failedCheckIds = results.filter((r) => r.status === 'fail').map((r) => r.checkId);
  const uniqueFailed = Array.from(new Set(failedCheckIds));

  const unknownCheckIds: string[] = [];
  for (const id of requiredCheckIds) {
    const r = byId.get(id);
    if (!r || r.status === 'unknown') unknownCheckIds.push(id);
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
 * Enforcement-OFF safety: when the Order has NO active contract hash (the vNext contract layer is not frozen
 * for this order — the WS0 default), there is nothing to bind against, so a row is NOT considered stale on
 * this axis. Existing evidence/readiness behavior is therefore unchanged until an order actually carries a
 * `visualContractHash`.
 */
export function isQualityEvidenceContractStale(
  evidenceContractHash: string | null | undefined,
  orderContractHash: string | null | undefined,
): boolean {
  if (!orderContractHash) return false; // contract layer not active for this order → nothing to bind
  return evidenceContractHash !== orderContractHash;
}
