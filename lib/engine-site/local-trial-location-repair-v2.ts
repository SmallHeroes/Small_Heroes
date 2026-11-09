/** One NEW owner-approved final locations edit after the settled v1 repair. Never resets attempts0/1. */
import 'server-only';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { LOCATION_SHEET_PROJECTION, LOCATION_SHEET_PROJECTION_V2 } from '@/lib/personal-wizard/location-sheet-projection';
import type { AuditionAttempt } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import type { LocalEngineGrant } from '@/scripts/engine-local-book';
import { engineSiteFail, type EngineOrderAuthority } from './contract';
import { parseEngineCheckpoint, type EngineRuntime } from './durable-worker';
import { assertLocalParentEvidence, readLocalSettledJournal } from './local-trial-continuation';
import { localLocationRepairSteps, replayLocalLocationRepair, type LocalLocationRepairEnvelope } from './local-trial-location-repair';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from './response-schema';
import { ENGINE_STORYBOARD_BINDING } from './storyboard-binding-policy';
import { createEngineNativeRecipe, type EngineNativeSheetObservation } from './native-recipe';
import type { AdmittedEngineInitialPreparation } from './story-preparation';
import type { LocalEngineTrialRuntime, LocalTrialDispatchWitness } from './local-trial-runtime';

type Snapshot = Parameters<typeof createEngineNativeRecipe>[0]['snapshot'];
const digest=z.string().regex(/^[a-f0-9]{64}$/),ref=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localLocationV2RepairSchema=z.object({version:z.literal('engine-local-locations-v2-repair/v1'),parentGrant:ref,parentStop:ref,parentExit:ref,parentEvidence:ref,
  parentClaimSha256:digest,ownerAttemptAuthority:ref,boundary:z.literal('one_locations_v2_repair_then_media')}).strict();
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||realpathSync(file)!==file||s.size>64*1024*1024||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_locations_v2_file');return readFileSync(file);}
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8')),denied=():never=>engineSiteFail('local_locations_v2_replay_dispatch_forbidden');
const priorSteps=['sheet_locations_1','sheet_locations_1_qa'];
export function localLocationV2RepairSteps(){return[{id:'sheet_locations_2',maximumMicroUsd:650_000},{id:'sheet_locations_2_qa',maximumMicroUsd:750_000},...localLocationRepairSteps().filter(s=>!s.id.startsWith('sheet_'))];}
const ownerSchema=z.object({oneAdditionalLocationsRepairOnly:z.literal(true),previousAttempt:z.literal(1),nextAttempt:z.literal(2),quality:z.literal('low'),targetImageSha256:digest,
  maximumNewReferenceCalls:z.literal(2),maximumNewReferenceReservedMicroUsd:z.literal(1_400_000),maximumTotalMicroUsd:z.literal(10_000_000),maximumTotalCalls:z.literal(121),
  independentCodeAndExactEnvelopePASSRequired:z.literal(true),stopOnFurtherHold:z.literal(true)}).passthrough();
export function assertLocalLocationV2RepairEvidence(spec:z.infer<typeof localLocationV2RepairSchema>){const s=localLocationV2RepairSchema.parse(spec);
  if(sha(bytes(s.ownerAttemptAuthority.file))!==s.ownerAttemptAuthority.sha256)engineSiteFail('local_locations_v2_owner_authority');ownerSchema.parse(json(s.ownerAttemptAuthority.file));
  return assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});}
