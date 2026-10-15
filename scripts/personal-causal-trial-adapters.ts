/** Diagnostic transports only. No client, key read, spawn or network at import. */
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { safeUsage } from './personal-story-trial-guard';
import { CausalHostError, fencedText, hostFail } from './personal-causal-trial-journal';
import { inlineLocalJsonSchemaReferences } from './personal-inline-json-schema';

export const CAUSAL_MODELS = { opus: 'claude-opus-5-5', astra: 'gpt-6-astra' } as const;
export type Role = keyof typeof CAUSAL_MODELS;
export type Rates = { inputMicroUsdPerToken: number; outputMicroUsdPerToken: number };
export type WirePolicy = { executable: string; executableSha256: string; workspace: string; maxWireBytes: number;
  rates: Record<Role, Rates>; astraInlineReferences?: true; openAIReviewModel?: 'gpt-6.1-sol' };
export type CausalWire = { role: Role; stage: CausalDispatch['stage']; model: string; outputCap: number;
  json: string; bytes: number; digest: string; reservedMicroUsd: number;
  payload: Record<string, unknown>; stdin: string | null; args: string[] | null };
export type TransportReceipt = { estimatedMicroUsd: number | null; usage: ReturnType<typeof safeUsage>;
  metadata: Record<string, unknown>; raw: unknown };
