import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { engineOrderAuthoritySchema } from '../contract';
import { ENGINE_AUTHOR_BATCH, ENGINE_CURRENT_CUSTOMER, ENGINE_CURRENT_CUSTOMER_V9, ENGINE_CURRENT_CUSTOMER_V10 } from '../current-engine-policy';
import { engineProfileAuthority, engineOrderSteps, enginePolicyDigest, engineSpendPolicySchema, engineRecipeSteps } from '../platform-policy';
import { prepareEngineAnthropic } from '../provider-plans';
import { anthropicAuthorCost } from '../anthropic-author';
import { enginePreparationContracts } from '../storyboard-concurrency-policy';
import type { CausalDispatch } from '@/lib/personal-wizard/story-causal-experiment-runner';
import { authority } from './fixtures';

const policy = engineSpendPolicySchema.parse({ version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40),
  maximumMicroUsd: 12_000_000, maximumCalls: 140, approvalReference: 'SYNTHETIC_QA', approvedBy: 'synthetic_owner',
  approvedAt: '2026-11-12T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders',
  engineProfile: { version: ENGINE_CURRENT_CUSTOMER, imageModelPolicy: { version: 'image26-local-book/v1', model: 'gpt-image-2.6-sunburst', complexity: 'high' } } });
function current() {
  const base = authority();
  return engineOrderAuthoritySchema.parse({ ...base, ...engineProfileAuthority(policy), policySha256: enginePolicyDigest(policy),
    budget: { ...base.budget, maximumMicroUsd: policy.maximumMicroUsd, maximumCalls: policy.maximumCalls, steps: engineOrderSteps(policy) } });
}
const dispatch = (): CausalDispatch => ({ role: 'opus', stage: 'author', conversationKey: 'synthetic_author', input: 'SYNTHETIC brief',
  instructions: 'SYNTHETIC instructions', schema: z.object({ text: z.string().min(2) }).strict(), maxOutputTokens: 8000 });
const message = (tier = 'batch') => ({ id: 'msg_synthetic', type: 'message', model: 'claude-opus-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ text: 'Synthetic story' }) }],
  usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, service_tier: tier } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.restoreAllMocks());

describe('current customer engine bundle', () => {
  it('admits the complete bundle for a customer and adds the repair and bound-review slots', () => {
    const a = current(), ids = a.budget.steps.map(s => s.id);
    expect(a.currentEngine).toBe(ENGINE_CURRENT_CUSTOMER);
    expect(a.authorTransport).toBe(ENGINE_AUTHOR_BATCH);
    expect(a.imageModelPolicy).toEqual({ version: 'image26-local-book/v1', model: 'gpt-image-2.6-sunburst', complexity: 'high' });
    for (const id of ['initial_storyboard_repair_1', 'initial_storyboard_repair_1_review', 'initial_storyboard_repair_2',
      'initial_storyboard_repair_2_review', 'prep_child_bound_review']) expect(ids).toContain(id);
    expect(enginePreparationContracts(a).engineContinuity).toMatchObject({ sourceConcurrency: true });
  });
  it('refuses a partial bundle, an extension, or the bundle on a test authority', () => {
    const a = current();
    for (const key of ['responseSchemaPolicy', 'storyboardBindingPolicy', 'locationSheetPolicy', 'imageModelPolicy', 'storyboardConcurrencyPolicy', 'authorTransport'] as const)
      expect(engineOrderAuthoritySchema.safeParse({ ...a, [key]: undefined }).success).toBe(false);
    expect(engineOrderAuthoritySchema.safeParse({ ...a, locationSheetPolicy: 'location-ownership-and-views/v1' }).success).toBe(false);
    expect(engineOrderAuthoritySchema.safeParse({ ...a, purpose: 'test' }).success).toBe(false);
    expect(engineOrderAuthoritySchema.safeParse({ ...authority(), authorTransport: ENGINE_AUTHOR_BATCH }).success).toBe(false);
    expect(engineOrderAuthoritySchema.safeParse({ ...authority(), imageModelPolicy: a.imageModelPolicy }).success).toBe(false);
  });
  it('keeps a policy without a profile on the historical recipe and digest', () => {
    const { engineProfile: _p, ...plain } = policy;
    expect(engineProfileAuthority(plain)).toEqual({});
    expect(engineOrderSteps(plain).map(s => s.id)).not.toContain('prep_child_bound_review');
    expect(enginePolicyDigest(plain)).not.toBe(enginePolicyDigest(policy));
  });
  it('enables scene geometry only on the prospective customer profile with the exact v9 slots', () => {
    const a = current();
    expect(enginePreparationContracts({...a, currentEngine:ENGINE_CURRENT_CUSTOMER_V9}).engineContinuity).not.toHaveProperty('sceneRelations');
    expect(enginePreparationContracts({...a, currentEngine:ENGINE_CURRENT_CUSTOMER_V10}).engineContinuity).toHaveProperty('sceneRelations', true);
    expect(engineRecipeSteps({currentEngine:ENGINE_CURRENT_CUSTOMER_V10})).toEqual(engineRecipeSteps({currentEngine:ENGINE_CURRENT_CUSTOMER_V9}));
  });
});

