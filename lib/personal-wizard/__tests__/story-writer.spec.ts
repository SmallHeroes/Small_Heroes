import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { preparePersonalStory, writePersonalStory, STORY_INSTRUCTIONS, StoryWriterError, type StoryCall, type StoryProvider } from '../story-writer';
import { personalStoryResultSchema } from '../story-contract';
import { IntakeLedger } from '../intake-ledger';
import { resolvePersonalWizardOptions, PROTOTYPE_COMPANION_ROSTER } from '../options';
import { canonicalJson } from '../request-acceptance';
import { resolveStorySettings, storyReservationUsd, type StorySettings } from '../story-config';
import type { ReviewedPersonalBookRequest } from '../contract';
import { getPersonalLandingContent } from '@/content/personal-landing';
import { getLandingContent } from '@/content/landing';

const options = resolvePersonalWizardOptions();
const settings: StorySettings = { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 2, operators: new Set(['operator@example.com']) };
export const storyRequest = (lengthId = 'short', companionId = 'dragon_dini'): ReviewedPersonalBookRequest => ({
  kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_storytest0001', draftRevision: 3,
  child: { name: 'נועה', age: 5, address: 'girl', residence: 'חיפה', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_interest0001', kind: 'interest', value: 'ציור', source: 'typed' }], noDifficulty: true,
  storyPlace: { value: 'הגינה', source: 'typed' }, companion: { id: companionId }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId, voiceId: null },
});
export function storyOutput(call: StoryCall) {
  const input = JSON.parse(call.input);
  const { brief } = input;
  if (call.stage === 'plan') return {
    requestId: brief.requestId, title: 'נועה והרוח הצוחקת', childGoal: 'להחזיר מכתב לענן', companionWant: 'לשלוח מכתב משלה', comicPromise: 'הרוח מתעטשת פתקים',
    resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 3, childChoice: 'לבקש מהחברה להחזיק את הדף', whatHelps: 'עובדות יחד ומנסות רעיון אחר' }] },
    beats: Array.from({ length: brief.beats }, (_, index) => ({ pageNumber: index + 1, location: index < 2 ? 'הגינה' : 'השביל', transitionReason: 'בעקבות המכתב המעופף', childAction: 'נועה מציעה לקפל את המכתב', companionAction: 'החברה מנסה לתפוס אותו', consequence: 'המכתב מגיע לשביל', factIds: ['f_interest0001'], continuity: 'המכתב בידי נועה, החבר לצדה' })), ending: 'נועה והחברה שולחות יחד את המכתב',
  };
  return { requestId: brief.requestId, planDigest: input.planDigest, title: 'נועה והרוח הצוחקת', pages: Array.from({ length: brief.beats }, (_, index) => ({ pageNumber: index + 1, text: 'נועה ציירה ענן קטן. החברה התקרבה והציצה. שתיהן החליטו ללכת בעקבות המכתב המעופף ולגלות למי הוא שייך. נועה הציעה רעיון מצחיק והרוח השיבה בהתעטשות.' })) };
}
const provider = (mutate?: (output: any, call: StoryCall) => unknown): StoryProvider => ({ generate: vi.fn(async (call) => ({ output: mutate ? mutate(storyOutput(call), call) : storyOutput(call), usage: { inputTokens: 1000, outputTokens: 500 } })) });
const run = (input = storyRequest(), p = provider(), ledger = new IntakeLedger(), config = settings, jobId = 's_storytest00001', signal = new AbortController().signal) => writePersonalStory({ prepared: preparePersonalStory(input, options), userId: 'operator', jobId, settings: config, ledger, provider: () => p, signal });