const envelopes=new WeakSet<object>();
export function loadLocalLocationV2Repair(g:LocalEngineGrant,parent:LocalEngineGrant,repair:LocalLocationRepairEnvelope,parentAuthority:EngineOrderAuthority,masterFile:string){
  const spec=localLocationV2RepairSchema.parse(g.locationsV2RepairContinuation);
  if(g.continuation||g.planningRecovery||g.mediaContinuation||g.childBindingContinuation||g.locationsRepairContinuation||!parent.locationsRepairContinuation||parent.locationsV2RepairContinuation||parent.locationSheetPolicy!==LOCATION_SHEET_PROJECTION||
    g.locationSheetPolicy!==LOCATION_SHEET_PROJECTION_V2||g.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||g.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||
    canonicalHash(json(spec.parentGrant.file))!==canonicalHash(parent)||g.approvalReference!==parent.approvalReference||g.approvedBy!==parent.approvedBy||g.approvedAt!==parent.approvedAt||
    canonicalHash(g.profile)!==canonicalHash(parent.profile)||canonicalHash(g.credentials)!==canonicalHash(parent.credentials)||g.readerId!==parent.readerId||g.source.root!==parent.source.root||
    g.maximumMicroUsd!==parent.maximumMicroUsd||g.maximumCalls!==parent.maximumCalls||canonicalHash(parentAuthority.budget.steps)!==canonicalHash(localLocationRepairSteps()))engineSiteFail('local_locations_v2_scope');
  const normalized=(s:string)=>path.resolve(s).toLowerCase(),destination=normalized(g.directory),child=repair.child;
  if(path.resolve(g.directory)!==g.directory||[parent.directory,repair.parent.directory,child.parent.directory,child.media.parent.directory,child.media.recovery.failed.directory,child.media.recovery.parent.parent.directory]
    .some(d=>{const old=normalized(d);return destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep);} ))engineSiteFail('local_locations_v2_scope');
  const {root}=assertLocalLocationV2RepairEvidence(spec),stop=json(spec.parentStop.file),exit=json(spec.parentExit.file),running=json(path.join(root,'RUNNING.json'));
  if(root!==parent.directory||path.dirname(spec.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_reference_sheet_held'||stop.phase!=='native'||stop.grantSha256!==spec.parentGrant.sha256||
    exit.code!==1||exit.signal!==null||exit.errorCode!==undefined||exit.outcomeExists!==false||!Number.isSafeInteger(exit.childPid)||exit.childPid<1||running.pid!==exit.childPid||running.grantSha256!==spec.parentGrant.sha256||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_locations_v2_terminal');
  try{process.kill(exit.childPid,0);engineSiteFail('local_locations_v2_process_alive');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
  const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
  if(canonicalHash(checkpoint.authority)!==canonicalHash(parentAuthority)||checkpoint.phase!=='native'||checkpoint.snapshotSha256!==repair.checkpoint.snapshotSha256||checkpoint.ownerId!==repair.checkpoint.ownerId||
    checkpoint.draftId!==repair.checkpoint.draftId||canonicalHash(Object.keys(checkpoint.outputs))!==canonicalHash(['prepared_source']))engineSiteFail('local_locations_v2_authority');
  const journal=readLocalSettledJournal(root,checkpoint,priorSteps,new Set(priorSteps),(step,r)=>{const raw=r.raw as any;return step==='sheet_locations_1'?r.model==='gpt-image-2'?auditionUsageCost(raw.usage,'image'):null:
    raw.model==='gpt-6.1-sol'&&raw.service_tier==='default'?auditionUsageCost(raw.usage,'sol'):null;});
  if(canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(repair.carried))engineSiteFail('local_locations_v2_carry');
  const known=repair.carried.accountedMicroUsd+journal.known,calls=repair.carried.logicalCalls+journal.results.size,m=stop.meter;
  if(!Number.isSafeInteger(known)||known>=g.maximumMicroUsd||calls>=g.maximumCalls||m?.accountedMicroUsd!==known||m?.knownEstimateMicroUsd!==known||m?.logicalCalls!==calls||
    m?.carriedMicroUsd!==repair.carried.accountedMicroUsd||m?.carriedCalls!==repair.carried.logicalCalls||m?.pendingCalls!==0||m?.unknownCalls!==0||m?.failedCalls!==0||m?.overReservedCalls!==0||m?.lostLocalCalls!==0||m?.blocked!==false)engineSiteFail('local_locations_v2_meter');
  const parentBinding={version:'engine-local-book-claim/v1',grantFile:spec.parentGrant.file,grantSha256:spec.parentGrant.sha256,authoritySha256:canonicalHash(parentAuthority),directory:parent.directory,sourceRoot:parent.source.root,
    locationsRepairContinuation:parent.locationsRepairContinuation,carried:repair.carried,boundary:'one_locations_repair_then_media'};
  const checkClaims=()=>{repair.checkClaims();assertLocalLocationV2RepairEvidence(spec);if(sha(bytes(masterFile+'.locations-repair-v1.json'))!==spec.parentClaimSha256||canonicalHash(json(masterFile+'.locations-repair-v1.json'))!==canonicalHash(parentBinding))engineSiteFail('local_locations_v2_claim_chain');
    for(const [step,{claim}]of journal.claims){const wanted={version:'engine-local-locations-repair-dispatch/v1',executionSha256:canonicalHash(parentBinding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd};
      if(canonicalHash(json(masterFile+'.locations-repair-v1.'+step+'.dispatch.json'))!==canonicalHash(wanted))engineSiteFail('local_locations_v2_claim_chain');}};
  checkClaims();const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec,parentCarry:repair.carried})});
  const value=Object.freeze({spec,parent,repair,parentAuthority,checkpoint,journal,carried,checkClaims,masterFile});envelopes.add(value);return value;
}
export type LocalLocationV2RepairEnvelope=ReturnType<typeof loadLocalLocationV2Repair>;
export type AdmittedEngineLocationV2RepairPreparation={readonly prepared:any;readonly initialPreparation:AdmittedEngineInitialPreparation;readonly entities:EngineNativeSheetObservation;
  readonly locations:EngineNativeSheetObservation;readonly previousLocationAttempts:readonly AuditionAttempt[];readonly origin:unknown};
