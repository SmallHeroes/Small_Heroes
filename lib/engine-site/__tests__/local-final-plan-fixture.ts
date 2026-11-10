/** Owned TEMP receipts only. No paid book or real authority directory is written. */
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {INITIAL_PARENT_STEPS,loadLocalParentEnvelope} from '../local-trial-continuation';
import {loadLocalCurrentContinuation} from '../local-trial-current-continuation';
import {loadLocalCurrentFinalPlan,localCurrentFinalPlanSteps} from '../local-trial-final-plan';
import {authority} from './fixtures';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export const finalRead=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
export const finalWrite=(f:string,v:unknown)=>writeFileSync(f,JSON.stringify(v));
const read=finalRead,write=finalWrite;
function first(startup=false,consentMaster=false){
 const dir=mkdtempSync(path.join(realpathSync(tmpdir()),'sh_current_parent_'));
 const root=path.join(dir,'parent','book'),journal=path.join(root,'journal');mkdirSync(path.join(journal,'assets'),{recursive:true});mkdirSync(path.join(journal,'calls'));
 const pin=(file:string)=>({file,sha256:sha(readFileSync(file))});
 const record=(name:string,value:unknown)=>{const f=path.join(dir,name);write(f,value);return pin(f);};
 const imageModelPolicy={version:'image26-local-book/v1' as const,model:'gpt-image-2.6-sunburst' as const,complexity:'high' as const};
 const a={...authority('synthetic_current_book'),purpose:'test' as const,imageModelPolicy,budget:{...authority().budget,maximumMicroUsd:12000000,maximumCalls:121,steps:INITIAL_PARENT_STEPS.map(id=>({id,maximumMicroUsd:100000}))}};
 const prior:LocalEngineGrant={version:'engine-local-book-grant/v1',fictional:true,source:{root:realpathSync(process.cwd()),head:a.sourceRevision,pins:[{path:'synthetic.ts',bytes:1,sha256:'f'.repeat(64)}]},profile:{file:path.join(dir,'profile.json'),sha256:'a'.repeat(64)},ownerApproval:{file:path.join(dir,'activation.json'),sha256:'b'.repeat(64)},credentials:{file:path.join(dir,'never-read.txt'),sha256:'c'.repeat(64)},directory:root,readerId:'synthetic-current-book',approvalReference:a.orderId,approvedBy:'synthetic_owner',approvedAt:'2026-11-09T10:00:00.000Z',maximumMicroUsd:12000000,maximumCalls:121,independentQA:'pending_owner_authorized_internal_trial',publicDelivery:false,realPayment:false,freshBookPolicy:'fresh-current-policies/v1',imageModelPolicy,responseSchemaPolicy:'json-schema-null/v1',storyboardBindingPolicy:'accepted-board-child-binding/v1',locationSheetPolicy:'location-ownership-and-views/v2'};
 prior.ownerApproval=record('activation.json',{synthetic:'old activation'});
 const master=path.join(dir,consentMaster?'a'.repeat(64)+'.local-engine.claim.json':'master.json');
 if(startup){
  const old=path.join(dir,'zero-call-book');mkdirSync(old);write(path.join(old,'RUNNING.json'),{synthetic:true});
  const oldRef=record('old-record.json',{synthetic:true}),oldBook=record('old-tree.json',{root:old,rows:[{path:'RUNNING.json',bytes:readFileSync(path.join(old,'RUNNING.json')).length,sha256:sha(readFileSync(path.join(old,'RUNNING.json')))}]});
  write(master,{syntheticOldMaster:true});
  prior.startupRecovery={version:'engine-local-startup-cap-recovery/v1',boundary:'known_constructor_refusal_before_provider',parentGrant:oldRef,parentClaim:pin(master),parentEnvelope:oldRef,parentStart:oldRef,parentExit:oldRef,parentStderr:oldRef,parentStdout:oldRef,parentBook:oldBook};
 }
 const parentGrant=record('parent-grant.json',prior),binding={version:'engine-local-book-claim/v1',grantFile:parentGrant.file,grantSha256:parentGrant.sha256,authoritySha256:canonicalHash(a),directory:root,sourceRoot:prior.source.root,...(startup?{startupRecoverySha256:canonicalHash(prior.startupRecovery)}:{})};
 const execution=startup?master+'.startup-cap-recovery.json':master;write(execution,startup?{version:'engine-local-startup-cap-claim/v1',parentClaimSha256:prior.startupRecovery!.parentClaim.sha256,binding}:binding);
 const cp:any={version:'engine-site-job/v1',authority:a,ownerId:'synthetic_owner',draftId:'d_syntheticparent',snapshotSha256:a.requestSha256,phase:'story',calls:{},outputs:{},waiting:null};
 const asset=(value:unknown)=>{const id=randomUUID();write(path.join(journal,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value});return id;};
 for(const step of INITIAL_PARENT_STEPS){
  const d=path.join(journal,'calls',step);mkdirSync(d);const wire={version:step==='story_author'?'engine-site-anthropic-author/v1':'engine-site-responses/v1',step,authoritySha256:canonicalHash(a),body:{synthetic:true}},call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:100000};
  const requestAssetId=asset({authoritySha256:canonicalHash(a),call,wire}),claim={version:'engine-local-claim/v1',authoritySha256:canonicalHash(a),call,requestAssetId,deadlineAt:10000};
  const raw=step==='story_author'?{model:'claude-opus-5-5',usage:{input_tokens:1,output_tokens:1,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard',speed:'standard',inference_geo:'global'}}:{model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1,output_tokens:1}};
  const result={output:{synthetic:true},raw,usable:true,estimatedMicroUsd:step==='story_author'?24:12},value={wireSha256:call.wireSha256,completed:true,result},id=asset(value);
  write(path.join(d,'claim.json'),claim);write(path.join(d,'result.json'),{version:'engine-local-result/v1',claimSha256:canonicalHash(claim),assetId:id,assetSha256:canonicalHash(value),result});
  cp.calls[step]={wireSha256:call.wireSha256,requestAssetId,deadlineAt:10000,polls:0,settled:true,resultAssetId:id};
 }
 write(path.join(journal,'checkpoint.json'),cp);
 const stopFile=path.join(root,'STOP-synthetic.json'),stop={version:'engine-local-book-stop/v1',at:'2026-11-09T10:01:00.000Z',reason:'engine_storyboard_held',phase:'story',grantSha256:parentGrant.sha256,meter:{knownEstimateMicroUsd:84,accountedMicroUsd:84,logicalCalls:6,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0}};write(stopFile,stop);
 const start=record('start.json',{pid:2000000001,childPid:2000000000,at:'2026-11-09T10:00:00.000Z',grantSha256:parentGrant.sha256,sourceHead:prior.source.head,envelope:record('envelope.json',{synthetic:'old execution envelope'})});
 const exit=record('exit.json',{at:'2026-11-09T10:01:01.000Z',childPid:2000000000,code:1,signal:null,outcomeExists:false,supervisorExitCode:1,completionStatus:'native_failed',completionReason:'native_exit_failure'});
 const index=path.join(dir,'index.json');
 const g:LocalEngineGrant={...prior,freshBookPolicy:undefined,startupRecovery:undefined,source:{...prior.source,head:'b'.repeat(40)},directory:path.join(dir,'child','book'),currentContinuation:{version:'engine-local-current-initial-hold/v1',parentGrant,parentStop:pin(stopFile),parentExit:exit,parentEvidence:{file:index,sha256:'f'.repeat(64)},parentStart:start,parentExecutionClaim:pin(execution)}};
 const seal=()=>{const rows:{path:string;bytes:number;sha256:string}[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else rows.push({path:path.relative(root,f).replace(/\\/g,'/'),bytes:readFileSync(f).length,sha256:sha(readFileSync(f))});}};walk(root);write(index,{version:'engine-local-parent-evidence/v1',root,rows});Object.assign(g.currentContinuation!,{parentGrant:pin(parentGrant.file),parentStop:pin(stopFile),parentEvidence:pin(index),parentStart:pin(start.file),parentExit:pin(exit.file),parentExecutionClaim:pin(execution)});};seal();
 const load=()=>{const parent=loadLocalParentEnvelope(g,prior);return{parent,current:loadLocalCurrentContinuation(g,parent,master)};};
 return{dir,root,g,prior,master,execution,start,exit,stop,stopFile,journal,seal,pin,load};
}

