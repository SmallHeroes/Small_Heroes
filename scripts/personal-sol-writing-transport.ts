/** Explicit diagnostic writing route. No client/key/network at import; no production or legacy defaults change. */
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import { compactSchemaDefinitions } from './personal-opus-storyboard-transport';
import { opusOutputContract, CausalTransportError, wireReservation, type TransportReply } from './personal-causal-trial-adapters';
import { replaySettlement } from './personal-new-book-experiment';
import type { MeterRule } from './personal-simple-book-reviewed-audition';
import { hostFail } from './personal-causal-trial-journal';
import { SOL_WRITING } from '../lib/personal-wizard/sol-writing-route';
export { SOL_WRITING } from '../lib/personal-wizard/sol-writing-route';
type TextCall = Pick<CausalDispatch, 'stage' | 'instructions' | 'input' | 'schema' | 'maxOutputTokens'>;
export type SolWritingCall = TextCall | SimpleStoryboardDiagnosticCall;
export type SolWritingWire = { version: typeof SOL_WRITING.version; model: typeof SOL_WRITING.model; stage: 'author' | 'editor' | 'storyboard';
  route: typeof SOL_WRITING.route; outputCap: number; payload: Record<string, any>; json: string; bytes: number; digest: string; reservedMicroUsd: number };
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
function stage(call: SolWritingCall): SolWritingWire['stage'] {
  if (!['author', 'editor', 'storyboard'].includes(call.stage) || typeof call.input !== 'string' || typeof call.instructions !== 'string' ||
    !Number.isSafeInteger(call.maxOutputTokens) || call.maxOutputTokens < 1 || call.maxOutputTokens > 55000) return hostFail('wire_contract');
  return call.stage as SolWritingWire['stage'];
}
/** Same engine instructions/input/output contract. Only explicit transport/model and schema definition names differ. */
export function prepareSolWritingWire(call: SolWritingCall): SolWritingWire {
  const purpose = stage(call);
  const payload: Record<string, any> = purpose === 'storyboard'
    ? personalBookProviderPayload(call as SimpleStoryboardDiagnosticCall, SOL_WRITING.model)
    : { model: SOL_WRITING.model, store: false, service_tier: 'default', reasoning: { effort: 'medium' }, instructions: call.instructions,
      input: call.input, max_output_tokens: call.maxOutputTokens,
      text: { format: { type: 'json_schema', name: `sol_${purpose}`, strict: true, schema: opusOutputContract(call as TextCall).schema } } };
  payload.text.format.schema = compactSchemaDefinitions(payload.text.format.schema);
  const json = JSON.stringify(payload), bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > SOL_WRITING.maxWireBytes) hostFail('wire_limit');
  return { version: SOL_WRITING.version, model: SOL_WRITING.model, route: SOL_WRITING.route, stage: purpose, outputCap: call.maxOutputTokens,
    payload, json, bytes, digest: sha(json), reservedMicroUsd: Math.max(SOL_WRITING.minimumReserveMicroUsd, wireReservation(bytes, call.maxOutputTokens, replaySettlement.rates.sol)) };
}
function validWire(w: SolWritingWire) {
  return w?.version === SOL_WRITING.version && w.model === SOL_WRITING.model && w.route === SOL_WRITING.route &&
    ['author', 'editor', 'storyboard'].includes(w.stage) && w.payload?.model === w.model && w.payload.store === false && w.payload.service_tier === 'default' &&
    w.payload.reasoning?.effort === 'medium' && w.payload.max_output_tokens === w.outputCap && Number.isSafeInteger(w.outputCap) && w.outputCap > 0 && w.outputCap <= 55000 &&
    w.json === JSON.stringify(w.payload) && w.digest === sha(w.json) && w.bytes === Buffer.byteLength(w.json, 'utf8') && w.bytes <= SOL_WRITING.maxWireBytes &&
    w.reservedMicroUsd === Math.max(SOL_WRITING.minimumReserveMicroUsd, wireReservation(w.bytes, w.outputCap, replaySettlement.rates.sol));
}
/** Reuses the existing raw-response settlement; a model/tier/unknown mismatch never becomes free headroom. */
export const solWritingMeterRule: MeterRule = {
  reserve: (w: SolWritingWire) => validWire(w) ? w.reservedMicroUsd : null,
  settle: (w: SolWritingWire, receipt, completed) => {
    if (!validWire(w)) return { estimatedMicroUsd: null, coherent: false };
    // A thrown transport with no receipt is an UNKNOWN charge, not a corrupt or free completed answer.
    if (!completed && receipt == null) return { estimatedMicroUsd: null, coherent: true };
    const s = replaySettlement.answer(replaySettlement.rates.sol, w.outputCap, SOL_WRITING.model, receipt?.raw);
    return { estimatedMicroUsd: s.estimatedMicroUsd, coherent: (!completed || s.valid) && receipt?.stage === w.stage &&
      receipt?.metadata?.reportedModel === receipt?.raw?.model && JSON.stringify(receipt?.usage ?? null) === JSON.stringify(s.usage) };
  },
};
/** A renamed author/editor journal must not masquerade as the one remaining storyboard attempt. */
export function solWritingRuleFor(purpose: SolWritingWire['stage']): MeterRule {
  return { reserve: w => w?.stage === purpose ? solWritingMeterRule.reserve(w) : null,
    settle: (w, r, completed) => w?.stage === purpose ? solWritingMeterRule.settle(w, r, completed) : { estimatedMicroUsd: null, coherent: false } };
}
export function createSolWritingTransport(args: { key: () => string; fetch?: typeof fetch }) {
  return async (wire: SolWritingWire, call: SolWritingCall, signal: AbortSignal): Promise<TransportReply> => {
    if (signal.aborted || !validWire(wire) || JSON.stringify(wire) !== JSON.stringify(prepareSolWritingWire(call))) hostFail('wire_contract');
    let receipt: TransportReply & { stage: string } = { output: null, estimatedMicroUsd: null, usage: null, raw: null, metadata: {}, stage: wire.stage };
    try {
      const key = args.key(); if (!key) hostFail('key_unavailable');
      const client = new OpenAI({ apiKey: key, baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: args.fetch });
      const raw = await client.responses.create(wire.payload as OpenAI.Responses.ResponseCreateParamsNonStreaming, { signal, timeout: SOL_WRITING.timeoutMs });
      const s = replaySettlement.answer(replaySettlement.rates.sol, wire.outputCap, SOL_WRITING.model, raw);
      receipt = { ...receipt, raw, usage: s.usage, estimatedMicroUsd: s.estimatedMicroUsd,
        metadata: { reportedModel: raw.model, serviceTier: raw.service_tier, responseId: raw.id, status: raw.status, kind: 'provider_reported_usage_estimate_not_invoice' } };
      if (signal.aborted) hostFail('cancelled');
      if (!s.valid) hostFail('sol_writing_incomplete_or_usage');
      const parsed = JSON.parse(raw.output_text);
      const output = wire.stage === 'storyboard' ? decodePersonalBookProviderOutput(call as SimpleStoryboardDiagnosticCall, parsed) : opusOutputContract(call as TextCall).decode(parsed);
      return { ...receipt, output };
    } catch (error) { throw new CausalTransportError(typeof (error as any)?.code === 'string' ? (error as any).code : 'provider_or_schema', receipt); }
  };
}
