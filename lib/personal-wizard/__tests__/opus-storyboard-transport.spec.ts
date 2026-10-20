import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
/** A fake Claude CLI process at the spawn boundary: the transports' own capture, termination and parsing run for real. */
const cli = vi.hoisted(() => ({ spawn: vi.fn(), spawned: [] as { executable: string; args: string[]; options: any; stdin: string | null }[] }));
vi.mock('node:child_process', () => ({ spawn: cli.spawn }));
import { replanFixture } from './storyboard-replan-fixture';
import { providerStoryboard } from './storyboard-replan-fixture';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '../book-openai';
import { OPUS_PLANNER, createOpusStoryboardTransport, plannerRequest, prepareOpusStoryboardWire } from '../../../scripts/personal-opus-storyboard-transport';
import { CAUSAL_MODELS, createOpusCausalTransport, prepareCausalWire, type WirePolicy } from '../../../scripts/personal-causal-trial-adapters';
import { z } from 'zod';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
type Run = { stdout?: string; code?: number | null; signal?: string | null; spawnError?: boolean };
/** The next spawned process answers with `run` (a successful structured answer by default). */
function answer(run: Run) {
  cli.spawn.mockImplementationOnce((executable: string, args: string[], options: any) => {
    const child = new EventEmitter() as any, record = { executable, args, options, stdin: null as string | null };
    cli.spawned.push(record);
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = vi.fn(() => true);
    child.stdin = { on: () => {}, end: (data: string) => {
      record.stdin = data;
      setImmediate(() => {
        if (run.stdout !== undefined) child.stdout.emit('data', Buffer.from(run.stdout));
        if (run.spawnError) child.emit('error', new Error('process error')); else child.emit('close', run.code ?? 0, run.signal ?? null);
      });
    } };
    return child;
  });
}
const cliResult = (structured: unknown, over: Record<string, unknown> = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
  num_turns: 2, total_cost_usd: 0.41, modelUsage: { [CAUSAL_MODELS.opus]: { inputTokens: 20000, outputTokens: 9000 } }, structured_output: structured, ...over });

let root: string, policy: WirePolicy, call: SimpleStoryboardDiagnosticCall, structured: any, instructionFile: string;
beforeEach(async () => {
  cli.spawn.mockReset(); cli.spawned.length = 0;
  root = mkdtempSync(path.join(tmpdir(), 'sh_opus_planner_test_'));
  const executable = path.join(root, 'SYNTHETIC-claude.exe'); writeFileSync(executable, 'synthetic executable, never run');
  policy = { executable, executableSha256: sha(readFileSync(executable)), workspace: root, maxWireBytes: 104000,
    rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } }, openAIReviewModel: 'gpt-6.1-sol' };
  // A real storyboard call of the current engine (owned appearance), captured at the diagnostic's provider boundary.
  const r = await replanFixture();
  await runSimpleStoryboardDiagnostic({ request: r.request, writerResult: r.writerResult, options: r.options, signal: new AbortController().signal,
    actorOwnedAppearance: true, generate: async c => { call ??= c; throw Error('captured'); } }).catch(() => {});
  structured = providerStoryboard(r.draft);
  instructionFile = path.join(root, 'storyboard-instructions.txt');
  writeFileSync(instructionFile, plannerRequest(call).instructions);
});
afterEach(() => {
  if (path.dirname(root) !== tmpdir() || !path.basename(root).startsWith('sh_opus_planner_test_')) throw Error('cleanup_boundary');
  rmSync(root, { recursive: true, force: true }); (call as unknown) = undefined;
});

