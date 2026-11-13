/** Bounded local sheet continuations. Historical receipts and the prepared source are read-only. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {PrismaClient} from '@prisma/client';
import {canonicalHash} from '@/lib/canonical-json';
import {exhaustedFrameEditParent,type AuditionAttempt,type ExhaustedFrameEdit} from '@/lib/personal-wizard/simple-book-reviewed-audition';
import {PICTURE_BOOK_CONCISE_REVIEW,PICTURE_BOOK_LANDMARK_REPORTING,PICTURE_BOOK_SCALE_REPORTING,PICTURE_BOOK_SPATIAL_STAGING} from '@/lib/personal-wizard/picture-book-direction';
import {auditionUsageCost} from '@/scripts/personal-simple-book-illustrator';
import {anthropicAuthorCost} from './anthropic-author';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {ENGINE_CURRENT_CUSTOMER_V2,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V4,ENGINE_CURRENT_CUSTOMER_V5,ENGINE_CURRENT_CUSTOMER_V6,ENGINE_CURRENT_CUSTOMER_V7,ENGINE_CURRENT_CUSTOMER_V8} from './current-engine-policy';
import {parseEngineCheckpoint,type EngineRuntime,type EngineProviderResult,type PreparedEngineCall} from './durable-worker';
import {admitLocalCurrentRegistration,localConsentDispatchWitness,localConsentLedger,localConsentRecordSchema,type LocalConsentLedger} from './local-consent-ledger';
import {assertLocalParentEvidence,readLocalSettledJournal} from './local-trial-continuation';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';
import {createEngineNativeRecipe,type EngineNativeSheetObservation} from './native-recipe';
import {engineResponseText} from './provider-plans';
import {locationRepairFindings} from './local-trial-location-repair';
import {locationV2RepairFindings} from './local-trial-location-repair-v2';
import type {LocalTrialCarry} from './local-trial-runtime';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const pin=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localCurrentEntitiesSchema=z.object({version:z.literal('engine-local-current-entities-continuation/v1'),
 parentGo:pin,parentStop:pin,parentExit:pin,parentLaunch:pin,parentLauncherLog:pin,parentEvidence:pin,parentConsentSha256:digest}).strict();
export const localCurrentLocationsSchema=localCurrentEntitiesSchema.extend({version:z.literal('engine-local-current-locations-continuation/v1'),
 previousLink:pin,targetImageSha256:digest}).strict();
export const localCurrentPictureBookSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-picture-book-continuation/v1')}).strict();
export const localCurrentSpatialSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-spatial-continuation/v1')}).strict();
export const localCurrentSpatialCorrectionSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-spatial-correction/v1')}).strict();
export const localCurrentScaleContinuationSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-scale-continuation/v1'),
 targetReviewStep:z.string().regex(/^page_[0-8]_[0-2]_qa2$/)}).strict();
export const localCurrentLandmarkContinuationSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-landmark-continuation/v1'),
 nextIdentityStep:z.string().regex(/^page_[0-8]_[0-2]_identity$/)}).strict();
export const localCurrentMediaRecoverySchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-media-recovery/v1'),
 targetReviewStep:z.string().regex(/^page_[1-8]_[01]_qa$/),
 edit:z.object({page:z.number().int().min(1).max(8),parentImageSha256:digest}).strict()}).strict();
export const localCurrentReaderCompletionSchema=localCurrentLocationsSchema.extend({
 version:z.literal('engine-local-current-reader-completion/v1'),
 recoveredReview:pin,recoveredSettlement:pin,
}).strict();
type MediaRecoverySpec=z.infer<typeof localCurrentMediaRecoverySchema>;
type Spec=MediaRecoverySpec|z.infer<typeof localCurrentReaderCompletionSchema>|z.infer<typeof localCurrentEntitiesSchema>|z.infer<typeof localCurrentLocationsSchema>|z.infer<typeof localCurrentPictureBookSchema>|z.infer<typeof localCurrentSpatialSchema>|z.infer<typeof localCurrentSpatialCorrectionSchema>|z.infer<typeof localCurrentScaleContinuationSchema>|z.infer<typeof localCurrentLandmarkContinuationSchema>;
export const localCurrentBoundaries=['entities','locations','locations-art-direction','locations-spatial-direction','locations-spatial-correction','page-scale-abstention','page-landmark','page-media-recovery','local-reader-completion'] as const;
const localCurrentVersions=[ENGINE_CURRENT_CUSTOMER_V2,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V4,ENGINE_CURRENT_CUSTOMER_V5,ENGINE_CURRENT_CUSTOMER_V6,ENGINE_CURRENT_CUSTOMER_V7,ENGINE_CURRENT_CUSTOMER_V8,ENGINE_CURRENT_CUSTOMER_V8,ENGINE_CURRENT_CUSTOMER_V8] as const;
export function localCurrentBoundary(spec:Spec) {
 if(spec.version==='engine-local-current-reader-completion/v1')return 'local-reader-completion';
 if(spec.version==='engine-local-current-media-recovery/v1')return 'page-media-recovery';
 if(spec.version==='engine-local-current-landmark-continuation/v1')return 'page-landmark';
 if(spec.version==='engine-local-current-scale-continuation/v1')return 'page-scale-abstention';
 if(spec.version==='engine-local-current-spatial-correction/v1')return 'locations-spatial-correction';
 if(spec.version==='engine-local-current-spatial-continuation/v1')return 'locations-spatial-direction';
 if(spec.version==='engine-local-current-picture-book-continuation/v1')return 'locations-art-direction';
 return spec.version==='engine-local-current-locations-continuation/v1'?'locations':'entities';
}
export function localCurrentTransition(boundary:ReturnType<typeof localCurrentBoundary>){
 const index=localCurrentBoundaries.indexOf(boundary) as 0|1|2|3|4|5|6|7|8;
 return {index,previousBoundary:localCurrentBoundaries[index-1],from:localCurrentVersions[index],to:localCurrentVersions[index+1]};
}
type Snapshot=Parameters<typeof createEngineNativeRecipe>[0]['snapshot'];
const bytes=(file:string)=>{
 const stat=lstatSync(file);
 if(/(^|[\\/])\.env(?:\.|$)/i.test(file)||!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==path.resolve(file)||stat.size>64*1024*1024)
  engineSiteFail('local_entities_file');
 return readFileSync(file);
};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
const pinned=(r:z.infer<typeof pin>)=>{const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_entities_evidence_changed');return b;};
const sorted=(rows:Iterable<string>)=>[...rows].sort().join(',');
const denied=():never=>engineSiteFail('local_entities_replay_dispatch_forbidden');
const ports={fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied};
const db=new Proxy({},{get:denied}) as PrismaClient,storage={put:denied,read:denied,sign:denied};
const oldStep=/^(?:story_(?:author|editor|final_review(?:_citation)?|comparison(?:_citation)?)|initial_storyboard(?:_review|_repair_[12](?:_review)?)?|reference_child(?:_repair)?(?:_style_qa|_qa|_identity)?|prep_child_bound_(?:review|repair(?:_review)?)|sheet_entities_0(?:_qa)?)$/;
export const localEntityMediaStep=(step:string)=>/^(?:sheet_(?:entities|locations)_0(?:_qa)?|page_[0-8]_[0-2](?:_qa2?|_identity)?|narration_[0-8])$/.test(step);
type LocationAttempt=0|1|2|3|4;
const locationSteps=(attempt:number)=>[`sheet_locations_${attempt}`,`sheet_locations_${attempt}_qa`];
export const localLocationMediaStep=(step:string,attempt:Exclude<LocationAttempt,0>=1)=>locationSteps(attempt).includes(step)||localEntityMediaStep(step)&&!step.startsWith('sheet_');
export const localCurrentLocationRepairSlots=(steps:EngineOrderAuthority['budget']['steps'],attempt:LocationAttempt=1,from:LocationAttempt=0)=>
 steps.map(s=>locationSteps(from).includes(s.id)?{...s,id:s.id.replace(`_${from}`,`_${attempt}`)}:s);
export function localCurrentMediaRecoverySlots(steps:EngineOrderAuthority['budget']['steps'],page:number,attempt:3|4=3){
 const base='page_'+page+'_';
 const last=[base+'2',base+'2_qa',base+'2_identity'].map(id=>steps.find(step=>step.id===id)??engineSiteFail('local_media_recovery_slots'));
 if(steps.some(step=>step.id.startsWith(base+attempt)))engineSiteFail('local_media_recovery_slots');
 return [...steps,...last.map(step=>({...step,id:base+attempt+step.id.slice(base.length+1)}))];
}
export const localCurrentLocationAttempt=(stage:number):LocationAttempt=>Math.min(stage,4) as LocationAttempt;
type ParentGo={approvalReference:string;approvedAt:string;sourceRevision:string;profileSha256:string;readerId:string;maximumMicroUsd:number;maximumCalls:number};
export function readLocalEntityParentGo(spec:Spec):unknown{return JSON.parse(pinned(spec.parentGo).toString('utf8'));}

type Admitted={readonly carried:Readonly<LocalTrialCarry>;readonly preparedSha256:string;readonly parentLedger:Readonly<LocalConsentLedger>;
 readonly boundary:ReturnType<typeof localCurrentBoundary>;readonly orderId:string;
 readonly parentConsentSha256:string;readonly parentApprovalReference:string};
type ArchivedMedia={request:{authoritySha256:string;call:PreparedEngineCall['call'];wire:unknown};result:EngineProviderResult};
type SettlementReplay={first:string;excluded:ReadonlySet<string>;records:ReadonlyMap<string,ArchivedMedia>;
 replayAttempts?:Readonly<Partial<Record<number,number>>>;
 recovery?:{failedStep:string;edit:ExhaustedFrameEdit;historicalCurrentCorrections:ReadonlySet<string>}};
type Admission={prepared:unknown;authoritySha256:string;snapshotSha256:string;ownerId:string;draftId:string;check:()=>void;
 settledMedia?:SettlementReplay;
 sheets?:{entities:EngineNativeSheetObservation;locations:EngineNativeSheetObservation;previousLocations:AuditionAttempt[]}};
const admissions=new WeakMap<Admitted,Admission>();
export type LocalEntitiesPreparation=Admitted;
function admission(cap:Admitted){return admissions.get(cap)??engineSiteFail('local_entities_preparation_required');}
export function checkLocalEntitiesPreparation(cap:Admitted){admission(cap).check();}
export function localEntitiesPreparedSource(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],snapshot:Snapshot,cached?:unknown){
 const a=admission(cap);
 if(a.authoritySha256!==canonicalHash(checkpoint.authority)||a.snapshotSha256!==checkpoint.snapshotSha256||a.snapshotSha256!==canonicalHash(snapshot)||
    a.ownerId!==checkpoint.ownerId||a.draftId!==checkpoint.draftId)engineSiteFail('local_entities_preparation_binding');
 if(cached!==undefined&&canonicalHash(cached)!==cap.preparedSha256)engineSiteFail('local_entities_prepared_changed');
 return structuredClone(a.prepared);
}
/** The native edit path can only obtain a sheet pair from a successful raw replay of the two real parent executions. */
export function localEntitiesSheetPair(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],snapshot:Snapshot,prepared:unknown){
 const a=admission(cap);
 if(cap.boundary==='entities'||!a.sheets)engineSiteFail('local_locations_current_preparation');
 localEntitiesPreparedSource(cap,checkpoint,snapshot,prepared);
 return structuredClone(a.sheets);
}

