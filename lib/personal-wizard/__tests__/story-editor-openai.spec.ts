import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));
vi.mock('openai', () => ({ default: class {
  responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); }
} }));
import { personalStoryboardFixture, fixtureEditorOutput } from './personal-storyboard-fixture';
import { preparePersonalStory } from '../story-writer';
import { prepareStoryEdit } from '../story-editor';
import { createStoryEditorProvider, storyEditorProviderSchema, decodeStoryEditorOutput } from '../story-editor-openai';
import { resolvePersonalWizardOptions } from '../options';
import { generationTimeoutMs } from '../story-config';
beforeEach(() => { sdk.create.mockReset(); sdk.options = []; });
async function setup(length = 'short') {
  const f = await personalStoryboardFixture(length);
  const call = prepareStoryEdit(preparePersonalStory(f.request, resolvePersonalWizardOptions()), f.draftResult);
  const output = fixtureEditorOutput(call);
  const strip = ({ pageNumber: _number, ...row }: { pageNumber: number }) => row;
  const providerOutput = { ...output, plan: { ...output.plan, beats: output.plan.beats.map(strip) },
    manuscript: { ...output.manuscript, pages: output.manuscript.pages.map(strip) } };
  return { call, output, providerOutput };
}
describe('strict SDK editorial adapter, no silent fallback or retry', () => {
  it.each(['short', 'medium', 'long'])('passes gpt-6.1-sol Medium and binds %s array order', async length => {
    const f = await setup(length);
    sdk.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(f.providerOutput), usage: { input_tokens: 100, output_tokens: 200 } });
    const answer = await createStoryEditorProvider('fake', 'gpt-6.1-sol').generate(f.call, new AbortController().signal);
    expect(answer.output).toEqual(f.output); expect(sdk.create).toHaveBeenCalledTimes(1);
    const [payload, request] = sdk.create.mock.calls[0];
    expect(payload).toMatchObject({ model: 'gpt-6.1-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' }, max_output_tokens: f.call.maxOutputTokens });
    expect(payload.text.format.strict).toBe(true); expect(payload.text.format.name).toBe('personal_story_editor');
    expect(request.timeout).toBe(generationTimeoutMs(f.call.maxOutputTokens));
    expect(sdk.options).toEqual([{ apiKey: 'fake', maxRetries: 0 }]);
  });
  it.each(['incomplete', 'malformed', 'schema'])('retains reported paid usage on %s without exposing raw text', async kind => {
    const f = await setup(); sdk.create.mockResolvedValue({ status: kind === 'incomplete' ? 'incomplete' : 'completed',
      output_text: kind === 'malformed' ? 'PRIVATE_NOT_JSON' : '{}', usage: { input_tokens: 12, output_tokens: 34 } });
    const error: any = await createStoryEditorProvider('fake', 'gpt-6.1-sol').generate(f.call, new AbortController().signal).catch(error => error);
    expect(error.providerUsage).toEqual({ inputTokens: 12, outputTokens: 34 }); expect(error.message).not.toContain('PRIVATE');
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each([-1, 1])('refuses a mismatched cap %+i before SDK', async delta => {
    const f = await setup(); await expect(createStoryEditorProvider('fake', 'gpt-6.1-sol').generate({ ...f.call, maxOutputTokens: f.call.maxOutputTokens + delta }, new AbortController().signal)).rejects.toThrow('output_limit');
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each(['count', 'number', 'digest', 'check', 'metadata'])('rejects provider %s corruption', async kind => {
    const f = await setup(); const raw: any = f.providerOutput;
    if (kind === 'count') raw.manuscript.pages.pop();
    if (kind === 'number') raw.plan.beats[0].pageNumber = 17;
    if (kind === 'digest') raw.draftDigest = 'a'.repeat(64);
    if (kind === 'check') delete raw.checks.causal_magic;
    if (kind === 'metadata') raw.manuscript.planDigest = 'a'.repeat(64);
    expect(() => decodeStoryEditorOutput(f.call, raw)).toThrow('provider_schema');
  });
  it('requires all fixed observations and refuses oversize input before SDK', async () => {
    const f = await setup(); expect(Object.keys(storyEditorProviderSchema(f.call).shape.checks.shape)).toHaveLength(6);
    const input = JSON.parse(f.call.input); input.extra = 'x'.repeat(64_000);
    await expect(createStoryEditorProvider('fake', 'gpt-6.1-sol').generate({ ...f.call, input: JSON.stringify(input) }, new AbortController().signal)).rejects.toThrow('input_limit');
    expect(sdk.create).not.toHaveBeenCalled();
  });
});
