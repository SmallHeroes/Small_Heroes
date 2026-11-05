import {afterEach,describe,expect,it,vi} from 'vitest';
import {engineTestDb} from './engine-test-db';
import {syntheticEngineActivationEnv} from './synthetic-order';
import {startEnginePersonalJob} from '../personal-jobs';
import {parseEngineCheckpoint} from '../durable-worker';
import {recordEngineInfrastructureFault} from '../failure-policy';
import {readEngineInfrastructureReview,decideEngineInfrastructure} from '../infrastructure-review';
import {reconcileEngineGeneration} from '../generation-backstop';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllEnvs();vi.restoreAllMocks();});
async function setup(hours=6){
 for(const [k,v]of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
 const s=await engineTestDb();stores.push(s);await startEnginePersonalJob(s.db,'synthetic_order',JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));
 const cp=parseEngineCheckpoint((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.pipelineCache);cp.progressAt=Date.now()-5*60*60_000;
 await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{createdAt:new Date(Date.now()-hours*60*60_000),pipelineCache:{engineSite:cp}}});
 return s;
}
async function park(s:Awaited<ReturnType<typeof setup>>){for(const delta of [-900_000,-720_000,0])await recordEngineInfrastructureFault(s.db,'synthetic_order','fulfillment',Error('synthetic_offline_fault'),Date.now()+delta);}
describe('R3-5/R3-6 real resume/backstop and money preservation',()=>{
 it('resumes a five-hour hold with fresh inactivity progress, same absolute bound and unchanged paid receipts',async()=>{
  const s=await setup();await park(s);const view=await readEngineInfrastructureReview(s.db,'synthetic_order');expect(view?.canResume).toBe(true);
  const before=await s.db.atomicOperationReceipt.findMany(),at=Date.now();
  await decideEngineInfrastructure(s.db,'synthetic_order',{action:'resume',expectedHoldSha256:view!.holdSha256,idempotencyKey:'r3_resume',reason:'Synthetic fixed infrastructure'},'synthetic_guy');
  const cp=parseEngineCheckpoint((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.pipelineCache);expect(cp.progressAt).toBeGreaterThanOrEqual(at);
  expect((await reconcileEngineGeneration(s.db,'synthetic_order')).status).toBe('dispatch');
  expect(await s.db.refundAttempt.findMany()).toHaveLength(0);
  const after=await s.db.atomicOperationReceipt.findMany();for(const receipt of before)expect(after.find(x=>x.operationKey===receipt.operationKey)).toEqual(receipt);
 });
 it('visibly refuses resume after the absolute24h bound without refunding or resetting a meter',async()=>{
  const s=await setup(25);await park(s);const view=await readEngineInfrastructureReview(s.db,'synthetic_order');
  expect(view).toMatchObject({canResume:false,resumeBlockedReason:'engine_operator_absolute_deadline'});
  await expect(decideEngineInfrastructure(s.db,'synthetic_order',{action:'resume',expectedHoldSha256:view!.holdSha256,idempotencyKey:'r3_expired',reason:'Synthetic'},'synthetic_guy')).rejects.toThrow('engine_operator_absolute_deadline');
  expect(await s.db.refundAttempt.findMany()).toHaveLength(0);
 });
 it('an invalid web executor cannot refund even a deadline-expired in-flight order',async()=>{
  const s=await setup(25),before=await s.db.order.findUnique({where:{id:'synthetic_order'}});vi.stubEnv('ENGINE_SITE_SOURCE_REVISION','f'.repeat(40));
  expect((await reconcileEngineGeneration(s.db,'synthetic_order')).status).toBe('executor_unavailable');
  expect(await s.db.order.findUnique({where:{id:'synthetic_order'}})).toEqual(before);expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
 });
});