export function localSettledMedia(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],step:string){
 const {settledMedia,authoritySha256}=admission(cap);
 if(!settledMedia)return null;
 if(authoritySha256!==canonicalHash(checkpoint.authority))engineSiteFail('local_entities_preparation_binding');
 const record=settledMedia.records.get(step);
 if(!record)return null;
 if(checkpoint.calls[step]||settledMedia.excluded.has(step))engineSiteFail('local_scale_replay_collision');
 return structuredClone(record);
}

/** Earlier re-asks still used the normal judge path. Only the now unneeded terminal re-ask is counted separately. */
export function localSpentReviewReasks(cap:Admitted){
 const media=admission(cap).settledMedia;
 return media?[...media.excluded].filter(step=>step.endsWith('_qa2')).length:undefined;
}

export function localReplayAttempts(cap:Admitted){
 return admission(cap).settledMedia?.replayAttempts;
}

export function localMediaRecovery(cap:Admitted){
 const media=admission(cap).settledMedia;
 if(!media?.recovery)return undefined;
 const {edit,historicalCurrentCorrections}=media.recovery;
 return {edit, localReaderCompletion:cap.boundary==='local-reader-completion',
  prospective:(step:string)=>!media.records.has(step),
  useReviewCapacity:(step:string)=>!media.records.has(step)||
   (media.records.get(step)?.request.wire as {body?:{max_output_tokens?:number}})?.body?.max_output_tokens===24000,
  usedCurrentCorrection:(page:number,attempt:number)=>historicalCurrentCorrections.has('page_'+page+'_'+attempt)};
}

