import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import sharp from 'sharp';
import { authority } from './fixtures';
import { engineRecipeSteps } from '../platform-policy';
import { prepareEngineAnthropic, prepareEngineResponse, prepareEngineImage } from '../provider-plans';
import { createEngineStoryApiSource, simpleAnthropicDispatch } from '../story-api-source';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryCall } from '@/lib/personal-wizard/simple-story-engine';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE, SIMPLE_CHILD_MOMENTUM_VERSION } from '@/lib/personal-wizard/simple-story-experience';
import { SIMPLE_WRITING_ROLES } from '@/lib/personal-wizard/simple-writing-roles';
import { resolveEngineWizardOptions } from '../personal-orders';
import { syntheticEngineOrderInput } from './synthetic-order';
import { admitCurrentSimpleStorySource, ANTHROPIC_SIMPLE_SOURCE_VERSION } from '@/lib/personal-wizard/simple-story-source';
import { engineImageDataUrl } from '../image-data-url';

const allowed = () => ({ ...authority(), budget: { ...authority().budget, maximumMicroUsd: 10_000_000, maximumCalls: 200, steps: engineRecipeSteps() } });
const fence = async () => {};
const ports = (fetch = vi.fn()) => ({ fetch: fetch as unknown as typeof globalThis.fetch,
  openAIKey: vi.fn(() => 'SYNTHETIC_ONLY'), anthropicKey: vi.fn(() => 'SYNTHETIC_ONLY') });
const schema = z.object({ answer: z.string() }).strict();
const body = { model: 'gpt-6.1-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' },
  instructions: 'Synthetic only', input: 'Synthetic data', max_output_tokens: 12000, text: { format: { type: 'json_object' } } };
