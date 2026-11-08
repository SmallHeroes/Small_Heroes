/** Local media admission of a terminal, raw-replayed supported final plan. No provider/key access. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {assertLocalParentEvidence,readLocalSettledJournal} from './local-trial-continuation';
import {replayLocalPlanRecovery,localPlanRecoverySteps,type LocalPlanRecoveryEnvelope} from './local-trial-plan-recovery';
import {engineRecipeSteps} from './platform-policy';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from './response-schema';
import {admitEngineSupportedInitialPreparation,assertEngineInitialPreparation,type StorySnapshot,type AdmittedEngineInitialPreparation} from './story-preparation';
import {createEngineNativeRecipe} from './native-recipe';
import type {PrismaClient} from '@prisma/client';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';

const digest=z.string().regex(/^[a-f0-9]{64}$/),ref=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localSupportedPlanSchema=z.object({version:z.literal('engine-local-supported-plan-continuation/v1'),
 parentGrant:ref,parentOutcome:ref,parentExit:ref,parentEvidence:ref,recoveryClaimSha256:digest,boundary:z.literal('media_only')}).strict();
export type LocalSupportedPlan=z.infer<typeof localSupportedPlanSchema>;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||realpathSync(file)!==file||s.size>64*1024*1024||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_supported_plan_file');return readFileSync(file);}
const json=(f:string)=>JSON.parse(bytes(f).toString('utf8'));
const denied=():never=>engineSiteFail('local_supported_plan_replay_dispatch_forbidden');
export function assertLocalSupportedPlanEvidence(spec:LocalSupportedPlan){
 const s=localSupportedPlanSchema.parse(spec);
 // This shared verifier checks only exact pinned files and the complete tree; outcome semantics are below.
 return assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentOutcome,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
}
const initialSteps=new Set(['story_author','story_editor','story_final_review','story_final_review_citation','story_comparison','story_comparison_citation',
 'initial_storyboard','initial_storyboard_review','initial_storyboard_repair_1','initial_storyboard_repair_1_review','initial_storyboard_repair_2','initial_storyboard_repair_2_review']);
export function localSupportedMediaSteps(){return engineRecipeSteps().filter(s=>!initialSteps.has(s.id));}
const envelopes=new WeakSet<object>();
export function loadLocalSupportedPlan(g:LocalEngineGrant,parent:LocalEngineGrant,recovery:LocalPlanRecoveryEnvelope,parentAuthority:EngineOrderAuthority,masterFile:string){
 const spec=localSupportedPlanSchema.parse(g.mediaContinuation);
 if(g.continuation||g.planningRecovery||!parent.planningRecovery||parent.continuation||parent.mediaContinuation||g.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||
  canonicalHash(json(spec.parentGrant.file))!==canonicalHash(parent)||g.approvalReference!==parent.approvalReference||g.approvedBy!==parent.approvedBy||g.approvedAt!==parent.approvedAt||
  canonicalHash(g.profile)!==canonicalHash(parent.profile)||canonicalHash(g.credentials)!==canonicalHash(parent.credentials)||g.readerId!==parent.readerId||g.source.root!==parent.source.root||
  g.maximumMicroUsd!==parent.maximumMicroUsd||g.maximumCalls!==parent.maximumCalls||canonicalHash(parentAuthority.budget.steps)!==canonicalHash(localPlanRecoverySteps()))engineSiteFail('local_supported_plan_scope');
 const normalize=(s:string)=>path.resolve(s).toLowerCase(),destination=normalize(g.directory);
 if(path.resolve(g.directory)!==g.directory||[parent.directory,recovery.failed.directory,recovery.parent.parent.directory].some(d=>{const old=normalize(d);return old===destination||old.startsWith(destination+path.sep)||destination.startsWith(old+path.sep);}))engineSiteFail('local_supported_plan_scope');
 const {root}=assertLocalSupportedPlanEvidence(spec),outcome=json(spec.parentOutcome.file),exit=json(spec.parentExit.file),running=json(path.join(root,'RUNNING.json'));
 if(root!==parent.directory||path.dirname(spec.parentOutcome.file)!==root||outcome.version!=='engine-local-plan-outcome/v1'||outcome.status!=='plan_review_supported'||
  outcome.grantSha256!==spec.parentGrant.sha256||outcome.authoritySha256!==canonicalHash(parentAuthority)||outcome.sourceRevision!==parent.source.head||
  outcome.previousAttempts!==2||outcome.attempt!==3||outcome.maximumAttempts!==3||outcome.bookCreated!==false||outcome.productAccepted!==false||outcome.productionQualified!==false||
  outcome.illustrationsCreated!==0||outcome.narrationCreated!==0||exit.code!==0||exit.signal!==null||exit.errorCode!==undefined||exit.planOutcomeExists!==true||
  !Number.isSafeInteger(exit.childPid)||exit.childPid<1||running.pid!==exit.childPid||running.grantSha256!==spec.parentGrant.sha256||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_supported_plan_terminal');
 try{process.kill(exit.childPid,0);engineSiteFail('local_supported_plan_process_alive');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(parentAuthority)||checkpoint.phase!=='story'||checkpoint.snapshotSha256!==recovery.checkpoint.snapshotSha256||
  checkpoint.ownerId!==recovery.checkpoint.ownerId||checkpoint.draftId!==recovery.checkpoint.draftId||canonicalHash(Object.keys(checkpoint.outputs))!==canonicalHash(['recovery_plan']))engineSiteFail('local_supported_plan_authority');
 const steps=localPlanRecoverySteps().map(s=>s.id),journal=readLocalSettledJournal(root,checkpoint,steps,new Set(steps));
 if(canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(recovery.carried)||canonicalHash(outcome.carried)!==canonicalHash(recovery.carried))engineSiteFail('local_supported_plan_carry');
 const known=recovery.carried.accountedMicroUsd+journal.known,calls=recovery.carried.logicalCalls+journal.results.size,m=outcome.meter;
 if(!Number.isSafeInteger(known)||known>=g.maximumMicroUsd||calls>=g.maximumCalls||m?.accountedMicroUsd!==known||m?.knownEstimateMicroUsd!==known||m?.logicalCalls!==calls||
  m?.carriedMicroUsd!==recovery.carried.accountedMicroUsd||m?.carriedCalls!==recovery.carried.logicalCalls||m?.pendingCalls!==0||m?.unknownCalls!==0||m?.failedCalls!==0||
  m?.overReservedCalls!==0||m?.lostLocalCalls!==0||m?.blocked!==false)engineSiteFail('local_supported_plan_meter');
 const recoveryBinding={version:'engine-local-book-claim/v1',grantFile:spec.parentGrant.file,grantSha256:spec.parentGrant.sha256,authoritySha256:canonicalHash(parentAuthority),
  directory:parent.directory,sourceRoot:parent.source.root,planningRecovery:parent.planningRecovery,carried:recovery.carried,attempt:3,maximumAttempts:3,boundary:'plan_review_only'};
 const checkClaims=()=>{
  recovery.checkClaims();assertLocalSupportedPlanEvidence(spec);const execution=masterFile+'.plan-recovery-v1.json';
  if(sha(bytes(execution))!==spec.recoveryClaimSha256||canonicalHash(json(execution))!==canonicalHash(recoveryBinding))engineSiteFail('local_supported_plan_claim_chain');
  for(const step of steps){const claim=journal.claims.get(step)!.claim;
   const wanted={version:'engine-local-plan-dispatch/v1',executionSha256:canonicalHash(recoveryBinding),authoritySha256:canonicalHash(parentAuthority),step,claimSha256:canonicalHash(claim),maximumMicroUsd:claim.call.maximumMicroUsd};
   if(canonicalHash(json(masterFile+'.plan-recovery-v1.'+step+'.dispatch.json'))!==canonicalHash(wanted))engineSiteFail('local_supported_plan_claim_chain');
  }
 };
 checkClaims();const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec,parentCarry:recovery.carried})});
 const value=Object.freeze({spec,parent,recovery,parentAuthority,checkpoint,journal,outcome,carried,checkClaims,masterFile});envelopes.add(value);return value;
}
export type LocalSupportedPlanEnvelope=ReturnType<typeof loadLocalSupportedPlan>;
export async function replayLocalSupportedPlan(chain:LocalSupportedPlanEnvelope,snapshot:StorySnapshot){
 if(!envelopes.has(chain))engineSiteFail('local_supported_plan_envelope_changed');chain.checkClaims();
 const old=await replayLocalPlanRecovery(chain.recovery,snapshot,chain.parentAuthority),used=new Set<string>();
 const runtime:EngineRuntime={checkpoint:structuredClone(chain.checkpoint),signal:new AbortController().signal,check(){},load:async()=>null,save:denied,advance:denied,result:denied,
  async call(plan){chain.checkClaims();plan.revalidate?.();const saved=chain.journal.claims.get(plan.call.step),r=chain.journal.results.get(plan.call.step);
   if(used.has(plan.call.step)||!saved||!r||!plan.admitSaved||canonicalHash(saved.claim.call)!==canonicalHash(plan.call)||canonicalHash(plan.wire)!==saved.claim.call.wireSha256)engineSiteFail('local_supported_plan_wire');
   await plan.admitSaved(r);chain.checkClaims();used.add(plan.call.step);return r;
  }};
 const cap=await admitEngineSupportedInitialPreparation(runtime,snapshot,old.initialPreparation,old.repair);
 const expected={version:'engine-local-plan-result/v1',status:'plan_review_supported',source:cap.source,readings:cap.readings,draft:cap.initial.draft,diagnostic:cap.initial.diagnostic,
  previousAttempts:2,attempt:3,maximumAttempts:3,carried:chain.recovery.carried,illustrationsCreated:0,narrationCreated:0,bookCreated:false,productAccepted:false,independentQA:'pending'};
 const saved=chain.journal.asset(chain.checkpoint.outputs.recovery_plan),terminal={...chain.outcome};
 for(const k of ['completedAt','grantSha256','authoritySha256','sourceRevision','meter','productionQualified'])delete terminal[k];terminal.version='engine-local-plan-result/v1';
 if(used.size!==2||canonicalHash(saved)!==canonicalHash(expected)||canonicalHash(terminal)!==canonicalHash(expected))engineSiteFail('local_supported_plan_output_changed');
 chain.checkClaims();return cap;
}
/** Capture the first real media wire without constructing a provider or making any call. */
export async function preflightLocalSupportedMedia(cap:AdmittedEngineInitialPreparation,snapshot:Parameters<typeof createEngineNativeRecipe>[0]['snapshot'],authority:EngineOrderAuthority){
 const deniedPort=():never=>engineSiteFail('local_supported_media_preflight_dispatch_forbidden'),sentinel={},plans:unknown[]=[];
 const runtime:EngineRuntime={checkpoint:{version:'engine-site-job/v1',authority,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:authority.requestSha256,phase:'story',calls:{},outputs:{},waiting:null},
  signal:new AbortController().signal,check(){},load:async()=>null,save:deniedPort,advance:deniedPort,result:deniedPort,
  call:async plan=>{plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw sentinel;}};
 assertEngineInitialPreparation(cap,authority,runtime.checkpoint);
 const db=new Proxy({},{get:deniedPort}) as PrismaClient;
 try{await createEngineNativeRecipe({db,storage:{put:deniedPort,read:deniedPort,sign:deniedPort},snapshot,initialPreparation:cap,ports:{fetch:deniedPort,openAIKey:deniedPort,anthropicKey:deniedPort,image:deniedPort}})(runtime);}catch(e){if(e!==sentinel)throw e;}
 if(plans.length!==1||(plans[0] as {call:{step:string}}).call.step!=='reference_child')engineSiteFail('local_supported_media_preflight');return plans[0];
}
export function claimLocalSupportedMediaExecution(chain:LocalSupportedPlanEnvelope,binding:unknown,resume:boolean){
 if(!envelopes.has(chain))engineSiteFail('local_supported_plan_envelope_changed');chain.checkClaims();const file=chain.masterFile+'.media-continuation-v1.json';
 if(existsSync(file)){if(!resume||canonicalHash(json(file))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}
 else{if(resume)engineSiteFail('local_book_resume_without_claim');writeFileSync(file,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});}return file;
}
export function assertLocalSupportedMediaResumeState(directory:string,resume:boolean){
 if(resume&&['checkpoint.json','carry.json'].some(n=>!existsSync(path.join(directory,'journal',n))))engineSiteFail('local_supported_media_resume_state_missing');
}
export function localSupportedMediaDispatchWitness(chain:LocalSupportedPlanEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 if(!envelopes.has(chain)||authority.purpose!=='test'||authority.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||canonicalHash(authority.budget.steps)!==canonicalHash(localSupportedMediaSteps()))engineSiteFail('local_supported_media_scope');
 const executionFile=chain.masterFile+'.media-continuation-v1.json',executionSha256=canonicalHash(binding),authoritySha256=canonicalHash(authority);
 if(z.object({authoritySha256:digest}).passthrough().parse(binding).authoritySha256!==authoritySha256)engineSiteFail('local_supported_media_dispatch_binding');
 const execution=()=>{if(canonicalHash(json(executionFile))!==executionSha256)engineSiteFail('local_supported_media_dispatch_binding');};execution();
 const schema=z.object({version:z.literal('engine-local-media-dispatch/v1'),executionSha256:digest,authoritySha256:digest,step:z.string(),claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
 const slot=(step:string)=>{const s=authority.budget.steps.find(s=>s.id===step);if(!s)engineSiteFail('local_supported_media_dispatch_binding');return s;};
 const file=(step:string)=>{slot(step);return chain.masterFile+'.media-continuation-v1.'+step+'.dispatch.json';};
 const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=schema.parse(json(f));
  if(r.executionSha256!==executionSha256||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_supported_media_dispatch_binding');return r;};
 return {list:()=>{chain.checkClaims();return authority.budget.steps.map(s=>record(s.id)).filter((r):r is NonNullable<typeof r>=>r!==null);},
  check(step,claimSha256,dispatched){const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_supported_media_unknown_dispatch');},
  begin(step,claimSha256){execution();chain.checkClaims();digest.parse(claimSha256);const f=file(step);if(existsSync(f))engineSiteFail('local_supported_media_unknown_dispatch');
   writeFileSync(f,JSON.stringify({version:'engine-local-media-dispatch/v1',executionSha256,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}
 };
}
export async function assertLocalSupportedMediaRuntime(chain:LocalSupportedPlanEnvelope,runtime:LocalEngineTrialRuntime){
 if(!envelopes.has(chain)||canonicalHash(runtime.checkpoint.authority.budget.steps)!==canonicalHash(localSupportedMediaSteps()))engineSiteFail('local_supported_media_scope');
 const m=await runtime.meter();chain.checkClaims();
 if(m.carriedMicroUsd!==chain.carried.accountedMicroUsd||m.carriedCalls!==chain.carried.logicalCalls||m.lostLocalCalls===undefined)engineSiteFail('local_supported_media_carry');
 if(m.lostLocalCalls||m.blocked)engineSiteFail('local_supported_media_local_state_lost');
}
