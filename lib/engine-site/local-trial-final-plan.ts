/** Last BASE planning attempt for a settled current-policy child, then the existing native book. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {STORYBOARD_MAX_ATTEMPTS} from '@/lib/personal-wizard/storyboard-diagnosis';
import {PREPARATION_SLOTS} from '@/lib/personal-wizard/source-preparation-policy';
import type {StoryboardRepair} from '@/lib/personal-wizard/storyboard-repair';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {engineRecipeSteps} from './platform-policy';
import {ENGINE_BOUND_REVIEW_STEP} from './storyboard-binding-policy';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from './response-schema';
import {ENGINE_STORYBOARD_BINDING} from './storyboard-binding-policy';
import {LOCATION_SHEET_PROJECTION_V2} from '@/lib/personal-wizard/location-sheet-projection';
import {assertLocalParentEvidence,readLocalSettledJournal,replayLocalInitialPreparation,type LocalParentEnvelope} from './local-trial-continuation';
import {assertLocalCurrentContinuationEnvelope,type LocalCurrentContinuationEnvelope} from './local-trial-current-continuation';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';
import {admitEngineHeldInitialRepair,admitEngineSupportedInitialPreparation,assertEngineInitialPreparation,prepareEngineStoryboard,engineStoryboardSupported,type StorySnapshot} from './story-preparation';
import {LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD} from './local-trial-recovery-policy';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';
import type {EngineProviderPorts} from './provider-plans';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute),ref=z.object({file:absolute,sha256:digest}).strict();
export const localCurrentFinalPlanSchema=z.object({version:z.literal('engine-local-current-final-plan-book/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentStart:ref,parentEvidence:ref,parentExecutionClaim:ref,parentGlobalClaim:ref}).strict();
export type LocalCurrentFinalPlan=z.infer<typeof localCurrentFinalPlanSchema>;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_final_private_path');const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024||realpathSync(file)!==file)engineSiteFail('local_final_file');return readFileSync(file);}
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
function pinned(r:z.infer<typeof ref>){const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_final_evidence_changed');return JSON.parse(b.toString('utf8'));}
export function assertLocalCurrentFinalPlanEvidence(spec:LocalCurrentFinalPlan){
 const s=localCurrentFinalPlanSchema.parse(spec),tree=assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
 const start=pinned(s.parentStart);pinned(start.envelope);pinned(s.parentExecutionClaim);pinned(s.parentGlobalClaim);const failed=pinned(s.parentGrant) as LocalEngineGrant;pinned(failed.ownerApproval);return tree;
}
/** No old source/planner slot is prospective. Current native bound-child/media policy is retained. */
export function localCurrentFinalPlanSteps(){return [...engineRecipeSteps().filter(s=>!s.id.startsWith('story_')&&!s.id.startsWith('initial_storyboard')&&!s.id.startsWith('prep_storyboard_')),
 {id:ENGINE_BOUND_REVIEW_STEP,maximumMicroUsd:PREPARATION_SLOTS[1]},
 {id:'initial_storyboard_repair_2',maximumMicroUsd:LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD},{id:'initial_storyboard_repair_2_review',maximumMicroUsd:PREPARATION_SLOTS[1]}];}
