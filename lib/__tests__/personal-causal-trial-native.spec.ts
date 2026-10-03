import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { createOpusCausalTransport, prepareCausalWire, CAUSAL_MODELS, type WirePolicy, CausalTransportError } from '../../scripts/personal-causal-trial-adapters';
import { exclusiveText } from '../../scripts/personal-causal-trial-journal';
import type { CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
vi.mock('node:child_process', async original => ({ ...await original<typeof import('node:child_process')>(), spawn: vi.fn() }));
const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { vi.mocked(spawn).mockReset(); });
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'causal-native-test-')); dirs.push(root);
  const exe = path.join(root, 'synthetic-not-executable.exe'), instructions = path.join(root, 'instructions.txt');
  writeFileSync(exe, 'SYNTHETIC NON EXECUTABLE'); exclusiveText(instructions, 'Exact instructions\n');
  const policy: WirePolicy = { workspace: root, executable: exe, executableSha256: createHash('sha256').update(readFileSync(exe)).digest('hex'),
    maxWireBytes: 104_000, rates: { opus: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 }, astra: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 } } };
  const call: CausalDispatch = { role: 'opus', stage: 'author', input: 'EXACT USER INPUT', instructions: 'Exact instructions\n',
    conversationKey: 'synthetic:case1:author', maxOutputTokens: 8000, schema: z.object({ value: z.string() }).strict() };
  const wire = prepareCausalWire(call, policy, 1_000_000, instructions);
  return { root, exe, instructions, policy, call, wire, run: createOpusCausalTransport(policy) };
}
function fakeChild(response: unknown, code: number | null = 0, autoClose = true) {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: vi.fn(() => true) });
  let stdin = '';
  child.stdin.on('data', b => { stdin += b.toString(); });
  child.stdin.on('finish', () => { if (autoClose) queueMicrotask(() => { child.stdout.write(JSON.stringify(response)); child.emit('close', code, null); }); });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  return { child, stdin: () => stdin };
}
const successful = () => ({ subtype: 'success', is_error: false, structured_output: { value: 'ok' }, total_cost_usd: 0.01, num_turns: 2,
  modelUsage: { [CAUSAL_MODELS.opus]: { inputTokens: 4, outputTokens: 5 } } });

describe('pinned native transport with a fake process, never Claude invocation', () => {
  it('actual spawn reads exact UTF8 file/stdin/schema, fresh flags and child-only token override', async () => {
    const h = setup(), child = fakeChild(successful()); vi.stubEnv('ANTHROPIC_API_KEY', 'MUST_NOT_BE_FORWARDED');
    vi.stubEnv('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '999');
    const reply = await h.run(h.wire, h.call, new AbortController().signal);
    expect(reply.output).toEqual({ value: 'ok' }); expect(reply.estimatedMicroUsd).toBe(10_000);
    expect(child.stdin()).toBe(h.call.input); expect(spawn).toHaveBeenCalledTimes(1);
    const [exe, args, options] = vi.mocked(spawn).mock.calls[0] as unknown as [string, string[], { env: Record<string, string>; windowsHide: boolean }];
    expect(exe).toBe(h.exe); expect(options.windowsHide).toBe(true);
    expect(args.slice(0, 13)).toEqual(['-p', '--safe-mode', '--model', CAUSAL_MODELS.opus, '--effort', 'medium', '--tools', '',
      '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '1']);
    expect(args[13]).toBe('--system-prompt-file'); expect(args[14]).toBe(h.instructions); expect(args[15]).toBe('--json-schema');
    expect(args).toHaveLength(17);
    expect(options.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('8000'); expect(options.env).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('999');
    expect(readFileSync(args[args.indexOf('--system-prompt-file') + 1], 'utf8')).toBe(h.call.instructions);
    expect(args).not.toContain('--system-prompt'); expect(JSON.parse(args[args.indexOf('--json-schema') + 1]).additionalProperties).toBe(false);
    expect(reply.metadata.invoiceCapGuaranteed).toBe(false);
  });
  it.each(['model', 'extra_model', 'cost', 'usage', 'over_tokens', 'incomplete', 'schema', 'exit'])('%s remains a failed measured attempt, without fallback', async kind => {
    const h = setup(), raw: any = successful();
    if (kind === 'model') raw.modelUsage = { unknown: { inputTokens: 1, outputTokens: 1 } };
    if (kind === 'extra_model') raw.modelUsage.unknown = { inputTokens: 1, outputTokens: 1 };
    if (kind === 'cost') raw.total_cost_usd = null; if (kind === 'usage') raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = -1;
    if (kind === 'over_tokens') raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = 8001;
    if (kind === 'incomplete') raw.subtype = 'error_max_turns'; if (kind === 'schema') raw.structured_output = {};
    fakeChild(raw, kind === 'exit' ? 2 : 0);
    await expect(h.run(h.wire, h.call, new AbortController().signal)).rejects.toBeInstanceOf(CausalTransportError);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it('changed instructions or binary is refused before spawn', async () => {
    for (const kind of ['instructions', 'binary']) {
      const h = setup(); writeFileSync(kind === 'instructions' ? h.instructions : h.exe, 'CHANGED');
      await expect(h.run(h.wire, h.call, new AbortController().signal)).rejects.toThrow('causal_host_');
      expect(spawn).not.toHaveBeenCalled();
    }
  });
  it('abort before spawn does not invoke a process', async () => {
    const h = setup(), controller = new AbortController(); controller.abort();
    await expect(h.run(h.wire, h.call, controller.signal)).rejects.toThrow('wire_contract'); expect(spawn).not.toHaveBeenCalled();
  });
  it('abort after stdin kills once and observes close without admitting a late success', async () => {
    const h = setup(), fake = fakeChild(successful(), 0, false), controller = new AbortController();
    const promise = h.run(h.wire, h.call, controller.signal); const rejected = expect(promise).rejects.toThrow('cli_termination');
    controller.abort(); fake.child.stdout.write(JSON.stringify(successful())); fake.child.emit('close', 0, null);
    await rejected; expect(fake.child.kill).toHaveBeenCalledTimes(1);
  });
  it('unknown termination after failed kill is terminal; bounded wait does not prove kill success', async () => {
    vi.useFakeTimers(); const h = setup(), fake = fakeChild(null, null, false);
    fake.child.kill.mockImplementation(() => { throw Error('PRIVATE_KILL_ERROR'); });
    const promise = h.run(h.wire, h.call, new AbortController().signal); const rejected = expect(promise).rejects.toThrow('provider_or_schema');
    await vi.advanceTimersByTimeAsync(390_000); await rejected; expect(fake.child.kill).toHaveBeenCalledTimes(1);
  });
  it('oversized output stops the process before admitting JSON', async () => {
    const h = setup(), fake = fakeChild(null, null, false), promise = h.run(h.wire, h.call, new AbortController().signal);
    const rejected = expect(promise).rejects.toThrow('provider_or_schema');
    fake.child.stdout.write('x'.repeat(2_000_001)); fake.child.emit('close', 0, null); await rejected;
    expect(fake.child.kill).toHaveBeenCalledTimes(1);
  });
});
