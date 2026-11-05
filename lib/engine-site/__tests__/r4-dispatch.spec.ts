import {afterEach,describe,expect,it,vi} from 'vitest';
const holder=vi.hoisted(()=>({db:null as any}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({}, {get:(_,key)=>holder.db[key]})}));
import {r4TestDb as engineTestDb} from './r4-test-db';
import {syntheticEngineActivationEnv} from './synthetic-order';
import {startEnginePersonalJob} from '../personal-jobs';
import {sweepStaleGenerationJobs} from '@/lib/generation-chunked/sweeper';
import {chainGenerationWorker} from '@/lib/generation-chunked/chain-worker';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function setup(){for(const [k,v]of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
 vi.stubEnv('VERCEL_URL','deployment-123.example.invalid');vi.stubEnv('NODE_ENV','test');vi.stubEnv('GENERATION_SECRET','SYNTHETIC_SECRET');
 const s=await engineTestDb();stores.push(s);holder.db=s.db;await startEnginePersonalJob(s.db,'synthetic_order',JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));return s;}
describe('R4 real sweeper and dispatch configuration boundary',()=>{
 it('dispatches to the stable gate host even when VERCEL_URL changes',async()=>{
  const s=await setup();for(const[k,v]of Object.entries({ENGINE_SITE_STAGING_ACCESS_ENABLED:'true',ENGINE_SITE_ENVIRONMENT:'staging',ENGINE_SITE_STAGING_HOST:'stable.example.invalid',ENGINE_SITE_STAGING_USER:'synthetic',ENGINE_SITE_STAGING_PASSWORD:'SYNTHETIC_LONG_PASSWORD_123'}))vi.stubEnv(k,v);
  const recoveryId='engine-site-recovery/v1/synthetic_order/dispatch';await s.db.wizardSession.create({data:{sessionId:recoveryId,data:{attempts:2,nextAt:0}}});
  const send=vi.fn(async(_url:string,_options?:RequestInit)=>new Response('{}'));vi.stubGlobal('fetch',send);chainGenerationWorker('synthetic_order');
  await vi.waitFor(()=>expect(send).toHaveBeenCalledOnce());expect(send.mock.calls[0][0]).toBe('https://stable.example.invalid/api/generate/worker');
  await vi.waitFor(async()=>expect((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.lastChainStatus).toBe(200));
  await vi.waitFor(async()=>expect((await s.db.wizardSession.findUnique({where:{sessionId:recoveryId}}))!.data).toMatchObject({attempts:0,nextAt:0}));
 });
 it.each([0,25])('repeated actual sweeps with missing dispatch secret leave order, checkpoint and fault counters untouched (age %s hours)',async hours=>{
  const s=await setup();vi.stubEnv('GENERATION_SECRET','');if(hours)await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{createdAt:new Date(Date.now()-hours*3600000)}});
  const before=await s.db.order.findUnique({where:{id:'synthetic_order'}}),job=await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}});
  for(let i=0;i<3;i++)await sweepStaleGenerationJobs(1,{orderId:'synthetic_order'});
  await new Promise(r=>setTimeout(r,50));expect(await s.db.order.findUnique({where:{id:'synthetic_order'}})).toEqual(before);
  expect(await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}})).toEqual(job);
  expect(await s.db.wizardSession.findMany({where:{sessionId:{startsWith:'engine-site-recovery/v1/synthetic_order/dispatch'}}})).toHaveLength(0);
 });
});