const envelopes=new WeakSet<object>();
/** Caller recomputed the failed current child's OLD authority; no claim or credential access occurs here. */
export function loadLocalCurrentFinalPlan(g:LocalEngineGrant,failed:LocalEngineGrant,parent:LocalParentEnvelope,failedAuthority:EngineOrderAuthority,current:LocalCurrentContinuationEnvelope){
 const s=localCurrentFinalPlanSchema.parse(g.currentFinalPlan);assertLocalCurrentContinuationEnvelope(current);
 if(!failed.currentContinuation||failed.currentFinalPlan||failed.currentAttemptExtension||failed.freshBookPolicy||failed.startupRecovery||failed.continuation||failed.planningRecovery||failed.mediaContinuation||failed.childBindingContinuation||failed.locationsRepairContinuation||failed.locationsV2RepairContinuation||
  g.currentAttemptExtension||g.currentContinuation||g.freshBookPolicy||g.startupRecovery||g.continuation||g.planningRecovery||g.mediaContinuation||g.childBindingContinuation||g.locationsRepairContinuation||g.locationsV2RepairContinuation||
  canonicalHash(pinned(s.parentGrant))!==canonicalHash(failed)||!g.imageModelPolicy||canonicalHash(g.imageModelPolicy)!==canonicalHash(failed.imageModelPolicy)||
  canonicalHash(g.profile)!==canonicalHash(failed.profile)||canonicalHash(g.credentials)!==canonicalHash(failed.credentials)||g.readerId!==failed.readerId||g.source.root!==failed.source.root||
  g.approvalReference!==failed.approvalReference||g.approvedBy!==failed.approvedBy||g.approvedAt!==failed.approvedAt||g.maximumMicroUsd!==failed.maximumMicroUsd||g.maximumCalls!==failed.maximumCalls||
  g.responseSchemaPolicy!==failed.responseSchemaPolicy||g.storyboardBindingPolicy!==failed.storyboardBindingPolicy||g.locationSheetPolicy!==failed.locationSheetPolicy)engineSiteFail('local_final_scope');
 const destination=path.resolve(g.directory).toLowerCase();for(const dir of [failed.directory,parent.parent.directory]){const old=path.resolve(dir).toLowerCase();if(destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep))engineSiteFail('local_final_destination');}
 const {root}=assertLocalCurrentFinalPlanEvidence(s),stop=pinned(s.parentStop),exit=pinned(s.parentExit),start=pinned(s.parentStart);
 if(root!==failed.directory||path.dirname(s.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_storyboard_held'||stop.phase!=='story'||stop.grantSha256!==s.parentGrant.sha256||
  exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.supervisorExitCode!==1||exit.completionStatus!=='native_failed'||exit.completionReason!=='native_exit_failure'||
  start.childPid!==exit.childPid||start.grantSha256!==s.parentGrant.sha256||start.sourceHead!==failed.source.head||!Number.isFinite(Date.parse(start.at))||!Number.isFinite(Date.parse(exit.at))||
  Date.parse(exit.at)>Date.now()||Date.parse(exit.at)<Date.parse(start.at)||!Number.isFinite(Date.parse(stop.at))||Date.parse(stop.at)<Date.parse(start.at)||Date.parse(stop.at)>Date.parse(exit.at)||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_final_terminal');
 assertLocalHistoricalProcessGone(exit.childPid,exit.at);assertLocalHistoricalProcessGone(start.pid,exit.at);
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(failedAuthority)||checkpoint.phase!=='story'||Object.keys(checkpoint.outputs).length||checkpoint.snapshotSha256!==parent.checkpoint.snapshotSha256||checkpoint.ownerId!==parent.checkpoint.ownerId||checkpoint.draftId!==parent.checkpoint.draftId)engineSiteFail('local_final_authority');
 const journal=readLocalSettledJournal(root,checkpoint,['initial_storyboard_repair_1','initial_storyboard_repair_1_review'],new Set(['initial_storyboard_repair_1','initial_storyboard_repair_1_review']));
 if(canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(parent.carried))engineSiteFail('local_final_carry');
 const known=parent.carried.accountedMicroUsd+journal.known,calls=parent.carried.logicalCalls+journal.results.size,m=stop.meter;
 if(m?.accountedMicroUsd!==known||m.knownEstimateMicroUsd!==known||m.logicalCalls!==calls||m.carriedMicroUsd!==parent.carried.accountedMicroUsd||m.carriedCalls!==parent.carried.logicalCalls||
  m.pendingCalls!==0||m.unknownCalls!==0||m.failedCalls!==0||m.overReservedCalls!==0||m.blocked!==false||known+LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD+PREPARATION_SLOTS[1]>g.maximumMicroUsd||calls+2>g.maximumCalls||
  Number(parent.results.has('initial_storyboard'))+Number(journal.results.has('initial_storyboard_repair_1'))!==2||STORYBOARD_MAX_ATTEMPTS!==3)engineSiteFail('local_final_meter_or_attempt');
 const parentBinding={version:'engine-local-book-claim/v1',grantFile:s.parentGrant.file,grantSha256:s.parentGrant.sha256,authoritySha256:canonicalHash(failedAuthority),directory:failed.directory,sourceRoot:failed.source.root,
  parentGrantSha256:failed.currentContinuation.parentGrant.sha256,carried:parent.carried,currentContinuationSha256:canonicalHash(failed.currentContinuation),boundary:'one_initial_repair_then_media'};
 const masterFile=current.masterFile,global=current.masterFile+'.continuation.json';
 const expectedGlobal=current.executionFile===global?parentBinding:{version:'engine-local-current-continuation-claim/v1',parentExecutionClaim:failed.currentContinuation.parentExecutionClaim,executionFile:current.executionFile,binding:parentBinding};
 if(s.parentExecutionClaim.file!==current.executionFile||s.parentGlobalClaim.file!==global)engineSiteFail('local_final_parent_claim');
 for(const r of Object.values(s))if(r&&typeof r==='object')Object.freeze(r);Object.freeze(s);
 const memory=()=>canonicalHash({failed,parentAuthority:parent.authority,parentCheckpoint:parent.checkpoint,parentClaims:[...parent.claims],parentResults:[...parent.results],checkpoint,claims:[...journal.claims],results:[...journal.results]}),memorySha=memory();
 const specSha=canonicalHash(s),checkChain=()=>{if(canonicalHash(g.currentFinalPlan)!==specSha)engineSiteFail('local_final_scope_changed');if(memory()!==memorySha)engineSiteFail('local_final_replay_state_changed');assertLocalCurrentFinalPlanEvidence(s);current.check();
  if(canonicalHash(pinned(s.parentExecutionClaim))!==canonicalHash(parentBinding)||canonicalHash(pinned(s.parentGlobalClaim))!==canonicalHash(expectedGlobal))engineSiteFail('local_final_parent_claim');};checkChain();
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec:s,rootCarry:parent.carried,attempt:3,maximumAttempts:3})});
 const value=Object.freeze({spec:s,failed,parent,checkpoint,journal,carried,checkChain,masterFile,executionFile:current.executionFile+'.continuation.json',globalFile:masterFile+'.current-final-plan-book-v1.json',previousAttempts:2 as const,nextAttempt:3 as const,maximumAttempts:3 as const});envelopes.add(value);return value;
}
export type LocalCurrentFinalPlanEnvelope=ReturnType<typeof loadLocalCurrentFinalPlan>;
export function assertLocalCurrentFinalPlanEnvelope(e:LocalCurrentFinalPlanEnvelope){if(!envelopes.has(e))engineSiteFail('local_final_envelope');e.checkChain();}
const preparations=new WeakSet<object>(),denied=():never=>engineSiteFail('local_final_replay_dispatch_forbidden');
function assertAuthority(a:EngineOrderAuthority){if(a.purpose!=='test'||a.storyboardAttemptExtension||!a.imageModelPolicy||a.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||a.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||a.locationSheetPolicy!==LOCATION_SHEET_PROJECTION_V2||canonicalHash(a.budget.steps)!==canonicalHash(localCurrentFinalPlanSteps()))engineSiteFail('local_final_execution_scope');}
/** Six old initial wires, then both old repair wires, under their original authorities. */
export async function replayLocalCurrentFinalPlan(e:LocalCurrentFinalPlanEnvelope,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 if(!envelopes.has(e))engineSiteFail('local_final_envelope');assertAuthority(authority);e.checkChain();const snapshotSha256=canonicalHash(snapshot);
 const initial=await replayLocalInitialPreparation(e.parent,snapshot),repair:StoryboardRepair={parentStoryboardDigest:initial.initial.diagnostic.storyboardDigest,draft:initial.initial.draft,review:initial.initial.diagnostic.rawReview,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true}},used=new Set<string>();
 const replay:EngineRuntime={checkpoint:structuredClone(e.checkpoint),signal:new AbortController().signal,check:()=>e.checkChain(),load:denied,save:denied,advance:denied,result:denied,async call(plan){const old=e.journal.claims.get(plan.call.step),r=e.journal.results.get(plan.call.step);plan.revalidate?.();if(!old||!r||used.has(plan.call.step)||canonicalHash(plan.call)!==canonicalHash(old.claim.call)||canonicalHash(plan.wire)!==old.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('local_final_old_wire');await plan.admitSaved(r);used.add(plan.call.step);return r;}};
 const held=await admitEngineHeldInitialRepair(replay,snapshot,initial,repair);if(used.size!==2)engineSiteFail('local_final_old_wire');
 const next:StoryboardRepair={parentStoryboardDigest:held.initial.diagnostic.storyboardDigest,draft:held.initial.draft,review:held.initial.diagnostic.rawReview,parentRepair:held.heldRepair,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true}};
 Object.freeze(next.parentCompile);Object.freeze(next);
 if(canonicalHash(snapshot)!==snapshotSha256)engineSiteFail('local_final_snapshot_changed');
 const value=Object.freeze({held,repair:next,snapshotSha256,authoritySha256:canonicalHash(authority),carried:e.carried});preparations.add(value);e.checkChain();return value;
}
export type AdmittedLocalCurrentFinalPlan=Awaited<ReturnType<typeof replayLocalCurrentFinalPlan>>;
function assertPrepared(v:AdmittedLocalCurrentFinalPlan,r:Pick<EngineRuntime,'checkpoint'>,snapshot:StorySnapshot){assertAuthority(r.checkpoint.authority);if(!preparations.has(v)||v.authoritySha256!==canonicalHash(r.checkpoint.authority))engineSiteFail('local_final_preparation');if(canonicalHash(snapshot)!==v.snapshotSha256)engineSiteFail('local_final_snapshot_changed');assertEngineInitialPreparation(v.held,r.checkpoint.authority,r.checkpoint);}
/** Exact new first wire before any execution claim/provider. */
export async function preflightLocalCurrentFinalPlan(v:AdmittedLocalCurrentFinalPlan,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 const checkpoint={version:'engine-site-job/v1' as const,authority,ownerId:v.held.ownerId,draftId:v.held.draftId,snapshotSha256:authority.requestSha256,phase:'story' as const,calls:{},outputs:{},waiting:null};assertPrepared(v,{checkpoint},snapshot);const plans:unknown[]=[];
 const runtime:EngineRuntime={checkpoint,signal:new AbortController().signal,check(){},load:denied,save:denied,advance:denied,result:denied,async call(plan){plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw Error('local_final_preflight_boundary');}};
 let reason='';try{await prepareEngineStoryboard(runtime,snapshot,v.held.source,{fetch:denied,openAIKey:denied,anthropicKey:denied},'initial_repair_2',undefined,v.repair);}catch(e){reason=e instanceof Error?e.message:String(e);}
 if(plans.length!==1)engineSiteFail(reason||'local_final_preflight');assertPrepared(v,{checkpoint},snapshot);return plans[0];
}
/** One planner/review; a HOLD never reaches the native media producer. The returned capability is raw-replayed. */
export async function runLocalCurrentFinalPlan(runtime:LocalEngineTrialRuntime,snapshot:StorySnapshot,v:AdmittedLocalCurrentFinalPlan,ports:EngineProviderPorts){
 const check=()=>{assertPrepared(v,runtime,snapshot);runtime.check();};check();const meter=await runtime.meter();check();if(meter.carriedMicroUsd!==v.carried.accountedMicroUsd||meter.carriedCalls!==v.carried.logicalCalls||meter.lostLocalCalls===undefined||meter.lostLocalCalls||meter.blocked)engineSiteFail('local_final_runtime_carry');
 const bound:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check,load:n=>runtime.load(n),save:(n,x)=>runtime.save(n,x),advance:p=>runtime.advance(p),result:s=>runtime.result(s),async call(plan){check();const answer=await runtime.call(plan);check();return answer;}};
 const result=await prepareEngineStoryboard(bound,snapshot,v.held.source,ports,'initial_repair_2',undefined,v.repair);check();if(!engineStoryboardSupported(result.diagnostic.status))engineSiteFail('engine_storyboard_held');
 const replay:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check:()=>runtime.check(),load:denied,save:denied,advance:denied,result:step=>runtime.result(step),async call(plan){plan.revalidate?.();const c=runtime.checkpoint.calls[plan.call.step],r=await runtime.result(plan.call.step);if(!c?.settled||c.wireSha256!==plan.call.wireSha256||!r||!plan.admitSaved)engineSiteFail('local_final_new_receipt');await plan.admitSaved(r);return r;}};
 const accepted=await admitEngineSupportedInitialPreparation(replay,snapshot,v.held,v.repair);check();return accepted;
}
export function claimLocalCurrentFinalPlan(e:LocalCurrentFinalPlanEnvelope,binding:unknown,resume:boolean,masterFile:string){
 if(!envelopes.has(e)||resume||masterFile!==e.masterFile)engineSiteFail('local_final_capability');e.checkChain();
 if([e.globalFile,e.executionFile,masterFile+'.plan-recovery-v1.json',masterFile+'.media-continuation-v1.json'].some(existsSync))engineSiteFail('local_final_already_claimed');
 const write=(f:string,x:unknown)=>writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
 write(e.globalFile,{version:'engine-local-current-final-plan-claim/v1',parentExecutionClaim:e.spec.parentExecutionClaim,executionFile:e.executionFile,binding});write(e.executionFile,binding);return e.executionFile;
}
/** Every prospective POST has a fixed witness outside the mutable journal, including media/audio. */
export function localCurrentFinalPlanDispatchWitness(e:LocalCurrentFinalPlanEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 if(!envelopes.has(e))engineSiteFail('local_final_envelope');assertAuthority(authority);const bindingSha=canonicalHash(binding),authoritySha256=canonicalHash(authority);
 if((binding as {authoritySha256?:unknown})?.authoritySha256!==authoritySha256)engineSiteFail('local_final_dispatch_binding');
 const execution=()=>{const expected={version:'engine-local-current-final-plan-claim/v1',parentExecutionClaim:e.spec.parentExecutionClaim,executionFile:e.executionFile,binding};if(canonicalHash(json(e.globalFile))!==canonicalHash(expected)||canonicalHash(json(e.executionFile))!==bindingSha)engineSiteFail('local_final_dispatch_binding');};
 const check=()=>{e.checkChain();execution();};
 const slot=(step:string)=>{const s=authority.budget.steps.find(s=>s.id===step);if(!s)engineSiteFail('local_final_dispatch_binding');return s;},file=(step:string)=>{slot(step);return e.masterFile+'.current-final-plan-book-v1.'+step+'.dispatch.json';};
 const recordSchema=z.object({version:z.literal('engine-local-final-plan-dispatch/v1'),executionSha256:digest,authoritySha256:digest,step:z.string(),claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
 const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=recordSchema.parse(json(f));if(r.executionSha256!==bindingSha||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_final_dispatch_binding');return r;};check();
 return{list:()=>{check();return authority.budget.steps.map(s=>record(s.id)).filter((r):r is NonNullable<typeof r>=>r!==null);},check(step,claimSha256,dispatched){check();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_final_unknown_dispatch');},begin(step,claimSha256){check();digest.parse(claimSha256);const f=file(step);if(existsSync(f))engineSiteFail('local_final_unknown_dispatch');writeFileSync(f,JSON.stringify({version:'engine-local-final-plan-dispatch/v1',executionSha256:bindingSha,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}};
}
