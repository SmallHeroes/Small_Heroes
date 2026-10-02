import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));
vi.mock('openai', () => ({ default: class {
  responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); }
} }));
import { personalStoryboardFixture, fixtureEditorOutput } from './personal-storyboard-fixture';
import { storyEditorOutputTokens } from '../story-editor';
import { generatePersonalBook, PersonalBookError, PersonalBookPlanningHeldError, PERSONAL_BOOK_REVIEW_INSTRUCTION, type PersonalBookProvider, type BookVisualCall } from '../book-runner';
import { resolvePersonalWizardOptions, PROTOTYPE_COMPANION_ROSTER } from '../options';
import { BOOK_LIMITS, personalBookOutputLimits, personalBookReservationUsd, resolvePersonalBookSettings, type PersonalBookSettings } from '../book-config';
import { IntakeLedger } from '../intake-ledger';
import { generationTimeoutMs, personalStoryOutputLimits } from '../story-config';
import { createPersonalBookProvider, decodePersonalBookProviderOutput, personalBookProviderSchema } from '../book-openai';
import { STORYBOARD_BOOK_CHECKS, STORYBOARD_FRAME_CHECKS } from '../storyboard';
import * as storyWriter from '../story-writer';
import * as storyEditor from '../story-editor';
import * as characterAuthority from '../companion-character';
import { canonicalJson } from '../request-acceptance';
import { storyPlanningHoldSchema } from '../story-contract';

const options = resolvePersonalWizardOptions();
const settings: PersonalBookSettings = { model: 'gpt-6-sol', budgetUsd: 5, maxJobs: 3, operators: new Set(['test@example.com']) };
beforeEach(() => { sdk.create.mockReset(); sdk.options = []; });
afterEach(() => vi.restoreAllMocks());
async function setup(length = 'short', companion = 'dragon_dini') {
  const f = await personalStoryboardFixture(length, companion);
  const provider: PersonalBookProvider = {
    story: { generate: vi.fn(async call => ({ output: structuredClone(call.stage === 'plan' ? { ...f.result.plan, adventureSelection: f.draftResult.planning!.selection } : f.result.manuscript), usage: { inputTokens: 100, outputTokens: 200 } })) },
    editor: { generate: vi.fn(async call => ({ output: fixtureEditorOutput(call), usage: { inputTokens: 100, outputTokens: 200 } })) },
    visual: { generate: vi.fn(async call => ({ output: structuredClone(call.stage === 'storyboard' ? f.draft : f.review), usage: { inputTokens: 300, outputTokens: 400 } })) },
  };
  const factory = vi.fn(() => provider); const ledger = new IntakeLedger(); const controller = new AbortController();
  const args = { request: f.request, options, userId: 'synthetic_user', operatorEmail: 'test@example.com', jobId: 'book_job0001',
    settings, ledger, provider: factory, signal: controller.signal };
  return { ...f, provider, factory, ledger, controller, args };
}
const errorOf = async (promise: Promise<unknown>): Promise<PersonalBookError> => {
  try { await promise; throw Error('expected rejection'); } catch (error) { expect(error).toBeInstanceOf(PersonalBookError); return error as PersonalBookError; }
};

