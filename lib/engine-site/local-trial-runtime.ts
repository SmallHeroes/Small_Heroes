/** Default-inactive local test journal for the existing API-native recipe. No Order/payment/DB writes. */
import 'server-only';
import {randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalHash} from '@/lib/canonical-json';
import {engineOrderAuthoritySchema,identifierSchema,engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineCheckpoint,type EngineProviderResult,type EngineRuntime,type PreparedEngineCall} from './durable-worker';
import {responseQueueTiming,responseQueueTimingSchema,responseQueueDeadline,type ResponseQueueTiming} from './responses-queue-policy';
import {isCurrentCustomerEngine,ENGINE_AUTHOR_BATCH} from './current-engine-policy';

const MAX_JSON=64*1024*1024;
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Claim={version:'engine-local-claim/v1'|'engine-local-claim/v2';authoritySha256:string;call:PreparedEngineCall['call'];requestAssetId:string;deadlineAt:number;responseQueueTiming?:ResponseQueueTiming};
type Settlement={version:'engine-local-result/v1';claimSha256:string;assetId:string;assetSha256:string;result:EngineProviderResult};
type Poll={id:string;raw:unknown;at:number};
export type LocalTrialCarry={accountedMicroUsd:number;logicalCalls:number;evidenceSha256:string};
/**
 * Optional consent-global write-once dispatch witnesses. Default/legacy runtimes retain their exact journal path. `observe`/`observed`
 * (optional): the provider's FIRST id of a dispatched step and its dispatch time, recorded before the first local pending observation, so a
 * resume can only ever collect that one id.
 */
export type LocalTrialDispatchWitness={list:()=>readonly {step:string;claimSha256:string;maximumMicroUsd:number}[];
 check:(step:string,claimSha256:string,dispatched:boolean)=>void;begin:(step:string,claimSha256:string)=>void;
 observe?:(step:string,claimSha256:string,id:string,dispatchAt:number)=>void;observed?:(step:string)=>{claimSha256:string;id:string;dispatchAt:number}|null};
/** The provider's own id inside a raw pending answer, when it carries one. */
const rawId=(raw:unknown)=>raw&&typeof raw==='object'&&typeof (raw as {id?:unknown}).id==='string'?(raw as {id:string}).id:undefined;
/** Shared by the real constructor and CLI planning, before any one-use execution claim. */
/** Eligible description-only slots of the current customer recipe (with every re-ask): a full book never stops on count alone. */
export const LOCAL_CURRENT_ENGINE_MAX_CALLS=124;
export function validateLocalTrialAuthority(value:unknown){
 const a=engineOrderAuthoritySchema.parse(value),maximum=a.imageModelPolicy?12_000_000:10_000_000;
 // A local rehearsal of the paid recipe runs the EXACT current-engine customer authority, against local files only:
 // no Order, payment, database or delivery exists in this runtime. Every other customer authority stays refused.
 const current=isCurrentCustomerEngine(a);
 if(a.purpose!=='test'&&!current||a.budget.maximumMicroUsd>maximum||a.budget.maximumCalls>(current?LOCAL_CURRENT_ENGINE_MAX_CALLS:121))engineSiteFail('local_trial_authority');
 return a;
}
const BATCH_WIRE='engine-site-anthropic-batch/v1',BATCH_MAX_DEADLINE_MS=3*60*60*1000,BATCH_POLL_MS=30_000;
/**
 * The local rehearsal waits up to one hour for an OpenAI background response that is still queued (observed 11/10:
 * a default-tier review stayed "queued" past its generation timer). Same wire, same full reserve, never a second POST:
 * only the local stop timer is longer. The hosted worker does NOT have this yet; that is a separate launch item.
 */