/** Strip only the newly appended prospective directions when comparing to a sealed request. */
function archivedWire(plan:PreparedEngineCall,archive:ArchivedMedia,sparseLandmark:boolean){
 const step=plan.call.step,wire=plan.wire as {body?:{prompt?:string;instructions?:string}};
 const previous=archive.request.wire as typeof wire;
 const projected={...wire,authoritySha256:archive.request.authoritySha256};
 const remove=(value:string|undefined,addition:string)=>{
  const suffix='\n'+addition;
  if(!value?.endsWith(suffix))engineSiteFail('local_scale_replay_wire');
  return value.slice(0,-suffix.length);
 };
 if(/^page_[0-8]_[0-2]_qa2?$/.test(step)){
  let instructions=wire.body?.instructions;
  const previousInstruction=previous.body?.instructions;
  const priorInstructions=previousInstruction?.endsWith('\n'+PICTURE_BOOK_CONCISE_REVIEW)?
   remove(previousInstruction,PICTURE_BOOK_CONCISE_REVIEW):previousInstruction;
  if(sparseLandmark&&!priorInstructions?.endsWith('\n'+PICTURE_BOOK_LANDMARK_REPORTING))
   instructions=remove(instructions,PICTURE_BOOK_LANDMARK_REPORTING);
  if(!priorInstructions?.endsWith('\n'+PICTURE_BOOK_SCALE_REPORTING)&&
     !priorInstructions?.endsWith('\n'+PICTURE_BOOK_SCALE_REPORTING+'\n'+PICTURE_BOOK_LANDMARK_REPORTING))
   instructions=remove(instructions,PICTURE_BOOK_SCALE_REPORTING);
  projected.body={...wire.body,instructions};
 }else if(sparseLandmark&&/^page_[0-8]_[0-2]$/.test(step)&&!previous.body?.prompt?.endsWith('\n'+PICTURE_BOOK_SPATIAL_STAGING)){
  projected.body={...wire.body,prompt:remove(wire.body?.prompt,PICTURE_BOOK_SPATIAL_STAGING)};
 }
 return projected;
}

/** Admission re-derives the stopped run under its original authority. Only those settled bytes can replay. */
export function withLocalSettledMedia(cap:Admitted,runtime:EngineRuntime):EngineRuntime{
 const {settledMedia}=admission(cap);
 if(!settledMedia)return runtime;
 const {first,excluded,records}=settledMedia;
 const used=new Set<string>();
 let crossed=false;
 return {...runtime,
  load:name=>runtime.load(name),save:(name,value)=>runtime.save(name,value),advance:phase=>runtime.advance(phase),
  async result(step){return localSettledMedia(cap,runtime.checkpoint,step)?.result??runtime.result(step);},
  async call(plan){
   const step=plan.call.step,archived=localSettledMedia(cap,runtime.checkpoint,step);
   if(!archived){
    if(!crossed){
     if(step!==first||used.size!==records.size-excluded.size)engineSiteFail('local_scale_first_call');
     crossed=true;
    }
    return runtime.call(plan);
   }
   runtime.check();plan.revalidate?.();
   if(crossed||used.has(step)||!plan.admitSaved||canonicalHash(plan.wire)!==plan.call.wireSha256||
     plan.call.maximumMicroUsd!==archived.request.call.maximumMicroUsd)engineSiteFail('local_scale_replay_wire');
   const projected=archivedWire(plan,archived,cap.boundary==='page-landmark'||cap.boundary==='page-media-recovery'||cap.boundary==='local-reader-completion');
   if(canonicalHash(projected)!==archived.request.call.wireSha256)engineSiteFail('local_scale_replay_wire');
   if(step===settledMedia.recovery?.failedStep){
    runtime.check();used.add(step);
    engineSiteFail('audition_pixel_provider_invalid');
   }
   await plan.admitSaved(archived.result);runtime.check();used.add(step);return archived.result;
  }};
}
function assertFreshOutput(out:string,parent:string,ledger:string){
 const n=(s:string)=>path.resolve(s).toLowerCase(),d=n(out);
 if([parent,ledger].some(p=>d===n(p)||d.startsWith(n(p)+path.sep)||n(p).startsWith(d+path.sep))||realpathSync(out)!==out)
  engineSiteFail('local_entities_output_scope');
 const entries=readdirSync(out);
 if(entries.length!==1||entries[0]!=='OWNER-GO.json')engineSiteFail('local_entities_output_exists');
}

/** Prove the original terminal execution, including its global dispatch witnesses; rebuild the original producer, without a key. */
/** The old journal remains pending. Only its separate, exact retrieved response can price that one dispatched slot. */
function loadRecoveredNativeReview(spec:z.infer<typeof localCurrentReaderCompletionSchema>,root:string,
 cp:ReturnType<typeof parseEngineCheckpoint>,step:string,stoppedAt:string){
 const dir=path.join(root,'journal','calls',step),claim=json(path.join(dir,'claim.json')),entry=cp.calls[step];
 const receipt=JSON.parse(pinned(spec.recoveredReview).toString('utf8'));
 const settlement=JSON.parse(pinned(spec.recoveredSettlement).toString('utf8'));
 const raw=receipt.body,claimSha256=canonicalHash(claim),reserve=claim.call.maximumMicroUsd;
 if(!entry||entry.settled||!entry.pendingId||!entry.polls||receipt.http!==200||receipt.binding?.step!==step||
   receipt.binding?.claimSha256!==claimSha256||receipt.binding?.wireSha256!==entry.wireSha256||
   raw?.id!==entry.pendingId||raw.id!==receipt.binding.id||raw.object!=='response'||raw.status!=='completed'||
   raw.model!=='gpt-6.1-sol'||raw.service_tier!=='default'||raw.max_output_tokens!==24000||raw.background!==true||
   raw.store!==false||raw.error!==null||raw.incomplete_details!==null||
   !Number.isSafeInteger(raw.usage?.output_tokens)||raw.usage.output_tokens>raw.max_output_tokens||
   !(Date.parse(receipt.at)>=Date.parse(stoppedAt)&&Date.parse(receipt.at)<=Date.parse(settlement.at)&&Date.parse(settlement.at)<=Date.now())||
   settlement.version!=='local-current-recovered-settlement/v1'||settlement.status!=='priced_review_held'||
   settlement.originalClaimSha256!==claimSha256||settlement.originalWireSha256!==entry.wireSha256||
   settlement.responseId!==raw.id||settlement.step!==step||canonicalHash(settlement.receipt)!==canonicalHash(spec.recoveredReview)||
   settlement.previousReservedMicroUsd!==reserve||settlement.newLogicalCalls!==0||settlement.newReserveMicroUsd!==0||
   settlement.reservedMicroUsd!==0||settlement.pendingCalls!==0||settlement.unknownCalls!==0)
  engineSiteFail('local_reader_completion_receipt');
 const output=JSON.parse(engineResponseText(raw)),cost=auditionUsageCost(raw.usage,'sol');
 const result={raw,output,estimatedMicroUsd:cost,usable:true,model:raw.model,
  usage:{inputTokens:raw.usage.input_tokens,outputTokens:raw.usage.output_tokens}};
 if(cost===null||cost>reserve||settlement.recoveredCostMicroUsd!==cost||canonicalHash(result)!==settlement.resultSha256||
   output.candidateSha!==spec.targetImageSha256||settlement.candidateSha256!==output.candidateSha||
   settlement.contextSha256!==output.contextSha||settlement.knownMicroUsd!==settlement.previousKnownMicroUsd+cost||
   settlement.accountedMicroUsd!==settlement.knownMicroUsd)
  engineSiteFail('local_reader_completion_receipt');
 return {step,result,settlement,id:raw.id as string,claimSha256,reserve};
}

