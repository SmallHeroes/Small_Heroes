import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob, loadEngineOrderSnapshot } from '../personal-jobs';
import { engineRecipeSteps, assertEnginePolicyCurrent, configuredEngineSpendPolicy, type EngineSpendPolicy } from '../platform-policy';
import { parseEngineCheckpoint, runEngineDurableInvocation, ENGINE_CHUNK_BUDGET_MS, ENGINE_LONG_BUDGET_MS, type PreparedEngineCall } from '../durable-worker';
import { inspectEngineOrderMeter } from '../order-meter';
import type { EnginePrivateStorage } from '../private-storage';
import { prepareEngineOrder, resolveEngineWizardOptions } from '../personal-orders';
import { syntheticEngineOrderInput, syntheticEngineQaEnv } from './synthetic-order';
import { readEnginePrivateBytes, loadEnginePrivateAsset } from '../private-assets';
const policy: EngineSpendPolicy = { version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40), maximumMicroUsd: 10_000_000,
  maximumCalls: 200, approvalReference: 'SYNTHETIC_TEST_ONLY', approvedBy: 'synthetic_test', approvedAt: '2026-11-04T00:00:00.000Z',
  paidProviderActivation: 'owner_approved_live_personal_orders' };
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function setup(approvedPolicy = policy) {
  const s = await engineTestDb(); stores.push(s);
  const objects = new Map<string, Buffer>();
  const storage: EnginePrivateStorage = { put: async (key, bytes) => { objects.set(key, bytes); }, read: async key => objects.get(key)!, sign: async () => { throw Error('not_used'); } };
  await startEnginePersonalJob(s.db, 'synthetic_order', approvedPolicy);
  const checkpoint = parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache);
  const execute = vi.fn(async () => ({ kind: 'completed' as const, result: { output: { synthetic: true }, raw: { synthetic: true }, estimatedMicroUsd: 20 } }));
  const plan = (step = 'page_0_0', requiredMs = 60_000): PreparedEngineCall => {
    const wire = { synthetic: true, step };
    return { wire, call: { step, wireSha256: canonicalHash(wire), maximumMicroUsd: engineRecipeSteps().find(s => s.id === step)!.maximumMicroUsd }, requiredMs, execute };
  };
  const invoke = (recipe: Parameters<typeof runEngineDurableInvocation>[2]['recipe'], extra: Partial<Parameters<typeof runEngineDurableInvocation>[2]> = {}) =>
    runEngineDurableInvocation(s.db, 'synthetic_order', { storage, executor: 'chunk', recipe, assertAdmission: async () => {}, ...extra });
  return { ...s, storage, checkpoint, execute, plan, invoke };
}

