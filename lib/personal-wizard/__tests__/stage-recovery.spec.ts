import { describe, expect, it } from 'vitest';
import { recoveryState, assertNextAttempt, findingTrajectory, STAGE_RECOVERY_VERSION, type RecoveryAttempt } from '../stage-recovery';

const h = (c: string) => c.repeat(64).slice(0, 64);
const held = (attempt: number, candidate: string, context: string, findings: [string, string][]): RecoveryAttempt =>
  ({ attempt, candidateDigest: h(candidate), contextDigest: h(context), outcome: 'held', findings: findings.map(([key, observation]) => ({ key, verdict: 'contradiction', observation })) });
const admitted = (attempt: number, candidate: string, context: string): RecoveryAttempt =>
  ({ attempt, candidateDigest: h(candidate), contextDigest: h(context), outcome: 'admitted', findings: [] });

describe('stage-recovery/v1: the reusable bounded recovery reducer (pure)', () => {
  it('first attempt, then ONE held candidate routes to a targeted correction; TWO consecutive held candidates require a diagnosis', () => {
    expect(recoveryState([], { maxAttempts: 3 })).toMatchObject({ version: STAGE_RECOVERY_VERSION, mode: 'first_attempt', consecutiveFailures: 0, remaining: 3, trajectory: null });
    const one = recoveryState([held(1, 'a', '1', [['book:fidelity', 'omits the causal action']])], { maxAttempts: 3 });
    expect(one).toMatchObject({ mode: 'targeted_correction', consecutiveFailures: 1, remaining: 2, trajectory: null });
    // A first correction carries no diagnosis; only its context must differ from the failed one.
    expect(assertNextAttempt(one, { contextDigest: h('2'), diagnosisDigest: null })).toBe(true);
    expect(() => assertNextAttempt(one, { contextDigest: h('1'), diagnosisDigest: null })).toThrow('stage_recovery_unchanged_strategy');
    const two = recoveryState([held(1, 'a', '1', [['book:fidelity', 'omits the causal action']]), held(2, 'b', '2', [['book:fidelity', 'omits it again'], ['page:3:set', 'route']])],
      { maxAttempts: 3 });
    expect(two).toMatchObject({ mode: 'diagnose_and_change_strategy', consecutiveFailures: 2, remaining: 1, failedContexts: [h('1'), h('2')] });
    expect(() => assertNextAttempt(two, { contextDigest: h('3'), diagnosisDigest: null })).toThrow('stage_recovery_diagnosis_required');
    // No identical-context retry of EITHER failed attempt, even with a diagnosis.
    expect(() => assertNextAttempt(two, { contextDigest: h('1'), diagnosisDigest: h('d') })).toThrow('stage_recovery_unchanged_strategy');
    expect(() => assertNextAttempt(two, { contextDigest: h('2'), diagnosisDigest: h('d') })).toThrow('stage_recovery_unchanged_strategy');
    expect(assertNextAttempt(two, { contextDigest: h('3'), diagnosisDigest: h('d') })).toBe(true);
  });

  it('only an admitted candidate resets the count; an unknown outcome stops; the ceiling stops; nothing raises the ceiling', () => {
    const reset = recoveryState([held(1, 'a', '1', [['k', 'x']]), admitted(2, 'b', '2'), held(3, 'c', '3', [['k', 'x']])], { maxAttempts: 4 });
    expect(reset).toMatchObject({ mode: 'targeted_correction', consecutiveFailures: 1 });
    const unknown: RecoveryAttempt = { attempt: 2, candidateDigest: h('b'), contextDigest: h('2'), outcome: 'unknown', findings: [] };
    const stopped = recoveryState([held(1, 'a', '1', [['k', 'x']]), unknown], { maxAttempts: 3 });
    expect(stopped.mode).toBe('stop_unknown_outcome');
    expect(() => assertNextAttempt(stopped, { contextDigest: h('3'), diagnosisDigest: h('d') })).toThrow('stage_recovery_stop_unknown_outcome');
    const full = recoveryState([held(1, 'a', '1', [['k', 'x']]), held(2, 'b', '2', [['k', 'y']]), held(3, 'c', '3', [['k', 'z']])], { maxAttempts: 3 });
    expect(full).toMatchObject({ mode: 'stop_allowance_exhausted', remaining: 0 });
    expect(() => assertNextAttempt(full, { contextDigest: h('4'), diagnosisDigest: h('d') })).toThrow('stage_recovery_stop_allowance_exhausted');
    expect(() => recoveryState([held(1, 'a', '1', [['k', 'x']]), held(2, 'b', '2', [['k', 'y']])], { maxAttempts: 1 })).toThrow('stage_recovery_allowance_exceeded');
    expect(recoveryState([admitted(1, 'a', '1')], { maxAttempts: 3 }).mode).toBe('admitted');
    expect(() => assertNextAttempt(recoveryState([admitted(1, 'a', '1')], { maxAttempts: 3 }), { contextDigest: h('2'), diagnosisDigest: null })).toThrow('stage_recovery_admitted');
  });

  it('records refuse: reordered, duplicated or malformed attempts; a held attempt without findings; an admitted one with findings', () => {
    const a = held(1, 'a', '1', [['k', 'x']]), b = held(2, 'b', '2', [['k', 'y']]);
    for (const bad of [[{ ...b, attempt: 1 }, a], [a, { ...b, candidateDigest: a.candidateDigest }], [{ ...a, findings: [] }], [{ ...admitted(1, 'a', '1'), findings: a.findings }],
      [{ ...a, contextDigest: 'not-a-hash' }], [{ ...a, findings: [...a.findings, ...a.findings] }], [{ ...a, outcome: 'failed' as never }]])
      expect(() => recoveryState(bad as RecoveryAttempt[], { maxAttempts: 3 })).toThrow(/stage_recovery_(attempt_record|duplicate_candidate)/);
    expect(() => recoveryState([], { maxAttempts: 0 })).toThrow('stage_recovery_allowance');
  });

  it('trajectory compares keys AND the reviewer\'s words: identical, repeated with a new detail, new, resolved (a category name alone is not a cause)', () => {
    expect(findingTrajectory([{ key: 'p:1', verdict: 'contradiction', observation: 'x' }, { key: 'p:2', verdict: 'uncertain', observation: 'y' }, { key: 'p:3', verdict: 'contradiction', observation: 'z' }],
      [{ key: 'p:1', verdict: 'contradiction', observation: 'x' }, { key: 'p:2', verdict: 'uncertain', observation: 'other words' }, { key: 'p:4', verdict: 'contradiction', observation: 'w' }]))
      .toEqual([{ key: 'p:1', trajectory: 'identical_finding' }, { key: 'p:2', trajectory: 'repeated_check_new_detail' }, { key: 'p:4', trajectory: 'new' },
        { key: 'p:3', trajectory: 'resolved' }]);
  });
});
