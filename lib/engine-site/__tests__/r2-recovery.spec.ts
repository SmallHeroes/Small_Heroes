import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { canonicalHash } from '@/lib/canonical-json';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { syntheticEngineActivationEnv } from './synthetic-order';
import { parseEngineCheckpoint,runEngineDurableInvocation } from '../durable-worker';
import { recordEngineInfrastructureFault } from '../failure-policy';
import { handleEngineOperator } from '../operator-http';
import { inspectEngineOrderMeter } from '../order-meter';
import { reconcileEngineGeneration } from '../generation-backstop';
import { failEngineOrder } from '../fulfillment';
import { ensureEngineLaunchPolicy,readEngineLaunchPolicy } from '../launch-policy';
import { policyDigest } from '../delivery-gate';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllEnvs();vi.restoreAllMocks();});
async function setup(){
  for(const [k,v] of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
  const s=await engineTestDb();stores.push(s);await startEnginePersonalJob(s.db,'synthetic_order',JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));
  const objects=new Map<string,Buffer>(),storage={put:async(k:string,b:Buffer)=>{objects.set(k,b);},read:async(k:string)=>objects.get(k)!,sign:async()=>''};
  const cp=()=>s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}).then(j=>parseEngineCheckpoint(j!.pipelineCache));
  const invoke=(recipe:any)=>runEngineDurableInvocation(s.db,'synthetic_order',{storage,executor:'chunk',recipe,assertAdmission:async()=>{}});
  const wire={synthetic:true},plan={wire,call:{step:'page_0_0',wireSha256:canonicalHash(wire),maximumMicroUsd:(await cp()).authority.budget.steps.find(x=>x.id==='page_0_0')!.maximumMicroUsd},
    requiredMs:1000,execute:async()=>({kind:'completed' as const,result:{raw:{synthetic:true},output:{synthetic:true},estimatedMicroUsd:20}})};
  const ports={db:s.db,storage:()=>storage,parent:async()=>({id:'synthetic_guy'}),operatorIds:['synthetic_guy'],fulfillmentEnabled:true,
    fulfillment:()=>({storage,origin:'https://app.example.invalid'})};
  const request=(body?:unknown)=>new NextRequest('https://app.example.invalid/api/engine-site/v1/review/synthetic_order',body?{method:'POST',
    headers:{origin:'https://app.example.invalid','content-type':'application/json'},body:JSON.stringify(body)}:undefined);
  const park=async()=>{const now=Date.now();for(const delta of [0,180_000,900_000])await recordEngineInfrastructureFault(s.db,'synthetic_order','fulfillment',Error('synthetic_storage_down'),now+delta);};
  return {...s,cp,invoke,plan,ports,request,park};
}
describe('R2-4/R2-8/R2-10 actual operator, durable progress and backstop paths',()=>{
  it.each(['stale_hold','active_lease','unknown_action','unauthorized_actor'] as const)('M15 infrastructure action refuses %s without changing the hold or meter',async scenario=>{
    const s=await setup();await s.park();
    const view=await (await handleEngineOperator(s.request(),'synthetic_order',s.ports)).json();
    if(scenario==='stale_hold')await s.db.order.update({where:{id:'synthetic_order'},data:{deliveryFenceVersion:{increment:1}}});
    if(scenario==='active_lease')await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{lockedBy:'synthetic_other_worker',leaseExpiresAt:new Date(Date.now()+60_000)}});
    const before=await s.db.atomicOperationReceipt.findMany({where:{orderId:'synthetic_order'}});
    const response=await handleEngineOperator(s.request({action:scenario==='unknown_action'?'retry':'resume',expectedHoldSha256:view.holdSha256,
      idempotencyKey:`m15_${scenario}`,reason:'Synthetic adversarial action'}),'synthetic_order',scenario==='unauthorized_actor'?{...s.ports,operatorIds:[]}:s.ports);
    expect(response.status).toBe(scenario==='unauthorized_actor'?404:409);
    expect(await s.db.atomicOperationReceipt.findMany({where:{orderId:'synthetic_order'}})).toEqual(before);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.deliveryHoldReason).toBe('engine_site_hold:infrastructure');
    expect((await s.db.exceptionCase.findFirst())!.status).toBe('open');
  });
  it('R2-3 the existing global policy writer also enforces the extended private database guard',async()=>{
    const s=await setup();await ensureEngineLaunchPolicy(s.db);const policy=await readEngineLaunchPolicy(s.db);
    await s.pg.exec('GRANT SELECT,INSERT ON "UserSession" TO anon');
    const response=await handleEngineOperator(s.request({mode:'off',expectedPolicySha256:policyDigest(policy),idempotencyKey:'r2_private_policy',reason:'Synthetic'}),null,s.ports);
    expect(response.status).toBe(409);
    const stored=await s.db.wizardSession.findUnique({where:{sessionId:'engine-site-launch-policy/v1/current'}});
    expect((stored!.data as any).policy.mode).toBe('required');
  });
  it('R2-4 an operator-required infrastructure case is not an existing refund liability',async()=>{
    const s=await setup();await s.park();await failEngineOrder(s.db,'synthetic_order','engine_native_book_held');
    expect((await s.db.exceptionCase.findMany()).filter(x=>x.status==='refund_pending')).toHaveLength(1);
  });
  it('R2 P3 a rolled-back hold transaction never grants terminal authority',async()=>{
    const s=await setup(),transaction=s.db.$transaction.bind(s.db);
    const result=await s.invoke(async()=>{
      vi.spyOn(s.db,'$transaction').mockImplementationOnce(((work:any)=>transaction(async tx=>{await work(tx);throw Error('synthetic_commit_rejected');})) as any);
      throw Object.assign(Error('engine_worker_provider_result_unusable'),{code:'engine_worker_provider_result_unusable'});
    });
    expect(result).toMatchObject({kind:'held',terminalWritten:false});
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('generating');
  });
  it('R2-4 opens a visible operator case and permits audited resume without changing meter receipts',async()=>{
    const s=await setup();await s.park();const before=await s.db.atomicOperationReceipt.findMany({where:{orderId:'synthetic_order'}});
    expect((await s.db.exceptionCase.findFirst())!.resolution).toMatchObject({operatorRequired:true});
    const get=await handleEngineOperator(s.request(),'synthetic_order',s.ports);expect(get.status).toBe(200);const view=await get.json();
    expect(view).toMatchObject({kind:'infrastructure',canResume:true});
    const action={action:'resume',expectedHoldSha256:view.holdSha256,idempotencyKey:'synthetic_resume_r2',reason:'Synthetic recovered infrastructure'};
    expect((await handleEngineOperator(s.request(action),'synthetic_order',s.ports)).status).toBe(200);
    expect((await handleEngineOperator(s.request(action),'synthetic_order',s.ports)).status).toBe(200);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('generating');
    const after=await s.db.atomicOperationReceipt.findMany({where:{orderId:'synthetic_order'}});
    for(const old of before)expect(after.find(x=>x.operationKey===old.operationKey)).toEqual(old);
    expect(after.filter(x=>x.kind==='engine_site_infrastructure_action_v1')).toHaveLength(1);
    expect((await s.db.exceptionCase.findFirst())!.status).toBe('resolved');
  });
  it('R2-4 refuses UNKNOWN resume, preserves the reserve, and audited fail creates exactly one liability',async()=>{
    const s=await setup();await s.invoke(async(r:any)=>{await r.call({...s.plan,execute:async()=>{throw Error('synthetic_network_unknown');}});});
    const meter=await inspectEngineOrderMeter(s.db,(await s.cp()).authority);expect(meter.pendingCalls).toBe(1);
    const get=await handleEngineOperator(s.request(),'synthetic_order',s.ports);expect(get.status).toBe(200);const view=await get.json();expect(view.canResume).toBe(false);
    expect((await handleEngineOperator(s.request({action:'resume',expectedHoldSha256:view.holdSha256,idempotencyKey:'unknown_resume',reason:'Synthetic'}),'synthetic_order',s.ports)).status).toBe(409);
    const action={action:'fail',expectedHoldSha256:view.holdSha256,idempotencyKey:'unknown_fail',reason:'Synthetic operator fail'};
    expect((await handleEngineOperator(s.request(action),'synthetic_order',s.ports)).status).toBe(200);
    expect((await handleEngineOperator(s.request(action),'synthetic_order',s.ports)).status).toBe(200);
    expect(await inspectEngineOrderMeter(s.db,(await s.cp()).authority)).toEqual(meter);
    expect((await s.db.exceptionCase.findMany()).filter(x=>x.status==='refund_pending')).toHaveLength(1);
  });
  it.each(['call','step'])('R2-8 successful %s resets consecutive faults before the next free failure',async kind=>{
    const s=await setup(),c=await s.cp();c.recovery={failures:2,nextAt:0};
    await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{pipelineCache:{engineSite:c}}});
    await s.invoke(async(r:any)=>{if(kind==='call')await r.call(s.plan);else await r.advance('native');throw Error('synthetic_later_storage_fault');});
    expect((await s.cp()).recovery?.failures).toBe(1);expect((await s.cp()).phase).not.toBe('operator');
  });
  it.each(['cached_call','same_phase'])('R2-8 replaying %s cannot reset a continuing infrastructure fault',async kind=>{
    const s=await setup();await s.invoke(async(r:any)=>{await r.call(s.plan);});const c=await s.cp();c.recovery={failures:2,nextAt:0};
    await s.db.generationJob.update({where:{orderId:'synthetic_order'},data:{pipelineCache:{engineSite:c}}});
    await s.invoke(async(r:any)=>{if(kind==='cached_call')await r.call(s.plan);else await r.advance(c.phase);throw Error('synthetic_persistent_storage_fault');});
    expect((await s.cp()).recovery?.failures).toBe(3);expect((await s.cp()).phase).toBe('operator');
  });
  it('R2-10 records actual successful call progress and uses inactivity rather than creation age',async()=>{
    const s=await setup();await s.pg.exec(`UPDATE "GenerationJob" SET "createdAt"=now()-interval '5 hours'`);
    await s.invoke(async(r:any)=>{await r.call(s.plan);});
    expect((await reconcileEngineGeneration(s.db,'synthetic_order')).status).toBe('dispatch');
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('generating');
  });
  it('R2-10 fresh progress cannot extend execution beyond the documented 24 hour upper bound',async()=>{
    const s=await setup();await s.invoke(async(r:any)=>{await r.call(s.plan);});
    await s.pg.exec(`UPDATE "GenerationJob" SET "createdAt"=now()-interval '25 hours'`);
    expect((await reconcileEngineGeneration(s.db,'synthetic_order')).status).toBe('failed');
    expect((await s.db.exceptionCase.findFirst())!.scope).toBe('engine_site_book');
  });
});
