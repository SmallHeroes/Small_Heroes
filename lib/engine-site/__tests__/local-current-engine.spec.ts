/** Local rehearsal of the paid current-engine recipe: the exact customer authority and the real batch author plan, local files only. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {CausalDispatch} from '@/lib/personal-wizard/story-causal-experiment-runner';
import {LocalEngineTrialRuntime,validateLocalTrialAuthority,LOCAL_CURRENT_ENGINE_MAX_CALLS} from '../local-trial-runtime';
import {ENGINE_AUTHOR_BATCH,ENGINE_CURRENT_CUSTOMER,ENGINE_CURRENT_CUSTOMER_V2,ENGINE_CURRENT_CUSTOMER_V3} from '../current-engine-policy';
import {engineSpendPolicySchema,engineOrderSteps,enginePolicyDigest} from '../platform-policy';
import {prepareEngineAnthropic,prepareEngineResponse} from '../provider-plans';
import {engineCustomerAuthority} from '../personal-jobs';
import {prepareEngineOrder,resolveEngineWizardOptions} from '../personal-orders';
import {syntheticEngineOrderInput} from './synthetic-order';
import {authority} from './fixtures';
import {engineChildAnchorPose} from '../native-recipe';
import {CHILD_ANCHOR_POSE_V3,CHILD_ANCHOR_POSE_VERSION} from '@/lib/personal-wizard/child-anchor-style';
import {STORYBOARD_BOUND_REPAIR_VERSION} from '@/lib/personal-wizard/storyboard-repair';
import {ENGINE_BOUND_REPAIR_STEP,ENGINE_BOUND_REPAIR_REVIEW_STEP} from '../storyboard-binding-policy';
import {engineBoundRepairAvailable} from '../storyboard-binding';
import {localInitialRepairBody,prepareEngineStoryboard} from '../story-preparation';

const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(r)!==path.resolve(tmpdir())||!path.basename(r).startsWith('sh_local_current_'))throw Error('owned_test_only');rmSync(r,{recursive:true,force:true});}});
const policy=(maximumCalls=LOCAL_CURRENT_ENGINE_MAX_CALLS,version:string=ENGINE_CURRENT_CUSTOMER)=>engineSpendPolicySchema.parse({version:'engine-site-spend-policy/v1',sourceRevision:'a'.repeat(40),
 maximumMicroUsd:12_000_000,maximumCalls,approvalReference:'SYNTHETIC_LOCAL',approvedBy:'synthetic_owner',approvedAt:'2026-11-12T00:00:00.000Z',
 paidProviderActivation:'owner_approved_live_personal_orders',
 engineProfile:{version,imageModelPolicy:{version:'image26-local-book/v1',model:'gpt-image-2.6-sunburst',complexity:'high'}}});
function prepared(){return prepareEngineOrder(syntheticEngineOrderInput(),{id:'local_owner',email:'fixture@example.invalid',name:'Synthetic'},resolveEngineWizardOptions());}
const current=(maximumCalls?:number)=>{const p=prepared();return engineCustomerAuthority('local_current_synthetic',p.snapshot,p.inputSha256,policy(maximumCalls));};
const currentV2=()=>{const p=prepared();return engineCustomerAuthority('local_current_synthetic',p.snapshot,p.inputSha256,policy(undefined,ENGINE_CURRENT_CUSTOMER_V2));};
const dispatch=():CausalDispatch=>({role:'opus',stage:'author',conversationKey:'synthetic_author',input:'SYNTHETIC brief',
 instructions:'SYNTHETIC instructions',schema:z.object({text:z.string().min(2)}).strict(),maxOutputTokens:8000});
const message={id:'msg_synthetic',type:'message',model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({text:'Synthetic story'})}],
 usage:{input_tokens:1000,output_tokens:500,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'batch'}};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
function runtime(a:ReturnType<typeof current>,extra:Partial<ConstructorParameters<typeof LocalEngineTrialRuntime>[0]>={}){
 const root=mkdtempSync(path.join(tmpdir(),'sh_local_current_'));roots.push(root);
 const options={root,authority:a,ownerId:'local_owner',draftId:'d_localcurrent1',snapshotSha256:'a'.repeat(64),assertCurrent:()=>{},pause:async()=>{},...extra};
 return {root,options,r:new LocalEngineTrialRuntime(options)};
}
function batchFetch(endedAfterPolls=2){
 const calls:{url:string;method:string}[]=[];let polls=0;
 const fetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{const url=String(input),method=init?.method??'GET';calls.push({url,method});
  if(method==='POST')return json({id:'msgbatch_local',processing_status:'in_progress'});
  if(url.endsWith('/results'))return new Response(JSON.stringify({custom_id:'story_author',result:{type:'succeeded',message}})+'\n');
  polls++;return json({id:'msgbatch_local',processing_status:polls>endedAfterPolls?'ended':'in_progress',results_url:'https://api.anthropic.com/v1/messages/batches/msgbatch_local/results'});
 }) as unknown as typeof globalThis.fetch;
 return {fetch,calls};
}
const ports=(fetch:typeof globalThis.fetch)=>({fetch,openAIKey:()=>'unused',anthropicKey:()=>'SYNTHETIC_KEY'});

describe('local rehearsal of the current customer engine',()=>{
 it('the shared builder gives the exact current-engine customer authority and the local runtime admits only that customer shape',()=>{
  const a=current();
  expect(a).toMatchObject({purpose:'customer',currentEngine:ENGINE_CURRENT_CUSTOMER,authorTransport:ENGINE_AUTHOR_BATCH,imageQuality:'low',narrativePages:8,
   entitlements:{narration:true,pdf:true},policySha256:enginePolicyDigest(policy()),budget:{maximumMicroUsd:12_000_000,maximumCalls:LOCAL_CURRENT_ENGINE_MAX_CALLS}});
  expect(a.budget.steps).toEqual(engineOrderSteps(policy()));
  expect(validateLocalTrialAuthority(a)).toEqual(a);
  expect(()=>validateLocalTrialAuthority(current(LOCAL_CURRENT_ENGINE_MAX_CALLS+1))).toThrow('local_trial_authority');
  // A historical customer authority (no current bundle) stays refused, and test authorities keep the old 121 bound.
  expect(()=>validateLocalTrialAuthority({...authority(),purpose:'customer'})).toThrow('local_trial_authority');
  expect(()=>validateLocalTrialAuthority({...authority(),purpose:'test',budget:{...authority().budget,maximumCalls:122}})).toThrow('local_trial_authority');
 });
 it('runs the REAL batch author plan: one create, 30 s polls, one settled result at the batch rate',async()=>{
  const a=current(),pauses:number[]=[],s=runtime(a,{pause:async ms=>{pauses.push(ms);}}),f=batchFetch(2);
  const plan=prepareEngineAnthropic(a,dispatch(),ports(f.fetch));
  const result=await s.r.call(plan);
  expect(result).toMatchObject({usable:true,output:{text:'Synthetic story'},estimatedMicroUsd:Math.ceil((1000*4+500*20)/2)});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);
  expect(pauses.length).toBeGreaterThanOrEqual(2);expect(pauses.every(ms=>ms===30_000)).toBe(true);
  expect(s.r.checkpoint.calls.story_author).toMatchObject({settled:true,pendingId:'msgbatch_local'});
  expect(await s.r.meter()).toMatchObject({logicalCalls:1,pendingCalls:0,unknownCalls:0,blocked:false});
 });
 it('a process exit while the batch is pending resumes by the same batch id and never creates a second batch',async()=>{
  const a=current();let crash=true;const s=runtime(a,{pause:async()=>{if(crash)throw Error('synthetic_process_exit');}}),f=batchFetch(1);
  await expect(s.r.call(prepareEngineAnthropic(a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
  crash=false;const resumed=new LocalEngineTrialRuntime(s.options);
  expect(await resumed.call(prepareEngineAnthropic(a,dispatch(),ports(f.fetch)))).toMatchObject({usable:true});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);
  expect(readdirSync(path.join(s.root,'calls','story_author')).filter(n=>n.startsWith('pending-')).length).toBeGreaterThanOrEqual(1);
 });
 it('an expired batch keeps its full reserve and stops; it never re-sends',async()=>{
  let now=10_000;const a=current(),s=runtime(a,{now:()=>now,pause:async()=>{now+=60*60*1000;}}),f=batchFetch(1000);
  await expect(s.r.call(prepareEngineAnthropic(a,dispatch(),ports(f.fetch)))).rejects.toThrow('local_trial_pending_deadline');
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);
  expect(await s.r.meter()).toMatchObject({pendingCalls:1,accountedMicroUsd:a.budget.steps.find(x=>x.id==='story_author')!.maximumMicroUsd});
 });
 it('waits up to one hour for a queued OpenAI background response on the current engine only, with one POST and the full reserve',async()=>{
  const responsesPlan=(a:{budget:{steps:{id:string;maximumMicroUsd:number}[]}},result:any)=>{const step=a.budget.steps.find(x=>x.id==='page_0_0_qa')!,
   wire={endpoint:'https://api.openai.com/v1/responses',step:step.id,synthetic:true},execute=vi.fn(async(pending:string|undefined)=>pending&&result?{kind:'completed' as const,result}:{kind:'pending' as const,id:'resp_queued',raw:{status:'queued'}});
   return {execute,plan:{wire,call:{step:step.id,wireSha256:canonicalHash(wire),maximumMicroUsd:step.maximumMicroUsd},requiredMs:20_000,completionDeadlineMs:240_000,execute,admitSaved:()=>{}}};};
  // Current engine: still queued after 20 minutes (beyond its 4-minute generation timer), then answered.
  let now=10_000,polls=0;const a=current(),done={usable:true,output:{ok:true},raw:{},estimatedMicroUsd:100};
  const q=responsesPlan(a,null),s=runtime(a,{now:()=>now,pause:async()=>{now+=60_000;if(++polls===20)q.execute.mockImplementation(async()=>({kind:'completed',result:done}) as any);}});
  expect(await s.r.call(q.plan as any)).toEqual(done);expect(q.execute.mock.calls.filter(c=>c[0]===undefined)).toHaveLength(1);
  expect(s.r.checkpoint.calls.page_0_0_qa.deadlineAt).toBe(10_000+3_600_000+45_000);
  // Never answered: stops at the one-hour ceiling with the reserve kept.
  now=10_000;const never=responsesPlan(a,null),t=runtime(a,{now:()=>now,pause:async()=>{now+=5*60_000;}});
  await expect(t.r.call(never.plan as any)).rejects.toThrow('local_trial_pending_deadline');
  expect(now).toBeGreaterThanOrEqual(10_000+3_600_000);expect(await t.r.meter()).toMatchObject({pendingCalls:1});
  // A test authority keeps the historical generation timer.
  const test={...authority(),purpose:'test' as const};now=10_000;const old=responsesPlan(test,null),u=runtime(test as any,{now:()=>now,pause:async()=>{now+=60_000;}});
  await expect(u.r.call(old.plan as any)).rejects.toThrow('local_trial_pending_deadline');expect(now).toBeLessThan(10_000+600_000);
 });
 it('the current customer engine draws the child anchor under the wardrobe-safe pose contract; historical recipes keep v1',()=>{
  expect(engineChildAnchorPose(current())).toBe(CHILD_ANCHOR_POSE_V3);expect(engineChildAnchorPose(currentV2())).toBe(CHILD_ANCHOR_POSE_V3);
  expect(engineChildAnchorPose({...authority(),purpose:'test'})).toBe(CHILD_ANCHOR_POSE_VERSION);
  expect(engineChildAnchorPose({...authority(),purpose:'customer'})).toBe(CHILD_ANCHOR_POSE_VERSION);
 });
 it('the current engine reviews its first storyboard repair with the full 208 KB review capacity; historical authorities keep 104 KB',()=>{
  const body=(bytes:number)=>({model:'gpt-6.1-sol',service_tier:'default',store:false,reasoning:{effort:'medium'},instructions:'',input:'x'.repeat(bytes),
   max_output_tokens:12000,text:{format:{type:'json_schema',name:'synthetic',strict:true,schema:{type:'object',properties:{},required:[],additionalProperties:false}}}});
  const p={fetch:vi.fn() as unknown as typeof globalThis.fetch,openAIKey:()=>'unused',anthropicKey:()=>'unused'},a=current();
  expect(a.budget.steps.find(s=>s.id==='initial_storyboard_repair_1_review')?.maximumMicroUsd).toBe(1_200_000);
  // 114,076 bytes was the live initial review of 11/12; the first repair's review is at least that large.
  expect(prepareEngineResponse(a,'initial_storyboard_repair_1_review',body(208_000),x=>x,p).call.step).toBe('initial_storyboard_repair_1_review');
  expect(()=>prepareEngineResponse(a,'initial_storyboard_repair_1_review',body(208_001),x=>x,p)).toThrow('engine_responses_input_limit');
  // The repair's own storyboard generation keeps 104 KB.
  expect(()=>prepareEngineResponse(a,'initial_storyboard_repair_1',body(104_001),x=>x,p)).toThrow('engine_responses_input_limit');
  // A historical (test) authority keeps the 104 KB review ceiling for this step.
  const test={...authority(),purpose:'test' as const,responseSchemaPolicy:a.responseSchemaPolicy};
  expect(()=>prepareEngineResponse(test,'initial_storyboard_repair_1_review',body(104_001),x=>x,p)).toThrow('engine_responses_input_limit');
  expect(()=>prepareEngineResponse(test,'initial_storyboard_repair_1_review',body(104_000),x=>x,p)).not.toThrow('engine_responses_input_limit');
 });
 it('customer-current-engine/v2 owns one bound repair (both slots in place of the unused prep pair, 1.2M reserve, 208 KB review); v1 and every other authority keep the old stop',async()=>{
  const a=currentV2(),v1=current(),p={fetch:vi.fn() as unknown as typeof globalThis.fetch,openAIKey:()=>'unused',anthropicKey:()=>'unused'};
  expect(a).toMatchObject({currentEngine:ENGINE_CURRENT_CUSTOMER_V2,budget:{maximumMicroUsd:12_000_000,maximumCalls:LOCAL_CURRENT_ENGINE_MAX_CALLS}});
  expect(validateLocalTrialAuthority(a)).toEqual(a);
  expect(a.budget.steps.find(s=>s.id===ENGINE_BOUND_REPAIR_STEP)?.maximumMicroUsd).toBe(1_200_000);
  expect(a.budget.steps.some(s=>s.id===ENGINE_BOUND_REPAIR_REVIEW_STEP)).toBe(true);
  // The same slot count and ceiling: v2 declares the bound repair pair instead of the legacy prep_storyboard_0 pair it never uses.
  expect(a.budget.steps.length).toBe(v1.budget.steps.length);
  expect(a.budget.steps.some(s=>s.id.startsWith('prep_storyboard_0'))).toBe(false);
  expect(v1.budget.steps.filter(s=>s.id.startsWith('prep_storyboard_0')).map(s=>s.id)).toEqual(['prep_storyboard_0','prep_storyboard_0_review']);
  expect(v1.budget.steps.some(s=>s.id===ENGINE_BOUND_REPAIR_STEP||s.id===ENGINE_BOUND_REPAIR_REVIEW_STEP)).toBe(false);
  expect(engineBoundRepairAvailable(a)).toBe(true);expect(engineBoundRepairAvailable(v1)).toBe(false);
  expect(engineBoundRepairAvailable({...v1,budget:a.budget})).toBe(false);
  // An authority without the slots (every historical one) and a test authority never get it.
  expect(engineBoundRepairAvailable({...a,budget:{...a.budget,steps:a.budget.steps.filter(s=>s.id!==ENGINE_BOUND_REPAIR_STEP)}})).toBe(false);
  expect(engineBoundRepairAvailable({...a,purpose:'test'} as any)).toBe(false);
  expect(engineBoundRepairAvailable({...authority(),purpose:'customer'})).toBe(false);
  const body=(bytes:number)=>({model:'gpt-6.1-sol',service_tier:'default',store:false,reasoning:{effort:'medium'},instructions:'',input:'x'.repeat(bytes),
   max_output_tokens:12000,text:{format:{type:'json_schema',name:'synthetic',strict:true,schema:{type:'object',properties:{},required:[],additionalProperties:false}}}});
  expect(prepareEngineResponse(a,ENGINE_BOUND_REPAIR_REVIEW_STEP,body(208_000),x=>x,p).call.step).toBe(ENGINE_BOUND_REPAIR_REVIEW_STEP);
  expect(()=>prepareEngineResponse(a,ENGINE_BOUND_REPAIR_REVIEW_STEP,body(208_001),x=>x,p)).toThrow('engine_responses_input_limit');
  expect(()=>prepareEngineResponse(a,ENGINE_BOUND_REPAIR_STEP,body(104_001),x=>x,p)).toThrow('engine_responses_input_limit');
  // The repair wire: only a marked bound repair at its own step on the current engine; never an ordinary repair there or a bound one elsewhere.
  const call:any={stage:'storyboard',instructions:'',input:'{}',schema:z.object({}).strict(),maxOutputTokens:40_000,context:{narrativeSpreads:8,sourceDigest:'a'.repeat(64)}};
  const plain={parentStoryboardDigest:'a'.repeat(64),draft:{},review:{}},bound={...plain,binding:STORYBOARD_BOUND_REPAIR_VERSION} as const;
  expect(()=>localInitialRepairBody(a,call,bound,ENGINE_BOUND_REPAIR_STEP)).not.toThrow('engine_initial_repair_authority');
  expect(()=>localInitialRepairBody(a,call,plain,ENGINE_BOUND_REPAIR_STEP)).toThrow('engine_initial_repair_authority');
  expect(()=>localInitialRepairBody(a,call,bound,'initial_storyboard_repair_1')).toThrow('engine_initial_repair_authority');
  expect(()=>localInitialRepairBody({...v1,budget:a.budget},call,bound,ENGINE_BOUND_REPAIR_STEP)).toThrow('engine_initial_repair_authority');
  expect(()=>localInitialRepairBody({...authority(),purpose:'test'} as any,call,bound,ENGINE_BOUND_REPAIR_STEP)).toThrow('engine_initial_repair_authority');
  // The storyboard stage refuses a bound repair without its marker, its appearance or its authority, and a marker on any other prefix.
  const rt=(x:any)=>({checkpoint:{authority:x}}) as any,existing={} as any;
  await expect(prepareEngineStoryboard(rt(a),{} as any,{} as any,p,'bound_repair')).rejects.toThrow('engine_bound_repair_authority');
  await expect(prepareEngineStoryboard(rt(a),{} as any,{} as any,p,'bound_repair',undefined,bound)).rejects.toThrow('engine_bound_repair_authority');
  await expect(prepareEngineStoryboard(rt(a),{} as any,{} as any,p,'bound_repair',existing,plain)).rejects.toThrow('engine_bound_repair_authority');
  await expect(prepareEngineStoryboard(rt(a),{} as any,{} as any,p,'initial_repair_1',existing,bound)).rejects.toThrow('engine_bound_repair_authority');
  await expect(prepareEngineStoryboard(rt({...authority(),purpose:'test'}),{} as any,{} as any,p,'bound_repair',existing,bound)).rejects.toThrow('engine_bound_repair_authority');
  await expect(prepareEngineStoryboard(rt({...v1,budget:a.budget}),{} as any,{} as any,p,'bound_repair',existing,bound)).rejects.toThrow('engine_bound_repair_authority');
 });
 it('the role-scoped entities recipe preserves the v2 budget and typed corrections',()=>{
  const p=prepared(),v2=currentV2();
  const v3=engineCustomerAuthority('local_current_synthetic',p.snapshot,p.inputSha256,policy(undefined,ENGINE_CURRENT_CUSTOMER_V3));
  expect(v3.currentEngine).toBe(ENGINE_CURRENT_CUSTOMER_V3);
  expect(v3.budget).toEqual(v2.budget);
  expect(v3.locationSheetPolicy).toBe(v2.locationSheetPolicy);
  expect(v3.imageModelPolicy).toEqual(v2.imageModelPolicy);
  expect(engineBoundRepairAvailable(v3)).toBe(true);
  expect(v3.policySha256).not.toBe(v2.policySha256);
 });
 it('a batch-shaped wire is refused before dispatch on an authority without the batch transport',async()=>{
  const test={...authority(),purpose:'test' as const},s=runtime(test as any),wire={version:'engine-site-anthropic-batch/v1',synthetic:true},execute=vi.fn();
  const step=test.budget.steps[0].id;
  await expect(s.r.call({wire,call:{step,wireSha256:canonicalHash(wire),maximumMicroUsd:test.budget.steps[0].maximumMicroUsd},
   requiredMs:20_000,completionDeadlineMs:3*60*60*1000,execute,admitSaved:()=>{}})).rejects.toThrow('local_trial_plan_changed');
  expect(execute).not.toHaveBeenCalled();expect(existsSync(path.join(s.root,'calls',step))).toBe(false);
 });
});
