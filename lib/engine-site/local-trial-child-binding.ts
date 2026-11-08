/** Re-admit a settled child anchor and the unchanged accepted world. No new planner or anchor call. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {PrismaClient} from '@prisma/client';
import {canonicalHash} from '@/lib/canonical-json';
import {auditionUsageCost} from '@/scripts/personal-simple-book-illustrator';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {assertLocalParentEvidence,readLocalSettledJournal} from './local-trial-continuation';
import {localSupportedMediaSteps,replayLocalSupportedPlan,type LocalSupportedPlanEnvelope} from './local-trial-supported-plan';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from './response-schema';
import {ENGINE_BOUND_REVIEW_STEP,ENGINE_STORYBOARD_BINDING} from './storyboard-binding-policy';
import {createEngineNativeRecipe,type EngineNativeChildPreparation} from './native-recipe';
import type {AdmittedEngineInitialPreparation} from './story-preparation';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';

type BindingSnapshot=Parameters<typeof import('./native-recipe').createEngineNativeRecipe>[0]['snapshot'];
const digest=z.string().regex(/^[a-f0-9]{64}$/),ref=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localChildBindingSchema=z.object({version:z.literal('engine-local-child-binding-continuation/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentEvidence:ref,parentClaimSha256:digest,boundary:z.literal('bound_media_only')}).strict();
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||realpathSync(file)!==file||s.size>64*1024*1024||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_child_binding_file');return readFileSync(file);}
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
const denied=():never=>engineSiteFail('local_child_binding_replay_dispatch_forbidden');
export function assertLocalChildBindingEvidence(spec:z.infer<typeof localChildBindingSchema>){
 const s=localChildBindingSchema.parse(spec);return assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
}
const oldSteps=['reference_child','reference_child_style_qa','reference_child_qa','prep_storyboard_0','prep_storyboard_0_review'];
const optionalSteps=['reference_child_repair','reference_child_repair_style_qa','reference_child_repair_qa'];
export function localChildBindingSteps(){return [{id:ENGINE_BOUND_REVIEW_STEP,maximumMicroUsd:1_200_000},...localSupportedMediaSteps().filter(s=>!s.id.startsWith('reference_child')&&s.id!=='photo_appearance'&&!s.id.startsWith('prep_storyboard_'))];}
const envelopes=new WeakSet<object>();
export function loadLocalChildBinding(g:LocalEngineGrant,parent:LocalEngineGrant,media:LocalSupportedPlanEnvelope,parentAuthority:EngineOrderAuthority,masterFile:string){
 const spec=localChildBindingSchema.parse(g.childBindingContinuation);
 if(g.continuation||g.planningRecovery||g.mediaContinuation||!parent.mediaContinuation||parent.childBindingContinuation||parent.storyboardBindingPolicy!==undefined||
  g.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||g.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||
  canonicalHash(json(spec.parentGrant.file))!==canonicalHash(parent)||g.approvalReference!==parent.approvalReference||g.approvedBy!==parent.approvedBy||g.approvedAt!==parent.approvedAt||
  canonicalHash(g.profile)!==canonicalHash(parent.profile)||canonicalHash(g.credentials)!==canonicalHash(parent.credentials)||g.readerId!==parent.readerId||g.source.root!==parent.source.root||
  g.maximumMicroUsd!==parent.maximumMicroUsd||g.maximumCalls!==parent.maximumCalls||canonicalHash(parentAuthority.budget.steps)!==canonicalHash(localSupportedMediaSteps()))engineSiteFail('local_child_binding_scope');
 const normalized=(s:string)=>path.resolve(s).toLowerCase(),destination=normalized(g.directory);
 if(path.resolve(g.directory)!==g.directory||[parent.directory,media.parent.directory,media.recovery.failed.directory,media.recovery.parent.parent.directory].some(d=>{const old=normalized(d);return destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep);}))engineSiteFail('local_child_binding_scope');
 const {root}=assertLocalChildBindingEvidence(spec),stop=json(spec.parentStop.file),exit=json(spec.parentExit.file),running=json(path.join(root,'RUNNING.json'));
 if(root!==parent.directory||path.dirname(spec.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_storyboard_held'||stop.phase!=='story'||stop.grantSha256!==spec.parentGrant.sha256||
  exit.code!==1||exit.signal!==null||exit.errorCode!==undefined||exit.outcomeExists!==false||!Number.isSafeInteger(exit.childPid)||exit.childPid<1||running.pid!==exit.childPid||running.grantSha256!==spec.parentGrant.sha256||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_child_binding_terminal');
 try{process.kill(exit.childPid,0);engineSiteFail('local_child_binding_process_alive');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(parentAuthority)||checkpoint.phase!=='story'||checkpoint.snapshotSha256!==media.checkpoint.snapshotSha256||
  checkpoint.ownerId!==media.checkpoint.ownerId||checkpoint.draftId!==media.checkpoint.draftId||Object.keys(checkpoint.outputs).length)engineSiteFail('local_child_binding_authority');
 const journal=readLocalSettledJournal(root,checkpoint,oldSteps,new Set([...oldSteps,...optionalSteps]),(step,r)=>{const raw=r.raw as any;
  return ['reference_child','reference_child_repair'].includes(step)?r.model==='gpt-image-2'?auditionUsageCost(raw.usage,'image'):null:
   raw.model==='gpt-6.1-sol'&&raw.service_tier==='default'?auditionUsageCost(raw.usage,'sol'):null;});
 const repairUsed=journal.results.has('reference_child_repair');
 if(optionalSteps.some(s=>journal.results.has(s)!==repairUsed)||canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(media.carried))engineSiteFail('local_child_binding_carry');
 const known=media.carried.accountedMicroUsd+journal.known,calls=media.carried.logicalCalls+journal.results.size,m=stop.meter;
 if(!Number.isSafeInteger(known)||known>=g.maximumMicroUsd||calls>=g.maximumCalls||m?.accountedMicroUsd!==known||m?.knownEstimateMicroUsd!==known||m?.logicalCalls!==calls||
  m?.carriedMicroUsd!==media.carried.accountedMicroUsd||m?.carriedCalls!==media.carried.logicalCalls||m?.pendingCalls!==0||m?.unknownCalls!==0||m?.failedCalls!==0||m?.overReservedCalls!==0||m?.lostLocalCalls!==0||m?.blocked!==false)engineSiteFail('local_child_binding_meter');
 const parentBinding={version:'engine-local-book-claim/v1',grantFile:spec.parentGrant.file,grantSha256:spec.parentGrant.sha256,authoritySha256:canonicalHash(parentAuthority),directory:parent.directory,sourceRoot:parent.source.root,mediaContinuation:parent.mediaContinuation,carried:media.carried,boundary:'media_only'};
 const checkClaims=()=>{media.checkClaims();assertLocalChildBindingEvidence(spec);
  if(sha(bytes(masterFile+'.media-continuation-v1.json'))!==spec.parentClaimSha256||canonicalHash(json(masterFile+'.media-continuation-v1.json'))!==canonicalHash(parentBinding))engineSiteFail('local_child_binding_claim_chain');
  for(const [step,{claim}]of journal.claims){const wanted={version:'engine-local-media-dispatch/v1',executionSha256:canonicalHash(parentBinding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd};
   if(canonicalHash(json(masterFile+'.media-continuation-v1.'+step+'.dispatch.json'))!==canonicalHash(wanted))engineSiteFail('local_child_binding_claim_chain');}
 };
 checkClaims();const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec,parentCarry:media.carried})});
 const value=Object.freeze({spec,parent,media,parentAuthority,checkpoint,journal,carried,checkClaims,masterFile});envelopes.add(value);return value;
}
export type LocalChildBindingEnvelope=ReturnType<typeof loadLocalChildBinding>;
export type AdmittedEngineChildBindingPreparation={readonly data:EngineNativeChildPreparation;readonly initialPreparation:AdmittedEngineInitialPreparation;readonly origin:unknown};
const preparations=new WeakMap<object,{sha256:string;authoritySha256:string;ownerId:string;draftId:string;snapshotSha256:string;checkClaims:()=>void}>();
export function assertEngineChildBindingPreparation(cap:AdmittedEngineChildBindingPreparation,authority:EngineOrderAuthority,checkpoint:Pick<EngineRuntime['checkpoint'],'ownerId'|'draftId'>,cached?:any,snapshot?:BindingSnapshot){
 const record=preparations.get(cap);
 if(!record||record.sha256!==canonicalHash(cap)||record.authoritySha256!==canonicalHash(authority)||record.ownerId!==checkpoint.ownerId||record.draftId!==checkpoint.draftId||authority.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||(snapshot&&record.snapshotSha256!==canonicalHash(snapshot)))engineSiteFail('local_child_binding_preparation_changed');
 record.checkClaims();
 if(cached){for(const [key,value]of Object.entries(cap.data))if(canonicalHash(cached[key]??null)!==canonicalHash(value))engineSiteFail('local_child_binding_cache_changed');
  if(canonicalHash(cached.childBindingParent)!==canonicalHash(cap.origin))engineSiteFail('local_child_binding_cache_changed');}
}
/** Complete old-authority replay, including the discarded held final plan. It is never used as the new parent. */
export async function replayLocalChildBinding(chain:LocalChildBindingEnvelope,snapshot:BindingSnapshot,authority:EngineOrderAuthority){
 if(!envelopes.has(chain)||authority.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||authority.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||canonicalHash(authority.budget.steps)!==canonicalHash(localChildBindingSteps())||
  authority.orderId!==chain.parentAuthority.orderId||authority.requestSha256!==chain.parentAuthority.requestSha256||authority.optionsSha256!==chain.parentAuthority.optionsSha256)engineSiteFail('local_child_binding_scope');
 chain.checkClaims();const initialPreparation=await replayLocalSupportedPlan(chain.media,snapshot),used=new Set<string>();
 let data:EngineNativeChildPreparation|undefined,observations=0;
 const runtime:EngineRuntime={checkpoint:structuredClone(chain.checkpoint),signal:new AbortController().signal,check(){chain.checkClaims();},load:async()=>null,save:denied,advance:denied,result:denied,
  async call(plan){chain.checkClaims();plan.revalidate?.();const saved=chain.journal.claims.get(plan.call.step),r=chain.journal.results.get(plan.call.step);
   if(used.has(plan.call.step)||!saved||!r||!plan.admitSaved||canonicalHash(saved.claim.call)!==canonicalHash(plan.call)||canonicalHash(plan.wire)!==saved.claim.call.wireSha256)engineSiteFail('local_child_binding_wire');
   await plan.admitSaved(r);chain.checkClaims();used.add(plan.call.step);return r;}};
 let stopped='';try{await createEngineNativeRecipe({db:new Proxy({},{get:denied}) as PrismaClient,storage:{put:denied,read:denied,sign:denied},snapshot,initialPreparation,
  ports:{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},observeChildPreparation(value){observations++;data=value;}})(runtime);
 }catch(e){stopped=e&&typeof e==='object'&&'code'in e?String(e.code):e instanceof Error?e.message:'';}
 if(stopped!=='engine_storyboard_held'||observations!==1||!data||canonicalHash([...used].sort())!==canonicalHash([...chain.journal.results.keys()].sort())||
  canonicalHash(data.source)!==canonicalHash(initialPreparation.source)||canonicalHash(data.readings)!==canonicalHash(initialPreparation.readings)||canonicalHash(data.initialDraft)!==canonicalHash(initialPreparation.initial.draft)||
  canonicalHash(data.initialReview)!==canonicalHash(initialPreparation.initial.diagnostic.rawReview)||canonicalHash(data.initialRepair??null)!==canonicalHash('initialRepair'in initialPreparation?initialPreparation.initialRepair:null))engineSiteFail('local_child_binding_replay_changed');
 const origin={version:'engine-child-binding-parent/v1',parentGrantSha256:chain.spec.parentGrant.sha256,parentEvidenceSha256:chain.spec.parentEvidence.sha256,parentClaimSha256:chain.spec.parentClaimSha256,
  carried:chain.carried,childImageSha256:data.child.imageSha,initialDraftSha256:canonicalHash(data.initialDraft),plannerInvoked:false};
 const cap=Object.freeze({data,initialPreparation,origin});preparations.set(cap,{sha256:canonicalHash(cap),authoritySha256:canonicalHash(authority),ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:canonicalHash(snapshot),checkClaims:chain.checkClaims});
 assertEngineChildBindingPreparation(cap,authority,chain.checkpoint);return cap;
}
/** Capture only the real first new review wire; no reply, provider, key, local execution claim or output. */
export async function preflightLocalChildBinding(cap:AdmittedEngineChildBindingPreparation,snapshot:BindingSnapshot,authority:EngineOrderAuthority){
 const sentinel={},plans:any[]=[];
 const runtime:EngineRuntime={checkpoint:{version:'engine-site-job/v1',authority,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:authority.requestSha256,phase:'story',calls:{},outputs:{},waiting:null},
  signal:new AbortController().signal,check(){},load:async()=>null,save:denied,advance:denied,result:denied,call:async plan=>{plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw sentinel;}};
 try{await createEngineNativeRecipe({db:new Proxy({},{get:denied}) as PrismaClient,storage:{put:denied,read:denied,sign:denied},snapshot,childBindingPreparation:cap,initialPreparation:cap.initialPreparation,ports:{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied}})(runtime);}catch(e){if(!plans.length)throw e;}
 if(plans.length!==1||plans[0].call.step!==ENGINE_BOUND_REVIEW_STEP)engineSiteFail('local_child_binding_preflight');return plans[0];
}
export function claimLocalChildBindingExecution(chain:LocalChildBindingEnvelope,binding:unknown,resume:boolean){
 if(!envelopes.has(chain))engineSiteFail('local_child_binding_scope');chain.checkClaims();const file=chain.masterFile+'.child-binding-v1.json';
 if(existsSync(file)){if(!resume||canonicalHash(json(file))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}
 else{if(resume)engineSiteFail('local_book_resume_without_claim');writeFileSync(file,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});}return file;
}
export function assertLocalChildBindingResumeState(directory:string,resume:boolean){if(resume&&['checkpoint.json','carry.json'].some(n=>!existsSync(path.join(directory,'journal',n))))engineSiteFail('local_child_binding_resume_state_missing');}
export function localChildBindingDispatchWitness(chain:LocalChildBindingEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 if(!envelopes.has(chain)||authority.purpose!=='test'||authority.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||authority.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||canonicalHash(authority.budget.steps)!==canonicalHash(localChildBindingSteps()))engineSiteFail('local_child_binding_scope');
 const executionFile=chain.masterFile+'.child-binding-v1.json',executionSha256=canonicalHash(binding),authoritySha256=canonicalHash(authority);
 if(z.object({authoritySha256:digest}).passthrough().parse(binding).authoritySha256!==authoritySha256)engineSiteFail('local_child_binding_dispatch_binding');
 const execution=()=>{if(canonicalHash(json(executionFile))!==executionSha256)engineSiteFail('local_child_binding_dispatch_binding');};execution();
 const schema=z.object({version:z.literal('engine-local-child-binding-dispatch/v1'),executionSha256:digest,authoritySha256:digest,step:z.string(),claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
 const slot=(step:string)=>{const s=authority.budget.steps.find(s=>s.id===step);if(!s)engineSiteFail('local_child_binding_dispatch_binding');return s;};
 const file=(step:string)=>{slot(step);return chain.masterFile+'.child-binding-v1.'+step+'.dispatch.json';};
 const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=schema.parse(json(f));if(r.executionSha256!==executionSha256||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_child_binding_dispatch_binding');return r;};
 return {list:()=>{chain.checkClaims();return authority.budget.steps.map(s=>record(s.id)).filter((r):r is NonNullable<typeof r>=>r!==null);},
  check(step,claimSha256,dispatched){chain.checkClaims();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_child_binding_unknown_dispatch');},
  begin(step,claimSha256){execution();chain.checkClaims();digest.parse(claimSha256);const f=file(step);if(existsSync(f))engineSiteFail('local_child_binding_unknown_dispatch');writeFileSync(f,JSON.stringify({version:'engine-local-child-binding-dispatch/v1',executionSha256,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}};
}
export async function assertLocalChildBindingRuntime(chain:LocalChildBindingEnvelope,runtime:LocalEngineTrialRuntime){
 if(!envelopes.has(chain)||canonicalHash(runtime.checkpoint.authority.budget.steps)!==canonicalHash(localChildBindingSteps()))engineSiteFail('local_child_binding_scope');const m=await runtime.meter();chain.checkClaims();
 if(m.carriedMicroUsd!==chain.carried.accountedMicroUsd||m.carriedCalls!==chain.carried.logicalCalls||m.lostLocalCalls===undefined)engineSiteFail('local_child_binding_carry');if(m.lostLocalCalls||m.blocked)engineSiteFail('local_child_binding_local_state_lost');
}