const preparations=new WeakMap<object,{sha256:string;authoritySha256:string;ownerId:string;draftId:string;snapshotSha256:string;checkClaims:()=>void}>();
export function locationV2RepairFindings(attempt:AuditionAttempt){const a=attempt.assessment;
  if(attempt.attempt!==1||attempt.status!=='held'||!attempt.candidate||!attempt.review||!a||a.invalidCitations||a.safetyBlocked)engineSiteFail('local_locations_v2_not_repairable');
  const findings=a.findings.filter(f=>f.impact!=='detail');if(!findings.length||findings.some(f=>!f.bound||f.impact==='safety'))engineSiteFail('local_locations_v2_not_repairable');return findings;}
function assertScope(a:EngineOrderAuthority){if(a.purpose!=='test'||a.locationSheetPolicy!==LOCATION_SHEET_PROJECTION_V2||a.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||a.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||
  canonicalHash(a.budget.steps)!==canonicalHash(localLocationV2RepairSteps()))engineSiteFail('local_locations_v2_scope');}
export function assertEngineLocationV2RepairPreparation(cap:AdmittedEngineLocationV2RepairPreparation,authority:EngineOrderAuthority,checkpoint:Pick<EngineRuntime['checkpoint'],'ownerId'|'draftId'>,cached?:any,snapshot?:Snapshot){
  assertScope(authority);const r=preparations.get(cap);if(!r||r.sha256!==canonicalHash(cap)||r.authoritySha256!==canonicalHash(authority)||r.ownerId!==checkpoint.ownerId||r.draftId!==checkpoint.draftId||(snapshot&&r.snapshotSha256!==canonicalHash(snapshot)))engineSiteFail('local_locations_v2_preparation_changed');
  r.checkClaims();if(cached&&canonicalHash(cached)!==canonicalHash(cap.prepared))engineSiteFail('local_locations_v2_cache_changed');}
