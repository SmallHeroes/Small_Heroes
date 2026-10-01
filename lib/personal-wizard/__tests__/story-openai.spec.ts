import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: null as unknown }));
vi.mock('openai', () => ({ default: class {
  responses = { create: sdk.create };
  constructor(options: unknown) { sdk.options = options; }
} }));
import { createPersonalStoryProvider, decodePersonalProviderOutput, personalProviderSchema } from '../story-openai';
import { generationTimeoutMs, personalStoryOutputLimits, STORY_LIMITS } from '../story-config';
import { fixtureAdventureSelection } from './story-planning-fixture';

const digest = 'a'.repeat(64);
const context = (beats = 8) => ({ brief: { beats, requestId: 'r_bound', resilienceMode: 'adventure_only' as const }, planDigest: digest });
const raw = (stage: 'plan' | 'manuscript', count = 8): any => stage === 'plan' ? {
  adventureSelection: fixtureAdventureSelection(count, 'f_approved'),
  requestId: 'r_bound', title: 'הרפתקה', childGoal: 'להחזיר מכתב', companionWant: 'לשלוח ציור', comicPromise: 'הרוח מצחקקת',
  resilience: { mode: 'adventure_only', moments: [{ pageNumber: 2, childChoice: 'לבקש עזרה', whatHelps: 'עובדות יחד' }] },
  beats: Array.from({ length: count }, (_, i) => ({ location: `מקום ${i}`, transitionReason: `סיבה ${i}`, childAction: `פעולה ${i}`, companionAction: 'מקשיבה', consequence: 'ממשיכות', factIds: ['f_approved'], continuity: 'המכתב בידי הילדה' })), ending: 'המכתב הגיע',
} : { requestId: 'r_bound', planDigest: digest, title: 'הרפתקה', pages: Array.from({ length: count }, (_, i) => ({ text: `עמוד ${i} ובו הילדה והחברה מתקדמות יחד בעקבות המכתב המעופף.` })) };

