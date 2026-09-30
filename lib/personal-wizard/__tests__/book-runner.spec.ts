import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));
vi.mock('openai', () => ({ default: class {
  responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); }
} }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { generatePersonalBook, PersonalBookError, PERSONAL_BOOK_REVIEW_INSTRUCTION, type PersonalBookProvider, type BookVisualCall } from '../book-runner';
import { resolvePersonalWizardOptions, PROTOTYPE_COMPANION_ROSTER } from '../options';
import { BOOK_LIMITS, personalBookOutputLimits, personalBookReservationUsd, resolvePersonalBookSettings, type PersonalBookSettings } from '../book-config';
import { IntakeLedger } from '../intake-ledger';
import { createPersonalBookProvider, decodePersonalBookProviderOutput, personalBookProviderSchema } from '../book-openai';
import { STORYBOARD_BOOK_CHECKS, STORYBOARD_FRAME_CHECKS } from '../storyboard';

const options = resolvePersonalWizardOptions();
const settings: PersonalBookSettings = { model: 'gpt-6-sol', budgetUsd: 5, maxJobs: 3, operators: new Set(['test@example.com']) };
beforeEach(() => { sdk.create.mockReset(); sdk.options = []; });
async function setup(length = 'short', companion = 'dragon_dini') {
  const f = await personalStoryboardFixture(length, companion);
  const provider: PersonalBookProvider = {
    story: { generate: vi.fn(async call => ({ output: structuredClone(call.stage === 'plan' ? f.result.plan : f.result.manuscript), usage: { inputTokens: 100, outputTokens: 200 } })) },
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
  it.each([['short', 8, 16], ['medium', 12, 24], ['long', 16, 32]])('runs all four stages in one job for %s', async (length, count, display) => {
    const f = await setup(length as string); const events: unknown[] = [];
    const result = await generatePersonalBook({ ...f.args, record: event => events.push(event) });
    expect(result.status).toBe('review_supported'); expect(result.runtimeEligible).toBe(false);
    expect(result.storyboard.narrativeSpreads).toBe(count); expect(result.storyboard.displayPages).toBe(display);
    expect(result.framePackets).toHaveLength((count as number) + 1);
    expect(result.accounting.providerAttempts).toBe(4);
    expect(result.accounting.stages.map(row => row.stage)).toEqual(['plan', 'manuscript', 'storyboard', 'review']);
    expect(result.accounting.estimatedUsd).toBeCloseTo(.0136);
    expect(result.accounting.reservedUsd).toBe(personalBookReservationUsd(settings.model, count as number));
    expect(f.ledger.snapshot()).toEqual({ jobs: 1, inFlight: 0, reservedTotalUsd: result.accounting.reservedUsd });
    const visualCalls = vi.mocked(f.provider.visual.generate).mock.calls;
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
    expect(result.review.review.bookChecks[0].verdict).toBe(verdict); expect(result.accounting.providerAttempts).toBe(4);
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
      return { output: structuredClone(call.stage === 'plan' ? f.result.plan : f.result.manuscript), usage: null };
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
    expect(error.accounting?.providerAttempts).toBe(stage === 'plan' ? 1 : stage === 'storyboard' ? 3 : 4);
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
    const result = await generatePersonalBook(f.args); expect(result.accounting.estimatedUsd).toBeNull(); expect(result.accounting.providerAttempts).toBe(4);
  });
  it('does not let telemetry failure or telemetry mutation retry a stage', async () => {
    const f = await setup(); const result = await generatePersonalBook({ ...f.args, record: event => { event.accounting.stages.splice(0); throw Error('observer'); } });
    expect(result.accounting.providerAttempts).toBe(4); expect(f.provider.story.generate).toHaveBeenCalledTimes(2); expect(f.provider.visual.generate).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])('stops a reported overrun even with earlier usage unknown=%s', async unknown => {
    const f = await setup();
    vi.mocked(f.provider.story.generate).mockImplementation(async call => ({ output: call.stage === 'plan' ? f.result.plan : f.result.manuscript,
      usage: call.stage === 'plan' && unknown ? null : { inputTokens: 1, outputTokens: 1 } }));
    vi.mocked(f.provider.visual.generate).mockResolvedValue({ output: f.draft, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } });
    const error = await errorOf(generatePersonalBook(f.args)); expect(error.code).toBe('book_reservation_exceeded');
    expect(error.accounting?.providerAttempts).toBe(3); expect(error.accounting?.knownUsageEstimateUsd).toBeGreaterThan(error.accounting!.reservedUsd);
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
    expect(error.accounting?.providerAttempts).toBe(stage === 'storyboard' ? 3 : 4);
  });
  it('cancels a non-cooperating review provider without another call or a stuck user lock', async () => {
    const f = await setup(); vi.mocked(f.provider.visual.generate).mockImplementation(async call => {
      if (call.stage === 'review') return new Promise(() => {});
      return { output: f.draft, usage: null };
    });
    const error = await errorOf(generatePersonalBook({ ...f.args, record: event => {
      if (event.stage === 'review' && event.outcome === 'started') f.controller.abort();
    } }));
    expect(error.code).toBe('book_cancelled'); expect(error.accounting?.providerAttempts).toBe(4);
    expect(error.accounting?.estimatedUsd).toBeNull(); expect(f.ledger.snapshot().inFlight).toBe(0);
  });
  it('bounds a non-cooperating provider with the actual runner timer', async () => {
    const f = await setup(); let observed: AbortSignal | undefined;
    vi.mocked(f.provider.story.generate).mockImplementation(async (_call, signal) => { observed = signal; return new Promise(() => {}); });
    vi.useFakeTimers();
    try {
      const pending = errorOf(generatePersonalBook(f.args)); await vi.advanceTimersByTimeAsync(BOOK_LIMITS.timeoutMs + 1);
      const error = await pending; expect(error.code).toBe('book_timeout'); expect(observed?.aborted).toBe(true);
      expect(error.accounting?.providerAttempts).toBe(1); expect(f.ledger.snapshot().inFlight).toBe(0);
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
  it.each([[8, 32_000, 39_000, 1.8128], [12, 39_000, 47_000, 1.9778], [16, 51_000, 55_000, 2.1978]])(
    'sizes reasoning-inclusive caps and full reservations for %s spreads', (count, author, reviewer, solReservation) => {
      expect(personalBookOutputLimits(count)).toEqual({ storyboardOutputTokens: author, reviewOutputTokens: reviewer });
      const checkCount = STORYBOARD_BOOK_CHECKS.length + STORYBOARD_FRAME_CHECKS.length * (count + 1);
      expect(reviewer).toBeGreaterThanOrEqual(16_000 + 512 * checkCount);
      expect(author).toBeLessThanOrEqual(128_000); expect(reviewer).toBeLessThanOrEqual(128_000);
      // Independent arithmetic includes the unchanged writer's two caps, four input budgets,
      // both new visual caps, the existing rate cards and the same 10% buffer.
      const output = 5_000 + 12_000 + author + reviewer;
      const input = 2 * 64_000 + 2 * 128_000;
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
  it.each(['short', 'medium', 'long'])('runs the real four-stage %s orchestrator with correctly sized SDK payloads', async length => {
    const f = await setup(length); sdk.create.mockImplementation(async payload => {
      const name = payload.text.format.name;
      const strip = ({ pageNumber: _ignored, ...row }: { pageNumber: number }) => row;
      const raw = name === 'personal_story_plan' ? { ...f.result.plan, beats: f.result.plan.beats.map(strip) }
        : name === 'personal_story_manuscript' ? { ...f.result.manuscript, pages: f.result.manuscript.pages.map(strip) }
        : name === 'personal_book_storyboard' ? providerDraft(f) : providerReview(f);
      return { status: 'completed', output_text: JSON.stringify(raw), usage: { input_tokens: 100, output_tokens: 200 } };
    });
    const result = await generatePersonalBook({ ...f.args, provider: () => createPersonalBookProvider('fake-test-key', 'gpt-6-sol') });
    expect(result.framePackets).toHaveLength(f.book.narrativeSpreads + 1); expect(sdk.create).toHaveBeenCalledTimes(4);
    const limits = personalBookOutputLimits(f.book.narrativeSpreads);
    expect(sdk.create.mock.calls.map(([payload]) => payload.max_output_tokens)).toEqual([5_000, 12_000, limits.storyboardOutputTokens, limits.reviewOutputTokens]);
    expect(result.accounting.reservedUsd).toBe(personalBookReservationUsd('gpt-6-sol', f.book.narrativeSpreads));
    for (const [payload, opts] of sdk.create.mock.calls) {
      expect(payload).toMatchObject({ store: false, reasoning: { effort: 'medium' }, service_tier: 'default' });
      expect(payload.text.format.strict).toBe(true); expect(opts.signal).toBeInstanceOf(AbortSignal);
    }
    expect(sdk.options).toHaveLength(2); sdk.options.forEach(opts => expect(opts).toMatchObject({ maxRetries: 0 }));
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
