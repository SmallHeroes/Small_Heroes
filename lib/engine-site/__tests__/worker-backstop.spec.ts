import { afterEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ db: {} as any, run: vi.fn(), chain: vi.fn(), revision: 'a'.repeat(40) }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t,k) => m.db[k] }) }));
vi.mock('@/lib/engine-site/production-worker', () => ({ runProductionPersonalWorker: m.run }));
vi.mock('node:child_process', () => ({ execFileSync: (_cmd: string,args: string[]) => args[0] === 'rev-parse' ? m.revision : '' }));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({ chainGenerationWorker: m.chain,engineDispatchConfigurationAvailable:()=>true }));
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({ assertProdGenerationAllowed() {}, assertEnvSeparation() {} }));
vi.mock('@/lib/env', () => ({ env: {}, validateEnv() {} }));
vi.mock('@/lib/child-photo-deletion', () => ({ tryDeleteOriginalChildPhotoAfterGeneration: vi.fn() }));
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { syntheticEngineActivationEnv } from './synthetic-order';
import { sweepStaleGenerationJobs } from '@/lib/generation-chunked/sweeper';
import { engineLongWorkerMain } from '@/scripts/engine-site-long-worker';
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
async function setup() {
  for (const [k,v] of Object.entries(syntheticEngineActivationEnv())) vi.stubEnv(k,v);
  const s = await engineTestDb(); stores.push(s); m.db = s.db;
  await s.pg.exec(`ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now();
    ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz DEFAULT now();
    ALTER TABLE "GenerationJob" ADD COLUMN "staleReclaimCount" int DEFAULT 0;
    ALTER TABLE "GenerationJob" ADD COLUMN "lastReclaimStage" text;
    ALTER TABLE "GenerationJob" ADD COLUMN "completedPageNumbers" jsonb;
    ALTER TABLE "GenerationJob" ADD COLUMN "lastWorkerKickAt" timestamptz;
    ALTER TABLE "GenerationJob" ADD COLUMN "lastChainStatus" int;
    ALTER TABLE "GenerationJob" ADD COLUMN "lastChainError" text;`);
  await startEnginePersonalJob(s.db, 'synthetic_order', JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));
  const read = s.db.generationJob.findMany.bind(s.db.generationJob);
  vi.spyOn(s.db.generationJob, 'findMany').mockImplementation((async (a: any) => (await read(a)).map(j => ({ ...j, order: {
    frozenProductVersion: 'engine-site/v1', selectionFilename: null, visualPackageAuthority: null, status: 'generating', deliveryHoldReason: null, manualReviewRequired: false } })) as any) as any);
  return s;
}
describe('Q8 real sweep and long-host loop, synthetic database/transports', () => {
  it('R2-9 an older long host skips a newer authorized order before invoking its backstop',async()=>{
    for(const [k,v] of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
    const s=await engineTestDb();stores.push(s);m.db=s.db;
    const newer={...JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!),sourceRevision:'b'.repeat(40)};
    await startEnginePersonalJob(s.db,'synthetic_order',newer);
    await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{currentStage:'engine_site_long'}});
    await engineLongWorkerMain(true);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('generating');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);expect(m.run).not.toHaveBeenCalled();
  });
  it('a long-stage job has a deadline backstop in the sweeper, with engine readiness and exactly one liability', async () => {
    const s = await setup(); await s.pg.exec(`UPDATE "GenerationJob" SET "currentStage"='engine_site_long', "createdAt"=now()-interval '1 day'`);
    await sweepStaleGenerationJobs();
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('failed');
    expect((await s.db.exceptionCase.findFirst())!.scope).toBe('engine_site_book'); expect(m.chain).not.toHaveBeenCalled();
  });
  it('a short-stage job never takes the legacy reclaim-count terminal path', async () => {
    const s = await setup(); await s.pg.exec(`UPDATE "GenerationJob" SET "staleReclaimCount"=100, "lastReclaimStage"='engine_site_story:0'`);
    await sweepStaleGenerationJobs();
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))!.status).toBe('generating');
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0); expect(m.chain).toHaveBeenCalledTimes(1);
  });
  it('one pre-claim job error cannot crash the long-worker loop', async () => {
    const s = await setup(); await s.db.generationJob.update({ where: { orderId: 'synthetic_order' }, data: { currentStage: 'engine_site_long' } });
    m.run.mockRejectedValueOnce(Error('synthetic_storage_outage'));
    await expect(engineLongWorkerMain(true)).resolves.toBeUndefined();
    expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
});
