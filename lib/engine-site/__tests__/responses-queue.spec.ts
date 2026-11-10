import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {authority} from './fixtures';
import {canonicalHash} from '@/lib/canonical-json';
import {engineOrderAuthoritySchema} from '../contract';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from '../response-schema';
import {prepareEngineResponse,rebindEnginePendingResponse} from '../provider-plans';
import {ENGINE_RESPONSE_QUEUE_POLICY,responseQueueTiming,responseQueueDeadline} from '../responses-queue-policy';
import {LocalEngineTrialRuntime} from '../local-trial-runtime';
import {runEngineDurableInvocation} from '../durable-worker';

const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const root of roots.splice(0)){if(path.dirname(realpathSync(root))!==realpathSync(tmpdir())||!path.basename(root).startsWith('sh_pending_queue_'))throw Error('owned_temp_only');rmSync(root,{recursive:true,force:true});}});
const raw=(status:string)=>({id:'resp_synthetic_queue',model:'gpt-6.1-sol',service_tier:'default',status,
 ...(status==='completed'?{output_text:'{"ok":true}',usage:{input_tokens:1,output_tokens:1}}:{})});
const body=()=>({model:'gpt-6.1-sol',service_tier:'default',reasoning:{effort:'medium'},instructions:'Synthetic fixture, not real story data.',input:'Synthetic fixture',max_output_tokens:12000,
 text:{format:{type:'json_schema',name:'synthetic',strict:true,schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}}}});
