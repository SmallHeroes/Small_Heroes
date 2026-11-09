/** Synthetic settled metadata only. Real source/producer replay is a separate provider-denied gate. */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { LOCATION_SHEET_PROJECTION_V2 } from '@/lib/personal-wizard/location-sheet-projection';
import { localLocationV2RepairSteps, loadLocalLocationV2Repair } from '../local-trial-location-repair-v2';
import { syntheticLocationRepair } from './local-location-repair-fixture';
import { recoveryRead as read, recoveryWrite as write, recoverySha as sha } from './local-plan-recovery-fixture';

export function syntheticLocationV2Repair(){
  const s=syntheticLocationRepair(),repair=s.loadRepair(),parent=s.repairGrant,parentAuthority=s.repairAuthority,parentFile=path.join(s.dir,'v1-locations-parent-grant.json');write(parentFile,parent);
  const steps=['sheet_locations_1','sheet_locations_1_qa'],journal=s.journal(parent.directory,parentAuthority as any,steps,repair.carried);
  const rf=path.join(parent.directory,'journal/calls/sheet_locations_1/result.json'),result=read(rf),af=path.join(parent.directory,'journal/assets',result.assetId+'.json'),asset=read(af);
  result.result.raw={usage:{input_tokens:1,output_tokens:1}};result.result.model='gpt-image-2';result.result.estimatedMicroUsd=38;asset.value.result=result.result;asset.sha256=canonicalHash(asset.value);result.assetSha256=canonicalHash(asset.value);write(rf,result);write(af,asset);
  const cp=journal.cp,id=randomUUID(),prepared={synthetic:true};cp.phase='native';cp.outputs.prepared_source=id;write(path.join(journal.j,'assets',id+'.json'),{version:'engine-local-asset/v1',id,sha256:canonicalHash(prepared),value:prepared});write(path.join(journal.j,'checkpoint.json'),cp);
  const meter={accountedMicroUsd:368,knownEstimateMicroUsd:368,logicalCalls:21,carriedMicroUsd:318,carriedCalls:19,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,lostLocalCalls:0,blocked:false};
  const stopFile=path.join(parent.directory,'STOP.json'),exitFile=path.join(s.dir,'v1-locations-parent-exit.json'),indexFile=path.join(s.dir,'v1-locations-parent-index.json');
  write(stopFile,{version:'engine-local-book-stop/v1',reason:'engine_reference_sheet_held',phase:'native',grantSha256:sha(parentFile),meter});write(path.join(parent.directory,'RUNNING.json'),{pid:123456789,grantSha256:sha(parentFile)});write(exitFile,{code:1,signal:null,childPid:123456789,outcomeExists:false});
  const parentBinding={version:'engine-local-book-claim/v1',grantFile:parentFile,grantSha256:sha(parentFile),authoritySha256:canonicalHash(parentAuthority),directory:parent.directory,sourceRoot:parent.source.root,locationsRepairContinuation:parent.locationsRepairContinuation,carried:repair.carried,boundary:'one_locations_repair_then_media'};
  write(s.master+'.locations-repair-v1.json',parentBinding);for(const step of steps){const claim=read(path.join(journal.j,'calls',step,'claim.json'));write(s.master+'.locations-repair-v1.'+step+'.dispatch.json',{version:'engine-local-locations-repair-dispatch/v1',executionSha256:canonicalHash(parentBinding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd});}
  s.seal(parent.directory,indexFile);
  const ownerFile=path.join(s.dir,'NOT-A-REAL-V2-OWNER-AUTHORITY.json'),owner={oneAdditionalLocationsRepairOnly:true,previousAttempt:1,nextAttempt:2,quality:'low',targetImageSha256:'a'.repeat(64),maximumNewReferenceCalls:2,maximumNewReferenceReservedMicroUsd:1400000,maximumTotalMicroUsd:10000000,maximumTotalCalls:121,independentCodeAndExactEnvelopePASSRequired:true,stopOnFurtherHold:true};write(ownerFile,owner);
  const pin=(file:string)=>({file,sha256:sha(file)}),grant={...parent,directory:path.join(s.dir,'v2-locations-book'),source:{...parent.source,head:'6'.repeat(40)},locationsRepairContinuation:undefined,locationSheetPolicy:LOCATION_SHEET_PROJECTION_V2,
    locationsV2RepairContinuation:{version:'engine-local-locations-v2-repair/v1' as const,parentGrant:pin(parentFile),parentStop:pin(stopFile),parentExit:pin(exitFile),parentEvidence:pin(indexFile),parentClaimSha256:sha(s.master+'.locations-repair-v1.json'),ownerAttemptAuthority:pin(ownerFile),boundary:'one_locations_v2_repair_then_media' as const}};
  const authority={...parentAuthority,locationSheetPolicy:LOCATION_SHEET_PROJECTION_V2,sourceRevision:grant.source.head,policySha256:'7'.repeat(64),budget:{...parentAuthority.budget,steps:localLocationV2RepairSteps()}};
  const reseal=()=>{s.seal(parent.directory,indexFile);Object.assign(grant.locationsV2RepairContinuation,{parentGrant:pin(parentFile),parentStop:pin(stopFile),parentExit:pin(exitFile),parentEvidence:pin(indexFile),ownerAttemptAuthority:pin(ownerFile)});};
  return{...s,repair,parent,parentAuthority,parentFile,journal,stopFile,exitFile,indexFile,meter,owner,ownerFile,grant,authority,reseal,load:()=>loadLocalLocationV2Repair(grant,parent,repair,parentAuthority,s.master)};
}