describe('Opus author through Message Batches', () => {
  const ports = (fetch: typeof globalThis.fetch) => ({ fetch, openAIKey: () => 'unused', anthropicKey: () => 'SYNTHETIC_KEY' });
  it('creates one batch, then polls by id, then settles the single succeeded result at the batch rate', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      if (init?.method === 'POST') return json({ id: 'msgbatch_synthetic', processing_status: 'in_progress' });
      if (url.endsWith('/results')) return new Response(JSON.stringify({ custom_id: 'story_author', result: { type: 'succeeded', message: message() } }) + '\n');
      return json({ id: 'msgbatch_synthetic', processing_status: calls.length < 3 ? 'in_progress' : 'ended',
        results_url: 'https://api.anthropic.com/v1/messages/batches/msgbatch_synthetic/results' });
    }) as unknown as typeof globalThis.fetch;
    const plan = prepareEngineAnthropic(current(), dispatch(), ports(fetch));
    expect(plan.requiredMs).toBe(20_000);
    expect(plan.wire).toMatchObject({ version: 'engine-site-anthropic-batch/v1', customId: 'story_author', maxRetries: 0 });
    const dispatchOk = async () => {};
    const first = await plan.execute(undefined, new AbortController().signal, dispatchOk);
    expect(first).toMatchObject({ kind: 'pending', id: 'msgbatch_synthetic' });
    expect(JSON.parse(calls[0].body!).requests).toHaveLength(1);
    const second = await plan.execute('msgbatch_synthetic', new AbortController().signal, dispatchOk);
    expect(second.kind).toBe('pending');
    const done = await plan.execute('msgbatch_synthetic', new AbortController().signal, dispatchOk);
    expect(done.kind).toBe('completed');
    if (done.kind !== 'completed') throw Error('unreachable');
    expect(done.result.usable).toBe(true);
    expect(done.result.output).toEqual({ text: 'Synthetic story' });
    expect(done.result.estimatedMicroUsd).toBe(Math.ceil((1000 * 4 + 500 * 20) / 2));
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
    expect(() => plan.admitSaved!(done.result)).not.toThrow();
    expect(() => plan.admitSaved!({ ...done.result, estimatedMicroUsd: 1 })).toThrow('engine_saved_anthropic_invalid');
  });
  it('treats a transient poll failure as still pending and an ambiguous create as unknown', async () => {
    const poll = vi.fn(async () => new Response('busy', { status: 503 })) as unknown as typeof globalThis.fetch;
    expect((await prepareEngineAnthropic(current(), dispatch(), ports(poll)).execute('msgbatch_synthetic', new AbortController().signal, async () => {})).kind).toBe('pending');
    const create = vi.fn(async () => new Response('gateway', { status: 502 })) as unknown as typeof globalThis.fetch;
    await expect(prepareEngineAnthropic(current(), dispatch(), ports(create)).execute(undefined, new AbortController().signal, async () => {})).rejects.toThrow();
  });
  it('settles an errored or expired request as an unbilled unusable answer', async () => {
    for (const type of ['errored', 'expired']) {
      const fetch = vi.fn(async (input: string | URL | Request) => String(input).endsWith('/results')
        ? new Response(JSON.stringify({ custom_id: 'story_author', result: { type } }) + '\n')
        : json({ id: 'msgbatch_x', processing_status: 'ended', results_url: 'https://api.anthropic.com/v1/messages/batches/msgbatch_x/results' })) as unknown as typeof globalThis.fetch;
      const done = await prepareEngineAnthropic(current(), dispatch(), ports(fetch)).execute('msgbatch_x', new AbortController().signal, async () => {});
      expect(done).toMatchObject({ kind: 'completed', result: { usable: false, estimatedMicroUsd: 0 } });
    }
  });
  it('refuses a results URL outside its own batch', async () => {
    const fetch = vi.fn(async () => json({ id: 'msgbatch_x', processing_status: 'ended', results_url: 'https://evil.example/results' })) as unknown as typeof globalThis.fetch;
    await expect(prepareEngineAnthropic(current(), dispatch(), ports(fetch)).execute('msgbatch_x', new AbortController().signal, async () => {})).rejects.toThrow();
  });
  it('prices batch usage at half the standard rate and refuses a standard-tier answer on the batch path', () => {
    expect(anthropicAuthorCost(message('batch'), 'batch')).toBe(7000);
    expect(anthropicAuthorCost(message('standard'), 'batch')).toBeNull();
    expect(anthropicAuthorCost({ ...message('standard'), usage: { ...message('standard').usage, speed: 'standard', inference_geo: 'global' } })).toBe(14000);
  });
  it('binds a distinct wire digest from the direct transport for the same author body', () => {
    const plain = authority(); plain.budget = { ...plain.budget, maximumMicroUsd: 2_000_000, steps: [{ id: 'story_author', maximumMicroUsd: 1_000_000 }] };
    const direct = prepareEngineAnthropic(plain, dispatch(), ports(globalThis.fetch));
    const batch = prepareEngineAnthropic(current(), dispatch(), ports(globalThis.fetch));
    expect(canonicalHash(batch.wire)).not.toBe(canonicalHash(direct.wire));
  });
});
