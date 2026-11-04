import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { anthropicAuthorCost, dispatchAnthropicAuthor, planAnthropicAuthor } from '../anthropic-author';
import type { CausalDispatch } from '@/lib/personal-wizard/story-causal-experiment-runner';
import { authority } from './fixtures';

function auth() {
  const value = authority(); value.budget = { ...value.budget, maximumMicroUsd: 2_000_000,
    maximumCalls: 1, steps: [{ id: 'story_author', maximumMicroUsd: 1_000_000 }] };
  return value;
}
const call = (): CausalDispatch => ({ role: 'opus', stage: 'author', conversationKey: 'synthetic_fresh_author',
  input: 'SYNTHETIC approved personal story brief', instructions: 'SYNTHETIC exact author instructions',
  schema: z.object({ text: z.string().min(2).max(200) }).strict(), maxOutputTokens: 8000 });
function answer() {
  return { type: 'message', model: 'claude-opus-5-5', stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: 'synthetic private thinking' }, { type: 'text', text: JSON.stringify({ text: 'Synthetic answer' }) }],
    usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      service_tier: 'standard', speed: 'standard', inference_geo: 'global' } };
}
function ports(raw: unknown = answer()) {
  return { assertCurrent: vi.fn(async () => {}), reserve: vi.fn(async () => ({ dispatchGranted: true })),
    settle: vi.fn(async () => {}), key: vi.fn(() => 'SYNTHETIC_KEY_ONLY'), persistPrivateBody: vi.fn(async () => {}),
    fetch: vi.fn(async (_input: string | URL | Request, _options?: RequestInit) => new Response(typeof raw === 'string' ? raw : JSON.stringify(raw), {
      status: 200, headers: { 'request-id': 'req_synthetic' } })) };
}
function run(p = ports(), availableMs = 1_000_000) {
  return dispatchAnthropicAuthor({ authority: auth(), step: 'story_author', call: call(), availableMs,
    signal: new AbortController().signal, ports: p });
}