export type TransportReply = TransportReceipt & { output: unknown };
export class CausalTransportError extends CausalHostError {
  constructor(code: string, readonly receipt: TransportReceipt) { super(code); }
}
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const isOpus = (stage: CausalDispatch['stage']) => ['plan', 'replan', 'author', 'editor'].includes(stage);
const astraPayload = (call: CausalDispatch, inline = false, model: string = CAUSAL_MODELS.astra) => {
  const format = zodTextFormat(call.schema, `causal_${call.stage}`);
  return { model, store: false, service_tier: 'default', reasoning: { effort: 'medium' },
    instructions: call.instructions, input: call.input, max_output_tokens: call.maxOutputTokens,
    text: { format: inline ? { ...format, schema: inlineLocalJsonSchemaReferences(format.schema) } : format } };
};
export function opusOutputContract(call: Pick<CausalDispatch, 'stage' | 'schema'>) {
  const format = zodTextFormat(call.schema, `causal_${call.stage}`), schema = format.schema;
  if (schema.type === 'object' && !['anyOf', 'oneOf', 'allOf'].some(key => key in schema)) {
    return { schema, decode: (value: unknown) => call.schema.parse(value) };
  }
  // Tool input roots cannot carry combinators. Keep the union under a strict
  // transport-only property, regenerating refs instead of relocating JSON by hand.
  if (schema.type !== undefined || 'oneOf' in schema || 'allOf' in schema || !Array.isArray(schema.anyOf) || schema.anyOf.length === 0 ||
    schema.anyOf.some(branch => !branch || typeof branch !== 'object' || branch.type !== 'object')) hostFail('cli_schema');
  const envelope = z.object({ result: call.schema }).strict();
  return { schema: zodTextFormat(envelope, `causal_${call.stage}`).schema,
    decode: (value: unknown) => envelope.parse(value).result };
}
export function wireReservation(bytes: number, tokens: number, rate: Rates) {
  if (![bytes, tokens].every(n => Number.isSafeInteger(n) && n > 0) ||
    ![rate.inputMicroUsdPerToken, rate.outputMicroUsdPerToken].every(n => Number.isFinite(n) && n > 0)) hostFail('pricing');
  // UTF8 bytes upper-bound visible input tokens; not CLI hidden prompts/internal turns.
  const amount = Math.ceil((bytes * rate.inputMicroUsdPerToken + tokens * rate.outputMicroUsdPerToken) * 1.1);
  if (!Number.isSafeInteger(amount) || amount <= 0) hostFail('pricing');
  return amount;
}
export function prepareCausalWire(call: CausalDispatch, policy: WirePolicy, capMicroUsd: number, instructionFile?: string): CausalWire {
  if (!(call.role in CAUSAL_MODELS) || isOpus(call.stage) !== (call.role === 'opus') ||
    !Number.isSafeInteger(call.maxOutputTokens) || call.maxOutputTokens < 1 || call.maxOutputTokens > 55_000 ||
    !Number.isSafeInteger(policy.maxWireBytes) || policy.maxWireBytes < 1 || policy.maxWireBytes > 104_000) hostFail('wire_contract');
  if (policy.openAIReviewModel !== undefined && policy.openAIReviewModel !== 'gpt-6.1-sol') hostFail('wire_contract');
  if (policy.openAIReviewModel && (policy.rates.astra.inputMicroUsdPerToken !== 2 || policy.rates.astra.outputMicroUsdPerToken !== 10)) hostFail('pricing');
  // role='astra' is the legacy OpenAI-review transport role, NOT a reported model.
  const model = call.role === 'astra' ? policy.openAIReviewModel ?? CAUSAL_MODELS.astra : CAUSAL_MODELS.opus;
  let payload: Record<string, unknown>, args: string[] | null = null, stdin: string | null = null;
  if (call.role === 'astra') {
    payload = astraPayload(call, policy.astraInlineReferences, model);
  } else {
    if (!instructionFile || !path.isAbsolute(instructionFile)) hostFail('instruction_file');
    args = ['-p', '--safe-mode', '--model', model, '--effort', 'medium', '--tools', '', '--no-session-persistence',
      '--output-format', 'json', '--max-budget-usd', String(capMicroUsd / 1e6), '--system-prompt-file', instructionFile,
      '--json-schema', JSON.stringify(opusOutputContract(call).schema)];
    if (args.map(a => JSON.stringify(a)).join(' ').length + policy.executable.length > 31_000) hostFail('argv_limit');
    stdin = call.input;
    payload = { executable: policy.executable, executableSha256: policy.executableSha256, args, stdin, instructionFile, instructions: call.instructions,
      environmentOverride: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(call.maxOutputTokens) },
      freshProcess: true, managedPolicyMayRemain: true, tokenCapScope: 'configured_per_request_not_cli_aggregate' };
  }
  const json = JSON.stringify(payload), bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > policy.maxWireBytes) hostFail('wire_limit');
  const reservedMicroUsd = wireReservation(bytes, call.maxOutputTokens, policy.rates[call.role]);
  if (reservedMicroUsd > capMicroUsd) hostFail('wire_budget');
  return { role: call.role, stage: call.stage, model, outputCap: call.maxOutputTokens, json, bytes, digest: sha(json), reservedMicroUsd, payload, args, stdin };
}
function knownReceipt(raw: unknown, metadata: Record<string, unknown>, usage: unknown, micro: number | null): TransportReceipt {
  return { raw, metadata, usage: safeUsage(usage), estimatedMicroUsd: micro };
}
const bounded = (s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9._:/-]{1,180}$/.test(s) ? s : null;