/** Rebuild all19 prior calls, then the actual2 v1 repair operations under their ORIGINAL authority. */
export async function replayLocalLocationV2Repair(chain:LocalLocationV2RepairEnvelope,snapshot:Snapshot,authority:EngineOrderAuthority){
  assertScope(authority);if(!envelopes.has(chain)||authority.orderId!==chain.parentAuthority.orderId||authority.requestSha256!==chain.parentAuthority.requestSha256||authority.optionsSha256!==chain.parentAuthority.optionsSha256||
    authority.budget.maximumMicroUsd!==chain.parentAuthority.budget.maximumMicroUsd||authority.budget.maximumCalls!==chain.parentAuthority.budget.maximumCalls)engineSiteFail('local_locations_v2_scope');
  chain.checkClaims();const old=await replayLocalLocationRepair(chain.repair,snapshot,chain.parentAuthority),used=new Set<string>(),observations:EngineNativeSheetObservation[]=[];let prepared:any,stopped='';
  const runtime:EngineRuntime={checkpoint:{...structuredClone(chain.checkpoint),phase:'story'},signal:new AbortController().signal,check:chain.checkClaims,load:async()=>null,result:denied,
    async save(name,value){if(name!=='prepared_source'||prepared||canonicalHash(value)!==canonicalHash(chain.journal.asset(chain.checkpoint.outputs.prepared_source)))engineSiteFail('local_locations_v2_replay_output');prepared=structuredClone(value);},
    async advance(phase){if(phase!=='native')engineSiteFail('local_locations_v2_replay_output');runtime.checkpoint.phase=phase;},
    async call(plan){chain.checkClaims();plan.revalidate?.();const saved=chain.journal.claims.get(plan.call.step),r=chain.journal.results.get(plan.call.step);
      if(used.has(plan.call.step)||!saved||!r||!plan.admitSaved||canonicalHash(saved.claim.call)!==canonicalHash(plan.call)||canonicalHash(plan.wire)!==saved.claim.call.wireSha256)engineSiteFail('local_locations_v2_wire');await plan.admitSaved(r);chain.checkClaims();used.add(plan.call.step);return r;}};
  try{await createEngineNativeRecipe({db:new Proxy({},{get:denied}) as PrismaClient,storage:{put:denied,read:denied,sign:denied},snapshot,locationsRepairPreparation:old,initialPreparation:old.initialPreparation,
    ports:{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},observeReferenceSheet(v){observations.push(v);}})(runtime);}catch(e){stopped=e&&typeof e==='object'&&'code'in e?String(e.code):e instanceof Error?e.message:'';}
  if(stopped!=='engine_reference_sheet_held'||!prepared||observations.length!==1||observations[0].role!=='locations'||canonicalHash([...used].sort())!==canonicalHash([...chain.journal.results.keys()].sort())||
    canonicalHash(prepared)!==canonicalHash(old.prepared)||observations[0].contextSha!==old.locations.contextSha||canonicalHash(observations[0].requirementIds)!==canonicalHash(old.locations.requirementIds))engineSiteFail('local_locations_v2_replay_changed');
  locationV2RepairFindings(observations[0].attempt);const owner=ownerSchema.parse(json(chain.spec.ownerAttemptAuthority.file));
  if(observations[0].attempt.candidate!.imageSha!==owner.targetImageSha256)engineSiteFail('local_locations_v2_target_changed');
  const origin={version:'engine-locations-v2-repair-parent/v1',parentGrantSha256:chain.spec.parentGrant.sha256,parentEvidenceSha256:chain.spec.parentEvidence.sha256,ownerAttemptAuthoritySha256:chain.spec.ownerAttemptAuthority.sha256,
    carried:chain.carried,previousAttempts:[0,1],nextAttempt:2,maximumNewReferenceCalls:2,maximumNewReferenceReservedMicroUsd:1_400_000};
  const cap=Object.freeze({prepared,initialPreparation:old.initialPreparation,entities:old.entities,locations:observations[0],previousLocationAttempts:structuredClone([old.locations.attempt,observations[0].attempt]),origin});
  preparations.set(cap,{sha256:canonicalHash(cap),authoritySha256:canonicalHash(authority),ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:canonicalHash(snapshot),checkClaims:chain.checkClaims});assertEngineLocationV2RepairPreparation(cap,authority,chain.checkpoint);return cap;
}
export async function preflightLocalLocationV2Repair(cap:AdmittedEngineLocationV2RepairPreparation,snapshot:Snapshot,authority:EngineOrderAuthority){const sentinel={},plans:any[]=[],runtime:EngineRuntime={checkpoint:{version:'engine-site-job/v1',authority,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:authority.requestSha256,phase:'story',calls:{},outputs:{},waiting:null},signal:new AbortController().signal,check(){},load:async()=>null,result:denied,save:async()=>{},advance:async p=>{runtime.checkpoint.phase=p;},call:async plan=>{plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw sentinel;}};
  try{await createEngineNativeRecipe({db:new Proxy({},{get:denied}) as PrismaClient,storage:{put:denied,read:denied,sign:denied},snapshot,locationsV2RepairPreparation:cap,initialPreparation:cap.initialPreparation,ports:{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied}})(runtime);}catch(e){if(e!==sentinel)throw e;}
  if(plans.length!==1||plans[0].call.step!=='sheet_locations_2')engineSiteFail('local_locations_v2_preflight');return plans[0];}