export async function admitLocalEntitiesContinuation(o:{spec:Spec;parentGo:ParentGo;parentAuthority:EngineOrderAuthority;authority:EngineOrderAuthority;
 snapshot:Snapshot;profileSha256:string;out:string;readerId:string;ledgerRoot:string;upstream?:Admitted;terminalTargetForReplay?:true}):Promise<Admitted>{
 const {spec,parentGo:g,parentAuthority:old,authority:a,snapshot,out}=o;
 const boundary=localCurrentBoundary(spec),location='previousLink' in spec,upstream=o.upstream;
 const scale=spec.version==='engine-local-current-scale-continuation/v1'?spec:null;
 const landmark=spec.version==='engine-local-current-landmark-continuation/v1'?spec:null;
 const recovery=spec.version==='engine-local-current-media-recovery/v1'?spec:null;
 const completion=spec.version==='engine-local-current-reader-completion/v1'?spec:null;
 const priorRecovery=completion&&upstream?admission(upstream).settledMedia?.recovery:undefined;
 if(completion&&(!priorRecovery||priorRecovery.edit.redraw))engineSiteFail('local_reader_completion_scope');
 const media=scale??landmark??recovery??completion;
 const recoveryFrame=recovery?Number(recovery.targetReviewStep.split('_')[1]):null;
 if(recovery&&recovery.edit.page>=recoveryFrame!)engineSiteFail('local_media_recovery_scope');
 const transition=localCurrentTransition(boundary),priorLocation=transition.index>=2;
 if(location?(!upstream||upstream.boundary!==transition.previousBoundary||admission(upstream).authoritySha256!==canonicalHash(old)):upstream!==undefined)
  engineSiteFail('local_locations_current_parent_scope');
 const evidence={version:'engine-local-initial-hold-continuation/v1' as const,parentGrant:spec.parentGo,parentStop:spec.parentStop,
  parentExit:spec.parentExit,parentEvidence:spec.parentEvidence};
 const {root}=assertLocalParentEvidence(evidence);
 const go=readLocalEntityParentGo(spec);
 const oldShape=(v:EngineOrderAuthority)=>{
  const {currentEngine:_version,sourceRevision:_head,policySha256:_policy,budget:{approvalReference:_ref,approvedAt:_at,...budget},...rest}=v;
  return {...rest,budget};
 };
 if(spec.parentGo.file!==path.join(root,'OWNER-GO.json')||path.dirname(spec.parentStop.file)!==root||canonicalHash(go)!==canonicalHash(g)||
  o.profileSha256!==g.profileSha256||o.readerId!==g.readerId||a.budget.approvalReference===g.approvalReference||old.budget.approvalReference!==g.approvalReference||
  old.orderId!==(upstream?.orderId??g.approvalReference)||
  old.sourceRevision!==g.sourceRevision||old.currentEngine!==transition.from||a.currentEngine!==transition.to||
  old.imageQuality!=='low'||old.imageModelPolicy?.model!=='gpt-image-2.6-sunburst'||old.budget.maximumMicroUsd!==g.maximumMicroUsd||
  old.budget.maximumCalls!==g.maximumCalls||canonicalHash(oldShape(a))!==canonicalHash(oldShape(completion?
   {...old,budget:{...old.budget,steps:localCurrentMediaRecoverySlots(old.budget.steps,priorRecovery!.edit.page,4)}}:recovery?
   {...old,budget:{...old.budget,steps:localCurrentMediaRecoverySlots(old.budget.steps,recovery.edit.page)}}:location&&!media?
   {...old,budget:{...old.budget,steps:localCurrentLocationRepairSlots(old.budget.steps,localCurrentLocationAttempt(transition.index),localCurrentLocationAttempt(transition.index-1))}}:old))||snapshot.appearance.kind!=='description'||
  snapshot.request.bookOptions.voiceId!=='dad_v2'||a.requestSha256!==canonicalHash(snapshot))engineSiteFail('local_entities_scope');
 if(!o.terminalTargetForReplay)assertFreshOutput(out,root,o.ledgerRoot);
 const ledger=localConsentLedger(o.ledgerRoot,g.approvalReference);
 if(existsSync(ledger.leaseFile)||existsSync(ledger.leaseTransactionFile))engineSiteFail('local_entities_parent_active');
 const registration=admitLocalCurrentRegistration(ledger,g,{goSha256:spec.parentGo.sha256,sourceRevision:g.sourceRevision,
  profileSha256:g.profileSha256,out:root,readerId:g.readerId});
 const consent=localConsentRecordSchema.parse(json(ledger.consentFile)),consentSha256=canonicalHash(consent),authoritySha256=canonicalHash(old);
 if(consentSha256!==spec.parentConsentSha256||consent.approvalReference!==g.approvalReference||consent.registrationSha256!==registration.registrationSha256||
  consent.goSha256!==spec.parentGo.sha256||consent.goCanonicalSha256!==canonicalHash(g)||consent.authoritySha256!==authoritySha256||
  consent.out!==root||consent.journal!==path.join(root,'journal')||consent.sourceRevision!==g.sourceRevision||consent.profileSha256!==g.profileSha256||
  canonicalHash(json(path.join(root,'AUTHORITY.json')))!==authoritySha256||canonicalHash(json(path.join(root,'CLAIM.json')))!==canonicalHash({
   version:'engine-local-current-book-claim/v1',authoritySha256,sourceRevision:g.sourceRevision,profileSha256:g.profileSha256,goSha256:spec.parentGo.sha256,out:root}))
   engineSiteFail('local_entities_parent_claim');
 const stop=json(spec.parentStop.file),running=json(path.join(root,'RUNNING.json')),terminal=json(spec.parentExit.file);
 const launch=JSON.parse(pinned(spec.parentLaunch).toString('utf8'));
 const log=pinned(spec.parentLauncherLog);
 const exit=location?JSON.parse(log.toString('utf8')):null;
 const legacy=location?null:/^started (\S+) pid (\d+)\r?\nexit 1 at (\S+)\r?\n?$/.exec(log.toString('ascii'));
 const exitedAt=location?exit.at:legacy?.[3],startedAt=location?launch.at:legacy?.[1],supervisor=location?exit.pid:Number(legacy?.[2]);
 if((location?(exit.code!==1||exit.outcomeExists!==false||exit.head!==g.sourceRevision||exit.goSha256!==spec.parentGo.sha256||
    launch.head!==g.sourceRevision||launch.registrationSha256!==registration.registrationSha256):!legacy)||
  !Number.isFinite(Date.parse(exitedAt))||!(Date.parse(launch.at)<=Date.parse(startedAt)&&Date.parse(startedAt)<=Date.parse(running.startedAt)&&Date.parse(running.startedAt)<=Date.parse(stop.at)&&Date.parse(stop.at)<=Date.parse(exitedAt))||
  stop.version!=='engine-local-current-book-stop/v1'||stop.reason!==(completion?'audition_exhausted_frame_held':recovery?'local_trial_budget_or_unknown':landmark?'audition_identity_unusable':scale?'audition_review_unusable':'engine_reference_sheet_held')||stop.phase!=='native'||stop.productAccepted!==false||
  launch.pid!==supervisor||launch.authoritySha256!==authoritySha256||launch.goSha256!==spec.parentGo.sha256||
  terminal.version!=='local-book-independent-outcome/v1'||terminal.sourceHead!==g.sourceRevision||terminal.exitCode!==1||terminal.outcome!=='held'||
  terminal.reason!==stop.reason||terminal.phase!==stop.phase||terminal.launcherExitAt!==exitedAt||
  running.authoritySha256!==authoritySha256||existsSync(path.join(root,'OUTCOME.json'))||
  sorted(readdirSync(root).filter(n=>/^STOP-/.test(n)))!==path.basename(spec.parentStop.file)||
  canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(upstream?.carried??null))
   engineSiteFail('local_entities_parent_terminal');
 assertLocalHistoricalProcessGone(running.pid,exitedAt);assertLocalHistoricalProcessGone(supervisor,exitedAt);
 if(location&&upstream){
  const expected=path.join(ledger.root,'local-current-'+upstream.parentApprovalReference+'.'+upstream.boundary+'-continuation.json');
  const link=JSON.parse(pinned(spec.previousLink).toString('utf8'));
  if(spec.previousLink.file!==expected||canonicalHash(link)!==canonicalHash({version:'engine-local-current-'+upstream.boundary+'-claim/v1',
   parentConsentSha256:upstream.parentConsentSha256,preparedSha256:upstream.preparedSha256,carried:upstream.carried,
   consentSha256,goSha256:spec.parentGo.sha256,authoritySha256,out:root}))engineSiteFail('local_locations_current_parent_claim');
 }
 const cp=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))}),steps=Object.keys(cp.calls);
 const targetRender=recovery?.targetReviewStep.replace(/_qa$/,'')??landmark?.nextIdentityStep.replace(/_identity$/,'')??scale?.targetReviewStep.replace(/_qa2$/,'');
 const failedStep=recovery?.targetReviewStep;
 const interruptedStep=priorRecovery?'page_'+priorRecovery.edit.page+'_3_qa':undefined;
 const interruptedRender=interruptedStep?.replace(/_qa$/,'');
 const nextRender=recovery?targetRender!.replace(/([01])$/,(_s,n)=>String(Number(n)+1)):undefined;
 const required=completion?[interruptedStep!,interruptedRender!]:scale?[...locationSteps(4),targetRender!,targetRender+'_qa',scale.targetReviewStep]:
  landmark||recovery?[targetRender!,targetRender+'_qa']:
  priorLocation?locationSteps(transition.index-1):['sheet_entities_0','sheet_entities_0_qa',...(location?locationSteps(0):[])];
 const outputNames=Object.keys(cp.outputs);
 const validOutputs=media?outputNames.includes('prepared_source')&&outputNames.every(n=>n==='prepared_source'||/^native_page_[0-8]$/.test(n)):sorted(outputNames)==='prepared_source';
 if(cp.phase!=='native'||cp.waiting!==null||canonicalHash(cp.authority)!==authoritySha256||cp.snapshotSha256!==a.requestSha256||
  cp.ownerId!==snapshot.ownerId||cp.draftId!==snapshot.request.draftId||!validOutputs||
  sorted(steps)!==sorted(stop.calls)||(media?steps.some(step=>(!localLocationMediaStep(step,4)&&!(completion&&[interruptedStep,interruptedRender].includes(step)))||step.startsWith('narration_')):
   location?sorted(steps)!==sorted(required):steps.some(s=>!oldStep.test(s))))engineSiteFail('local_entities_parent_checkpoint');
 if(recovery&&(cp.calls[failedStep!+'2']||cp.calls[targetRender!+'_identity']||cp.calls[nextRender!]||
   existsSync(ledger.dispatchFile(failedStep!+'2'))||existsSync(ledger.dispatchFile(targetRender!+'_identity'))||existsSync(ledger.dispatchFile(nextRender!))))
  engineSiteFail('local_media_recovery_prior_dispatch');
 if(landmark){
  const stopped=/^Technical pause after settled receipt (page_[0-8]_[0-2]_qa) (\S+)\r?\n?$/.exec(bytes(path.join(root,'OWNER-STOP')).toString('utf8'));
  if(!stopped||stopped[1]!==targetRender+'_qa'||!Number.isFinite(Date.parse(stopped[2]))||
    Date.parse(stopped[2])<Date.parse(running.startedAt)||Date.parse(stopped[2])>Date.parse(stop.at)||
    cp.calls[landmark.nextIdentityStep]||existsSync(ledger.dispatchFile(landmark.nextIdentityStep)))
   engineSiteFail('local_landmark_parent_pause');
 }
 const recovered=completion?loadRecoveredNativeReview(completion,root,cp,interruptedStep!,stop.at):undefined;
 const receipts=readLocalSettledJournal(root,cp,required,new Set(steps),(step,r)=>{
  const raw=r.raw as any;
  if(step==='story_author')return anthropicAuthorCost(raw,'batch');
  if(/^(?:reference_child(?:_repair)?|sheet_entities_0|sheet_locations_[0-4]|page_[0-8]_[0-3])$/.test(step))
   return r.model===old.imageModelPolicy?.model?auditionUsageCost(raw.usage,'image'):null;
  if(step.endsWith('_identity'))return auditionUsageCost({input_tokens:raw.usage?.prompt_tokens,output_tokens:raw.usage?.completion_tokens},'identity');
  return raw.model==='gpt-6.1-sol'&&raw.service_tier==='default'?auditionUsageCost(raw.usage,'sol'):null;
 }, recovery ? (step,result,request)=>{
  const raw=result.raw as any,wire=(request as ArchivedMedia['request']).wire as {body?:{max_output_tokens?:number;model?:string}};
  const outputCap=wire.body?.max_output_tokens;
  return step===failedStep&&result.usable===false&&result.output===null&&wire.body?.model==='gpt-6.1-sol'&&
    result.model==='gpt-6.1-sol'&&raw.status==='incomplete'&&raw.error===null&&raw.incomplete_details?.reason==='max_output_tokens'&&
    outputCap===12000&&raw.max_output_tokens===outputCap&&raw.usage?.output_tokens===outputCap&&
    result.usage?.outputTokens===outputCap&&result.usage?.inputTokens===raw.usage?.input_tokens&&
    /^resp_[A-Za-z0-9_-]+$/.test(raw.id)&&cp.calls[step].pendingId===raw.id;
 } : undefined,recovered);
 const known=receipts.known+(upstream?.carried.accountedMicroUsd??0),count=steps.length+(upstream?.carried.logicalCalls??0),m=stop.meter;
 const recoveredCost=recovered?.result.estimatedMicroUsd??0, historicalKnown=known-recoveredCost;
 const historicalReserve=recovered?.reserve??0,historicalAccounted=historicalKnown+historicalReserve;
 if(m?.blocked!==!!recovery||m.failedCalls!==(recovery?1:0)||m.accountedMicroUsd!==historicalAccounted||m.knownEstimateMicroUsd!==historicalKnown||m.logicalCalls!==count||
  (upstream&&(m.carriedMicroUsd!==upstream.carried.accountedMicroUsd||m.carriedCalls!==upstream.carried.logicalCalls||
   terminal.newKnownMicroUsd!==receipts.known-recoveredCost||terminal.newLogicalCalls!==steps.length||canonicalHash(terminal.carried)!==canonicalHash(upstream.carried)))||
  m.pendingCalls!==(completion?1:0)||['unknownCalls','overReservedCalls','lostLocalCalls'].some(k=>m[k]!==0)||
  terminal.meter?.accountedMicroUsd!==historicalAccounted||terminal.meter?.logicalCalls!==count||terminal.meter?.reservedMicroUsd!==historicalReserve||
  completion&&(terminal.meter?.pendingCalls!==1||terminal.meter?.unknownCalls!==0||terminal.meter?.knownEstimateMicroUsd!==historicalKnown)||
  recovered&&(recovered.settlement.previousKnownMicroUsd!==historicalKnown||recovered.settlement.knownMicroUsd!==known||recovered.settlement.logicalCalls!==count)||

  recovery&&(receipts.results.get(failedStep!)?.usable!==false||terminal.meter?.failedCalls!==1||terminal.meter?.unknownCalls!==0||terminal.meter?.pendingCalls!==0)||
  known>=a.budget.maximumMicroUsd||count>=a.budget.maximumCalls)engineSiteFail('local_entities_parent_meter');
 const witness=localConsentDispatchWitness(ledger,consentSha256,old);
 const witnessPins=new Map<string,string>();
 const ledgerNames=()=>readdirSync(ledger.root).filter(n=>n.startsWith(path.basename(ledger.dispatchFile('dummy')).replace(/dummy\.json$/,'')));
 if(sorted(witness.list().map(w=>w.step))!==sorted(steps))engineSiteFail('local_entities_parent_witness');
 for(const [step,{claim}] of receipts.claims){
  const claimSha=canonicalHash(claim),dir=path.join(root,'journal','calls',step),dispatch=json(path.join(dir,'dispatch.json')),entry=cp.calls[step];
  if(dispatch.claimSha256!==claimSha||!Number.isSafeInteger(dispatch.at)||dispatch.at<Date.parse(running.startedAt)||dispatch.at>Date.parse(stop.at))
   engineSiteFail('local_entities_parent_witness');
  witness.check(step,claimSha,true);const observed=witness.observed!(step);
  const polls=readdirSync(dir).filter(n=>/^pending-\d{5}\.json$/.test(n)).sort();
  if(polls.length!==entry.polls||(polls.length===0?(observed!==null||entry.pendingId!==undefined):(
   !observed||observed.dispatchAt!==dispatch.at||observed.id!==entry.pendingId||polls.some((n,i)=>{
    const saved=json(path.join(dir,n));
    return n!=='pending-'+String(i).padStart(5,'0')+'.json'||saved.id!==observed.id||
     saved.raw?.id!==undefined&&saved.raw.id!==observed.id||!Number.isSafeInteger(saved.at)||saved.at<dispatch.at||saved.at>Date.parse(stop.at);
   }))))engineSiteFail('local_entities_parent_witness');
  if(step===interruptedStep&&(!recovered||!observed||observed.id!==recovered.id||observed.claimSha256!==recovered.claimSha256))
   engineSiteFail('local_reader_completion_witness');
  const files=[ledger.dispatchFile(step),...(observed?[ledger.providerFile(step)]:[])];
  for(const file of files)witnessPins.set(file,sha(bytes(file)));
 }
 const expectedNames=sorted([...witnessPins.keys()].map(f=>path.basename(f)));
 const check=()=>{
  assertLocalParentEvidence(evidence);pinned(spec.parentLaunch);pinned(spec.parentLauncherLog);registration.check();
  if(completion){
   pinned(completion.recoveredReview);pinned(completion.recoveredSettlement);
   if(existsSync(path.join(root,'journal','calls',interruptedStep!,'result.json')))
    engineSiteFail('local_reader_completion_receipt');
  }
  if(location){pinned(spec.previousLink);checkLocalEntitiesPreparation(upstream!);}
  if(existsSync(ledger.leaseFile)||existsSync(ledger.leaseTransactionFile))engineSiteFail('local_entities_parent_active');
  if(canonicalHash(localConsentRecordSchema.parse(json(ledger.consentFile)))!==consentSha256||sorted(ledgerNames())!==expectedNames)
   engineSiteFail('local_entities_parent_witness');
  for(const [f,h] of witnessPins)if(sha(bytes(f))!==h)engineSiteFail('local_entities_parent_witness');
 };
 const accepted=receipts.asset(cp.outputs.prepared_source),preparedSha256=canonicalHash(accepted);
 const used=new Set<string>(),verifiedOutputs=new Set<string>(),observations:EngineNativeSheetObservation[]=[];
 let pausedAtIdentity=false,blockedAfterReview=false,verifiedEditParent=false,terminated=false;
 let prepared:unknown=upstream?localEntitiesPreparedSource(upstream,cp,snapshot,accepted):null;
 const runtime:EngineRuntime={checkpoint:{...structuredClone(cp),phase:location?'native':'story'},signal:new AbortController().signal,check(){},result:denied,
  async load(name){if(name==='prepared_source')return prepared;return null;},
  async save(name,value){
   if(media&&/^native_page_[0-8]$/.test(name)){
    const id=cp.outputs[name];
    if(!id||verifiedOutputs.has(name)||canonicalHash(receipts.asset(id))!==canonicalHash(value))engineSiteFail('local_entities_replay_output');
    verifiedOutputs.add(name);return;
   }
   if(name!=='prepared_source'||prepared!==null||canonicalHash(value)!==preparedSha256)engineSiteFail('local_entities_replay_output');
   prepared=structuredClone(value);
  },
  async advance(phase){if(phase!=='native')engineSiteFail('local_entities_replay_output');runtime.checkpoint.phase=phase;},
  async call(plan){
   plan.revalidate?.();const {step}=plan.call,found=receipts.claims.get(step),result=receipts.results.get(step);
   if(landmark&&step===landmark.nextIdentityStep&&used.size===steps.length&&!pausedAtIdentity&&
      canonicalHash(plan.wire)===plan.call.wireSha256&&!!plan.admitSaved){
    pausedAtIdentity=true;engineSiteFail('local_current_owner_stop');
   }
   if(recovery&&step===nextRender&&[...used][used.size-1]===failedStep&&used.size===steps.length&&!blockedAfterReview&&
     !found&&!!plan.admitSaved&&canonicalHash(plan.wire)===plan.call.wireSha256){
    blockedAfterReview=true;engineSiteFail('local_trial_budget_or_unknown');
   }
   if(!found||!result||!plan.admitSaved||used.has(step)||canonicalHash(plan.call)!==canonicalHash(found.claim.call)||
    canonicalHash(plan.wire)!==found.claim.call.wireSha256)engineSiteFail('local_entities_replay_wire');
   if(step===failedStep&&result.usable===false){used.add(step);engineSiteFail('local_trial_settled_hold');}
   await plan.admitSaved(result);used.add(step);
   // The parent actually stopped before receiving this result. The GET receipt is checked above, but replay preserves its original stop.
   if(step===interruptedStep)engineSiteFail('local_trial_pending_deadline');
   return result;
  }};
 try{await createEngineNativeRecipe({db,storage,snapshot,ports,observeReferenceSheet:v=>observations.push(v),
  ...(recovery?{observeNativePage:(page:Parameters<typeof exhaustedFrameEditParent>[0])=>{
   if(page.pageNumber===recovery.edit.page){
    exhaustedFrameEditParent(page,{...recovery.edit,afterPage:recoveryFrame!});verifiedEditParent=true;
   }
  }}:{}),
  ...(priorLocation?{currentLocationsRepair:upstream}:{})})(runtime);}
 catch(error){if((error as {code?:unknown})?.code!==stop.reason)throw error;terminated=true;}
 if(!terminated||prepared===null||sorted(used)!==sorted(steps)||observations.length!==(location&&!priorLocation?2:1)||observations[0].role!==(priorLocation?'locations':'entities'))
  engineSiteFail('local_entities_parent_not_repairable');
 let sheets:Admission['sheets'],settledMedia:Admission['settledMedia'];
 if(media){
  const last=interruptedStep??scale?.targetReviewStep??targetRender+'_qa';
  if(outputNames.length!==verifiedOutputs.size+1||[...used][used.size-1]!==last||landmark&&!pausedAtIdentity||recovery&&(!blockedAfterReview||!verifiedEditParent)||
    observations[0].attempt.status!=='qa_supported'||
    (receipts.results.get(interruptedRender??targetRender!)?.output as {imageSha?:string})?.imageSha!==media.targetImageSha256)
   engineSiteFail('local_scale_parent_target');
  sheets=localEntitiesSheetPair(upstream!,cp,snapshot,prepared);
  const previous=admission(upstream!).settledMedia;
  if((landmark||recovery||completion)&&!previous)engineSiteFail('local_landmark_parent_pause');
  const records=new Map(previous?.records);
  for(const [step,{request}] of receipts.claims){
   if(records.has(step))engineSiteFail('local_scale_replay_collision');
   records.set(step,{request,result:receipts.results.get(step)!});
  }
  const excluded=completion?new Set([...previous!.excluded,interruptedStep!,interruptedRender!]):scale?new Set([scale.targetReviewStep]):previous!.excluded;
  const first=completion?'page_'+priorRecovery!.edit.page+'_4':recovery?failedStep+'2':landmark?.nextIdentityStep??scale!.targetReviewStep.replace(/_qa2$/,'_identity');
  const replayAttempts:Partial<Record<number,number>>={};
  if(landmark||recovery||completion)for(const step of records.keys()){
   const frame=/^page_([0-8])_([0-2])$/.exec(step);
   if(frame)replayAttempts[Number(frame[1])]=Math.max(replayAttempts[Number(frame[1])]??0,Number(frame[2])+1);
  }
  const historicalCurrentCorrections=new Set<string>();
  if(recovery||completion)for(const [step,{request}] of records){
   if(/^page_[0-8]_[0-2]$/.test(step)&&(request.wire as {body?:{prompt?:string}}).body?.prompt?.endsWith('\n'+PICTURE_BOOK_SPATIAL_STAGING))
    historicalCurrentCorrections.add(step);
  }
  settledMedia={first,excluded,records,...(landmark||recovery||completion?{replayAttempts:Object.freeze(replayAttempts)}:{}),
   ...(recovery?{recovery:{failedStep:failedStep!,edit:Object.freeze({...recovery.edit,afterPage:recoveryFrame!}),historicalCurrentCorrections}}:{}),
   ...(completion?{recovery:{failedStep:priorRecovery!.failedStep,edit:Object.freeze({...priorRecovery!.edit,redraw:true as const}),
    historicalCurrentCorrections}}:{})};
 }
 else if(location){
  const locations=observations[priorLocation?0:1];
  if(locations.role!=='locations'||locations.attempt.candidate?.imageSha!==spec.targetImageSha256)engineSiteFail('local_locations_current_target');
  if(priorLocation){
   if(transition.index===2)locationV2RepairFindings(locations.attempt);
   else{
    const attempt=locations.attempt,assessment=attempt.assessment;
    const material=assessment?.findings.filter(f=>f.impact!=='detail')??[];
    if(attempt.attempt!==transition.index-1||attempt.status!=='held'||!attempt.review||!assessment||assessment.safetyBlocked||assessment.invalidCitations||
     !material.some(f=>f.verdict==='defect')||material.some(f=>!f.bound||f.impact!=='continuity'))engineSiteFail('local_locations_current_target');
   }
   const prior=localEntitiesSheetPair(upstream!,cp,snapshot,prepared);
   sheets={entities:prior.entities,locations,previousLocations:[...prior.previousLocations,prior.locations.attempt]};
  }else{
   if(observations[0].attempt.status!=='qa_supported')engineSiteFail('local_locations_current_target');
   locationRepairFindings(locations.attempt);
   sheets={entities:observations[0],locations,previousLocations:[]};
  }
 }else if(observations[0].attempt.status!=='held'||!observations[0].attempt.candidate||observations[0].attempt.assessment?.safetyBlocked!==false||
  observations[0].attempt.assessment?.invalidCitations!==0)engineSiteFail('local_entities_parent_not_repairable');
 check();
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:count,evidenceSha256:canonicalHash(spec)});
 const cap=Object.freeze({carried,preparedSha256,parentLedger:Object.freeze(ledger),parentConsentSha256:consentSha256,parentApprovalReference:g.approvalReference,
  boundary,orderId:old.orderId});
 admissions.set(cap,{prepared,authoritySha256:canonicalHash(a),snapshotSha256:a.requestSha256,ownerId:cp.ownerId,draftId:cp.draftId,check,sheets,settledMedia});
 return cap;
}

