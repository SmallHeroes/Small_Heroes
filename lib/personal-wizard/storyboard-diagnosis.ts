import 'server-only';
import { previewSha } from '../local-story-preview';
import { canonicalJson } from './request-acceptance';
import { recoveryState, STAGE_RECOVERY_VERSION, type RecoveryAttempt } from './stage-recovery';
import type { StoryboardRepairFinding } from './storyboard-repair';

/**
 * Engine DIAGNOSIS of a storyboard stage after two consecutive held candidates (storyboard-diagnosis/v1). It is derived only from the bound
 * repair chain (each held candidate's draft, contract context and its own review's findings), never supplied, so it cannot be edited:
 * - what failed and where: each blocking finding of the latest candidate, by stable check key (the reviewer's own words are that review's
 *   findings, which travel with it as reviewFindings; the diagnosis references them by key instead of copying them);
 * - how it moved: identical finding, the same check failing again on what may be another detail (with the earlier review's words), new, or
 *   resolved (with the earlier words) (stage-recovery/v1);
 * - what the latest candidate changed on that page relative to the previous one (coarse sections, so a finding on an UNCHANGED part is
 *   visible as such: either earlier coverage missed it or the context changed; neither is assumed to be randomness);
 * - which pages were resolved and must be protected against regression, the cause classes the next plan must choose from, and the stage's
 *   remaining attempt allowance (STORYBOARD_MAX_ATTEMPTS: the next attempt may be the last).
 * The semantic cause, remedy and success check of each finding are the planner's, in its self-check resolutions, validated against this
 * record and against what the new candidate actually changed. Pure: no provider, no clock.
 */
export const STORYBOARD_DIAGNOSIS_VERSION = 'storyboard-diagnosis/v1' as const;
/** The storyboard stage's attempt ceiling under the recovery rule: the first plan and at most two re-plans. Pinned by the version. */
export const STORYBOARD_MAX_ATTEMPTS = 3;
/** The general failure classes a resolution names (not story facts): binding, instant choice, state/design, grounding, composition, canon. */
export const DIAGNOSIS_CAUSES = ['evidence_binding', 'instant_selection', 'state_design', 'grounding', 'composition', 'canon_conflict', 'not_a_defect'] as const;
export type ChainAttempt = { storyboardDigest: string; contextDigest: string; contracts: string[]; draft: unknown; findings: StoryboardRepairFinding[] };

const fail = (code: string): never => { throw Error(`personal_storyboard_diagnosis_${code}`); };
export const findingKey = (f: { scope: 'book' | 'page'; pageNumber?: number; category: string }) =>
  f.scope === 'book' ? `book:${f.category}` : `page:${f.pageNumber}:${f.category}`;

/**
 * A draft's coarse sections by canonical bytes: per frame its plan page, moments frame, continuity page and (body pages) sequence page, and
 * every other book-level field by name. The self-check uses the same sections to verify what a candidate actually changed.
 */
export function draftSections(raw: unknown): Record<string, string> {
  const d = raw as { plan: Record<string, unknown> & { pages: unknown[]; continuity?: Record<string, unknown> & { pages: unknown[] } };
    sequence: Record<string, unknown> & { pages: unknown[] }; moments?: Record<string, unknown> & { frames: unknown[] } };
  const out: Record<string, string> = {}, put = (k: string, v: unknown) => { out[k] = canonicalJson(v ?? null); };
  if (!d?.plan || !Array.isArray(d.plan.pages) || !d.sequence || !Array.isArray(d.sequence.pages)) return fail('draft_shape');
  d.plan.pages.forEach((p, n) => {
    put(`p${n}:plan`, p); put(`p${n}:moment`, d.moments?.frames[n]); put(`p${n}:continuity`, d.plan.continuity?.pages[n]);
    if (n >= 1) put(`p${n}:sequence`, d.sequence.pages[n - 1]);
  });
  for (const [k, v] of Object.entries(d.plan)) if (k !== 'pages' && k !== 'continuity') put(`book:plan.${k}`, v);
  for (const [k, v] of Object.entries(d.plan.continuity ?? {})) if (k !== 'pages') put(`book:continuity.${k}`, v);
  for (const [k, v] of Object.entries(d.sequence)) if (k !== 'pages') put(`book:sequence.${k}`, v);
  for (const [k, v] of Object.entries(d.moments ?? {})) if (k !== 'frames') put(`book:moments.${k}`, v);
  return out;
}
export const changedSections = (before: unknown, after: unknown) => {
  const a = draftSections(before), b = draftSections(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]).sort();
};