export function claimLocalLocationV2RepairExecution(chain:LocalLocationV2RepairEnvelope,binding:unknown,resume:boolean){if(!envelopes.has(chain))engineSiteFail('local_locations_v2_scope');chain.checkClaims();const file=chain.masterFile+'.locations-repair-v2.json';
  if(existsSync(file)){if(!resume||canonicalHash(json(file))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}else{if(resume)engineSiteFail('local_book_resume_without_claim');writeFileSync(file,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});}return file;}
export function assertLocalLocationV2RepairResumeState(directory:string,resume:boolean){if(resume&&['checkpoint.json','carry.json'].some(n=>!existsSync(path.join(directory,'journal',n))))engineSiteFail('local_locations_v2_resume_state_missing');}
export function localLocationV2RepairDispatchWitness(chain:LocalLocationV2RepairEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
  if(!envelopes.has(chain))engineSiteFail('local_locations_v2_scope');assertScope(authority);const executionFile=chain.masterFile+'.locations-repair-v2.json',executionSha256=canonicalHash(binding),authoritySha256=canonicalHash(authority);
  if(z.object({authoritySha256:digest}).passthrough().parse(binding).authoritySha256!==authoritySha256)engineSiteFail('local_locations_v2_dispatch_binding');
  const execution=()=>{if(canonicalHash(json(executionFile))!==executionSha256)engineSiteFail('local_locations_v2_dispatch_binding');};execution();
  const schema=z.object({version:z.literal('engine-local-locations-v2-repair-dispatch/v1'),executionSha256:digest,authoritySha256:digest,step:z.string(),claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
  const slot=(step:string)=>{const s=authority.budget.steps.find(s=>s.id===step);if(!s)engineSiteFail('local_locations_v2_dispatch_binding');return s;},file=(step:string)=>{slot(step);return chain.masterFile+'.locations-repair-v2.'+step+'.dispatch.json';};
  const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=schema.parse(json(f));if(r.executionSha256!==executionSha256||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_locations_v2_dispatch_binding');return r;};
  return{list(){chain.checkClaims();return authority.budget.steps.flatMap(s=>{const r=record(s.id);return r?[{step:s.id,claimSha256:r.claimSha256,maximumMicroUsd:r.maximumMicroUsd}]:[];});},
    check(step,claimSha256,dispatched){chain.checkClaims();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_locations_v2_unknown_dispatch');},
    begin(step,claimSha256){execution();chain.checkClaims();digest.parse(claimSha256);const f=file(step);if(existsSync(f))engineSiteFail('local_locations_v2_unknown_dispatch');writeFileSync(f,JSON.stringify({version:'engine-local-locations-v2-repair-dispatch/v1',executionSha256,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}};
}
export async function assertLocalLocationV2RepairRuntime(chain:LocalLocationV2RepairEnvelope,runtime:LocalEngineTrialRuntime){if(!envelopes.has(chain))engineSiteFail('local_locations_v2_scope');assertScope(runtime.checkpoint.authority);const m=await runtime.meter();chain.checkClaims();
  if(m.carriedMicroUsd!==chain.carried.accountedMicroUsd||m.carriedCalls!==chain.carried.logicalCalls||m.lostLocalCalls===undefined)engineSiteFail('local_locations_v2_carry');if(m.lostLocalCalls||m.blocked)engineSiteFail('local_locations_v2_local_state_lost');}