export const LOCAL_CURRENT_RESPONSE_WAIT_MS=3_600_000;
export class LocalEngineTrialRuntime implements EngineRuntime {
 readonly checkpoint:EngineCheckpoint;
 readonly signal:AbortSignal;
 private readonly root:string;
 private readonly carried:Readonly<LocalTrialCarry>|null;
 private busy=false;
 constructor(private readonly options:{root:string;authority:EngineOrderAuthority;ownerId:string;draftId:string;snapshotSha256:string;
   assertCurrent:()=>void|Promise<void>;carried?:LocalTrialCarry;dispatchWitness?:LocalTrialDispatchWitness;signal?:AbortSignal;now?:()=>number;pause?:(ms:number)=>Promise<void>}){
  const a=validateLocalTrialAuthority(options.authority);
  this.carried=options.carried?Object.freeze({...options.carried}):null;
  this.root=path.resolve(options.root);mkdirSync(this.root,{recursive:true,mode:0o700});
  if(lstatSync(this.root).isSymbolicLink()||realpathSync(this.root)!==this.root)engineSiteFail('local_trial_path');
  for(const name of ['assets','calls']){const dir=path.join(this.root,name);mkdirSync(dir,{recursive:true,mode:0o700});if(lstatSync(dir).isSymbolicLink()||realpathSync(dir)!==dir)engineSiteFail('local_trial_path');}
  // The checkpoint is written before any asset, claim or dispatch: without it, saved calls or a witnessed dispatch mean lost state, never a new run.
  if(!existsSync(this.file('checkpoint.json'))&&(readdirSync(this.file('calls')).length>0||readdirSync(this.file('assets')).length>0||(options.dispatchWitness?.list().length??0)>0))
   engineSiteFail('local_trial_checkpoint_missing');
  if(this.carried){const c=this.carried;if(!Number.isSafeInteger(c.accountedMicroUsd)||c.accountedMicroUsd<0||c.accountedMicroUsd>a.budget.maximumMicroUsd||!Number.isSafeInteger(c.logicalCalls)||c.logicalCalls<1||c.logicalCalls>=a.budget.maximumCalls||!/^[a-f0-9]{64}$/.test(c.evidenceSha256))engineSiteFail('local_trial_carry_invalid');}
  const carryFile=this.file('carry.json'),carry=this.carried;
  if(existsSync(carryFile)){if(canonicalHash(this.read(carryFile))!==canonicalHash(carry))engineSiteFail('local_trial_carry_changed');}
  else {if(existsSync(this.file('checkpoint.json'))&&carry)engineSiteFail('local_trial_carry_changed');this.exclusive(carryFile,carry);}
  this.signal=options.signal??new AbortController().signal;
  const state=this.file('checkpoint.json');
  this.checkpoint=existsSync(state)?parseEngineCheckpoint({engineSite:this.read(state)}):{
   version:'engine-site-job/v1',authority:a,ownerId:options.ownerId,draftId:options.draftId,snapshotSha256:options.snapshotSha256,phase:'story',calls:{},outputs:{},waiting:null};
  if(canonicalHash(this.checkpoint.authority)!==canonicalHash(a)||this.checkpoint.ownerId!==options.ownerId||this.checkpoint.draftId!==options.draftId||this.checkpoint.snapshotSha256!==options.snapshotSha256)engineSiteFail('local_trial_checkpoint_binding');
  if(!existsSync(state))this.persist();
 }
 private now(){return this.options.now?.()??Date.now();}
 private file(name:string){const f=path.resolve(this.root,name);if(!f.startsWith(this.root+path.sep))engineSiteFail('local_trial_path');return f;}
 private read(file:string):any{if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file||lstatSync(file).size>MAX_JSON)engineSiteFail('local_trial_file');return JSON.parse(readFileSync(file,'utf8'));}
 private exclusive(file:string,value:unknown){const text=json(value);if(Buffer.byteLength(text)>MAX_JSON)engineSiteFail('local_trial_size');writeFileSync(file,text,{flag:'wx',mode:0o600});}
 private persist(){const temp=this.file('checkpoint-'+randomUUID()+'.tmp');this.exclusive(temp,this.checkpoint);renameSync(temp,this.file('checkpoint.json'));}
 private blob(value:unknown){const id=randomUUID(),record={version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value};this.exclusive(this.file('assets/'+id+'.json'),record);return id;}
 async readJson(id:string){if(!uuid.test(id))engineSiteFail('local_trial_asset_id');const r=this.read(this.file('assets/'+id+'.json'));if(r.version!=='engine-local-asset/v1'||r.id!==id||r.sha256!==canonicalHash(r.value))engineSiteFail('local_trial_asset_changed');return r.value;}
 private callFile(step:string,name:string){identifierSchema.parse(step);const dir=this.file('calls/'+step);if(existsSync(dir)&&(lstatSync(dir).isSymbolicLink()||realpathSync(dir)!==dir))engineSiteFail('local_trial_path');return this.file('calls/'+step+'/'+name);}
 private claim(step:string){const r=this.read(this.callFile(step,'claim.json')) as Claim;
  const slot=this.checkpoint.authority.budget.steps.find(s=>s.id===step);
  if(!['engine-local-claim/v1','engine-local-claim/v2'].includes(r.version)||r.version==='engine-local-claim/v2'&&(!this.checkpoint.authority.responsesQueuePolicy||!responseQueueTimingSchema.safeParse(r.responseQueueTiming).success)||r.version==='engine-local-claim/v1'&&r.responseQueueTiming!==undefined||r.authoritySha256!==canonicalHash(this.checkpoint.authority)||r.call.step!==step||!slot||r.call.maximumMicroUsd!==slot.maximumMicroUsd||!Number.isSafeInteger(r.deadlineAt))engineSiteFail('local_trial_claim_changed');return r;}
 private async settled(step:string,claim:Claim):Promise<Settlement|null>{const file=this.callFile(step,'result.json');if(!existsSync(file))return null;
  const r=this.read(file) as Settlement,saved=await this.readJson(r.assetId);
  if(r.version!=='engine-local-result/v1'||r.claimSha256!==canonicalHash(claim)||r.assetSha256!==canonicalHash(saved)||saved.wireSha256!==claim.call.wireSha256||saved.completed!==true||canonicalHash(saved.result)!==canonicalHash(r.result))engineSiteFail('local_trial_result_changed');return r;}
 async meter(){if(canonicalHash(this.read(this.file('carry.json')))!==canonicalHash(this.carried))engineSiteFail('local_trial_carry_changed');
  let accountedMicroUsd=this.carried?.accountedMicroUsd??0,knownEstimateMicroUsd=accountedMicroUsd,pendingCalls=0,unknownCalls=0,failedCalls=0,overReservedCalls=0;
  const steps=readdirSync(this.file('calls')),witnesses=this.options.dispatchWitness?.list()??[],witnessByStep=new Map(witnesses.map(w=>[w.step,w]));let lostLocalCalls=0;
  if(witnessByStep.size!==witnesses.length)engineSiteFail('local_trial_witness_changed');
  for(const step of steps){let claim:Claim,r:Settlement|null;
   try{claim=this.claim(step);this.options.dispatchWitness?.check(step,canonicalHash(claim),existsSync(this.callFile(step,'dispatch.json')));r=await this.settled(step,claim);}
   catch(error){const w=witnessByStep.get(step);if(!w)throw error;accountedMicroUsd+=w.maximumMicroUsd;pendingCalls++;lostLocalCalls++;continue;}
   if(!r){accountedMicroUsd+=claim.call.maximumMicroUsd;pendingCalls++;}
   else if(r.result.estimatedMicroUsd===null){accountedMicroUsd+=claim.call.maximumMicroUsd;unknownCalls++;}
   else {const cost=r.result.estimatedMicroUsd;if(!Number.isSafeInteger(cost)||cost<0)engineSiteFail('local_trial_result_cost');accountedMicroUsd+=cost;knownEstimateMicroUsd+=cost;if(cost>claim.call.maximumMicroUsd)overReservedCalls++;}
   if(r?.result.usable===false)failedCalls++;
  }
  if(!Number.isSafeInteger(accountedMicroUsd))engineSiteFail('local_trial_meter_overflow');
  let missing=0;for(const w of witnesses)if(!steps.includes(w.step)){accountedMicroUsd+=w.maximumMicroUsd;pendingCalls++;lostLocalCalls++;missing++;}
  // A call the checkpoint records whose local journal is gone keeps its full slot reserve and blocks (the claim is written before the checkpoint).
  const vanished=Object.keys(this.checkpoint.calls).filter(step=>!steps.includes(step)&&!witnessByStep.has(step));
  for(const step of vanished){accountedMicroUsd+=this.checkpoint.authority.budget.steps.find(s=>s.id===step)?.maximumMicroUsd??this.checkpoint.authority.budget.maximumMicroUsd;pendingCalls++;missing++;}
  if(!Number.isSafeInteger(accountedMicroUsd))engineSiteFail('local_trial_meter_overflow');
  const logicalCalls=steps.length+missing+(this.carried?.logicalCalls??0);
  return {accountedMicroUsd,knownEstimateMicroUsd,pendingCalls,unknownCalls,failedCalls,overReservedCalls,logicalCalls,
   ...(this.carried?{carriedMicroUsd:this.carried.accountedMicroUsd,carriedCalls:this.carried.logicalCalls}:{}),
   ...(this.options.dispatchWitness?{lostLocalCalls}:{}),
   blocked:lostLocalCalls>0||vanished.length>0||unknownCalls>0||failedCalls>0||overReservedCalls>0||accountedMicroUsd>this.checkpoint.authority.budget.maximumMicroUsd||logicalCalls>this.checkpoint.authority.budget.maximumCalls,kind:'estimate_not_invoice' as const};
 }
 readonly check=()=>{if(this.signal.aborted)engineSiteFail('local_trial_cancelled');};
 async result(step:string){const claim=this.claim(step),r=await this.settled(step,claim);if(!r||r.result.estimatedMicroUsd===null||r.result.usable===false)engineSiteFail('local_trial_result_unavailable');return r.result;}
 async load(name:string){identifierSchema.parse(name);return this.checkpoint.outputs[name]?this.readJson(this.checkpoint.outputs[name]):null;}
 async save(name:string,value:unknown){identifierSchema.parse(name);this.check();await this.options.assertCurrent();const old=await this.load(name);if(old!==null&&canonicalHash(old)===canonicalHash(value))return;this.checkpoint.outputs[name]=this.blob(value);this.persist();}
 async advance(phase:EngineCheckpoint['phase']){this.check();await this.options.assertCurrent();this.checkpoint.phase=phase;this.persist();}
 async call(plan:PreparedEngineCall):Promise<EngineProviderResult>{
  if(this.busy)engineSiteFail('local_trial_parallel_call');this.busy=true;
  try{
   this.check();await this.options.assertCurrent();plan.revalidate?.();
   const step=identifierSchema.parse(plan.call.step),slot=this.checkpoint.authority.budget.steps.find(s=>s.id===step);
   // Message Batches exist only on the current-engine authority: a batch id, a 3 h ceiling and slow polls.
   const batch=(plan.wire as any)?.version===BATCH_WIRE;
   if(batch&&this.checkpoint.authority.authorTransport!==ENGINE_AUTHOR_BATCH)engineSiteFail('local_trial_plan_changed');
   const pendingPattern=batch?/^msgbatch_[A-Za-z0-9_-]+$/:/^resp_[A-Za-z0-9_-]+$/;
   if(!slot||plan.call.maximumMicroUsd!==slot.maximumMicroUsd||plan.call.wireSha256!==canonicalHash(plan.wire)||!plan.admitSaved||
     !Number.isSafeInteger(plan.requiredMs)||plan.requiredMs<1||plan.requiredMs>1_500_000||
     plan.completionDeadlineMs!==undefined&&(!Number.isSafeInteger(plan.completionDeadlineMs)||plan.completionDeadlineMs<1||plan.completionDeadlineMs>(batch?BATCH_MAX_DEADLINE_MS:3_600_000)))engineSiteFail('local_trial_plan_changed');
   const wire=plan.wire as any,queued=plan.responseQueueTiming;
   const longWait=!queued&&isCurrentCustomerEngine(this.checkpoint.authority)&&wire?.endpoint==='https://api.openai.com/v1/responses';
   const waitMs=longWait?Math.max(plan.completionDeadlineMs??plan.requiredMs,LOCAL_CURRENT_RESPONSE_WAIT_MS):undefined;
   const timingSha=canonicalHash(queued??null);
   if(queued&&(wire.version!=='engine-site-responses/v3'||!this.checkpoint.authority.responsesQueuePolicy||canonicalHash(queued)!==canonicalHash(responseQueueTiming(plan.completionDeadlineMs!))||canonicalHash(queued)!==canonicalHash(wire.responseQueueTiming))||wire.endpoint==='https://api.openai.com/v1/responses'&&!!this.checkpoint.authority.responsesQueuePolicy!==!!queued)engineSiteFail('local_trial_queue_policy_changed');
   const dir=this.file('calls/'+step),claimFile=this.callFile(step,'claim.json');let claim:Claim;
   if(existsSync(claimFile)){
    claim=this.claim(step);if(canonicalHash(claim.call)!==canonicalHash(plan.call))engineSiteFail('local_trial_wire_changed');
    if(canonicalHash(claim.responseQueueTiming??null)!==canonicalHash(queued??null))engineSiteFail('local_trial_queue_policy_changed');
    this.options.dispatchWitness?.check(step,canonicalHash(claim),existsSync(this.callFile(step,'dispatch.json')));
    const saved=await this.readJson(claim.requestAssetId);if(saved.authoritySha256!==canonicalHash(this.checkpoint.authority)||canonicalHash(saved.wire)!==plan.call.wireSha256||canonicalHash(saved.call)!==canonicalHash(plan.call))engineSiteFail('local_trial_request_changed');
    const complete=await this.settled(step,claim);if(complete){const m=await this.meter();if(m.blocked||complete.result.estimatedMicroUsd===null)engineSiteFail('local_trial_settled_hold');await plan.admitSaved(complete.result);this.updateCheckpoint(step,claim,complete.assetId,true);return complete.result;}
   }else{
    const m=await this.meter();if(m.blocked||m.pendingCalls||m.logicalCalls>=this.checkpoint.authority.budget.maximumCalls||m.accountedMicroUsd+plan.call.maximumMicroUsd>this.checkpoint.authority.budget.maximumMicroUsd)engineSiteFail('local_trial_budget_or_unknown');
    mkdirSync(dir,{mode:0o700});const requestAssetId=this.blob({authoritySha256:canonicalHash(this.checkpoint.authority),call:plan.call,wire:plan.wire});
    claim={version:queued?'engine-local-claim/v2':'engine-local-claim/v1',authoritySha256:canonicalHash(this.checkpoint.authority),call:plan.call,requestAssetId,deadlineAt:this.now()+(queued?.absoluteMs??waitMs??plan.completionDeadlineMs??plan.requiredMs)+45_000,...(queued?{responseQueueTiming:queued}:{})};
    this.exclusive(claimFile,claim);this.updateCheckpoint(step,claim,undefined,false);
   }
   const polls=readdirSync(dir).filter(f=>/^pending-\d{5}\.json$/.test(f)).sort();let pending:string|undefined;
   const dispatchFile=this.callFile(step,'dispatch.json'),claimSha=canonicalHash(claim);let dispatchAt:number|undefined;
   if(existsSync(dispatchFile)){const d=this.read(dispatchFile);if(d.claimSha256!==claimSha||!Number.isSafeInteger(d.at))engineSiteFail('local_trial_dispatch_changed');dispatchAt=d.at;}
   const witnessed=this.options.dispatchWitness?.observed?.(step)??null;
   if(witnessed&&(dispatchAt===undefined||witnessed.claimSha256!==claimSha||witnessed.dispatchAt!==dispatchAt||!pendingPattern.test(witnessed.id)))engineSiteFail('local_trial_pending_id');
   if(polls.length){
    // A resume collects exactly ONE provider id: every saved observation, its raw provider answer, the checkpoint and the durable
    // first-id witness must agree; a conflict or a gap stops with the full reserve kept.
    const entry=this.checkpoint.calls[step],observations=polls.map(f=>this.read(this.callFile(step,f)) as Poll);pending=observations[0].id;
    if(dispatchAt===undefined||!entry||polls.some((f,i)=>f!=='pending-'+String(i).padStart(5,'0')+'.json')||
      observations.some(o=>typeof o.id!=='string'||o.id!==pending||!pendingPattern.test(o.id)||rawId(o.raw)!==undefined&&rawId(o.raw)!==o.id)||
      !(entry.polls===polls.length||entry.polls===polls.length-1)||(entry.pendingId===undefined?entry.polls!==0:entry.pendingId!==pending)||
      !!this.options.dispatchWitness?.observed&&witnessed?.id!==pending)engineSiteFail('local_trial_pending_id');
   }else if(dispatchAt!==undefined){
    // The one consistent crash window that resumes by id: the durable first id exists, its first local observation was never written.
    if(!witnessed)engineSiteFail('local_trial_unknown_dispatch');pending=witnessed.id;
   }
   const meter=await this.meter();if(meter.blocked||meter.pendingCalls!==1)engineSiteFail('local_trial_budget_or_unknown');
   let n=polls.length;const queuePolls:Poll[]=queued?polls.map(f=>this.read(this.callFile(step,f))):[];
   const queueCheck=()=>{if(!queued)return;const d=this.read(this.callFile(step,'dispatch.json'));if(d.claimSha256!==canonicalHash(claim))engineSiteFail('local_trial_dispatch_changed');responseQueueDeadline(queued,d.at,queuePolls,this.now());};
   for(;;){
    this.check();if(this.now()>=claim.deadlineAt||n>(queued||longWait?1000:500))engineSiteFail('local_trial_pending_deadline');if(pending)queueCheck();
    const assertDispatch=async()=>{this.check();await this.options.assertCurrent();plan.revalidate?.();if(canonicalHash(plan.wire)!==plan.call.wireSha256||canonicalHash(plan.responseQueueTiming??null)!==timingSha)engineSiteFail('local_trial_wire_changed');if(queued&&existsSync(this.callFile(step,'dispatch.json')))queueCheck();};
    await assertDispatch();if(!pending){this.options.dispatchWitness?.begin(step,claimSha);dispatchAt=this.now();this.exclusive(dispatchFile,{at:dispatchAt,claimSha256:claimSha});}
    // A throw leaves the complete reservation and dispatch marker. It NEVER authorizes another POST.
    const answer=await plan.execute(pending,this.signal,assertDispatch);
    if(answer.kind==='pending'){
     if(!pendingPattern.test(answer.id)||pending&&answer.id!==pending||rawId(answer.raw)!==undefined&&rawId(answer.raw)!==answer.id)engineSiteFail('local_trial_pending_id');
     // The first id is durable outside the journal BEFORE its first local observation; later answers must carry the same id.
     this.options.dispatchWitness?.observe?.(step,claimSha,answer.id,dispatchAt!);
     const observation={id:answer.id,raw:answer.raw,at:this.now()};this.exclusive(this.callFile(step,'pending-'+String(n++).padStart(5,'0')+'.json'),observation);if(queued)queuePolls.push(observation);pending=answer.id;
     this.checkpoint.calls[step].pendingId=pending;this.checkpoint.calls[step].polls=n;this.persist();
     const wait=batch?BATCH_POLL_MS:5000;await (this.options.pause?.(wait)??new Promise<void>(resolve=>setTimeout(resolve,wait)));continue;
    }
    const value={wireSha256:claim.call.wireSha256,completed:true,result:answer.result},assetId=this.blob(value);
    // Persist/settle charged bytes BEFORE semantic/source revalidation, exactly as the production runtime.
    this.exclusive(this.callFile(step,'result.json'),{version:'engine-local-result/v1',claimSha256:canonicalHash(claim),assetId,assetSha256:canonicalHash(value),result:answer.result} satisfies Settlement);
    this.updateCheckpoint(step,claim,assetId,true);
    await this.options.assertCurrent();if(canonicalHash(plan.responseQueueTiming??null)!==timingSha)engineSiteFail('local_trial_queue_policy_changed');const m=await this.meter();if(m.blocked)engineSiteFail('local_trial_settled_hold');
    await plan.admitSaved(answer.result);return answer.result;
   }
  }finally{this.busy=false;}
 }
 private updateCheckpoint(step:string,claim:Claim,resultAssetId:string|undefined,settled:boolean){this.checkpoint.calls[step]={wireSha256:claim.call.wireSha256,requestAssetId:claim.requestAssetId,deadlineAt:claim.deadlineAt,polls:this.checkpoint.calls[step]?.polls??0,settled,...(resultAssetId?{resultAssetId}:{}),...(this.checkpoint.calls[step]?.pendingId?{pendingId:this.checkpoint.calls[step].pendingId}:{})};this.persist();}
}