beforeEach(() => { sdk.create.mockReset(); sdk.options = null; });
describe('real adapter schema and deterministic metadata', () => {
  it.each([8, 12, 16])('assigns numbering without changing order or content for %i spreads', (count) => {
    for (const stage of ['plan', 'manuscript'] as const) {
      const input = raw(stage, count); const before = structuredClone(input);
      const decoded: any = decodePersonalProviderOutput(stage, context(count), input);
      const rows = stage === 'plan' ? decoded.beats : decoded.pages;
      expect(rows.map((row: any) => row.pageNumber)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
      const stripped = rows.map(({ pageNumber: _ignored, ...row }: any) => row);
      expect(stripped).toEqual(stage === 'plan' ? input.beats : input.pages);
      expect(input).toEqual(before);
    }
  });
  it.each(['plan', 'manuscript'] as const)('%s rejects old/duplicate model numbering rather than silently stripping it', (stage) => {
    const input = raw(stage); const rows = stage === 'plan' ? input.beats : input.pages;
    rows.forEach((row: any) => { row.pageNumber = 1; });
    expect(() => decodePersonalProviderOutput(stage, context(), input)).toThrow('story_provider_schema');
  });
  it.each(['plan', 'manuscript'] as const)('%s requires exact array length and identity', (stage) => {
    expect(() => decodePersonalProviderOutput(stage, context(), raw(stage, 12))).toThrow('story_provider_schema');
    expect(() => decodePersonalProviderOutput(stage, context(), { ...raw(stage), requestId: 'other' })).toThrow('story_provider_schema');
  });
  it('binds manuscript digest, resilience mode and bounded moment references', () => {
    expect(() => decodePersonalProviderOutput('manuscript', context(), { ...raw('manuscript'), planDigest: 'b'.repeat(64) })).toThrow('story_provider_schema');
    const plan = raw('plan'); plan.resilience.mode = 'chosen_topic';
    expect(() => decodePersonalProviderOutput('plan', context(), plan)).toThrow('story_provider_schema');
    plan.resilience.mode = 'adventure_only'; plan.resilience.moments[0].pageNumber = 9;
    expect(() => decodePersonalProviderOutput('plan', context(), plan)).toThrow('story_provider_schema');
  });
  it('rejects incomplete context before SDK access', async () => {
    expect(() => personalProviderSchema('manuscript', { brief: context().brief })).toThrow('story_provider_context');
    expect(() => personalProviderSchema('plan', context(9))).toThrow('story_provider_context');
    const provider = createPersonalStoryProvider('fake-test-key', 'gpt-6-sol');
    await expect(provider.generate({ stage: 'manuscript', input: JSON.stringify({ brief: context().brief }), instructions: 'text', maxOutputTokens: 8000 }, new AbortController().signal)).rejects.toThrow('story_provider_context');
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it('uses strict exact-count SDK schema, no retry/storage, and passes the abort signal', async () => {
    sdk.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(raw('plan')), usage: { input_tokens: 100, output_tokens: 200 } });
    const signal = new AbortController().signal;
    const result: any = await createPersonalStoryProvider('fake-test-key', 'gpt-6-sol').generate({ stage: 'plan', input: JSON.stringify(context()), instructions: 'rules', maxOutputTokens: 12000 }, signal);
    expect(sdk.options).toMatchObject({ maxRetries: 0 });
    const [payload, options] = sdk.create.mock.calls[0];
    expect(payload).toMatchObject({ model: 'gpt-6-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' }, max_output_tokens: 12000 });
    expect(payload.text.format.strict).toBe(true);
    expect(payload.text.format.schema.properties.beats).toMatchObject({ minItems: 8, maxItems: 8 });
    expect(payload.text.format.schema.properties.beats.items.properties).not.toHaveProperty('pageNumber');
    expect(options.signal).toBe(signal);
    expect(options.timeout).toBe(generationTimeoutMs(12000));
    expect(result.output.beats[7].pageNumber).toBe(8);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200 });
  });
  it('includes the enlarged real plan schema in the input ceiling before SDK dispatch', async () => {
    const input = JSON.stringify(context(16)); const provider = createPersonalStoryProvider('fake-test-key', 'gpt-6-sol');
    // Input plus instructions fits the raw-text ceiling; schema/envelope pushes it over.
    const instructions = 'x'.repeat(STORY_LIMITS.inputBytesPerCall - Buffer.byteLength(input) - 100);
    expect(Buffer.byteLength(input + instructions)).toBeLessThan(STORY_LIMITS.inputBytesPerCall);
    await expect(provider.generate({ stage: 'plan', input, instructions, maxOutputTokens: personalStoryOutputLimits(16).planOutputTokens },
      new AbortController().signal)).rejects.toThrow('story_input_limit');
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each([8, 12, 16])('rejects mismatched caps before SDK dispatch for %i spreads', async count => {
    sdk.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(raw('plan', count)), usage: null });
    const provider = createPersonalStoryProvider('fake-test-key', 'gpt-6-sol');
    const limits = personalStoryOutputLimits(count);
    for (const stage of ['plan', 'manuscript'] as const) {
      const cap = stage === 'plan' ? limits.planOutputTokens : limits.manuscriptOutputTokens;
      const other = personalStoryOutputLimits(count === 8 ? 12 : 8);
      for (const maxOutputTokens of [cap - 1, cap + 1, stage === 'plan' ? other.planOutputTokens : other.manuscriptOutputTokens]) {
        await expect(provider.generate({ stage, input: JSON.stringify(context(count)), instructions: 'rules', maxOutputTokens },
          new AbortController().signal)).rejects.toThrow('story_output_limit');
        expect(sdk.create).not.toHaveBeenCalled();
      }
    }
  });
  it.each([8, 12, 16])('dispatches each matching stage cap and timeout for %i spreads', async count => {
    const limits = personalStoryOutputLimits(count);
    for (const stage of ['plan', 'manuscript'] as const) {
      sdk.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(raw(stage, count)), usage: null });
      const cap = stage === 'plan' ? limits.planOutputTokens : limits.manuscriptOutputTokens;
      await createPersonalStoryProvider('fake-test-key', 'gpt-6-sol').generate({ stage, input: JSON.stringify(context(count)),
        instructions: 'rules', maxOutputTokens: cap }, new AbortController().signal);
      const [payload, options] = sdk.create.mock.calls[sdk.create.mock.calls.length - 1];
      expect(payload.max_output_tokens).toBe(cap);
      expect(options.timeout).toBe(generationTimeoutMs(cap));
    }
  });
  it.each([
    ['incomplete', '', 'story_provider_incomplete'],
    ['completed', 'not json', 'story_provider_malformed'],
    ['completed', JSON.stringify(raw('plan', 12)), 'story_provider_schema'],
  ])('retains billed usage on %s adapter failure without a retry', async (status, output_text, code) => {
    sdk.create.mockResolvedValue({ status, output_text, usage: { input_tokens: 100, output_tokens: 200 } });
    const provider = createPersonalStoryProvider('fake-test-key', 'gpt-6-sol');
    const error: any = await provider.generate({ stage: 'plan', input: JSON.stringify(context()), instructions: 'rules', maxOutputTokens: 12000 }, new AbortController().signal).catch((error) => error);
    expect(error.code).toBe(code); expect(error.providerUsage).toEqual({ inputTokens: 100, outputTokens: 200 });
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
});
