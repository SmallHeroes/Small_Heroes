/** Diagnostic transports only. No client, key read, spawn or network at import. */
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { safeUsage } from './personal-story-trial-guard';
import { CausalHostError, fencedText, hostFail } from './personal-causal-trial-journal';

export const CAUSAL_MODELS = { opus: 'claude-opus-5-5', astra: 'gpt-6-astra' } as const;
export type Role = keyof typeof CAUSAL_MODELS;
export type Rates = { inputMicroUsdPerToken: number; outputMicroUsdPerToken: number };
export type WirePolicy = { executable: string; executableSha256: string; workspace: string; maxWireBytes: number;
  rates: Record<Role, Rates> };
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
const astraPayload = (call: CausalDispatch) => ({ model: CAUSAL_MODELS.astra, store: false, service_tier: 'default', reasoning: { effort: 'medium' },
  instructions: call.instructions, input: call.input, max_output_tokens: call.maxOutputTokens,
  text: { format: zodTextFormat(call.schema, `causal_${call.stage}`) } });
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
  const format = zodTextFormat(call.schema, `causal_${call.stage}`), model = CAUSAL_MODELS[call.role];
  let payload: Record<string, unknown>, args: string[] | null = null, stdin: string | null = null;
  if (call.role === 'astra') {
    payload = astraPayload(call);
  } else {
    if (!instructionFile || !path.isAbsolute(instructionFile)) hostFail('instruction_file');
    args = ['-p', '--safe-mode', '--model', model, '--effort', 'medium', '--tools', '', '--no-session-persistence',
      '--output-format', 'json', '--max-budget-usd', String(capMicroUsd / 1e6), '--system-prompt-file', instructionFile,
      '--json-schema', JSON.stringify(format.schema)];
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

export function createAstraCausalTransport(args: { key: () => string; rates: Rates; fetch?: typeof fetch }) {
  return async (wire: CausalWire, call: CausalDispatch, signal: AbortSignal): Promise<TransportReply> => {
    if (signal.aborted || wire.role !== 'astra' || call.role !== 'astra' || isOpus(call.stage) || wire.stage !== call.stage ||
      wire.outputCap !== call.maxOutputTokens || wire.model !== CAUSAL_MODELS.astra || wire.digest !== sha(wire.json) ||
      JSON.stringify(wire.payload) !== wire.json || JSON.stringify(astraPayload(call)) !== wire.json) hostFail('wire_contract');
    let receipt = knownReceipt(null, {}, null, null);
    try {
      const key = args.key(); if (!key) hostFail('key_unavailable');
      const client = new OpenAI({ apiKey: key, baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: args.fetch });
      const response = await client.responses.create(wire.payload as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming,
        { signal, timeout: generationTimeoutMs(wire.outputCap) });
      const usage = safeUsage(response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null);
      const micro = usage ? Math.ceil(usage.inputTokens * args.rates.inputMicroUsdPerToken + usage.outputTokens * args.rates.outputMicroUsdPerToken) : null;
      receipt = knownReceipt(response, { reportedModel: bounded(response.model), responseId: bounded(response.id), status: bounded(response.status),
        serviceTier: bounded(response.service_tier), kind: 'provider_reported_not_independent_attestation' }, usage, micro);
      if (signal.aborted) hostFail('cancelled');
      if (response.model !== wire.model || response.service_tier !== 'default') hostFail('reported_model_or_tier');
      if (!usage || usage.outputTokens > wire.outputCap) hostFail('usage');
      if (response.status !== 'completed' || !response.output_text) hostFail('incomplete');
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
        tokenCapScope: 'configured_per_request_not_cli_aggregate', invoiceCapGuaranteed: false }, usage, micro);
      if (stopped || signal.aborted || !killConfirmed || termination.code !== 0 || termination.signal || termination.spawnError) hostFail('cli_termination');
      if (modelKeys.length !== 1 || modelKeys[0] !== wire.model) hostFail('reported_model_or_tier');
      if (!usage || micro === null || usage.outputTokens > wire.outputCap) hostFail('usage');
      if (parsed.is_error !== false || parsed.subtype !== 'success' || !parsed.structured_output || raw.stdout.includes('\ufffd')) hostFail('incomplete');
      const output = call.schema.parse(parsed.structured_output);
      return { ...receipt, output };
    } catch (error) {
      throw new CausalTransportError(error instanceof CausalHostError ? error.code : 'provider_or_schema', receipt);
    }
  };
}
