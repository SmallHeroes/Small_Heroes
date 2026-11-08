/** Synthetic, fully settled ancestor chain. No claim of model quality; raw producer is probed separately. */
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalHash} from '@/lib/canonical-json';
import {ENGINE_STORYBOARD_BINDING,ENGINE_BOUND_REVIEW_STEP} from '../storyboard-binding-policy';
import {LOCATION_SHEET_PROJECTION} from '@/lib/personal-wizard/location-sheet-projection';
import {localChildBindingSteps,loadLocalChildBinding} from '../local-trial-child-binding';
import {localLocationRepairSteps,loadLocalLocationRepair} from '../local-trial-location-repair';
import {syntheticSupportedPlan} from './local-supported-plan-fixture';
import {recoveryRead as read,recoveryWrite as write,recoverySha as sha} from './local-plan-recovery-fixture';
export function syntheticLocationRepair(){
 const s=syntheticSupportedPlan(),media=s.loadMedia(),parent=s.grant,parentAuthority=s.authority,parentFile=path.join(s.dir,'held-media-grant.json');write(parentFile,parent);
 const pin=(file:string)=>({file,sha256:sha(file)}),steps=['reference_child','reference_child_style_qa','reference_child_qa','prep_storyboard_0','prep_storyboard_0_review'],j=s.journal(parent.directory,parentAuthority as any,steps,media.carried);
 const imageResult=(book:string,step:string)=>{const f=path.join(book,'journal/calls',step,'result.json'),r=read(f),af=path.join(book,'journal/assets',r.assetId+'.json'),ar=read(af);
  r.result.raw={usage:{input_tokens:1,output_tokens:1}};r.result.model='gpt-image-2';r.result.estimatedMicroUsd=38;ar.value.result=r.result;ar.sha256=canonicalHash(ar.value);r.assetSha256=canonicalHash(ar.value);write(f,r);write(af,ar);};
 imageResult(parent.directory,'reference_child');
 const meter14={accountedMicroUsd:206,knownEstimateMicroUsd:206,logicalCalls:14,carriedMicroUsd:120,carriedCalls:9,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,lostLocalCalls:0,blocked:false};
 const stopFile=path.join(parent.directory,'STOP.json'),exitFile=path.join(s.dir,'held-media-exit.json'),indexFile=path.join(s.dir,'held-media-index.json');
 write(stopFile,{version:'engine-local-book-stop/v1',reason:'engine_storyboard_held',phase:'story',grantSha256:sha(parentFile),meter:meter14});write(path.join(parent.directory,'RUNNING.json'),{pid:123456789,grantSha256:sha(parentFile)});write(exitFile,{code:1,signal:null,childPid:123456789,outcomeExists:false});
 const mediaBinding={version:'engine-local-book-claim/v1',grantFile:parentFile,grantSha256:sha(parentFile),authoritySha256:canonicalHash(parentAuthority),directory:parent.directory,sourceRoot:parent.source.root,mediaContinuation:parent.mediaContinuation,carried:media.carried,boundary:'media_only'};
 write(s.master+'.media-continuation-v1.json',mediaBinding);
 for(const step of steps){const claim=read(path.join(j.j,'calls',step,'claim.json'));write(s.master+'.media-continuation-v1.'+step+'.dispatch.json',{version:'engine-local-media-dispatch/v1',executionSha256:canonicalHash(mediaBinding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd});}
 s.seal(parent.directory,indexFile);
 const boundGrant={...parent,directory:path.join(s.dir,'bound-media'),source:{...parent.source,head:'2'.repeat(40)},mediaContinuation:undefined,storyboardBindingPolicy:ENGINE_STORYBOARD_BINDING,
  childBindingContinuation:{version:'engine-local-child-binding-continuation/v1' as const,parentGrant:pin(parentFile),parentStop:pin(stopFile),parentExit:pin(exitFile),parentEvidence:pin(indexFile),parentClaimSha256:sha(s.master+'.media-continuation-v1.json'),boundary:'bound_media_only' as const}};
 const boundAuthority={...parentAuthority,storyboardBindingPolicy:ENGINE_STORYBOARD_BINDING,sourceRevision:boundGrant.source.head,policySha256:'3'.repeat(64),budget:{...parentAuthority.budget,steps:localChildBindingSteps()}},child=loadLocalChildBinding(boundGrant,parent,media,parentAuthority,s.master);
 const boundFile=path.join(s.dir,'held-sheets-grant.json');write(boundFile,boundGrant);
 const newSteps=[ENGINE_BOUND_REVIEW_STEP,'sheet_entities_0','sheet_entities_0_qa','sheet_locations_0','sheet_locations_0_qa'],k=s.journal(boundGrant.directory,boundAuthority as any,newSteps,child.carried);
 for(const step of ['sheet_entities_0','sheet_locations_0'])imageResult(boundGrant.directory,step);
 k.cp.phase='native';const id=randomUUID(),value={synthetic:true};k.cp.outputs.prepared_source=id;write(path.join(k.j,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(value),value});write(path.join(k.j,'checkpoint.json'),k.cp);
 const meter={...meter14,accountedMicroUsd:318,knownEstimateMicroUsd:318,logicalCalls:19,carriedMicroUsd:206,carriedCalls:14};
 const heldStop={version:'engine-local-book-stop/v1',reason:'engine_reference_sheet_held',phase:'native',grantSha256:sha(boundFile),meter},heldStopFile=path.join(boundGrant.directory,'STOP.json'),heldExitFile=path.join(s.dir,'held-sheets-exit.json'),heldIndexFile=path.join(s.dir,'held-sheets-index.json');
 write(heldStopFile,heldStop);write(path.join(boundGrant.directory,'RUNNING.json'),{pid:123456789,grantSha256:sha(boundFile)});write(heldExitFile,{code:1,signal:null,childPid:123456789,outcomeExists:false});
 const parentBinding={version:'engine-local-book-claim/v1',grantFile:boundFile,grantSha256:sha(boundFile),authoritySha256:canonicalHash(boundAuthority),directory:boundGrant.directory,sourceRoot:boundGrant.source.root,childBindingContinuation:boundGrant.childBindingContinuation,carried:child.carried,boundary:'bound_media_only'};
 write(s.master+'.child-binding-v1.json',parentBinding);
 for(const step of newSteps){const claim=read(path.join(k.j,'calls',step,'claim.json'));write(s.master+'.child-binding-v1.'+step+'.dispatch.json',{version:'engine-local-child-binding-dispatch/v1',executionSha256:canonicalHash(parentBinding),authoritySha256:canonicalHash(boundAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd});}
 s.seal(boundGrant.directory,heldIndexFile);
 const ownerFile=path.join(s.dir,'NOT-A-REAL-OWNER-AUTHORITY.json'),owner={oneLocationsRepairOnly:true,maximumNewReferenceCalls:2,maximumNewReferenceReservedMicroUsd:1400000,maximumTotalMicroUsd:10000000,maximumTotalCalls:121,independentCodeAndExactEnvelopePASSRequired:true};write(ownerFile,owner);
 const grant={...boundGrant,directory:path.join(s.dir,'repair-book'),childBindingContinuation:undefined,source:{...boundGrant.source,head:'4'.repeat(40)},locationSheetPolicy:LOCATION_SHEET_PROJECTION,
  locationsRepairContinuation:{version:'engine-local-locations-repair/v1' as const,parentGrant:pin(boundFile),parentStop:pin(heldStopFile),parentExit:pin(heldExitFile),parentEvidence:pin(heldIndexFile),parentClaimSha256:sha(s.master+'.child-binding-v1.json'),ownerAttemptAuthority:pin(ownerFile),boundary:'one_locations_repair_then_media' as const}};
 const authority={...boundAuthority,locationSheetPolicy:LOCATION_SHEET_PROJECTION,sourceRevision:grant.source.head,policySha256:'5'.repeat(64),budget:{...boundAuthority.budget,steps:localLocationRepairSteps()}};
 const resealHeld=()=>{s.seal(boundGrant.directory,heldIndexFile);Object.assign(grant.locationsRepairContinuation,{parentGrant:pin(boundFile),parentStop:pin(heldStopFile),parentExit:pin(heldExitFile),parentEvidence:pin(heldIndexFile),ownerAttemptAuthority:pin(ownerFile)});};
 return {...s,child,boundGrant,boundAuthority,boundFile,heldStop,heldStopFile,heldExitFile,heldIndexFile,sheetJournal:k,owner,ownerFile,repairGrant:grant,repairAuthority:authority,resealHeld,loadRepair:()=>loadLocalLocationRepair(grant,boundGrant,child,boundAuthority,s.master)};
}
