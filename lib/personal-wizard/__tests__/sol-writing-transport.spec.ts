import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { SOL_WRITING, prepareSolWritingWire, createSolWritingTransport, solWritingMeterRule } from '../../../scripts/personal-sol-writing-transport';
import { TrialApiMeter, trialApiRules, solContinuationApprovalSchema } from '../../../scripts/personal-book-e2e-trial';
import { replanFixture, providerStoryboard } from './storyboard-replan-fixture';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { decodePersonalBookProviderOutput } from '../book-openai';

const folder = () => mkdtempSync(path.join(tmpdir(), 'sol-writing-test-'));
const textCall = (stage = 'author') => ({ stage, instructions: 'Write a general source, no tools.', input: 'Synthetic input, not a real child.',
  maxOutputTokens: 12000, schema: z.object({ title: z.string() }).strict() }) as any;
const raw = (value: unknown, over: Record<string, unknown> = {}) => ({ id: 'resp_synthetic', object: 'response', model: SOL_WRITING.model,
  status: 'completed', service_tier: 'default', output_text: JSON.stringify(value), usage: { input_tokens: 12, output_tokens: 3 },
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }], ...over });
function transport(answer: unknown) {
  const events = { keys: 0, calls: 0, bodies: [] as any[] };
  const run = createSolWritingTransport({ key: () => { events.keys++; return 'SYNTHETIC-NOT-A-REAL-KEY'; }, fetch: async (_url, init) => {
    events.calls++; events.bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  return { run, events };
}
describe('explicit Sol6.1 writing transport, provider-free SDK boundary', () => {
  it.each(['author', 'editor'])('routes %s through Responses, preserving exact source instructions/schema and cost binding', async stage => {
    const call = textCall(stage), w = prepareSolWritingWire(call), t = transport(raw({ title: 'synthetic' }));
    expect(w).toMatchObject({ model: 'gpt-6.1-sol', route: 'openai_responses', stage, outputCap: 12000 });
    expect(w.payload).toMatchObject({ store: false, service_tier: 'default', reasoning: { effort: 'medium' }, instructions: call.instructions, input: call.input });
    expect(w.payload).not.toHaveProperty('executable'); expect(w.payload).not.toHaveProperty('tools');
    const result = await t.run(w, call, new AbortController().signal);
    expect(result.output).toEqual({ title: 'synthetic' }); expect(result.estimatedMicroUsd).toBe(54);
    expect([t.events.calls, t.events.keys]).toEqual([1, 1]); expect(t.events.bodies[0]).toEqual(w.payload);
    expect(solWritingMeterRule.settle(w, result, true)).toEqual({ estimatedMicroUsd: 54, coherent: true });
  });
  it.each(['review', 'final_review', 'plan', 'replan'])('refuses non-writing/unsupported stage %s before a key or provider', stage => {
    expect(() => prepareSolWritingWire(textCall(stage))).toThrow('wire_contract');
  });
  it('does not accept a changed call, a coherently rebound wire, an aborted signal or an enlarged token/wire cap', async () => {
    const call = textCall(), w = prepareSolWritingWire(call), t = transport(raw({ title: 'x' }));
    await expect(t.run(w, { ...call, input: 'changed' }, new AbortController().signal)).rejects.toThrow('wire_contract');
    const changed = structuredClone(w); changed.payload.input += 'changed'; changed.json = JSON.stringify(changed.payload);
    changed.bytes = Buffer.byteLength(changed.json); changed.digest = createHash('sha256').update(changed.json).digest('hex');
    await expect(t.run(changed, call, new AbortController().signal)).rejects.toThrow();
    const controller = new AbortController(); controller.abort(); await expect(t.run(w, call, controller.signal)).rejects.toThrow();
    expect(() => prepareSolWritingWire({ ...call, maxOutputTokens: 55001 })).toThrow();
    expect(() => prepareSolWritingWire({ ...call, input: 'x'.repeat(104000) })).toThrow('wire_limit');
    expect([t.events.keys, t.events.calls]).toEqual([0, 0]);
  });
  it.each([
    ['wrong model', { model: 'gpt-6-astra' }, null], ['wrong tier', { service_tier: 'priority' }, null],
    ['unknown usage', { usage: null }, null], ['incomplete', { status: 'incomplete' }, 54],
    ['output over cap', { usage: { input_tokens: 12, output_tokens: 12001 } }, 120034],
  ])('retains the one failed %s receipt and never retries', async (_label, over, cost) => {
    const call = textCall(), w = prepareSolWritingWire(call), t = transport(raw({ title: 'x' }, over));
    const error = await t.run(w, call, new AbortController().signal).catch(e => e);
    expect(error.receipt.estimatedMicroUsd).toBe(cost); expect(t.events.calls).toBe(1);
    expect(solWritingMeterRule.settle(w, error.receipt, true).coherent).toBe(false);
  });
  it('retains known usage/cost on malformed structured output without silently changing source', async () => {
    const call = textCall(), w = prepareSolWritingWire(call), t = transport(raw({ another: 'not the schema' }));
    const error = await t.run(w, call, new AbortController().signal).catch(e => e);
    expect(error.receipt.estimatedMicroUsd).toBe(54); expect(t.events.calls).toBe(1);
  });
  it('prices explicit Sol author/editor/planner slots but preserves all legacy refused writer slots', () => {
    for (const name of ['sol_author', 'sol_editor', 'sol_storyboard']) expect(trialApiRules(name)).toBeDefined();
    expect(trialApiRules('sol_storyboard')?.reserve(prepareSolWritingWire(textCall('author')))).toBeNull();
    expect(trialApiRules('sol_author')?.reserve(prepareSolWritingWire(textCall('editor')))).toBeNull();
    for (const name of ['s0_author', 's0_storyboard', 's4_author', 'sol_replan', 'sol2_storyboard']) expect(trialApiRules(name)).toBeUndefined();
    const w = prepareSolWritingWire(textCall()); expect(solWritingMeterRule.reserve(w)).toBeGreaterThanOrEqual(600000);
    expect(solWritingMeterRule.reserve({ ...w, model: 'gpt-6-astra' })).toBeNull();
    expect(solWritingMeterRule.reserve({ ...w, outputCap: 55001 })).toBeNull();
  });
  it('uses the SAME cumulative API meter and refuses an orphan rather than granting a new call', async () => {
    const dir = folder(), meter = new TrialApiMeter(dir, 'sol_'), call = textCall(), w = prepareSolWritingWire(call), t = transport(raw({ title: 'x' }));
    await meter.run('author', w, w.reservedMicroUsd, async () => { const r = await t.run(w, call, new AbortController().signal); return { value: r.output, estimatedMicroUsd: r.estimatedMicroUsd, receipt: r }; });
    expect(meter.snapshot().cumulativeAccountedMicroUsd).toBe(54); expect(meter.snapshot().capMicroUsd).toBe(7000000);
    const resultFile = path.join(dir, 'sol_author.result.json'), r = JSON.parse(readFileSync(resultFile, 'utf8')); r.estimatedMicroUsd = 0; writeFileSync(resultFile, JSON.stringify(r));
    expect(() => meter.snapshot()).toThrow();
    const orphan = new TrialApiMeter(folder(), 'sol_'); await expect(orphan.run('author', w, w.reservedMicroUsd, async () => { throw Error('unknown transport'); })).rejects.toThrow();
    let called = false; await expect(orphan.run('editor', prepareSolWritingWire(textCall('editor')), w.reservedMicroUsd, async () => { called = true; return {} as any; })).rejects.toThrow();
    expect(called).toBe(false);
  });
  it('approval is explicit and cannot add budget/attempts, change version or omit prior probe history', () => {
    const p = { version: 'reader-safe-sol-continuation-approval/v1', ownerFile: 'C:/owner', ownerSha: 'a'.repeat(64), operatorFile: 'C:/operator', operatorSha: 'b'.repeat(64),
      availabilityOutcomes: [{ file: 'C:/first', sha256: 'c'.repeat(64) }, { file: 'C:/second', sha256: 'd'.repeat(64) }] };
    expect(solContinuationApprovalSchema.safeParse(p).success).toBe(true);
    for (const bad of [{ ...p, capMicroUsd: 10000000 }, { ...p, attempts: 3 }, { ...p, availabilityOutcomes: [] }, { ...p, version: 'v2' }]) expect(solContinuationApprovalSchema.safeParse(bad).success).toBe(false);
  });
  let call: SimpleStoryboardDiagnosticCall, draft: any;
  beforeAll(async () => {
    const f = await replanFixture(); draft = providerStoryboard(f.draft);
    await runSimpleStoryboardDiagnostic({ request: f.request, writerResult: f.writerResult, options: f.options, signal: new AbortController().signal,
      actorOwnedAppearance: true, generate: async c => { call ??= c; throw Error('capture only'); } }).catch(() => {});
  });
  it('the actual engine storyboard call retains its own decoder and cap over the new Sol route', async () => {
    const w = prepareSolWritingWire(call), t = transport(raw(draft));
    expect(w.stage).toBe('storyboard'); expect(w.outputCap).toBe(call.maxOutputTokens);
    const r = await t.run(w, call, new AbortController().signal); expect(r.output).toEqual(decodePersonalBookProviderOutput(call, draft));
    expect(t.events.calls).toBe(1); expect(solWritingMeterRule.settle(w, r, true).coherent).toBe(true);
  });
});