export function syntheticCurrentFinalPlan(startup=true,consentMaster=false){
 const s=first(startup,consentMaster),{parent,current}=s.load(),failed=s.g,root=failed.directory,j=path.join(root,'journal');
 mkdirSync(path.join(j,'assets'),{recursive:true});mkdirSync(path.join(j,'calls'));
 const a={...parent.authority,sourceRevision:failed.source.head,responseSchemaPolicy:failed.responseSchemaPolicy,storyboardBindingPolicy:failed.storyboardBindingPolicy,locationSheetPolicy:failed.locationSheetPolicy,
  budget:{...parent.authority.budget,steps:['initial_storyboard_repair_1','initial_storyboard_repair_1_review'].map(id=>({id,maximumMicroUsd:1200000}))}};
 const cp:any={...parent.checkpoint,authority:a,calls:{},outputs:{}};
 const asset=(value:unknown)=>{const id=randomUUID();write(path.join(j,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value});return id;};
 for(const step of a.budget.steps.map(x=>x.id)){
  const d=path.join(j,'calls',step);mkdirSync(d);const wire={version:'engine-site-responses/v1',step,authoritySha256:canonicalHash(a),body:{synthetic:true}},call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:1200000};
  const requestAssetId=asset({authoritySha256:canonicalHash(a),call,wire}),claim={version:'engine-local-claim/v1',authoritySha256:canonicalHash(a),call,requestAssetId,deadlineAt:10000};
  const result={output:{synthetic:true},raw:{model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1,output_tokens:1}},usable:true,estimatedMicroUsd:12},value={wireSha256:call.wireSha256,completed:true,result},id=asset(value);
  write(path.join(d,'claim.json'),claim);write(path.join(d,'result.json'),{version:'engine-local-result/v1',claimSha256:canonicalHash(claim),assetId:id,assetSha256:canonicalHash(value),result});
  cp.calls[step]={wireSha256:call.wireSha256,requestAssetId,deadlineAt:10000,polls:0,settled:true,resultAssetId:id};
 }
 write(path.join(j,'checkpoint.json'),cp);write(path.join(j,'carry.json'),parent.carried);
 const failedRef=(()=>{const f=path.join(s.dir,'failed-current-grant.json');write(f,failed);return s.pin(f);})();
 const binding={version:'engine-local-book-claim/v1',grantFile:failedRef.file,grantSha256:failedRef.sha256,authoritySha256:canonicalHash(a),directory:root,sourceRoot:failed.source.root,
  parentGrantSha256:failed.currentContinuation!.parentGrant.sha256,carried:parent.carried,currentContinuationSha256:canonicalHash(failed.currentContinuation),boundary:'one_initial_repair_then_media'};
 current.claim(binding,false,s.master);
 const rec=(name:string,value:unknown)=>{const f=path.join(s.dir,name);write(f,value);return s.pin(f);};
 const stopFile=path.join(root,'STOP-current.json'),stop={version:'engine-local-book-stop/v1',at:'2026-11-09T11:01:00.000Z',reason:'engine_storyboard_held',phase:'story',grantSha256:failedRef.sha256,
  meter:{knownEstimateMicroUsd:108,accountedMicroUsd:108,logicalCalls:8,carriedMicroUsd:84,carriedCalls:6,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,blocked:false}};write(stopFile,stop);
 const start=rec('current-start.json',{pid:2000000003,childPid:2000000002,at:'2026-11-09T11:00:00.000Z',grantSha256:failedRef.sha256,sourceHead:failed.source.head,envelope:rec('current-envelope.json',{synthetic:true})});
 const exit=rec('current-exit.json',{at:'2026-11-09T11:01:01.000Z',childPid:2000000002,code:1,signal:null,outcomeExists:false,supervisorExitCode:1,completionStatus:'native_failed',completionReason:'native_exit_failure'});
 const index=path.join(s.dir,'current-index.json');
 const g:LocalEngineGrant={...failed,source:{...failed.source,head:'c'.repeat(40)},directory:path.join(s.dir,'final','book'),currentContinuation:undefined,currentFinalPlan:{version:'engine-local-current-final-plan-book/v1',parentGrant:failedRef,parentStart:start,parentExit:exit,parentStop:s.pin(stopFile),parentEvidence:{file:index,sha256:'f'.repeat(64)},parentExecutionClaim:s.pin(current.executionFile),parentGlobalClaim:s.pin(s.master+'.continuation.json')}};
 const reseal=()=>{const rows:{path:string;bytes:number;sha256:string}[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else rows.push({path:path.relative(root,f).replace(/\\/g,'/'),bytes:readFileSync(f).length,sha256:sha(readFileSync(f))});}};walk(root);write(index,{version:'engine-local-parent-evidence/v1',root,rows});
  g.currentFinalPlan={...g.currentFinalPlan!,parentGrant:s.pin(failedRef.file),parentStop:s.pin(stopFile),parentStart:s.pin(start.file),parentExit:s.pin(exit.file),parentEvidence:s.pin(index),parentExecutionClaim:s.pin(current.executionFile),parentGlobalClaim:s.pin(s.master+'.continuation.json')};};reseal();
 const nextAuthority={...a,sourceRevision:g.source.head,budget:{...a.budget,steps:localCurrentFinalPlanSteps()}};
 return {...s,original:s,root,j,cp,failed,g,stopFile,stop,start,exit,parent,current,failedRef,binding,failedAuthority:a,nextAuthority,reseal,
  load:()=>loadLocalCurrentFinalPlan(g,failed,parent,a,current)};
}
