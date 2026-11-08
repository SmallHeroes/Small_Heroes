/** Synthetic settled terminal plan. It proves admission/fences, not model-origin quality. */
import path from 'node:path';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {loadLocalSupportedPlan,localSupportedMediaSteps} from '../local-trial-supported-plan';
import {localPlanRecoverySteps} from '../local-trial-plan-recovery';
import {syntheticPlanRecovery,recoveryWrite as write,recoveryRead as read,recoverySha as sha} from './local-plan-recovery-fixture';

export function syntheticSupportedPlan(){
 const s=syntheticPlanRecovery(),recovery=s.load(),parent=s.grant,parentAuthority=s.nextAuthority,parentFile=path.join(s.dir,'supported-plan-grant.json');write(parentFile,parent);
 const pin=(file:string)=>({file,sha256:sha(file)}),j=s.journal(parent.directory,parentAuthority,localPlanRecoverySteps().map(s=>s.id),recovery.carried);
 const value={version:'engine-local-plan-result/v1',status:'plan_review_supported',source:{synthetic:true},readings:[],draft:{synthetic:true},diagnostic:{status:'review_supported'},
  previousAttempts:2,attempt:3,maximumAttempts:3,carried:recovery.carried,illustrationsCreated:0,narrationCreated:0,bookCreated:false,productAccepted:false,independentQA:'pending'};
 // The journal helper uses one synthetic 12-microUSD raw result for each of the 2 calls.
 const meter={accountedMicroUsd:120,knownEstimateMicroUsd:120,logicalCalls:9,carriedMicroUsd:96,carriedCalls:7,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,lostLocalCalls:0,blocked:false};
 const outcome={...value,version:'engine-local-plan-outcome/v1',grantSha256:sha(parentFile),authoritySha256:canonicalHash(parentAuthority),sourceRevision:parent.source.head,productionQualified:false,meter};
 const settled=read(path.join(j.j,'calls/initial_storyboard_repair_2_review/result.json')),record=read(path.join(j.j,'assets',settled.assetId+'.json'));
 // Reuse an asset id only as the checkpoint's synthetic recovery_plan. It remains separate from result bytes.
 const planAsset=record.id.replace(/^./,record.id[0]==='a'?'b':'a');write(path.join(j.j,'assets',planAsset+'.json'),{version:'engine-local-asset/v1',id:planAsset,sha256:canonicalHash(value),value});
 j.cp.outputs.recovery_plan=planAsset;write(path.join(j.j,'checkpoint.json'),j.cp);
 const outcomeFile=path.join(parent.directory,'PLAN-OUTCOME.json'),exitFile=path.join(s.dir,'supported-plan-exit.json'),indexFile=path.join(s.dir,'supported-plan-index.json');
 write(outcomeFile,outcome);write(path.join(parent.directory,'RUNNING.json'),{pid:123456789,grantSha256:sha(parentFile)});write(exitFile,{code:0,signal:null,childPid:123456789,planOutcomeExists:true});
 const binding={version:'engine-local-book-claim/v1',grantFile:parentFile,grantSha256:sha(parentFile),authoritySha256:canonicalHash(parentAuthority),directory:parent.directory,sourceRoot:parent.source.root,
  planningRecovery:parent.planningRecovery,carried:recovery.carried,attempt:3,maximumAttempts:3,boundary:'plan_review_only'};
 write(s.master+'.plan-recovery-v1.json',binding);
 for(const [step,plan] of j.plans){const claim=read(path.join(j.j,'calls',step,'claim.json'));write(s.master+'.plan-recovery-v1.'+step+'.dispatch.json',
  {version:'engine-local-plan-dispatch/v1',executionSha256:canonicalHash(binding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:plan.call.maximumMicroUsd});}
 s.seal(parent.directory,indexFile);
 const grant:LocalEngineGrant={...parent,directory:path.join(s.dir,'media-book'),source:{...parent.source,head:'d'.repeat(40)},planningRecovery:undefined,
  mediaContinuation:{version:'engine-local-supported-plan-continuation/v1',parentGrant:pin(parentFile),parentOutcome:pin(outcomeFile),parentExit:pin(exitFile),parentEvidence:pin(indexFile),recoveryClaimSha256:sha(s.master+'.plan-recovery-v1.json'),boundary:'media_only'}};
 const reseal=()=>{s.seal(parent.directory,indexFile);Object.assign(grant.mediaContinuation!,{parentGrant:pin(parentFile),parentOutcome:pin(outcomeFile),parentExit:pin(exitFile),parentEvidence:pin(indexFile)});};
 const authority={...parentAuthority,sourceRevision:grant.source.head,policySha256:'1'.repeat(64),budget:{...parentAuthority.budget,steps:localSupportedMediaSteps()}};
 return {...s,recovery,parentPlan:parent,parentFile,parentAuthority,grant,outcome,outcomeFile,exitFile,indexFile,binding,planJournal:j,planAsset,planValue:value,meter,authority,reseal,
  loadMedia:()=>loadLocalSupportedPlan(grant,parent,recovery,parentAuthority,s.master)};
}
