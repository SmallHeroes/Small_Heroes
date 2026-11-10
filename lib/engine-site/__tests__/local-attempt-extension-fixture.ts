/** Synthetic settled third-attempt book, exclusively under an owned TEMP root. */
import {randomUUID} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {syntheticCurrentFinalPlan,finalWrite as write} from './local-final-plan-fixture';
import {claimLocalCurrentFinalPlan} from '../local-trial-final-plan';
import {loadLocalAttemptExtension,localAttemptExtensionSteps} from '../local-trial-attempt-extension';

export function syntheticAttemptExtension(){
 const s=syntheticCurrentFinalPlan(true,true),prior=s.load(),failed=s.g,a=s.nextAuthority,root=failed.directory,j=path.join(root,'journal');
 mkdirSync(path.join(j,'assets'),{recursive:true});mkdirSync(path.join(j,'calls'));
 const cp:any={...s.cp,authority:a,calls:{},outputs:{}};
 const asset=(value:unknown)=>{const id=randomUUID();write(path.join(j,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value});return id;};
 for(const step of ['initial_storyboard_repair_2','initial_storyboard_repair_2_review']){
  const d=path.join(j,'calls',step);mkdirSync(d);const wire={version:'engine-site-responses/v1',step,authoritySha256:canonicalHash(a),body:{synthetic:true}},call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:1200000};
  const requestAssetId=asset({authoritySha256:canonicalHash(a),call,wire}),claim={version:'engine-local-claim/v1',authoritySha256:canonicalHash(a),call,requestAssetId,deadlineAt:10000};
  const result={output:{synthetic:true},raw:{model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1,output_tokens:1}},usable:true,estimatedMicroUsd:12},value={wireSha256:call.wireSha256,completed:true,result},id=asset(value);
  write(path.join(d,'claim.json'),claim);write(path.join(d,'result.json'),{version:'engine-local-result/v1',claimSha256:canonicalHash(claim),assetId:id,assetSha256:canonicalHash(value),result});
  cp.calls[step]={wireSha256:call.wireSha256,requestAssetId,deadlineAt:10000,polls:0,settled:true,resultAssetId:id};
 }
 write(path.join(j,'checkpoint.json'),cp);write(path.join(j,'carry.json'),prior.carried);
 const rec=(name:string,value:unknown)=>{const f=path.join(s.dir,name);write(f,value);return s.pin(f);},failedRef=rec('failed-final-grant.json',failed);
 const binding={version:'engine-local-book-claim/v1',grantFile:failedRef.file,grantSha256:failedRef.sha256,authoritySha256:canonicalHash(a),directory:root,sourceRoot:failed.source.root,
  currentFinalPlanSha256:canonicalHash(failed.currentFinalPlan),parentGrantSha256:failed.currentFinalPlan!.parentGrant.sha256,carried:prior.carried,attempt:3,maximumAttempts:3,boundary:'final_base_plan_then_native_book'};
 claimLocalCurrentFinalPlan(prior,binding,false,s.master);
 const stopFile=path.join(root,'STOP-final.json'),stop={version:'engine-local-book-stop/v1',at:'2026-11-09T12:01:00.000Z',reason:'engine_storyboard_held',phase:'story',grantSha256:failedRef.sha256,meter:{knownEstimateMicroUsd:132,accountedMicroUsd:132,logicalCalls:10,carriedMicroUsd:108,carriedCalls:8,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,blocked:false}};write(stopFile,stop);
 const start=rec('final-start.json',{pid:2000000005,childPid:2000000004,at:'2026-11-09T12:00:00.000Z',grantSha256:failedRef.sha256,sourceHead:failed.source.head,envelope:rec('final-envelope.json',{synthetic:true})});
 const exit=rec('final-exit.json',{at:'2026-11-09T12:01:01.000Z',childPid:2000000004,code:1,signal:null,outcomeExists:false,supervisorExitCode:1,completionStatus:'native_failed',completionReason:'native_exit_failure'});
 const index=path.join(s.dir,'final-index.json'),goFile=path.join(s.dir,'NEW-STAGE-OWNER-GO.json'),approvalFile=path.join(s.dir,'NEW-STAGE-APPROVAL.json');
 const scope={version:'engine-local-attempt-approval/v1',stage:'initial_storyboard',fromAttempt:3,toAttempt:4,maximumAttempts:4,sourceRoot:failed.source.root,sourceHead:'d'.repeat(40),parentGrantSha256:failedRef.sha256,rootConsentSha256:'a'.repeat(64),requestSha256:a.requestSha256,optionsSha256:a.optionsSha256,directory:path.join(s.dir,'extension','book'),readerId:failed.readerId,ownerGoFile:goFile,maximumPlanningMicroUsd:2400000,maximumPlanningCalls:2,maximumTotalMicroUsd:12000000,maximumTotalCalls:121,furtherAttemptAllowed:false};write(approvalFile,scope);
 const go={version:'engine-local-attempt-owner-go/v1',kind:'new_explicit_owner_stage_extension_approval',approvedBy:'Guy',approvedAt:new Date().toISOString(),approvalSha256:s.pin(approvalFile).sha256,sourceHead:scope.sourceHead,parentGrantSha256:failedRef.sha256,attempt:4,maximumAttempts:4,maximumPlanningCalls:2,maximumPlanningMicroUsd:2400000,maximumTotalMicroUsd:12000000,maximumTotalCalls:121,ownerStatement:'SYNTHETIC QA ONLY: explicit one stage extension; no real spending approval.'};write(goFile,go);
 const g:LocalEngineGrant={...failed,currentFinalPlan:undefined,source:{...failed.source,head:scope.sourceHead},directory:scope.directory,currentAttemptExtension:{version:'engine-local-current-attempt-extension/v1',parentGrant:failedRef,parentStop:s.pin(stopFile),parentStart:start,parentExit:exit,parentEvidence:{file:index,sha256:'f'.repeat(64)},parentExecutionClaim:s.pin(prior.executionFile),parentGlobalClaim:s.pin(prior.globalFile),approval:s.pin(approvalFile)}};
 const reseal=()=>{const rows:{path:string;bytes:number;sha256:string}[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else rows.push({path:path.relative(root,f).replace(/\\/g,'/'),bytes:readFileSync(f).length,sha256:s.pin(f).sha256});}};walk(root);write(index,{version:'engine-local-parent-evidence/v1',root,rows});g.currentAttemptExtension={...g.currentAttemptExtension!,parentGrant:s.pin(failedRef.file),parentStop:s.pin(stopFile),parentStart:s.pin(start.file),parentExit:s.pin(exit.file),parentEvidence:s.pin(index),parentExecutionClaim:s.pin(prior.executionFile),parentGlobalClaim:s.pin(prior.globalFile),approval:s.pin(approvalFile)};};reseal();
 const nextAuthority={...a,sourceRevision:g.source.head,storyboardAttemptExtension:{version:'storyboard-attempt-extension/v1' as const,maxAttempts:4 as const,approvalSha256:s.pin(approvalFile).sha256},budget:{...a.budget,steps:localAttemptExtensionSteps()}};
 return {...s,root,j,cp,prior,failed,failedRef,failedAuthority:a,g,scope,go,goFile,approvalFile,stopFile,stop,start,exit,binding,nextAuthority,reseal,load:()=>loadLocalAttemptExtension(g,failed,a,prior)};
}
