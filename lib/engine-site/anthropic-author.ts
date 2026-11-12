import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { ANTHROPIC_PERSONAL_AUTHOR_MODEL } from '@/backend/providers/anthropic-model-authority';
import type { CausalDispatch } from '@/lib/personal-wizard/story-causal-experiment-runner';
import { generationTimeoutMs } from '@/lib/personal-wizard/story-config';
import { opusOutputContract } from '@/scripts/personal-causal-trial-adapters';
import { authorityDigest, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import type { EngineCall, EngineCallResult } from './order-meter';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const stages = new Set(['plan', 'replan', 'author', 'editor']);
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usageSchema = z.object({ input_tokens: tokens, output_tokens: tokens,
  cache_creation_input_tokens: tokens, cache_read_input_tokens: tokens,
  cache_creation: z.object({ ephemeral_5m_input_tokens: tokens, ephemeral_1h_input_tokens: tokens }).optional(),
  service_tier: z.literal('standard'), speed: z.literal('standard'), inference_geo: z.literal('global'),
}).passthrough();

/** API output grammar relaxes unsupported constraints; the ORIGINAL Zod schema still validates the answer. */
function apiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(apiSchema);
  if (!value || typeof value !== 'object') return value;
  const unsupported = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'minLength', 'maxLength', 'minItems', 'maxItems']);
  const result: Record<string, unknown> = {}, constraints: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (unsupported.has(key)) constraints[key] = item;
    else if (['properties', '$defs', 'definitions'].includes(key) && item && typeof item === 'object' && !Array.isArray(item)) {
      result[key] = Object.fromEntries(Object.entries(item).map(([name, schema]) => [name, apiSchema(schema)]));
    }
    else result[key] = apiSchema(item);
  }
  if (Object.keys(constraints).length) result.description = `${typeof result.description === 'string' ? result.description : ''} Local validation: ${JSON.stringify(constraints)}`.trim();
  return result;
}

/** No executable, process session, conversation history, key, provider constructor or I/O. */
export function planAnthropicAuthor(authorityInput: EngineOrderAuthority, step: string, call: CausalDispatch) {
  const authority = engineOrderAuthoritySchema.parse(authorityInput);
  if (call.role !== 'opus' || !stages.has(call.stage) || step !== `story_${call.stage}` || !Number.isSafeInteger(call.maxOutputTokens) ||
      call.maxOutputTokens < 1 || call.maxOutputTokens > 55_000) engineSiteFail('anthropic_author_call_invalid');
  const slot = authority.budget.steps.find(value => value.id === step);
  if (!slot) engineSiteFail('engine_step_not_authorized');
  const contract = opusOutputContract(call);
  const body = { model: ANTHROPIC_PERSONAL_AUTHOR_MODEL, max_tokens: call.maxOutputTokens,
    system: call.instructions, messages: [{ role: 'user' as const, content: call.input }],
    output_config: { effort: 'medium' as const, format: { type: 'json_schema' as const, schema: apiSchema(contract.schema) } } };
  const bodyJson = JSON.stringify(body);
  if (Buffer.byteLength(bodyJson, 'utf8') > 104_000) engineSiteFail('anthropic_author_input_limit');
  const timeoutMs = generationTimeoutMs(call.maxOutputTokens);
  const wire = { version: 'engine-site-anthropic-author/v1' as const, orderId: authority.orderId,
    authoritySha256: authorityDigest(authority), step, stage: call.stage, endpoint: ENDPOINT,
    apiVersion: API_VERSION, body, timeoutMs, maxRetries: 0 };
  return { wire, bodyJson, decode: contract.decode,
    call: { step, wireSha256: canonicalHash(wire), maximumMicroUsd: slot.maximumMicroUsd } };
}

/** Message Batches usage: the same token fields, billed at the documented 50% batch rate. */
const batchUsageSchema = usageSchema.extend({ service_tier: z.literal('batch'),
  speed: z.literal('standard').optional(), inference_geo: z.literal('global').optional() });

/** API standard/global 4/20 + explicit 5m/1h writes and reads. No invented cache discount. */
export function anthropicAuthorCost(raw: unknown, transport: 'messages' | 'batch' = 'messages'): number | null {
  if (transport === 'batch') {
    const parsed = z.object({ model: z.literal(ANTHROPIC_PERSONAL_AUTHOR_MODEL), usage: batchUsageSchema }).passthrough().safeParse(raw);
    if (!parsed.success) return null;
    const standard = anthropicAuthorCost({ ...parsed.data, usage: { ...parsed.data.usage, service_tier: 'standard', speed: 'standard', inference_geo: 'global' } });
    return standard === null ? null : Math.ceil(standard / 2);
  }
  const response = z.object({ model: z.literal(ANTHROPIC_PERSONAL_AUTHOR_MODEL), usage: usageSchema }).passthrough().safeParse(raw);
  if (!response.success) return null;
  const u = response.data.usage;
  if (u.input_tokens + u.output_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens === 0) return null;
  if (u.cache_creation && u.cache_creation.ephemeral_5m_input_tokens + u.cache_creation.ephemeral_1h_input_tokens !== u.cache_creation_input_tokens) return null;
  if (u.server_tool_use && typeof u.server_tool_use === 'object' && Object.values(u.server_tool_use).some(value => value !== 0)) return null;
  let cacheCost = 0;
  if (u.cache_creation_input_tokens > 0) {
    if (!u.cache_creation || u.cache_creation.ephemeral_5m_input_tokens + u.cache_creation.ephemeral_1h_input_tokens !== u.cache_creation_input_tokens) return null;
    cacheCost = u.cache_creation.ephemeral_5m_input_tokens * 5 + u.cache_creation.ephemeral_1h_input_tokens * 8;
  }
  const result = Math.ceil(u.input_tokens * 4 + u.output_tokens * 20 + cacheCost + u.cache_read_input_tokens * 0.2);
  return Number.isSafeInteger(result) ? result : null;
}

