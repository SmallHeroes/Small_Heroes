import 'server-only';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { planGPTImageRequest, generateGPTImage, type GenerateGPTImageInput } from '@/lib/generate-image';
import { generationTimeoutMs } from '@/lib/personal-wizard/story-config';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { renderMaximum } from '@/scripts/personal-simple-book-reviewed-audition';
import { authorityDigest, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import { assetBytesSha256 } from './private-assets';
import { planAnthropicAuthor, anthropicAuthorCost } from './anthropic-author';
import type { CausalDispatch } from '@/lib/personal-wizard/story-causal-experiment-runner';
import type { PreparedEngineCall, EngineProviderResult } from './durable-worker';

export type EngineProviderPorts = {
  fetch: typeof fetch; openAIKey: () => string; anthropicKey: () => string;
  image?: typeof generateGPTImage;
};
const responseText = (raw: any): string => {
  if (typeof raw.output_text === 'string') return raw.output_text;
  if (!Array.isArray(raw.output) || raw.output.some((item: any) => !['message', 'reasoning'].includes(item.type))) throw Error('engine_response_output_invalid');
  const parts = raw.output.filter((item: any) => item.type === 'message').flatMap((item: any) => item.content ?? []);
  if (!parts.length || parts.some((item: any) => item.type !== 'output_text' || typeof item.text !== 'string')) throw Error('engine_response_output_invalid');
  return parts.map((item: any) => item.text).join('');
};
export const engineResponseText = responseText;
const slotCall = (a: EngineOrderAuthority, step: string, wire: unknown) => {
  const authority = engineOrderAuthoritySchema.parse(a), slot = authority.budget.steps.find(s => s.id === step);
  if (!slot) engineSiteFail('engine_step_not_authorized');
  return { step, wireSha256: canonicalHash(wire), maximumMicroUsd: slot.maximumMicroUsd };
};
async function jsonResponse(response: Response) {
  const body = await response.text();
  if (Buffer.byteLength(body) > 64 * 1024 * 1024) throw Error('engine_provider_response_limit');
  return JSON.parse(body);
}

export function prepareEngineAnthropic(a: EngineOrderAuthority, dispatch: CausalDispatch, ports: EngineProviderPorts): PreparedEngineCall {
  const planned = planAnthropicAuthor(a, `story_${dispatch.stage}`, dispatch);
  return { call: planned.call, wire: planned.wire, requiredMs: planned.wire.timeoutMs,
    admitSaved(answer) {
      const raw = answer.raw as any, blocks = raw.content?.filter((b: any) => b.type === 'text'), cost = anthropicAuthorCost(raw);
      if (answer.usable !== true || raw.type !== 'message' || raw.model !== planned.wire.body.model || raw.stop_reason !== 'end_turn' ||
          !/^msg_[A-Za-z0-9_-]+$/.test(raw.id) || blocks?.length !== 1 || raw.usage?.output_tokens > planned.wire.body.max_tokens ||
          cost === null || cost !== answer.estimatedMicroUsd || canonicalHash(planned.decode(JSON.parse(blocks[0].text))) !== canonicalHash(answer.output))
        engineSiteFail('engine_saved_anthropic_invalid');
    },
    revalidate() { if (canonicalHash(planAnthropicAuthor(a, planned.call.step, dispatch).wire) !== planned.call.wireSha256) engineSiteFail('engine_provider_plan_changed'); },
    async execute(pendingId, signal, assertDispatch) {
      if (pendingId) engineSiteFail('engine_anthropic_pending_invalid');
      await assertDispatch();
      const response = await ports.fetch(planned.wire.endpoint, { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${ports.anthropicKey()}`, 'anthropic-version': planned.wire.apiVersion, 'content-type': 'application/json' },
        body: planned.bodyJson, signal: AbortSignal.any([signal, AbortSignal.timeout(planned.wire.timeoutMs)]) });
      const raw = await jsonResponse(response), cost = anthropicAuthorCost(raw);
      let output: unknown = null, usable = false;
      try {
        const blocks = raw.content?.filter((b: any) => b.type === 'text');
        if (response.ok && response.headers.get('request-id') && raw.type === 'message' && raw.model === planned.wire.body.model &&
            raw.stop_reason === 'end_turn' && /^msg_[A-Za-z0-9_-]+$/.test(raw.id) && blocks?.length === 1 &&
            raw.content.every((b: any) => ['text', 'thinking', 'redacted_thinking'].includes(b.type)) &&
            raw.usage?.output_tokens <= planned.wire.body.max_tokens && cost !== null) {
          output = planned.decode(JSON.parse(blocks[0].text)); usable = true;
        }
      } catch { /* Preserve raw, usage and failed contract as a settled unusable answer. */ }
      return { kind: 'completed', result: { output, raw, estimatedMicroUsd: cost, usable, model: raw.model,
        ...(raw.usage ? { usage: { inputTokens: raw.usage.input_tokens, outputTokens: raw.usage.output_tokens } } : {}) } };
    },
  };
}

/** Responses background id is a checkpoint of THIS claim, never authority for another POST. */
export function prepareEngineResponse(a: EngineOrderAuthority, step: string, bodyInput: Record<string, any>,
  decode: (value: unknown) => unknown, ports: EngineProviderPorts): PreparedEngineCall {
  const allowed = new Set(['model', 'store', 'service_tier', 'reasoning', 'instructions', 'input', 'max_output_tokens', 'text', 'metadata']);
  if (Object.keys(bodyInput).some(k => !allowed.has(k)) || !['gpt-6.1-sol', 'gpt-6-astra'].includes(bodyInput.model) ||
      bodyInput.service_tier !== 'default' || bodyInput.reasoning?.effort !== 'medium' ||
      !Number.isInteger(bodyInput.max_output_tokens) || bodyInput.max_output_tokens < 1 || bodyInput.max_output_tokens > 55_000)
    engineSiteFail('engine_responses_plan_invalid');
  const body: Record<string, any> = structuredClone({ ...bodyInput, background: true, store: false });
  const textParts = typeof body.input === 'string' ? body.input : JSON.stringify(body.input,
    (key, value) => key === 'image_url' ? '[private-image-bytes]' : value);
  const ceiling = /^(prep_storyboard_0_review|initial_storyboard_review)$/.test(step) ? 208_000 : 104_000;
  if (Buffer.byteLength(String(body.instructions) + textParts) > ceiling || Buffer.byteLength(JSON.stringify(body)) > 64 * 1024 * 1024)
    engineSiteFail('engine_responses_input_limit');
  const wire = { version: 'engine-site-responses/v1', authoritySha256: authorityDigest(a), step, body,
    endpoint: 'https://api.openai.com/v1/responses', maxRetries: 0 };
  const call = slotCall(a, step, wire);
  const decodeOutput = (raw: any) => {
    try { return decode(JSON.parse(responseText(raw))); }
    catch (error) {
      // A known, returned unusable native review belongs to the engine's one re-ask rule.
      // Preserve its exact text, not a fabricated assessment; the normal review schema rejects it.
      if (/^page_[0-8]_[0-2]_qa2?$/.test(step)) return responseText(raw);
      throw error;
    }
  };
  return { call, wire, requiredMs: 20_000, completionDeadlineMs: generationTimeoutMs(body.max_output_tokens),
    admitSaved(answer) {
      const raw = answer.raw as any, cost = raw.model === body.model && raw.service_tier === 'default'
        ? auditionUsageCost(raw.usage, body.model === 'gpt-6.1-sol' ? 'sol' : 'astra') : null;
      if (answer.usable !== true || raw.status !== 'completed' || !/^resp_[A-Za-z0-9_-]+$/.test(raw.id) ||
          raw.usage?.output_tokens > body.max_output_tokens || cost === null || cost !== answer.estimatedMicroUsd ||
          canonicalHash(decodeOutput(raw)) !== canonicalHash(answer.output)) engineSiteFail('engine_saved_response_invalid');
    },
    revalidate() { if (canonicalHash(wire) !== call.wireSha256) engineSiteFail('engine_provider_plan_changed'); },
    async execute(pendingId, signal, assertDispatch) {
      if (pendingId && !/^resp_[A-Za-z0-9_-]+$/.test(pendingId)) engineSiteFail('engine_response_id_invalid');
      await assertDispatch();
      let response: Response, raw: any;
      try {
      response = await ports.fetch(pendingId ? `${wire.endpoint}/${encodeURIComponent(pendingId)}` : wire.endpoint, {
        method: pendingId ? 'GET' : 'POST', redirect: 'error', headers: { Authorization: `Bearer ${ports.openAIKey()}`, 'content-type': 'application/json' },
        ...(pendingId ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
      if (pendingId && (response.status === 429 || response.status >= 500)) return { kind: 'pending', id: pendingId, raw: { transientPoll: true, status: response.status } };
      raw = await jsonResponse(response);
      } catch (error) {
        if (pendingId && !signal.aborted) return { kind: 'pending', id: pendingId, raw: { transientPoll: true } };
        throw error;
      }
      if (response.ok && /^resp_[A-Za-z0-9_-]+$/.test(raw.id) && (!pendingId || raw.id === pendingId) && ['queued', 'in_progress'].includes(raw.status))
        return { kind: 'pending', id: raw.id, raw };
      const cost = raw.model === body.model && raw.service_tier === 'default'
        ? auditionUsageCost(raw.usage, body.model === 'gpt-6.1-sol' ? 'sol' : 'astra') : null;
      let output: unknown = null, usable = false;
      try {
        if (response.ok && raw.status === 'completed' && /^resp_[A-Za-z0-9_-]+$/.test(raw.id) && (!pendingId || raw.id === pendingId) &&
            cost !== null && raw.usage.output_tokens <= body.max_output_tokens) {
          output = decodeOutput(raw); usable = true;
        }
      } catch { /* Raw failed answer and known cost survive. */ }
      return { kind: 'completed', result: { output, raw, estimatedMicroUsd: cost, usable, model: raw.model,
        ...(raw.usage ? { usage: { inputTokens: raw.usage.input_tokens, outputTokens: raw.usage.output_tokens } } : {}) } };
    },
  };
}

/** Reference and native-page rendering share the order's single explicit quality. Exact reference bytes are frozen and revalidated. */
export function prepareEngineImage(a: EngineOrderAuthority, step: string, rawInput: GenerateGPTImageInput, ports: EngineProviderPorts): PreparedEngineCall {
  const authority = engineOrderAuthoritySchema.parse(a);
  const input: GenerateGPTImageInput = { ...rawInput, quality: authority.imageQuality, modelOverride: 'gpt-image-2', requestTimeoutMs: 180_000 };
  if (rawInput.quality && rawInput.quality !== authority.imageQuality || rawInput.apiKey || rawInput.referenceImages?.some(s => !s.startsWith('data:image/')))
    engineSiteFail('engine_image_authority_mismatch');
  input.exactReferenceBytes = rawInput.exactReferenceBytes?.map(b => Buffer.from(b));
  const plan = planGPTImageRequest(input, { defaultModel: 'gpt-image-2', defaultQuality: authority.imageQuality, maxReferences: 4 });
  const wire = { version: 'engine-site-image/v1', step, authoritySha256: authorityDigest(authority), mode: plan.apiMode,
    body: plan.bodyWithoutBinaryImage, references: input.exactReferenceBytes?.map(assetBytesSha256) ?? [], maxRetries: 0 };
  if (plan.quality !== authority.imageQuality || plan.model !== 'gpt-image-2' || plan.requestOptions.maxRetries !== 0 ||
      plan.referenceCountPassed !== (input.exactReferenceBytes?.length ?? 0) ||
      (input.exactReferenceBytes?.length ?? 0) !== (input.referenceImages?.length ?? 0)) engineSiteFail('engine_image_plan_invalid');
  const call = slotCall(authority, step, wire);
  if (renderMaximum(input.finalPrompt, plan.referenceCountPassed) > call.maximumMicroUsd) engineSiteFail('engine_image_reserve_insufficient');
  const revalidate = () => {
    const next = planGPTImageRequest(input, { defaultModel: 'gpt-image-2', defaultQuality: authority.imageQuality, maxReferences: 4 });
    if (canonicalHash({ ...wire, mode: next.apiMode, body: next.bodyWithoutBinaryImage,
      references: input.exactReferenceBytes?.map(assetBytesSha256) ?? [] }) !== call.wireSha256 ||
      input.quality !== authority.imageQuality || input.modelOverride !== 'gpt-image-2') engineSiteFail('engine_image_plan_changed');
  };
  return { call, wire, requiredMs: 180_000, revalidate,
    admitSaved(answer) {
      const raw = answer.raw as any, output = answer.output as any;
      if (answer.usable !== true || answer.model !== 'gpt-image-2' || !Array.isArray(raw.data) || raw.data.length !== 1 ||
          typeof raw.data[0].b64_json !== 'string' || raw.data[0].b64_json !== output?.b64 ||
          assetBytesSha256(Buffer.from(output.b64, 'base64')) !== output.imageSha ||
          auditionUsageCost(raw.usage, 'image') !== answer.estimatedMicroUsd) engineSiteFail('engine_saved_image_invalid');
    },
    async execute(pendingId, signal, assertDispatch) {
      if (pendingId || signal.aborted) engineSiteFail('engine_image_dispatch_invalid'); revalidate();
      await assertDispatch();
      let observed: any = null;
      let answer;
      try { answer = await (ports.image ?? generateGPTImage)({ ...input, apiKey: ports.openAIKey(), signal,
        observeProviderResponse: raw => { observed = raw; },
        assertBeforeProviderDispatch: async () => { if (signal.aborted) engineSiteFail('engine_image_cancelled'); revalidate(); await assertDispatch(); } }); }
      catch (error) {
        if (!observed) throw error;
        return { kind: 'completed', result: { output: null, raw: observed, estimatedMicroUsd: auditionUsageCost(observed.usage, 'image'), usable: false } };
      }
      const cost = auditionUsageCost(answer.usage, 'image');
      const output = { b64: answer.buffer.toString('base64'), imageSha: assetBytesSha256(answer.buffer) };
      return { kind: 'completed', result: { output, raw: observed ?? { model: answer.model, usage: answer.usage ?? null,
        responseMeta: answer.responseMeta ?? null }, estimatedMicroUsd: cost,
        usable: answer.model === 'gpt-image-2' && !answer.fallbackUsed && cost !== null, model: answer.model } };
    },
  };
}