describe('the Opus storyboard planner wire (offline; the OpenAI route\'s own request, carried to the Claude Max CLI)', () => {
  it('carries exactly the engine request: the provider instructions, the canonical input, the provider schema and the normal cap', () => {
    const openai = personalBookProviderPayload(call, CAUSAL_MODELS.astra), wire = prepareOpusStoryboardWire(call, policy, instructionFile);
    expect(wire).toMatchObject({ role: 'opus', stage: 'storyboard', model: 'claude-opus-5-5', outputCap: openai.max_output_tokens, stdin: openai.input });
    expect(wire.args).toEqual(['-p', '--safe-mode', '--model', 'claude-opus-5-5', '--effort', 'medium', '--tools', '', '--no-session-persistence',
      '--output-format', 'json', '--max-budget-usd', '2', '--system-prompt-file', instructionFile, '--json-schema', JSON.stringify(openai.text.format.schema)]);
    expect(wire.payload).toEqual({ executable: policy.executable, executableSha256: policy.executableSha256, args: wire.args, stdin: openai.input, instructionFile,
      instructions: openai.instructions, environmentOverride: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(openai.max_output_tokens) }, freshProcess: true,
      managedPolicyMayRemain: true, tokenCapScope: 'configured_per_request_not_cli_aggregate' });
    expect([wire.json, wire.digest, wire.bytes]).toEqual([JSON.stringify(wire.payload), sha(wire.json), Buffer.byteLength(wire.json, 'utf8')]);
    expect(wire.reservedMicroUsd).toBe(Math.ceil((wire.bytes * 4 + openai.max_output_tokens * 20) * 1.1));
    expect(wire.reservedMicroUsd).toBeLessThanOrEqual(OPUS_PLANNER.sessionGuardMicroUsd);
    // The same request content whichever transport carries it.
    expect(plannerRequest(call)).toEqual({ instructions: openai.instructions, input: openai.input, maxOutputTokens: openai.max_output_tokens, schema: openai.text.format.schema });
  });
  it('refuses another stage, a relative prompt file, an over-long command line or wire, and a session over its guard; never shrinks a cap to fit', () => {
    expect(() => prepareOpusStoryboardWire({ ...call, stage: 'review' } as never, policy, instructionFile)).toThrow();
    expect(() => prepareOpusStoryboardWire(call, policy, 'storyboard-instructions.txt')).toThrow('causal_host_instruction_file');
    expect(() => prepareOpusStoryboardWire(call, { ...policy, executable: 'x'.repeat(31000) }, instructionFile)).toThrow('causal_host_argv_limit');
    expect(() => prepareOpusStoryboardWire(call, { ...policy, maxWireBytes: 1000 }, instructionFile)).toThrow('causal_host_wire_limit');
    expect(() => prepareOpusStoryboardWire(call, { ...policy, rates: { ...policy.rates, opus: { inputMicroUsdPerToken: 400, outputMicroUsdPerToken: 2000 } } }, instructionFile))
      .toThrow('causal_host_wire_budget');
    // A non-normal cap is the payload builder's own refusal (never shrunk to fit).
    expect(() => prepareOpusStoryboardWire({ ...call, maxOutputTokens: call.maxOutputTokens - 1 }, policy, instructionFile)).toThrow('book_provider_context');
  });
});

