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
import { standardEngineResponseSchema } from './response-schema';
import { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP, ENGINE_BOUND_REPAIR_REVIEW_STEP } from './storyboard-binding-policy';
import {responseQueueTiming} from './responses-queue-policy';
import { isCurrentCustomerEngine, ENGINE_AUTHOR_BATCH } from './current-engine-policy';

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
const responsePlans=new WeakMap<object,{snapshot:()=>string;sha:string;rebind:(ports:EngineProviderPorts)=>PreparedEngineCall}>();
/** Existing source decoder/body only. Cannot turn a JSON receipt or a forged plan into a new transport. */
export function rebindEnginePendingResponse(plan:PreparedEngineCall,ports:EngineProviderPorts){
 const origin=responsePlans.get(plan);if(!origin||origin.snapshot()!==origin.sha)engineSiteFail('engine_pending_plan_changed');
 plan.revalidate?.();const next=origin.rebind(ports);
 if(canonicalHash(next.call)!==canonicalHash(plan.call)||canonicalHash(next.wire)!==canonicalHash(plan.wire))engineSiteFail('engine_pending_plan_changed');return next;
}

const BATCH_ENDPOINT = 'https://api.anthropic.com/v1/messages/batches';
const BATCH_COMPLETION_MS = 3 * 60 * 60_000;
/** Anthropic answer decoding shared by the direct and batch transports. A failed contract stays a settled unusable answer. */
function anthropicAnswer(planned: ReturnType<typeof planAnthropicAuthor>, raw: any, ok: boolean, transport: 'messages' | 'batch') {
  const cost = anthropicAuthorCost(raw, transport);
  let output: unknown = null, usable = false;
  try {
    const blocks = raw?.content?.filter((b: any) => b.type === 'text');
    if (ok && raw.type === 'message' && raw.model === planned.wire.body.model &&
        raw.stop_reason === 'end_turn' && /^msg_[A-Za-z0-9_-]+$/.test(raw.id) && blocks?.length === 1 &&
        raw.content.every((b: any) => ['text', 'thinking', 'redacted_thinking'].includes(b.type)) &&
        raw.usage?.output_tokens <= planned.wire.body.max_tokens && cost !== null) {
      output = planned.decode(JSON.parse(blocks[0].text)); usable = true;
    }
  } catch { /* Preserve raw, usage and failed contract as a settled unusable answer. */ }
  return { output, raw, estimatedMicroUsd: cost, usable, model: raw?.model,
    ...(raw?.usage ? { usage: { inputTokens: raw.usage.input_tokens, outputTokens: raw.usage.output_tokens } } : {}) };
}

/**
 * The same author body through Message Batches: one short POST, then short polls in later invocations. No step
 * outlives a serverless invocation. The batch id is a checkpoint of THIS claim only; nothing is ever resubmitted.
 */
