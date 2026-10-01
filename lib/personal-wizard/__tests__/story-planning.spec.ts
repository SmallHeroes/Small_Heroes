import { describe, expect, it, vi } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import { personalStoryboardFixture, fixtureEditorOutput } from './personal-storyboard-fixture';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { adventureSelectionSchema, adventureSelectionIssue } from '../story-planning-contract';
import { preparePersonalStory, writePersonalStory, StoryPlanningHeldError, assertStoryPlanningHoldBinding, ADVENTURE_SELECTION_INSTRUCTIONS, type StoryCall } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { IntakeLedger } from '../intake-ledger';
import { prepareStoryEdit, compileStoryEdit, assertStoryEditBinding } from '../story-editor';
import { personalStoryResultSchema, storyPlanningHoldSchema } from '../story-contract';
import { editedStoryResultSchema } from '../story-editor-contract';
import { personalProviderSchema } from '../story-openai';
import { storyEditorProviderSchema } from '../story-editor-openai';
import { preparePersonalStoryboard } from '../storyboard';

const options = resolvePersonalWizardOptions();
async function setup(change: (output: any) => void = () => {}) {
  const f = await personalStoryboardFixture(); const prepared = preparePersonalStory(f.request, options);
  const p = { generate: vi.fn(async (call: StoryCall) => {
    const input = JSON.parse(call.input);
    const output = call.stage === 'plan' ? { ...structuredClone(f.draftResult.plan), adventureSelection: fixtureAdventureSelection() }
      : { ...structuredClone(f.draftResult.manuscript), planDigest: input.planDigest };
    if (call.stage === 'plan') change(output);
    return { output, usage: { inputTokens: 100, outputTokens: 50 } };
  }) };
  const ledger = new IntakeLedger();
  const run = () => writePersonalStory({ prepared, userId: 'synthetic', jobId: 's_selection0001',
    settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() }, ledger,
    signal: new AbortController().signal, provider: () => p });
  return { ...f, prepared, p, ledger, run };
}
describe('current planner selection, distinct from literary acceptance', () => {
  it('keeps both proposals and original outline binding with exactly two writer calls', async () => {
    const f = await setup(); const result = await f.run();
    expect(result.planning?.selection).toEqual(fixtureAdventureSelection());
    expect(result.planning?.sourcePlanDigest).toBe(result.planDigest);
    expect(result.plan).not.toHaveProperty('adventureSelection');
    expect(result.accounting.providerCalls).toBe(2); expect(result.runtimeEligible).toBe(false);
    expect(JSON.parse(f.p.generate.mock.calls[1][0].input)).not.toHaveProperty('adventureSelection');
    expect(ADVENTURE_SELECTION_INSTRUCTIONS).toContain('Different scenery');
    expect(ADVENTURE_SELECTION_INSTRUCTIONS).not.toMatch(/Bar|Noa|balloon|football|spoon/);
  });
  it.each([
    ['missing', 'story_plan_invalid'], ['third', 'story_plan_invalid'], ['selected_foreign', 'story_plan_invalid'],
    ['duplicate_id', 'story_selection_identity'], ['duplicate_dimensions', 'story_selection_not_distinct'],
    ['identical', 'story_selection_not_distinct'], ['niqqud', 'story_selection_not_distinct'],
    ['bidi', 'story_selection_not_distinct'], ['zero_width', 'story_selection_not_distinct'], ['scenery_dimension', 'story_plan_invalid'],
    ['cgj', 'story_selection_not_distinct'], ['variation_text', 'story_selection_not_distinct'],
    ['variation_emoji', 'story_selection_not_distinct'], ['variation_supplement', 'story_selection_not_distinct'],
    ['variation_mongolian', 'story_selection_not_distinct'], ['variation_mongolian_four', 'story_selection_not_distinct'],
    ['accent_cgj', 'story_selection_not_distinct'], ['accent_zwj', 'story_selection_not_distinct'],
    ['accent_zwnj', 'story_selection_not_distinct'], ['accent_selector', 'story_selection_not_distinct'],
    ['wide_alef', 'story_selection_not_distinct'], ['presentation_shin', 'story_selection_not_distinct'],
    ['removed_fact', 'story_selection_fact_mismatch'], ['duplicate_fact', 'story_selection_fact_mismatch'],
    ['no_interest', 'story_selection_personal_fact_missing'], ['early_end', 'story_selection_outline_binding'],
    ['foreign_spread', 'story_selection_outline_binding'], ['duplicate_spread', 'story_selection_outline_binding'],
    ['held', 'story_outline_held'],
  ])('rejects %s before manuscript even through a custom provider', async (kind, code) => {
    const f = await setup(output => {
      const s = output.adventureSelection;
      if (kind === 'missing') delete output.adventureSelection;
      if (kind === 'third') s.candidates.push(s.candidates[0]);
      if (kind === 'selected_foreign') s.selectedId = 'C';
      if (kind === 'duplicate_id') s.candidates[1].id = 'A';
      if (kind === 'duplicate_dimensions') s.contrast.dimensions = ['childWant', 'childWant'];
      if (kind === 'identical') s.candidates[1] = { ...s.candidates[0], id: 'B' };
      if (['niqqud', 'bidi', 'zero_width'].includes(kind)) {
        s.candidates[0].childWant = 'למצוא את המכתב';
        s.candidates[1].childWant = kind === 'niqqud' ? 'לִמְצוֹא אֶת הַמִּכְתָּב' : kind === 'bidi' ? '\u202eלמצוא את המכתב\u202c' : 'למצוא\u200b את המכתב';
        s.contrast.dimensions = ['childWant'];
      }
      const invisible = { cgj: '\u034f', variation_text: '\ufe0e', variation_emoji: '\ufe0f',
        variation_supplement: '\u{e0100}', variation_mongolian: '\u180b', variation_mongolian_four: '\u180f' };
      if (kind in invisible) {
        s.candidates[0].childWant = 'למצוא את המכתב';
        s.candidates[1].childWant = `למצוא${invisible[kind as keyof typeof invisible]} את המכתב`;
        s.contrast.dimensions = ['childWant'];
      }
      const accentJoiners = { accent_cgj: '\u034f', accent_zwj: '\u200d', accent_zwnj: '\u200c', accent_selector: '\ufe0f' };
      if (kind in accentJoiners) {
        s.candidates[0].childWant = 'Find café';
        s.candidates[1].childWant = `Find cafe${accentJoiners[kind as keyof typeof accentJoiners]}\u0301`;
        s.contrast.dimensions = ['childWant'];
      }
      if (kind === 'wide_alef' || kind === 'presentation_shin') {
        s.candidates[0].childWant = 'אבקש שי';
        s.candidates[1].childWant = kind === 'wide_alef' ? '\ufb21בקש שי' : 'אבקש \ufb2aי';
        s.contrast.dimensions = ['childWant'];
      }
      if (kind === 'scenery_dimension') s.contrast.dimensions = ['location'];
      if (kind === 'removed_fact') s.candidates[1].personalFactUses[0].factId = 'f_removed';
      if (kind === 'duplicate_fact') s.candidates[1].personalFactUses.push(s.candidates[1].personalFactUses[0]);
      if (kind === 'no_interest') s.candidates[1].personalFactUses[0].factId = 'f_habit000001';
      if (kind === 'early_end') s.outlineChecks.earned_payoff.evidenceSpreads = [1];
      if (kind === 'foreign_spread') s.outlineChecks.causal_child_choices.evidenceSpreads = [16];
      if (kind === 'duplicate_spread') s.outlineChecks.causal_child_choices.evidenceSpreads = [3, 3];
      if (kind === 'held') s.outlineChecks.causal_child_choices.outcome = 'needs_work';
    });
    if (kind === 'no_interest') f.prepared.brief.facts.push({ id: 'f_habit000001', kind: 'habit', value: 'הרגל' });
    const error = await f.run().catch(error => error);
    expect(error.code).toBe(code); expect(error.accounting.providerCalls).toBe(1);
    expect(error.accounting.estimatedUsd).toBe(0.0007);
    expect(f.p.generate).toHaveBeenCalledTimes(1); expect(f.ledger.snapshot().inFlight).toBe(0);
    if (kind === 'held') {
      expect(error).toBeInstanceOf(StoryPlanningHeldError);
      expect(error.planningResult.planning.selection.outlineChecks.causal_child_choices.outcome).toBe('needs_work');
    } else expect(error).not.toHaveProperty('planningResult');
  });
  it.each(['curiosity_and_stakes', 'causal_child_choices', 'earned_payoff'] as const)('retains either candidate and the exact %s HOLD reason but no manuscript authority', async check => {
    const f = await setup(output => { output.adventureSelection.selectedId = 'B'; output.adventureSelection.outlineChecks[check].outcome = 'needs_work'; });
    const error = await f.run().catch(error => error) as StoryPlanningHeldError;
    expect(storyPlanningHoldSchema.safeParse(error.planningResult).success).toBe(true);
    expect(assertStoryPlanningHoldBinding(f.prepared, error.planningResult)).toEqual(error.planningResult);
    expect(error.planningResult.planning.selection.selectedId).toBe('B');
    expect(error.planningResult.planning.selection.outlineChecks[check].outcome).toBe('needs_work');
    expect(personalStoryResultSchema.safeParse(error.planningResult).success).toBe(false);
    expect(() => prepareStoryEdit(f.prepared, error.planningResult as any)).toThrow();
    expect(() => preparePersonalStoryboard(f.request, error.planningResult as any, options)).toThrow();
  });
  it.each(['digest', 'request', 'fact', 'resilience', 'fixture', 'length', 'all_supported', 'identical'])('server HOLD binding rejects forged %s even when the browser shape would be insufficient', async mode => {
    const f = await setup(output => { output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work'; });
    const error = await f.run().catch(error => error); const raw = structuredClone(error.planningResult);
    if (mode === 'digest') raw.plan.childGoal += ' changed';
    if (mode === 'request') raw.requestId = raw.plan.requestId = 'other_request';
    if (mode === 'fact') raw.planning.selection.candidates[1].personalFactUses[0].factId = 'f_removed';
    if (mode === 'resilience') raw.plan.resilience.mode = 'chosen_topic';
    if (mode === 'fixture') raw.containsFixtureData = !raw.containsFixtureData;
    if (mode === 'length') raw.displayPages = 24;
    if (mode === 'all_supported') raw.planning.selection.outlineChecks.earned_payoff.outcome = 'supported';
    if (mode === 'identical') raw.planning.selection.candidates[1] = { ...raw.planning.selection.candidates[0], id: 'B' };
    expect(() => assertStoryPlanningHoldBinding(f.prepared, raw)).toThrow('story_plan_hold_binding');
  });
  it('invalid plan plus needs_work is technical failure, not a retained valid HOLD', async () => {
    const f = await setup(output => { output.beats[0].factIds = ['f_removed']; output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work'; });
    const error = await f.run().catch(error => error);
    expect(error.code).toBe('story_fact_mismatch'); expect(error).not.toHaveProperty('planningResult');
    expect(f.p.generate).toHaveBeenCalledTimes(1);
  });
  it('suppresses an otherwise valid HOLD if the terminal observer cancels before delivery', async () => {
    const f = await setup(output => { output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work'; });
    const controller = new AbortController();
    const events: { outcome: string; code: string | null }[] = [];
    const error = await writePersonalStory({ prepared: f.prepared, userId: 'synthetic', jobId: 's_latecancel001',
      settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() }, ledger: f.ledger,
      signal: controller.signal, provider: () => f.p, record: event => { events.push(event); controller.abort(); } }).catch(error => error);
    expect(error.code).toBe('story_cancelled'); expect(error).not.toHaveProperty('planningResult');
    expect(error.accounting.providerCalls).toBe(1); expect(error.accounting.estimatedUsd).toBe(.0007);
    expect(f.ledger.snapshot().inFlight).toBe(0);
    expect(events[events.length - 1]).toMatchObject({ outcome: 'failed', code: 'story_cancelled' });
  });
  it('does not promote a provider-thrown typed HOLD to an engine-validated planning observation', async () => {
    const f = await setup(output => { output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work'; });
    const genuine = await f.run().catch(error => error);
    const other = await setup(); vi.mocked(other.p.generate).mockRejectedValue(genuine);
    const failure = await other.run().catch(error => error);
    expect(failure.code).toBe('story_provider_failed'); expect(failure).not.toHaveProperty('planningResult');
    expect(other.p.generate).toHaveBeenCalledTimes(1);
  });
  it('requires the selected personal contribution to occur in original outline fact references', () => {
    const s = fixtureAdventureSelection();
    s.candidates[0].personalFactUses.push({ factId: 'f_other', contribution: 'Another approved interest contributes to this idea' });
    expect(adventureSelectionIssue(s, [{ id: 'f_interest0001', kind: 'interest' }, { id: 'f_other', kind: 'interest' }], 8, ['f_interest0001']))
      .toBe('story_selection_plan_fact_missing');
  });
  it('accepts selecting B without confusing candidate order or fact bindings', async () => {
    const f = await setup(output => { output.adventureSelection.selectedId = 'B'; });
    expect((await f.run()).planning?.selection.selectedId).toBe('B');
    expect(f.p.generate).toHaveBeenCalledTimes(2);
  });
  it('cannot prove different plots or truthful causal claims from paraphrased fields', () => {
    const s = fixtureAdventureSelection();
    s.candidates[1] = { ...s.candidates[0], id: 'B', childWant: 'Send the same drawing to the very same cloud' };
    s.contrast.dimensions = ['childWant'];
    expect(adventureSelectionIssue(s, [{ id: 'f_interest0001', kind: 'interest' }], 8, ['f_interest0001'])).toBeNull();
  });
  it('preserves stored wording and non-ignorable accented-letter differences', () => {
    const s = fixtureAdventureSelection();
    s.candidates[0].childWant = 'Find Élan'; s.candidates[1].childWant = 'Find Elan\u034f';
    s.contrast.dimensions = ['childWant']; const before = structuredClone(s);
    expect(adventureSelectionIssue(s, [{ id: 'f_interest0001', kind: 'interest' }], 8, ['f_interest0001'])).toBeNull();
    expect(s).toEqual(before);
  });
  it.each([['café', 'cafe'], ['café', 'cafè'], ['über', 'uber'], ['élève', 'eleve']])('preserves visible accent difference %s / %s without mutating stored text', (a, b) => {
    const s = fixtureAdventureSelection(); s.candidates[0].childWant = `Find ${a}`; s.candidates[1].childWant = `Find ${b}`;
    s.contrast.dimensions = ['childWant']; const before = structuredClone(s);
    expect(adventureSelectionIssue(s, [{ id: 'f_interest0001', kind: 'interest' }], 8, ['f_interest0001'])).toBeNull();
    expect(s).toEqual(before);
  });
  it.each([8, 12, 16])('strict SDK requires both ideas and still admits editor schema for %i spreads', async count => {
    const context = { brief: { beats: count, requestId: 'r_fixture', resilienceMode: 'adventure_only' as const } };
    const format = zodTextFormat(personalProviderSchema('plan', context), 'selection_test');
    expect(format.strict).toBe(true); expect(format.schema.required).toContain('adventureSelection');
    expect(adventureSelectionSchema.safeParse(fixtureAdventureSelection(count)).success).toBe(true);
    const f = await personalStoryboardFixture(count === 8 ? 'short' : count === 12 ? 'medium' : 'long');
    expect(() => zodTextFormat(storyEditorProviderSchema(prepareStoryEdit(preparePersonalStory(f.request, options), f.draftResult)), 'editor_test')).not.toThrow();
  });
  it('preserves selection exactly while editor legitimately changes the final plot', async () => {
    const f = await setup(); const draft = await f.run(); const call = prepareStoryEdit(f.prepared, draft);
    const output = fixtureEditorOutput(call); output.plan.childGoal = 'A new fictional goal after editing';
    const edited = compileStoryEdit(f.prepared, draft, output, null);
    expect(edited.planDigest).not.toBe(draft.planDigest); expect(edited.planning).toEqual(draft.planning);
    expect(editedStoryResultSchema.safeParse(edited).success).toBe(true); expect(() => assertStoryEditBinding(edited)).not.toThrow();
    const before = preparePersonalStoryboard(f.request, edited, options);
    edited.planning!.selection.reason += ' Another declared justification.';
    const after = preparePersonalStoryboard(f.request, edited, options);
    expect(after.sourceDigest).not.toBe(before.sourceDigest);
  });
  it('rejects stale selection binding but keeps genuinely receipt-free archives diagnostic', async () => {
    const f = await setup(); const draft = await f.run();
    const { planning: _receipt, ...legacy } = draft;
    expect(personalStoryResultSchema.safeParse(legacy).success).toBe(true);
    expect(() => preparePersonalStoryboard(f.request, legacy, options)).not.toThrow();
    draft.planning!.sourcePlanDigest = 'a'.repeat(64);
    expect(personalStoryResultSchema.safeParse(draft).success).toBe(false);
    expect(() => prepareStoryEdit(f.prepared, draft)).toThrow();
  });
  it('editor preflight rechecks a syntactically valid held selection before any editor call', async () => {
    const f = await setup(); const draft = await f.run();
    draft.planning!.selection.outlineChecks.causal_child_choices.outcome = 'needs_work';
    expect(personalStoryResultSchema.safeParse(draft).success).toBe(true);
    expect(() => prepareStoryEdit(f.prepared, draft)).toThrow('story_editor_source_binding');
    expect(f.p.generate).toHaveBeenCalledTimes(2);
  });
  it('does not alias the original proposal receipt into the edited result', async () => {
    const f = await setup(); const draft = await f.run(); const original = structuredClone(draft.planning);
    const edited = compileStoryEdit(f.prepared, draft, fixtureEditorOutput(prepareStoryEdit(f.prepared, draft)), null);
    draft.planning!.selection.reason += ' Mutated after the edit';
    expect(edited.planning).toEqual(original);
  });
  it('rejects edited stale receipts and accepts a genuinely receipt-free edited archive at the bridge', async () => {
    const f = await setup(); const draft = await f.run();
    const edited = compileStoryEdit(f.prepared, draft, fixtureEditorOutput(prepareStoryEdit(f.prepared, draft)), null);
    const { planning: _receipt, ...legacy } = structuredClone(edited);
    expect(editedStoryResultSchema.safeParse(legacy).success).toBe(true);
    expect(() => preparePersonalStoryboard(f.request, legacy, options)).not.toThrow();
    edited.planning!.sourcePlanDigest = 'a'.repeat(64);
    expect(editedStoryResultSchema.safeParse(edited).success).toBe(false);
    expect(() => assertStoryEditBinding(edited)).toThrow();
    expect(() => preparePersonalStoryboard(f.request, edited, options)).toThrow();
  });
});