/** The stage-recovery attempts of a chain of held candidates (oldest first), each under its own context, with its review's findings. */
export const chainAttempts = (chain: readonly Pick<ChainAttempt, 'storyboardDigest' | 'contextDigest' | 'findings'>[]): RecoveryAttempt[] => chain.map((a, i) => ({ attempt: i + 1,
  candidateDigest: a.storyboardDigest, contextDigest: a.contextDigest, outcome: 'held',
  findings: a.findings.map(f => ({ key: findingKey(f), verdict: f.verdict, observation: f.observation })) }));

/**
 * The diagnosis of a chain of held candidates (oldest first); requires two consecutive failures and a remaining attempt (stage-recovery).
 * `maxAttempts` is the stage ceiling (an owner's bounded extension raises it by its own bound record; never lowered or reset).
 */
export function storyboardDiagnosis(chain: readonly ChainAttempt[], maxAttempts: number = STORYBOARD_MAX_ATTEMPTS) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < STORYBOARD_MAX_ATTEMPTS) fail('allowance_policy');
  const state = recoveryState(chainAttempts(chain), { maxAttempts });
  if (state.mode === 'stop_allowance_exhausted') return fail('allowance_exhausted');
  if (state.mode !== 'diagnose_and_change_strategy' || !state.trajectory) return fail('not_two_consecutive_failures');
  const [previous, latest] = chain.slice(-2), moved = changedSections(previous.draft, latest.draft);
  const trajectory = new Map(state.trajectory.map(t => [t.key, t.trajectory]));
  const earlier = new Map(previous.findings.map(f => [findingKey(f), f.observation]));
  const onPage = (f: StoryboardRepairFinding) => f.scope === 'page' ? moved.filter(s => s.startsWith(`p${f.pageNumber}:`)) : null;
  const findings = latest.findings.map(f => {
    const key = findingKey(f), moves = trajectory.get(key)!;
    return { key, trajectory: moves, ...(moves === 'repeated_check_new_detail' ? { previousObservation: earlier.get(key)! } : {}),
      changedInLatestAttempt: onPage(f) };
  });
  const latestKeys = new Set(findings.map(f => f.key));
  const resolved = previous.findings.filter(f => !latestKeys.has(findingKey(f)))
    .map(f => ({ key: findingKey(f), observation: f.observation, changedInLatestAttempt: onPage(f) }));
  const heldPages = new Set(latest.findings.flatMap(f => f.scope === 'page' ? [f.pageNumber] : []));
  const protectedPages = [...new Set(previous.findings.flatMap(f => f.scope === 'page' && !latestKeys.has(findingKey(f)) && !heldPages.has(f.pageNumber)
    ? [f.pageNumber] : []))].sort((a, b) => a - b);
  return { version: STORYBOARD_DIAGNOSIS_VERSION, recovery: STAGE_RECOVERY_VERSION, consecutiveFailures: state.consecutiveFailures,
    allowance: { nextAttempt: state.attempts + 1, maxAttempts: state.maxAttempts, remainingAfterNext: state.remaining - 1 },
    attempts: chain.map((a, i) => ({ attempt: i + 1, storyboardDigest: a.storyboardDigest, contextDigest: a.contextDigest, contracts: [...a.contracts],
      findings: a.findings.map(findingKey) })),
    findings, resolved, protectedPages, changedBetweenLastTwo: moved, causes: [...DIAGNOSIS_CAUSES] };
}
export type StoryboardDiagnosis = ReturnType<typeof storyboardDiagnosis>;
export const diagnosisDigest = (d: StoryboardDiagnosis) => previewSha(canonicalJson(d));