describe('same GenerationJob + actual meter/SQL fences, synthetic providers only', () => {
  it('refuses an invalid QA database binding before reading the database', async () => {
    const qa = { ...syntheticEngineQaEnv(), DATABASE_URL: 'postgresql://synthetic@other.example.invalid/postgres' };
    for (const [key, value] of Object.entries(qa)) vi.stubEnv(key, value);
    expect(() => configuredEngineSpendPolicy(qa)).toThrow('engine_qa_order_scope_required');
    const db = { $queryRaw: vi.fn() } as unknown as Parameters<typeof loadEngineOrderSnapshot>[0];
    await expect(loadEngineOrderSnapshot(db, 'synthetic_order')).rejects.toThrow('engine_qa_order_scope_required');
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('starts and replays only the bound fictional QA order on the existing durable worker', async () => {
    const s = await engineTestDb();
    stores.push(s);
    for (const [key, value] of Object.entries(syntheticEngineQaEnv())) vi.stubEnv(key, value);
    await expect(startEnginePersonalJob(s.db, 'synthetic_order', policy)).rejects.toThrow('engine_qa_order_scope_required');
    const qa = prepareEngineOrder({ ...syntheticEngineOrderInput('dad_v2'), fictionalQa: true }, s.parent, resolveEngineWizardOptions());
    await s.pg.query('UPDATE "WizardSession" SET "sessionId"=$1,data=$2 WHERE id=$3',
      [qa.sessionId, JSON.stringify({ ...qa.snapshot, inputSha256: qa.inputSha256 }), 'synthetic_session']);
    await s.pg.query('UPDATE "Order" SET data=data || $1::jsonb WHERE id=$2',
      [JSON.stringify({ storySourceHash: qa.inputSha256, selectedVoice: 'dad_v2' }), 'synthetic_order']);
    expect(await startEnginePersonalJob(s.db, 'synthetic_order', policy)).toMatchObject({ started: true, created: true });
    expect(await startEnginePersonalJob(s.db, 'synthetic_order', policy)).toMatchObject({ started: true, created: false });
    vi.unstubAllEnvs();
    await expect(loadEngineOrderSnapshot(s.db, 'synthetic_order')).rejects.toThrow('engine_qa_order_scope_required');
    expect((await s.pg.query('SELECT id FROM "GenerationJob"')).rows).toHaveLength(1);
  });
  it('starts once and preserves the job/authority on payment replay without resetting progress or claims', async () => {
    const s = await setup();
    expect(await startEnginePersonalJob(s.db, 'synthetic_order', policy)).toMatchObject({ started: true, created: false });
    await expect(startEnginePersonalJob(s.db, 'synthetic_order', { ...policy, maximumMicroUsd: 11_000_000 })).rejects.toThrow();
    expect((await s.pg.query('SELECT * FROM "GenerationJob"')).rows).toHaveLength(1);
    const loaded = await loadEngineOrderSnapshot(s.db, 'synthetic_order'); expect(loaded.inputSha256).toBe(s.prepared.inputSha256);
  });
  it('runs one new operation per chunk and replays saved raw bytes without another provider call', async () => {
    const s = await setup();
    const recipe = async (r: any) => { await r.call(s.plan()); await r.call(s.plan('page_1_0')); await r.save('finished', { ok: true }); await r.advance('materialize'); };
    expect(await s.invoke(recipe)).toMatchObject({ kind: 'progress' }); expect(s.execute).toHaveBeenCalledTimes(1);
    expect(await s.invoke(recipe)).toMatchObject({ kind: 'progress', phase: 'materialize' }); expect(s.execute).toHaveBeenCalledTimes(2);
    const state = parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache);
    const resultAsset = await loadEnginePrivateAsset(s.db, state.calls.page_0_0.resultAssetId!);
    expect(JSON.parse((await readEnginePrivateBytes(s.storage, resultAsset)).toString()).result.raw).toEqual({ synthetic: true });
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 2, knownEstimateMicroUsd: 40, blocked: false });
  });
  it('defers780/380/860 second calls before claim and executes under the same authority in the long host', async () => {
    const s = await setup();
    for (const requiredMs of [780_000, 380_000, 860_000]) {
      expect(requiredMs + 45_000).toBeGreaterThan(ENGINE_CHUNK_BUDGET_MS);
      expect(requiredMs + 45_000).toBeLessThan(ENGINE_LONG_BUDGET_MS);
    }
    const recipe = async (r: any) => { await r.call(s.plan('page_0_0', 860_000)); };
    expect(await s.invoke(recipe)).toMatchObject({ kind: 'long_step_required' }); expect(s.execute).not.toHaveBeenCalled();
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 0 });
    expect(await s.invoke(recipe, { executor: 'long' })).toMatchObject({ kind: 'progress' }); expect(s.execute).toHaveBeenCalledTimes(1);
  });
  it('persists a background id and polls the same claim instead of dispatching another POST', async () => {
    const s = await setup(); const calls: (string | undefined)[] = [];
    const plan = s.plan(); plan.execute = vi.fn(async pending => { calls.push(pending); return pending
      ? { kind: 'completed' as const, result: { raw: { id: pending }, output: 'finished', estimatedMicroUsd: 30 } }
      : { kind: 'pending' as const, id: 'resp_synthetic', raw: { status: 'in_progress' } }; });
    expect(await s.invoke(async r => { await r.call(plan); })).toMatchObject({ kind: 'pending' });
    expect(await s.invoke(async r => { expect((await r.call(plan)).output).toBe('finished'); })).toMatchObject({ kind: 'progress' });
    expect(calls).toEqual([undefined, 'resp_synthetic']);
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 1, knownEstimateMicroUsd: 30, blocked: false });
  });
  it('UNKNOWN transport stops with no automatic paid retry', async () => {
    const s = await setup(); s.execute.mockRejectedValueOnce(Error('synthetic_timeout'));
    expect(await s.invoke(async r => { await r.call(s.plan()); })).toMatchObject({ kind: 'held' });
    expect(await s.invoke(async r => { await r.call(s.plan()); })).toMatchObject({ kind: 'busy' });
    expect(s.execute).toHaveBeenCalledTimes(1);
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 1, pendingCalls: 1, blocked: true });
  });
  it('stops before a new call when its full reserve would exceed the approved order cap', async () => {
    const s = await setup({ ...policy, maximumMicroUsd: 2_100_000 });
    s.execute.mockResolvedValue({ kind: 'completed', result: { output: { synthetic: true }, raw: { synthetic: true }, estimatedMicroUsd: 1_000_000 } });
    const recipe = async (r: any) => { await r.call(s.plan()); await r.call(s.plan('page_1_0')); };
    expect(await s.invoke(recipe)).toMatchObject({ kind: 'progress' });
    expect(await s.invoke(recipe)).toMatchObject({ kind: 'held' });
    expect(s.execute).toHaveBeenCalledTimes(1);
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 1, knownEstimateMicroUsd: 1_000_000 });
  });
  it('recovers settled raw output after a crash before the checkpoint pointer without another dispatch', async () => {
    const s = await setup(); await s.invoke(async r => { await r.call(s.plan()); });
    const job = await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } });
    const state = parseEngineCheckpoint(job!.pipelineCache); delete state.calls.page_0_0.resultAssetId; state.calls.page_0_0.settled = false;
    await s.db.generationJob.update({ where: { orderId: 'synthetic_order' }, data: { pipelineCache: { engineSite: state } as any } });
    expect(await s.invoke(async r => { expect((await r.call(s.plan())).output).toEqual({ synthetic: true }); })).toMatchObject({ kind: 'progress' });
    expect(s.execute).toHaveBeenCalledTimes(1);
  });
  it('does not commit through a stolen lease and does not repeat a changed saved request', async () => {
    const s = await setup(); await s.invoke(async r => { await r.call(s.plan()); });
    const changed = s.plan(); changed.wire = { changed: true }; changed.call = { ...changed.call, wireSha256: canonicalHash(changed.wire) };
    expect(await s.invoke(async r => { await r.call(changed); })).toMatchObject({ kind: 'held', code: 'engine_worker_call_changed' });
    expect(s.execute).toHaveBeenCalledTimes(1);
    const other = await setup(); let dispatched = 0; const stolen = other.plan();
    stolen.execute = async (_pending, _signal, guard) => {
      await other.pg.query('UPDATE "GenerationJob" SET "lockedBy"=$1', ['another_worker']);
      await guard(); dispatched += 1;
      return { kind: 'completed', result: { output: null, raw: null, estimatedMicroUsd: 0 } };
    };
    expect(await other.invoke(async r => { await r.call(stolen); })).toMatchObject({ kind: 'held' });
    expect(dispatched).toBe(0);
    expect((await other.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.lockedBy).toBe('another_worker');
  });
  it('a background poll cannot reset the durable operation deadline', async () => {
    const s = await setup(); let time = Date.now(); const plan = s.plan();
    const poll = vi.fn(async () => ({ kind: 'pending' as const, id: 'resp_synthetic', raw: { status: 'in_progress' } })); plan.execute = poll;
    expect(await s.invoke(async r => { await r.call(plan); }, { now: () => time })).toMatchObject({ kind: 'pending' });
    time += 106_000;
    expect(await s.invoke(async r => { await r.call(plan); }, { now: () => time })).toMatchObject({ kind: 'held', code: 'engine_worker_pending_deadline' });
    expect(poll).toHaveBeenCalledTimes(1);
  });
  it('records a late known billed answer after the order was held, without advancing the job', async () => {
    const s = await setup();
    s.execute.mockImplementationOnce(async () => {
      await s.pg.query('UPDATE "Order" SET status=$1,"deliveryHoldReason"=$2 WHERE id=$3', ['needs_human_qa', 'synthetic_hold', 'synthetic_order']);
      return { kind: 'completed', result: { output: { synthetic: true }, raw: { synthetic: true }, estimatedMicroUsd: 20 } };
    });
    expect(await s.invoke(async r => { await r.call(s.plan()); })).toMatchObject({ kind: 'held' });
    expect(await inspectEngineOrderMeter(s.db, s.checkpoint.authority)).toMatchObject({ logicalCalls: 1, knownEstimateMicroUsd: 20, pendingCalls: 0 });
    const job = await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } });
    expect(parseEngineCheckpoint(job!.pipelineCache).calls.page_0_0.resultAssetId).toBeUndefined();
  });
  it('has no default spend policy and binds activation to exact source revision and policy', async () => {
    expect(() => configuredEngineSpendPolicy({})).toThrow('disabled');
    expect(() => configuredEngineSpendPolicy({ ENGINE_SITE_WORKER_ENABLED: 'true', ENGINE_SITE_PROVIDERS_ENABLED: 'true' })).toThrow('policy_required');
    const env = { ENGINE_SITE_WORKER_ENABLED: 'true', ENGINE_SITE_PROVIDERS_ENABLED: 'true', ENGINE_SITE_SPEND_POLICY: JSON.stringify(policy), ENGINE_SITE_SOURCE_REVISION: policy.sourceRevision };
    expect(configuredEngineSpendPolicy(env)).toEqual(policy);
    const s = await setup(); expect(() => assertEnginePolicyCurrent(s.checkpoint.authority, env)).not.toThrow();
    expect(() => assertEnginePolicyCurrent(s.checkpoint.authority, { ...env, ENGINE_SITE_SOURCE_REVISION: 'b'.repeat(40) })).toThrow('revision_mismatch');
  });
});