/** Exact first media wire. Neither an accepted cache nor this plan is spend authority. */
export async function previewLocalEntitiesContinuation(cap:Admitted,snapshot:Snapshot,authority:EngineOrderAuthority){
 const stop=Object.assign(Error('local_entities_first_wire'),{code:'audition_cancelled'});
 const plans:Pick<Parameters<EngineRuntime['call']>[0],'call'|'wire'>[]=[];
 const continuation=admission(cap).settledMedia;
 const runtime:EngineRuntime={checkpoint:{version:'engine-site-job/v1',authority,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,
  snapshotSha256:authority.requestSha256,phase:'native',calls:{},outputs:{},waiting:null},signal:new AbortController().signal,
  check(){},result:denied,advance:async()=>denied(),
  async save(name){if(!continuation||!/^native_page_[0-8]$/.test(name))denied();},
  async load(name){return name==='prepared_source'?localEntitiesPreparedSource(cap,runtime.checkpoint,snapshot):null;},
  async call(plan){plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw stop;}};
 try{await createEngineNativeRecipe({db,storage,snapshot,ports,...(cap.boundary!=='entities'?{currentLocationsRepair:cap}:{})})(runtime);}catch(e){if(e!==stop)throw e;}
 const expected=continuation?continuation.first:
  cap.boundary==='entities'?'sheet_entities_0':locationSteps(localCurrentTransition(cap.boundary).index)[0];
 if(plans.length!==1||plans[0].call.step!==expected||
  cap.carried.accountedMicroUsd+plans[0].call.maximumMicroUsd>authority.budget.maximumMicroUsd)
  engineSiteFail('local_entities_first_step');
 return plans[0];
}

