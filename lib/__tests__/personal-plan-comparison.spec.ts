import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPlanComparison, planComparisonInstructions, type PlanComparisonPolicy } from '../../scripts/personal-plan-comparison';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { preparePersonalStory, RESILIENCE_INSTRUCTIONS } from '../personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';
import { causalDigest, CAUSAL_EXPERIMENT_VERSION, CAUSAL_PLAN_INSTRUCTIONS } from '../personal-wizard/story-causal-experiment';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import { CausalTransportError, type TransportReply } from '../../scripts/personal-causal-trial-adapters';
import { CausalHostError } from '../../scripts/personal-causal-trial-journal';
import type { CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';

const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) {
  if (!dir.startsWith(path.join(tmpdir(), 'plan-ab-test-'))) throw Error('unsafe test cleanup');
  rmSync(dir, { recursive: true, force: true });
} });
function output(call: CausalDispatch): any {
  const { brief } = JSON.parse(call.input), interest = brief.facts.find((f: any) => f.kind === 'interest').id;
  return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected',
    selection: fixtureAdventureSelection(brief.beats, interest), synopsis: 'Synthetic adventure with discovery and partnership, not literary evidence.',
    plan: { title: 'הרפתקה לבדיקה', childGoal: 'לגלות דבר חדש', companionWant: 'לנסות יחד', comicPromise: 'הפתעה מצחיקה',
      resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
      beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'משהו חדש קורה',
        childAction: 'מציעה דרך אחרת', companionAction: 'מנסה איתה', consequence: 'מגלים הפתעה חדשה', factIds: [interest], continuity: 'החפץ איתם' })),
      ending: 'ממשיכים לשחק יחד' } };
}
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'plan-ab-test-')); dirs.push(root);
  const request = causalTrialCohort()[0].request, prepared = preparePersonalStory(request, resolvePersonalWizardOptions());
  const policy: PlanComparisonPolicy = { version: 'four-plan-comparison/v1', sourceHead: 'a'.repeat(40), mode: 'offline_injected',
    executable: path.join(root, 'unused.exe'), executableSha256: 'b'.repeat(64),
    pricing: { source: 'https://platform.claude.com/docs/en/about-claude/pricing', checkedAt: new Date().toISOString(),
      inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 },
    approval: { reference: 'Synthetic offline approval, not live authority.', maximumMicroUsd: 8_000_000,
      requestId: prepared.accepted.requestId, requestDigest: causalDigest(prepared.accepted.canonical),
      optionsFingerprint: prepared.accepted.optionsFingerprint, consent: 'four_fresh_plans_opus_only', acknowledgesCliEstimateLimits: true } };
  const controller = new AbortController(), assertSource = vi.fn();
  const transport = vi.fn(async (_wire: any, call: CausalDispatch, _signal: AbortSignal): Promise<TransportReply> => ({ output: output(call),
    estimatedMicroUsd: 1 as number | null, usage: { inputTokens: 1, outputTokens: 1 }, metadata: { synthetic: true }, raw: { synthetic: true } }));
  const args = { workspace: root, outputRoot: path.join(root, 'output'), request, policy, signal: controller.signal,
    injected: { commonDir: root, assertSource, transport, instructions: { old: 'OLD SYNTHETIC', current: 'NEW SYNTHETIC' } } };
  return { root, args, policy, controller, transport, assertSource };
}
describe('four fresh plan-only comparison guard', () => {
  it('reserves four slots, identical inputs/settings, two per arm, and no fifth/replay dispatch', async () => {
    const h = setup(), trial = createPlanComparison(h.args);
    expect(h.transport).not.toHaveBeenCalled(); const plans = await trial.run();
    expect(plans.map(p => p.label)).toEqual([1, 2, 3, 4]); expect(h.transport).toHaveBeenCalledTimes(4);
    const calls = h.transport.mock.calls.map(([, call]) => call);
    expect(new Set(calls.map(c => c.input)).size).toBe(1);
    expect(calls.map(c => c.instructions).sort()).toEqual(['NEW SYNTHETIC', 'NEW SYNTHETIC', 'OLD SYNTHETIC', 'OLD SYNTHETIC']);
    expect(new Set(calls.map(c => c.conversationKey)).size).toBe(4);
    expect(calls.every(c => c.role === 'opus' && c.stage === 'plan' && c.maxOutputTokens === 18000 && JSON.parse(c.input).priorRejection === null)).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(h.root, 'output/manifest.json'), 'utf8'));
    expect(manifest.reservedMicroUsd).toBe(6_000_000); expect(manifest.slots.every((s: any) => s.capMicroUsd === 1_500_000)).toBe(true);
    expect(trial.snapshot().accounting).toMatchObject({ logicalAttempts: 4, knownEstimateMicroUsd: 4, unknownAttemptCosts: 0 });
    await expect(trial.run()).rejects.toMatchObject({ code: 'phase' });
    await expect(createPlanComparison(h.args).run()).rejects.toMatchObject({ code: 'output_exists' });
    const replay = { ...h.args, outputRoot: path.join(h.root, 'other-output') };
    await expect(createPlanComparison(replay).run()).rejects.toMatchObject({ code: 'family_consumed' });
    expect(h.transport).toHaveBeenCalledTimes(4);
  });
  it('uses exactly the historical two-clause delta with the real assembled planner', () => {
    const pair = planComparisonInstructions(process.cwd());
    expect(pair.current).toBe(CAUSAL_PLAN_INSTRUCTIONS);
    expect(pair.old.replace(': a boundary, requesting closeness/help, preparing for uncertainty or trying a different idea', '')
      .replace('End with a modest observable step, not a claim that fear vanished.', 'Do not claim that fear vanished.')).toBe(pair.current);
    expect(pair.current.split(RESILIENCE_INSTRUCTIONS)).toHaveLength(2);
  });
  it.each([null, -1, 0.5, 1_500_001, Number.NaN])('stops on cost %s after preserving the receipt', async cost => {
    const h = setup(); h.transport.mockImplementation(async (_wire, call) => ({ output: output(call), estimatedMicroUsd: cost,
      usage: { inputTokens: 1, outputTokens: 1 }, metadata: {}, raw: {} }));
    const trial = createPlanComparison(h.args); await expect(trial.run()).rejects.toMatchObject({ code: 'cost' });
    expect(h.transport).toHaveBeenCalledTimes(1); expect(trial.snapshot().phase).toBe('failed');
    expect(trial.snapshot().accounting.unknownAttemptCosts).toBe(cost !== null && Number.isSafeInteger(cost) && cost >= 0 ? 0 : 1);
    await expect(trial.run()).rejects.toMatchObject({ code: 'phase' });
  });
  it.each([0, 1_500_000])('admits exact cost boundary %s', async cost => {
    const h = setup(); h.transport.mockImplementation(async (_wire, call) => ({ output: output(call), estimatedMicroUsd: cost,
      usage: { inputTokens: 1, outputTokens: 1 }, metadata: {}, raw: {} }));
    const trial = createPlanComparison(h.args); await trial.run(); expect(trial.snapshot().accounting.knownEstimateMicroUsd).toBe(cost * 4);
  });
  it.each(['throw', 'receipt_error', 'schema', 'binding', 'held', 'both_rejected', 'source', 'cancel'])('terminates on %s without retry', async kind => {
    const h = setup(); h.transport.mockImplementation(async (_wire, call) => {
      if (kind === 'throw') throw Error('PRIVATE MUST NOT LEAK');
      if (kind === 'receipt_error') throw new CausalTransportError('cli_termination', { raw: {}, metadata: {}, usage: null, estimatedMicroUsd: 33 });
      const raw = output(call);
      if (kind === 'schema') delete raw.plan;
      if (kind === 'binding') raw.requestId = 'f'.repeat(64);
      if (kind === 'held') raw.selection.outlineChecks.curiosity_and_stakes.outcome = 'needs_work';
      if (kind === 'both_rejected') { raw.disposition = 'both_rejected'; raw.candidates = raw.selection.candidates;
        raw.contrast = raw.selection.contrast; raw.reason = 'Both synthetic adventures are weak.'; delete raw.plan; delete raw.selection; delete raw.synopsis; }
      if (kind === 'source') h.assertSource.mockImplementation(() => { throw new CausalHostError('source_changed'); });
      if (kind === 'cancel') h.controller.abort();
      return { output: raw, estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 }, metadata: {}, raw: {} };
    });
    const trial = createPlanComparison(h.args); await expect(trial.run()).rejects.toBeInstanceOf(CausalHostError);
    expect(h.transport).toHaveBeenCalledTimes(1); expect(trial.snapshot().phase).toBe('failed');
    expect(trial.snapshot().reason).not.toContain('PRIVATE');
    if (kind === 'receipt_error') expect(trial.snapshot().accounting.knownEstimateMicroUsd).toBe(33);
    if (kind === 'held' || kind === 'both_rejected') expect(existsSync(path.join(h.root, 'output/plan-1.json'))).toBe(true);
  });
  it.each(['requestId', 'requestDigest', 'optionsFingerprint'])('binds approval to %s before acquiring allowance', key => {
    const h = setup(); (h.policy.approval as any)[key] = 'f'.repeat(64);
    expect(() => createPlanComparison(h.args)).toThrow(); expect(h.transport).not.toHaveBeenCalled();
    expect(existsSync(path.join(h.root, 'output'))).toBe(false);
  });
  it.each(['budget', 'mode', 'key', 'stale', 'future', 'wire'])('rejects invalid %s before reservation', kind => {
    const h = setup();
    if (kind === 'budget') (h.policy.approval as any).maximumMicroUsd++;
    if (kind === 'mode' || kind === 'stale' || kind === 'future') h.policy.mode = 'live_explicit';
    if (kind === 'key') (h.policy as any).existingOpenAIKey = () => 'not_allowed';
    if (kind === 'stale') { h.args.injected = undefined as any; h.policy.pricing.checkedAt = '2000-01-01T00:00:00Z'; }
    if (kind === 'future') { h.args.injected = undefined as any; h.policy.pricing.checkedAt = '2099-01-01T00:00:00Z'; }
    if (kind === 'wire') h.args.injected.instructions.old = 'x'.repeat(104_001);
    expect(() => createPlanComparison(h.args)).toThrow(); expect(h.transport).not.toHaveBeenCalled();
    expect(existsSync(path.join(h.root, 'output'))).toBe(false);
  });
  it('pre-cancelled run acquires nothing', async () => {
    const h = setup(); h.controller.abort(); const trial = createPlanComparison(h.args);
    await expect(trial.run()).rejects.toMatchObject({ code: 'cancelled' });
    expect(h.transport).not.toHaveBeenCalled(); expect(existsSync(path.join(h.root, 'output'))).toBe(false);
  });
  it('source movement before run neither reserves nor dispatches', async () => {
    const h = setup(), trial = createPlanComparison(h.args);
    h.assertSource.mockImplementation(() => { throw new CausalHostError('source_changed'); });
    await expect(trial.run()).rejects.toMatchObject({ code: 'source_changed' });
    expect(h.transport).not.toHaveBeenCalled(); expect(existsSync(path.join(h.root, 'output'))).toBe(false);
  });
  it('a competing instance cannot acquire the same reference in another output root', async () => {
    const h = setup(), first = createPlanComparison(h.args), second = createPlanComparison({ ...h.args, outputRoot: path.join(h.root, 'second') });
    await first.run(); await expect(second.run()).rejects.toMatchObject({ code: 'family_consumed' });
    expect(h.transport).toHaveBeenCalledTimes(4);
  });
  it('saved plan corruption blocks the next dispatch', async () => {
    const h = setup(); let seen = 0;
    h.assertSource.mockImplementation(() => { const plan = path.join(h.root, 'output/plan-1.json');
      if (existsSync(plan) && seen++ === 0) writeFileSync(plan, '{}'); });
    const trial = createPlanComparison(h.args); await expect(trial.run()).rejects.toMatchObject({ code: 'record_changed' });
    expect(h.transport).toHaveBeenCalledTimes(1);
  });
  it('records claim and wire before the injected equivalent of spawn', async () => {
    const h = setup(); h.transport.mockImplementation(async (_wire, call) => {
      const [family, caseId] = call.conversationKey.split(':');
      const dir = path.join(h.root, 'codex-causal-text-trials', family);
      expect(existsSync(path.join(dir, `claim-${caseId}-plan.json`))).toBe(true);
      const dispatch = JSON.parse(readFileSync(path.join(dir, `dispatch-${caseId}-plan.json`), 'utf8'));
      expect(dispatch.wire.role).toBe('opus'); expect(dispatch.wire.stage).toBe('plan');
      expect(dispatch.wire.args[dispatch.wire.args.indexOf('--max-budget-usd') + 1]).toBe('1.5');
      expect(dispatch.wire.args[dispatch.wire.args.indexOf('--tools') + 1]).toBe('');
      return { output: output(call), estimatedMicroUsd: 1, usage: { inputTokens: 1, outputTokens: 1 }, metadata: {}, raw: {} };
    });
    await createPlanComparison(h.args).run(); expect(h.transport).toHaveBeenCalledTimes(4);
  });
});
