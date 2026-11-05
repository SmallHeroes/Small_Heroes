import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ storage: {} as any, recipe: (async () => {}) as any }));
vi.mock('@/lib/engine-site/private-storage', async original => ({ ...await original<any>(), productionEnginePrivateStorage: () => m.storage }));
// Replace the paid recipe only. Production wrapper, durable ownership/SQL and failure/refund paths remain real.
vi.mock('@/lib/engine-site/native-recipe', () => ({ createEngineNativeRecipe: () => m.recipe }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get() { throw Error('external_database_forbidden'); } }) }));
vi.mock('@/lib/env', () => ({ env: {} }));
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { runProductionPersonalWorker } from '../production-worker';
import { syntheticEngineActivationEnv } from './synthetic-order';
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
beforeEach(() => { for (const [k,v] of Object.entries(syntheticEngineActivationEnv())) vi.stubEnv(k,v); });
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function setup() {
  const s = await engineTestDb(); stores.push(s);
  const policy = JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!);
  await startEnginePersonalJob(s.db, 'synthetic_order', policy);
  const objects = new Map<string, Buffer>(); m.storage = { put: async (k: string,b: Buffer) => { objects.set(k,b); }, read: async (k: string) => objects.get(k)!, sign: async () => '' };
  m.recipe = async () => {}; return s;
}
describe('Q4/Q8 actual production wrapper + durable SQL fences', () => {
  it('Q4 one failed heartbeat write aborts ownership without failing or refunding the book',async()=>{
    const s=await setup();let beat:()=>void=()=>{throw Error('missing_heartbeat');};
    vi.spyOn(globalThis,'setInterval').mockImplementation(((fn:()=>void)=>{beat=fn;return {} as any;}) as any);
    m.recipe=async(r:any)=>{
      vi.spyOn(s.db,'$transaction').mockRejectedValueOnce(Error('synthetic_heartbeat_write_failed'));
      beat();await new Promise(resolve=>setImmediate(resolve));await r.load('anything');
    };
    await runProductionPersonalWorker(s.db,'synthetic_order');
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('generating');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
  it('Q4 a sweep-kicked worker cannot fail/refund an order parked at launch review', async () => {
    const s = await setup(); await s.db.order.update({ where: { id: 'synthetic_order' }, data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: 'engine_site_hold:operator_review' } });
    await s.db.generationJob.update({ where: { orderId: 'synthetic_order' }, data: { currentStage: 'engine_site_review' } });
    await runProductionPersonalWorker(s.db, 'synthetic_order');
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('needs_human_qa');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
  it('Q4 a worker with a stolen lease cannot create a terminal failure or refund', async () => {
    const s = await setup(); m.recipe = async (r: any) => {
      await s.db.generationJob.update({ where: { orderId: 'synthetic_order' }, data: { lockedBy: 'new_owner' } }); await r.load('anything');
    };
    await runProductionPersonalWorker(s.db, 'synthetic_order');
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('generating');
    expect((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.lockedBy).toBe('new_owner');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
  it('R2-9 a foreign-revision executor skips without failing an order or creating a liability', async () => {
    const s = await setup(), recipe = vi.fn(); m.recipe = recipe;
    const updated = { ...JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!), sourceRevision: 'b'.repeat(40) };
    vi.stubEnv('ENGINE_SITE_SPEND_POLICY', JSON.stringify(updated)); vi.stubEnv('ENGINE_SITE_SOURCE_REVISION', updated.sourceRevision);
    await expect(runProductionPersonalWorker(s.db, 'synthetic_order', 'long')).resolves.toMatchObject({ kind: 'skipped' });
    expect(recipe).not.toHaveBeenCalled(); expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('generating');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
});