export function localEntitiesAllowedStep(cap:Admitted,step:string){
 const a=admission(cap);
 if(a.settledMedia?.records.has(step))return false;
 const edit=a.settledMedia?.recovery?.edit;
 if(edit&&['','_qa','_identity'].some(suffix=>step==='page_'+edit.page+'_'+(edit.redraw?4:3)+suffix))return true;
 return cap.boundary==='entities'?localEntityMediaStep(step):localLocationMediaStep(step,localCurrentLocationAttempt(localCurrentTransition(cap.boundary).index) as Exclude<LocationAttempt,0>);
}

/** In addition to the candidate's own one-use consent, a stopped parent may have only ONE child execution, across any candidate GO. */
export function claimLocalEntitiesContinuation(cap:Admitted,binding:{consentSha256:string;goSha256:string;authoritySha256:string;out:string}){
 const a=admission(cap);
 if(a.authoritySha256!==binding.authoritySha256)engineSiteFail('local_entities_preparation_binding');
 a.check();
 const file=path.join(cap.parentLedger.root,'local-current-'+cap.parentApprovalReference+'.'+cap.boundary+'-continuation.json');
 const value={version:'engine-local-current-'+cap.boundary+'-claim/v1',parentConsentSha256:cap.parentConsentSha256,
  preparedSha256:cap.preparedSha256,carried:cap.carried,...binding};
 try{writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
 catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')engineSiteFail('local_entities_continuation_used');throw error;}
 return ()=>{if(canonicalHash(json(file))!==canonicalHash(value))engineSiteFail('local_entities_continuation_claim_changed');a.check();};
}