function setup(queued=true,statuses=['queued','queued','in_progress','completed'],pauses=[600000,600000,60000]){
 let now=10000,n=0;const a={...authority(),purpose:'test' as const,responseSchemaPolicy:ENGINE_RESPONSE_SCHEMA_POLICY,...(queued?{responsesQueuePolicy:ENGINE_RESPONSE_QUEUE_POLICY}:{})},root=mkdtempSync(path.join(tmpdir(),'sh_pending_queue_'));roots.push(root);
 const transport=vi.fn(async()=>new Response(JSON.stringify(raw(statuses[Math.min(n++,statuses.length-1)])),{status:200})),key=vi.fn(()=> 'SYNTHETIC_ONLY');
 const plan=prepareEngineResponse(a,'page_0_0_qa',body(),x=>x,{fetch:transport,openAIKey:key,anthropicKey:()=>{throw Error('denied');}});
 let pauseN=0;const options={root,authority:a,ownerId:'owner',draftId:'draft',snapshotSha256:'a'.repeat(64),assertCurrent:()=>{},now:()=>now,pause:async()=>{now+=pauses[Math.min(pauseN++,pauses.length-1)];}};
 return{a,root,plan,transport,key,options,runtime:new LocalEngineTrialRuntime(options),setTime:(t:number)=>{now=t;},time:()=>now};
}
describe('explicit queue clock and legacy preservation',()=>{
 it('waits through20min queue, then generation, with one POST and the same GET id',async()=>{const s=setup();await s.runtime.call(s.plan);expect(s.transport.mock.calls.map((x:any)=>x[1].method)).toEqual(['POST','GET','GET','GET']);expect(s.transport.mock.calls.slice(1).every((x:any)=>x[0]==='https://api.openai.com/v1/responses/resp_synthetic_queue'&&x[1].body===undefined)).toBe(true);expect(await s.runtime.meter()).toMatchObject({logicalCalls:1,accountedMicroUsd:12,pendingCalls:0});expect(JSON.parse(readFileSync(path.join(s.root,'calls/page_0_0_qa/claim.json'),'utf8')).version).toBe('engine-local-claim/v2');});
 it('legacy default retains v2 provider wire/v1 local claim and its original deadline',async()=>{const s=setup(false,['completed']);await s.runtime.call(s.plan);expect((s.plan.wire as any).version).toBe('engine-site-responses/v2');expect((s.plan.wire as any).responseQueueTiming).toBeUndefined();const claim=JSON.parse(readFileSync(path.join(s.root,'calls/page_0_0_qa/claim.json'),'utf8'));expect(claim.version).toBe('engine-local-claim/v1');expect(claim.deadlineAt).toBe(595000);expect(claim.responseQueueTiming).toBeUndefined();});
 it('queue policy changes only authority/wire lifecycle, never provider body, price slot or output cap',()=>{const a=setup(false),b=setup(true);expect((b.plan.wire as any).body).toEqual((a.plan.wire as any).body);expect(b.plan.call.maximumMicroUsd).toBe(a.plan.call.maximumMicroUsd);expect(b.plan.completionDeadlineMs).toBe(a.plan.completionDeadlineMs);expect(canonicalHash(b.plan.wire)).not.toBe(canonicalHash(a.plan.wire));});
 it('rejects customer or schema-less opt-in',()=>{const s=setup();expect(engineOrderAuthoritySchema.safeParse({...s.a,purpose:'customer'}).success).toBe(false);expect(engineOrderAuthoritySchema.safeParse({...s.a,responseSchemaPolicy:undefined}).success).toBe(false);});
 it('SQL worker refuses local-only queue policy before acquiring any lease or recipe',async()=>{const s=setup(),db:any={generationJob:{findUnique:vi.fn(async()=>({pipelineCache:{engineSite:s.runtime.checkpoint}}))},$transaction:vi.fn()},recipe=vi.fn();await expect(runEngineDurableInvocation(db,s.a.orderId,{executor:'long',recipe,storage:{} as any,assertAdmission:async()=>{}})).rejects.toThrow('engine_worker_queue_policy_local_only');expect(db.$transaction).not.toHaveBeenCalled();expect(recipe).not.toHaveBeenCalled();});
 it('queue expiry retains full reserve and sends no extra POST',async()=>{const s=setup(true,['queued'],[1800000]);await expect(s.runtime.call(s.plan)).rejects.toThrow('engine_queue_deadline');expect(s.transport).toHaveBeenCalledTimes(1);expect(await s.runtime.meter()).toMatchObject({accountedMicroUsd:70,pendingCalls:1,logicalCalls:1});});
 it('an interrupted queue resumes with the original observation time, not a reset',async()=>{const s=setup(true,['queued'],[1]);s.options.pause=async()=>{throw Error('synthetic_interruption');};await expect(s.runtime.call(s.plan)).rejects.toThrow('synthetic_interruption');s.setTime(1810000);const resumed=new LocalEngineTrialRuntime(s.options);await expect(resumed.call(s.plan)).rejects.toThrow('engine_queue_deadline');expect(s.transport).toHaveBeenCalledTimes(1);});
 it('active generation deadline retains full reserve',async()=>{const s=setup(true,['in_progress'],[585000]);await expect(s.runtime.call(s.plan)).rejects.toThrow('engine_generation_deadline');expect(await s.runtime.meter()).toMatchObject({accountedMicroUsd:70,pendingCalls:1});});
 it('rejects changed timing/wire before network',async()=>{const s=setup();s.plan.responseQueueTiming={...s.plan.responseQueueTiming!,generationMs:1000};await expect(s.runtime.call(s.plan)).rejects.toThrow('queue_policy_changed');expect(s.transport).not.toHaveBeenCalled();});
 it('does not upgrade a legacy claim by adding a new authority',async()=>{const s=setup(false,['queued'],[1]);s.options.pause=async()=>{throw Error('stop');};await expect(s.runtime.call(s.plan)).rejects.toThrow('stop');expect(()=>new LocalEngineTrialRuntime({...s.options,authority:{...s.a,responsesQueuePolicy:ENGINE_RESPONSE_QUEUE_POLICY}})).toThrow('checkpoint_binding');});
 it('preserves a known reply before after-await source refusal',async()=>{const s=setup(true,['completed']);let changed=false;s.options.assertCurrent=()=>{if(changed)throw Error('source_changed');};s.transport.mockImplementation(async()=>{changed=true;return new Response(JSON.stringify(raw('completed')),{status:200});});await expect(s.runtime.call(s.plan)).rejects.toThrow('source_changed');expect(await s.runtime.meter()).toMatchObject({accountedMicroUsd:12,pendingCalls:0});});
 it('rebinds exact source plans only and never alters their body/wire',()=>{const s=setup(false),p=rebindEnginePendingResponse(s.plan,{fetch:s.transport,openAIKey:s.key,anthropicKey:s.key});expect(p.wire).toEqual(s.plan.wire);expect(()=>rebindEnginePendingResponse({...s.plan},{fetch:s.transport,openAIKey:s.key,anthropicKey:s.key})).toThrow('pending_plan_changed');s.plan.admitSaved=()=>{};expect(()=>rebindEnginePendingResponse(s.plan,{fetch:s.transport,openAIKey:s.key,anthropicKey:s.key})).toThrow('pending_plan_changed');});
 it('detects a tampered durable timing declaration on resume',async()=>{const s=setup(true,['queued'],[1]);s.options.pause=async()=>{throw Error('stop');};await expect(s.runtime.call(s.plan)).rejects.toThrow('stop');const f=path.join(s.root,'calls/page_0_0_qa/claim.json'),r=JSON.parse(readFileSync(f,'utf8'));r.responseQueueTiming.generationMs=1;writeFileSync(f,JSON.stringify(r));await expect(new LocalEngineTrialRuntime(s.options).call(s.plan)).rejects.toThrow('queue_policy_changed');expect(s.transport).toHaveBeenCalledTimes(1);});
});
describe('pure lifecycle replay guards',()=>{
 const t=responseQueueTiming(540000),p=(status:string,at:number,id='resp_test')=>({id,raw:{id,status},at});
 it('queue and generation have separate non-resetting deadlines',()=>{expect(responseQueueDeadline(t,1000,[p('queued',2000),p('in_progress',1000000)],1005000)).toMatchObject({activeAt:1000000,generationDeadline:1585000,absoluteDeadline:3601000});});
 it.each(['id','time','regression','late_active','unknown'])('refuses corrupt %s observations',kind=>{const ps=kind==='id'?[p('queued',2000),p('queued',3000,'resp_other')]:kind==='time'?[p('queued',3000),p('queued',2000)]:kind==='regression'?[p('in_progress',2000),p('queued',3000)]:kind==='late_active'?[p('in_progress',1801000)]:[p('unknown',2000)];expect(()=>responseQueueDeadline(t,1000,ps,2000000)).toThrow();});
 it('absolute cap cannot be reset by an active transition',()=>{expect(()=>responseQueueDeadline(responseQueueTiming(3000000),1000,[p('in_progress',1700000)],3601000)).toThrow('absolute_deadline');});
 it('transient reads do not invent progress or extend the queue',()=>{expect(()=>responseQueueDeadline(t,1000,[p('queued',2000),{id:'resp_test',at:1800000,raw:{transientPoll:true}}],1801000)).toThrow('queue_deadline');});
});