export function createAstraCausalTransport(args: { key: () => string; rates: Rates; fetch?: typeof fetch; inlineReferences?: true; model?: 'gpt-6.1-sol' }) {
  if (args.model !== undefined && args.model !== 'gpt-6.1-sol') hostFail('wire_contract');
  if (args.model && (args.rates.inputMicroUsdPerToken !== 2 || args.rates.outputMicroUsdPerToken !== 10)) hostFail('pricing');
  const model = args.model ?? CAUSAL_MODELS.astra;
  return async (wire: CausalWire, call: CausalDispatch, signal: AbortSignal): Promise<TransportReply> => {
    if (signal.aborted || wire.role !== 'astra' || call.role !== 'astra' || isOpus(call.stage) || wire.stage !== call.stage ||
      wire.outputCap !== call.maxOutputTokens || wire.model !== model || wire.digest !== sha(wire.json) ||
      JSON.stringify(wire.payload) !== wire.json || JSON.stringify(astraPayload(call, args.inlineReferences, model)) !== wire.json) hostFail('wire_contract');
    let receipt = knownReceipt(null, {}, null, null);
    try {
      const key = args.key(); if (!key) hostFail('key_unavailable');
      const client = new OpenAI({ apiKey: key, baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: args.fetch });
      const response = await client.responses.create(wire.payload as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming,
        { signal, timeout: generationTimeoutMs(wire.outputCap) });
      const usage = safeUsage(response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null);
      const knownPricing = !args.model || response.model === wire.model && response.service_tier === 'default';
      const micro = usage && knownPricing ? Math.ceil(usage.inputTokens * args.rates.inputMicroUsdPerToken + usage.outputTokens * args.rates.outputMicroUsdPerToken) : null;
      receipt = knownReceipt(response, { reportedModel: bounded(response.model), responseId: bounded(response.id), status: bounded(response.status),
        serviceTier: bounded(response.service_tier), kind: 'provider_reported_not_independent_attestation' }, usage, micro);
      if (signal.aborted) hostFail('cancelled');
      if (response.model !== wire.model || response.service_tier !== 'default') hostFail('reported_model_or_tier');
      if (!usage || usage.outputTokens > wire.outputCap) hostFail('usage');
      if (response.status !== 'completed' || !response.output_text) {
        if (args.inlineReferences && response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens') {
          const output = response.output_text || '';
          hostFail(output.length - output.trimEnd().length >= 256 ? 'astra_output_limit_whitespace' : 'astra_output_limit');
        }
        hostFail('incomplete');
      }
      const output = call.schema.parse(JSON.parse(response.output_text));
      return { ...receipt, output };
    } catch (error) {
      throw new CausalTransportError(error instanceof CausalHostError ? error.code : 'provider_or_schema', receipt);
    }
  };
}

export function createOpusCausalTransport(policy: WirePolicy) {
  return async (wire: CausalWire, call: CausalDispatch, signal: AbortSignal): Promise<TransportReply> => {
    if (signal.aborted || wire.role !== 'opus' || call.role !== 'opus' || !isOpus(call.stage) || wire.stage !== call.stage ||
      wire.outputCap !== call.maxOutputTokens || wire.model !== CAUSAL_MODELS.opus || !wire.args || wire.stdin !== call.input || wire.digest !== sha(wire.json) ||
      JSON.stringify(wire.payload) !== wire.json || sha(readFileSync(policy.executable)) !== policy.executableSha256) hostFail('wire_contract');
    if (JSON.stringify(wire.args) !== JSON.stringify(wire.payload.args) || wire.payload.stdin !== call.input ||
      wire.payload.instructions !== call.instructions || wire.payload.executable !== policy.executable || wire.payload.executableSha256 !== policy.executableSha256) hostFail('wire_contract');
    if (fencedText(String(wire.payload.instructionFile), 104_000) !== call.instructions) hostFail('instruction_file');
    return runClaudeCli(policy, wire, signal, structured => opusOutputContract(call).decode(structured));
  };
}

/**
 * One restricted Claude Max CLI session (every Opus caller's hardening): the approved local login with credential/endpoint overrides
 * stripped, a fresh process, the deadline, capped capture, confirmed termination, exactly the wire's one reported model, known usage and
 * CLI cost, and a successful structured answer that `decode` maps to the caller's own contract. The caller has already bound its wire.
 */
