/**
 * The storyboard planner on the restricted Claude Max CLI route: the author/editor hardening (runClaudeCli) for an explicitly routed
 * storyboard call. Diagnostic transport only: no client, key read, spawn or network at import; a caller opts in per stage.
 *
 * The request is the engine's own provider request, built by the OpenAI route's builder (personalBookProviderPayload): the instructions
 * with the provider-output note, the canonical planning input, the provider JSON schema and the normal storyboard cap, with its input and
 * context guards. Only the transport differs: the CLI gets the instructions as its system prompt file, the input on stdin, the schema as
 * --json-schema and the cap as CLAUDE_CODE_MAX_OUTPUT_TOKENS; its structured answer is decoded by the same decoder back to the engine draft.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CAUSAL_MODELS, runClaudeCli, wireReservation, type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';
import { fencedText, hostFail } from './personal-causal-trial-journal';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
/** The planner's fixed identity and the CLI's per-session resource guard (the author/editor's own $2). */
export const OPUS_PLANNER = Object.freeze({ model: CAUSAL_MODELS.opus, route: 'claude_max_cli' as const, effort: 'medium' as const,
  sessionGuardMicroUsd: 2_000_000 });
export type PlannerWire = { role: 'opus'; stage: 'storyboard'; model: typeof CAUSAL_MODELS.opus; outputCap: number; json: string; bytes: number;
  digest: string; reservedMicroUsd: number; payload: Record<string, unknown>; args: string[]; stdin: string };

/** The engine's provider request for one storyboard call (its OpenAI model field is not part of it). */
export function plannerRequest(call: SimpleStoryboardDiagnosticCall) {
  if (call.stage !== 'storyboard') return hostFail('wire_contract');
  const payload = personalBookProviderPayload(call, CAUSAL_MODELS.astra);
  if (typeof payload.input !== 'string') return hostFail('wire_contract');
  return { instructions: payload.instructions, input: payload.input, maxOutputTokens: payload.max_output_tokens, schema: payload.text.format.schema };
}

/**
 * Opt-in planner schema compaction (`policy.plannerSchema` = 'definition-names/v1'): the generated JSON-schema definition names (long
 * property-path names, repeated in every $ref) become d0, d1, ... in their own order, every $ref rewritten. The same schema structure: the same
 * types, properties, enums, required lists and references, so the same answers validate and the same decoder reads them; only the command line
 * and the wire are shorter. Absent, the exact existing schema.
 */
export const PLANNER_SCHEMA_COMPACTION = 'definition-names/v1' as const;
export function compactSchemaDefinitions(schema: Record<string, unknown>): Record<string, unknown> {
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  if (!definitions) return schema;
  const short = new Map(Object.keys(definitions).map((name, i) => [name, `d${i}`]));
  const rename = (v: unknown): unknown => Array.isArray(v) ? v.map(rename) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => {
      if (k !== '$ref' || typeof x !== 'string') return [k, rename(x)];
      const target = x.startsWith('#/definitions/') ? short.get(x.slice('#/definitions/'.length)) : undefined;
      return target ? [k, `#/definitions/${target}`] : hostFail('wire_contract');
    })) : v;
  return Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, k === 'definitions'
    ? Object.fromEntries(Object.entries(definitions).map(([name, d]) => [short.get(name)!, rename(d)])) : rename(v)]));
}

/** The exact CLI wire one storyboard call derives (the author/editor flags, with the planner's own schema, stdin and cap). */
export function prepareOpusStoryboardWire(call: SimpleStoryboardDiagnosticCall, policy: WirePolicy, instructionFile: string): PlannerWire {
  if (!path.isAbsolute(instructionFile)) hostFail('instruction_file');
  if (!Number.isSafeInteger(policy.maxWireBytes) || policy.maxWireBytes < 1 || policy.maxWireBytes > 104_000) hostFail('wire_contract');
  if (policy.plannerSchema !== undefined && policy.plannerSchema !== PLANNER_SCHEMA_COMPACTION) hostFail('wire_contract');
  const request = plannerRequest(call);
  const schema = policy.plannerSchema ? compactSchemaDefinitions(request.schema as Record<string, unknown>) : request.schema;
  const args = ['-p', '--safe-mode', '--model', OPUS_PLANNER.model, '--effort', OPUS_PLANNER.effort, '--tools', '', '--no-session-persistence',
    '--output-format', 'json', '--max-budget-usd', String(OPUS_PLANNER.sessionGuardMicroUsd / 1e6), '--system-prompt-file', instructionFile,
    '--json-schema', JSON.stringify(schema)];
  if (args.map(a => JSON.stringify(a)).join(' ').length + policy.executable.length > 31_000) hostFail('argv_limit');
  const payload = { executable: policy.executable, executableSha256: policy.executableSha256, args, stdin: request.input, instructionFile,
    instructions: request.instructions, environmentOverride: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(request.maxOutputTokens) },
    freshProcess: true, managedPolicyMayRemain: true, tokenCapScope: 'configured_per_request_not_cli_aggregate',
    ...(policy.plannerSchema ? { schemaCompaction: policy.plannerSchema } : {}) };
  const json = JSON.stringify(payload), bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > policy.maxWireBytes) hostFail('wire_limit');
  // UTF8 bytes upper-bound the visible input tokens; the CLI's own --max-budget-usd guard bounds the session.
  const reservedMicroUsd = wireReservation(bytes, request.maxOutputTokens, policy.rates.opus);
  if (reservedMicroUsd > OPUS_PLANNER.sessionGuardMicroUsd) hostFail('wire_budget');
  return { role: 'opus', stage: 'storyboard', model: OPUS_PLANNER.model, outputCap: request.maxOutputTokens, json, bytes, digest: sha(json),
    reservedMicroUsd, payload, args, stdin: request.input };
}

/**
 * The planner transport: the wire must be exactly the one this call derives (rebuilt and compared), the pinned executable unchanged and the
 * system-prompt file exactly the instructions; then one restricted CLI session whose structured answer decodes to the engine draft. A
 * wrong reported model, a nonzero exit, is_error, a missing structured answer, usage or cost, or unconfirmed termination refuses (the
 * receipt kept), so nothing downstream runs.
 */
export function createOpusStoryboardTransport(policy: WirePolicy) {
  return async (wire: PlannerWire, call: SimpleStoryboardDiagnosticCall, signal: AbortSignal): Promise<TransportReply> => {
    if (signal.aborted || call.stage !== 'storyboard' || wire.role !== 'opus' || wire.stage !== 'storyboard' || wire.model !== OPUS_PLANNER.model ||
        wire.digest !== sha(wire.json) || JSON.stringify(wire.payload) !== wire.json ||
        JSON.stringify(prepareOpusStoryboardWire(call, policy, String(wire.payload.instructionFile))) !== JSON.stringify(wire) ||
        sha(readFileSync(policy.executable)) !== policy.executableSha256) hostFail('wire_contract');
    if (fencedText(String(wire.payload.instructionFile), 104_000) !== wire.payload.instructions) hostFail('instruction_file');
    return runClaudeCli(policy, wire, signal, structured => decodePersonalBookProviderOutput(call, structured));
  };
}
