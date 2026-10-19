/**
 * Reusable bounded recovery state of ONE engine stage (stage-recovery/v1), for any stage whose candidates are reviewed: every attempt in
 * order (its candidate, the context/strategy it was made under and its REVIEWED outcome) reduced to what the next attempt must do.
 * - A held candidate is a semantic failure. A process exit, a receipt or a repeated category name is not an outcome.
 * - An unknown outcome (a missing or unpriced provider result) stops new spending: it is never a cosmetic defect.
 * - One failure routes to a targeted correction. Two CONSECUTIVE failures require a bound diagnosis and a changed strategy before the next
 *   generation: the next context may not repeat any failed attempt's context (no identical-wire retry to fish for a pass).
 * - Only an admitted candidate resets the count. The state is derived from the attempts themselves, so a rename, a new folder, a new grant
 *   or a restart cannot reset it, and the stage's own attempt ceiling (from its authority) is never raised here.
 * Pure: no clock, no I/O, no provider. Callers persist and re-derive it from their own records.
 */
export const STAGE_RECOVERY_VERSION = 'stage-recovery/v1' as const;

export type RecoveryOutcome = 'admitted' | 'held' | 'unknown';
/** One reviewed finding of an attempt: a stable check key (never a free-text summary), the verdict and the reviewer's own words. */
export type RecoveryFinding = { key: string; verdict: string; observation: string };
export type RecoveryAttempt = { attempt: number; candidateDigest: string; contextDigest: string; outcome: RecoveryOutcome; findings: RecoveryFinding[] };
export type RecoveryMode = 'first_attempt' | 'admitted' | 'targeted_correction' | 'diagnose_and_change_strategy' | 'stop_unknown_outcome'
  | 'stop_allowance_exhausted';

export class StageRecoveryError extends Error { constructor(readonly code: string) { super(`stage_recovery_${code}`); } }
const fail = (code: string): never => { throw new StageRecoveryError(code); };
const HASH = /^[a-f0-9]{64}$/;

/**
 * How the latest failed attempt's findings relate to the previous one's, by check key AND by the reviewer's words (a key alone is a
 * category name, not a cause): the same key with the same observation is the identical finding again; the same key with different words is
 * the same check failing again on what may be another detail; a new key is new; a key that disappeared was resolved.
 */
export type FindingTrajectory = 'new' | 'identical_finding' | 'repeated_check_new_detail' | 'resolved';
export function findingTrajectory(previous: readonly RecoveryFinding[], latest: readonly RecoveryFinding[]): { key: string; trajectory: FindingTrajectory }[] {
  const before = new Map(previous.map(f => [f.key, f])), after = new Set(latest.map(f => f.key));
  return [...latest.map(f => ({ key: f.key, trajectory: (!before.has(f.key) ? 'new'
      : before.get(f.key)!.observation === f.observation ? 'identical_finding' : 'repeated_check_new_detail') as FindingTrajectory })),
    ...previous.filter(f => !after.has(f.key)).map(f => ({ key: f.key, trajectory: 'resolved' as FindingTrajectory }))];
}

/** The stage's state after these attempts, under the stage's own attempt ceiling (an authority fact, never chosen here). */
export function recoveryState(attempts: readonly RecoveryAttempt[], allowance: { maxAttempts: number }) {
  if (!Number.isInteger(allowance.maxAttempts) || allowance.maxAttempts < 1) fail('allowance');
  attempts.forEach((a, i) => {
    // A held attempt names at least one finding and an admitted one none; an unknown outcome carries what (if anything) was observed.
    const findingsMatch = a.outcome === 'unknown' || (a.outcome === 'held') === (a.findings.length > 0);
    if (a.attempt !== i + 1 || !HASH.test(a.candidateDigest) || !HASH.test(a.contextDigest) || !['admitted', 'held', 'unknown'].includes(a.outcome) ||
        !Array.isArray(a.findings) || new Set(a.findings.map(f => f.key)).size !== a.findings.length || !findingsMatch) fail('attempt_record');
  });
  if (new Set(attempts.map(a => a.candidateDigest)).size !== attempts.length) fail('duplicate_candidate');
  if (attempts.length > allowance.maxAttempts) fail('allowance_exceeded');
  let consecutiveFailures = 0;
  for (const a of attempts) consecutiveFailures = a.outcome === 'admitted' ? 0 : a.outcome === 'held' ? consecutiveFailures + 1 : consecutiveFailures;
  const last = attempts[attempts.length - 1];
  const mode: RecoveryMode = !last ? 'first_attempt' : last.outcome === 'unknown' ? 'stop_unknown_outcome' : last.outcome === 'admitted' ? 'admitted'
    : attempts.length >= allowance.maxAttempts ? 'stop_allowance_exhausted' : consecutiveFailures >= 2 ? 'diagnose_and_change_strategy' : 'targeted_correction';
  const trajectory = consecutiveFailures >= 2 ? findingTrajectory(attempts[attempts.length - 2].findings, last.findings) : null;
  return { version: STAGE_RECOVERY_VERSION, attempts: attempts.length, maxAttempts: allowance.maxAttempts, remaining: allowance.maxAttempts - attempts.length,
    consecutiveFailures, mode, trajectory, failedContexts: attempts.filter(a => a.outcome === 'held').map(a => a.contextDigest) };
}
export type RecoveryState = ReturnType<typeof recoveryState>;

/**
 * Before the next generation of the stage: it must be allowed (no unknown outcome, ceiling not reached, not already admitted), its context
 * may not repeat any failed attempt's, and after two consecutive failures it must carry a bound diagnosis.
 */
export function assertNextAttempt(state: RecoveryState, next: { contextDigest: string; diagnosisDigest: string | null }) {
  if (state.mode === 'stop_unknown_outcome' || state.mode === 'stop_allowance_exhausted' || state.mode === 'admitted') fail(state.mode);
  if (!HASH.test(next.contextDigest) || (next.diagnosisDigest !== null && !HASH.test(next.diagnosisDigest))) fail('next_attempt');
  if (state.failedContexts.includes(next.contextDigest)) fail('unchanged_strategy');
  if (state.mode === 'diagnose_and_change_strategy' && next.diagnosisDigest === null) fail('diagnosis_required');
  return true as const;
}