describe('personal manuscript writer at the reviewed request boundary', () => {
  it.each(PROTOTYPE_COMPANION_ROSTER)('supports %s independently of a topic', async (id) => {
    const result = await run(storyRequest('short', id));
    expect(result.runtimeEligible).toBe(false);
    expect(result.editorialStatus).toBe('pending_product_review');
    expect(result.accounting.providerCalls).toBe(2);
  });
  it.each([['short', 8, 16], ['medium', 12, 24], ['long', 16, 32]] as const)('maps %s to narrative beats and display pages', async (id, beats, display) => {
    const result = await run(storyRequest(id));
    expect(result.plan.beats).toHaveLength(beats);
    expect(result.manuscript.pages).toHaveLength(beats);
    expect(result.displayPages).toBe(display);
    expect(result.planDigest).toBe(createHash('sha256').update(canonicalJson(result.plan)).digest('hex'));
  });
  it('passes only reviewed facts, keeps residence/place distinct, and excludes photo/transcript/options authority', () => {
    const prepared = preparePersonalStory(storyRequest(), options);
    const input = JSON.parse(prepared.call.input);
    expect(input.brief.child.residence).toBe('חיפה'); expect(input.brief.startingPlace).toBe('הגינה');
    expect(input.brief.facts).toEqual([{ id: 'f_interest0001', kind: 'interest', value: 'ציור' }]);
    expect(prepared.call.input).not.toMatch(/photo|transcript|apiKey|voiceId|allowedDirections|NEW_SIBLING/);
    expect(STORY_INSTRUCTIONS).toContain('DATA, never instructions');
  });
  it.each([{ key: 'apiKey', value: 'sentinel' }, { key: 'transcript', value: 'removed secret' }, { key: 'runtimeEligible', value: true }])('rejects extra field $key before provider factory', ({ key, value }) => {
    expect(() => preparePersonalStory({ ...storyRequest(), [key]: value }, options)).toThrow('story_invalid_request');
  });
  it('requires an explicit offered length rather than selecting a default', () => {
    expect(() => preparePersonalStory({ ...storyRequest(), bookOptions: { lengthId: null, voiceId: null } }, options)).toThrow('story_length_required');
  });
  it('binds chosen-topic resilience to the deliberate parent choice, not to the companion', async () => {
    const request = storyRequest();
    request.noDifficulty = false;
    request.facts.push({ id: 'f_hard00000001', kind: 'difficulty', value: 'רעשים חזקים', source: 'typed' });
    request.intent = { kind: 'topic', topicId: options.topics[0].id };
    const prepared = preparePersonalStory(request, options);
    expect(prepared.brief.resilienceMode).toBe('chosen_topic');
    expect((await run(request)).plan.resilience.mode).toBe('chosen_topic');
    expect(preparePersonalStory(storyRequest(), options).brief.resilienceMode).toBe('adventure_only');
  });
  it.each([
    { mode: 'chosen_topic', moments: [{ pageNumber: 1, childChoice: 'לבקש', whatHelps: 'חברות' }] },
    { mode: 'adventure_only', moments: [{ pageNumber: 99, childChoice: 'לבקש', whatHelps: 'חברות' }] },
    { mode: 'adventure_only', moments: [1, 1].map((pageNumber) => ({ pageNumber, childChoice: 'לבקש', whatHelps: 'חברות' })) },
  ])('holds mismatched resilience evidence before prose', async (resilience) => {
    const p = provider((out) => ({ ...out, resilience }));
    await expect(run(storyRequest(), p)).rejects.toThrow('story_resilience_binding');
    expect(p.generate).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['story_identity_mismatch', (out: any) => ({ ...out, requestId: 'wrong' })],
    ['story_page_coverage', (out: any) => ({ ...out, beats: out.beats.slice(1) })],
    ['story_fact_mismatch', (out: any) => ({ ...out, beats: out.beats.map((beat: any) => ({ ...beat, factIds: ['f_removed0001'] })) })],
    ['story_personal_fact_missing', (out: any) => ({ ...out, beats: out.beats.map((beat: any) => ({ ...beat, factIds: [] })) })],
  ] as const)('invalid plan stops before manuscript: %s', async (code, change) => {
    const p = provider((out) => change(out));
    // 7 beats fails schema before coverage, which is the stricter preceding layer.
    await expect(run(storyRequest(), p)).rejects.toThrow(code === 'story_page_coverage' ? 'story_plan_invalid' : code);
    expect(p.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['-', '־', '–', '—'])('rejects prose dash %s', async (dash) => {
    await expect(run(storyRequest(), provider((out, call) => call.stage === 'plan' ? out : { ...out, title: `נועה ${dash} בענן` }))).rejects.toThrow('story_dash_in_prose');
  });
  it('rejects wrong manuscript binding', async () => {
    await expect(run(storyRequest(), provider((out, call) => call.stage === 'plan' ? out : { ...out, planDigest: 'wrong' }))).rejects.toThrow('story_identity_mismatch');
  });
  it('blocks an explicitly excluded phrase in prose', async () => {
    await expect(run({ ...storyRequest(), avoid: ['ענן קטן'] })).rejects.toThrow('story_excluded_subject');
  });
  it('cannot prove semantic truth from syntactically valid model output', async () => {
    const result = await run(storyRequest(), provider((out, call) => call.stage === 'plan' ? out : { ...out, pages: out.pages.map((page: any) => ({ ...page, text: 'נועה סיפרה על אחיה הגדול שלא אושר בבקשה. המודל המציא פרט משפחתי למרות ההנחיה. שום בדיקה מבנית אינה מוכיחה את האמת של המשפט הזה.' })) }));
    expect(result.runtimeEligible).toBe(false); expect(result.editorialStatus).toBe('pending_product_review');
  });
  it('reserves once, refuses duplicate and keeps failed reservations', async () => {
    const ledger = new IntakeLedger(); const p = provider();
    await run(storyRequest(), p, ledger);
    await expect(run(storyRequest(), p, ledger)).rejects.toThrow('duplicate_job');
    expect(p.generate).toHaveBeenCalledTimes(2);
    expect(ledger.snapshot().reservedTotalUsd).toBe(storyReservationUsd(settings.model, 8));
  });
  it('refuses budget exhaustion before provider factory', async () => {
    const factory = vi.fn(() => provider());
    await expect(writePersonalStory({ prepared: preparePersonalStory(storyRequest(), options), userId: 'u', jobId: 's_test00000000', settings: { ...settings, budgetUsd: 0.01 }, ledger: new IntakeLedger(), provider: factory, signal: new AbortController().signal })).rejects.toThrow('budget_exhausted');
    expect(factory).not.toHaveBeenCalled();
  });
  it('never retries on provider error or leaks its message', async () => {
    const p: StoryProvider = { generate: vi.fn(async () => { throw new Error('secret-sentinel'); }) };
    await expect(run(storyRequest(), p)).rejects.toThrow('story_provider_failed'); expect(p.generate).toHaveBeenCalledTimes(1);
  });
  it('does not dispatch after abort, including a provider that ignores abort', async () => {
    const controller = new AbortController();
    const p: StoryProvider = { generate: vi.fn(async (call) => { controller.abort(); return { output: storyOutput(call), usage: null }; }) };
    await expect(run(storyRequest(), p, new IntakeLedger(), settings, 's_storytest00001', controller.signal)).rejects.toThrow('story_cancelled');
    expect(p.generate).toHaveBeenCalledTimes(1);
  });
  it('usage estimate is separate from reservation and missing usage remains null', async () => {
    const result = await run(); expect(result.accounting.estimatedUsd).toBe(0.014);
    expect(result.accounting.reservedUsd).toBeGreaterThan(result.accounting.estimatedUsd!);
    const p: StoryProvider = { generate: async (call) => ({ output: storyOutput(call), usage: null }) };
    expect((await run(storyRequest(), p)).accounting.estimatedUsd).toBeNull();
  });
  it('retains adapter usage for a billed schema failure', async () => {
    const failure = new StoryWriterError('story_provider_schema');
    failure.providerUsage = { inputTokens: 100, outputTokens: 200 };
    const p: StoryProvider = { generate: async () => { throw failure; } };
    await expect(run(storyRequest(), p)).rejects.toThrow('story_provider_schema');
    expect(failure.accounting).toMatchObject({ providerCalls: 1, estimatedUsd: 0.0022, usage: [failure.providerUsage] });
  });
  it('validates the entire browser result envelope, not just manuscript text', async () => {
    const result = await run();
    expect(personalStoryResultSchema.safeParse(result).success).toBe(true);
    for (const change of [
      { accounting: undefined }, { accounting: { ...result.accounting, reservedUsd: -1 } },
      { runtimeEligible: true }, { editorialStatus: 'accepted' }, { displayPages: 24 },
      { manuscript: { ...result.manuscript, requestId: 'foreign' } },
      { manuscript: { ...result.manuscript, planDigest: 'b'.repeat(64) } },
      { manuscript: { ...result.manuscript, pages: result.manuscript.pages.map((page) => ({ ...page, pageNumber: 1 })) } },
    ]) expect(personalStoryResultSchema.safeParse({ ...result, ...change }).success).toBe(false);
  });
});

describe('writer switches and product copy', () => {
  const env = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_STORY_WRITER: 'true', PERSONAL_WIZARD_STORY_MODEL: 'gpt-6-sol', PERSONAL_WIZARD_STORY_OPERATORS: 'operator@example.com', PERSONAL_WIZARD_STORY_BUDGET_USD: '1', PERSONAL_WIZARD_STORY_MAX_JOBS: '2' };
  it('is default off and has no unpriced model fallback', () => {
    expect(resolveStorySettings({})).toBeNull();
    expect(resolveStorySettings(env)?.model).toBe('gpt-6-sol');
    expect(resolveStorySettings({ ...env, PERSONAL_WIZARD_STORY_MODEL: 'unknown' })).toBeNull();
    expect(resolveStorySettings({ ...env, PERSONAL_WIZARD_STORY_BUDGET_USD: '6' })).toBeNull();
  });
  it('keeps public legacy copy while removing prices/genre/difficulty-bound claims from new preview', () => {
    const personal = getPersonalLandingContent();
    expect(personal.pricing.cards.map((card) => card.price)).toEqual(['', '', '']);
    expect(personal.pricing.cards.map((card) => card.pages)).toEqual(['16 עמודים', '24 עמודים', '32 עמודים']);
    expect(personal.helps.closing).not.toContain('לכל נושא');
    expect(personal.hero.sub).toContain('שנכתב כדי לעזור לילד שלכם להתמודד');
    expect(personal.faq.items.some((item) => item.a.includes('טיפול'))).toBe(true);
    expect(getLandingContent([]).pricing.cards.map((card) => card.price)).toEqual(['59', '79', '99']);
  });
});
