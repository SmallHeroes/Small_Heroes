/** One explicit owner +1 extension of a fully spent, settled current BASE storyboard. Never a reset. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import type {StoryboardRepair} from '@/lib/personal-wizard/storyboard-repair';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {assertLocalParentEvidence,readLocalSettledJournal} from './local-trial-continuation';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';
import {assertLocalCurrentFinalPlanEnvelope,localCurrentFinalPlanSteps,replayLocalCurrentFinalPlan,type LocalCurrentFinalPlanEnvelope} from './local-trial-final-plan';
import {localAttemptApprovalSchema,localAttemptOwnerGoSchema,localAttemptExtensionPolicySchema} from './local-attempt-extension-policy';
import {admitLocalAttemptStartupRegistration} from './local-attempt-startup-registration';
import {admitEngineHeldFinalPreparation,admitEngineSupportedInitialPreparation,assertEngineInitialPreparation,prepareEngineStoryboard,engineStoryboardSupported,type StorySnapshot} from './story-preparation';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';
import type {EngineProviderPorts} from './provider-plans';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute),ref=z.object({file:absolute,sha256:digest}).strict();
export const localAttemptExtensionSchema=z.object({version:z.literal('engine-local-current-attempt-extension/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentStart:ref,parentEvidence:ref,parentExecutionClaim:ref,parentGlobalClaim:ref,approval:ref,startupRegistrationFile:absolute.optional()}).strict();
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){
 if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_extension_private_path');
 const st=lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>64*1024*1024||realpathSync(file)!==file)engineSiteFail('local_extension_file');return readFileSync(file);
}
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
function pinned(r:z.infer<typeof ref>){const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_extension_evidence_changed');return JSON.parse(b.toString('utf8'));}
export function assertLocalAttemptExtensionEvidence(spec:z.infer<typeof localAttemptExtensionSchema>){
 const s=localAttemptExtensionSchema.parse(spec),tree=assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
 const start=pinned(s.parentStart);pinned(start.envelope);pinned(s.parentExecutionClaim);pinned(s.parentGlobalClaim);pinned((pinned(s.parentGrant) as LocalEngineGrant).ownerApproval);pinned(s.approval);return tree;
}
export function localAttemptExtensionSteps(){return localCurrentFinalPlanSteps().map(s=>({...s,id:s.id.replace('initial_storyboard_repair_2','initial_storyboard_repair_3')}));}
const envelopes=new WeakSet<object>();
/** Pure admission still REQUIRES an actual NEW owner-stage GO. A wrapped proposal cannot activate this. */
export function loadLocalAttemptExtension(g:LocalEngineGrant,failed:LocalEngineGrant,oldAuthority:EngineOrderAuthority,prior:LocalCurrentFinalPlanEnvelope){
 const s=localAttemptExtensionSchema.parse(g.currentAttemptExtension);assertLocalCurrentFinalPlanEnvelope(prior);
 const other=(v:LocalEngineGrant)=>!!(v.currentContinuation||v.freshBookPolicy||v.startupRecovery||v.continuation||v.planningRecovery||v.mediaContinuation||v.childBindingContinuation||v.locationsRepairContinuation||v.locationsV2RepairContinuation);
 if(!failed.currentFinalPlan||failed.currentAttemptExtension||other(failed)||g.currentFinalPlan||other(g)||oldAuthority.storyboardAttemptExtension||canonicalHash(pinned(s.parentGrant))!==canonicalHash(failed)||
  canonicalHash(failed.currentFinalPlan)!==canonicalHash(prior.spec))engineSiteFail('local_extension_scope');
 for(const key of ['profile','credentials','readerId','approvalReference','approvedBy','approvedAt','maximumMicroUsd','maximumCalls','imageModelPolicy','responseSchemaPolicy','storyboardBindingPolicy','locationSheetPolicy'] as const)
  if(canonicalHash(g[key]??null)!==canonicalHash(failed[key]??null))engineSiteFail('local_extension_scope');
 if(g.source.root!==failed.source.root||g.maximumMicroUsd!==12000000||g.maximumCalls!==121||!g.imageModelPolicy)engineSiteFail('local_extension_scope');
 const destination=path.resolve(g.directory).toLowerCase();
 for(const dir of [failed.directory,prior.failed.directory,prior.parent.parent.directory]){const old=path.resolve(dir).toLowerCase();if(destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep))engineSiteFail('local_extension_destination');}
 const {root}=assertLocalAttemptExtensionEvidence(s),stop=pinned(s.parentStop),exit=pinned(s.parentExit),start=pinned(s.parentStart);
 if(root!==failed.directory||path.dirname(s.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_storyboard_held'||stop.phase!=='story'||stop.grantSha256!==s.parentGrant.sha256||
  exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.supervisorExitCode!==1||exit.completionStatus!=='native_failed'||exit.completionReason!=='native_exit_failure'||
  start.childPid!==exit.childPid||start.grantSha256!==s.parentGrant.sha256||start.sourceHead!==failed.source.head||!Number.isFinite(Date.parse(start.at))||!Number.isFinite(Date.parse(exit.at))||
  Date.parse(exit.at)>Date.now()||Date.parse(exit.at)<Date.parse(start.at)||!Number.isFinite(Date.parse(stop.at))||Date.parse(stop.at)<Date.parse(start.at)||Date.parse(stop.at)>Date.parse(exit.at)||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_extension_terminal');
 assertLocalHistoricalProcessGone(exit.childPid,exit.at);assertLocalHistoricalProcessGone(start.pid,exit.at);
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(oldAuthority)||checkpoint.phase!=='story'||Object.keys(checkpoint.outputs).length||checkpoint.snapshotSha256!==prior.checkpoint.snapshotSha256||checkpoint.ownerId!==prior.checkpoint.ownerId||checkpoint.draftId!==prior.checkpoint.draftId||canonicalHash(oldAuthority.budget.steps)!==canonicalHash(localCurrentFinalPlanSteps()))engineSiteFail('local_extension_authority');
 const journal=readLocalSettledJournal(root,checkpoint,['initial_storyboard_repair_2','initial_storyboard_repair_2_review'],new Set(['initial_storyboard_repair_2','initial_storyboard_repair_2_review']));
 if(canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(prior.carried))engineSiteFail('local_extension_carry');
 const known=prior.carried.accountedMicroUsd+journal.known,calls=prior.carried.logicalCalls+journal.results.size,m=stop.meter;
 if(m?.accountedMicroUsd!==known||m.knownEstimateMicroUsd!==known||m.logicalCalls!==calls||m.carriedMicroUsd!==prior.carried.accountedMicroUsd||m.carriedCalls!==prior.carried.logicalCalls||m.pendingCalls!==0||m.unknownCalls!==0||m.failedCalls!==0||m.overReservedCalls!==0||m.blocked!==false||known+2400000>g.maximumMicroUsd||calls+2>g.maximumCalls||prior.nextAttempt!==3||prior.maximumAttempts!==3||journal.results.size!==2)engineSiteFail('local_extension_meter_or_attempt');
 const scope=localAttemptApprovalSchema.parse(pinned(s.approval));
 if(scope.sourceRoot!==g.source.root||!s.startupRegistrationFile&&(scope.sourceHead!==g.source.head||scope.directory!==g.directory)||scope.parentGrantSha256!==s.parentGrant.sha256||scope.requestSha256!==oldAuthority.requestSha256||scope.optionsSha256!==oldAuthority.optionsSha256||scope.readerId!==g.readerId||path.basename(prior.masterFile)!==scope.rootConsentSha256+'.local-engine.claim.json')engineSiteFail('local_extension_owner_scope');
 // Timestamp freshness applies only at initial admission, not while a legitimately started call settles.
 const goBytes=bytes(scope.ownerGoFile),goSha256=sha(goBytes),go=localAttemptOwnerGoSchema.parse(JSON.parse(goBytes.toString('utf8')));
 if(go.approvalSha256!==s.approval.sha256||go.parentGrantSha256!==s.parentGrant.sha256||go.sourceHead!==scope.sourceHead||Date.parse(go.approvedAt)>Date.now()||!s.startupRegistrationFile&&Date.now()-Date.parse(go.approvedAt)>1200000)engineSiteFail('local_extension_owner_go');
 const startupRegistration=s.startupRegistrationFile?admitLocalAttemptStartupRegistration(g,scope,go,goSha256,prior.masterFile,prior.executionFile+'.attempt-extension-4.json'):undefined;
 const parentBinding={version:'engine-local-book-claim/v1',grantFile:s.parentGrant.file,grantSha256:s.parentGrant.sha256,authoritySha256:canonicalHash(oldAuthority),directory:failed.directory,sourceRoot:failed.source.root,
  currentFinalPlanSha256:canonicalHash(failed.currentFinalPlan),parentGrantSha256:failed.currentFinalPlan.parentGrant.sha256,carried:prior.carried,attempt:3,maximumAttempts:3,boundary:'final_base_plan_then_native_book'};
 const expectedGlobal={version:'engine-local-current-final-plan-claim/v1',parentExecutionClaim:prior.spec.parentExecutionClaim,executionFile:prior.executionFile,binding:parentBinding};
 if(s.parentExecutionClaim.file!==prior.executionFile||s.parentGlobalClaim.file!==prior.globalFile)engineSiteFail('local_extension_parent_claim');
 const specSha=canonicalHash(s),memory=()=>canonicalHash({failed,oldAuthority,checkpoint,claims:[...journal.claims],results:[...journal.results],scope}),memorySha=memory();
 for(const v of Object.values(s))if(v&&typeof v==='object')Object.freeze(v);Object.freeze(s);Object.freeze(scope);
 const checkChain=()=>{assertLocalCurrentFinalPlanEnvelope(prior);if(canonicalHash(g.currentAttemptExtension)!==specSha||memory()!==memorySha)engineSiteFail('local_extension_state_changed');assertLocalAttemptExtensionEvidence(s);
  startupRegistration?.check();
  if(sha(bytes(scope.ownerGoFile))!==goSha256)engineSiteFail('local_extension_owner_go_changed');
  if(canonicalHash(pinned(s.parentExecutionClaim))!==canonicalHash(parentBinding)||canonicalHash(pinned(s.parentGlobalClaim))!==canonicalHash(expectedGlobal))engineSiteFail('local_extension_parent_claim');};checkChain();
 const extension=Object.freeze(localAttemptExtensionPolicySchema.parse({version:'storyboard-attempt-extension/v1',maxAttempts:4,approvalSha256:s.approval.sha256}));
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec:s,priorCarry:prior.carried,attempt:4,maximumAttempts:4})});
 const value=Object.freeze({spec:s,scope,goSha256,...(startupRegistration?{startupRegistration}:{}),extension,failed,oldAuthority,prior,checkpoint,journal,carried,checkChain,masterFile:prior.masterFile,executionFile:prior.executionFile+'.attempt-extension-4.json',globalFile:prior.masterFile+'.attempt-extension-4-v1.json',nextAttempt:4 as const,maximumAttempts:4 as const});envelopes.add(value);return value;
}
export type LocalAttemptExtensionEnvelope=ReturnType<typeof loadLocalAttemptExtension>;
const preparations=new WeakSet<object>(),denied=():never=>engineSiteFail('local_extension_replay_dispatch_forbidden');
function assertEnvelope(e:LocalAttemptExtensionEnvelope){if(!envelopes.has(e))engineSiteFail('local_extension_envelope');e.checkChain();}
function assertAuthority(e:LocalAttemptExtensionEnvelope,a:EngineOrderAuthority){if(a.purpose!=='test'||canonicalHash(a.storyboardAttemptExtension??null)!==canonicalHash(e.extension)||canonicalHash(a.budget.steps)!==canonicalHash(localAttemptExtensionSteps())||a.requestSha256!==e.oldAuthority.requestSha256||a.optionsSha256!==e.oldAuthority.optionsSha256||a.budget.maximumMicroUsd!==e.scope.maximumTotalMicroUsd||a.budget.maximumCalls!==e.scope.maximumTotalCalls)engineSiteFail('local_extension_execution_scope');}
/** All TEN paid wires replay under their old authorities. No new call or credential read. */
export async function replayLocalAttemptExtension(e:LocalAttemptExtensionEnvelope,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 assertEnvelope(e);assertAuthority(e,authority);const snapshotSha256=canonicalHash(snapshot),old=await replayLocalCurrentFinalPlan(e.prior,snapshot,e.oldAuthority),used=new Set<string>();
 const replay:EngineRuntime={checkpoint:structuredClone(e.checkpoint),signal:new AbortController().signal,check:e.checkChain,load:denied,save:denied,advance:denied,result:denied,async call(plan){e.checkChain();plan.revalidate?.();const c=e.journal.claims.get(plan.call.step),r=e.journal.results.get(plan.call.step);if(!c||!r||used.has(plan.call.step)||canonicalHash(plan.call)!==canonicalHash(c.claim.call)||canonicalHash(plan.wire)!==c.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('local_extension_old_wire');await plan.admitSaved(r);e.checkChain();used.add(plan.call.step);return r;}};
 const held=await admitEngineHeldFinalPreparation(replay,snapshot,old.held,old.repair);if(used.size!==2)engineSiteFail('local_extension_old_wire');
 const repair:StoryboardRepair={parentStoryboardDigest:held.initial.diagnostic.storyboardDigest,draft:held.initial.draft,review:held.initial.diagnostic.rawReview,parentRepair:held.heldFinalRepair,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true},extension:e.extension};
 Object.freeze(repair.parentCompile);Object.freeze(repair);if(canonicalHash(snapshot)!==snapshotSha256)engineSiteFail('local_extension_snapshot_changed');assertEnvelope(e);
 const value=Object.freeze({held,repair,snapshotSha256,authoritySha256:canonicalHash(authority),carried:e.carried,envelope:e});preparations.add(value);return value;
}
export type AdmittedLocalAttemptExtension=Awaited<ReturnType<typeof replayLocalAttemptExtension>>;
function assertPrepared(v:AdmittedLocalAttemptExtension,r:Pick<EngineRuntime,'checkpoint'>,snapshot:StorySnapshot){
 if(!preparations.has(v))engineSiteFail('local_extension_preparation');assertEnvelope(v.envelope);assertAuthority(v.envelope,r.checkpoint.authority);
 if(v.authoritySha256!==canonicalHash(r.checkpoint.authority)||v.snapshotSha256!==canonicalHash(snapshot))engineSiteFail('local_extension_snapshot_changed');assertEngineInitialPreparation(v.held,r.checkpoint.authority,r.checkpoint);
}
export async function preflightLocalAttemptExtension(v:AdmittedLocalAttemptExtension,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 const checkpoint={version:'engine-site-job/v1' as const,authority,ownerId:v.held.ownerId,draftId:v.held.draftId,snapshotSha256:authority.requestSha256,phase:'story' as const,calls:{},outputs:{},waiting:null};assertPrepared(v,{checkpoint},snapshot);const plans:unknown[]=[];
 const runtime:EngineRuntime={checkpoint,signal:new AbortController().signal,check(){},load:denied,save:denied,advance:denied,result:denied,async call(plan){plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw Error('local_extension_preflight_boundary');}};
 let reason='';try{await prepareEngineStoryboard(runtime,snapshot,v.held.source,{fetch:denied,openAIKey:denied,anthropicKey:denied},'initial_repair_3',undefined,v.repair);}catch(error){reason=error instanceof Error?error.message:String(error);}
 if(plans.length!==1)engineSiteFail(reason||'local_extension_preflight');assertPrepared(v,{checkpoint},snapshot);return plans[0];
}
export async function runLocalAttemptExtension(runtime:LocalEngineTrialRuntime,snapshot:StorySnapshot,v:AdmittedLocalAttemptExtension,ports:EngineProviderPorts){
 const check=()=>{assertPrepared(v,runtime,snapshot);runtime.check();};check();const m=await runtime.meter();check();
 if(m.carriedMicroUsd!==v.carried.accountedMicroUsd||m.carriedCalls!==v.carried.logicalCalls||m.lostLocalCalls===undefined||m.lostLocalCalls||m.blocked)engineSiteFail('local_extension_runtime_carry');
 const bound:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check,load:n=>runtime.load(n),save:(n,x)=>runtime.save(n,x),advance:p=>runtime.advance(p),result:s=>runtime.result(s),async call(plan){check();const answer=await runtime.call(plan);check();return answer;}};
 const result=await prepareEngineStoryboard(bound,snapshot,v.held.source,ports,'initial_repair_3',undefined,v.repair);check();if(!engineStoryboardSupported(result.diagnostic.status))engineSiteFail('engine_storyboard_held');
 const replay:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check,load:denied,save:denied,advance:denied,result:s=>runtime.result(s),async call(plan){check();plan.revalidate?.();const c=runtime.checkpoint.calls[plan.call.step],r=await runtime.result(plan.call.step);if(!c?.settled||c.wireSha256!==plan.call.wireSha256||!r||!plan.admitSaved)engineSiteFail('local_extension_new_receipt');await plan.admitSaved(r);check();return r;}};
 const accepted=await admitEngineSupportedInitialPreparation(replay,snapshot,v.held,v.repair);check();return accepted;
}
export function claimLocalAttemptExtension(e:LocalAttemptExtensionEnvelope,binding:unknown,resume:boolean,masterFile:string){
 assertEnvelope(e);if(resume||masterFile!==e.masterFile)engineSiteFail('local_extension_capability');
 if([e.globalFile,e.executionFile].some(existsSync))engineSiteFail('local_extension_already_claimed');
 const write=(f:string,x:unknown)=>writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
 write(e.globalFile,{version:'engine-local-attempt-extension-claim/v1',parentExecutionClaim:e.spec.parentExecutionClaim,executionFile:e.executionFile,ownerGoSha256:e.goSha256,binding});write(e.executionFile,binding);return e.executionFile;
}
/** All new plan AND native media slots use consent-global, external write-once witnesses. */
export function localAttemptExtensionDispatchWitness(e:LocalAttemptExtensionEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 assertEnvelope(e);assertAuthority(e,authority);const bindingSha=canonicalHash(binding),authoritySha256=canonicalHash(authority);
 if((binding as {authoritySha256?:unknown;ownerGoSha256?:unknown})?.authoritySha256!==authoritySha256||(binding as {ownerGoSha256?:unknown}).ownerGoSha256!==e.goSha256)engineSiteFail('local_extension_dispatch_binding');
 const execution=()=>{const expected={version:'engine-local-attempt-extension-claim/v1',parentExecutionClaim:e.spec.parentExecutionClaim,executionFile:e.executionFile,ownerGoSha256:e.goSha256,binding};if(canonicalHash(json(e.globalFile))!==canonicalHash(expected)||canonicalHash(json(e.executionFile))!==bindingSha)engineSiteFail('local_extension_dispatch_binding');};
 const check=()=>{assertEnvelope(e);execution();},slot=(step:string)=>{const s=authority.budget.steps.find(s=>s.id===step);if(!s)engineSiteFail('local_extension_dispatch_binding');return s;},file=(step:string)=>{slot(step);return e.masterFile+'.attempt-extension-4-v1.'+step+'.dispatch.json';};
 const schema=z.object({version:z.literal('engine-local-extension-dispatch/v1'),executionSha256:digest,authoritySha256:digest,step:z.string(),claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
 const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=schema.parse(json(f));if(r.executionSha256!==bindingSha||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_extension_dispatch_binding');return r;};check();
 return {list:()=>{check();return authority.budget.steps.map(s=>record(s.id)).filter((r):r is NonNullable<typeof r>=>r!==null);},check(step,claimSha256,dispatched){check();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_extension_unknown_dispatch');},begin(step,claimSha256){check();digest.parse(claimSha256);if(existsSync(file(step)))engineSiteFail('local_extension_unknown_dispatch');writeFileSync(file(step),JSON.stringify({version:'engine-local-extension-dispatch/v1',executionSha256:bindingSha,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}};
}
