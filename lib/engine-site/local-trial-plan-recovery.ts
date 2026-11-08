/** Explicit final planning attempt after a settled source-quote compiler HOLD. Never a book producer. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import {STORYBOARD_MAX_ATTEMPTS} from '@/lib/personal-wizard/storyboard-diagnosis';
import {PREPARATION_SLOTS} from '@/lib/personal-wizard/source-preparation-policy';
import type {StoryboardRepair} from '@/lib/personal-wizard/storyboard-repair';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {assertLocalParentEvidence,readLocalSettledJournal,replayLocalInitialPreparation,type LocalParentEnvelope} from './local-trial-continuation';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from './response-schema';
import {LOCAL_PLAN_RECOVERY_STEPS,LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD} from './local-trial-recovery-policy';
import {assertEngineInitialPreparation,engineStoryboardSupported,prepareEngineStoryboard,type StorySnapshot} from './story-preparation';
import type {EngineProviderPorts} from './provider-plans';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';

const digest=z.string().regex(/^[a-f0-9]{64}$/),ref=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localPlanRecoverySchema=z.object({version:z.literal('engine-local-plan-recovery/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentEvidence:ref,rootClaimSha256:digest,parentClaimSha256:digest,
 boundary:z.literal('plan_review_only')}).strict();
export type LocalPlanRecovery=z.infer<typeof localPlanRecoverySchema>;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file||lstatSync(file).size>64*1024*1024)engineSiteFail('local_plan_recovery_file');return readFileSync(file);}
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
const failure=(e:unknown)=>e&&typeof e==='object'&&'code' in e?String(e.code):e instanceof Error?e.message:'';
const denied=():never=>engineSiteFail('local_plan_recovery_replay_dispatch_forbidden');
const envelopes=new WeakSet<object>();
export function assertLocalPlanRecoveryEvidence(spec:LocalPlanRecovery){
 const s=localPlanRecoverySchema.parse(spec);
 return assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
}
export function localPlanRecoverySteps(){return [{id:LOCAL_PLAN_RECOVERY_STEPS[0],maximumMicroUsd:LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD},
 {id:LOCAL_PLAN_RECOVERY_STEPS[1],maximumMicroUsd:PREPARATION_SLOTS[1]}];}
/** Derived exact historical bindings, not a new interpretation of either consumed claim. */
function claimBindings(failed:LocalEngineGrant,parent:LocalParentEnvelope,authority:EngineOrderAuthority,parentRef:LocalPlanRecovery['parentGrant']){
 const rootRef=failed.continuation!.parentGrant;
 return {root:{version:'engine-local-book-claim/v1',grantFile:rootRef.file,grantSha256:rootRef.sha256,authoritySha256:canonicalHash(parent.authority),directory:parent.parent.directory,sourceRoot:parent.parent.source.root},
  child:{version:'engine-local-book-claim/v1',grantFile:parentRef.file,grantSha256:parentRef.sha256,authoritySha256:canonicalHash(authority),directory:failed.directory,sourceRoot:failed.source.root,parentGrantSha256:rootRef.sha256,carried:parent.carried}};
}
/** Caller has recomputed the old root and v1-child authorities. This function never writes/claims/reads credentials. */
export function loadLocalPlanRecovery(g:LocalEngineGrant,failed:LocalEngineGrant,parent:LocalParentEnvelope,failedAuthority:EngineOrderAuthority,masterFile:string){
 const spec=localPlanRecoverySchema.parse(g.planningRecovery);
 if(g.continuation||g.mediaContinuation||!failed.continuation||failed.planningRecovery||failed.mediaContinuation||failed.responseSchemaPolicy!==undefined||failedAuthority.responseSchemaPolicy!==undefined||g.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||
  canonicalHash(json(spec.parentGrant.file))!==canonicalHash(failed)||g.directory===failed.directory||g.directory===parent.parent.directory||
  g.approvalReference!==failed.approvalReference||g.approvedBy!==failed.approvedBy||g.approvedAt!==failed.approvedAt||
  canonicalHash(g.profile)!==canonicalHash(failed.profile)||g.readerId!==failed.readerId||g.source.root!==failed.source.root||
  g.maximumMicroUsd!==failed.maximumMicroUsd||g.maximumCalls!==failed.maximumCalls)engineSiteFail('local_plan_recovery_scope');
 const normalized=(s:string)=>path.resolve(s).toLowerCase(),destination=normalized(g.directory);
 if(path.resolve(g.directory)!==g.directory||[failed.directory,parent.parent.directory].some(d=>{const old=normalized(d);return destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep);}))engineSiteFail('local_plan_recovery_scope');
 const {root}=assertLocalPlanRecoveryEvidence(spec),stop=json(spec.parentStop.file),exit=json(spec.parentExit.file);
 if(root!==failed.directory||path.dirname(spec.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||
  stop.reason!=='storyboard_self_check_grounding_quote'||stop.phase!=='story'||stop.grantSha256!==spec.parentGrant.sha256||
  exit.code!==1||exit.outcomeExists!==false||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_plan_recovery_terminal');
 if(!Number.isSafeInteger(exit.childPid)||exit.childPid<1)engineSiteFail('local_plan_recovery_terminal');
 try{process.kill(exit.childPid,0);engineSiteFail('local_plan_recovery_process_alive');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(failedAuthority)||checkpoint.phase!=='story'||Object.keys(checkpoint.outputs).length||
  checkpoint.snapshotSha256!==parent.checkpoint.snapshotSha256||checkpoint.ownerId!==parent.checkpoint.ownerId||checkpoint.draftId!==parent.checkpoint.draftId)engineSiteFail('local_plan_recovery_authority');
 const journal=readLocalSettledJournal(root,checkpoint,['initial_storyboard_repair_1'],new Set(['initial_storyboard_repair_1']));
 const oldCarry=json(path.join(root,'journal/carry.json'));
 if(canonicalHash(oldCarry)!==canonicalHash(parent.carried))engineSiteFail('local_plan_recovery_carry');
 const known=parent.carried.accountedMicroUsd+journal.known,calls=parent.carried.logicalCalls+journal.results.size,m=stop.meter;
 if(!Number.isSafeInteger(known)||m?.knownEstimateMicroUsd!==known||m?.accountedMicroUsd!==known||m?.logicalCalls!==calls||
  m?.carriedMicroUsd!==parent.carried.accountedMicroUsd||m?.carriedCalls!==parent.carried.logicalCalls||
  m?.pendingCalls!==0||m?.unknownCalls!==0||m?.failedCalls!==0||m?.overReservedCalls!==0||m?.blocked!==false||
  known+localPlanRecoverySteps().reduce((n,s)=>n+s.maximumMicroUsd,0)>g.maximumMicroUsd||calls+2>g.maximumCalls)engineSiteFail('local_plan_recovery_meter');
 const previousAttempts=Number(parent.results.has('initial_storyboard'))+journal.results.size;
 if(previousAttempts!==2||previousAttempts+1>STORYBOARD_MAX_ATTEMPTS)engineSiteFail('local_plan_recovery_attempts');
 const bindings=claimBindings(failed,parent,failedAuthority,spec.parentGrant);
 const checkClaims=()=>{
  // Recheck both whole terminal trees after awaits, not merely the immediate child's receipts.
  assertLocalPlanRecoveryEvidence(spec);assertLocalParentEvidence(failed.continuation!);
  if(sha(bytes(masterFile))!==spec.rootClaimSha256||sha(bytes(masterFile+'.continuation.json'))!==spec.parentClaimSha256||
   canonicalHash(json(masterFile))!==canonicalHash(bindings.root)||canonicalHash(json(masterFile+'.continuation.json'))!==canonicalHash(bindings.child))engineSiteFail('local_plan_recovery_claim_chain');
 };
 checkClaims();
 const evidenceSha256=canonicalHash({spec,rootEvidence:failed.continuation.parentEvidence,rootCarry:parent.carried,attempts:previousAttempts});
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256});
 const value=Object.freeze({spec,parent,failed,checkpoint,journal,carried,checkClaims,masterFile,previousAttempts,nextAttempt:previousAttempts+1,maximumAttempts:STORYBOARD_MAX_ATTEMPTS});envelopes.add(value);return value;
}
export type LocalPlanRecoveryEnvelope=ReturnType<typeof loadLocalPlanRecovery>;
const admitted=new WeakSet<object>();
function assertAuthority(a:EngineOrderAuthority){
 if(a.purpose!=='test'||a.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||canonicalHash(a.budget.steps)!==canonicalHash(localPlanRecoverySteps()))engineSiteFail('local_plan_recovery_execution_scope');
}
/** Replays the failed call under ITS old wire, and requires the same compiler refusal. Never adopts its draft. */
export async function replayLocalPlanRecovery(chain:LocalPlanRecoveryEnvelope,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 assertAuthority(authority);if(!envelopes.has(chain))engineSiteFail('local_plan_recovery_envelope_changed');chain.checkClaims();
 const initialPreparation=await replayLocalInitialPreparation(chain.parent,snapshot);
 assertEngineInitialPreparation(initialPreparation,authority,chain.checkpoint);
 const repair:StoryboardRepair={parentStoryboardDigest:initialPreparation.initial.diagnostic.storyboardDigest,draft:initialPreparation.initial.draft,
  review:initialPreparation.initial.diagnostic.rawReview,parentCompile:Object.freeze({selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true})};
 let reads=0;
 const runtime:EngineRuntime={checkpoint:structuredClone(chain.checkpoint),signal:new AbortController().signal,check(){},load:async()=>null,save:denied,advance:denied,result:denied,
  async call(plan){const old=chain.journal.claims.get(plan.call.step),r=chain.journal.results.get(plan.call.step);plan.revalidate?.();
   if(reads||!old||!r||canonicalHash(plan.call)!==canonicalHash(old.claim.call)||canonicalHash(plan.wire)!==old.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('local_plan_recovery_old_wire');
   await plan.admitSaved(r);reads++;return r;
  }};
 let reason='';try{await prepareEngineStoryboard(runtime,snapshot,initialPreparation.source,{fetch:denied,openAIKey:denied,anthropicKey:denied},'initial_repair_1',undefined,repair);}catch(e){reason=failure(e);}
 if(reads!==1||reason!=='storyboard_self_check_grounding_quote')engineSiteFail('local_plan_recovery_failure_not_reproduced');
 chain.checkClaims();
 const value=Object.freeze({initialPreparation,repair:Object.freeze(repair),carried:chain.carried,authoritySha256:canonicalHash(authority),previousAttempts:chain.previousAttempts,nextAttempt:chain.nextAttempt,maximumAttempts:chain.maximumAttempts});
 admitted.add(value);return value;
}
export type AdmittedLocalPlanRecovery=Awaited<ReturnType<typeof replayLocalPlanRecovery>>;
function assertAdmitted(value:AdmittedLocalPlanRecovery,runtime:EngineRuntime){
 assertAuthority(runtime.checkpoint.authority);
 if(!admitted.has(value)||value.authoritySha256!==canonicalHash(runtime.checkpoint.authority))engineSiteFail('local_plan_recovery_preparation_changed');
 assertEngineInitialPreparation(value.initialPreparation,runtime.checkpoint.authority,runtime.checkpoint);
}
/** Free exact first-wire preflight. The review wire necessarily depends on the future model answer. */
export async function preflightLocalPlanRecovery(value:AdmittedLocalPlanRecovery,snapshot:StorySnapshot,runtime:EngineRuntime){
 assertAdmitted(value,runtime);const sentinel={},plans:unknown[]=[];
 const probe:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check:()=>runtime.check(),load:denied,save:denied,advance:denied,result:denied,
  call:async plan=>{plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw sentinel;}};
 try{await prepareEngineStoryboard(probe,snapshot,value.initialPreparation.source,{fetch:denied,openAIKey:denied,anthropicKey:denied},'initial_repair_2',undefined,value.repair);}catch(e){
  // authorPersonalStoryboard intentionally replaces transport exceptions with this code.
  // Accept it ONLY after our own no-dispatch interception captured exactly one prepared call.
  if(e!==sentinel&&(plans.length!==1||failure(e)!=='personal_storyboard_author_failed'))throw e;
 }
 if(plans.length!==1)engineSiteFail('local_plan_recovery_preflight');return plans[0];
}
/** Only planner+full review. No full-book recipe, image/reference/narration/PDF or publication call site. */
export async function runLocalPlanRecovery(runtime:LocalEngineTrialRuntime,snapshot:StorySnapshot,value:AdmittedLocalPlanRecovery,ports:EngineProviderPorts){
 assertAdmitted(value,runtime);runtime.check();
 const meter=await runtime.meter();
 if(meter.carriedMicroUsd!==value.carried.accountedMicroUsd||meter.carriedCalls!==value.carried.logicalCalls)engineSiteFail('local_plan_recovery_execution_carry');
 if(meter.lostLocalCalls===undefined)engineSiteFail('local_plan_recovery_dispatch_fence_required');
 if(meter.lostLocalCalls)engineSiteFail('local_plan_recovery_local_state_lost');
 assertAdmitted(value,runtime);runtime.check();
 const result=await prepareEngineStoryboard(runtime,snapshot,value.initialPreparation.source,ports,'initial_repair_2',undefined,value.repair);
 assertAdmitted(value,runtime);runtime.check();
 const outcome={version:'engine-local-plan-result/v1',status:engineStoryboardSupported(result.diagnostic.status)?'plan_review_supported':'plan_review_held',
  source:value.initialPreparation.source,readings:value.initialPreparation.readings,draft:result.draft,diagnostic:result.diagnostic,
  previousAttempts:value.previousAttempts,attempt:value.nextAttempt,maximumAttempts:value.maximumAttempts,carried:value.carried,
  illustrationsCreated:0,narrationCreated:0,bookCreated:false,productAccepted:false,independentQA:'pending' as const};
 await runtime.save('recovery_plan',outcome);return outcome;
}
/** Fixed consent-global append only record. Copies cannot select a different name/parent/attempt number. */
export function claimLocalPlanRecoveryExecution(chain:LocalPlanRecoveryEnvelope,binding:unknown,resume:boolean){
 if(!envelopes.has(chain))engineSiteFail('local_plan_recovery_envelope_changed');chain.checkClaims();const file=chain.masterFile+'.plan-recovery-v1.json';
 if(existsSync(file)){if(!resume||canonicalHash(json(file))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}
 else {if(resume)engineSiteFail('local_book_resume_without_claim');writeFileSync(file,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});}
 return file;
}
/** An execution claim alone is not proof that a lost journal never sent a request. */
export function assertLocalPlanRecoveryResumeState(directory:string,resume:boolean){
 if(resume&&['checkpoint.json','carry.json'].some(name=>!existsSync(path.join(directory,'journal',name))))engineSiteFail('local_plan_recovery_resume_state_missing');
}
/** Each POST is fenced outside the mutable local journal, under the same fixed consent-global claim. */
export function localPlanRecoveryDispatchWitness(chain:LocalPlanRecoveryEnvelope,binding:unknown,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 if(!envelopes.has(chain))engineSiteFail('local_plan_recovery_envelope_changed');assertAuthority(authority);
 const executionFile=chain.masterFile+'.plan-recovery-v1.json',executionSha256=canonicalHash(binding),authoritySha256=canonicalHash(authority);
 if(z.object({authoritySha256:digest}).passthrough().parse(binding).authoritySha256!==authoritySha256)engineSiteFail('local_plan_recovery_dispatch_binding');
 const execution=()=>{if(canonicalHash(json(executionFile))!==executionSha256)engineSiteFail('local_plan_recovery_dispatch_binding');};execution();
 const recordSchema=z.object({version:z.literal('engine-local-plan-dispatch/v1'),executionSha256:digest,authoritySha256:digest,
  step:z.enum(LOCAL_PLAN_RECOVERY_STEPS),claimSha256:digest,maximumMicroUsd:z.literal(LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD)}).strict();
 const file=(step:string)=>{if(!(LOCAL_PLAN_RECOVERY_STEPS as readonly string[]).includes(step))engineSiteFail('local_plan_recovery_dispatch_binding');return chain.masterFile+'.plan-recovery-v1.'+step+'.dispatch.json';};
 const record=(step:string)=>{execution();const f=file(step);if(!existsSync(f))return null;const r=recordSchema.parse(json(f));
  if(r.executionSha256!==executionSha256||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==authority.budget.steps.find(s=>s.id===step)?.maximumMicroUsd)engineSiteFail('local_plan_recovery_dispatch_binding');return r;};
 return {list:()=>LOCAL_PLAN_RECOVERY_STEPS.map(record).filter((r):r is NonNullable<typeof r>=>r!==null),
  check(step,claimSha256,dispatched){const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_plan_recovery_unknown_dispatch');},
  begin(step,claimSha256){execution();chain.checkClaims();digest.parse(claimSha256);const f=file(step);if(existsSync(f))engineSiteFail('local_plan_recovery_unknown_dispatch');
   writeFileSync(f,JSON.stringify({version:'engine-local-plan-dispatch/v1',executionSha256,authoritySha256,step,claimSha256,maximumMicroUsd:authority.budget.steps.find(s=>s.id===step)!.maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});
  }};
}