function prepareEngineAnthropicBatch(a: EngineOrderAuthority, dispatch: CausalDispatch, ports: EngineProviderPorts): PreparedEngineCall {
  const planned = planAnthropicAuthor(a, `story_${dispatch.stage}`, dispatch);
  const customId = planned.call.step;
  const wire = { version: 'engine-site-anthropic-batch/v1' as const, author: planned.wire, endpoint: BATCH_ENDPOINT, customId,
    completionDeadlineMs: BATCH_COMPLETION_MS, maxRetries: 0 as const };
  const call = { ...planned.call, wireSha256: canonicalHash(wire) };
  const headers = () => ({ Authorization: `Bearer ${ports.anthropicKey()}`, 'anthropic-version': planned.wire.apiVersion, 'content-type': 'application/json' });
  const assertWire = () => { if (canonicalHash(planAnthropicAuthor(a, planned.call.step, dispatch).wire) !== canonicalHash(planned.wire) ||
    canonicalHash(wire) !== call.wireSha256) engineSiteFail('engine_provider_plan_changed'); };
  return { call, wire, requiredMs: 20_000, completionDeadlineMs: BATCH_COMPLETION_MS,
    admitSaved(answer) {
      const raw = answer.raw as any, blocks = raw?.content?.filter((b: any) => b.type === 'text'), cost = anthropicAuthorCost(raw, 'batch');
      if (answer.usable !== true || raw.type !== 'message' || raw.model !== planned.wire.body.model || raw.stop_reason !== 'end_turn' ||
          !/^msg_[A-Za-z0-9_-]+$/.test(raw.id) || blocks?.length !== 1 || raw.usage?.output_tokens > planned.wire.body.max_tokens ||
          cost === null || cost !== answer.estimatedMicroUsd || canonicalHash(planned.decode(JSON.parse(blocks[0].text))) !== canonicalHash(answer.output))
        engineSiteFail('engine_saved_anthropic_invalid');
    },
    revalidate: assertWire,
    async execute(pendingId, signal, assertDispatch) {
      if (pendingId && !/^msgbatch_[A-Za-z0-9_-]+$/.test(pendingId)) engineSiteFail('engine_anthropic_batch_id_invalid');
      await assertDispatch(); assertWire();
      const timed = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      if (!pendingId) {
        // Any transport ambiguity here throws: the durable worker keeps the full reserve and never resubmits.
        const response = await ports.fetch(BATCH_ENDPOINT, { method: 'POST', redirect: 'error', headers: headers(), signal: timed,
          body: JSON.stringify({ requests: [{ custom_id: customId, params: planned.wire.body }] }) });
        const raw = await jsonResponse(response);
        if (response.ok && typeof raw.id === 'string' && /^msgbatch_[A-Za-z0-9_-]+$/.test(raw.id)) return { kind: 'pending', id: raw.id, raw };
        // A definitive validation refusal creates no batch and bills nothing.
        if ([400, 401, 403, 404, 413, 422].includes(response.status) && raw?.type === 'error')
          return { kind: 'completed', result: { output: null, raw, estimatedMicroUsd: 0, usable: false } };
        engineSiteFail('engine_anthropic_batch_create_unknown');
      }
      let status: any;
      try {
        const response = await ports.fetch(`${BATCH_ENDPOINT}/${encodeURIComponent(pendingId)}`, { method: 'GET', redirect: 'error', headers: headers(), signal: timed });
        if (response.status === 429 || response.status >= 500) return { kind: 'pending', id: pendingId, raw: { transientPoll: true, status: response.status } };
        status = await jsonResponse(response);
        if (!response.ok || status.id !== pendingId) engineSiteFail('engine_anthropic_batch_status_invalid');
      } catch (error) {
        if (!signal.aborted && !(error instanceof Error && /engine_anthropic_batch_status_invalid/.test(error.message))) return { kind: 'pending', id: pendingId, raw: { transientPoll: true } };
        throw error;
      }
      if (status.processing_status !== 'ended') return { kind: 'pending', id: pendingId, raw: { processing_status: status.processing_status } };
      const resultsUrl = String(status.results_url ?? '');
      if (!resultsUrl.startsWith(`${BATCH_ENDPOINT}/${pendingId}/`)) engineSiteFail('engine_anthropic_batch_results_url');
      const results = await ports.fetch(resultsUrl, { method: 'GET', redirect: 'error', headers: headers(), signal: timed });
      if (results.status === 429 || results.status >= 500) return { kind: 'pending', id: pendingId, raw: { transientResults: true, status: results.status } };
      const text = await results.text();
      if (!results.ok || Buffer.byteLength(text) > 8 * 1024 * 1024) engineSiteFail('engine_anthropic_batch_results_invalid');
      const lines = text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      const mine = lines.filter((line: any) => line?.custom_id === customId);
      if (lines.length !== 1 || mine.length !== 1) engineSiteFail('engine_anthropic_batch_results_invalid');
      const result = mine[0].result;
      if (result?.type === 'succeeded') return { kind: 'completed', result: anthropicAnswer(planned, result.message, true, 'batch') };
      // errored / canceled / expired requests are not billed.
      if (['errored', 'canceled', 'expired'].includes(result?.type))
        return { kind: 'completed', result: { output: null, raw: mine[0], estimatedMicroUsd: 0, usable: false } };
      engineSiteFail('engine_anthropic_batch_results_invalid');
    },
  };
}

