import { afterEach, describe, expect, it, vi } from 'vitest';
import { causalTrialCohort } from '../../../scripts/personal-causal-cohort';
import { companionTrialCohort } from '../../../scripts/personal-book-companion-cohort';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { fixtureEditorOutput } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStory, STORY_INSTRUCTIONS, NARRATIVE_CRAFT_INSTRUCTIONS, ADVENTURE_SELECTION_INSTRUCTIONS, CANDIDATE_PERSONAL_FACT_INSTRUCTIONS } from '../story-writer';
import { STORY_EDITOR_INSTRUCTIONS } from '../story-editor';
import { canonicalJson } from '../request-acceptance';
import { createCausalExperiment, causalStages, type CausalReviewMode, type CausalStage, type CausalDispatch, type CausalExperimentPorts } from '../story-causal-experiment-runner';
import { CAUSAL_EXPERIMENT_VERSION, CAUSAL_STORY_INSTRUCTIONS, CAUSAL_PLAN_INSTRUCTIONS, causalDigest, compileCausalPlan, compileCausalOriginal,
  causalEditorCall, causalEditorSchema, compileCausalEdit, causalReviewPackets, causalOriginalReviewPacket,
  compileCausalReading, causalDraftCritiqueContext, DRAFT_CRITIQUE_MAX_BYTES, causalSourceReviewPacket,
  compileCausalSourceReading, CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS, CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS, causalArchivalDraftCritiqueContext } from '../story-causal-experiment';
import { citationTokens } from '../story-source-citations';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const options = resolvePersonalWizardOptions();
function planned(brief: ReturnType<typeof preparePersonalStory>['brief'], rejected = false): any {
  const interest = brief.facts.find(f => f.kind === 'interest')!.id;
  const selection = fixtureAdventureSelection(brief.beats, interest);
  if (rejected) return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'both_rejected',
    candidates: selection.candidates, contrast: selection.contrast, reason: 'Both ideas lack a compelling child-led discovery.' };
  return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected', selection,
    synopsis: 'Synthetic continuous adventure through discovery and consequential partnership to a prepared payoff. Not literary proof.',
    plan: { title: 'ההרפתקה החדשה', childGoal: 'למצוא דרך מעניינת', companionWant: 'לנסות וגם לעזור', comicPromise: 'הרעיון מסתבך באופן מצחיק',
      resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
      beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'הגילוי משנה את הדרך', childAction: 'מציעה דרך אחרת',
        companionAction: 'מקשיב ומנסה', consequence: 'מגלים משהו חדש', factIds: [interest], continuity: 'החפץ בידי הילדה' })), ending: 'מוצאים יחד דרך חדשה' } };
}
function author(input: any) {
  return { requestId: input.brief.requestId, planDigest: input.planDigest, title: 'ההרפתקה החדשה',
    pages: Array.from({ length: input.brief.beats }, (_, i) => ({ text: `${input.brief.child.name} מציעה דרך חדשה והחבר מנסה איתה. הם מגלים משהו מצחיק ומשנים את התוכנית. פרט מקורי ${i + 1}` })) };
}
function edited(call: CausalDispatch): any {
  const revision = fixtureEditorOutput({ stage: 'editor', instructions: call.instructions, input: call.input, maxOutputTokens: call.maxOutputTokens });
  const feedback = JSON.parse(call.input).draftCritique;
  return { version: CAUSAL_EXPERIMENT_VERSION,
    ...(feedback ? { draftCritiqueResponse: { projectionDigest: feedback.projectionDigest,
      responses: feedback.findings.map((f: any) => ({ findingId: f.id, decision: 'kept', reason: 'Synthetic reason grounded in the unchanged test passage.' })) } } : {}),
    revision: { ...revision,
    plan: { ...revision.plan, beats: revision.plan.beats.map(({ pageNumber: _n, ...beat }) => beat) },
    manuscript: { ...revision.manuscript, pages: revision.manuscript.pages.map(({ pageNumber: _n, ...page }) => page) } } };
}
function defaultOutput(call: CausalDispatch): unknown {
  const input = JSON.parse(call.input);
  if (call.stage === 'plan' || call.stage === 'replan') return planned(input.brief);
  if (call.stage === 'author') return author(input);
  if (call.stage === 'editor') return edited(call);
  return { packetDigest: input.packetDigest, summary: 'Synthetic critic reading, not product or literary approval.', findings: [] };
}
function harness(count = 1, change?: (call: CausalDispatch) => unknown | Promise<unknown>, controller = new AbortController(), reviewMode: CausalReviewMode = 'normal', synopsisRepair = false, draftCritique = false) {
  const cases = causalTrialCohort().slice(0, count);
  const ports: CausalExperimentPorts = { reserve: vi.fn(async () => true), claim: vi.fn(async () => true),
    generate: vi.fn(async call => ({ output: change ? await change(call) : defaultOutput(call), estimatedMicroUsd: 1 })),
    recordSynopsisRepair: vi.fn(async () => {}),
    canFitCritiqueEditor: vi.fn(() => true), recordDraftCritique: vi.fn(async () => {}) };
  const args = { family: 'synthetic-causal-offline', cases, options, reviewMode,
    ...(synopsisRepair ? { synopsisRepair: true as const } : {}),
    ...(draftCritique ? { draftCritique: true as const } : {}),
    capsMicroUsd: Object.fromEntries(causalStages(reviewMode).map(s => [s, 10])) as Partial<Record<CausalStage, number>>,
    maximumMicroUsd: count * causalStages(reviewMode).length * 10, ports, signal: controller.signal };
  const runner = createCausalExperiment(args);
  const approve = () => { const bundle = runner.readSynopses(); runner.reviewSynopses({ sourceDigest: bundle.sourceDigest,
    decisions: bundle.plans.map(p => ({ caseId: p.caseId, decision: 'write', reason: 'Synthetic test review only, not a quality verdict.' })) }); };
  return { args, ports, runner, approve, controller };
}
function selectedFixture(index = 0) {
  const p = preparePersonalStory(causalTrialCohort()[index].request, options), raw = planned(p.brief);
  const plan = compileCausalPlan(p, raw);
  if (!('planningDigest' in plan)) throw Error('fixture');
  const original = compileCausalOriginal(p, plan, author({ brief: p.brief, planDigest: plan.planDigest }));
  const call = causalEditorCall(p, original);
  const output = edited({ ...call, role: 'opus', conversationKey: 'fixture', stage: 'editor', schema: null as any });
  return { p, raw, plan, original, call, output };
}