describe('Anthropic API author, synthetic transport only; no CLI or environment reads', () => {
  it('preserves author instructions/input/cap and uses a fresh single-message Opus MED request', () => {
    const source = call(), plan = planAnthropicAuthor(auth(), 'story_author', source);
    expect(plan.wire.body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 8000,
      system: source.instructions, messages: [{ role: 'user', content: source.input }], output_config: { effort: 'medium' } });
    expect(plan.wire).toMatchObject({ apiVersion: '2026-10-21', maxRetries: 0, timeoutMs: 380000 });
    expect(plan.bodyJson).not.toContain('executable');
    expect(plan.bodyJson).not.toContain('SYNTHETIC_KEY');
    expect(() => plan.decode({ text: '' })).toThrow();
  });

  it('does not lose property names that happen to equal JSON schema constraint keywords', () => {
    const source = { ...call(), schema: z.object({ minLength: z.string().min(2), maximum: z.number().max(5) }).strict() };
    const plan = planAnthropicAuthor(auth(), 'story_author', source);
    expect((plan.wire.body.output_config.format.schema as { properties: unknown }).properties).toHaveProperty('minLength');
    expect(plan.decode({ minLength: 'valid', maximum: 4 })).toEqual({ minLength: 'valid', maximum: 4 });
    expect(() => plan.decode({ minLength: 'x', maximum: 6 })).toThrow();
  });

  it('defers a long step before claim, credential access, persistence or fetch', async () => {
    const p = ports(); expect(await run(p, 230_000)).toEqual({ kind: 'long_step_required', requiredMs: 425000 });
    for (const fn of Object.values(p)) expect(fn).not.toHaveBeenCalled();
  });

  it('gets the key only after a granted claim and sends one fixed-endpoint request with no retry', async () => {
    const p = ports(), result = await run(p);
    expect(result).toMatchObject({ kind: 'completed', output: { text: 'Synthetic answer' }, estimatedMicroUsd: 800 });
    expect(p.fetch).toHaveBeenCalledTimes(1); expect(p.persistPrivateBody).toHaveBeenCalledTimes(1);
    expect(p.reserve.mock.invocationCallOrder[0]).toBeLessThan(p.key.mock.invocationCallOrder[0]);
    expect(p.persistPrivateBody.mock.invocationCallOrder[0]).toBeLessThan(p.settle.mock.invocationCallOrder[0]);
    expect(p.fetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(p.settle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, estimatedMicroUsd: 800 }));
  });

  it('a replayed one-use claim never reads a key or sends another request', async () => {
    const p = ports(); p.reserve.mockResolvedValue({ dispatchGranted: false });
    expect(await run(p)).toEqual({ kind: 'already_claimed' });
    expect(p.key).not.toHaveBeenCalled(); expect(p.fetch).not.toHaveBeenCalled(); expect(p.settle).not.toHaveBeenCalled();
  });

  it('an absent permit refuses before claim or key; a revoked post-claim permit records an unresolved attempt', async () => {
    const p = ports(); p.assertCurrent.mockRejectedValueOnce(Error('synthetic unauthorized'));
    await expect(run(p)).rejects.toThrow('synthetic unauthorized');
    expect(p.reserve).not.toHaveBeenCalled(); expect(p.key).not.toHaveBeenCalled();
    const q = ports(); q.assertCurrent.mockResolvedValueOnce().mockRejectedValueOnce(Error('synthetic revoked'));
    await expect(run(q)).rejects.toThrow('anthropic_author_unusable');
    expect(q.fetch).not.toHaveBeenCalled(); expect(q.settle).toHaveBeenCalledWith(expect.objectContaining({ completed: false, estimatedMicroUsd: null }));
  });

  it.each(['missing_usage', 'different_model', 'fast', 'geo', 'unknown_cache', 'truncated', 'schema', 'malformed', 'refusal'])(
    'keeps evidence and settles/holds %s without retry or silently accepting output', async kind => {
      const raw: any = answer();
      if (kind === 'missing_usage') delete raw.usage;
      if (kind === 'different_model') raw.model = 'other_model';
      if (kind === 'fast') raw.usage.speed = 'fast';
      if (kind === 'geo') raw.usage.inference_geo = 'us';
      if (kind === 'unknown_cache') raw.usage.cache_creation_input_tokens = 100;
      if (kind === 'truncated') raw.stop_reason = 'max_tokens';
      if (kind === 'schema') raw.content[1].text = '{}';
      if (kind === 'refusal') raw.stop_details = { type: 'refusal' };
      const p = ports(kind === 'malformed' ? 'invalid JSON' : raw);
      await expect(run(p)).rejects.toThrow();
      expect(p.fetch).toHaveBeenCalledTimes(1); expect(p.persistPrivateBody).toHaveBeenCalledTimes(1);
      expect(p.settle).toHaveBeenCalledWith(expect.objectContaining({ completed: false,
        estimatedMicroUsd: ['truncated', 'schema', 'refusal'].includes(kind) ? 800 : null }));
    });

  it('retains known billed usage after private persistence fails; does not accept a text-only orphan', async () => {
    const p = ports(); p.persistPrivateBody.mockRejectedValueOnce(Error('synthetic storage unavailable'));
    await expect(run(p)).rejects.toThrow('anthropic_author_unusable');
    expect(p.settle).toHaveBeenCalledWith(expect.objectContaining({ completed: false, estimatedMicroUsd: 800 }));
    expect(p.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses exact cache buckets and rejects unaccounted server tools or inconsistent cache usage', () => {
    const raw: any = answer(); raw.usage.cache_creation_input_tokens = 30; raw.usage.cache_read_input_tokens = 5;
    raw.usage.cache_creation = { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 };
    expect(anthropicAuthorCost(raw)).toBe(1011);
    raw.usage.server_tool_use = { web_search_requests: 1 };
    expect(anthropicAuthorCost(raw)).toBeNull(); delete raw.usage.server_tool_use;
    raw.usage.cache_creation_input_tokens = 0; expect(anthropicAuthorCost(raw)).toBeNull();
  });
});