describe('automatic personal manuscript -> full storyboard -> separate semantic review', () => {
  it.each(['short', 'medium', 'long'])('returns the complete edited %s story after only three stages', async length => {
    const f = await setup(length);
    const result = await generatePersonalBook({ ...f.args, scope: 'story_only' });
    expect(result).toMatchObject({ version: 'personal-book-text/diagnostic-v1', status: 'story_ready_for_reading', runtimeEligible: false });
    expect(result.writerResult.manuscript.pages).toHaveLength(f.result.manuscript.pages.length);
    expect(result.writerResult.editing.original.manuscript).toEqual(f.draftResult.manuscript);
    expect(result.accounting.stages.map(row => row.stage)).toEqual(['plan', 'manuscript', 'editor']);
    expect(result.accounting).toMatchObject({ providerAttempts: 3, reservedUsd: personalBookReservationUsd(settings.model, f.book.narrativeSpreads, 'story_only') });
    expect(f.provider.visual.generate).not.toHaveBeenCalled();
    for (const key of ['storyboard', 'review', 'framePackets']) expect(result).not.toHaveProperty(key);
    expect(f.ledger.snapshot()).toMatchObject({ jobs: 1, inFlight: 0, reservedTotalUsd: result.accounting.reservedUsd });
    expect((await errorOf(generatePersonalBook({ ...f.args, scope: 'storyboard' }))).code).toBe('book_duplicate_job');
    expect(f.provider.story.generate).toHaveBeenCalledTimes(2);
  });
  it('preserves an editorial HOLD in story-only mode without visual dispatch', async () => {
    const f = await setup(); vi.mocked(f.provider.editor.generate).mockImplementation(async call => {
      const output = fixtureEditorOutput(call); output.checks.causal_magic.outcome = 'needs_work';
      return { output, usage: null };
    });
    const failure = await errorOf(generatePersonalBook({ ...f.args, scope: 'story_only' }));
    expect(failure.code).toBe('book_editorial_held'); expect(failure.writerResult).toHaveProperty('editing.original');
    expect(failure.accounting).toMatchObject({ providerAttempts: 3, estimatedUsd: null });
    expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('retains a one-call planner HOLD in story-only mode', async () => {
    const f = await setup(); const output = { ...f.draftResult.plan, adventureSelection: structuredClone(f.draftResult.planning!.selection) };
    output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work';
    vi.mocked(f.provider.story.generate).mockResolvedValue({ output, usage: null });
    const failure = await errorOf(generatePersonalBook({ ...f.args, scope: 'story_only' }));
    expect(failure).toBeInstanceOf(PersonalBookPlanningHeldError); expect(failure.accounting?.providerAttempts).toBe(1);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'source'])('suppresses a text result when the completion observer triggers %s', async mode => {
    const f = await setup(); const finish = vi.spyOn(f.ledger, 'finish');
    const failure = await errorOf(generatePersonalBook({ ...f.args, scope: 'story_only', record: event => {
      if (event.stage === 'complete') { if (mode === 'cancel') f.controller.abort(); else f.request.child.name = 'בר'; }
    } }));
    expect(failure.code).toBe(mode === 'cancel' ? 'book_cancelled' : 'book_source_changed');
    expect(failure.writerResult).toBeUndefined(); expect(failure.accounting?.providerAttempts).toBe(3);
    expect(finish.mock.calls.map(call => call[2])).toEqual(['failed']);
  });
  it.each((['supported', 'uncertain', 'contradiction'] as const).flatMap(verdict =>
    (['cancel', 'source', 'character'] as const).map(mode => ({ verdict, mode }))))(
    'suppresses full $verdict delivery after completion observer $mode', async ({ verdict, mode }) => {
      const f = await setup(); const finish = vi.spyOn(f.ledger, 'finish');
      if (verdict !== 'supported') f.review.bookChecks[0].verdict = verdict as any;
      const changed = characterAuthority.resolvePersonalCompanionCharacter(f.request.companion.id)!;
      changed.essence += ' A synthetic change in server character authority.';
      const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => {
        if (event.stage === 'complete') {
          if (mode === 'cancel') f.controller.abort();
          else if (mode === 'source') f.request.child.name = 'בר';
          else vi.spyOn(characterAuthority, 'resolvePersonalCompanionCharacter').mockReturnValue(changed);
        }
      } }));
      expect(failure.code).toBe(mode === 'cancel' ? 'book_cancelled' : 'book_source_changed');
      expect(failure.writerResult).toBeUndefined(); expect(failure).not.toHaveProperty('framePackets');
      expect(failure.accounting).toMatchObject({ providerAttempts: 5, reservedUsd: personalBookReservationUsd(settings.model, 8) });
      expect(finish.mock.calls.map(call => call[2])).toEqual(['failed']);
      expect(f.ledger.snapshot().inFlight).toBe(0);
    });
  it.each(['supported', 'uncertain', 'contradiction'] as const)('ignores throwing completion telemetry without corrupting $verdict accounting', async verdict => {
    const f = await setup();
    if (verdict !== 'supported') (f.review.bookChecks[0] as { verdict: 'supported' | 'uncertain' | 'contradiction' }).verdict = verdict;
    const finish = vi.spyOn(f.ledger, 'finish');
    const result = await generatePersonalBook({ ...f.args, record: event => {
      if (event.stage === 'complete') { event.accounting.providerAttempts = 999; event.accounting.stages.pop(); throw Error('PRIVATE_OBSERVER'); }
    } });
    expect(result.status).toBe(verdict === 'supported' ? 'review_supported' : `held_${verdict}`);
    expect(result.framePackets).toHaveLength(verdict === 'supported' ? 9 : 0);
    expect(result.accounting.providerAttempts).toBe(5); expect(result.accounting.stages).toHaveLength(5);
    expect(finish.mock.calls.map(call => call[2])).toEqual(['done']);
  });
  it('refuses an unknown scope before ledger or provider', async () => {
    const f = await setup(); await expect(generatePersonalBook({ ...f.args, scope: 'unknown' as any })).rejects.toThrow('book_scope_invalid');
    expect(f.factory).not.toHaveBeenCalled(); expect(f.ledger.snapshot().jobs).toBe(0);
  });
  it.each((['story_only', 'storyboard'] as const).flatMap(scope => (['cancel', 'source'] as const).map(mode => ({ scope, mode }))))(
    'suppresses $scope editorial partial prose after a $mode failure observer', async ({ scope, mode }) => {
    const f = await setup(); vi.mocked(f.provider.editor.generate).mockImplementation(async call => {
      const output = fixtureEditorOutput(call); output.checks.causal_magic.outcome = 'needs_work';
      return { output, usage: { inputTokens: 50, outputTokens: 60 } };
    });
    const failure = await errorOf(generatePersonalBook({ ...f.args, scope, record: event => {
      if (event.code === 'book_editorial_held') {
        if (mode === 'cancel') f.controller.abort(); else f.request.child.name = 'בר';
      }
    } }));
    expect(failure.code).toBe(mode === 'cancel' ? 'book_cancelled' : 'book_source_changed');
    expect(failure.writerResult).toBeUndefined(); expect(failure).not.toHaveProperty('planningResult');
    expect(failure.accounting).toMatchObject({ providerAttempts: 3, estimatedUsd: .0051 });
    expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it.each(['story_only', 'storyboard'] as const)('enforces the $scope call cap at concurrent invocation, not only preflight', async scope => {
    const f = await setup(); const cap = scope === 'story_only' ? 3 : 5;
    let settled: PromiseSettledResult<unknown>[] = [];
    vi.spyOn(storyWriter, 'writePersonalStory').mockImplementationOnce(async args => {
      const subordinate = args.provider();
      settled = await Promise.allSettled(Array.from({ length: cap + 2 }, () => subordinate.generate(args.prepared.call, args.signal)));
      return f.draftResult;
    });
    const failure = await errorOf(generatePersonalBook({ ...f.args, scope }));
    expect(settled.filter(row => row.status === 'fulfilled')).toHaveLength(cap);
    expect(settled.filter(row => row.status === 'rejected')).toHaveLength(2);
    expect(f.provider.story.generate).toHaveBeenCalledTimes(cap);
    expect(failure.accounting?.providerAttempts).toBe(cap);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect(f.ledger.snapshot()).toMatchObject({ inFlight: 0, reservedTotalUsd: failure.accounting!.reservedUsd });
  });
  it('seals accounting after the earlier subordinate writer deadline, with the root still active', async () => {
    const f = await setup(); let complete!: (answer: { output: unknown; usage: { inputTokens: number; outputTokens: number } }) => void;
    let signal!: AbortSignal;
    vi.mocked(f.provider.story.generate).mockImplementation((_call, observed) => { signal = observed; return new Promise(resolve => { complete = resolve; }); });
    const events: unknown[] = []; vi.useFakeTimers();
    try {
      const pending = errorOf(generatePersonalBook({ ...f.args, scope: 'story_only', record: event => events.push(event) }));
      await vi.advanceTimersByTimeAsync(generationTimeoutMs(personalStoryOutputLimits(8).planOutputTokens));
      const failure = await pending;
      expect(failure.code).toBe('book_timeout'); expect(signal.aborted).toBe(true); expect(f.controller.signal.aborted).toBe(false);
      const before = structuredClone({ events, accounting: failure.accounting });
      complete({ output: { ...f.draftResult.plan, adventureSelection: f.draftResult.planning!.selection }, usage: { inputTokens: 100, outputTokens: 200 } });
      await vi.advanceTimersByTimeAsync(1);
      expect({ events, accounting: failure.accounting }).toEqual(before);
      expect(failure.accounting).toMatchObject({ providerAttempts: 1, estimatedUsd: null });
      expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('retains a validated plan-only HOLD after one paid attempt before all later stages', async () => {
    const f = await setup(); const output = { ...f.draftResult.plan, adventureSelection: structuredClone(f.draftResult.planning!.selection) };
    output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work';
    vi.mocked(f.provider.story.generate).mockResolvedValue({ output, usage: { inputTokens: 100, outputTokens: 200 } });
    const events: unknown[] = [];
    const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => events.push(event) }));
    expect(failure).toBeInstanceOf(PersonalBookPlanningHeldError);
    expect(failure.code).toBe('book_outline_held'); expect(failure.accounting?.providerAttempts).toBe(1);
    const held = (failure as PersonalBookPlanningHeldError).planningResult;
    expect(held.planning.selection).toEqual(output.adventureSelection);
    expect(held.plan).toEqual(f.draftResult.plan); expect(held.runtimeEligible).toBe(false);
    expect(events[events.length - 1]).toMatchObject({ stage: 'plan', outcome: 'held', code: 'book_outline_held' });
    expect(JSON.stringify(events)).not.toContain(held.plan.title);
    expect(failure.accounting?.estimatedUsd).toBeGreaterThan(0);
    expect(f.provider.story.generate).toHaveBeenCalledTimes(1);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect(failure.writerResult).toBeUndefined(); expect(failure).not.toHaveProperty('framePackets'); expect(f.ledger.snapshot().inFlight).toBe(0);
    expect((await errorOf(generatePersonalBook(f.args))).code).toBe('book_duplicate_job');
    expect(f.provider.story.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['short', 'medium', 'long'])('keeps unknown usage unknown for a %s plan HOLD without refund or retry', async length => {
    const f = await setup(length); const output = { ...f.draftResult.plan, adventureSelection: structuredClone(f.draftResult.planning!.selection) };
    output.adventureSelection.selectedId = 'B'; output.adventureSelection.outlineChecks.causal_child_choices.outcome = 'needs_work';
    vi.mocked(f.provider.story.generate).mockResolvedValue({ output, usage: null });
    const failure = await errorOf(generatePersonalBook(f.args)) as PersonalBookPlanningHeldError;
    expect(failure.code).toBe('book_outline_held'); expect(failure.planningResult.planning.selection.selectedId).toBe('B');
    expect(failure.planningResult.plan.beats).toHaveLength(length === 'short' ? 8 : length === 'medium' ? 12 : 16);
    expect(failure.accounting).toMatchObject({ providerAttempts: 1, estimatedUsd: null, knownUsageEstimateUsd: 0 });
    expect(f.ledger.snapshot()).toMatchObject({ inFlight: 0, reservedTotalUsd: failure.accounting!.reservedUsd });
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
  });
  it.each(['source_finished', 'cancel_finished', 'source_held', 'cancel_held'])('suppresses HOLD evidence when %s happens in an observer before delivery', async mode => {
    const f = await setup(); const output = { ...f.draftResult.plan, adventureSelection: structuredClone(f.draftResult.planning!.selection) };
    output.adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work';
    vi.mocked(f.provider.story.generate).mockResolvedValue({ output, usage: { inputTokens: 100, outputTokens: 200 } });
    const events: { stage: string; outcome: string; code: string | null }[] = [];
    const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => {
      events.push(event);
      if (event.stage === 'plan' && event.outcome === (mode.endsWith('finished') ? 'finished' : 'held')) {
        if (mode.startsWith('source')) f.request.child.name = 'בר'; else f.controller.abort();
      }
    } }));
    expect(failure.code).toBe(mode.startsWith('source') ? 'book_source_changed' : 'book_cancelled');
    expect(failure).not.toHaveProperty('planningResult'); expect(failure.writerResult).toBeUndefined();
    expect(failure).not.toHaveProperty('framePackets'); expect(failure.accounting?.providerAttempts).toBe(1);
    expect(failure.accounting?.estimatedUsd).toBeCloseTo(.0022); expect(f.ledger.snapshot().inFlight).toBe(0);
    expect(events[events.length - 1]).toMatchObject({ stage: 'plan', outcome: 'failed', code: failure.code });
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
  });
  it('never treats a bare outline error code or invalid subordinate hold as validated evidence', async () => {
    for (const mode of ['code', 'forged']) {
      const f = await setup();
      vi.spyOn(storyWriter, 'writePersonalStory').mockRejectedValueOnce(mode === 'code'
        ? new storyWriter.StoryWriterError('story_outline_held')
        : new storyWriter.StoryPlanningHeldError({ ...f.draftResult, status: 'planning_held' } as any));
      const failure = await errorOf(generatePersonalBook(f.args));
      expect(failure.code).toBe('book_story_invalid'); expect(failure).not.toHaveProperty('planningResult');
      expect(failure.accounting?.providerAttempts).toBe(0); expect(f.provider.editor.generate).not.toHaveBeenCalled();
      expect(f.provider.visual.generate).not.toHaveBeenCalled();
    }
  });
  it('rejects even structurally valid subordinate HOLD evidence without its one plan dispatch', async () => {
    const f = await setup(); const selection = structuredClone(f.draftResult.planning!);
    selection.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
    const { requestId, plan, planDigest, displayPages, containsFixtureData } = f.draftResult;
    vi.spyOn(storyWriter, 'writePersonalStory').mockRejectedValueOnce(new storyWriter.StoryPlanningHeldError({
      version: 'personal-story-plan-hold/diagnostic-v1', status: 'planning_held', requestId, plan, planDigest,
      displayPages, containsFixtureData, planning: selection, runtimeEligible: false,
    }));
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe('book_story_invalid'); expect(failure).not.toHaveProperty('planningResult');
    expect(failure.accounting?.providerAttempts).toBe(0); expect(f.provider.story.generate).not.toHaveBeenCalled();
  });
  it.each(['matched', 'other_request', 'wrong_digest'] as const)('rebinds %s subordinate HOLD evidence after exactly one real runner dispatch', async mode => {
    const f = await setup(); const planning = structuredClone(f.draftResult.planning!);
    planning.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
    const { requestId, plan, planDigest, displayPages, containsFixtureData } = f.draftResult;
    const held = storyPlanningHoldSchema.parse({
      version: 'personal-story-plan-hold/diagnostic-v1', status: 'planning_held', requestId,
      plan: structuredClone(plan), planDigest, displayPages, containsFixtureData, planning, runtimeEligible: false,
    });
    if (mode === 'other_request') {
      const otherRequest = structuredClone(f.request); otherRequest.draftRevision += 1;
      const otherPrepared = storyWriter.preparePersonalStory(otherRequest, options);
      expect(otherPrepared.accepted.requestId).not.toBe(requestId);
      held.requestId = held.plan.requestId = otherPrepared.accepted.requestId;
      held.planDigest = createHash('sha256').update(canonicalJson(held.plan)).digest('hex');
      held.planning.sourcePlanDigest = held.planDigest;
      expect(storyWriter.assertStoryPlanningHoldBinding(otherPrepared, held)).toEqual(held);
    } else if (mode === 'wrong_digest') {
      held.plan.childGoal += ' changed after hashing';
      expect(createHash('sha256').update(canonicalJson(held.plan)).digest('hex')).not.toBe(held.planDigest);
    }
    // All cases pass display validation; only the runner's approved-request binding distinguishes them.
    expect(storyPlanningHoldSchema.safeParse(held).success).toBe(true);
    vi.spyOn(storyWriter, 'writePersonalStory').mockImplementationOnce(async args => {
      await args.provider().generate(args.prepared.call, args.signal);
      throw new storyWriter.StoryPlanningHeldError(held);
    });
    const events: { stage: string; outcome: string; code: string | null }[] = [];
    const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => events.push(event) }));
    const valid = mode === 'matched';
    expect(failure.code).toBe(valid ? 'book_outline_held' : 'book_story_invalid');
    if (valid) expect((failure as PersonalBookPlanningHeldError).planningResult).toEqual(held);
    else { expect(failure).not.toBeInstanceOf(PersonalBookPlanningHeldError); expect(failure).not.toHaveProperty('planningResult'); }
    expect(failure.writerResult).toBeUndefined(); expect(failure).not.toHaveProperty('framePackets');
    expect(failure.accounting).toMatchObject({ providerAttempts: 1, stages: [{ stage: 'plan', usage: { inputTokens: 100, outputTokens: 200 } }] });
    expect(failure.accounting?.estimatedUsd).toBeCloseTo(.0022);
    expect(events[events.length - 1]).toMatchObject({ stage: 'plan', outcome: valid ? 'held' : 'failed', code: failure.code });
    expect(f.ledger.snapshot()).toMatchObject({ inFlight: 0, reservedTotalUsd: failure.accounting!.reservedUsd });
    expect(f.provider.story.generate).toHaveBeenCalledTimes(1);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect((await errorOf(generatePersonalBook(f.args))).code).toBe('book_duplicate_job');
    expect(f.provider.story.generate).toHaveBeenCalledTimes(1);
  });
  it('diagnoses the real editor input limit after exactly two completed writer calls', async () => {
    const f = await setup('long'); const plan = structuredClone(f.draftResult.plan);
    // The richer brief must still fit writer preflight; the combined manuscript + plan
    // must exceed editor preflight. Keep this a real boundary, not a mocked exception.
    for (const beat of plan.beats) for (const key of ['location', 'transitionReason', 'childAction', 'companionAction', 'consequence', 'continuity'] as const) beat[key] = 'x'.repeat(300);
    vi.mocked(f.provider.story.generate).mockImplementation(async call => {
      expect(Buffer.byteLength(call.instructions + call.input, 'utf8')).toBeLessThanOrEqual(52_000);
      return {
        output: call.stage === 'plan' ? { ...plan, adventureSelection: f.draftResult.planning!.selection } : { ...f.draftResult.manuscript, planDigest: JSON.parse(call.input).planDigest,
          pages: f.draftResult.manuscript.pages.map(page => ({ ...page, text: 'x'.repeat(1500) })) },
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });
    const events: { stage: string; outcome: string; code: string | null }[] = [];
    const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => events.push(event) }));
    expect(failure.code).toBe('book_editor_input_limit'); expect(failure.accounting?.providerAttempts).toBe(2);
    expect(events[events.length - 1]).toMatchObject({ stage: 'editor', outcome: 'failed', code: 'book_editor_input_limit' });
    expect(failure.writerResult?.manuscript.pages).toHaveLength(16);
    expect(f.provider.story.generate).toHaveBeenCalledTimes(2);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it.each(['input_limit', 'source_binding', 'unrecognised'] as const)('keeps paid draft and bounded diagnosis for editor preflight %s', async code => {
    const f = await setup();
    vi.spyOn(storyEditor, 'prepareStoryEdit').mockImplementation(() => {
      if (code === 'unrecognised') throw Error('PRIVATE_PREFLIGHT_SENTINEL');
      throw new storyEditor.StoryEditorError(code);
    });
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe(code === 'unrecognised' ? 'book_editor_invalid' : `book_editor_${code}`);
    expect(failure.accounting?.providerAttempts).toBe(2);
    expect(failure.writerResult?.manuscript).toEqual(f.draftResult.manuscript);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect(f.ledger.snapshot().inFlight).toBe(0);
    expect(JSON.stringify(failure)).not.toContain('PRIVATE_PREFLIGHT_SENTINEL');
  });
  it('refuses a sixth dispatch from a faulty subordinate writer before invoking the provider', async () => {
    const f = await setup();
    vi.spyOn(storyWriter, 'writePersonalStory').mockImplementation(async args => {
      const subordinate = args.provider();
      for (let i = 0; i < 6; i++) await subordinate.generate(args.prepared.call, args.signal);
      return f.draftResult;
    });
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.accounting?.providerAttempts).toBe(5);
    expect(f.provider.story.generate).toHaveBeenCalledTimes(5);
    expect(f.provider.editor.generate).not.toHaveBeenCalled(); expect(f.provider.visual.generate).not.toHaveBeenCalled();
    expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('holds an unresolved edit after exactly three calls and keeps the edited text plus original', async () => {
    const f = await setup(); vi.mocked(f.provider.editor.generate).mockImplementation(async call => {
      const output = fixtureEditorOutput(call); output.checks.causal_magic.outcome = 'needs_work';
      return { output, usage: { inputTokens: 50, outputTokens: 60 } };
    });
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe('book_editorial_held'); expect(failure.accounting?.providerAttempts).toBe(3);
    expect(failure.writerResult).toHaveProperty('editing.original'); expect(failure).not.toHaveProperty('framePackets');
    expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
    expect((await errorOf(generatePersonalBook(f.args))).code).toBe('book_duplicate_job');
  });
  it('invalid editing retains only the original paid draft and does not retry or call the storyboard', async () => {
    const f = await setup(); vi.mocked(f.provider.editor.generate).mockResolvedValue({ output: {}, usage: { inputTokens: 20, outputTokens: 30 } });
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe('book_editor_invalid'); expect(failure.accounting?.providerAttempts).toBe(3);
    expect(failure.writerResult?.manuscript).toEqual(f.draftResult.manuscript);
    expect(failure.writerResult).not.toHaveProperty('editing'); expect(f.provider.visual.generate).not.toHaveBeenCalled();
  });
  it('rejects parent edits during editing with no stale partial result', async () => {
    const f = await setup(); vi.mocked(f.provider.editor.generate).mockImplementation(async call => {
      f.request.child.name = 'בר'; return { output: fixtureEditorOutput(call), usage: null };
    });
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe('book_source_changed'); expect(failure.writerResult).toBeUndefined();
    expect(failure.accounting?.providerAttempts).toBe(3); expect(f.provider.visual.generate).not.toHaveBeenCalled();
  });
  it('cancels a non-cooperating editor and preserves no cancelled prose or late accounting changes', async () => {
    const f = await setup(); let complete!: (value: { output: unknown; usage: null }) => void;
    vi.mocked(f.provider.editor.generate).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const failure = await errorOf(generatePersonalBook({ ...f.args, record: event => {
      if (event.stage === 'editor' && event.outcome === 'started') f.controller.abort();
    } }));
    const before = structuredClone(failure.accounting);
    complete({ output: {}, usage: null }); await Promise.resolve(); await Promise.resolve();
    expect(failure.accounting).toEqual(before); expect(failure.code).toBe('book_cancelled');
    expect(failure.writerResult).toBeUndefined(); expect(failure.accounting?.providerAttempts).toBe(3);
    expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it.each(['short', 'medium', 'long'])('bounds the %s editor at its own deadline', async length => {
    const f = await setup(length); vi.mocked(f.provider.editor.generate).mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = errorOf(generatePersonalBook(f.args)).then(error => { settled = true; return error; });
      const deadline = generationTimeoutMs(storyEditorOutputTokens(f.book.narrativeSpreads));
      await vi.advanceTimersByTimeAsync(deadline - 1); expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1); const failure = await pending;
      expect(failure.code).toBe('book_timeout'); expect(failure.accounting?.providerAttempts).toBe(3);
      expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('retains completed prose after a later failure, but never returns frame packets', async () => {
    const f = await setup(); vi.mocked(f.provider.visual.generate).mockRejectedValue(Error('private'));
    const failure = await errorOf(generatePersonalBook(f.args));
    expect(failure.code).toBe('book_provider_failed'); expect(failure.writerResult?.manuscript).toEqual(f.result.manuscript);
    expect(failure.accounting?.providerAttempts).toBe(4); expect(failure).not.toHaveProperty('framePackets');
  });
  it.each([['short', 8, 16], ['medium', 12, 24], ['long', 16, 32]])('runs all five stages in one job for %s', async (length, count, display) => {
    const f = await setup(length as string); const events: unknown[] = [];
    const result = await generatePersonalBook({ ...f.args, record: event => events.push(event) });
    expect(result.status).toBe('review_supported'); expect(result.runtimeEligible).toBe(false);
    expect(result.storyboard.narrativeSpreads).toBe(count); expect(result.storyboard.displayPages).toBe(display);
    expect(result.framePackets).toHaveLength((count as number) + 1);
    expect(result.accounting.providerAttempts).toBe(5);
    expect(result.accounting.stages.map(row => row.stage)).toEqual(['plan', 'manuscript', 'editor', 'storyboard', 'review']);
    expect(result.accounting.estimatedUsd).toBeCloseTo(.0158);
    expect(result.accounting.reservedUsd).toBe(personalBookReservationUsd(settings.model, count as number));
    expect(f.ledger.snapshot()).toEqual({ jobs: 1, inFlight: 0, reservedTotalUsd: result.accounting.reservedUsd });
    const visualCalls = vi.mocked(f.provider.visual.generate).mock.calls;
    const manuscriptCall = vi.mocked(f.provider.story.generate).mock.calls.find(([call]) => call.stage === 'manuscript')![0];
    const manuscriptInput = JSON.parse(manuscriptCall.input);
    expect(manuscriptInput.outputMapping.items).toEqual(Array.from({ length: count as number }, (_, i) => ({ outputArrayIndex: i, planBeatNumber: i + 1 })));
    expect(manuscriptInput.outputMapping.unit).toBe('complete_narrative_spread_not_display_page');
    expect(manuscriptInput.outputMapping.finalItem).toEqual({ outputArrayIndex: (count as number) - 1, requiredResolution: f.result.plan.ending });
    expect(manuscriptInput.task).toContain('full action AND consequence');
    const limits = personalBookOutputLimits(count as number);
    expect(visualCalls.map(([call]) => call.maxOutputTokens)).toEqual([limits.storyboardOutputTokens, limits.reviewOutputTokens]);
    expect(JSON.parse(visualCalls[0][0].input).story.pages).toEqual(result.writerResult.manuscript.pages);
    expect(JSON.parse(visualCalls[0][0].input).narrativePlan.ending).toBe(f.result.plan.ending);
    expect(JSON.parse(visualCalls[1][0].input).manuscript.pages).toHaveLength(count as number);
    expect(visualCalls[1][0].instructions).toContain('quotation occurring in prose does NOT prove');
    expect(visualCalls[1][0].instructions).toContain('age-appropriate Hebrew');
    expect(JSON.stringify(events)).not.toMatch(/נועה|אודם|wooden hut|test@example/);
    for (const packet of result.framePackets) expect(packet.render.contextSha).toBe(packet.qa.contextSha);
  });
  it.each(PROTOTYPE_COMPANION_ROSTER)('uses chosen %s without inheriting its legacy topic', async companion => {
    const f = await setup('short', companion); const result = await generatePersonalBook(f.args);
    expect(result.writerResult.runtimeEligible).toBe(false);
    expect(result.framePackets[1].context.companion.id).toBe(companion);
    expect(JSON.parse(vi.mocked(f.provider.visual.generate).mock.calls[0][0].input).selectedTopic).toBeNull();
  });
  it.each(['uncertain', 'contradiction'] as const)('holds a %s report without packets or repair calls', async verdict => {
    const f = await setup(); f.review.bookChecks[0].verdict = verdict as 'supported';
    const result = await generatePersonalBook(f.args);
    expect(result.status).toBe(`held_${verdict}`); expect(result.framePackets).toEqual([]);
    expect(result.review.review.bookChecks[0].verdict).toBe(verdict); expect(result.accounting.providerAttempts).toBe(5);
  });
  it('rejects invalid request before ledger/provider construction', async () => {
    const f = await setup(); await expect(generatePersonalBook({ ...f.args, request: { ...f.request, apiKey: 'SENTINEL' } })).rejects.toThrow('story_invalid_request');
    expect(f.factory).not.toHaveBeenCalled(); expect(f.ledger.snapshot().jobs).toBe(0);
  });
  it.each(['operator', 'budget', 'jobs', 'cancelled'])('rejects %s before constructing a provider', async kind => {
    const f = await setup();
    if (kind === 'operator') f.args.operatorEmail = 'unknown@example.com';
    if (kind === 'budget') f.args.settings = { ...settings, budgetUsd: personalBookReservationUsd(settings.model, 8) - .001 };
    if (kind === 'jobs') f.args.settings = { ...settings, maxJobs: 1 };
    if (kind === 'cancelled') f.controller.abort();
    if (kind === 'jobs') { await generatePersonalBook(f.args); f.args.jobId = 'book_job0002'; f.factory.mockClear(); }
    await expect(generatePersonalBook(f.args)).rejects.toThrow(); expect(f.factory).not.toHaveBeenCalled();
  });
  it('never reconstructs or rebills a duplicate job', async () => {
    const f = await setup(); await generatePersonalBook(f.args); f.factory.mockClear();
    expect((await errorOf(generatePersonalBook(f.args))).code).toBe('book_duplicate_job'); expect(f.factory).not.toHaveBeenCalled();
  });
  it('holds one user lock for the ENTIRE chain, not one per stage', async () => {
    const f = await setup(); let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(f.provider.story.generate).mockImplementation(async call => {
      if (call.stage === 'plan') await gate;
      return { output: structuredClone(call.stage === 'plan' ? { ...f.result.plan, adventureSelection: f.draftResult.planning!.selection } : f.result.manuscript), usage: null };
    });
    const first = generatePersonalBook(f.args); await Promise.resolve(); await Promise.resolve();
    expect((await errorOf(generatePersonalBook({ ...f.args, jobId: 'book_job0002' }))).code).toBe('book_user_busy');
    release(); await first; expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it.each(['plan', 'storyboard', 'review'] as const)('stops after invalid %s with the paid attempt retained', async stage => {
    const f = await setup();
    if (stage === 'plan') f.result.plan.beats[1].pageNumber = 1;
    if (stage === 'storyboard') f.draft.sequence.pages[2].transitions[0].from.targetId = 'lane';
    if (stage === 'review') f.review.storyboardDigest = 'a'.repeat(64);
    const error = await errorOf(generatePersonalBook(f.args));
    expect(error.code).toBe(stage === 'plan' ? 'book_story_invalid' : `book_${stage}_invalid`);
    expect(error.accounting?.providerAttempts).toBe(stage === 'plan' ? 1 : stage === 'storyboard' ? 4 : 5);
    expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('retains billed failure usage but no raw provider sentinel', async () => {
    const f = await setup(); vi.mocked(f.provider.story.generate).mockRejectedValue(Object.assign(Error('SECRET_PROVIDER_SENTINEL'), { providerUsage: { inputTokens: 100, outputTokens: 200 } }));
    const error = await errorOf(generatePersonalBook(f.args)); expect(error.code).toBe('book_provider_failed');
    expect(error.accounting?.providerAttempts).toBe(1); expect(error.accounting?.estimatedUsd).toBeCloseTo(.0022);
    expect(error.message).not.toContain('SECRET'); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it.each([null, { inputTokens: NaN, outputTokens: -1 }])('keeps missing/invalid usage unknown, not free', async usage => {
    const f = await setup(); vi.mocked(f.provider.visual.generate).mockImplementation(async call => ({ output: call.stage === 'storyboard' ? f.draft : f.review, usage: usage as null }));
    const result = await generatePersonalBook(f.args); expect(result.accounting.estimatedUsd).toBeNull(); expect(result.accounting.providerAttempts).toBe(5);
  });
  it('does not let telemetry failure or telemetry mutation retry a stage', async () => {
    const f = await setup(); const result = await generatePersonalBook({ ...f.args, record: event => { event.accounting.stages.splice(0); throw Error('observer'); } });
    expect(result.accounting.providerAttempts).toBe(5); expect(f.provider.story.generate).toHaveBeenCalledTimes(2); expect(f.provider.visual.generate).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])('stops a reported overrun even with earlier usage unknown=%s', async unknown => {
    const f = await setup();
    vi.mocked(f.provider.story.generate).mockImplementation(async call => ({ output: call.stage === 'plan' ? { ...f.result.plan, adventureSelection: f.draftResult.planning!.selection } : f.result.manuscript,
      usage: call.stage === 'plan' && unknown ? null : { inputTokens: 1, outputTokens: 1 } }));
    vi.mocked(f.provider.visual.generate).mockResolvedValue({ output: f.draft, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } });
    const error = await errorOf(generatePersonalBook(f.args)); expect(error.code).toBe('book_reservation_exceeded');
    expect(error.accounting?.providerAttempts).toBe(4); expect(error.accounting?.knownUsageEstimateUsd).toBeGreaterThan(error.accounting!.reservedUsd);
    if (unknown) expect(error.accounting?.estimatedUsd).toBeNull(); expect(f.provider.visual.generate).toHaveBeenCalledTimes(1);
  });
  it('ignores late provider completion after cancellation without falsifying unknown usage', async () => {
    const f = await setup(); let complete!: (value: { output: unknown; usage: null }) => void;
    vi.mocked(f.provider.story.generate).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const events: unknown[] = [];
    const error = await errorOf(generatePersonalBook({ ...f.args, record: event => {
      events.push(event); if (event.stage === 'plan' && event.outcome === 'started') f.controller.abort();
    } }));
    const before = structuredClone({ events, accounting: error.accounting });
    complete({ output: f.result.plan, usage: null }); await Promise.resolve(); await Promise.resolve();
    expect({ events, accounting: error.accounting }).toEqual(before); expect(error.accounting?.estimatedUsd).toBeNull();
    expect(f.provider.visual.generate).not.toHaveBeenCalled(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('rejects edits during provider factory setup before a generate invocation', async () => {
    const f = await setup(); f.factory.mockImplementation(() => { f.request.child.name = 'בר'; return f.provider; });
    const error = await errorOf(generatePersonalBook(f.args)); expect(error.code).toBe('book_source_changed');
    expect(error.accounting?.providerAttempts).toBe(0); expect(f.provider.story.generate).not.toHaveBeenCalled();
  });
  it.each(['storyboard', 'review'] as const)('rejects parent edits during %s and cannot return stale packets', async stage => {
    const f = await setup(); vi.mocked(f.provider.visual.generate).mockImplementation(async call => {
      if (call.stage === stage) f.request.child.name = 'בר';
      return { output: call.stage === 'storyboard' ? f.draft : f.review, usage: { inputTokens: 1, outputTokens: 1 } };
    });
    const error = await errorOf(generatePersonalBook(f.args)); expect(error.code).toBe('book_source_changed');
    expect(error.accounting?.providerAttempts).toBe(stage === 'storyboard' ? 4 : 5);
  });
  it('cancels a non-cooperating review provider without another call or a stuck user lock', async () => {
    const f = await setup(); vi.mocked(f.provider.visual.generate).mockImplementation(async call => {
      if (call.stage === 'review') return new Promise(() => {});
      return { output: f.draft, usage: null };
    });
    const error = await errorOf(generatePersonalBook({ ...f.args, record: event => {
      if (event.stage === 'review' && event.outcome === 'started') f.controller.abort();
    } }));
    expect(error.code).toBe('book_cancelled'); expect(error.accounting?.providerAttempts).toBe(5);
    expect(error.accounting?.estimatedUsd).toBeNull(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('bounds a non-cooperating provider with the actual runner timer', async () => {
    const f = await setup(); let observed: AbortSignal | undefined;
    vi.mocked(f.provider.story.generate).mockImplementation(async (_call, signal) => { observed = signal; return new Promise(() => {}); });
    vi.useFakeTimers();
    try {
      const pending = errorOf(generatePersonalBook(f.args)); await vi.advanceTimersByTimeAsync(generationTimeoutMs(personalStoryOutputLimits(8).planOutputTokens) + 1);
      const error = await pending; expect(error.code).toBe('book_timeout'); expect(observed?.aborted).toBe(true);
      expect(error.accounting?.providerAttempts).toBe(1); expect(f.ledger.snapshot().inFlight).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it.each(['short', 'medium', 'long'].flatMap(length => (['storyboard', 'review'] as const).map(stage => ({ length, stage }))))(
    'times out $length/$stage at its exact cap-derived deadline', async ({ length, stage }) => {
    const f = await setup(length); let observed: AbortSignal | undefined;
    vi.mocked(f.provider.visual.generate).mockImplementation(async (call, signal) => {
      if (call.stage === stage) { observed = signal; return new Promise(() => {}); }
      return { output: f.draft, usage: null };
    });
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = errorOf(generatePersonalBook(f.args)).then(error => { settled = true; return error; });
      const caps = personalBookOutputLimits(f.book.narrativeSpreads);
      const deadline = generationTimeoutMs(stage === 'storyboard' ? caps.storyboardOutputTokens : caps.reviewOutputTokens);
      await vi.advanceTimersByTimeAsync(deadline - 1);
      expect(settled).toBe(false); expect(observed?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const failure = await pending; expect(failure.code).toBe('book_timeout'); expect(observed?.aborted).toBe(true);
      expect(failure.accounting?.providerAttempts).toBe(stage === 'storyboard' ? 4 : 5);
      expect(failure.accounting?.estimatedUsd).toBeNull(); expect(f.ledger.snapshot().inFlight).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});

const visualCall = (stage: 'storyboard' | 'review', f: Awaited<ReturnType<typeof setup>>): BookVisualCall => ({ stage, instructions: 'rules', input: '{}',
  maxOutputTokens: stage === 'storyboard' ? personalBookOutputLimits(f.book.narrativeSpreads).storyboardOutputTokens : personalBookOutputLimits(f.book.narrativeSpreads).reviewOutputTokens,
  context: { narrativeSpreads: f.book.narrativeSpreads, sourceDigest: f.book.sourceDigest, storyboardDigest: f.book.storyboardDigest } });
function providerDraft(f: Awaited<ReturnType<typeof setup>>) {
  const data = structuredClone(f.draft);
  const strip = ({ pageNumber: _ignored, ...row }: { pageNumber: number }) => row;
  return { ...data, plan: { ...data.plan, pages: data.plan.pages.map(strip), continuity: { ...data.plan.continuity, pages: data.plan.continuity.pages.map(strip) } },
    sequence: { ...data.sequence, pages: data.sequence.pages.map(strip) } };
}
function providerReview(f: Awaited<ReturnType<typeof setup>>) {
  const group = (checks: { category: string; verdict: string; observation: string }[]) => Object.fromEntries(checks.map(({ category, ...value }) => [category, value]));
  return { bookChecks: group(f.review.bookChecks), frames: f.review.frames.map(frame => group(frame.checks)) };
}

describe('actual OpenAI adapter, deterministic metadata and default-off configuration', () => {
  it.each([[8, 32_000, 39_000, 2.1626], [12, 39_000, 47_000, 2.3936], [16, 51_000, 55_000, 2.6796]])(
    'sizes reasoning-inclusive caps and full reservations for %s spreads', (count, author, reviewer, solReservation) => {
      expect(personalBookOutputLimits(count)).toEqual({ storyboardOutputTokens: author, reviewOutputTokens: reviewer });
      const checkCount = STORYBOARD_BOOK_CHECKS.length + STORYBOARD_FRAME_CHECKS.length * (count + 1);
      expect(reviewer).toBeGreaterThanOrEqual(16_000 + 512 * checkCount);
      expect(author).toBeLessThanOrEqual(128_000); expect(reviewer).toBeLessThanOrEqual(128_000);
      // Independent arithmetic includes three text calls, two visual calls and a 10% buffer.
      const storyLimits = personalStoryOutputLimits(count);
      const output = storyLimits.planOutputTokens + storyLimits.manuscriptOutputTokens + (12_000 + 500 * count) + author + reviewer;
      const input = 3 * 64_000 + 2 * 128_000;
      expect(personalBookReservationUsd('gpt-6-sol', count)).toBeCloseTo((input * 2 + output * 10) / 1_000_000 * 1.1, 10);
      expect(personalBookReservationUsd('gpt-6-sol', count)).toBeCloseTo(solReservation, 10);
      expect(personalBookReservationUsd('gpt-6-astra', count)).toBeCloseTo(solReservation * 5, 10);
    });
  it.each([0, 9, 17, 8.5, NaN, Infinity, '8'])('refuses unsupported cap length %s instead of defaulting', count => {
    expect(() => personalBookOutputLimits(count as number)).toThrow('book_length_invalid');
    expect(() => personalBookReservationUsd('gpt-6-sol', count as number)).toThrow('book_length_invalid');
  });
  it('requires explicit book-only operator settings and priced model, without enabling an endpoint', () => {
    const env = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_BOOK_RUNNER: 'true', PERSONAL_WIZARD_BOOK_MODEL: 'gpt-6-sol',
      PERSONAL_WIZARD_BOOK_BUDGET_USD: '5', PERSONAL_WIZARD_BOOK_MAX_JOBS: '2', PERSONAL_WIZARD_BOOK_OPERATORS: 'TEST@example.com' };
    expect(resolvePersonalBookSettings({})).toBeNull(); expect(resolvePersonalBookSettings(env)?.operators.has('test@example.com')).toBe(true);
    for (const [key, value] of [['PERSONAL_WIZARD_BOOK_RUNNER', 'false'], ['PERSONAL_WIZARD_BOOK_MODEL', 'unpriced'], ['PERSONAL_WIZARD_BOOK_BUDGET_USD', '11'], ['PERSONAL_WIZARD_BOOK_MAX_JOBS', '0'], ['PERSONAL_WIZARD_BOOK_OPERATORS', 'bad']]) {
      expect(resolvePersonalBookSettings({ ...env, [key]: value })).toBeNull();
    }
  });
  it.each(['short', 'medium', 'long'])('supplies ordered metadata without changing %s model content', async length => {
    const f = await setup(length);
    for (const stage of ['storyboard', 'review'] as const) {
      const call = visualCall(stage, f); const raw = stage === 'storyboard' ? providerDraft(f) : providerReview(f); const before = structuredClone(raw);
      const decoded: any = decodePersonalBookProviderOutput(call, raw);
      expect(raw).toEqual(before);
      if (stage === 'storyboard') expect(decoded).toEqual(f.draft);
      else expect(decoded).toEqual(f.review);
    }
  });
  it.each(['storyboard', 'review'] as const)('rejects guessed %s metadata and wrong array coverage', async stage => {
    const f = await setup(); const raw: any = stage === 'storyboard' ? providerDraft(f) : providerReview(f);
    if (stage === 'storyboard') raw.plan.pages[0].pageNumber = 0;
    else raw.sourceDigest = f.book.sourceDigest;
    expect(() => decodePersonalBookProviderOutput(visualCall(stage, f), raw)).toThrow('book_provider_schema');
    const incomplete: any = stage === 'storyboard' ? providerDraft(f) : providerReview(f);
    if (stage === 'storyboard') incomplete.sequence.pages.pop(); else incomplete.frames.pop();
    expect(() => decodePersonalBookProviderOutput(visualCall(stage, f), incomplete)).toThrow('book_provider_schema');
  });
  it.each(['short', 'medium', 'long'].flatMap(length => (['gpt-6-sol', 'gpt-6.1-sol'] as const).map(model => ({ length, model }))))('runs the real five-stage $length/$model orchestrator with correctly sized SDK payloads', async ({ length, model }) => {
    const f = await setup(length); sdk.create.mockImplementation(async payload => {
      const name = payload.text.format.name;
      const strip = ({ pageNumber: _ignored, ...row }: { pageNumber: number }) => row;
      const raw = name === 'personal_story_plan' ? { ...f.result.plan, adventureSelection: f.draftResult.planning!.selection, beats: f.result.plan.beats.map(strip) }
        : name === 'personal_story_manuscript' ? { ...f.result.manuscript, pages: f.result.manuscript.pages.map(strip) }
        : name === 'personal_story_editor' ? (() => { const edited = fixtureEditorOutput({ stage: 'editor', instructions: '', input: payload.input, maxOutputTokens: payload.max_output_tokens });
          return { ...edited, plan: { ...edited.plan, beats: edited.plan.beats.map(strip) }, manuscript: { ...edited.manuscript, pages: edited.manuscript.pages.map(strip) } }; })()
        : name === 'personal_book_storyboard' ? providerDraft(f) : providerReview(f);
      return { status: 'completed', output_text: JSON.stringify(raw), usage: { input_tokens: 100, output_tokens: 200 } };
    });
    const result = await generatePersonalBook({ ...f.args, settings: { ...settings, model }, provider: () => createPersonalBookProvider('fake-test-key', model) });
    expect(result.framePackets).toHaveLength(f.book.narrativeSpreads + 1); expect(sdk.create).toHaveBeenCalledTimes(5);
    const visualPayload = sdk.create.mock.calls.find(([payload]) => payload.text.format.name === 'personal_book_storyboard')![0];
    const authoringInput = JSON.parse(visualPayload.input);
    expect(authoringInput.authoringRules).toEqual(f.source.planningInput.authoringRules);
    expect(authoringInput.authoringRules.framing.wide.childHeightFractionMax).toBe(.35);
    expect(authoringInput.authoringRules.entityBinding.reservedCastRoles).toEqual({ child: 'child', companion: 'companion' });
    expect(authoringInput.authoringRules.attributeBinding.changeAttributeMustExistInEntityInvariants).toBe(true);
    expect(visualPayload.instructions).toContain('Every continuity change must join an existing entity invariant attribute');
    const limits = personalBookOutputLimits(f.book.narrativeSpreads);
    const storyLimits = personalStoryOutputLimits(f.book.narrativeSpreads);
    expect(sdk.create.mock.calls.map(([payload]) => payload.max_output_tokens)).toEqual([storyLimits.planOutputTokens, storyLimits.manuscriptOutputTokens, storyEditorOutputTokens(f.book.narrativeSpreads), limits.storyboardOutputTokens, limits.reviewOutputTokens]);
    expect(result.accounting.reservedUsd).toBe(personalBookReservationUsd('gpt-6-sol', f.book.narrativeSpreads));
    for (const [payload, opts] of sdk.create.mock.calls) {
      expect(payload).toMatchObject({ store: false, reasoning: { effort: 'medium' }, service_tier: 'default' });
      expect(payload.model).toBe(model);
      expect(payload.text.format.strict).toBe(true); expect(opts.signal).toBeInstanceOf(AbortSignal);
      expect(opts.timeout).toBe(generationTimeoutMs(payload.max_output_tokens));
    }
    expect(sdk.options).toHaveLength(3); sdk.options.forEach(opts => expect(opts).toMatchObject({ maxRetries: 0 }));
  });
  it.each([['storyboard', 12_000], ['review', 6_000], ['storyboard', 31_999], ['review', 38_999], ['storyboard', 128_000], ['review', 128_000]] as const)(
    'rejects stale/under/over %s cap %s before SDK dispatch', async (stage, maxOutputTokens) => {
      const f = await setup(); const provider = createPersonalBookProvider('fake-test-key', 'gpt-6-sol');
      await expect(provider.visual.generate({ ...visualCall(stage, f), maxOutputTokens }, f.controller.signal)).rejects.toThrow('book_provider_context');
      expect(sdk.create).not.toHaveBeenCalled();
    });
  it.each(['storyboard', 'review'] as const)('cannot use the short %s cap for a long book', async stage => {
    const f = await setup('long'); const limits = personalBookOutputLimits(8);
    const provider = createPersonalBookProvider('fake-test-key', 'gpt-6-sol');
    const maxOutputTokens = stage === 'storyboard' ? limits.storyboardOutputTokens : limits.reviewOutputTokens;
    await expect(provider.visual.generate({ ...visualCall(stage, f), maxOutputTokens }, f.controller.signal)).rejects.toThrow('book_provider_context');
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each(['incomplete', 'malformed', 'schema'])('retains billed review usage after %s without retry', async kind => {
    const f = await setup(); sdk.create.mockResolvedValue({ status: kind === 'incomplete' ? 'incomplete' : 'completed',
      output_text: kind === 'malformed' ? 'not JSON SECRET' : '{}', usage: { input_tokens: 123, output_tokens: 456 } });
    const provider = createPersonalBookProvider('fake-test-key', 'gpt-6-sol');
    const error: any = await provider.visual.generate(visualCall('review', f), f.controller.signal).catch(error => error);
    expect(error.providerUsage).toEqual({ inputTokens: 123, outputTokens: 456 }); expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(error.message).not.toContain('SECRET');
  });
  it('rejects invalid binding context and oversized payload before the SDK request', async () => {
    const f = await setup(); const call = visualCall('review', f); const provider = createPersonalBookProvider('fake-test-key', 'gpt-6-sol');
    expect(() => personalBookProviderSchema({ ...call, context: { ...call.context, sourceDigest: 'wrong' } })).toThrow('book_provider_context');
    await expect(provider.visual.generate({ ...call, input: 'x'.repeat(BOOK_LIMITS.inputBytesPerCall) }, f.controller.signal)).rejects.toThrow('book_provider_input_limit');
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it('uses fixed groups that require every semantic topic rather than trusting duplicate category strings', async () => {
    const f = await setup(); const schema: any = personalBookProviderSchema(visualCall('review', f));
    expect(Object.keys(schema.shape.bookChecks.shape)).toEqual([...STORYBOARD_BOOK_CHECKS]);
    expect(Object.keys(schema.shape.frames.element.shape)).toEqual([...STORYBOARD_FRAME_CHECKS]);
    expect(PERSONAL_BOOK_REVIEW_INSTRUCTION).toContain('child-native humour');
  });
});