describe('limited causal experiment, not live provider or quality certification', () => {
  it('child-native register reaches every actual diagnostic stage without altering public guidance', async () => {
    const h = harness(1, undefined, new AbortController(), 'benchmark', false, true);
    await h.runner.plan(); h.approve(); await h.runner.write();
    const calls = vi.mocked(h.ports.generate).mock.calls.map(([call]) => call);
    expect(calls.map(call => call.stage)).toEqual(['plan', 'author', 'original_review', 'editor', 'final_review', 'comparison']);
    for (const call of calls) {
      const reader = ['original_review', 'final_review', 'comparison'].includes(call.stage);
      const own = reader ? CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS : CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS;
      const other = reader ? CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS : CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS;
      expect(call.instructions.split(own)).toHaveLength(2);
      expect(call.instructions).not.toContain(other);
    }
    expect(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS).toContain('Do not use rare, technical, archaic or ornate vocabulary');
    expect(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS).toContain('same word or Hebrew root');
    expect(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS).toContain('preserve its function, not the rare word');
    expect(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS).toContain('purposeful comic refrains in familiar wording');
    expect(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS).toContain('not lines to copy verbatim');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).toContain('Assess whether');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).toContain('Do not rewrite passages');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).toContain('same word or Hebrew root');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).toContain('purposeful comic refrains in familiar wording');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).not.toContain('Use familiar');
    expect(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS).not.toContain('replace it consistently');
    for (const text of [STORY_INSTRUCTIONS, NARRATIVE_CRAFT_INSTRUCTIONS, STORY_EDITOR_INSTRUCTIONS]) {
      expect(text).not.toContain(CAUSAL_CHILD_LANGUAGE_INSTRUCTIONS);
      expect(text).not.toContain(CAUSAL_CHILD_LANGUAGE_REVIEW_INSTRUCTIONS);
    }
    const book = (await Promise.resolve(h.runner.snapshot())).draftCritiques![0];
    expect(book.context.projection.findings).toEqual([]);
  });
  function repairRequest(h: ReturnType<typeof harness>) {
    const b = h.runner.readSynopses(), attempts = b.plans[0].attempts, chosen = attempts[attempts.length - 1];
    if (!('planningDigest' in chosen)) throw Error('selected fixture required');
    return { review: { sourceDigest: b.sourceDigest, decisions: [{ caseId: 'case1', decision: 'hold' as const,
      reason: 'SUGGESTED_SOLUTION_MUST_NOT_REACH_PLANNER in the full retained review.' }] },
      caseId: 'case1', planningDigest: chosen.planningDigest,
      defects: ['The decisive observation does not distinguish the two available choices.'] };
  }
  it('external repair is disabled by default and enabled cohorts are refused before reserve', async () => {
    const h = harness(); await h.runner.plan();
    expect(h.runner.snapshot().manifest).not.toHaveProperty('synopsisRepair');
    expect(h.runner.snapshot()).not.toHaveProperty('repairReviews');
    await expect(h.runner.repair(repairRequest(h))).rejects.toThrow('repair_policy');
    expect(h.ports.generate).toHaveBeenCalledTimes(1); expect(h.ports.recordSynopsisRepair).not.toHaveBeenCalled();
    const multi = harness(2);
    expect(() => createCausalExperiment({ ...multi.args, synopsisRepair: true })).toThrow('repair_policy');
    expect(multi.ports.reserve).not.toHaveBeenCalled();
    expect(() => createCausalExperiment({ ...multi.args, cases: multi.args.cases.slice(0, 1), synopsisRepair: true,
      ports: { ...multi.ports, recordSynopsisRepair: undefined } })).toThrow('repair_policy');
  });
  it('disabled repair cannot alter a concurrently planning legacy run', async () => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const h = harness(1, async call => { await gate; return defaultOutput(call); });
    const pending = h.runner.plan(); await vi.waitFor(() => expect(h.ports.generate).toHaveBeenCalledOnce());
    const before = h.runner.snapshot(); await expect(h.runner.repair({})).rejects.toThrow('repair_policy');
    expect(h.runner.snapshot()).toEqual(before); release(); await pending;
    expect(h.runner.snapshot().phase).toBe('planned'); h.approve(); expect((await h.runner.write()).books).toHaveLength(1);
    expect(h.ports.recordSynopsisRepair).not.toHaveBeenCalled();
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'author', 'editor', 'final_review', 'comparison']);
  });
  it('repairs once with defects only, keeps both attempts, and authors only the freshly reviewed plan', async () => {
    const h = harness(1, call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'replan') { out.plan.ending = 'סיום מתוקן ומוכן מתוך הפעולות הקודמות'; out.synopsis += ' Repaired causal link.'; }
      return out;
    }, new AbortController(), 'normal', true);
    const first = await h.runner.plan(), request = repairRequest(h);
    const repaired = await h.runner.repair(request);
    expect(repaired.sourceDigest).not.toBe(first.sourceDigest);
    expect(repaired.plans[0].attempts).toHaveLength(2);
    expect(repaired.plans[0].attempts[0]).toEqual(first.plans[0].attempts[0]);
    expect(h.ports.recordSynopsisRepair).toHaveBeenCalledWith(request);
    const call = vi.mocked(h.ports.generate).mock.calls[1][0], input = JSON.parse(call.input);
    expect(call.stage).toBe('replan'); expect(Object.keys(input).sort()).toEqual(['brief', 'defects', 'priorPlan']);
    expect(input.defects).toEqual(request.defects); expect(input.priorPlan).toEqual(first.plans[0].attempts[0]);
    expect(call.input).not.toContain('SUGGESTED_SOLUTION_MUST_NOT_REACH_PLANNER');
    expect(call.instructions).toContain('explicitly requested repair');
    expect(vi.mocked(h.ports.recordSynopsisRepair!).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(h.ports.claim).mock.invocationCallOrder[1]);
    expect(() => h.runner.reviewSynopses({ ...request.review, decisions: [{ ...request.review.decisions[0], decision: 'write' }] })).toThrow('cohort_binding');
    await expect(h.runner.write()).rejects.toThrow('phase');
    expect(h.ports.generate).toHaveBeenCalledTimes(2);
    h.approve(); const result = await h.runner.write();
    expect(result.books).toHaveLength(1);
    const author = vi.mocked(h.ports.generate).mock.calls.find(([c]) => c.stage === 'author')![0];
    expect(JSON.parse(author.input).planDigest).toBe((repaired.plans[0].attempts[1] as any).planDigest);
  });
  it('captures opt-in and recording function at construction, and caller mutations cannot broaden it', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true);
    await h.runner.plan(); const request = repairRequest(h), recorded = h.ports.recordSynopsisRepair;
    delete h.args.synopsisRepair; h.ports.recordSynopsisRepair = undefined;
    await h.runner.repair(request); expect(recorded).toHaveBeenCalledOnce();
    expect(h.runner.snapshot().manifest.synopsisRepair).toBe(true);
  });
  it.each(['case', 'plan', 'source', 'write', 'extra', 'empty', 'oversize'] as const)('rejects %s repair request before recording, claim or transport', async kind => {
    const h = harness(1, undefined, new AbortController(), 'normal', true); await h.runner.plan();
    const request: any = repairRequest(h);
    if (kind === 'case') request.caseId = 'case2';
    if (kind === 'plan') request.planningDigest = 'a'.repeat(64);
    if (kind === 'source') request.review.sourceDigest = 'a'.repeat(64);
    if (kind === 'write') request.review.decisions[0].decision = 'write';
    if (kind === 'extra') request.solutions = ['A prescribed plot fix'];
    if (kind === 'empty') request.defects = [];
    if (kind === 'oversize') request.defects = ['x'.repeat(1100), 'y'.repeat(901)];
    await expect(h.runner.repair(request)).rejects.toThrow(/repair_binding|repair_request|cohort_binding/);
    expect(h.ports.recordSynopsisRepair).not.toHaveBeenCalled(); expect(h.ports.claim).toHaveBeenCalledTimes(1);
    expect(h.ports.generate).toHaveBeenCalledTimes(1); expect(h.runner.snapshot().phase).toBe('failed');
  });
  it.each(['selected', 'outline_held', 'both_rejected'] as const)('a repaired %s outcome is retained and a second HOLD cannot replan again', async outcome => {
    const h = harness(1, call => {
      const out: any = call.stage === 'replan' && outcome === 'both_rejected' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call);
      if (call.stage === 'replan' && outcome === 'outline_held') out.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
      return out;
    }, new AbortController(), 'normal', true);
    await h.runner.plan(); const request = repairRequest(h), next = await h.runner.repair(request);
    expect(next.plans[0].attempts[1].disposition).toBe(outcome);
    if (outcome !== 'selected') expect(() => h.runner.reviewSynopses({ sourceDigest: next.sourceDigest,
      decisions: [{ caseId: 'case1', decision: 'write', reason: 'Synthetic attempted author admission, not product acceptance.' }] })).toThrow('cohort_binding');
    h.runner.reviewSynopses({ sourceDigest: next.sourceDigest, decisions: [{ caseId: 'case1', decision: 'hold', reason: 'Synthetic second full review still holds the adventure.' }] });
    expect((await h.runner.write()).books).toHaveLength(0);
    await expect(h.runner.repair(request)).rejects.toThrow('repair_policy');
    expect(h.ports.generate).toHaveBeenCalledTimes(2);
  });
  it('a planner replan already consumed after both_rejected cannot be reused externally', async () => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call), new AbortController(), 'normal', true);
    await h.runner.plan(); await expect(h.runner.repair(repairRequest(h))).rejects.toThrow('repair_binding');
    expect(h.ports.generate).toHaveBeenCalledTimes(2); expect(h.ports.recordSynopsisRepair).not.toHaveBeenCalled();
  });
  it('an initially outline-held plan can use the same one repair and still needs fresh WRITE', async () => {
    const h = harness(1, call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'plan') out.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
      return out;
    }, new AbortController(), 'normal', true);
    const first = await h.runner.plan(); expect(first.plans[0].attempts[0].disposition).toBe('outline_held');
    const repaired = await h.runner.repair(repairRequest(h));
    expect(repaired.plans[0].attempts[1].disposition).toBe('selected');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan']);
    await expect(h.runner.write()).rejects.toThrow('phase'); h.approve();
    expect((await h.runner.write()).books).toHaveLength(1);
  });
  it('a second repair in the new planned phase cannot acquire the same slot again', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true); await h.runner.plan();
    await h.runner.repair(repairRequest(h));
    await expect(h.runner.repair(repairRequest(h))).rejects.toThrow('repair_binding');
    expect(h.ports.claim).toHaveBeenCalledTimes(2); expect(h.ports.recordSynopsisRepair).toHaveBeenCalledOnce();
    expect(h.runner.snapshot().phase).toBe('failed');
  });
  it('failure to preserve the critique prevents claiming or dispatching repair', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true); await h.runner.plan();
    vi.mocked(h.ports.recordSynopsisRepair!).mockRejectedValueOnce(Error('synthetic journal failure'));
    await expect(h.runner.repair(repairRequest(h))).rejects.toThrow('provider_or_contract_failed');
    expect(h.ports.claim).toHaveBeenCalledTimes(1); expect(h.ports.generate).toHaveBeenCalledTimes(1);
    expect(h.runner.snapshot().phase).toBe('failed');
  });
  it.each(['record', 'claim', 'generate'] as const)('a duplicate during %s cannot revive a terminal repair at an await boundary', async boundary => {
    const h = harness(1, undefined, new AbortController(), 'normal', true); await h.runner.plan();
    const req = repairRequest(h); let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    if (boundary === 'record') vi.mocked(h.ports.recordSynopsisRepair!).mockImplementationOnce(() => gate);
    if (boundary === 'claim') vi.mocked(h.ports.claim).mockImplementationOnce(async () => { await gate; return true; });
    if (boundary === 'generate') vi.mocked(h.ports.generate).mockImplementationOnce(async call => {
      await gate; return { output: defaultOutput(call), estimatedMicroUsd: 1 };
    });
    const pending = h.runner.repair(req);
    const observed = pending.then(() => 'unexpected success', error => error.message);
    await vi.waitFor(() => boundary === 'record' ? expect(h.ports.recordSynopsisRepair).toHaveBeenCalledOnce()
      : boundary === 'claim' ? expect(h.ports.claim).toHaveBeenCalledTimes(2) : expect(h.ports.generate).toHaveBeenCalledTimes(2));
    await expect(h.runner.repair(req)).rejects.toThrow('repair_policy');
    expect(h.runner.snapshot().phase).toBe('failed'); release(); expect(await observed).toMatch(/phase|repair_policy/);
    expect(h.runner.snapshot().phase).toBe('failed'); expect(h.runner.snapshot().plans[0].attempts).toHaveLength(1);
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(boundary === 'generate' ? ['plan', 'replan'] : ['plan']);
    await expect(h.runner.write()).rejects.toThrow('phase');
  });
  it('a repair deadline is terminal and a late successful reply cannot revive it', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true); await h.runner.plan();
    vi.useFakeTimers(); let release!: (value: { output: unknown; estimatedMicroUsd: number }) => void;
    vi.mocked(h.ports.generate).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = h.runner.repair(repairRequest(h)), observed = pending.then(() => 'unexpected success', error => error.message);
    await vi.advanceTimersByTimeAsync(1_200_000); expect(await observed).toContain('timeout');
    expect(h.runner.snapshot().phase).toBe('failed');
    release({ output: defaultOutput(vi.mocked(h.ports.generate).mock.calls[1][0]), estimatedMicroUsd: 1 });
    await Promise.resolve(); expect(h.runner.snapshot().phase).toBe('failed'); expect(h.runner.snapshot().plans[0].attempts).toHaveLength(1);
  });
  it.each(['malformed', 'transport', 'unknown', 'overrun', 'cancel'] as const)('repair %s failure is terminal and never dispatches author', async kind => {
    const h = harness(1, call => {
      if (call.stage === 'replan' && kind === 'transport') throw Error('private transport detail');
      if (call.stage === 'replan' && kind === 'malformed') return {};
      if (call.stage === 'replan' && kind === 'cancel') h.controller.abort();
      return defaultOutput(call);
    }, new AbortController(), 'normal', true);
    await h.runner.plan(); const req = repairRequest(h);
    if (kind === 'unknown' || kind === 'overrun') vi.mocked(h.ports.generate).mockImplementationOnce(async c => ({ output: defaultOutput(c), estimatedMicroUsd: kind === 'unknown' ? null : 11 }));
    await expect(h.runner.repair(req)).rejects.toThrow();
    expect(h.runner.snapshot().phase).toBe('failed');
    await expect(h.runner.repair(req)).rejects.toThrow();
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan']);
  });
  it.each(['plan', 'replan'] as const)('actual %s instructions retain factual contracts and causal questions without self-citation ledgers', async stage => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call));
    await h.runner.plan();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    expect(CANDIDATE_PERSONAL_FACT_INSTRUCTIONS).toBe('Use at least one approved interest per candidate; do not invent biography or force every supplied fact.');
    expect(ADVENTURE_SELECTION_INSTRUCTIONS).toContain(CANDIDATE_PERSONAL_FACT_INSTRUCTIONS);
    expect(call.instructions).toContain(CANDIDATE_PERSONAL_FACT_INSTRUCTIONS);
    expect(call.instructions).toContain('BOTH A and B, including the unselected candidate and both_rejected responses');
    expect(call.instructions).toContain('only IDs from brief.facts, with no duplicate IDs within a candidate; A and B may share an interest');
    expect(call.instructions).toContain('an approved fact with kind "interest"');
    expect(call.instructions).toContain('every factId in the selected candidate\'s personalFactUses must occur in at least one plan beat\'s factIds');
    expect(call.instructions).toContain('at least one approved interest must influence an action');
    expect(call.instructions).toContain('Keep plan.resilience.mode equal to brief.resilienceMode');
    expect(call.instructions).toContain('positions 1 through brief.beats, with no duplicate positions within each list');
    expect(call.instructions).toContain('earned_payoff check must include the final spread (brief.beats) in evidenceSpreads');
    expect(call.instructions).toContain('Work backwards from the climax');
    expect(call.instructions).toContain('Resolve missing causal links in the synopsis and beats');
    expect(call.instructions).not.toContain('backwardDependencies');
    expect(call.instructions).not.toContain('No replanning/retry loop is available');
    expect(call.instructions).not.toContain('a failed attempt with consequences and ');
  });
  it.each([false, true])('requires an interest independently in each candidate, both_rejected=%s', rejected => {
    const p = preparePersonalStory(causalTrialCohort()[0].request, options);
    for (const index of [0, 1]) {
      const raw = planned(p.brief, rejected), pair = rejected ? raw : raw.selection;
      pair.candidates[index].personalFactUses[0].factId = p.brief.facts.find(f => f.kind === 'other')!.id;
      expect(() => compileCausalPlan(p, raw), `candidate ${index}`).toThrow('story_selection_personal_fact_missing');
    }
    expect(compileCausalPlan(p, planned(p.brief, rejected)).disposition).toBe(rejected ? 'both_rejected' : 'selected');
  });
  it.each([false, true])('a sparse one-interest brief may use the same ID in both candidates, both_rejected=%s', rejected => {
    const p = preparePersonalStory(causalTrialCohort()[3].request, options), raw = planned(p.brief, rejected);
    expect(p.brief.facts).toHaveLength(1);
    const pair = rejected ? raw : raw.selection;
    expect(pair.candidates[0].personalFactUses[0].factId).toBe(pair.candidates[1].personalFactUses[0].factId);
    expect(compileCausalPlan(p, raw).disposition).toBe(rejected ? 'both_rejected' : 'selected');
  });
  it.each(['selected_fact', 'final_spread', 'moment_range', 'moment_duplicate'] as const)('selected-plan %s binding rejects its precise violation and accepts its repair', kind => {
    const p = preparePersonalStory(causalTrialCohort()[0].request, options), raw = planned(p.brief);
    expect(compileCausalPlan(p, raw).disposition).toBe('selected');
    if (kind === 'selected_fact') {
      const habit = p.brief.facts.find(f => f.kind === 'other')!.id;
      raw.selection.candidates[0].personalFactUses.push({ factId: habit, contribution: 'A small approved habit contributes to the adventure.' });
      expect(() => compileCausalPlan(p, raw)).toThrow('story_selection_plan_fact_missing');
      raw.plan.beats[1].factIds.push(habit);
    } else if (kind === 'final_spread') {
      raw.selection.outlineChecks.earned_payoff.evidenceSpreads = [1];
      expect(() => compileCausalPlan(p, raw)).toThrow('story_selection_outline_binding');
      raw.selection.outlineChecks.earned_payoff.evidenceSpreads = [p.brief.beats];
    } else if (kind === 'moment_range') {
      raw.plan.resilience.moments[0].pageNumber = p.brief.beats + 1;
      expect(() => compileCausalPlan(p, raw)).toThrow('plan_binding');
      raw.plan.resilience.moments[0].pageNumber = 2;
    } else {
      raw.plan.resilience.moments.push(structuredClone(raw.plan.resilience.moments[0]));
      expect(() => compileCausalPlan(p, raw)).toThrow('plan_binding');
      raw.plan.resilience.moments.pop();
    }
    expect(compileCausalPlan(p, raw).disposition).toBe('selected');
  });
  it.each([[0, 'chosen_topic'], [3, 'adventure_only']] as const)('causal plan preserves the approved resilience mode %s/%s', (index, mode) => {
    const p = preparePersonalStory(causalTrialCohort()[index].request, options), raw = planned(p.brief);
    expect(p.brief.resilienceMode).toBe(mode);
    const accepted = compileCausalPlan(p, raw);
    expect(accepted.disposition).toBe('selected');
    raw.plan.resilience.mode = mode === 'chosen_topic' ? 'adventure_only' : 'chosen_topic';
    expect(() => compileCausalPlan(p, raw)).toThrow('causal_experiment_plan_binding');
    raw.plan.resilience.mode = mode;
    expect(compileCausalPlan(p, raw)).toEqual(accepted);
  });
  it.each(['selected', 'both_rejected'] as const)('unselected B without an interest stops %s after exactly one real dispatch', async disposition => {
    const h = harness(1, call => {
      const brief = JSON.parse(call.input).brief, raw = planned(brief, disposition === 'both_rejected');
      const pair = disposition === 'both_rejected' ? raw : raw.selection;
      pair.candidates[1].personalFactUses[0].factId = brief.facts.find((f: any) => f.kind === 'other').id;
      return raw;
    });
    await expect(h.runner.plan()).rejects.toThrow('story_selection_personal_fact_missing');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([call]) => call.stage)).toEqual(['plan']);
    expect(vi.mocked(h.ports.claim).mock.calls.map(call => call[2])).toEqual(['case1:plan']);
    expect(h.runner.snapshot().phase).toBe('failed');
  });
  it.each(['old_version', 'removed_ledger'])('%s plan output is rejected at the explicit diagnostic boundary', async kind => {
    const h = harness(1, call => {
      const raw = planned(JSON.parse(call.input).brief);
      if (kind === 'old_version') raw.version = 'personal-causal-experiment/diagnostic-v1';
      else raw.backwardDependencies = {};
      return raw;
    });
    await expect(h.runner.plan()).rejects.toThrow('plan_schema');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([call]) => call.stage)).toEqual(['plan']);
    expect(h.runner.snapshot().phase).toBe('failed');
  });
  it('relaxes only the inherited mandatory failed attempt in all experimental stages, not the current runtime', async () => {
    const clause = 'a failed attempt with consequences and ';
    expect(STORY_INSTRUCTIONS).toContain(clause);
    expect(CAUSAL_STORY_INSTRUCTIONS.startsWith(STORY_INSTRUCTIONS.replace(clause, ''))).toBe(true);
    expect(CAUSAL_PLAN_INSTRUCTIONS).not.toContain(clause);
    const f = selectedFixture(); expect(f.call.instructions).not.toContain(clause);
    const h = harness(); await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.find(([c]) => c.stage === 'author')![0];
    expect(call.instructions).not.toContain(clause); expect(call.instructions).toContain('A failed attempt is optional');
  });
  it('actual editor dispatch states retained-interest binding and per-version literal evidence', async () => {
    const h = harness(); await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === 'editor')!;
    expect(call.instructions).toContain('All revised plan beat factIds must come from brief.facts');
    expect(call.instructions).toContain('at least one approved fact of kind interest must remain used in the revised beats');
    expect(call.instructions).toContain('contiguous verbatim substrings copied from the cited version\'s actual page text');
    expect(call.instructions).toContain('Diagnose before revising');
    expect(call.instructions).toContain('semanticAudit.original uses original pages');
    expect(call.instructions).toContain('semanticAudit.revised uses revised pages');
  });
  it.each(['plan', 'replan'] as const)('actual %s balances reader experience with topic fit and narrative scope', async stage => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call));
    await h.runner.plan();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    expect(call.instructions).toContain("Choose the reader's experience alongside emotional fit");
    expect(call.instructions).toContain('Use the existing curiosity_and_stakes check for development across the whole outline');
    expect(call.instructions).toContain('Do not choose an idea solely because a magical rule forces the selected coping skill');
    expect(call.instructions).toContain('Keep the chosen topic consequential');
    expect(call.instructions).toContain('If BOTH ideas are weak, return both_rejected');
    expect(call.instructions).toContain('Allocate narrative space for brief.child.age and brief.beats, not only word length');
    expect(call.instructions).toContain('There is no fixed count of rules, characters, places or action beats');
    expect(call.instructions).toContain('adventure_only must remain a full adventure without inventing a real difficulty');
    expect(JSON.parse(call.input).brief.resilienceMode).toBe('chosen_topic');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan']);
  });
  it('external synopsis repair delivers reader-experience guidance without proposed reviewer solutions', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true);
    await h.runner.plan(); await h.runner.repair(repairRequest(h));
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === 'replan')!;
    expect(call.instructions).toContain("Choose the reader's experience alongside emotional fit");
    expect(call.instructions).toContain('Allocate narrative space for brief.child.age and brief.beats, not only word length');
    expect(call.instructions).toContain('Develop the adventure as a changing journey');
    expect(call.instructions).toContain('This is an explicitly requested repair of the held priorPlan');
    expect(call.input).not.toContain('SUGGESTED_SOLUTION_MUST_NOT_REACH_PLANNER');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan']);
  });
  it.each([[3, 'short', 8], [5, 'medium', 12], [8, 'long', 16]] as const)('author enacts promises for age%s at %s length', async (age, length, spreads) => {
    const h = harness(); h.args.cases[0].request.child.age = age;
    h.args.cases[0].request.bookOptions.lengthId = length;
    const runner = createCausalExperiment(h.args), b = await runner.plan();
    runner.reviewSynopses({ sourceDigest: b.sourceDigest, decisions: [{ caseId: 'case1', decision: 'write', reason: 'Synthetic test only, not a literary approval.' }] });
    const result = await runner.write(), calls = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c);
    const call = calls.find(c => c.stage === 'author')!, input = JSON.parse(call.input);
    expect(input.task).toContain(`child aged ${age}, in ${spreads} narrative spreads (${spreads * 2} display pages)`);
    expect(input.task).toContain('planned personal choices, companion contribution and key experiences, where present, are actually enacted');
    expect(input.task).toContain('No mandatory extra adventure or separate companion arc');
    expect(call.instructions).toContain('A brief satisfying encounter is valid');
    expect(call.instructions).toContain('develop a longer adventure rather than stretching one event');
    expect(call.instructions).toContain('a repeated gesture or request should add something, not fill a coping quota');
    expect(call.instructions).toContain('places affect actions, not merely host another clue or explanation');
    expect(result.books[0].original.manuscript.pages).toHaveLength(spreads);
    expect(calls.map(c => c.stage)).toEqual(['plan', 'author', 'editor', 'final_review', 'comparison']);
    expect(calls.every(c => Buffer.byteLength(c.instructions + c.input, 'utf8') <= 104_000)).toBe(true);
  });
  it('actual editor protects relational payoff without inventing events or freezing a weak scene', async () => {
    const h = harness(); await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === 'editor')!;
    expect(call.instructions).toContain('Protect relational commitments, personal comic echoes and emotional closure');
    expect(call.instructions).toContain('A justified replacement may improve them');
    expect(call.instructions).toContain('wording, scene or structural repair to match the actual weakness');
    expect(call.instructions).toContain('A request or intention is not a narrated completed event');
    expect(call.instructions).toContain("a character's guess is not an established fact");
    expect(call.instructions).toContain('Distinguish proven contradiction, ambiguity, literary weakness and stylistic preference');
    expect(call.instructions).toContain('Allocate narrative space for brief.child.age and brief.beats');
    expect(call.instructions).toContain('Preserve functions, not necessarily literal wording');
    expect(call.instructions).toContain('Use the existing adventure_and_payoff check to assess whole-book development');
    expect(call.input).not.toMatch(/findings|packetDigest|authorConversation/);
  });
  it.each(['original_review', 'final_review', 'comparison'] as const)('actual %s asks for justified reader-impact findings rather than semantic attestation', async stage => {
    const h = harness(1, undefined, new AbortController(), stage === 'original_review' ? 'benchmark' : 'normal');
    await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    const input = JSON.parse(call.input);
    expect(call.instructions).toContain('Assess the enacted experience and allocation of narrative space');
    expect(call.instructions).toContain('Distinguish proven contradiction, ambiguity, literary weakness and stylistic preference');
    expect(call.instructions).toContain('A request or intention is not a narrated completed event');
    expect(call.instructions).toContain('if evidence only supports ambiguity, say so');
    expect(call.instructions).toContain('A short encounter can work; extra travel, another adventure and a separate companion arc are not mandatory');
    expect(call.instructions).toContain('Do not invent missing events or demand a particular plot');
    expect(input.packet.brief.child.age).toBe(4); expect(input.packet.brief.narrativeSpreads).toBe(8);
    expect(input.packetDigest).toBe(causalDigest(input.packet));
    expect(call.input).not.toMatch(/semanticAudit|outlineChecks|draftTextMetrics/);
    if (stage === 'comparison') expect(call.instructions).toContain('Compare relational commitments, personal comic echoes and emotional closure');
    else expect(input.packet).not.toHaveProperty('original');
  });
  it('diagnostic experience wording does not leak into the shared public planner or editor', () => {
    const prepared = preparePersonalStory(causalTrialCohort()[3].request, options);
    expect(prepared.brief.resilienceMode).toBe('adventure_only');
    for (const text of [prepared.call.instructions, STORY_EDITOR_INSTRUCTIONS]) {
      expect(text).not.toContain("Choose the reader's experience alongside emotional fit");
      expect(text).not.toContain('Allocate narrative space for brief.child.age and brief.beats');
      expect(text).not.toContain('Protect relational commitments, personal comic echoes and emotional closure');
      expect(text).not.toContain('distinguishes the reasonable alternatives');
      expect(text).not.toContain('what desire remains unresolved after earlier successes');
      expect(text).not.toContain('Develop the adventure as a changing journey');
      expect(text).not.toContain('Judge development across the whole book');
    }
    expect(CAUSAL_PLAN_INSTRUCTIONS).toContain('adventure_only must remain a full adventure without inventing a real difficulty');
  });
  it.each(['plan', 'replan', 'author', 'editor'] as const)('actual %s receives conditional scene reasoning without a plot formula', async stage => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call));
    await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    expect(call.instructions).toContain('clue distinguishes the reasonable alternatives in that actual scene');
    expect(call.instructions).toContain('Important new information should affect');
    expect(call.instructions).toContain('what desire remains unresolved after earlier successes');
    expect(call.instructions).toContain('not mandatory real-world physics');
    expect(call.instructions).toContain('belief and fear need not change instantly');
    expect(call.instructions).toContain('not required mysteries, clues, instant emotional cures or evidence for every comic guess');
    expect(call.instructions).toContain('Develop the adventure as a changing journey');
    expect(call.instructions).toContain('Search, encounters, play and surprises are possibilities, not a checklist or prescribed route');
    expect(call.instructions).toContain('An observation-based interest need not confine the child to looking, pointing and explaining');
    expect(call.instructions).toContain('repeated adjustments to one small mechanism need enough unfolding experience');
    expect(call.instructions).toContain('Quiet scenes or a shared setting can develop through changed relationships, choices or play');
    expect(call.instructions).toContain('travel alone is not development');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan', 'author', 'editor', 'final_review', 'comparison']);
  });
  it.each(['original_review', 'final_review', 'comparison'] as const)('actual %s requests a complete concise object and scene-level evidence', async stage => {
    const h = harness(1, undefined, new AbortController(), 'benchmark');
    await h.runner.plan(); h.approve(); const result = await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    expect(call.instructions).toContain('one complete JSON object matching the supplied schema');
    expect(call.instructions).toContain('Do not pad a string to its maximum or stop after the summary');
    expect(call.instructions).toContain('brevity targets, not minimums');
    expect(call.instructions).toContain('do not omit a material problem merely to shorten the response');
    expect(call.instructions).toContain('distinguish the reasonable alternatives in this scene');
    expect(call.instructions).toContain('important information already discovered');
    expect(call.instructions).toContain('What unresolved desire does the ending address');
    expect(call.instructions).toContain('Report a material ambiguity as ambiguity');
    expect(call.instructions).toContain('neither instant belief updates nor proof for every joke is required');
    expect(call.instructions).toContain('Judge development across the whole book, not a count of locations or action verbs');
    expect(call.instructions).toContain('reporting it as a meaningful literary weakness rather than automatically a contradiction or a polish preference');
    expect(call.instructions).toContain('Do not demand a chase, extra cast or action in every spread');
    expect(call.maxOutputTokens).toBe(12000);
    const packet = JSON.parse(call.input).packet;
    expect(packet).not.toHaveProperty('instructions');
    expect(packet.instructionsDigest).toBe(causalDigest(call.instructions));
    if (stage === 'comparison') {
      expect(call.instructions).toContain('Assess whether revision improved the experience, merely shortened it, or lost its development');
      expect(call.instructions).not.toContain('A substantial lack of development supported by actual prose and reader impact is kind issue');
    } else {
      expect(call.instructions).toContain('A substantial lack of development supported by actual prose and reader impact is kind issue with severity meaningful');
      expect(call.instructions).toContain('a preference for a different pace or setting alone is kind preference');
      expect(call.instructions).not.toContain('Assess whether revision improved the experience, merely shortened it, or lost its development');
    }
    // Soft brevity guidance does not clamp or silently change the existing hard schema.
    const longest = { packetDigest: causalDigest(packet), summary: 's'.repeat(600), findings: [] };
    const book = result.books[0], prepared = preparePersonalStory(h.args.cases[0].request, options);
    const canonical = causalReviewPackets(prepared, book.original, book.edit.revised)[stage === 'original_review' ? 'original' : stage === 'final_review' ? 'final' : 'comparison'];
    expect(compileCausalSourceReading(canonical, longest).summary).toHaveLength(600);
    expect(() => compileCausalSourceReading(canonical, { ...longest, summary: 's'.repeat(601) })).toThrow('critic_binding');
    expect(call.schema.parse(longest)).toEqual(longest);
  });
  it('synopsis review assesses unfolding experience without converting stillness into an admission gate', async () => {
    const h = harness(1, undefined, new AbortController(), 'normal', true);
    const first = await h.runner.plan(), read = h.runner.readSynopses();
    expect(read).toEqual(first);
    expect(first.instructions).toContain('Judge development across the whole outline');
    expect(first.instructions).toContain('A coherent solution is insufficient if repeated clues or small adjustments take disproportionate space');
    expect(first.instructions).toContain('quiet scenes and one-setting adventures can develop through choices, relationships or play');
    expect(first.instructions).toContain('its concrete beat range and reader impact');
    const chosen = first.plans[0].attempts[0];
    expect(chosen.disposition).toBe('selected');
    if (!('planningDigest' in chosen)) throw Error('selected fixture required');
    // The structural contract admits one setting; this is not a quality verdict.
    expect(new Set(chosen.plan.beats.map(b => b.location)).size).toBe(1);
    const repaired = await h.runner.repair(repairRequest(h));
    expect(repaired.instructions).toBe(first.instructions);
    expect(repaired.plans[0].attempts[0]).toEqual(chosen);
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'replan']);
  });
  it('actual no-difficulty diagnostic keeps a sparse adventure-only brief through every stage', async () => {
    const h = harness(); h.args.cases = [causalTrialCohort()[3]];
    const runner = createCausalExperiment(h.args), b = await runner.plan();
    runner.reviewSynopses({ sourceDigest: b.sourceDigest, decisions: [{ caseId: 'case4', decision: 'write', reason: 'Synthetic sparse adventure test, not product acceptance.' }] });
    const result = await runner.write(), calls = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c);
    expect(calls.map(c => c.stage)).toEqual(['plan', 'author', 'editor', 'final_review', 'comparison']);
    for (const call of calls) {
      const input = JSON.parse(call.input), brief = input.packet?.brief ?? input.brief;
      expect(brief.resilienceMode).toBe('adventure_only'); expect(brief.topic).toBeNull();
      expect(brief.facts).toHaveLength(1); expect(brief.facts[0].kind).toBe('interest');
      expect(brief.companion.id).toBe('chameleon_koko');
    }
    expect(calls[0].instructions).toContain('adventure_only must remain a full adventure without inventing a real difficulty');
    expect(result.books[0].edit.revised.plan.resilience.mode).toBe('adventure_only');
    expect(h.ports.generate).toHaveBeenCalledTimes(5);
  });
  it('revised beats cannot drop the last interest, but may use only a subset of approved facts', () => {
    const f = selectedFixture();
    const used = new Set(f.output.revision.plan.beats.flatMap((beat: any) => beat.factIds));
    expect(used.size).toBeLessThan(f.p.brief.facts.length);
    expect(compileCausalEdit(f.p, f.original, f.output).disposition).toBe('model_supported');
    const habit = f.p.brief.facts.find(fact => fact.kind === 'other')!.id;
    f.output.revision.plan.beats.forEach((beat: any) => { beat.factIds = [habit]; });
    expect(() => compileCausalEdit(f.p, f.original, f.output)).toThrow('plan_binding');
  });
  it.each(['original_review', 'final_review', 'comparison'] as const)('actual %s dispatch specifies exact evidence sides and no counterpart leak', async stage => {
    const h = harness(1, undefined, new AbortController(), stage === 'original_review' ? 'benchmark' : 'normal');
    await h.runner.plan(); h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c).find(c => c.stage === stage)!;
    expect(call.instructions).toContain('Return the supplied packetDigest exactly; do not recompute it');
    const input = JSON.parse(call.input);
    expect(input.packetDigest).toBe(causalDigest(input.packet));
    expect(call.instructions).toContain('return startId and endId from the supplied source units');
    expect(call.instructions).toContain('IDs and anchors establish location, not support for your interpretation');
    if (stage === 'comparison') {
      expect(call.instructions).toContain('EVERY finding, including polish or preference');
      expect(call.instructions).toContain('at least one original[] citation AND at least one revised[] citation');
      expect(call.instructions).toContain('never issue');
    } else {
      const own = stage === 'original_review' ? 'original' : 'revised', other = own === 'original' ? 'revised' : 'original';
      expect(call.instructions).toContain('Use only issue or preference');
      expect(call.instructions).toContain(`at least one citation in ${own}[] and leave ${other}[] empty`);
      expect(call.instructions).toContain('Do not invent evidence from the unavailable other version');
    }
  });
  it.each(['original', 'final', 'comparison'] as const)('%s readings accept literal own-version evidence and reject empty/wrong/paraphrased sides', kind => {
    const f = selectedFixture(), edit = compileCausalEdit(f.p, f.original, f.output), packet = causalReviewPackets(f.p, f.original, edit.revised)[kind];
    const ref = { pageNumber: 1, quote: f.original.manuscript.pages[0].text.slice(0, 12) };
    const raw: any = { packetDigest: causalDigest(packet), summary: 'Synthetic evidence mapping test, not a literary quality verdict.',
      findings: [{ severity: 'polish', kind: 'preference', criterion: 'A read-aloud phrase could be smoother.',
        original: kind === 'final' ? [] : [ref], revised: kind === 'original' ? [] : [ref], explanation: 'A bounded subjective reading with the correct source references.' }] };
    expect(compileCausalReading(packet, raw).findings).toHaveLength(1);
    const empty = structuredClone(raw); empty.findings[0].original = []; empty.findings[0].revised = [];
    expect(() => compileCausalReading(packet, empty)).toThrow('critic_evidence');
    const wrong = structuredClone(raw);
    if (kind === 'original') { wrong.findings[0].original = []; wrong.findings[0].revised = [ref]; }
    else if (kind === 'final') { wrong.findings[0].original = [ref]; wrong.findings[0].revised = []; }
    else wrong.findings[0].original = [];
    expect(() => compileCausalReading(packet, wrong)).toThrow('critic_evidence');
    const paraphrase = structuredClone(raw), side = kind === 'final' ? 'revised' : 'original';
    paraphrase.findings[0][side][0].quote = 'A paraphrase absent from the actual cited page';
    expect(() => compileCausalReading(packet, paraphrase)).toThrow('critic_evidence');
  });
  it.each(['plan', 'replan', 'author', 'editor'] as const)('actual %s dispatch keeps deadlines conditional and failed attempts optional', async stage => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call));
    await h.runner.plan(); h.approve(); await h.runner.write();
    const calls = vi.mocked(h.ports.generate).mock.calls.map(([call]) => call);
    expect(calls.map(call => call.stage).slice(0, 4)).toEqual(['plan', 'replan', 'author', 'editor']);
    const call = calls.find(row => row.stage === stage)!;
    expect(call.instructions).not.toContain('a failed attempt with consequences and ');
    expect(call.instructions).not.toContain('when a deadline is reached, what happens if it is missed, and which earlier observation or ability enables the solution');
    expect(call.instructions).toContain('If the selected adventure uses a deadline');
    expect(call.instructions).toContain('Do not presume or add a deadline');
    expect(call.instructions).toContain('A failed attempt is optional');
    // The legacy runtime remains outside this experiment's migration scope.
    expect(STORY_INSTRUCTIONS).toContain('a failed attempt with consequences and ');
    expect(NARRATIVE_CRAFT_INSTRUCTIONS).toContain('when a deadline is reached, what happens if it is missed');
    expect(STORY_EDITOR_INSTRUCTIONS).toContain(NARRATIVE_CRAFT_INSTRUCTIONS);
  });
  it('covers six companions, balanced lengths, sparse/no-topic and same-hobby distinct habits without altering consumed fixtures', () => {
    const before = canonicalJson(companionTrialCohort()), rows = causalTrialCohort();
    expect(new Set(rows.map(c => c.request.companion.id)).size).toBe(6);
    expect(rows.map(c => c.request.bookOptions.lengthId)).toEqual(['short', 'medium', 'long', 'short', 'medium', 'long']);
    expect(rows[3].request.facts).toHaveLength(1); expect(rows[3].request.intent?.kind).toBe('just_for_fun');
    expect(rows[1].request.facts[0].value).toBe(rows[4].request.facts[0].value);
    expect(rows[1].request.facts[1].value).not.toBe(rows[4].request.facts[1].value);
    const sparse = preparePersonalStory(rows[3].request, options).brief;
    expect(sparse.startingPlace).toBeNull(); expect(sparse.child.residence).toBe(rows[3].request.child.residence);
    expect(sparse.topic).toBeNull(); expect(sparse.facts).toHaveLength(1);
    expect(canonicalJson(companionTrialCohort())).toBe(before);
  });
  it.each(['normal', 'benchmark'] as const)('%s reserves only its active stages before dispatch, then isolates every conversation', async reviewMode => {
    const h = harness(6, undefined, new AbortController(), reviewMode); const bundle = await h.runner.plan();
    const stageCount = reviewMode === 'normal' ? 6 : 7, actualCount = reviewMode === 'normal' ? 30 : 36;
    expect(h.ports.reserve).toHaveBeenCalledWith(h.args.family, h.runner.snapshot().manifestDigest, stageCount * 60, expect.arrayContaining([{ id: 'case6:comparison', capMicroUsd: 10 }]));
    expect(h.runner.snapshot().manifest.reviewMode).toBe(reviewMode);
    expect(h.runner.snapshot().manifest.slots).toHaveLength(stageCount * 6);
    expect(vi.mocked(h.ports.generate).mock.calls).toHaveLength(6);
    expect(vi.mocked(h.ports.generate).mock.calls.every(([c]) => c.stage === 'plan')).toBe(true);
    expect(bundle.plans).toHaveLength(6); await expect(h.runner.write()).rejects.toThrow('phase');
    h.approve(); const out = await h.runner.write();
    expect(out.books).toHaveLength(6); expect(out.runtimeEligible).toBe(false);
    const calls = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c);
    expect(new Set(calls.map(c => c.conversationKey)).size).toBe(actualCount);
    expect(calls.slice(6).map(c => c.stage)).toEqual(Array.from({ length: 6 }, () =>
      ['author', 'editor', ...(reviewMode === 'benchmark' ? ['original_review'] : []), 'final_review', 'comparison']).flat());
    expect(calls.filter(c => c.stage === 'editor').every(c => c.role === 'opus')).toBe(true);
    expect(calls.filter(c => c.stage.endsWith('review') || c.stage === 'comparison').every(c => c.role === 'astra')).toBe(true);
    expect(out.evidence.accounting.logicalAttempts).toBe(actualCount);
    expect(out.books.every(book => book.readings.map(row => row.stage).join() ===
      (reviewMode === 'normal' ? 'final_review,comparison' : 'original_review,final_review,comparison'))).toBe(true);
    for (const call of calls.filter(c => c.stage === 'author')) expect(JSON.parse(call.input)).not.toHaveProperty('backwardDependencies');
    expect(out.books[0]).not.toHaveProperty('accounting.providerCalls');
    await expect(h.runner.plan()).rejects.toThrow('phase'); await expect(h.runner.write()).rejects.toThrow('phase');
  });
  it('does not write while the last cohort plan is unresolved; review is an explicit barrier', async () => {
    let release!: (value: unknown) => void;
    const h = harness(6, call => call.conversationKey.endsWith('case6:plan') ? new Promise(r => { release = r; }) : defaultOutput(call));
    const pending = h.runner.plan(); await vi.waitFor(() => expect(h.ports.generate).toHaveBeenCalledTimes(6));
    await expect(h.runner.write()).rejects.toThrow('phase');
    expect(() => h.approve()).toThrow('phase');
    const call = vi.mocked(h.ports.generate).mock.calls[5][0]; release(defaultOutput(call));
    await pending; expect(h.ports.generate).toHaveBeenCalledTimes(6);
    await expect(h.runner.write()).rejects.toThrow('phase');
  });
  it('permits exactly one separately claimed replan only after valid both-rejected and retains both attempts', async () => {
    const h = harness(1, call => call.stage === 'plan' ? planned(JSON.parse(call.input).brief, true) : defaultOutput(call));
    const b = await h.runner.plan(); expect(b.plans[0].attempts.map(a => a.disposition)).toEqual(['both_rejected', 'selected']);
    expect(vi.mocked(h.ports.claim).mock.calls.map(c => c[2])).toEqual(['case1:plan', 'case1:replan']);
    h.approve(); expect((await h.runner.write()).books).toHaveLength(1);
  });
  it('second rejection holds before prose; an outline HOLD never replans', async () => {
    for (const outline of [false, true]) {
      const h = harness(1, call => { const p = planned(JSON.parse(call.input).brief, !outline);
        if (outline) p.selection.outlineChecks.earned_payoff.outcome = 'needs_work'; return p; });
      const b = await h.runner.plan(); expect(b.plans[0].attempts).toHaveLength(outline ? 1 : 2);
      expect(() => h.approve()).toThrow('cohort_binding');
      h.runner.reviewSynopses({ sourceDigest: b.sourceDigest, decisions: [{ caseId: 'case1', decision: 'hold', reason: 'The premise still requires an independent revision.' }] });
      expect((await h.runner.write()).books).toHaveLength(0);
    }
  });
  it('fingerprints the effective outline disposition, not the pre-HOLD selected label', () => {
    const f = selectedFixture(); f.raw.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
    const held = compileCausalPlan(f.p, f.raw);
    if (!('planningDigest' in held)) throw Error('fixture');
    const { planningDigest, ...body } = held;
    expect(held.disposition).toBe('outline_held');
    expect(planningDigest).toBe(causalDigest(body));
    expect(planningDigest).not.toBe(causalDigest({ ...body, disposition: 'selected' }));
    const { planningDigest: selectedDigest, ...selectedBody } = f.plan;
    expect(selectedDigest).toBe(causalDigest(selectedBody));
  });
  it.each(['unchanged', 'relabelled', 'rebound'] as const)('direct author admission refuses an %s outline HOLD', kind => {
    const f = selectedFixture(); f.raw.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
    const held = compileCausalPlan(f.p, f.raw);
    if (!('planningDigest' in held)) throw Error('fixture');
    if (kind !== 'unchanged') held.disposition = 'selected';
    if (kind === 'rebound') { const { planningDigest: _digest, ...body } = held; held.planningDigest = causalDigest(body); }
    expect(() => compileCausalOriginal(f.p, held, author({ brief: f.p.brief, planDigest: held.planDigest }))).toThrow('plan_binding');
    expect(compileCausalOriginal(f.p, f.plan, author({ brief: f.p.brief, planDigest: f.plan.planDigest }))).toEqual(f.original);
  });
  it.each([false, true])('pins candidate-pair guards with both_rejected=%s', rejected => {
    const p = preparePersonalStory(causalTrialCohort()[0].request, options);
    const cases = [
      { name: 'identity', code: 'story_selection_identity', change: (pair: any) => { pair.candidates[0].id = 'B'; pair.candidates[1].id = 'A'; } },
      { name: 'duplicate_dimension', code: 'story_selection_not_distinct', change: (pair: any) => { pair.contrast.dimensions = ['childWant', 'childWant']; } },
      { name: 'not_distinct', code: 'story_selection_not_distinct', change: (pair: any) => { pair.contrast.dimensions = ['childWant']; pair.candidates[1].childWant = `  ${pair.candidates[0].childWant} !`; } },
      { name: 'unknown_fact', code: 'story_selection_fact_mismatch', change: (pair: any) => { pair.candidates[0].personalFactUses[0].factId = 'unknown_fact'; } },
      { name: 'duplicate_fact', code: 'story_selection_fact_mismatch', change: (pair: any) => { pair.candidates[0].personalFactUses.push(structuredClone(pair.candidates[0].personalFactUses[0])); } },
      { name: 'non_interest', code: 'story_selection_personal_fact_missing', change: (pair: any) => { pair.candidates[0].personalFactUses[0].factId = p.brief.facts.find(f => f.kind === 'other')!.id; } },
    ];
    for (const row of cases) {
      const raw = planned(p.brief, rejected); row.change(rejected ? raw : raw.selection);
      expect(() => compileCausalPlan(p, raw), row.name).toThrow(row.code);
    }
    expect(compileCausalPlan(p, planned(p.brief, rejected)).disposition).toBe(rejected ? 'both_rejected' : 'selected');
  });
  it('invalid rejected candidate evidence stops the real runner after one dispatch, before replan', async () => {
    const h = harness(1, call => { const raw = planned(JSON.parse(call.input).brief, true);
      raw.candidates[0].personalFactUses[0].factId = 'unknown_fact'; return raw; });
    await expect(h.runner.plan()).rejects.toThrow('story_selection_fact_mismatch');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([call]) => call.stage)).toEqual(['plan']);
    expect(vi.mocked(h.ports.claim).mock.calls.map(call => call[2])).toEqual(['case1:plan']);
    expect(h.runner.snapshot().phase).toBe('failed');
  });
  it.each(['malformed', 'transport', 'foreign', 'unknown_fact', 'old_version'])('%s stops planning without replan or prose', async kind => {
    const h = harness(1, call => { if (kind === 'transport') throw Error('private provider detail');
      const p = planned(JSON.parse(call.input).brief); if (kind === 'malformed') return {};
      if (kind === 'foreign') p.requestId = 'foreign';
      if (kind === 'unknown_fact') p.plan.beats[0].factIds = ['foreign'];
      if (kind === 'old_version') p.version = 'personal-causal-experiment/diagnostic-v1'; return p; });
    await expect(h.runner.plan()).rejects.toThrow('causal_experiment_');
    expect(h.ports.generate).toHaveBeenCalledTimes(1); expect(h.runner.snapshot().phase).toBe('failed');
  });
  it('rejects stale cohort approval and keeps detached snapshot mutation away from author state', async () => {
    const h = harness(); const bundle = await h.runner.plan();
    expect(() => h.runner.reviewSynopses({ sourceDigest: 'f'.repeat(64), decisions: [{ caseId: 'case1', decision: 'write',
      reason: 'Structurally valid review but bound to another cohort.' }] })).toThrow('cohort_binding');
    const returned = bundle.plans[0].attempts[0]; if ('plan' in returned) returned.plan.childGoal = 'MUTATED_SNAPSHOT';
    h.approve(); await h.runner.write();
    const call = vi.mocked(h.ports.generate).mock.calls.find(([c]) => c.stage === 'author')![0];
    expect(call.input).not.toContain('MUTATED_SNAPSHOT');
  });
  it.each([NaN, Infinity, -1, 0, 1.1])('refuses invalid/incomplete reservation %s before reserve or dispatch', cap => {
    const h = harness(); expect(() => createCausalExperiment({ ...h.args, capsMicroUsd: { ...h.args.capsMicroUsd, replan: cap } })).toThrow('reservation_invalid');
    expect(h.ports.reserve).not.toHaveBeenCalled(); expect(h.ports.generate).not.toHaveBeenCalled();
    expect(() => createCausalExperiment({ ...h.args, maximumMicroUsd: 59 })).toThrow('reservation_invalid');
  });
  it.each(['reserve', 'claim'] as const)('denied %s makes no provider call', async boundary => {
    const h = harness(); vi.mocked(h.ports[boundary]).mockResolvedValue(false);
    await expect(h.runner.plan()).rejects.toThrow(boundary === 'reserve' ? 'reservation_denied' : 'slot_claim_denied');
    expect(h.ports.generate).not.toHaveBeenCalled();
  });
  it.each([null, NaN, Infinity, -1, 11])('unknown/invalid/over-budget cost %s stops after one logical attempt', async cost => {
    const h = harness(); vi.mocked(h.ports.generate).mockImplementation(async call => ({ output: defaultOutput(call), estimatedMicroUsd: cost }));
    await expect(h.runner.plan()).rejects.toThrow(cost === null ? 'cost_unknown' : cost === 11 ? 'cost_overrun' : 'cost_invalid');
    expect(h.ports.generate).toHaveBeenCalledTimes(1);
    expect(h.runner.snapshot().accounting.logicalAttempts).toBe(1); await expect(h.runner.plan()).rejects.toThrow('phase');
  });
  it('pre-cancel has zero attempts; cancel ignores late resolution and never advances cost/output', async () => {
    const controller = new AbortController(); controller.abort(); const pre = harness(1, undefined, controller);
    await expect(pre.runner.plan()).rejects.toThrow('cancelled'); expect(pre.ports.reserve).not.toHaveBeenCalled();
    let resolve!: (v: { output: unknown; estimatedMicroUsd: number }) => void;
    const h = harness(); vi.mocked(h.ports.generate).mockImplementation(() => new Promise(r => { resolve = r; }));
    const job = h.runner.plan(); await vi.waitFor(() => expect(h.ports.generate).toHaveBeenCalledTimes(1));
    h.controller.abort(); await expect(job).rejects.toThrow('cancelled'); const snap = h.runner.snapshot();
    resolve({ output: {}, estimatedMicroUsd: 3 }); await Promise.resolve(); await Promise.resolve();
    expect(h.runner.snapshot()).toEqual(snap); expect(snap.accounting.unknownAttemptCosts).toBe(1);
  });
  it('transport timeout holds without retry even for a noncooperating port', async () => {
    vi.useFakeTimers(); const h = harness(); vi.mocked(h.ports.generate).mockImplementation(() => new Promise(() => {}));
    const job = h.runner.plan(); const assertion = expect(job).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(1_000_000); await assertion;
    expect(h.ports.generate).toHaveBeenCalledTimes(1);
  });
  it('a host refusing the same family claim blocks a second coordinator, without claiming memory is durable', async () => {
    const h = harness(); await h.runner.plan(); vi.mocked(h.ports.reserve).mockResolvedValue(false);
    const second = createCausalExperiment(h.args); await expect(second.plan()).rejects.toThrow('reservation_denied');
    expect(h.ports.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['short', 'medium', 'long'])('accepts valid plan/author/edit bindings at %s length', length => {
    const row = causalTrialCohort()[0]; row.request.bookOptions.lengthId = length;
    const p = preparePersonalStory(row.request, options), result = compileCausalPlan(p, planned(p.brief));
    if (!('planningDigest' in result)) throw Error('fixture');
    const original = compileCausalOriginal(p, result, author({ brief: p.brief, planDigest: result.planDigest }));
    expect(original.manuscript.pages).toHaveLength(p.brief.beats); expect(original.characterDigest).toBe(p.brief.companion.characterDigest);
  });
  it('an old selected plan cannot be rebound and admitted directly by the new author', () => {
    const f = selectedFixture(), old: any = structuredClone(f.plan); old.version = 'personal-causal-experiment/diagnostic-v1';
    const { planningDigest: _digest, ...body } = old; old.planningDigest = causalDigest(body);
    expect(() => compileCausalOriginal(f.p, old, author({ brief: f.p.brief, planDigest: old.planDigest }))).toThrow('plan_binding');
  });
  it.each(['request', 'plan', 'fingerprint', 'character'])('rejects forged %s binding without manufacturing GPT accounting', kind => {
    const f = selectedFixture();
    if (kind === 'request') f.plan.requestDigest = '0'.repeat(64);
    if (kind === 'plan') f.plan.plan.childGoal = 'changed plan';
    if (kind === 'fingerprint') f.plan.planningDigest = '0'.repeat(64);
    if (kind === 'character') f.original.characterDigest = '0'.repeat(64);
    if (kind === 'character') expect(() => causalEditorCall(f.p, f.original)).toThrow('source_binding');
    else expect(() => compileCausalOriginal(f.p, f.plan, author({ brief: f.p.brief, planDigest: f.plan.planDigest }))).toThrow('plan_binding');
  });
  it.each(['old_version', 'diagnosis', 'strengths', 'stale'])('rejects %s editor output without removing shared semantic guards', kind => {
    const f = selectedFixture();
    if (kind === 'old_version') f.output.version = 'personal-causal-experiment/diagnostic-v1';
    else if (kind === 'stale') f.output.revision.draftDigest = '0'.repeat(64);
    else f.output[kind] = [];
    expect(() => compileCausalEdit(f.p, f.original, f.output)).toThrow();
  });
  it('still holds unresolved semantic audit and editor checks', () => {
    const f = selectedFixture(); f.output.revision.semanticAudit.setup_payoff.outcome = 'unresolved';
    expect(compileCausalEdit(f.p, f.original, f.output).disposition).toBe('held');
    const clean = selectedFixture(); Object.values(clean.output.revision.checks).forEach((c: any) => { c.outcome = 'needs_work'; });
    expect(compileCausalEdit(clean.p, clean.original, clean.output).disposition).toBe('held');
  });
  it.each(['original', 'revised'] as const)('causal editor rejects an absent %s semantic quote at the evidence assertion', side => {
    const f = selectedFixture(), accepted = compileCausalEdit(f.p, f.original, f.output);
    expect(accepted.disposition).toBe('model_supported');
    const tampered = structuredClone(f.output), absent = 'Synthetic quotation absent from the actual manuscript.';
    const prose = side === 'original' ? f.original.manuscript : accepted.revised.manuscript;
    expect(prose.pages.some(page => page.text.includes(absent))).toBe(false);
    tampered.revision.semanticAudit.setup_payoff[side][0].quote = absent;
    expect(() => compileCausalEdit(f.p, f.original, tampered)).toThrow('causal_experiment_semantic_evidence');
    expect(compileCausalEdit(f.p, f.original, f.output)).toEqual(accepted);
  });
  it.each(['normal', 'benchmark'] as const)('%s isolated critics see only approved brief and their own prose; comparison waits for final', async reviewMode => {
    const seen: CausalDispatch[] = []; const h = harness(1, call => { seen.push(call);
      const output: any = defaultOutput(call);
      if (call.stage === 'plan') { output.synopsis += ' PLANNING_SECRET'; output.selection.reason += ' REASON_SECRET'; }
      if (call.stage === 'editor') {
        Object.values(output.revision.checks).forEach((row: any) => { row.note = 'EDITOR_CHECK_SECRET remains model-only evidence.'; });
        output.revision.manuscript.pages[0].text += ' FINAL_ONLY';
      }
      return output; }, new AbortController(), reviewMode);
    await h.runner.plan(); h.approve(); await h.runner.write();
    const original = seen.find(c => c.stage === 'original_review')!, final = seen.find(c => c.stage === 'final_review')!;
    for (const c of [original, final].filter(Boolean)) expect(c.input).not.toMatch(/PLANNING_SECRET|REASON_SECRET|EDITOR_CHECK_SECRET|semanticAudit|outlineChecks/);
    expect(final.input).toContain('FINAL_ONLY'); expect(JSON.parse(final.input).packet).not.toHaveProperty('original');
    if (reviewMode === 'benchmark') {
      expect(original.input).not.toContain('FINAL_ONLY');
      expect(JSON.parse(original.input).packet.brief).toEqual(JSON.parse(final.input).packet.brief);
      expect(seen.map(c => c.stage).slice(-3)).toEqual(['original_review', 'final_review', 'comparison']);
    } else {
      expect(original).toBeUndefined(); expect(seen.map(c => c.stage).slice(-2)).toEqual(['final_review', 'comparison']);
    }
  });
  it('caller mutation cannot enable a benchmark or increase the already reserved normal recipe', async () => {
    const h = harness(); h.args.reviewMode = 'benchmark'; h.args.capsMicroUsd.original_review = 10;
    await h.runner.plan(); h.approve(); await h.runner.write();
    expect(h.runner.snapshot().manifest.reviewMode).toBe('normal'); expect(h.runner.snapshot().manifest.slots).toHaveLength(6);
    expect(h.ports.generate).toHaveBeenCalledTimes(5);
    expect(vi.mocked(h.ports.generate).mock.calls.some(([call]) => call.stage === 'original_review')).toBe(false);
  });
  it('rejects missing/extra active reservations and unknown review modes before any port call', () => {
    const h = harness(), missing = { ...h.args.capsMicroUsd }; delete missing.final_review;
    expect(() => createCausalExperiment({ ...h.args, capsMicroUsd: missing })).toThrow('reservation_invalid');
    expect(() => createCausalExperiment({ ...h.args, capsMicroUsd: { ...h.args.capsMicroUsd, original_review: 10 } })).toThrow('reservation_invalid');
    expect(() => createCausalExperiment({ ...h.args, reviewMode: 'skip_qa' as any })).toThrow('review_mode');
    expect(h.ports.reserve).not.toHaveBeenCalled(); expect(h.ports.generate).not.toHaveBeenCalled();
  });
  it.each(['original_review', 'final_review'])('bad %s reading suppresses comparison', async stage => {
    const h = harness(1, c => c.stage === stage ? { packetDigest: '0'.repeat(64), summary: 'A stale independent reading for another text.', findings: [] } : defaultOutput(c),
      new AbortController(), stage === 'original_review' ? 'benchmark' : 'normal');
    await h.runner.plan(); h.approve(); await expect(h.runner.write()).rejects.toThrow('critic_binding');
    expect(vi.mocked(h.ports.generate).mock.calls.some(([c]) => c.stage === 'comparison')).toBe(false);
  });
  it('rejects unstated or counterpart evidence and source-packet changes in independent readings', () => {
    const f = selectedFixture(), edit = compileCausalEdit(f.p, f.original, f.output), packets = causalReviewPackets(f.p, f.original, edit.revised);
    const raw = { packetDigest: causalDigest(packets.original), summary: 'A synthetic independent original-only reading.', findings: [{ severity: 'meaningful',
      kind: 'issue', criterion: 'A causal connection requires clearer evidence.', original: [], revised: [{ pageNumber: 1, quote: f.original.manuscript.pages[0].text.slice(0, 12) }], explanation: 'The evidence points at the wrong version of the text.' }] };
    expect(() => compileCausalReading(packets.original, raw)).toThrow('critic_evidence');
    raw.findings = []; packets.original.instructions += 'changed';
    expect(() => compileCausalReading(packets.original, raw)).toThrow('critic_binding');
  });
  it('separates comparative improvement/regression from isolated readings and requires both prose references', () => {
    const f = selectedFixture(), edit = compileCausalEdit(f.p, f.original, f.output), packets = causalReviewPackets(f.p, f.original, edit.revised);
    const ref = { pageNumber: 1, quote: f.original.manuscript.pages[0].text.slice(0, 12) };
    const row = { severity: 'meaningful', kind: 'new_regression', criterion: 'The revision weakens a prepared causal connection.',
      original: [ref], revised: [ref], explanation: 'Synthetic comparison evidence, not proof of literary correctness.' };
    const raw = { packetDigest: causalDigest(packets.comparison), summary: 'Synthetic comparison distinguishes new damage from prior weakness.', findings: [row] };
    expect(compileCausalReading(packets.comparison, raw).findings[0].kind).toBe('new_regression');
    expect(() => compileCausalReading(packets.original, { ...raw, packetDigest: causalDigest(packets.original) })).toThrow('critic_comparison_leak');
    row.original = []; expect(() => compileCausalReading(packets.comparison, raw)).toThrow('critic_evidence');
  });
  it('malformed original stops before editor', async () => {
    const h = harness(1, c => c.stage === 'author' ? {} : defaultOutput(c));
    await h.runner.plan(); h.approve(); await expect(h.runner.write()).rejects.toThrow('author_schema');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'author']);
  });
  it('concurrent plan calls cannot duplicate even the first reservation', async () => {
    const h = harness(); const results = await Promise.allSettled([h.runner.plan(), h.runner.plan()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(h.ports.reserve).toHaveBeenCalledTimes(1); expect(h.ports.generate).toHaveBeenCalledTimes(1);
  });
});