export async function runClaudeCli(policy: WirePolicy, wire: { args: string[] | null; stdin: string | null; outputCap: number; model: string },
  signal: AbortSignal, decode: (structured: unknown) => unknown): Promise<TransportReply> {
    if (!wire.args || wire.stdin === null) hostFail('wire_contract');
    let receipt = knownReceipt(null, {}, null, null);
    try {
      // Keep the approved local login, not environment-injected API keys/endpoints/session aliases.
      const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(ANTHROPIC_|CLAUDE_)/i.test(name))) as NodeJS.ProcessEnv;
      env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(wire.outputCap);
      const child = spawn(policy.executable, wire.args, { cwd: policy.workspace, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env });
      const chunks: Buffer[] = [], errors: Buffer[] = [];
      let size = 0, stopped = false, killConfirmed = false;
      const stop = () => { if (stopped) return; stopped = true; try { child.kill(); } catch { /* termination remains unconfirmed */ } };
      const timer = setTimeout(stop, generationTimeoutMs(wire.outputCap));
      signal.addEventListener('abort', stop, { once: true });
      const capture = (target: Buffer[]) => (b: Buffer) => { size += b.length; if (size > 2_000_000) stop(); else target.push(Buffer.from(b)); };
      child.stdout.on('data', capture(chunks)); child.stderr.on('data', capture(errors));
      child.stdin.on('error', stop);
      let termination: { code: number | null; signal: string | null; spawnError?: boolean };
      try {
        const closed = new Promise<{ code: number | null; signal: string | null; spawnError?: boolean }>(resolve => {
          child.once('error', () => resolve({ code: null, signal: null, spawnError: true }));
          child.once('close', (code, sig) => { killConfirmed = true; resolve({ code, signal: sig }); });
          // Stop waiting, not evidence of kill success. No next dispatch after unknown termination.
          const deadline = setTimeout(() => resolve({ code: null, signal: null }), generationTimeoutMs(wire.outputCap) + 10_000);
          child.once('close', () => clearTimeout(deadline)); child.once('error', () => clearTimeout(deadline));
        });
        if (signal.aborted) stop(); else child.stdin.end(wire.stdin);
        termination = await closed;
      } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
      const raw = { stdout: Buffer.concat(chunks).toString('utf8'), stderr: Buffer.concat(errors).toString('utf8'), termination,
        killConfirmed, stopped, internalProviderCallCount: 'unverified' };
      receipt = knownReceipt(raw, { kind: 'cli_reported_estimate_not_invoice', termination }, null, null);
      const parsed = JSON.parse(raw.stdout);
      const modelKeys = Object.keys(parsed.modelUsage ?? {}), modelUsage = parsed.modelUsage?.[wire.model];
      const usage = safeUsage(modelUsage ? { inputTokens: modelUsage.inputTokens, outputTokens: modelUsage.outputTokens } : null);
      const cost = parsed.total_cost_usd;
      const micro = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 && Number.isSafeInteger(Math.ceil(cost * 1e6)) ? Math.ceil(cost * 1e6) : null;
      receipt = knownReceipt(raw, { ...receipt.metadata, reportedModels: modelKeys.slice(0, 10).map(bounded),
        reportedTurns: Number.isSafeInteger(parsed.num_turns) && parsed.num_turns >= 0 ? parsed.num_turns : null,
        tokenCapScope: 'configured_per_request_not_cli_aggregate', usageScope: 'cli_cumulative', invoiceCapGuaranteed: false }, usage, micro);
      if (stopped || signal.aborted || !killConfirmed || termination.code !== 0 || termination.signal || termination.spawnError) hostFail('cli_termination');
      if (modelKeys.length !== 1 || modelKeys[0] !== wire.model) hostFail('reported_model_or_tier');
      // modelUsage aggregates the CLI session, whereas the child env configures
      // individual requests. Do not compare different scopes or infer internal
      // request counts. The host still enforces the unchanged slot USD allowance.
      if (!usage || micro === null) hostFail('usage');
      if (parsed.is_error !== false || parsed.subtype !== 'success' || !parsed.structured_output || raw.stdout.includes('\ufffd')) hostFail('incomplete');
      const output = decode(parsed.structured_output);
      return { ...receipt, output };
    } catch (error) {
      throw new CausalTransportError(error instanceof CausalHostError ? error.code : 'provider_or_schema', receipt);
    }
}
