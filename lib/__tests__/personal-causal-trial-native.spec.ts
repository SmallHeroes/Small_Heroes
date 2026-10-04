import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { createOpusCausalTransport, prepareCausalWire, wireReservation, CAUSAL_MODELS, type WirePolicy, CausalTransportError } from '../../scripts/personal-causal-trial-adapters';
import { exclusiveText } from '../../scripts/personal-causal-trial-journal';
import { causalTrialCohort } from '../../scripts/personal-causal-cohort';
import { preparePersonalStory } from '../personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';
import { causalPlanSchema, compileCausalPlan, CAUSAL_EXPERIMENT_VERSION, BACKWARD_DEPENDENCIES } from '../personal-wizard/story-causal-experiment';
import { fixtureAdventureSelection } from '../personal-wizard/__tests__/story-planning-fixture';
import type { CausalDispatch } from '../personal-wizard/story-causal-experiment-runner';
vi.mock('node:child_process', async original => ({ ...await original<typeof import('node:child_process')>(), spawn: vi.fn() }));
vi.mock('openai/helpers/zod', async original => {
  const actual = await original<typeof import('openai/helpers/zod')>();
  return { ...actual, zodTextFormat: vi.fn(actual.zodTextFormat) };
});
const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { vi.mocked(spawn).mockReset(); });
function setup(overrides: Partial<CausalDispatch> = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'causal-native-test-')); dirs.push(root);
  const exe = path.join(root, 'synthetic-not-executable.exe'), instructions = path.join(root, 'instructions.txt');
  writeFileSync(exe, 'SYNTHETIC NON EXECUTABLE'); exclusiveText(instructions, 'Exact instructions\n');
  const policy: WirePolicy = { workspace: root, executable: exe, executableSha256: createHash('sha256').update(readFileSync(exe)).digest('hex'),
    maxWireBytes: 104_000, rates: { opus: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 }, astra: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 1 } } };
  const call: CausalDispatch = { role: 'opus', stage: 'author', input: 'EXACT USER INPUT', instructions: 'Exact instructions\n',
    conversationKey: 'synthetic:case1:author', maxOutputTokens: 8000, schema: z.object({ value: z.string() }).strict(), ...overrides };
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

function planning(index: number, rejected = false) {
  const prepared = preparePersonalStory(causalTrialCohort()[index].request, resolvePersonalWizardOptions()), brief = prepared.brief;
  const interest = brief.facts.find(f => f.kind === 'interest')!.id;
  const selection = fixtureAdventureSelection(brief.beats, interest);
  const common = { version: CAUSAL_EXPERIMENT_VERSION, requestId: brief.requestId };
  const raw = rejected ? { ...common, disposition: 'both_rejected', candidates: selection.candidates, contrast: selection.contrast,
    reason: 'Both synthetic ideas lack a compelling child-led discovery.' } : {
    ...common, disposition: 'selected', selection,
    synopsis: 'Synthetic continuous adventure with discovery, consequential partnership and an earned payoff. Not literary evidence.',
    backwardDependencies: Object.fromEntries(BACKWARD_DEPENDENCIES.map(key => [key, { claim: 'Synthetic causal claim, not entailment proof.',
      evidence: [{ pageNumber: key === 'earnedPayoff' ? brief.beats : 1, field: 'childAction', quote: 'מציעה דרך אחרת' }] }])),
    plan: { title: 'ההרפתקה החדשה', childGoal: 'למצוא דרך מעניינת', companionWant: 'לנסות וגם לעזור', comicPromise: 'הרעיון מסתבך באופן מצחיק',
      resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החבר מקשיב' }] },
      beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'הגילוי משנה את הדרך', childAction: 'מציעה דרך אחרת',
        companionAction: 'מקשיב ומנסה', consequence: 'מגלים משהו חדש', factIds: [interest], continuity: 'החפץ בידי הילדה' })), ending: 'מוצאים יחד דרך חדשה' },
  };
  return { prepared, schema: causalPlanSchema(prepared), raw };
}

