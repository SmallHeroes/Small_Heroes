/** Synthetic terminal journals. They test admission/accounting, never attest to model-origin story quality. */
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {INITIAL_PARENT_STEPS,loadLocalParentEnvelope} from '../local-trial-continuation';
import {loadLocalPlanRecovery,localPlanRecoverySteps} from '../local-trial-plan-recovery';
import {engineRecipeSteps} from '../platform-policy';
import {authority} from './fixtures';
export const recoveryRead=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
export const recoveryWrite=(file:string,value:unknown)=>writeFileSync(file,JSON.stringify(value));
export const recoverySha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
export function syntheticPlanRecovery(){
 const dir=mkdtempSync(path.join(tmpdir(),'sh_plan_recovery_')),root=path.join(dir,'root-book'),child=path.join(dir,'child-book');
 const pin=(file:string)=>({file,sha256:recoverySha(file)});
 const base=authority('synthetic_plan_recovery');
 const rootAuthority={...base,purpose:'test' as const,entitlements:{narration:true,pdf:true},budget:{...base.budget,maximumMicroUsd:10_000_000,maximumCalls:121,steps:engineRecipeSteps()}};
 const rootGrant:LocalEngineGrant={version:'engine-local-book-grant/v1',fictional:true,source:{root:process.cwd(),head:base.sourceRevision,pins:[{path:'lib/engine-site/contract.ts',bytes:1,sha256:'a'.repeat(64)}]},
  profile:{file:path.join(dir,'profile.json'),sha256:'a'.repeat(64)},ownerApproval:{file:path.join(dir,'root-activation.json'),sha256:'b'.repeat(64)},credentials:{file:path.join(dir,'NOT-A-KEY.txt'),sha256:'c'.repeat(64)},
  directory:root,readerId:'synthetic-plan-recovery',approvalReference:base.orderId,approvedBy:'synthetic_owner',approvedAt:base.budget.approvedAt,maximumMicroUsd:10_000_000,maximumCalls:121,independentQA:'pending_owner_authorized_internal_trial',publicDelivery:false,realPayment:false};
 const rootFile=path.join(dir,'root-grant.json');recoveryWrite(rootFile,rootGrant);
 function journal(book:string,a:typeof rootAuthority,steps:readonly string[],carried:unknown){
  const j=path.join(book,'journal');mkdirSync(path.join(j,'assets'),{recursive:true});mkdirSync(path.join(j,'calls'));recoveryWrite(path.join(j,'carry.json'),carried);
  const cp:any={version:'engine-site-job/v1',authority:a,ownerId:'synthetic_owner',draftId:'d_syntheticrecovery',snapshotSha256:a.requestSha256,phase:'story',calls:{},outputs:{},waiting:null};
  const asset=(value:unknown)=>{const id=randomUUID();recoveryWrite(path.join(j,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value});return id;};
  const plans=new Map<string,any>();
  for(const step of steps){const callDir=path.join(j,'calls',step);mkdirSync(callDir);const wire={version:step==='story_author'?'engine-site-anthropic-author/v1':'engine-site-responses/v1',authoritySha256:canonicalHash(a),step,body:{synthetic:true}},call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:a.budget.steps.find(s=>s.id===step)!.maximumMicroUsd};
   const requestAssetId=asset({authoritySha256:canonicalHash(a),call,wire}),claim={version:'engine-local-claim/v1',authoritySha256:canonicalHash(a),call,requestAssetId,deadlineAt:10000};
   const raw=step==='story_author'?{model:'claude-opus-5-5',usage:{input_tokens:1,output_tokens:1,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard',speed:'standard',inference_geo:'global'}}:{id:'resp_synthetic',status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1,output_tokens:1},output_text:'{"synthetic":true}'};
   const result={output:{synthetic:true},raw,usable:true,estimatedMicroUsd:step==='story_author'?24:12},value={wireSha256:call.wireSha256,completed:true,result},id=asset(value);
   recoveryWrite(path.join(callDir,'claim.json'),claim);recoveryWrite(path.join(callDir,'result.json'),{version:'engine-local-result/v1',claimSha256:canonicalHash(claim),assetId:id,assetSha256:canonicalHash(value),result});
   cp.calls[step]={wireSha256:call.wireSha256,requestAssetId,deadlineAt:10000,polls:0,settled:true,resultAssetId:id};plans.set(step,{wire,call,result});
  }
  recoveryWrite(path.join(j,'checkpoint.json'),cp);return {j,cp,plans};
 }
 const r=journal(root,rootAuthority,INITIAL_PARENT_STEPS,null),rootStop=path.join(root,'STOP-synthetic.json');
 const meter={knownEstimateMicroUsd:84,accountedMicroUsd:84,logicalCalls:6,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,blocked:false};
 recoveryWrite(rootStop,{version:'engine-local-book-stop/v1',reason:'engine_storyboard_held',phase:'story',grantSha256:recoverySha(rootFile),meter});
 const rootExit=path.join(dir,'root-exit.json'),childExit=path.join(dir,'child-exit.json');for(const f of [rootExit,childExit])recoveryWrite(f,{code:1,childPid:123456789,outcomeExists:false});
 const seal=(book:string,file:string)=>{const rows:any[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else rows.push({path:path.relative(book,f).replace(/\\/g,'/'),bytes:readFileSync(f).length,sha256:recoverySha(f)});}};walk(book);recoveryWrite(file,{version:'engine-local-parent-evidence/v1',root:book,rows});};
 const rootIndex=path.join(dir,'root-index.json');seal(root,rootIndex);
 const childGrant:LocalEngineGrant={...rootGrant,directory:child,source:{...rootGrant.source,head:'b'.repeat(40)},continuation:{version:'engine-local-initial-hold-continuation/v1',parentGrant:pin(rootFile),parentStop:pin(rootStop),parentExit:pin(rootExit),parentEvidence:pin(rootIndex)}};
 const childFile=path.join(dir,'child-grant.json');recoveryWrite(childFile,childGrant);
 const parent=loadLocalParentEnvelope(childGrant,rootGrant),childAuthority={...rootAuthority,sourceRevision:childGrant.source.head,policySha256:'e'.repeat(64),budget:{...rootAuthority.budget,steps:engineRecipeSteps({initialStoryboardRecovery:true}).filter(s=>!INITIAL_PARENT_STEPS.includes(s.id))}};
 const c=journal(child,childAuthority,['initial_storyboard_repair_1'],parent.carried),stopFile=path.join(child,'STOP-synthetic.json');
 const stop={version:'engine-local-book-stop/v1',reason:'storyboard_self_check_grounding_quote',phase:'story',grantSha256:recoverySha(childFile),meter:{...meter,accountedMicroUsd:96,knownEstimateMicroUsd:96,logicalCalls:7,carriedMicroUsd:84,carriedCalls:6}};recoveryWrite(stopFile,stop);
 const childIndex=path.join(dir,'child-index.json');seal(child,childIndex);
 const master=path.join(dir,'consent-global.claim.json');
 const rootBinding={version:'engine-local-book-claim/v1',grantFile:rootFile,grantSha256:recoverySha(rootFile),authoritySha256:canonicalHash(rootAuthority),directory:root,sourceRoot:rootGrant.source.root};
 const childBinding={version:'engine-local-book-claim/v1',grantFile:childFile,grantSha256:recoverySha(childFile),authoritySha256:canonicalHash(childAuthority),directory:child,sourceRoot:childGrant.source.root,parentGrantSha256:recoverySha(rootFile),carried:parent.carried};
 recoveryWrite(master,rootBinding);recoveryWrite(master+'.continuation.json',childBinding);
 const grant:LocalEngineGrant={...rootGrant,directory:path.join(dir,'next-book'),source:{...rootGrant.source,head:'c'.repeat(40)},responseSchemaPolicy:'json-schema-null/v1',planningRecovery:{version:'engine-local-plan-recovery/v1',
  parentGrant:pin(childFile),parentStop:pin(stopFile),parentExit:pin(childExit),parentEvidence:pin(childIndex),rootClaimSha256:recoverySha(master),parentClaimSha256:recoverySha(master+'.continuation.json'),boundary:'plan_review_only'}};
 const nextAuthority={...rootAuthority,responseSchemaPolicy:'json-schema-null/v1' as const,sourceRevision:grant.source.head,policySha256:'f'.repeat(64),budget:{...rootAuthority.budget,steps:localPlanRecoverySteps()}};
 const reseal=()=>{seal(child,childIndex);grant.planningRecovery!.parentEvidence=pin(childIndex);grant.planningRecovery!.parentStop=pin(stopFile);grant.planningRecovery!.parentExit=pin(childExit);};
 const load=()=>loadLocalPlanRecovery(grant,childGrant,parent,childAuthority,master);
 return {dir,root,child,master,rootBinding,childBinding,rootGrant,childGrant,childFile,grant,parent,childAuthority,nextAuthority,childJournal:c,rootJournal:r,stopFile,stop,childExit,childIndex,load,reseal,journal,seal};
}