export function prepareEngineAnthropic(a: EngineOrderAuthority, dispatch: CausalDispatch, ports: EngineProviderPorts): PreparedEngineCall {
  if (engineOrderAuthoritySchema.parse(a).authorTransport === ENGINE_AUTHOR_BATCH) return prepareEngineAnthropicBatch(a, dispatch, ports);
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
  const originalBody=structuredClone(bodyInput);
  const authority = engineOrderAuthoritySchema.parse(a), schemaPolicy = authority.responseSchemaPolicy;
  const allowed = new Set(['model', 'store', 'service_tier', 'reasoning', 'instructions', 'input', 'max_output_tokens', 'text', 'metadata']);
  if (Object.keys(bodyInput).some(k => !allowed.has(k)) || !['gpt-6.1-sol', 'gpt-6-astra'].includes(bodyInput.model) ||
      bodyInput.service_tier !== 'default' || bodyInput.reasoning?.effort !== 'medium' ||
      !Number.isInteger(bodyInput.max_output_tokens) || bodyInput.max_output_tokens < 1 || bodyInput.max_output_tokens > 55_000)
    engineSiteFail('engine_responses_plan_invalid');
  const body: Record<string, any> = structuredClone({ ...bodyInput, background: true, store: false });
  if (schemaPolicy) {
    if (body.text?.format?.type !== 'json_schema' || body.text.format.strict !== true) engineSiteFail('engine_response_schema_format');
    const originalBytes = Buffer.byteLength(JSON.stringify(body));
    body.text.format.schema = standardEngineResponseSchema(body.text.format.schema);
    if (Buffer.byteLength(JSON.stringify(body)) > originalBytes) engineSiteFail('engine_response_schema_expanded');
  }
  const textParts = typeof body.input === 'string' ? body.input : JSON.stringify(body.input,
    (key, value) => key === 'image_url' ? '[private-image-bytes]' : value);
  const planRecoveryReview = (step === 'initial_storyboard_repair_2_review' ||
    step === 'initial_storyboard_repair_3_review' && !!authority.storyboardAttemptExtension ||
    step === 'initial_storyboard_repair_4_review' && authority.storyboardAttemptExtension?.maxAttempts===5 && !!authority.storyboardConcurrencyPolicy) &&
    (authority.purpose === 'test' || isCurrentCustomerEngine(authority)) && !!schemaPolicy;
  const boundReview = step === ENGINE_BOUND_REVIEW_STEP && (authority.purpose === 'test' || isCurrentCustomerEngine(authority)) &&
    authority.storyboardBindingPolicy === ENGINE_STORYBOARD_BINDING;
  // The current engine's base loop reviews its FIRST repair too (2026-11-12): that review carries the same full storyboard as the initial and
  // bound reviews (114 KB and 106 KB live), so it gets the same full-review capacity; the 104 KB ceiling refused it before dispatch
  // (review_callback_failed) and stopped the book. The review of a bound repair carries the same full board. Historical authorities keep 104 KB.
  const baseRepairReview = (step === 'initial_storyboard_repair_1_review' || step === ENGINE_BOUND_REPAIR_REVIEW_STEP &&
    authority.storyboardBindingPolicy === ENGINE_STORYBOARD_BINDING) && isCurrentCustomerEngine(authority) && !!schemaPolicy;
  const ceiling = /^(prep_storyboard_0_review|initial_storyboard_review)$/.test(step) || planRecoveryReview || boundReview || baseRepairReview ? 208_000 : 104_000;
  if (Buffer.byteLength(String(body.instructions) + textParts) > ceiling || Buffer.byteLength(JSON.stringify(body)) > 64 * 1024 * 1024)
    engineSiteFail('engine_responses_input_limit');
  const queueTiming=authority.responsesQueuePolicy?responseQueueTiming(generationTimeoutMs(body.max_output_tokens)):undefined;
  const wire = { version: queueTiming?'engine-site-responses/v3':schemaPolicy ? 'engine-site-responses/v2' : 'engine-site-responses/v1',
    ...(queueTiming?{responseQueueTiming:queueTiming}:{}),
    ...(schemaPolicy ? { responseSchemaPolicy: schemaPolicy } : {}), authoritySha256: authorityDigest(authority), step, body,
    endpoint: 'https://api.openai.com/v1/responses', maxRetries: 0 };
  const call = slotCall(authority, step, wire);
  const assertWire = () => { if (canonicalHash(wire) !== call.wireSha256) engineSiteFail('engine_provider_plan_changed'); };
  const decodeOutput = (raw: any) => {
    try { return decode(JSON.parse(responseText(raw))); }
    catch (error) {
      // A known, returned unusable native review belongs to the engine's one re-ask rule.
      // Preserve its exact text, not a fabricated assessment; the normal review schema rejects it.
      if (/^page_[0-8]_[0-4]_qa2?$/.test(step)) return responseText(raw);
      throw error;
    }
  };
  const plan:PreparedEngineCall={ call, wire, requiredMs: 20_000, completionDeadlineMs: generationTimeoutMs(body.max_output_tokens),
    ...(queueTiming?{responseQueueTiming:queueTiming}:{}),
    admitSaved(answer) {
      if (schemaPolicy) assertWire();
      const raw = answer.raw as any, cost = raw.model === body.model && raw.service_tier === 'default'
        ? auditionUsageCost(raw.usage, body.model === 'gpt-6.1-sol' ? 'sol' : 'astra') : null;
      if (answer.usable !== true || raw.status !== 'completed' || !/^resp_[A-Za-z0-9_-]+$/.test(raw.id) ||
          raw.usage?.output_tokens > body.max_output_tokens || cost === null || cost !== answer.estimatedMicroUsd ||
          canonicalHash(decodeOutput(raw)) !== canonicalHash(answer.output)) engineSiteFail('engine_saved_response_invalid');
    },
    revalidate: assertWire,
    async execute(pendingId, signal, assertDispatch) {
      if (pendingId && !/^resp_[A-Za-z0-9_-]+$/.test(pendingId)) engineSiteFail('engine_response_id_invalid');
      await assertDispatch();
      if (schemaPolicy) assertWire();
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
  const execute=plan.execute,admit=plan.admitSaved,revalidate=plan.revalidate;
  const snapshot=()=>{if(plan.execute!==execute||plan.admitSaved!==admit||plan.revalidate!==revalidate)return 'changed';return canonicalHash({call:plan.call,wire:plan.wire,requiredMs:plan.requiredMs,completionDeadlineMs:plan.completionDeadlineMs,responseQueueTiming:plan.responseQueueTiming??null});};
  responsePlans.set(plan,{snapshot,sha:snapshot(),rebind:next=>prepareEngineResponse(authority,step,originalBody,decode,next)});return plan;
}

/** Reference and native-page rendering share the order's single explicit quality. Exact reference bytes are frozen and revalidated. */
export function prepareEngineImage(a: EngineOrderAuthority, step: string, rawInput: GenerateGPTImageInput, ports: EngineProviderPorts): PreparedEngineCall {
  const authority = engineOrderAuthoritySchema.parse(a);
  const modelPolicy = authority.imageModelPolicy, model = modelPolicy?.model ?? 'gpt-image-2';
  if (rawInput.complexity !== undefined && rawInput.complexity !== modelPolicy?.complexity) engineSiteFail('engine_image_authority_mismatch');
  const input: GenerateGPTImageInput = { ...rawInput, quality: authority.imageQuality, modelOverride: model,
    ...(modelPolicy ? { complexity: modelPolicy.complexity } : {}), requestTimeoutMs: 180_000 };
  if (rawInput.quality && rawInput.quality !== authority.imageQuality || rawInput.apiKey || rawInput.referenceImages?.some(s => !s.startsWith('data:image/')))
    engineSiteFail('engine_image_authority_mismatch');
  input.exactReferenceBytes = rawInput.exactReferenceBytes?.map(b => Buffer.from(b));
  const plan = planGPTImageRequest(input, { defaultModel: model, defaultQuality: authority.imageQuality, maxReferences: 4 });
  const wire = { version: modelPolicy ? 'engine-site-image/v2' : 'engine-site-image/v1', step, authoritySha256: authorityDigest(authority), mode: plan.apiMode,
    body: plan.bodyWithoutBinaryImage, references: input.exactReferenceBytes?.map(assetBytesSha256) ?? [], maxRetries: 0 };
  if (plan.quality !== authority.imageQuality || plan.model !== model || plan.requestOptions.maxRetries !== 0 ||
      plan.referenceCountPassed !== (input.exactReferenceBytes?.length ?? 0) ||
      (input.exactReferenceBytes?.length ?? 0) !== (input.referenceImages?.length ?? 0)) engineSiteFail('engine_image_plan_invalid');
  const call = slotCall(authority, step, wire);
  if (renderMaximum(modelPolicy ? plan.finalPrompt : input.finalPrompt, plan.referenceCountPassed) > call.maximumMicroUsd) engineSiteFail('engine_image_reserve_insufficient');
  const revalidate = () => {
    if (modelPolicy && canonicalHash(wire) !== call.wireSha256) engineSiteFail('engine_image_plan_changed');
    const next = planGPTImageRequest(input, { defaultModel: model, defaultQuality: authority.imageQuality, maxReferences: 4 });
    if (canonicalHash({ ...wire, mode: next.apiMode, body: next.bodyWithoutBinaryImage,
      references: input.exactReferenceBytes?.map(assetBytesSha256) ?? [] }) !== call.wireSha256 ||
      input.quality !== authority.imageQuality || input.modelOverride !== model ||
      modelPolicy && input.complexity !== modelPolicy.complexity) engineSiteFail('engine_image_plan_changed');
  };
  const modelMatches = (raw: any) => !modelPolicy || [raw?.model, raw?.usage?.model].every(m => m == null || m === model);
  const metadata = (raw: any) => ({ requestedModel: model,
    reportedModel: typeof raw?.model === 'string' ? raw.model : typeof raw?.usage?.model === 'string' ? raw.usage.model : null,
    modelEvidence: typeof raw?.model === 'string' || typeof raw?.usage?.model === 'string' ? 'response_reported' : 'request_bound_only' });
  const imageMatches = (raw: any, buffer: Buffer) => {
    if (!modelPolicy) return true;
    const [width, height] = plan.bodyWithoutBinaryImage.size.split('x').map(Number);
    return raw?.data?.length === 1 && raw.data[0].b64_json === buffer.toString('base64') && buffer.length >= 24 && buffer.length <= 20_000_000 &&
      buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      buffer.readUInt32BE(16) === width && buffer.readUInt32BE(20) === height;
  };
  return { call, wire, requiredMs: 180_000, revalidate,
    admitSaved(answer) {
      const raw = answer.raw as any, output = answer.output as any;
      if (answer.usable !== true || answer.model !== model || !modelMatches(raw) || !Array.isArray(raw.data) || raw.data.length !== 1 ||
          typeof raw.data[0].b64_json !== 'string' || raw.data[0].b64_json !== output?.b64 ||
          assetBytesSha256(Buffer.from(output.b64, 'base64')) !== output.imageSha ||
          auditionUsageCost(raw.usage, 'image') !== answer.estimatedMicroUsd ||
          !imageMatches(raw, Buffer.from(output.b64, 'base64')) || modelPolicy &&
          canonicalHash(metadata(raw)) !== canonicalHash({ requestedModel: output.requestedModel, reportedModel: output.reportedModel, modelEvidence: output.modelEvidence })) engineSiteFail('engine_saved_image_invalid');
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
        return { kind: 'completed', result: { output: null, raw: observed, estimatedMicroUsd: modelMatches(observed) ? auditionUsageCost(observed.usage, 'image') : null, usable: false } };
      }
      const cost = modelMatches(observed) ? auditionUsageCost(modelPolicy ? observed?.usage : answer.usage, 'image') : null;
      const output = { b64: answer.buffer.toString('base64'), imageSha: assetBytesSha256(answer.buffer), ...(modelPolicy ? metadata(observed) : {}) };
      return { kind: 'completed', result: { output, raw: observed ?? { model: answer.model, usage: answer.usage ?? null,
        responseMeta: answer.responseMeta ?? null }, estimatedMicroUsd: cost,
        usable: answer.model === model && !answer.fallbackUsed && cost !== null && imageMatches(observed, answer.buffer), model: answer.model } };
    },
  };
}