// Models the two captured root rejections, not the complete provider validator.
function objectRootCli(raw: unknown, literalOutput = false) {
  const fake = fakeChild(null, 0, false); let schema: any;
  vi.mocked(spawn).mockImplementation((_exe, args) => {
    const argv = args as string[]; schema = JSON.parse(argv[argv.indexOf('--json-schema') + 1]);
    return fake.child as unknown as ReturnType<typeof spawn>;
  });
  fake.child.stdin.on('finish', () => queueMicrotask(() => {
    const hasCombinator = ['anyOf', 'oneOf', 'allOf'].some(key => key in schema);
    const accepted = schema?.type === 'object' && !hasCombinator;
    fake.child.stdout.write(JSON.stringify(accepted ? { ...successful(), structured_output:
      !literalOutput && schema.properties?.result ? { result: raw } : raw } : {
      subtype: 'success', is_error: true, total_cost_usd: 0, modelUsage: {},
      result: schema?.type !== 'object' ? 'API Error: 400 tools.1.custom.input_schema.type: Field required' :
        'API Error: 400 tools.1.custom.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level',
    }));
    fake.child.emit('close', accepted ? 0 : 1, null);
  }));
}

describe('real planner tool-envelope compatibility, offline CLI model only', () => {
  const lengths = [{ index: 0, spreads: 8 }, { index: 1, spreads: 12 }, { index: 2, spreads: 16 }];
  const stages = ['plan', 'replan'] as const;
  it.each(lengths.flatMap(row => stages.map(stage => ({ ...row, stage }))))('$stage $spreads retains both branches, every reference and byte accounting', ({ index, spreads, stage }) => {
    const f = planning(index), exported = zodTextFormat(f.schema, `causal_${stage}`).schema;
    const baseline = JSON.stringify(exported), h = setup({ stage, schema: f.schema });
    const adapted = JSON.parse(h.wire.args![16]);
    expect(f.prepared.brief.beats).toBe(spreads); expect(exported).not.toHaveProperty('type');
    expect(adapted).toEqual(zodTextFormat(z.object({ result: f.schema }).strict(), `causal_${stage}`).schema);
    expect(adapted.type).toBe('object'); expect(adapted.required).toEqual(['result']); expect(adapted.additionalProperties).toBe(false);
    expect(Object.keys(adapted.properties)).toEqual(['result']);
    for (const key of ['anyOf', 'oneOf', 'allOf']) expect(adapted).not.toHaveProperty(key);
    expect(adapted.properties.result.anyOf.map((branch: any) => branch.properties.disposition.const)).toEqual(['selected', 'both_rejected']);
    const checkRefs = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if ('$ref' in node) {
        expect(node.$ref).toMatch(/^#\//);
        let target: any = adapted;
        for (const key of node.$ref.slice(2).split('/')) target = target?.[key.replace(/~1/g, '/').replace(/~0/g, '~')];
        expect(target).toBeDefined();
      }
      Object.values(node).forEach(checkRefs);
    };
    checkRefs(adapted); expect(JSON.stringify(exported)).toBe(baseline);
    expect(h.wire.json).toBe(JSON.stringify(h.wire.payload));
    expect(h.wire.bytes).toBe(Buffer.byteLength(h.wire.json, 'utf8'));
    expect(h.wire.digest).toBe(createHash('sha256').update(h.wire.json).digest('hex'));
    expect(h.wire.reservedMicroUsd).toBe(wireReservation(h.wire.bytes, h.call.maxOutputTokens, h.policy.rates.opus));
    expect(h.wire.args!.slice(0, 16)).toEqual(setup().wire.args!.slice(0, 14).concat(h.instructions, '--json-schema'));
    expect(spawn).not.toHaveBeenCalled();
  });
  it.each(lengths.flatMap(row => stages.flatMap(stage => [false, true].map(rejected => ({ ...row, stage, rejected })))))('$stage $spreads rejected=$rejected reaches native decoding without changing the disposition', async ({ index, stage, rejected }) => {
    const f = planning(index, rejected), h = setup({ stage, schema: f.schema }); objectRootCli(f.raw);
    const reply = await h.run(h.wire, h.call, new AbortController().signal);
    expect(reply.output).toEqual(f.raw); expect(compileCausalPlan(f.prepared, reply.output).disposition).toBe(rejected ? 'both_rejected' : 'selected');
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('the old wire with addedType=%s reproduces its captured 400 in the offline CLI model', async addedType => {
    const f = planning(0), h = setup({ stage: 'plan', schema: f.schema }), wire = structuredClone(h.wire);
    const exported = zodTextFormat(f.schema, 'causal_plan').schema;
    wire.args![16] = JSON.stringify(addedType ? { ...exported, type: 'object' } : exported);
    wire.payload.args = wire.args; wire.json = JSON.stringify(wire.payload);
    wire.bytes = Buffer.byteLength(wire.json); wire.digest = createHash('sha256').update(wire.json).digest('hex');
    wire.reservedMicroUsd = wireReservation(wire.bytes, wire.outputCap, h.policy.rates.opus);
    objectRootCli(f.raw);
    await expect(h.run(wire, h.call, new AbortController().signal)).rejects.toMatchObject({ code: 'cli_termination',
      receipt: { raw: { stdout: expect.stringContaining(addedType ? 'anyOf at the top level' : 'input_schema.type: Field required') } } });
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each(['disposition', 'request', 'extra', 'missing', 'wrong_branch'])('adaptation cannot admit %s in a returned plan', async kind => {
    const f = planning(0), raw: any = structuredClone(f.raw), h = setup({ stage: 'plan', schema: f.schema });
    if (kind === 'disposition') raw.disposition = 'forced'; if (kind === 'request') raw.requestId = 'wrong_request';
    if (kind === 'extra') raw.unapproved = true; if (kind === 'missing') delete raw.selection;
    if (kind === 'wrong_branch') raw.disposition = 'both_rejected';
    objectRootCli(raw);
    await expect(h.run(h.wire, h.call, new AbortController().signal)).rejects.toMatchObject({ code: 'provider_or_schema' });
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each(['unwrapped', 'missing', 'extra', 'null_result', 'double_wrapped'])('transport envelope rejects %s instead of falling back to domain parsing', async kind => {
    const f = planning(0), h = setup({ stage: 'plan', schema: f.schema });
    const outputs: Record<string, unknown> = { unwrapped: f.raw, missing: {}, extra: { result: f.raw, extra: true },
      null_result: { result: null }, double_wrapped: { result: { result: f.raw } } };
    objectRootCli(outputs[kind], true);
    await expect(h.run(h.wire, h.call, new AbortController().signal)).rejects.toMatchObject({ code: 'provider_or_schema' });
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each([
    { name: 'typed union', literal: { type: 'object', anyOf: [{ type: 'object' }] } },
    { name: 'typed scalar union', literal: { type: 'string', anyOf: [{ type: 'object' }] } },
    { name: 'empty anyOf', literal: { anyOf: [] } },
    { name: 'ref-only branch', literal: { anyOf: [{ $ref: '#/definitions/object' }] } },
    { name: 'missing branch type', literal: { anyOf: [{ properties: {} }] } },
    { name: 'null branch', literal: { anyOf: [null] } },
    { name: 'typed oneOf', literal: { type: 'object', oneOf: [{ type: 'object' }] } },
    { name: 'typed allOf', literal: { type: 'object', allOf: [{ type: 'object' }] } },
    { name: 'anyOf with oneOf', literal: { anyOf: [{ type: 'object' }], oneOf: [{ type: 'object' }] } },
    { name: 'anyOf with allOf', literal: { anyOf: [{ type: 'object' }], allOf: [{ type: 'object' }] } },
  ])('literal exporter $name fails closed before spawn', ({ literal }) => {
    vi.mocked(zodTextFormat).mockReturnValueOnce({ schema: literal } as unknown as ReturnType<typeof zodTextFormat>);
    expect(() => setup()).toThrow('causal_host_cli_schema'); expect(spawn).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'scalar', schema: z.string() }, { name: 'array', schema: z.array(z.string()) },
    { name: 'mixed union', schema: z.union([z.object({ value: z.string() }).strict(), z.string()]) },
    { name: 'scalar union', schema: z.union([z.string(), z.number()]) },
    { name: 'unconstrained any', schema: z.any() }, { name: 'unknown', schema: z.unknown() }, { name: 'never', schema: z.never() },
  ])('unsupported $name is rejected before process invocation', ({ schema }) => {
    expect(() => setup({ stage: 'plan', schema })).toThrow('causal_host_cli_schema'); expect(spawn).not.toHaveBeenCalled();
  });
  it('existing object and nested-union schemas retain byte-identical CLI exports; Astra stays unchanged', () => {
    const schema = z.object({ value: z.union([z.string(), z.number()]) }).strict(), h = setup({ schema });
    expect(h.wire.args![16]).toBe(JSON.stringify(zodTextFormat(schema, 'causal_author').schema));
    const call = { ...h.call, stage: 'final_review' as const, role: 'astra' as const };
    const wire = prepareCausalWire(call, h.policy, 1_000_000);
    expect(wire.payload).toEqual({ model: CAUSAL_MODELS.astra, store: false, service_tier: 'default', reasoning: { effort: 'medium' },
      instructions: call.instructions, input: call.input, max_output_tokens: call.maxOutputTokens,
      text: { format: zodTextFormat(schema, 'causal_final_review') } });
    expect(spawn).not.toHaveBeenCalled();
  });
  it('object-union envelope is Opus-only; even an Astra union export remains unmodified', () => {
    const f = planning(0), h = setup(), call: CausalDispatch = { ...h.call, role: 'astra', stage: 'final_review', schema: f.schema };
    const wire = prepareCausalWire(call, h.policy, 1_000_000);
    expect(wire.payload.text).toEqual({ format: zodTextFormat(f.schema, 'causal_final_review') });
    expect((wire.payload.text as any).format.schema).not.toHaveProperty('type');
    expect(spawn).not.toHaveBeenCalled();
  });
  it('an ordinary object whose domain field is named result is never unwrapped', async () => {
    const schema = z.object({ result: z.string() }).strict(), h = setup({ schema });
    expect(h.wire.args![16]).toBe(JSON.stringify(zodTextFormat(schema, 'causal_author').schema));
    fakeChild({ ...successful(), structured_output: { result: 'domain value' } });
    expect((await h.run(h.wire, h.call, new AbortController().signal)).output).toEqual({ result: 'domain value' });
  });
});

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
  it.each(['plan', 'replan', 'author', 'editor'] as const)('%s accepts valid cumulative usage above the configured per-request cap without changing that cap', async stage => {
    const h = setup({ stage }), raw = successful(); raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = 22_785;
    fakeChild(raw);
    const reply = await h.run(h.wire, h.call, new AbortController().signal);
    expect(reply.output).toEqual({ value: 'ok' });
    expect(reply.usage).toEqual({ inputTokens: 4, outputTokens: 22_785 });
    expect(reply.estimatedMicroUsd).toBe(10_000);
    expect(reply.metadata).toMatchObject({ usageScope: 'cli_cumulative', tokenCapScope: 'configured_per_request_not_cli_aggregate' });
    expect(JSON.parse((reply.raw as any).stdout)).toEqual(raw);
    expect((vi.mocked(spawn).mock.calls[0][2] as any).env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('8000');
    expect(h.wire.args![12]).toBe('1'); expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each(['model', 'extra_model', 'cost', 'usage', 'incomplete', 'schema', 'exit'])('%s remains a failed measured attempt, without fallback', async kind => {
    const h = setup(), raw: any = successful();
    if (kind === 'model') raw.modelUsage = { unknown: { inputTokens: 1, outputTokens: 1 } };
    if (kind === 'extra_model') raw.modelUsage.unknown = { inputTokens: 1, outputTokens: 1 };
    if (kind === 'cost') raw.total_cost_usd = null; if (kind === 'usage') raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = -1;
    if (kind === 'incomplete') raw.subtype = 'error_max_turns'; if (kind === 'schema') raw.structured_output = {};
    fakeChild(raw, kind === 'exit' ? 2 : 0);
    await expect(h.run(h.wire, h.call, new AbortController().signal)).rejects.toBeInstanceOf(CausalTransportError);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each([null, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5'])('invalid cumulative token count %s still fails closed with a receipt', async tokens => {
    const h = setup(), raw: any = successful(); raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = tokens; fakeChild(raw);
    const error = await h.run(h.wire, h.call, new AbortController().signal).then(() => null, e => e);
    expect(error).toBeInstanceOf(CausalTransportError); expect(error.code).toBe('usage');
    expect(error.receipt.usage).toBeNull(); expect(error.receipt.estimatedMicroUsd).toBe(10_000);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it.each([null, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER, '0.01'])('invalid cost %s is not excused by valid above-cap usage', async cost => {
    const h = setup(), raw: any = successful(); raw.total_cost_usd = cost;
    raw.modelUsage[CAUSAL_MODELS.opus].outputTokens = 22_785; fakeChild(raw);
    const error = await h.run(h.wire, h.call, new AbortController().signal).then(() => null, e => e);
    expect(error).toBeInstanceOf(CausalTransportError); expect(error.code).toBe('usage');
    expect(error.receipt.estimatedMicroUsd).toBeNull(); expect(error.receipt.usage.outputTokens).toBe(22_785);
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
