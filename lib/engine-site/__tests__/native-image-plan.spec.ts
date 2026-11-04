import { afterEach, describe, expect, it, vi } from 'vitest';
import { planGPTImageRequest } from '@/lib/generate-image';
import { planNativeOrderImage, revalidateNativeOrderImage, type NativeOrderImageInput } from '../native-image-plan';
import { authority } from './fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const input = (): NativeOrderImageInput => ({ step: 'page_0_0', prompt: 'SYNTHETIC native page prompt', size: '1024x1536',
  referenceMode: 'book_identity', references: [Buffer.from('synthetic child'), Buffer.from('synthetic companion')] });

describe('native-v1 customer LOW request boundary (no provider)', () => {
  it('uses the actual shared planner with explicit LOW/gpt-image-2 even when ambient quality says HIGH', () => {
    vi.stubGlobal('fetch', () => { throw Error('network_forbidden'); });
    vi.stubEnv('GPT_IMAGE_QUALITY', 'high'); vi.stubEnv('GPT_IMAGE_MODEL', 'wrong-model');
    const result = planNativeOrderImage(authority(), input());
    const actual = planGPTImageRequest(result.input, { defaultQuality: 'high', defaultModel: 'wrong-model', maxReferences: 4 });
    expect(actual.bodyWithoutBinaryImage).toEqual(result.wire.body);
    expect(result.wire).toMatchObject({ body: { model: 'gpt-image-2', quality: 'low', size: '1024x1536', n: 1 },
      mode: 'images.edit', maxRetries: 0 });
    expect(result.call).toMatchObject({ step: 'page_0_0', maximumMicroUsd: 40 });
    expect(result.input.exactReferenceBytes).toHaveLength(2);
  });

  it('binds ordered exact reference bytes, final assembled body and order into the meter claim', () => {
    const source = input(), original = planNativeOrderImage(authority(), source);
    const reversed = planNativeOrderImage(authority(), { ...input(), references: [...input().references].reverse() });
    const changed = planNativeOrderImage(authority(), { ...input(), prompt: 'Another synthetic page' });
    expect(reversed.call.wireSha256).not.toBe(original.call.wireSha256);
    expect(changed.call.wireSha256).not.toBe(original.call.wireSha256);
    expect(planNativeOrderImage(authority('other_order'), input()).call.wireSha256).not.toBe(original.call.wireSha256);
    source.references[0].fill(0);
    expect(original.input.exactReferenceBytes![0].toString()).toBe('synthetic child');
    expect(original.wire.references[0].bytes).toBe(Buffer.byteLength('synthetic child'));
  });

  it.each([{ quality: 'high' }, { quality: 'low' }, { modelOverride: 'other' }, { apiKey: 'synthetic_forbidden' },
    { step: 'page_9_0' }, { step: 'page_0_3' }, { referenceMode: 'book_scene_render' }, { references: [] },
    { references: Array.from({ length: 5 }, () => Buffer.from('x')) }])('rejects unbound/unsupported input %j', patch => {
      expect(() => planNativeOrderImage(authority(), { ...input(), ...patch } as NativeOrderImageInput)).toThrow();
    });

  it('does not turn a test grant or unplanned page slot into customer authority', () => {
    expect(() => planNativeOrderImage({ ...authority(), purpose: 'test', imageQuality: 'low' }, input())).toThrow('customer_authority_required');
    expect(() => planNativeOrderImage(authority(), { ...input(), step: 'page_1_0' })).toThrow('engine_step_not_authorized');
  });

  it('preserves explicit reference roles without truncating, reordering or accepting invalid combinations', () => {
    const base = { ...input(), referenceMode: 'book_design' as const,
      referenceRoles: ['child_design_authority', 'companion_design_authority'] };
    const result = planNativeOrderImage(authority(), base);
    expect(result.wire.referenceRoles).toEqual(base.referenceRoles);
    expect(() => planNativeOrderImage(authority(), { ...base, referenceRoles: ['child_design_authority'] })).toThrow();
    expect(() => planNativeOrderImage(authority(), { ...base, referenceRoles: ['unknown', 'companion_design_authority'] })).toThrow();
  });

  it.each(['quality', 'model', 'bytes', 'body', 'reserve', 'key', 'source', 'prompt'])(
    'refuses %s drift between reservation and the future provider boundary', field => {
      const plan = planNativeOrderImage(authority(), input());
      if (field === 'quality') plan.input.quality = 'high';
      if (field === 'model') plan.input.modelOverride = 'other';
      if (field === 'bytes') plan.input.exactReferenceBytes![0].fill(0);
      if (field === 'body') plan.wire.body.prompt = 'changed';
      if (field === 'reserve') plan.call.maximumMicroUsd++;
      if (field === 'key') plan.input.apiKey = 'synthetic_forbidden';
      if (field === 'source') plan.input.referenceImages![0] = 'https://example.invalid/other';
      if (field === 'prompt') plan.input.finalPrompt = 'changed';
      expect(() => revalidateNativeOrderImage(authority(), plan)).toThrow('customer_image_plan_changed');
    });

  it('returns independently copied exact bytes after successful revalidation', () => {
    const plan = planNativeOrderImage(authority(), input()), checked = revalidateNativeOrderImage(authority(), plan);
    expect(checked.wire).toEqual(plan.wire);
    plan.input.exactReferenceBytes![0].fill(0);
    expect(checked.input.exactReferenceBytes![0].toString()).toBe('synthetic child');
  });
});