type Ports = {
  /** Explicit order/environment/spend admission, checked before claim and again at dispatch/after awaits. */
  assertCurrent: () => void | Promise<void>;
  reserve: (call: EngineCall) => Promise<{ dispatchGranted: boolean }>;
  settle: (result: Omit<EngineCallResult, 'authoritySha256'>) => Promise<unknown>;
  key: () => string;
  /** Persist exact raw body privately BEFORE treating decoded text as a completed stage. */
  persistPrivateBody: (body: string, sha256: string) => Promise<void>;
  fetch?: typeof fetch;
};

/**
 * One metered API operation. The existing job system owns scheduling/checkpoints. Long calls are
 * deferred BEFORE claim/key access when the invocation cannot honor the engine's existing timeout.
 * No SDK retry, alternate model, file-based credential fallback or implicit paid permission.
 */
export async function dispatchAnthropicAuthor(input: {
  authority: EngineOrderAuthority; step: string; call: CausalDispatch; availableMs: number; signal: AbortSignal; ports: Ports;
}) {
  const plan = planAnthropicAuthor(input.authority, input.step, input.call), ports = input.ports;
  const requiredMs = plan.wire.timeoutMs + 45_000;
  if (!Number.isFinite(input.availableMs) || input.availableMs < requiredMs) {
    return { kind: 'long_step_required' as const, requiredMs };
  }
  if (input.signal.aborted) engineSiteFail('anthropic_author_cancelled');
  await ports.assertCurrent();
  const reserved = await ports.reserve(plan.call);
  if (!reserved.dispatchGranted) return { kind: 'already_claimed' as const };
  let cost: number | null = null, status: number | null = null, requestId: string | null = null;
  let rawSha256: string | null = null, output: unknown = null, completed = false, code = 'anthropic_author_transport_unknown';
  try {
    await ports.assertCurrent();
    if (input.signal.aborted) engineSiteFail('anthropic_author_cancelled');
    const key = ports.key();
    if (!key || /\s/.test(key)) engineSiteFail('anthropic_author_credential_unavailable');
    const response = await (ports.fetch ?? fetch)(ENDPOINT, { method: 'POST', body: plan.bodyJson,
      headers: { Authorization: `Bearer ${key}`, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
      redirect: 'error', signal: AbortSignal.any([input.signal, AbortSignal.timeout(plan.wire.timeoutMs)]) });
    status = response.status; requestId = response.headers.get('request-id');
    const body = await response.text(); rawSha256 = createHash('sha256').update(body).digest('hex');
    if (Buffer.byteLength(body, 'utf8') > 4_000_000) engineSiteFail('anthropic_author_response_limit');
    let raw: unknown = null, validJson = true;
    try { raw = JSON.parse(body); } catch { validJson = false; }
    cost = anthropicAuthorCost(raw);
    await ports.persistPrivateBody(body, rawSha256);
    await ports.assertCurrent();
    if (!validJson) engineSiteFail('anthropic_author_response_invalid');
    if (!response.ok || !requestId) engineSiteFail('anthropic_author_http_or_request_id');
    const answer = z.object({ type: z.literal('message'), model: z.literal(ANTHROPIC_PERSONAL_AUTHOR_MODEL),
      stop_reason: z.literal('end_turn'), stop_details: z.unknown().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
      usage: usageSchema }).passthrough().parse(raw);
    const texts = answer.content.filter(block => block.type === 'text');
    if (texts.length !== 1 || typeof texts[0].text !== 'string' || answer.content.some(block => !['text', 'thinking', 'redacted_thinking'].includes(block.type)) ||
        (answer.stop_details && typeof answer.stop_details === 'object' && 'type' in answer.stop_details && answer.stop_details.type === 'refusal')) {
      engineSiteFail('anthropic_author_answer_invalid');
    }
    if (cost === null || answer.usage.output_tokens > plan.wire.body.max_tokens || cost > plan.call.maximumMicroUsd) engineSiteFail('anthropic_author_usage_or_reserve');
    output = plan.decode(JSON.parse(texts[0].text));
    if (input.signal.aborted) engineSiteFail('anthropic_author_cancelled');
    completed = true;
  } catch (error) {
    code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^anthropic_[a-z_]+$/.test(error.code)
      ? error.code : 'anthropic_author_unusable';
  }
  const receiptSha256 = canonicalHash({ version: 'engine-site-anthropic-receipt/v1', wireSha256: plan.call.wireSha256,
    status, requestId, rawSha256, estimatedMicroUsd: cost, completed });
  await ports.settle({ step: plan.call.step, wireSha256: plan.call.wireSha256, completed, estimatedMicroUsd: cost, receiptSha256 });
  if (!completed) engineSiteFail(code);
  return { kind: 'completed' as const, output, receiptSha256, estimatedMicroUsd: cost! };
}
