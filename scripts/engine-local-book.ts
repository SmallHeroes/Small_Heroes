/** Explicit ONE local fictional-book operator. No web activation, PayMe, remote DB, public delivery or automatic loop. */
import 'server-only';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canonicalHash} from '../lib/canonical-json';
import {identifierSchema,engineSiteFail} from '../lib/engine-site/contract';
import {engineRecipeSteps,ENGINE_RECIPE_VERSION} from '../lib/engine-site/platform-policy';
import {resolveEngineWizardOptions,prepareEngineOrder} from '../lib/engine-site/personal-orders';
import {LocalEngineTrialRuntime,validateLocalTrialAuthority} from '../lib/engine-site/local-trial-runtime';
import {localStartupRecoverySchema,assertLocalStartupRecoveryEvidence,loadLocalStartupRecovery,claimLocalStartupRecovery,type LocalStartupRecoveryEnvelope} from '../lib/engine-site/local-trial-startup-recovery';
import {runLocalEngineTrialBook,localTrialReaderBundle} from '../lib/engine-site/local-trial-book';
import {ENGINE_SITE_LAUNCH_OFFER} from '../lib/engine-site/offer-definition';
import {localReaderId} from '../lib/local-reader-preview';
import {localContinuationSchema,assertLocalParentEvidence,loadLocalParentEnvelope,replayLocalInitialPreparation,type LocalParentEnvelope} from '../lib/engine-site/local-trial-continuation';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from '../lib/engine-site/response-schema';
import {localPlanRecoverySchema,assertLocalPlanRecoveryEvidence,loadLocalPlanRecovery,localPlanRecoverySteps,replayLocalPlanRecovery,preflightLocalPlanRecovery,runLocalPlanRecovery,claimLocalPlanRecoveryExecution,localPlanRecoveryDispatchWitness,assertLocalPlanRecoveryResumeState,type LocalPlanRecoveryEnvelope} from '../lib/engine-site/local-trial-plan-recovery';
import {localSupportedPlanSchema,assertLocalSupportedPlanEvidence,loadLocalSupportedPlan,localSupportedMediaSteps,replayLocalSupportedPlan,preflightLocalSupportedMedia,claimLocalSupportedMediaExecution,localSupportedMediaDispatchWitness,assertLocalSupportedMediaResumeState,assertLocalSupportedMediaRuntime,type LocalSupportedPlanEnvelope} from '../lib/engine-site/local-trial-supported-plan';
import type {EngineOrderAuthority} from '../lib/engine-site/contract';
import {ENGINE_BOUND_REVIEW_STEP,ENGINE_STORYBOARD_BINDING} from '../lib/engine-site/storyboard-binding-policy';
import {PREPARATION_SLOTS} from '../lib/personal-wizard/source-preparation-policy';
import {engineImageModelPolicySchema} from '../lib/engine-site/image-model-policy';
import {localChildBindingSchema,assertLocalChildBindingEvidence,loadLocalChildBinding,localChildBindingSteps,replayLocalChildBinding,preflightLocalChildBinding,claimLocalChildBindingExecution,assertLocalChildBindingResumeState,localChildBindingDispatchWitness,assertLocalChildBindingRuntime,type LocalChildBindingEnvelope} from '../lib/engine-site/local-trial-child-binding';
import {LOCATION_SHEET_PROJECTION,LOCATION_SHEET_PROJECTION_V2,locationSheetPolicySchema} from '../lib/personal-wizard/location-sheet-projection';
import {localLocationRepairSchema,assertLocalLocationRepairEvidence,loadLocalLocationRepair,localLocationRepairSteps,replayLocalLocationRepair,preflightLocalLocationRepair,claimLocalLocationRepairExecution,assertLocalLocationRepairResumeState,localLocationRepairDispatchWitness,assertLocalLocationRepairRuntime,type LocalLocationRepairEnvelope} from '../lib/engine-site/local-trial-location-repair';
import {localLocationV2RepairSchema,assertLocalLocationV2RepairEvidence,loadLocalLocationV2Repair,localLocationV2RepairSteps,replayLocalLocationV2Repair,preflightLocalLocationV2Repair,claimLocalLocationV2RepairExecution,assertLocalLocationV2RepairResumeState,localLocationV2RepairDispatchWitness,assertLocalLocationV2RepairRuntime,type LocalLocationV2RepairEnvelope} from '../lib/engine-site/local-trial-location-repair-v2';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute);
export const LOCAL_FRESH_BOOK_POLICY='fresh-current-policies/v1' as const;
export const localEngineGrantSchema=z.object({version:z.literal('engine-local-book-grant/v1'),fictional:z.literal(true),
 source:z.object({root:absolute,head:z.string().regex(/^[a-f0-9]{40}$/),pins:z.array(z.object({path:z.string(),bytes:z.number().int().positive(),sha256:digest}).strict()).min(1)}).strict(),
 profile:z.object({file:absolute,sha256:digest}).strict(),ownerApproval:z.object({file:absolute,sha256:digest}).strict(),
 credentials:z.object({file:absolute,sha256:digest}).strict(),directory:absolute,readerId:z.string(),
 approvalReference:identifierSchema,approvedBy:identifierSchema,approvedAt:z.string().datetime({precision:3}),
 maximumMicroUsd:z.number().int().positive().max(12_000_000),maximumCalls:z.number().int().positive().max(121),
 independentQA:z.literal('pending_owner_authorized_internal_trial'),publicDelivery:z.literal(false),realPayment:z.literal(false),
 continuation:localContinuationSchema.optional(),
 planningRecovery:localPlanRecoverySchema.optional(),
 mediaContinuation:localSupportedPlanSchema.optional(),
 childBindingContinuation:localChildBindingSchema.optional(),
 locationsRepairContinuation:localLocationRepairSchema.optional(),
 locationsV2RepairContinuation:localLocationV2RepairSchema.optional(),
 freshBookPolicy:z.literal(LOCAL_FRESH_BOOK_POLICY).optional(),
 imageModelPolicy:engineImageModelPolicySchema.optional(),
 startupRecovery:localStartupRecoverySchema.optional(),
 storyboardBindingPolicy:z.literal(ENGINE_STORYBOARD_BINDING).optional(),
 locationSheetPolicy:locationSheetPolicySchema.optional(),
 responseSchemaPolicy:z.literal(ENGINE_RESPONSE_SCHEMA_POLICY).optional(),
}).strict().superRefine((g,ctx)=>{
 if(g.imageModelPolicy&&!g.freshBookPolicy||g.maximumMicroUsd>10_000_000&&!g.imageModelPolicy)ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_image26_fresh_authority_required'});
 if(g.startupRecovery&&(!g.freshBookPolicy||!g.imageModelPolicy))ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_startup_fresh_image26_required'});
 const modes=[g.continuation,g.planningRecovery,g.mediaContinuation,g.childBindingContinuation,g.locationsRepairContinuation,g.locationsV2RepairContinuation].filter(Boolean);
 if(modes.length>1||g.freshBookPolicy&&modes.length>0)ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_book_recovery_modes_conflict'});
 if((g.freshBookPolicy||g.planningRecovery||g.mediaContinuation||g.childBindingContinuation||g.locationsRepairContinuation||g.locationsV2RepairContinuation)&&g.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY)ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_plan_recovery_schema_required'});
 if(Boolean(g.freshBookPolicy||g.childBindingContinuation||g.locationsRepairContinuation||g.locationsV2RepairContinuation)!==Boolean(g.storyboardBindingPolicy))ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_child_binding_policy_required'});
 if(g.locationSheetPolicy!==(g.freshBookPolicy||g.locationsV2RepairContinuation?LOCATION_SHEET_PROJECTION_V2:g.locationsRepairContinuation?LOCATION_SHEET_PROJECTION:undefined))ctx.addIssue({code:z.ZodIssueCode.custom,message:'local_locations_policy_required'});
});
export type LocalEngineGrant=z.infer<typeof localEngineGrantSchema>;
const activationSchema=z.object({version:z.literal('engine-local-one-book-activation/v1'),ownerAuthority:z.object({file:absolute,sha256:digest}).strict(),
 approvalReference:identifierSchema,approvedBy:identifierSchema,approvedAt:z.string().datetime({precision:3}),approvalTimeKind:z.literal('local_record_of_received_owner_authority'),
 maximumMicroUsd:z.number().int().positive().max(12_000_000),maximumCalls:z.number().int().positive().max(121),sourceRoot:absolute,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),
 profileSha256:digest,directory:absolute,readerId:z.string(),fictional:z.literal(true),publicDelivery:z.literal(false),realPayment:z.literal(false),parentGrantSha256:digest.optional(),startupRecoverySha256:digest.optional(),planningRecoverySha256:digest.optional(),mediaContinuationSha256:digest.optional(),childBindingContinuationSha256:digest.optional(),locationsRepairContinuationSha256:digest.optional(),locationsV2RepairContinuationSha256:digest.optional(),freshBookPolicy:z.literal(LOCAL_FRESH_BOOK_POLICY).optional(),imageModelPolicy:engineImageModelPolicySchema.optional(),locationSheetPolicy:locationSheetPolicySchema.optional(),storyboardBindingPolicy:z.literal(ENGINE_STORYBOARD_BINDING).optional(),responseSchemaPolicy:z.literal(ENGINE_RESPONSE_SCHEMA_POLICY).optional()}).strict();
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function readFile(file:string){if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file)engineSiteFail('local_book_file_path');return readFileSync(file);}
const safeError=(error:unknown)=>{const x=error&&typeof error==='object'?error as {code?:unknown;message?:unknown}:{};return typeof x.code==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.code)?x.code:typeof x.message==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.message)?x.message:'local_book_stopped';};
const git=(root:string,...args:string[])=>execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
function activation(g:LocalEngineGrant){
 if(sha(readFile(g.ownerApproval.file))!==g.ownerApproval.sha256)engineSiteFail('local_book_approval_changed');
 const record=activationSchema.parse(JSON.parse(readFile(g.ownerApproval.file).toString('utf8')));
 const legacyOwnerSchema=z.object({version:z.literal('engine-one-local-book-owner-authority/v1'),maximumMicroUsd:z.literal(10_000_000),maximumLogicalCalls:z.literal(121),additionalBudgetAllowed:z.literal(false),newPublicLaunchAllowed:z.literal(false),realPaymeChargeAllowed:z.literal(false)}).passthrough();
 const ownerRaw=JSON.parse(readFile(record.ownerAuthority.file).toString('utf8'));
 let owner: {maximumMicroUsd:number},campaignOwnerAuthoritySha256=record.ownerAuthority.sha256;
 if(ownerRaw.version==='engine-one-local-book-owner-authority/v2'){
  const extended=z.object({version:z.literal('engine-one-local-book-owner-authority/v2'),maximumMicroUsd:z.literal(12_000_000),maximumLogicalCalls:z.literal(121),additionalBudgetAllowed:z.literal(false),newPublicLaunchAllowed:z.literal(false),realPaymeChargeAllowed:z.literal(false),imageModelPolicy:engineImageModelPolicySchema,rootAuthority:z.object({file:absolute,sha256:digest}).strict()}).passthrough().parse(ownerRaw);
  const original=readFile(extended.rootAuthority.file);
  if(sha(original)!==extended.rootAuthority.sha256||!g.freshBookPolicy||!g.imageModelPolicy||canonicalHash(extended.imageModelPolicy)!==canonicalHash(g.imageModelPolicy))engineSiteFail('local_book_extended_owner_invalid');
  legacyOwnerSchema.parse(JSON.parse(original.toString('utf8')));
  campaignOwnerAuthoritySha256=extended.rootAuthority.sha256;owner=extended;
 }else{owner=legacyOwnerSchema.parse(ownerRaw);if(g.imageModelPolicy)engineSiteFail('local_book_extended_owner_required');}
 if(sha(readFile(record.ownerAuthority.file))!==record.ownerAuthority.sha256||record.maximumMicroUsd!==g.maximumMicroUsd||record.maximumCalls!==g.maximumCalls||
  record.approvalReference!==g.approvalReference||record.approvedBy!==g.approvedBy||record.approvedAt!==g.approvedAt||record.sourceRoot!==g.source.root||record.sourceHead!==g.source.head||
  record.profileSha256!==g.profile.sha256||record.directory!==g.directory||record.readerId!==g.readerId||record.parentGrantSha256!==g.continuation?.parentGrant.sha256||record.startupRecoverySha256!==(g.startupRecovery?canonicalHash(g.startupRecovery):undefined)||record.planningRecoverySha256!==(g.planningRecovery?canonicalHash(g.planningRecovery):undefined)||record.mediaContinuationSha256!==(g.mediaContinuation?canonicalHash(g.mediaContinuation):undefined)||record.childBindingContinuationSha256!==(g.childBindingContinuation?canonicalHash(g.childBindingContinuation):undefined)||record.locationsRepairContinuationSha256!==(g.locationsRepairContinuation?canonicalHash(g.locationsRepairContinuation):undefined)||record.locationsV2RepairContinuationSha256!==(g.locationsV2RepairContinuation?canonicalHash(g.locationsV2RepairContinuation):undefined)||record.freshBookPolicy!==g.freshBookPolicy||record.locationSheetPolicy!==g.locationSheetPolicy||record.storyboardBindingPolicy!==g.storyboardBindingPolicy||record.responseSchemaPolicy!==g.responseSchemaPolicy||owner.maximumMicroUsd<g.maximumMicroUsd)engineSiteFail('local_book_approval_changed');
 if(canonicalHash(record.imageModelPolicy??null)!==canonicalHash(g.imageModelPolicy??null))engineSiteFail('local_book_approval_changed');
 return {...record,campaignOwnerAuthoritySha256};
}
/** All copied grants/source parents from the SAME owner consent share ONE global consumption key. */
export function localEngineMasterClaimFile(g:LocalEngineGrant){return path.join('C:\\GNart\\Work\\book-authority',activation(g).campaignOwnerAuthoritySha256+'.local-engine.claim.json');}
type PreparedLocalEngineTrial={grant:LocalEngineGrant;prepared:ReturnType<typeof prepareEngineOrder>;authority:EngineOrderAuthority;parent:LocalParentEnvelope|undefined;recovery:LocalPlanRecoveryEnvelope|undefined;media:LocalSupportedPlanEnvelope|undefined;childBinding:LocalChildBindingEnvelope|undefined;locationsRepair:LocalLocationRepairEnvelope|undefined;locationsV2Repair:LocalLocationV2RepairEnvelope|undefined;startup:LocalStartupRecoveryEnvelope|undefined};
export function prepareLocalEngineTrial(grant:LocalEngineGrant):PreparedLocalEngineTrial{
 const g=localEngineGrantSchema.parse(grant),profile=JSON.parse(readFile(g.profile.file).toString('utf8'));
 if(profile.fictional!==true||profile.input?.appearance?.kind!=='description')engineSiteFail('local_book_fictional_description_required');
 const options=resolveEngineWizardOptions(g.source.root),owner={id:'local_owner_guy',email:'fictional-local@example.invalid',name:'Local internal trial'};
 const prepared=prepareEngineOrder(profile.input,owner,options),orderId=g.approvalReference;
 const parent=g.continuation?loadLocalParentEnvelope(g,localEngineGrantSchema.parse(JSON.parse(readFile(g.continuation.parentGrant.file).toString('utf8')))):undefined;
 if(parent&&(parent.authority.requestSha256!==prepared.inputSha256||parent.authority.optionsSha256!==options.fingerprint||parent.checkpoint.ownerId!==prepared.snapshot.ownerId||parent.checkpoint.draftId!==prepared.snapshot.request.draftId||
  localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(parent.parent)||canonicalHash(prepareLocalEngineTrial(parent.parent).authority)!==canonicalHash(parent.authority)))engineSiteFail('local_parent_authority');
 let recovery:LocalPlanRecoveryEnvelope|undefined;
 if(g.planningRecovery){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.planningRecovery.parentGrant.file).toString('utf8')));
  if(prior.planningRecovery||!prior.continuation)engineSiteFail('local_plan_recovery_scope');
  const old=prepareLocalEngineTrial(prior);
  if(!old.parent||localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(prior))engineSiteFail('local_plan_recovery_scope');
  recovery=loadLocalPlanRecovery(g,prior,old.parent,old.authority,localEngineMasterClaimFile(g));
  if(old.authority.requestSha256!==prepared.inputSha256||old.authority.optionsSha256!==options.fingerprint||old.parent.checkpoint.ownerId!==prepared.snapshot.ownerId||old.parent.checkpoint.draftId!==prepared.snapshot.request.draftId)engineSiteFail('local_plan_recovery_authority');
 }
 let media:LocalSupportedPlanEnvelope|undefined;
 if(g.mediaContinuation){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.mediaContinuation.parentGrant.file).toString('utf8')));
  if(!prior.planningRecovery||prior.continuation||prior.mediaContinuation)engineSiteFail('local_supported_plan_scope');
  const old=prepareLocalEngineTrial(prior);
  if(!old.recovery||localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(prior))engineSiteFail('local_supported_plan_scope');
  media=loadLocalSupportedPlan(g,prior,old.recovery,old.authority,localEngineMasterClaimFile(g));
  if(old.authority.requestSha256!==prepared.inputSha256||old.authority.optionsSha256!==options.fingerprint||old.recovery.checkpoint.ownerId!==prepared.snapshot.ownerId||old.recovery.checkpoint.draftId!==prepared.snapshot.request.draftId)engineSiteFail('local_supported_plan_authority');
 }
 let childBinding:LocalChildBindingEnvelope|undefined;
 if(g.childBindingContinuation){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.childBindingContinuation.parentGrant.file).toString('utf8')));
  if(!prior.mediaContinuation||prior.childBindingContinuation)engineSiteFail('local_child_binding_scope');
  const old=prepareLocalEngineTrial(prior);
  if(!old.media||localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(prior))engineSiteFail('local_child_binding_scope');
  childBinding=loadLocalChildBinding(g,prior,old.media,old.authority,localEngineMasterClaimFile(g));
  if(old.authority.requestSha256!==prepared.inputSha256||old.authority.optionsSha256!==options.fingerprint||old.media.checkpoint.ownerId!==prepared.snapshot.ownerId||old.media.checkpoint.draftId!==prepared.snapshot.request.draftId)engineSiteFail('local_child_binding_authority');
 }
 let locationsRepair:LocalLocationRepairEnvelope|undefined;
 if(g.locationsRepairContinuation){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.locationsRepairContinuation.parentGrant.file).toString('utf8')));
  if(!prior.childBindingContinuation||prior.locationsRepairContinuation)engineSiteFail('local_locations_scope');
  const old=prepareLocalEngineTrial(prior);
  if(!old.childBinding||localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(prior))engineSiteFail('local_locations_scope');
  locationsRepair=loadLocalLocationRepair(g,prior,old.childBinding,old.authority,localEngineMasterClaimFile(g));
  if(old.authority.requestSha256!==prepared.inputSha256||old.authority.optionsSha256!==options.fingerprint||old.childBinding.checkpoint.ownerId!==prepared.snapshot.ownerId||old.childBinding.checkpoint.draftId!==prepared.snapshot.request.draftId)engineSiteFail('local_locations_authority');
 }
 let locationsV2Repair:LocalLocationV2RepairEnvelope|undefined;
 if(g.locationsV2RepairContinuation){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.locationsV2RepairContinuation.parentGrant.file).toString('utf8')));
  if(!prior.locationsRepairContinuation||prior.locationsV2RepairContinuation)engineSiteFail('local_locations_v2_scope');
  const old=prepareLocalEngineTrial(prior);
  if(!old.locationsRepair||localEngineMasterClaimFile(g)!==localEngineMasterClaimFile(prior))engineSiteFail('local_locations_v2_scope');
  locationsV2Repair=loadLocalLocationV2Repair(g,prior,old.locationsRepair,old.authority,localEngineMasterClaimFile(g));
  if(old.authority.requestSha256!==prepared.inputSha256||old.authority.optionsSha256!==options.fingerprint||old.locationsRepair.checkpoint.ownerId!==prepared.snapshot.ownerId||old.locationsRepair.checkpoint.draftId!==prepared.snapshot.request.draftId)engineSiteFail('local_locations_v2_authority');
 }
 const steps=g.freshBookPolicy?[...engineRecipeSteps().filter(s=>!s.id.startsWith('prep_storyboard_')),{id:ENGINE_BOUND_REVIEW_STEP,maximumMicroUsd:PREPARATION_SLOTS[1]}]:locationsV2Repair?localLocationV2RepairSteps():locationsRepair?localLocationRepairSteps():childBinding?localChildBindingSteps():media?localSupportedMediaSteps():recovery?localPlanRecoverySteps():engineRecipeSteps(parent?{initialStoryboardRecovery:true}:undefined).filter(s=>!parent?.results.has(s.id));
 const authority=validateLocalTrialAuthority({version:'engine-site/v1',orderId,requestSha256:prepared.inputSha256,optionsSha256:options.fingerprint,
  offer:{id:ENGINE_SITE_LAUNCH_OFFER.id,revisionSha256:canonicalHash(ENGINE_SITE_LAUNCH_OFFER)},engine:'native-cde-book/v1',sourceRevision:g.source.head,
  policySha256:canonicalHash({version:'engine-local-trial-policy/v1',recipe:ENGINE_RECIPE_VERSION,ownerApproval:g.ownerApproval,maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,steps,...(g.startupRecovery?{startupRecovery:g.startupRecovery}:{}),...(g.freshBookPolicy?{freshBookPolicy:g.freshBookPolicy}:{}),...(g.imageModelPolicy?{imageModelPolicy:g.imageModelPolicy}:{}),...(parent?{continuation:g.continuation,carried:parent.carried}:{}),...(recovery?{planningRecovery:g.planningRecovery,carried:recovery.carried,attempt:recovery.nextAttempt,maximumAttempts:recovery.maximumAttempts}:{}),...(media?{mediaContinuation:g.mediaContinuation,carried:media.carried,boundary:'media_only'}:{}),...(childBinding?{childBindingContinuation:g.childBindingContinuation,carried:childBinding.carried,boundary:'bound_media_only',storyboardBindingPolicy:g.storyboardBindingPolicy}:{}),...(locationsRepair?{locationsRepairContinuation:g.locationsRepairContinuation,carried:locationsRepair.carried,boundary:'one_locations_repair_then_media',storyboardBindingPolicy:g.storyboardBindingPolicy,locationSheetPolicy:g.locationSheetPolicy}:{}),...(locationsV2Repair?{locationsV2RepairContinuation:g.locationsV2RepairContinuation,carried:locationsV2Repair.carried,boundary:'one_locations_v2_repair_then_media',storyboardBindingPolicy:g.storyboardBindingPolicy,locationSheetPolicy:g.locationSheetPolicy}:{}),...(g.responseSchemaPolicy?{responseSchemaPolicy:g.responseSchemaPolicy}:{})}),
  purpose:'test',...(g.responseSchemaPolicy?{responseSchemaPolicy:g.responseSchemaPolicy}:{}),...(g.storyboardBindingPolicy?{storyboardBindingPolicy:g.storyboardBindingPolicy}:{}),...(g.locationSheetPolicy?{locationSheetPolicy:g.locationSheetPolicy}:{}),...(g.imageModelPolicy?{imageModelPolicy:g.imageModelPolicy}:{}),imageQuality:'low',narrativePages:8,entitlements:{narration:true,pdf:true},budget:{maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,approvalReference:g.approvalReference,approvedBy:g.approvedBy,approvedAt:g.approvedAt,steps}});
 let startup:LocalStartupRecoveryEnvelope|undefined;
 if(g.startupRecovery){
  const prior=localEngineGrantSchema.parse(JSON.parse(readFile(g.startupRecovery.parentGrant.file).toString('utf8')));
  if(prior.startupRecovery)engineSiteFail('local_startup_scope');
  const old=prepareLocalEngineTrial(prior),master=localEngineMasterClaimFile(prior);
  // The future activation need not exist during provider-free planning. Actual execution validates it
  // and supplies its independently derived consent key to claimLocalStartupRecovery before claiming.
  if(old.authority.requestSha256!==authority.requestSha256||old.authority.optionsSha256!==authority.optionsSha256)engineSiteFail('local_startup_authority');
  startup=loadLocalStartupRecovery(g,prior,old.authority,master);
 }
 return {grant:g,prepared,authority,parent,recovery,media,childBinding,locationsRepair,locationsV2Repair,startup};
}
export function assertLocalEngineGrant(g:LocalEngineGrant,grantFile:string,grantSha:string){
 if(path.resolve(process.cwd())!==g.source.root||realpathSync(g.source.root)!==g.source.root||sha(readFile(grantFile))!==grantSha)engineSiteFail('local_book_grant_changed');
 if(path.dirname(g.directory)!==path.dirname(grantFile)||path.basename(g.directory)!=='book')engineSiteFail('local_book_output_path');
 if(existsSync(path.join(g.directory,'OWNER-STOP')))engineSiteFail('local_book_owner_stop');
 localReaderId(g.readerId);
 for(const row of [g.profile,g.ownerApproval,g.credentials])if(sha(readFile(row.file))!==row.sha256)engineSiteFail('local_book_input_changed');
 activation(g);
 if(g.continuation)assertLocalParentEvidence(g.continuation);
 if(g.planningRecovery)assertLocalPlanRecoveryEvidence(g.planningRecovery);
 if(g.mediaContinuation)assertLocalSupportedPlanEvidence(g.mediaContinuation);
 if(g.childBindingContinuation)assertLocalChildBindingEvidence(g.childBindingContinuation);
 if(g.locationsRepairContinuation)assertLocalLocationRepairEvidence(g.locationsRepairContinuation);
 if(g.locationsV2RepairContinuation)assertLocalLocationV2RepairEvidence(g.locationsV2RepairContinuation);
 if(g.startupRecovery)assertLocalStartupRecoveryEvidence(g.startupRecovery);
 if(git(g.source.root,'rev-parse','HEAD')!==g.source.head||git(g.source.root,'status','--porcelain','--untracked-files=no')||
  git(g.source.root,'ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config'))engineSiteFail('local_book_source_not_frozen');
 for(const row of g.source.pins){const file=path.resolve(g.source.root,row.path);if(!file.startsWith(g.source.root+path.sep)||/(^|[\\/])(?:\.env(?:\.|$)|\.git(?:[\\/]|$)|node_modules(?:[\\/]|$))/.test(row.path))engineSiteFail('local_book_pin_path');const bytes=readFile(file);if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)engineSiteFail('local_book_source_changed');}
}
export function localEngineSecret(g:LocalEngineGrant,name:'OPENAI_API_KEY'|'ANTHROPIC_API_KEY'|'ELEVENLABS_API_KEY'){
 const bytes=readFile(g.credentials.file);if(sha(bytes)!==g.credentials.sha256)engineSiteFail('local_book_credentials_changed');
 const line=bytes.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/).find(l=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(l));
 let value=line?.replace(new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=\\s*'),'').trim();if(value&&/^(['"])(.*)\1$/.test(value))value=value.slice(1,-1);
 if(!value||/\s/.test(value))engineSiteFail('local_book_credential_unavailable');return value;
}
function exclusive(file:string,value:unknown){writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
/** One root consent and at most ONE child. An existing record is never rewritten or treated as a new approval. */
export function claimLocalEngineExecution(masterFile:string,binding:unknown,resume:boolean,parentBinding?:unknown){
 const executionClaim=parentBinding?masterFile+'.continuation.json':masterFile;
 if(parentBinding&&(!existsSync(masterFile)||canonicalHash(JSON.parse(readFile(masterFile).toString('utf8')))!==canonicalHash(parentBinding)))engineSiteFail('local_parent_master_claim');
 if(existsSync(executionClaim)){if(!resume||canonicalHash(JSON.parse(readFile(executionClaim).toString('utf8')))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}
 else {if(resume)engineSiteFail('local_book_resume_without_claim');exclusive(executionClaim,binding);}
 return executionClaim;
}
export async function localEngineBookCLI(argv:string[]){
 const parsed=z.tuple([z.literal('--grant'),absolute,z.literal('--grant-sha'),digest]).parse(argv.slice(0,4));
 const execute=argv.includes('--execute'),resume=argv.includes('--resume');if(argv.length!==4+Number(execute)+Number(resume)||resume&&!execute)engineSiteFail('local_book_arguments');
 const grantFile=path.resolve(parsed[1]),grantSha=parsed[3],{grant:g,prepared,authority,parent,recovery,media,childBinding,locationsRepair,locationsV2Repair,startup}=prepareLocalEngineTrial(localEngineGrantSchema.parse(JSON.parse(readFile(grantFile).toString('utf8'))));
 if(g.imageModelPolicy&&resume)engineSiteFail('local_image26_no_resume');
 assertLocalEngineGrant(g,grantFile,grantSha);
 const childBindingPreparation=childBinding?await replayLocalChildBinding(childBinding,prepared.snapshot,authority):undefined;
 const locationsRepairPreparation=locationsRepair?await replayLocalLocationRepair(locationsRepair,prepared.snapshot,authority):undefined;
 const locationsV2RepairPreparation=locationsV2Repair?await replayLocalLocationV2Repair(locationsV2Repair,prepared.snapshot,authority):undefined;
 const initialPreparation=locationsV2RepairPreparation?.initialPreparation??locationsRepairPreparation?.initialPreparation??childBindingPreparation?.initialPreparation??(media?await replayLocalSupportedPlan(media,prepared.snapshot):parent?await replayLocalInitialPreparation(parent,prepared.snapshot):undefined);
 const planPreparation=recovery?await replayLocalPlanRecovery(recovery,prepared.snapshot,authority):undefined;
 const preflight=locationsV2RepairPreparation?await preflightLocalLocationV2Repair(locationsV2RepairPreparation,prepared.snapshot,authority):locationsRepairPreparation?await preflightLocalLocationRepair(locationsRepairPreparation,prepared.snapshot,authority):childBindingPreparation?await preflightLocalChildBinding(childBindingPreparation,prepared.snapshot,authority):media&&initialPreparation?await preflightLocalSupportedMedia(initialPreparation,prepared.snapshot,authority):planPreparation&&recovery?await preflightLocalPlanRecovery(planPreparation,prepared.snapshot,{checkpoint:{...recovery.checkpoint,authority},signal:new AbortController().signal,check(){},load:async()=>null,save:async()=>engineSiteFail('local_plan_preflight_write'),advance:async()=>engineSiteFail('local_plan_preflight_write'),result:async()=>engineSiteFail('local_plan_preflight_call'),call:async()=>engineSiteFail('local_plan_preflight_call')}):undefined;
 assertLocalEngineGrant(g,grantFile,grantSha);
 if(!execute){console.log(JSON.stringify({status:locationsV2Repair?'local_locations_v2_repair_preflight':locationsRepair?'local_locations_repair_preflight':childBinding?'local_child_binding_preflight':media?'local_supported_media_preflight':recovery?'local_plan_recovery_preflight':'local_book_plan',authoritySha256:canonicalHash(authority),maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,...(parent?{carried:parent.carried}:{}),...(recovery?{carried:recovery.carried,attempt:recovery.nextAttempt,maximumAttempts:recovery.maximumAttempts,prospectiveSteps:authority.budget.steps,preflightSha256:canonicalHash(preflight),boundary:'plan_review_only'}:{}),...(media?{carried:media.carried,prospectiveSteps:authority.budget.steps,preflightSha256:canonicalHash(preflight),boundary:'media_only'}:{}),...(childBinding?{carried:childBinding.carried,prospectiveSteps:authority.budget.steps,preflightSha256:canonicalHash(preflight),boundary:'bound_media_only'}:{}),...(locationsRepair?{carried:locationsRepair.carried,prospectiveSteps:authority.budget.steps,preflightSha256:canonicalHash(preflight),boundary:'one_locations_repair_then_media'}:{}),...(locationsV2Repair?{carried:locationsV2Repair.carried,prospectiveSteps:authority.budget.steps,preflightSha256:canonicalHash(preflight),boundary:'one_locations_v2_repair_then_media',attempt:2}:{}),fictional:true,providerCalls:0}));return 0;}
 const masterFile=localEngineMasterClaimFile(g),masterDirectory=path.dirname(masterFile);mkdirSync(masterDirectory,{recursive:true});
 const binding={version:'engine-local-book-claim/v1',grantFile,grantSha256:grantSha,authoritySha256:canonicalHash(authority),directory:g.directory,sourceRoot:g.source.root,...(g.startupRecovery?{startupRecoverySha256:canonicalHash(g.startupRecovery)}:{}),...(parent?{parentGrantSha256:g.continuation!.parentGrant.sha256,carried:parent.carried}:{}),...(recovery?{planningRecovery:g.planningRecovery,carried:recovery.carried,attempt:recovery.nextAttempt,maximumAttempts:recovery.maximumAttempts,boundary:'plan_review_only'}:{}),...(media?{mediaContinuation:g.mediaContinuation,carried:media.carried,boundary:'media_only'}:{}),...(childBinding?{childBindingContinuation:g.childBindingContinuation,carried:childBinding.carried,boundary:'bound_media_only'}:{}),...(locationsRepair?{locationsRepairContinuation:g.locationsRepairContinuation,carried:locationsRepair.carried,boundary:'one_locations_repair_then_media'}:{}),...(locationsV2Repair?{locationsV2RepairContinuation:g.locationsV2RepairContinuation,carried:locationsV2Repair.carried,boundary:'one_locations_v2_repair_then_media'}:{})};
 const parentBinding=parent?{version:'engine-local-book-claim/v1',grantFile:g.continuation!.parentGrant.file,grantSha256:g.continuation!.parentGrant.sha256,authoritySha256:canonicalHash(parent.authority),directory:parent.parent.directory,sourceRoot:parent.parent.source.root}:undefined;
 if(locationsV2Repair)claimLocalLocationV2RepairExecution(locationsV2Repair,binding,resume);else if(locationsRepair)claimLocalLocationRepairExecution(locationsRepair,binding,resume);else if(childBinding)claimLocalChildBindingExecution(childBinding,binding,resume);else if(media)claimLocalSupportedMediaExecution(media,binding,resume);else if(recovery)claimLocalPlanRecoveryExecution(recovery,binding,resume);else if(startup)claimLocalStartupRecovery(startup,binding,resume,masterFile);else claimLocalEngineExecution(masterFile,binding,resume,parentBinding);
 if(recovery)assertLocalPlanRecoveryResumeState(g.directory,resume);
 if(media)assertLocalSupportedMediaResumeState(g.directory,resume);
 if(childBinding)assertLocalChildBindingResumeState(g.directory,resume);
 if(locationsRepair)assertLocalLocationRepairResumeState(g.directory,resume);
 if(locationsV2Repair)assertLocalLocationV2RepairResumeState(g.directory,resume);
 mkdirSync(g.directory,{recursive:true,mode:0o700});
 const terminal=path.join(g.directory,recovery?'PLAN-OUTCOME.json':'OUTCOME.json');if(existsSync(terminal)){const old=JSON.parse(readFile(terminal).toString('utf8'));console.log(JSON.stringify({status:'already_terminal',outcomeSha256:sha(readFile(terminal))}));return recovery&&old.status!=='plan_review_supported'?1:0;}
 const liveFile=path.join(g.directory,'RUNNING.json');
 if(existsSync(liveFile)){const old=JSON.parse(readFile(liveFile).toString('utf8'));let alive=true;try{process.kill(old.pid,0);}catch{alive=false;}if(alive)engineSiteFail('local_book_running');if(!resume)engineSiteFail('local_book_resume_required');renameSync(liveFile,path.join(g.directory,'RUNNING-previous-'+Date.now()+'.json'));}
 exclusive(liveFile,{pid:process.pid,startedAt:new Date().toISOString(),grantSha256:grantSha});
 const keys=new Map<string,string>();const key=(name:'OPENAI_API_KEY'|'ANTHROPIC_API_KEY'|'ELEVENLABS_API_KEY')=>{const value=keys.get(name)??localEngineSecret(g,name);keys.set(name,value);return value;};
 // Only scrub logs; raw successful provider evidence is preserved unchanged in the private local journal.
 const original={log:console.log,warn:console.warn,error:console.error};for(const name of ['log','warn','error'] as const)console[name]=(...args:unknown[])=>{
  let text=args.map(a=>typeof a==='string'?a:a instanceof Error?safeError(a):JSON.stringify(a)).join(' ');for(const secret of keys.values())text=text.split(secret).join('[REDACTED]');original[name](text);};
 const assertCurrent=()=>{assertLocalEngineGrant(g,grantFile,grantSha);recovery?.checkClaims();media?.checkClaims();childBinding?.checkClaims();locationsRepair?.checkClaims();locationsV2Repair?.checkClaims();};
 const runtime=new LocalEngineTrialRuntime({root:path.join(g.directory,'journal'),authority,ownerId:prepared.snapshot.ownerId,draftId:prepared.snapshot.request.draftId,snapshotSha256:prepared.inputSha256,assertCurrent,...(parent?{carried:parent.carried}:{}),...(recovery?{carried:recovery.carried,dispatchWitness:localPlanRecoveryDispatchWitness(recovery,binding,authority)}:{}),...(media?{carried:media.carried,dispatchWitness:localSupportedMediaDispatchWitness(media,binding,authority)}:{}),...(childBinding?{carried:childBinding.carried,dispatchWitness:localChildBindingDispatchWitness(childBinding,binding,authority)}:{}),...(locationsRepair?{carried:locationsRepair.carried,dispatchWitness:localLocationRepairDispatchWitness(locationsRepair,binding,authority)}:{}),...(locationsV2Repair?{carried:locationsV2Repair.carried,dispatchWitness:localLocationV2RepairDispatchWitness(locationsV2Repair,binding,authority)}:{})});
 let beating=false;const beat=setInterval(()=>{if(beating)return;beating=true;void runtime.meter().then(m=>{
  const value={at:new Date().toISOString(),pid:process.pid,phase:runtime.checkpoint.phase,calls:Object.keys(runtime.checkpoint.calls),meter:m},temp=path.join(g.directory,'live.tmp');writeFileSync(temp,JSON.stringify(value,null,2));renameSync(temp,path.join(g.directory,'live.json'));
 }).catch(()=>{}).finally(()=>{beating=false;});},15000);beat.unref();
 try{
  if(recovery&&planPreparation){
   const result=await runLocalPlanRecovery(runtime,prepared.snapshot,planPreparation,{fetch,openAIKey:()=>key('OPENAI_API_KEY'),anthropicKey:()=>key('ANTHROPIC_API_KEY')});
   assertCurrent();const outcome={...result,version:'engine-local-plan-outcome/v1',completedAt:new Date().toISOString(),grantSha256:grantSha,authoritySha256:canonicalHash(authority),sourceRevision:g.source.head,meter:await runtime.meter(),productionQualified:false};
   exclusive(terminal,outcome);console.log(JSON.stringify({status:outcome.status,meter:outcome.meter,attempt:outcome.attempt,bookCreated:false}));return outcome.status==='plan_review_supported'?0:1;
  }
  if(media)await assertLocalSupportedMediaRuntime(media,runtime);
  if(childBinding)await assertLocalChildBindingRuntime(childBinding,runtime);
  if(locationsRepair)await assertLocalLocationRepairRuntime(locationsRepair,runtime);
  if(locationsV2Repair)await assertLocalLocationV2RepairRuntime(locationsV2Repair,runtime);
  const result=await runLocalEngineTrialBook({runtime,directory:g.directory,snapshot:prepared.snapshot,...(initialPreparation?{initialPreparation}:{}),...(childBindingPreparation?{childBindingPreparation}:{}),...(locationsRepairPreparation?{locationsRepairPreparation}:{}),...(locationsV2RepairPreparation?{locationsV2RepairPreparation}:{}),provider:{fetch,openAIKey:()=>key('OPENAI_API_KEY'),anthropicKey:()=>key('ANTHROPIC_API_KEY')},narration:{fetch,key:()=>key('ELEVENLABS_API_KEY')}});
  assertCurrent();const staging=path.join(g.directory,'reader-staging'),bundle=localTrialReaderBundle(staging,g.readerId,result),root=path.join(g.source.root,'outputs','local-reader-previews'),destination=path.join(root,g.readerId);
  mkdirSync(root,{recursive:true});if(path.dirname(path.resolve(bundle.directory))!==path.resolve(staging)||path.dirname(path.resolve(destination))!==path.resolve(root)||existsSync(destination))engineSiteFail('local_book_reader_destination');
  renameSync(bundle.directory,destination);
  const outcome={version:'engine-local-book-outcome/v1',completedAt:new Date().toISOString(),status:'automated_supported_internal_review_pending',fictional:true,grantSha256:grantSha,authoritySha256:canonicalHash(authority),sourceRevision:g.source.head,book:result.book,admittedFrames:result.admittedFrames,meter:result.meter,pdfFile:result.pdfFile,reader:{directory:destination,url:'http://127.0.0.1:3482'+bundle.url},independentQA:'pending',productAccepted:false,productionQualified:false};
  exclusive(terminal,outcome);console.log(JSON.stringify({status:outcome.status,admittedFrames:result.admittedFrames,meter:result.meter,reader:outcome.reader.url}));return 0;
 }catch(error){const stop={version:'engine-local-book-stop/v1',at:new Date().toISOString(),reason:safeError(error),phase:runtime.checkpoint.phase,meter:await runtime.meter().catch(()=>null),grantSha256:grantSha,productAccepted:false};
  const file=path.join(g.directory,'STOP-'+Date.now()+'.json');exclusive(file,stop);console.error(JSON.stringify(stop));return 1;
 }finally{clearInterval(beat);Object.assign(console,original);}
}