describe('the Opus storyboard planner transport (a faked CLI process; capture, termination and parsing run for real)', () => {
  const run = (wire = prepareOpusStoryboardWire(call, policy, instructionFile), signal = new AbortController().signal) =>
    createOpusStoryboardTransport(policy)(wire, call, signal);
  it('one restricted session: the pinned executable, the exact flags and stdin, stripped credentials, the cap; the answer decoded to the engine draft', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-synthetic-not-a-credential'); vi.stubEnv('CLAUDE_CONFIG_DIR', 'C:/elsewhere');
    answer({ stdout: cliResult(structured) });
    const reply = await run();
    vi.unstubAllEnvs();
    expect(cli.spawned).toHaveLength(1);
    const [s] = cli.spawned, wire = prepareOpusStoryboardWire(call, policy, instructionFile);
    expect([s.executable, s.args, s.stdin, s.options.cwd]).toEqual([policy.executable, wire.args, wire.stdin, policy.workspace]);
    expect(Object.keys(s.options.env).filter(k => /^(ANTHROPIC_|CLAUDE_)/i.test(k))).toEqual(['CLAUDE_CODE_MAX_OUTPUT_TOKENS']);
    expect(s.options.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe(String(call.maxOutputTokens));
    expect(reply.output).toEqual(decodePersonalBookProviderOutput(call, structured));
    expect(reply).toMatchObject({ estimatedMicroUsd: 410000, usage: { inputTokens: 20000, outputTokens: 9000 },
      metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], usageScope: 'cli_cumulative' },
      raw: { termination: { code: 0, signal: null }, killConfirmed: true, stopped: false } });
  });
  it('every unusable answer refuses with its receipt kept, so nothing downstream runs', async () => {
    const cases: [string, Run, string][] = [
      ['another reported model', { stdout: cliResult(structured, { modelUsage: { 'claude-sonnet-5-5': { inputTokens: 1, outputTokens: 1 } } }) }, 'reported_model_or_tier'],
      ['a second reported model', { stdout: cliResult(structured, { modelUsage: { [CAUSAL_MODELS.opus]: { inputTokens: 1, outputTokens: 1 }, 'claude-haiku-5-5': { inputTokens: 1, outputTokens: 1 } } }) }, 'reported_model_or_tier'],
      ['success JSON with a nonzero exit', { stdout: cliResult(structured), code: 1 }, 'cli_termination'],
      ['a signal', { stdout: cliResult(structured), code: null, signal: 'SIGTERM' }, 'cli_termination'],
      // A process error after a success-looking answer: termination is never confirmed.
      ['an unconfirmed termination after a success-looking answer', { stdout: cliResult(structured), spawnError: true }, 'cli_termination'],
      // With no output at all, the runner's parse refuses first (its unchanged order: parse, then termination).
      ['a process that never started', { spawnError: true }, 'provider_or_schema'],
      ['is_error', { stdout: cliResult(structured, { is_error: true }) }, 'incomplete'],
      ['not a success', { stdout: cliResult(structured, { subtype: 'error_max_budget_usd' }) }, 'incomplete'],
      ['no structured answer', { stdout: cliResult(undefined) }, 'incomplete'],
      ['no usage', { stdout: cliResult(structured, { modelUsage: { [CAUSAL_MODELS.opus]: {} } }) }, 'usage'],
      ['no cost', { stdout: cliResult(structured, { total_cost_usd: null }) }, 'usage'],
      ['an answer outside the schema', { stdout: cliResult({ ...structured, plan: { ...structured.plan, pages: [] } }) }, 'provider_or_schema'],
      ['unparseable output', { stdout: 'not json' }, 'provider_or_schema'],
    ];
    for (const [label, r, code] of cases) {
      answer(r);
      const error = await run().then(() => null, (e: unknown) => e as any);
      expect([label, error?.code]).toEqual([label, code]);
      expect(error.receipt, label).toBeTruthy();
    }
    // A known cost survives a refusal after the CLI answered (the journal keeps it).
    answer({ stdout: cliResult(structured, { is_error: true }) });
    expect((await run().catch(e => e)).receipt.estimatedMicroUsd).toBe(410000);
  });
  it('refuses before any process: a wire this call does not derive, a changed executable, a changed prompt file, an aborted signal', async () => {
    const wire = prepareOpusStoryboardWire(call, policy, instructionFile);
    const altered = (change: (w: any) => void) => { const w = structuredClone(wire) as any; change(w); return w; };
    const rebind = (w: any) => { w.json = JSON.stringify(w.payload); w.digest = sha(w.json); return w; };
    for (const [label, w, code] of [
      ['stdin changed (rebound)', altered(w => { w.stdin = w.payload.stdin = `${w.stdin} `; rebind(w); }), 'wire_contract'],
      ['another model', altered(w => { w.model = 'claude-sonnet-5-5'; }), 'wire_contract'],
      ['a flag dropped (rebound)', altered(w => { w.args = w.payload.args = w.args.filter((a: string) => a !== '--safe-mode'); rebind(w); }), 'wire_contract'],
      ['a larger budget (rebound)', altered(w => { w.args = w.payload.args = w.args.map((a: string) => a === '2' ? '20' : a); rebind(w); }), 'wire_contract'],
      ['another cap (rebound)', altered(w => { w.payload.environmentOverride = { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000' }; rebind(w); }), 'wire_contract'],
      ['the digest', altered(w => { w.digest = '0'.repeat(64); }), 'wire_contract'],
    ] as const) {
      await expect(run(w as never), label).rejects.toMatchObject({ code });
    }
    writeFileSync(policy.executable, 'another binary');
    await expect(run()).rejects.toMatchObject({ code: 'wire_contract' });
    writeFileSync(policy.executable, 'synthetic executable, never run');
    writeFileSync(instructionFile, 'other instructions');
    await expect(run()).rejects.toMatchObject({ code: 'instruction_file' });
    writeFileSync(instructionFile, plannerRequest(call).instructions);
    const aborted = new AbortController(); aborted.abort();
    await expect(run(undefined, aborted.signal)).rejects.toMatchObject({ code: 'wire_contract' });
    expect(cli.spawn).not.toHaveBeenCalled();
  });
  it('opt-in schema compaction (definition-names/v1): the same schema under short definition names, a shorter command line, marked; absent the exact wire', async () => {
    const compactPolicy: WirePolicy = { ...policy, plannerSchema: 'definition-names/v1' };
    const plain = prepareOpusStoryboardWire(call, policy, instructionFile), compact = prepareOpusStoryboardWire(call, compactPolicy, instructionFile);
    const schemaOf = (w: typeof plain) => JSON.parse(w.args[w.args.length - 1]);
    /** Every $ref replaced by its definition: the schema a validator actually applies. */
    const deref = (schema: any) => {
      const defs = schema.definitions ?? {};
      const walk = (v: any): any => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object'
        ? (typeof v.$ref === 'string' ? walk(defs[v.$ref.slice('#/definitions/'.length)])
          : Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'definitions').map(([k, x]) => [k, walk(x)]))) : v;
      return walk(schema);
    };
    const names = Object.keys(schemaOf(plain).definitions ?? {});
    expect(names.length).toBeGreaterThan(0);
    expect(Object.keys(schemaOf(compact).definitions)).toEqual(names.map((_, i) => `d${i}`));
    expect(deref(schemaOf(compact))).toEqual(deref(schemaOf(plain)));
    expect(compact.args.slice(0, -1)).toEqual(plain.args.slice(0, -1));
    expect([compact.payload.schemaCompaction, 'schemaCompaction' in plain.payload, compact.bytes < plain.bytes,
      compact.args[compact.args.length - 1].length < plain.args[plain.args.length - 1].length]).toEqual(['definition-names/v1', false, true, true]);
    expect(() => prepareOpusStoryboardWire(call, { ...policy, plannerSchema: 'other' as never }, instructionFile)).toThrow('wire_contract');
    // The compacted session decodes the same structured answer; a compacted wire under a plain policy is not the wire this call derives.
    answer({ stdout: cliResult(structured) });
    const reply = await createOpusStoryboardTransport(compactPolicy)(compact, call, new AbortController().signal);
    expect([cli.spawned[0].args, reply.output]).toEqual([compact.args, decodePersonalBookProviderOutput(call, structured)]);
    await expect(createOpusStoryboardTransport(policy)(compact, call, new AbortController().signal)).rejects.toMatchObject({ code: 'wire_contract' });
    await expect(createOpusStoryboardTransport(compactPolicy)(plain, call, new AbortController().signal)).rejects.toMatchObject({ code: 'wire_contract' });
    expect(cli.spawn).toHaveBeenCalledTimes(1);
  });
  it('the author/editor transport over the shared CLI runner is unchanged: same session, its own contract decoded', async () => {
    const schema = z.object({ title: z.string() }).strict();
    const dispatch = { role: 'opus' as const, stage: 'author' as const, conversationKey: 'regression', instructions: 'Write.', input: '{"brief":1}', schema, maxOutputTokens: 16000 };
    const authorFile = path.join(root, 'author-instructions.txt'); writeFileSync(authorFile, dispatch.instructions);
    const wire = prepareCausalWire(dispatch, policy, 2000000, authorFile);
    answer({ stdout: cliResult({ title: 'כותרת' }) });
    const reply = await createOpusCausalTransport(policy)(wire, dispatch, new AbortController().signal);
    expect(reply.output).toEqual({ title: 'כותרת' });
    expect([cli.spawned[0].args, cli.spawned[0].stdin]).toEqual([wire.args, dispatch.input]);
    answer({ stdout: cliResult({ title: 'x' }), code: 1 });
    await expect(createOpusCausalTransport(policy)(wire, dispatch, new AbortController().signal)).rejects.toMatchObject({ code: 'cli_termination' });
  });
});