describe('new production provider seams, no live provider or environment credential', () => {
  it('labels a canonical private JPEG photo correctly and never changes its bytes for a vision request', async () => {
    const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } }).jpeg().toBuffer();
    expect(engineImageDataUrl(photo)).toBe(`data:image/jpeg;base64,${photo.toString('base64')}`);
    expect(() => engineImageDataUrl(Buffer.from('invalid'))).toThrow('engine_image_mime_invalid');
  });
  it('POSTs a background response once and GETs its id; malformed or changed terminal output retains known cost', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'resp_synthetic', status: 'in_progress' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'resp_synthetic', status: 'completed', model: 'gpt-6.1-sol', service_tier: 'default',
        usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'synthetic' }) }] }] })));
    const plan = prepareEngineResponse(allowed(), 'page_0_0_qa', body, value => schema.parse(value), ports(fetch));
    expect(await plan.execute(undefined, new AbortController().signal, fence)).toMatchObject({ kind: 'pending', id: 'resp_synthetic' });
    const completed = await plan.execute('resp_synthetic', new AbortController().signal, fence);
    expect(completed).toMatchObject({ kind: 'completed', result: { usable: true, output: { answer: 'synthetic' }, estimatedMicroUsd: 1200 } });
    if (completed.kind !== 'completed') throw Error('synthetic');
    expect(() => plan.admitSaved!(completed.result)).not.toThrow();
    expect(() => plan.admitSaved!({ ...completed.result, output: { answer: 'forged' } })).toThrow('saved_response');
    expect(fetch.mock.calls.map(([, options]) => options.method)).toEqual(['POST', 'GET']);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ background: true, store: false });
  });
  it('preserves a known unusable native QA answer for exactly the existing one-reask gate, never for source steps', async () => {
    const raw = { id: 'resp_synthetic', status: 'completed', model: 'gpt-6.1-sol', service_tier: 'default',
      usage: { input_tokens: 100, output_tokens: 100 }, output_text: 'invalid-json-from-synthetic-provider' };
    const fetch = vi.fn(async () => new Response(JSON.stringify(raw)));
    const page = prepareEngineResponse(allowed(), 'page_0_0_qa', body, x => x, ports(fetch));
    const answer = await page.execute(undefined, new AbortController().signal, fence);
    expect(answer).toMatchObject({ kind: 'completed', result: { usable: true, output: raw.output_text, estimatedMicroUsd: 1200 } });
    if (answer.kind !== 'completed') throw Error('synthetic'); expect(() => page.admitSaved!(answer.result)).not.toThrow();
    const source = prepareEngineResponse(allowed(), 'story_editor', body, x => x, ports(fetch));
    expect(await source.execute(undefined, new AbortController().signal, fence)).toMatchObject({ kind: 'completed', result: { usable: false, estimatedMicroUsd: 1200 } });
  });
  it('does not hide known failure usage or run a fallback, and checks the live fence before dispatch', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'resp_synthetic', status: 'failed', model: 'gpt-6.1-sol', service_tier: 'default', usage: { input_tokens: 100, output_tokens: 20 } })));
    const plan = prepareEngineResponse(allowed(), 'page_0_0_qa', body, x => x, ports(fetch));
    await expect(plan.execute(undefined, new AbortController().signal, async () => { throw Error('lease_lost'); })).rejects.toThrow('lease_lost');
    expect(fetch).not.toHaveBeenCalled();
    expect(await plan.execute(undefined, new AbortController().signal, fence)).toMatchObject({ kind: 'completed', result: { usable: false, estimatedMicroUsd: 400 } });
  });
  it('uses LOW from authority, checks exact request after multipart, observes paid failure usage and never retries images', async () => {
    const bytes = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#123456' } }).png().toBuffer();
    const p = ports(); let dispatched = 0;
    const image = vi.fn(async input => { await input.assertBeforeProviderDispatch(); dispatched += 1;
      input.observeProviderResponse({ usage: { input_tokens: 100, output_tokens: 100 }, data: [] }); throw Error('synthetic_decode_failed'); });
    const plan = prepareEngineImage(allowed(), 'page_0_0', { finalPrompt: 'Synthetic illustration', size: '1024x1024',
      referenceImages: [`data:image/png;base64,${bytes.toString('base64')}`], exactReferenceBytes: [bytes], referenceMode: 'book_identity', requireReferenceEdit: true }, { ...p, image: image as any });
    expect((plan.wire as any).body.quality).toBe('low');
    expect(await plan.execute(undefined, new AbortController().signal, fence)).toMatchObject({ kind: 'completed', result: { usable: false, estimatedMicroUsd: 3800 } });
    expect(dispatched).toBe(1); expect(image).toHaveBeenCalledTimes(1);
    expect(() => prepareEngineImage(allowed(), 'page_0_0', { finalPrompt: 'x', quality: 'medium' }, p)).toThrow('authority_mismatch');
  });
  it('admits an Opus API author + current Sol editor as a distinct momentum source, never as CLI provenance', async () => {
    const a = allowed(), options = resolveEngineWizardOptions(), input = syntheticEngineOrderInput();
    input.request.child.name = 'תמר'; input.request.child.address = 'girl'; input.request.companion.id = 'dragon_dini';
    const seed = 'synthetic-api-source', prepared = prepareSimpleStory(input.request, options, seed, SIMPLE_CHILD_MOMENTUM_EXPERIENCE);
    const records: Record<string, any> = {};
    const output = (call: SimpleStoryCall) => ({ title: 'תמר ודיני משחקות', writingContractVersion: SIMPLE_CHILD_MOMENTUM_VERSION,
      pages: Array.from({ length: 8 }, () => ({ text: `תמר ודיני רצו לצייר ולשחק. ${'הציור נשאר על השולחן ליד הכיסא והן הסתכלו בו וצחקו יחד. '.repeat(5)}` })),
      childGoal: 'תמר רוצה לשחק', companionWant: 'דיני רוצה לצייר', comicPromise: 'משחק משותף', ending: 'הן ממשיכות לשחק',
      pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'חצר דמיונית', transitionReason: 'המשחק נמשך', childAction: 'תמר מציירת',
        companionAction: 'דיני משחקת', consequence: 'המשחק נמשך', continuity: 'הציור על השולחן', factIds: i ? [] : [input.request.facts[0].id] })),
      resilienceMoments: [{ page: 4, childChoice: 'תמר בוחרת לשחק', whatHelps: 'הציור משותף' }],
      ...(call.stage === 'editor' ? { editorChanges: ['Synthetic unchanged story, not literary acceptance.'] } : {}) });
    const generated = await writeSimpleStory(prepared, async call => {
      const rawOutput = output(call), anthropic = call.stage === 'author';
      const raw = anthropic ? { id: 'msg_synthetic_author', type: 'message', model: 'claude-opus-5-5', stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(rawOutput) }], usage: { input_tokens: 100, output_tokens: 100,
          cache_creation_input_tokens: 0, cache_read_input_tokens: 0, service_tier: 'standard', speed: 'standard', inference_geo: 'global' } }
        : { id: 'resp_synthetic_editor', model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed',
          usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify(rawOutput) };
      const fetch = vi.fn(async () => new Response(JSON.stringify(raw), { headers: { 'request-id': 'req_synthetic' } }));
      const plan = anthropic ? prepareEngineAnthropic(a, simpleAnthropicDispatch(call, a.orderId), ports(fetch))
        : prepareEngineResponse(a, 'story_editor', { ...body, instructions: call.instructions, input: call.input, max_output_tokens: call.maxOutputTokens }, x => call.schema.parse(x), ports(fetch));
      const answered = await plan.execute(undefined, new AbortController().signal, fence);
      if (answered.kind !== 'completed' || !answered.result.usage || answered.result.estimatedMicroUsd === null) throw Error('synthetic_answer_invalid');
      expect(() => plan.admitSaved!(answered.result)).not.toThrow();
      records[call.stage] = answered.result;
      return { output: answered.result.output, usage: answered.result.usage, estimatedUsd: answered.result.estimatedMicroUsd / 1e6 };
    }, { model: SIMPLE_WRITING_ROLES.label, reservedUsd: 2 });
    const source = createEngineStoryApiSource(a, input.request, options, seed, generated, records as any);
    expect(source.simpleSource.version).toBe(ANTHROPIC_SIMPLE_SOURCE_VERSION);
    expect(source.simpleSource.author.costKind).toBe('anthropic_api_usage_estimate_not_invoice');
    expect(source.simpleSource.editor.model).toBe('gpt-6.1-sol');
    expect(admitCurrentSimpleStorySource(input.request, source, options)).toEqual(source);
    const forged = structuredClone(source); forged.simpleSource.version = 'personal-simple-story-source/roles-v1';
    expect(() => admitCurrentSimpleStorySource(input.request, forged, options)).toThrow('receipt_route');
    const changed = structuredClone(records); changed.author.raw.content[0].text = '{}';
    expect(() => createEngineStoryApiSource(a, input.request, options, seed, generated, changed as any)).toThrow();
  });
});
