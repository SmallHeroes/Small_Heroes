import { afterEach, describe, expect, it, vi } from 'vitest';
import { causalTrialCohort } from '../../../scripts/personal-causal-cohort';
import { companionTrialCohort } from '../../../scripts/personal-book-companion-cohort';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { fixtureEditorOutput } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStory, STORY_INSTRUCTIONS } from '../story-writer';
import { canonicalJson } from '../request-acceptance';
import { createCausalExperiment, CAUSAL_STAGES, type CausalDispatch, type CausalExperimentPorts } from '../story-causal-experiment-runner';
import { CAUSAL_EXPERIMENT_VERSION, CAUSAL_STORY_INSTRUCTIONS, CAUSAL_PLAN_INSTRUCTIONS, BACKWARD_DEPENDENCIES, causalDigest, compileCausalPlan, compileCausalOriginal,
  causalEditorCall, compileCausalEdit, causalReviewPackets, compileCausalReading } from '../story-causal-experiment';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const options = resolvePersonalWizardOptions();
function planned(brief: ReturnType<typeof preparePersonalStory>['brief'], rejected = false): any {
  const interest = brief.facts.find(f => f.kind === 'interest')!.id;
  const selection = fixtureAdventureSelection(brief.beats, interest);
  if (rejected) return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'both_rejected',
    candidates: selection.candidates, contrast: selection.contrast, reason: 'Both ideas lack a compelling child-led discovery.' };
  return { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId, disposition: 'selected', selection,
    synopsis: 'Synthetic continuous adventure through discovery and consequential partnership to a prepared payoff. Not literary proof.',
    backwardDependencies: Object.fromEntries(BACKWARD_DEPENDENCIES.map(key => [key, { claim: 'Synthetic causal claim, not an entailment proof.',
      evidence: [{ pageNumber: key === 'earnedPayoff' ? brief.beats : 1, field: 'childAction', quote: 'מציעה דרך אחרת' }] }])),
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
  return { version: CAUSAL_EXPERIMENT_VERSION, diagnosis: [], strengths: [], revision: { ...revision,
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
function harness(count = 1, change?: (call: CausalDispatch) => unknown | Promise<unknown>, controller = new AbortController()) {
  const cases = causalTrialCohort().slice(0, count);
  const ports: CausalExperimentPorts = { reserve: vi.fn(async () => true), claim: vi.fn(async () => true),
    generate: vi.fn(async call => ({ output: change ? await change(call) : defaultOutput(call), estimatedMicroUsd: 1 })) };
  const args = { family: 'synthetic-causal-offline', cases, options,
    capsMicroUsd: Object.fromEntries(CAUSAL_STAGES.map(s => [s, 10])) as Record<typeof CAUSAL_STAGES[number], number>,
    maximumMicroUsd: count * 70, ports, signal: controller.signal };
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
  it('reserves the whole 42-slot family before first dispatch and isolates all 36 normal conversations', async () => {
    const h = harness(6); const bundle = await h.runner.plan();
    expect(h.ports.reserve).toHaveBeenCalledWith(h.args.family, h.runner.snapshot().manifestDigest, 420, expect.arrayContaining([{ id: 'case6:comparison', capMicroUsd: 10 }]));
    expect(vi.mocked(h.ports.generate).mock.calls).toHaveLength(6);
    expect(vi.mocked(h.ports.generate).mock.calls.every(([c]) => c.stage === 'plan')).toBe(true);
    expect(bundle.plans).toHaveLength(6); await expect(h.runner.write()).rejects.toThrow('phase');
    h.approve(); const out = await h.runner.write();
    expect(out.books).toHaveLength(6); expect(out.runtimeEligible).toBe(false);
    const calls = vi.mocked(h.ports.generate).mock.calls.map(([c]) => c);
    expect(new Set(calls.map(c => c.conversationKey)).size).toBe(36);
    expect(calls.slice(6).map(c => c.stage)).toEqual(Array.from({ length: 6 }, () => ['author', 'editor', 'original_review', 'final_review', 'comparison']).flat());
    expect(calls.filter(c => c.stage === 'editor').every(c => c.role === 'opus')).toBe(true);
    expect(calls.filter(c => c.stage.endsWith('review') || c.stage === 'comparison').every(c => c.role === 'astra')).toBe(true);
    expect(out.evidence.accounting.logicalAttempts).toBe(36);
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
  it.each(['malformed', 'transport', 'foreign', 'unknown_fact', 'false_reference'])('%s stops planning without replan or prose', async kind => {
    const h = harness(1, call => { if (kind === 'transport') throw Error('private provider detail');
      const p = planned(JSON.parse(call.input).brief); if (kind === 'malformed') return {};
      if (kind === 'foreign') p.requestId = 'foreign';
      if (kind === 'unknown_fact') p.plan.beats[0].factIds = ['foreign'];
      if (kind === 'false_reference') p.backwardDependencies.enablingSetup.evidence[0].quote = 'never present'; return p; });
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
    expect(() => createCausalExperiment({ ...h.args, maximumMicroUsd: 69 })).toThrow('reservation_invalid');
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
  it('accepts a false interpretation with exact evidence as provenance, not semantic truth', () => {
    const f = selectedFixture(); f.raw.backwardDependencies.changedState.claim = 'Incorrect causal interpretation deliberately retained as structural evidence.';
    expect(compileCausalPlan(f.p, f.raw).disposition).toBe('selected');
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
  it.each([0, 3])('allows %s genuine strengths and coherent revisions, not immutable wording', count => {
    const f = selectedFixture(), quote = f.original.manuscript.pages[0].text.slice(0, 16);
    f.output.strengths = Array.from({ length: count }, (_, i) => ({ id: `strength${i + 1}`, original: { pageNumber: 1, quote },
      narrativeFunction: 'The child proposes a consequential new action.', disposition: 'coherently_changed', revised: { pageNumber: 1, quote },
      explanation: 'The same function survives a justified scene revision.' }));
    const edit = compileCausalEdit(f.p, f.original, f.output); expect(edit.strengths).toHaveLength(count); expect(edit.runtimeEligible).toBe(false);
  });
  it.each(['four', 'duplicate', 'false_original', 'false_revised', 'stale'])('rejects %s editor evidence', kind => {
    const f = selectedFixture(), q = f.original.manuscript.pages[0].text.slice(0, 16);
    const s = { id: 'strength1', original: { pageNumber: 1, quote: q }, narrativeFunction: 'A consequential child choice prepares the ending.',
      disposition: 'preserved', revised: { pageNumber: 1, quote: q }, explanation: 'The revision retains the proposed story function.' };
    f.output.strengths = kind === 'four' ? [s, s, s, s] : kind === 'duplicate' ? [s, s] : [s];
    if (kind === 'false_original') s.original.quote = 'not in this original';
    if (kind === 'false_revised') s.revised.quote = 'not in this revision';
    if (kind === 'stale') f.output.revision.draftDigest = '0'.repeat(64);
    expect(() => compileCausalEdit(f.p, f.original, f.output)).toThrow();
  });
  it('binds diagnosis evidence and keeps unresolved strength or audit in HOLD', () => {
    const f = selectedFixture(); f.output.diagnosis = [{ scope: 'structure', criterion: 'The ending lacks sufficient causal preparation.',
      evidence: [{ pageNumber: 1, quote: 'never in original' }], problem: 'The rule changes without observable preparation.' }];
    expect(() => compileCausalEdit(f.p, f.original, f.output)).toThrow('editor_evidence');
    f.output.diagnosis = []; f.output.revision.semanticAudit.setup_payoff.outcome = 'unresolved';
    expect(compileCausalEdit(f.p, f.original, f.output).disposition).toBe('held');
  });
  it('isolated critics see only approved brief and their own prose; comparison waits for both readings', async () => {
    const seen: CausalDispatch[] = []; const h = harness(1, call => { seen.push(call);
      const output: any = defaultOutput(call);
      if (call.stage === 'plan') { output.synopsis += ' PLANNING_SECRET'; output.selection.reason += ' REASON_SECRET'; }
      if (call.stage === 'editor') {
        output.diagnosis = [{ scope: 'wording', criterion: 'DIAGNOSIS_SECRET phrase should be clearer.',
          evidence: [{ pageNumber: 1, quote: JSON.parse(call.input).draft.manuscript.pages[0].text.slice(0, 12) }], problem: 'DIAGNOSIS_SECRET unclear phrase from the source.' }];
        output.revision.manuscript.pages[0].text += ' FINAL_ONLY';
      }
      return output; });
    await h.runner.plan(); h.approve(); await h.runner.write();
    const original = seen.find(c => c.stage === 'original_review')!, final = seen.find(c => c.stage === 'final_review')!;
    for (const c of [original, final]) expect(c.input).not.toMatch(/PLANNING_SECRET|REASON_SECRET|DIAGNOSIS_SECRET|semanticAudit|outlineChecks/);
    expect(original.input).not.toContain('FINAL_ONLY'); expect(final.input).toContain('FINAL_ONLY');
    expect(JSON.parse(original.input).packet.brief).toEqual(JSON.parse(final.input).packet.brief);
    expect(seen.map(c => c.stage).slice(-3)).toEqual(['original_review', 'final_review', 'comparison']);
  });
  it.each(['original_review', 'final_review'])('bad %s reading suppresses comparison', async stage => {
    const h = harness(1, c => c.stage === stage ? { packetDigest: '0'.repeat(64), summary: 'A stale independent reading for another text.', findings: [] } : defaultOutput(c));
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