describe('opt-in draft critique before fresh editor, no literary certification', () => {
  function noteFor(call: CausalDispatch, severity = 'meaningful', kind = 'issue', marker = 'A material reader observation, not a prescribed solution.') {
    const input = JSON.parse(call.input);
    const unit = input.packet.manuscript.pages[0].units[0];
    return { severity, kind, criterion: 'Synthetic causal clarity criterion', original: [{
      startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' '),
    }], revised: [], explanation: marker };
  }
  function feedbackHarness(change?: (call: CausalDispatch) => unknown | Promise<unknown>) {
    return harness(1, call => {
      if (change) return change(call);
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') out.findings = [noteFor(call)];
      return out;
    }, new AbortController(), 'benchmark', false, true);
  }
  async function run(h: ReturnType<typeof harness>) { await h.runner.plan(); h.approve(); return h.runner.write(); }

  it('off by default; invalid/normal flags and missing fit/record ports fail before reserve', () => {
    const h = harness();
    expect(h.runner.snapshot().manifest).not.toHaveProperty('draftCritique');
    expect(h.runner.snapshot()).not.toHaveProperty('draftCritiques');
    expect(() => createCausalExperiment({ ...h.args, draftCritique: true })).toThrow('draft_critique_policy');
    expect(() => createCausalExperiment({ ...h.args, draftCritique: false as any })).toThrow('draft_critique_policy');
    const b = harness(1, undefined, new AbortController(), 'benchmark');
    expect(() => createCausalExperiment({ ...b.args, draftCritique: true,
      ports: { ...b.ports, canFitCritiqueEditor: undefined } })).toThrow('draft_critique_policy');
    expect(() => createCausalExperiment({ ...b.args, draftCritique: true,
      ports: { ...b.ports, recordDraftCritique: undefined } })).toThrow('draft_critique_policy');
    expect(h.ports.reserve).not.toHaveBeenCalled(); expect(b.ports.reserve).not.toHaveBeenCalled();
  });
  it('moves exactly one reserved reading, records before editor claim, and leaves later readers blind', async () => {
    const h = feedbackHarness(), out = await run(h), calls = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c);
    expect(calls.map(c => c.stage)).toEqual(['plan', 'author', 'original_review', 'editor', 'final_review', 'comparison']);
    expect(h.runner.snapshot().manifest.slots).toHaveLength(7);
    expect(h.runner.snapshot().manifest.draftCritique).toBe(true);
    const original = out.books[0].original, prepared = preparePersonalStory(h.args.cases[0].request, options);
    expect(JSON.parse(calls[2].input).packet).toEqual(causalSourceReviewPacket(causalReviewPackets(prepared, original, out.books[0].edit.revised).original).packet);
    expect(causalSourceReviewPacket(causalOriginalReviewPacket(prepared, original)).packet).toEqual(JSON.parse(calls[2].input).packet);
    const input = JSON.parse(calls[3].input), transfer = out.books[0].draftCritique!;
    expect(input.draftCritique.findings).toHaveLength(1);
    expect(input.draftCritique.findings[0].id).toBe('draft-finding-01');
    expect(input.draftCritique.projectionDigest).toBe(transfer.context.projectionDigest);
    expect(calls[3].instructions).toContain('fallible reader claims');
    expect(calls[3].instructions).toContain('Develop the adventure as a changing journey');
    expect(calls[3].instructions).toContain('Use the existing adventure_and_payoff check to assess whole-book development');
    expect(calls[3].instructions).toContain('clue distinguishes the reasonable alternatives in that actual scene');
    expect(calls[3].instructions).not.toContain('not the author conversation or critic verdict.');
    expect(out.books[0].edit.draftCritiqueResponse!.responses[0].decision).toBe('kept');
    const recordOrder = vi.mocked(h.ports.recordDraftCritique!).mock.invocationCallOrder[0];
    expect(recordOrder).toBeLessThan(vi.mocked(h.ports.claim).mock.invocationCallOrder[3]);
    expect(h.ports.recordDraftCritique).toHaveBeenCalledOnce();
    expect(calls[2].instructions).not.toContain('steer an editor');
    for (const c of calls.slice(4)) {
      expect(c.input).not.toContain('A material reader observation');
      expect(c.input).not.toContain('draft-finding-01');
      expect(c.input).not.toContain('Synthetic reason grounded');
    }
    expect(out.books[0].readings.map(r => r.stage)).toEqual(['original_review', 'final_review', 'comparison']);
  });
  it('filters style/summary/polish, keeps whole source notes and blocking-first source order', async () => {
    const h = feedbackHarness(call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') {
        out.summary = 'SUMMARY_MUST_NOT_REACH_EDITOR long enough.';
        out.findings = [noteFor(call, 'meaningful', 'issue', 'WHOLE_MEANINGFUL_NOTE including important context.'),
          noteFor(call, 'blocking', 'issue', 'WHOLE_BLOCKING_NOTE with complete causal context.'),
          noteFor(call, 'blocking', 'preference', 'STYLE_MUST_NOT_REACH_EDITOR preference context.'),
          noteFor(call, 'polish', 'issue', 'POLISH_MUST_NOT_REACH_EDITOR minor wording.')];
      }
      return out;
    });
    const out = await run(h), input = JSON.parse(vi.mocked(h.ports.generate).mock.calls[3][0].input);
    expect(input.draftCritique.findings.map((f: any) => f.id)).toEqual(['draft-finding-02', 'draft-finding-01']);
    expect(input.draftCritique.findings[0].explanation).toBe('WHOLE_BLOCKING_NOTE with complete causal context.');
    expect(input.draftCritique.findings[1].explanation).toBe('WHOLE_MEANINGFUL_NOTE including important context.');
    expect(input.draftCritique.omitted).toEqual({ nonMaterial: 2, findingLimit: 0, capacity: 0, blocking: 0, meaningful: 0 });
    for (const mark of ['SUMMARY_MUST_NOT_REACH_EDITOR', 'STYLE_MUST_NOT_REACH_EDITOR', 'POLISH_MUST_NOT_REACH_EDITOR']) {
      expect(vi.mocked(h.ports.generate).mock.calls[3][0].input).not.toContain(mark);
    }
    expect(out.evidence.draftCritiques![0].context.reading.findings).toHaveLength(4);
  });
  it('whole-note capacity drops lower-priority tails and declares omissions, never truncates strings', async () => {
    const h = feedbackHarness(call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') out.findings = Array.from({ length: 10 }, (_, i) =>
        noteFor(call, i === 2 ? 'blocking' : 'meaningful', 'issue', 'Complete indivisible observation number ' + i));
      return out;
    });
    vi.mocked(h.ports.canFitCritiqueEditor!).mockImplementation(call => JSON.parse(call.input).draftCritique.findings.length <= 2);
    const out = await run(h), p = out.books[0].draftCritique!.context.projection;
    expect(p.findings.map(f => f.id)).toEqual(['draft-finding-03', 'draft-finding-01']);
    expect(p.omitted).toEqual({ nonMaterial: 0, findingLimit: 4, capacity: 4, blocking: 0, meaningful: 8 });
    expect(p.findings[0].explanation).toBe('Complete indivisible observation number 2');
    expect(Buffer.byteLength(canonicalJson(p), 'utf8')).toBeLessThanOrEqual(DRAFT_CRITIQUE_MAX_BYTES);
  });
  it('schema-maximum escaping remains bounded without slicing cards', async () => {
    const h = feedbackHarness(call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') out.findings = Array.from({ length: 20 }, () => ({
        ...noteFor(call), criterion: ('א"\u0000\\').repeat(150), explanation: ('ב"\u0000\\').repeat(150) }));
      return out;
    });
    const out = await run(h), p = out.books[0].draftCritique!.context.projection;
    expect(p.findings.length).toBeGreaterThan(0); expect(p.findings.length).toBeLessThan(6);
    expect(p.eligibleFindings).toBe(20);
    expect(Buffer.byteLength(canonicalJson(p), 'utf8')).toBeLessThanOrEqual(DRAFT_CRITIQUE_MAX_BYTES);
    expect(p.findings[0].criterion).toBe(('א"\u0000\\').repeat(150));
    expect(p.findings[0].explanation).toBe(('ב"\u0000\\').repeat(150));
  });
  it.each(['baseline', 'no-note-fits', 'fit-throws', 'record-throws'])('terminal %s never claims an editor or falls back', async mode => {
    const h = feedbackHarness();
    if (mode === 'baseline') vi.mocked(h.ports.canFitCritiqueEditor!).mockReturnValue(false);
    if (mode === 'no-note-fits') vi.mocked(h.ports.canFitCritiqueEditor!).mockImplementation(c => !JSON.parse(c.input).draftCritique.findings.length);
    if (mode === 'fit-throws') vi.mocked(h.ports.canFitCritiqueEditor!).mockImplementation(() => { throw Error('Private transport text'); });
    if (mode === 'record-throws') vi.mocked(h.ports.recordDraftCritique!).mockRejectedValue(Error('Private recording text'));
    await expect(run(h)).rejects.toThrow();
    expect(vi.mocked(h.ports.claim).mock.calls.map(c => c[2])).toEqual(['case1:plan', 'case1:author', 'case1:original_review']);
    expect(h.runner.snapshot().phase).toBe('failed');
    await expect(h.runner.write()).rejects.toThrow('phase');
    expect(h.ports.generate).toHaveBeenCalledTimes(3);
  });
  it.each(['schema', 'digest', 'quote', 'transport', 'cost', 'cancel'])('original reader %s failure stops before editor', async mode => {
    const h = feedbackHarness();
    vi.mocked(h.ports.generate).mockImplementation(async call => {
      if (call.stage !== 'original_review') return { output: defaultOutput(call), estimatedMicroUsd: 1 };
      if (mode === 'transport') throw Error('Private failure must not leak');
      const input = JSON.parse(call.input);
      const out: any = { packetDigest: input.packetDigest, summary: 'Synthetic material-reader context.', findings: [noteFor(call)] };
      if (mode === 'schema') delete out.summary;
      if (mode === 'digest') out.packetDigest = 'f'.repeat(64);
      if (mode === 'quote') out.findings[0].original[0].anchor = 'VERBATIM_QUOTE_NOT_IN_THIS_STORY';
      if (mode === 'cancel') h.controller.abort();
      return { output: out, estimatedMicroUsd: mode === 'cost' ? null : 1 };
    });
    await expect(run(h)).rejects.toThrow();
    expect(vi.mocked(h.ports.claim).mock.calls.some(c => c[2].endsWith(':editor'))).toBe(false);
    expect(h.ports.generate).toHaveBeenCalledTimes(3);
  });
  it.each(['id', 'anchor', 'version', 'page'])('source %s rejection reaches evidence validation after exactly three dispatches', async mode => {
    const h = feedbackHarness(call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') {
        out.findings = [noteFor(call)]; const citation = out.findings[0].original[0];
        if (mode === 'id') citation.startId = citation.endId = 'o-p1-u999';
        if (mode === 'anchor') citation.anchor = 'מילים שאינן במקור';
        if (mode === 'version') citation.startId = citation.endId = 'r-p1-u1';
        if (mode === 'page') citation.startId = citation.endId = 'o-p16-u1';
        expect(call.schema.safeParse(out).success).toBe(true);
      }
      return out;
    });
    await expect(run(h)).rejects.toThrow('critic_evidence');
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'author', 'original_review']);
    expect(h.runner.snapshot().phase).toBe('failed');
    expect(h.runner.snapshot().receipts[2].output).toBeTruthy();
    await expect(h.runner.write()).rejects.toThrow('phase');
  });
  it('empty/only-style findings are explicitly untested, not hidden material omission', async () => {
    const h = feedbackHarness(call => defaultOutput(call)), out = await run(h);
    expect(out.books[0].draftCritique!.context.projection.eligibleFindings).toBe(0);
    expect(out.books[0].draftCritique!.context.projection.findings).toEqual([]);
    expect(out.books[0].edit.draftCritiqueResponse!.responses).toEqual([]);
    expect(h.ports.generate).toHaveBeenCalledTimes(6);
  });
  it.each(['missing', 'duplicate', 'foreign', 'digest', 'extra', 'blank-reason'])('rejects %s editor response before final reader', async mode => {
    const h = feedbackHarness(call => {
      const out: any = defaultOutput(call);
      if (call.stage === 'original_review') out.findings = [noteFor(call), noteFor(call)];
      if (call.stage === 'editor') {
        const r = out.draftCritiqueResponse;
        if (mode === 'missing') r.responses.pop();
        if (mode === 'duplicate') r.responses[1].findingId = r.responses[0].findingId;
        if (mode === 'foreign') r.responses[0].findingId = 'draft-finding-20';
        if (mode === 'digest') r.projectionDigest = 'f'.repeat(64);
        if (mode === 'extra') r.extra = 'not allowed';
        if (mode === 'blank-reason') r.responses[0].reason = ' ';
      }
      return out;
    });
    await expect(run(h)).rejects.toThrow();
    expect(vi.mocked(h.ports.generate).mock.calls.map(([c]) => c.stage)).toEqual(['plan', 'author', 'original_review', 'editor']);
  });
  it('source-bound context rejects other packet, altered quote, omission or source before schema/dispatch', () => {
    const f = selectedFixture(), packet = causalOriginalReviewPacket(f.p, f.original);
    const reading = compileCausalReading(packet, { packetDigest: causalDigest(packet), summary: 'Synthetic full original-reader verdict.', findings: [] });
    const context = causalArchivalDraftCritiqueContext(f.p, f.original, reading);
    const forged = structuredClone(context); forged.projection.omitted.nonMaterial = 1;
    expect(() => causalEditorCall(f.p, f.original, forged)).toThrow('draft_critique_binding');
    const stale = structuredClone(context); stale.reading.packetDigest = 'f'.repeat(64);
    expect(() => causalEditorCall(f.p, f.original, stale)).toThrow('critic_binding');
    const changed = structuredClone(f.original); changed.manuscript.pages[0].text += ' שינוי אחר';
    expect(() => causalEditorCall(f.p, changed, context)).toThrow('critic_binding');
    expect(causalEditorSchema(f.call).safeParse(f.output).success).toBe(true);
  });
});
