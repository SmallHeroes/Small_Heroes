/** ONE explicitly owner-approved fifth attempt. Historical receipts are read-only; no sixth or reset. */
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
import {localAttemptExtensionSteps,replayLocalAttemptExtension,type LocalAttemptExtensionEnvelope} from './local-trial-attempt-extension';
import {localAttemptExtensionPolicySchema} from './local-attempt-extension-policy';
import {ENGINE_SOURCE_CONCURRENCY_POLICY} from './storyboard-concurrency-policy';
import {admitEngineHeldExtendedPreparation,admitEngineSupportedInitialPreparation,assertEngineInitialPreparation,prepareEngineStoryboard,engineStoryboardSupported,type StorySnapshot} from './story-preparation';
import type {LocalEngineTrialRuntime,LocalTrialDispatchWitness} from './local-trial-runtime';
import type {EngineProviderPorts} from './provider-plans';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute),ref=z.object({file:absolute,sha256:digest}).strict();
export const localConcurrencyContinuationSchema=z.object({version:z.literal('engine-local-concurrency-continuation/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentStart:ref,parentEvidence:ref,parentExecutionClaim:ref,parentGlobalClaim:ref,approval:ref}).strict();
export const localConcurrencyApprovalSchema=z.object({version:z.literal('engine-local-concurrency-approval/v1'),stage:z.literal('initial_storyboard'),
 fromAttempt:z.literal(4),toAttempt:z.literal(5),maximumAttempts:z.literal(5),sourceRoot:absolute,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),
 parentGrantSha256:digest,rootConsentSha256:digest,requestSha256:digest,optionsSha256:digest,directory:absolute,readerId:z.string().min(1),ownerGoFile:absolute,ownerDecision:ref,
 maximumPlanningMicroUsd:z.literal(2400000),maximumPlanningCalls:z.literal(2),maximumTotalMicroUsd:z.literal(12000000),maximumTotalCalls:z.literal(121),furtherAttemptAllowed:z.literal(false)}).strict();
export const localConcurrencyGoSchema=z.object({version:z.literal('engine-local-concurrency-go/v1'),approvedBy:z.literal('Guy'),
 approvedAt:z.string().datetime(),timeKind:z.literal('local_source_binding_of_received_owner_decision'),ownerDecisionSha256:digest,
 approvalSha256:digest,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),parentGrantSha256:digest,attempt:z.literal(5),maximumAttempts:z.literal(5),
 maximumPlanningCalls:z.literal(2),maximumPlanningMicroUsd:z.literal(2400000),maximumTotalMicroUsd:z.literal(12000000),maximumTotalCalls:z.literal(121)}).strict();
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(f:string){if(!path.isAbsolute(f)||/(^|[\\/])\.env(?:\.|$)/i.test(f))engineSiteFail('local_concurrency_private_path');const st=lstatSync(f);if(!st.isFile()||st.isSymbolicLink()||st.size>64*1024*1024||realpathSync(f)!==f)engineSiteFail('local_concurrency_file');return readFileSync(f);}
const json=(f:string)=>JSON.parse(bytes(f).toString('utf8'));
const pinned=(r:z.infer<typeof ref>)=>{const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_concurrency_pin_changed');return JSON.parse(b.toString('utf8'));};
export function assertLocalConcurrencyEvidence(spec:z.infer<typeof localConcurrencyContinuationSchema>){const s=localConcurrencyContinuationSchema.parse(spec),tree=assertLocalParentEvidence({version:'engine-local-initial-hold-continuation/v1',parentGrant:s.parentGrant,parentStop:s.parentStop,parentExit:s.parentExit,parentEvidence:s.parentEvidence});
 const start=pinned(s.parentStart);pinned(start.envelope);pinned(s.parentExecutionClaim);pinned(s.parentGlobalClaim);pinned(s.approval);pinned((pinned(s.parentGrant) as LocalEngineGrant).ownerApproval);return tree;}
export const localConcurrencySteps=()=>localAttemptExtensionSteps().map(s=>({...s,id:s.id.replace('initial_storyboard_repair_3','initial_storyboard_repair_4')}));
const envelopes=new WeakSet<object>();
export function loadLocalConcurrencyContinuation(g:LocalEngineGrant,failed:LocalEngineGrant,oldAuthority:EngineOrderAuthority,prior:LocalAttemptExtensionEnvelope){
 const s=localConcurrencyContinuationSchema.parse(g.currentConcurrencyContinuation);
 if(!failed.currentAttemptExtension||failed.currentConcurrencyContinuation||!prior.historicalReplay||oldAuthority.storyboardConcurrencyPolicy||canonicalHash(pinned(s.parentGrant))!==canonicalHash(failed)||canonicalHash(failed.currentAttemptExtension)!==canonicalHash(prior.spec))engineSiteFail('local_concurrency_parent');
 for(const k of ['profile','credentials','readerId','approvalReference','approvedBy','approvedAt','maximumMicroUsd','maximumCalls','imageModelPolicy','responseSchemaPolicy','storyboardBindingPolicy','locationSheetPolicy'] as const)if(canonicalHash(g[k]??null)!==canonicalHash(failed[k]??null))engineSiteFail('local_concurrency_scope');
 if(g.source.root!==failed.source.root||g.maximumMicroUsd!==12000000||g.maximumCalls!==121||!g.imageModelPolicy)engineSiteFail('local_concurrency_scope');
 const dest=path.resolve(g.directory).toLowerCase();for(const dir of [failed.directory,prior.failed.directory,prior.prior.failed.directory,prior.prior.parent.parent.directory]){const old=path.resolve(dir).toLowerCase();if(dest===old||dest.startsWith(old+path.sep)||old.startsWith(dest+path.sep))engineSiteFail('local_concurrency_destination');}
 const {root}=assertLocalConcurrencyEvidence(s),stop=pinned(s.parentStop),exit=pinned(s.parentExit),start=pinned(s.parentStart);
 if(root!==failed.directory||path.dirname(s.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_storyboard_held'||stop.phase!=='story'||stop.grantSha256!==s.parentGrant.sha256||exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.supervisorExitCode!==1||exit.completionStatus!=='native_failed'||start.childPid!==exit.childPid||start.grantSha256!==s.parentGrant.sha256||start.sourceHead!==failed.source.head||!(Date.parse(start.at)<=Date.parse(stop.at)&&Date.parse(stop.at)<=Date.parse(exit.at)&&Date.parse(exit.at)<=Date.now())||existsSync(path.join(root,'OUTCOME.json')))engineSiteFail('local_concurrency_terminal');
 assertLocalHistoricalProcessGone(exit.childPid,exit.at);assertLocalHistoricalProcessGone(start.pid,exit.at);
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))});
 if(canonicalHash(checkpoint.authority)!==canonicalHash(oldAuthority)||checkpoint.phase!=='story'||Object.keys(checkpoint.outputs).length||checkpoint.snapshotSha256!==prior.checkpoint.snapshotSha256||checkpoint.ownerId!==prior.checkpoint.ownerId||checkpoint.draftId!==prior.checkpoint.draftId)engineSiteFail('local_concurrency_authority');
 const steps=['initial_storyboard_repair_3','initial_storyboard_repair_3_review'],journal=readLocalSettledJournal(root,checkpoint,steps,new Set(steps));
 if(canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(prior.carried)||canonicalHash(oldAuthority.budget.steps)!==canonicalHash(localAttemptExtensionSteps()))engineSiteFail('local_concurrency_carry');
 const known=prior.carried.accountedMicroUsd+journal.known,calls=prior.carried.logicalCalls+journal.results.size,m=stop.meter;
 if(m?.accountedMicroUsd!==known||m.knownEstimateMicroUsd!==known||m.logicalCalls!==calls||m.carriedMicroUsd!==prior.carried.accountedMicroUsd||m.carriedCalls!==prior.carried.logicalCalls||m.pendingCalls!==0||m.unknownCalls!==0||m.failedCalls!==0||m.overReservedCalls!==0||m.blocked!==false||known+2400000>g.maximumMicroUsd||calls+2>g.maximumCalls||journal.results.size!==2)engineSiteFail('local_concurrency_meter');
 const scope=localConcurrencyApprovalSchema.parse(pinned(s.approval)),go=localConcurrencyGoSchema.parse(json(scope.ownerGoFile)),goSha256=sha(bytes(scope.ownerGoFile)),decision=pinned(scope.ownerDecision);
 if(scope.sourceRoot!==g.source.root||scope.sourceHead!==g.source.head||scope.directory!==g.directory||scope.readerId!==g.readerId||scope.parentGrantSha256!==s.parentGrant.sha256||scope.requestSha256!==oldAuthority.requestSha256||scope.optionsSha256!==oldAuthority.optionsSha256||path.basename(prior.masterFile)!==scope.rootConsentSha256+'.local-engine.claim.json'||go.sourceHead!==g.source.head||go.parentGrantSha256!==s.parentGrant.sha256||go.approvalSha256!==s.approval.sha256||go.ownerDecisionSha256!==scope.ownerDecision.sha256||go.approvedAt!==decision.recordedAt||decision.version!=='m41-owner-received-authority/v1'||decision.approvedBy!=='Guy'||decision.attempt!==5||decision.maximumAttempts!==5||decision.maximumPlanningCalls!==2||decision.maximumPlanningMicroUsd!==2400000||decision.maximumTotalMicroUsd!==12000000||decision.maximumTotalCalls!==121||decision.furtherAttemptAllowed!==false||decision.automaticAfterIndependentPass!==true||Date.parse(go.approvedAt)>Date.now()||Date.now()-Date.parse(go.approvedAt)>=21600000)engineSiteFail('local_concurrency_owner');
 const oldBinding=pinned(s.parentExecutionClaim),pointer=pinned(s.parentGlobalClaim);
 if(s.parentExecutionClaim.file!==prior.executionFile||s.parentGlobalClaim.file!==prior.globalFile||oldBinding.grantFile!==s.parentGrant.file||oldBinding.grantSha256!==s.parentGrant.sha256||oldBinding.authoritySha256!==canonicalHash(oldAuthority)||oldBinding.directory!==failed.directory||oldBinding.attempt!==4||oldBinding.maximumAttempts!==4||oldBinding.ownerGoSha256!==prior.goSha256||canonicalHash(oldBinding.carried)!==canonicalHash(prior.carried)||pointer.executionFile!==prior.executionFile||canonicalHash(pointer.binding)!==canonicalHash(oldBinding))engineSiteFail('local_concurrency_claim');
 const specSha=canonicalHash(s),memory=()=>canonicalHash({failed,oldAuthority,checkpoint,claims:[...journal.claims],results:[...journal.results],scope,decision}),memorySha=memory();
 const checkChain=()=>{prior.checkChain();assertLocalConcurrencyEvidence(s);if(canonicalHash(s)!==specSha||canonicalHash(g.currentConcurrencyContinuation)!==specSha||memory()!==memorySha||sha(bytes(scope.ownerGoFile))!==goSha256||Date.now()-Date.parse(go.approvedAt)>=21600000)engineSiteFail('local_concurrency_changed');pinned(scope.ownerDecision);};checkChain();
 const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
 const extension=freeze(localAttemptExtensionPolicySchema.parse({version:'storyboard-attempt-extension/v2',maxAttempts:5,approvalSha256:s.approval.sha256,previous:oldAuthority.storyboardAttemptExtension}));
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:calls,evidenceSha256:canonicalHash({spec:s,priorCarry:prior.carried,attempt:5,maximumAttempts:5})});
 const e=Object.freeze({spec:s,scope,goSha256,extension,failed,oldAuthority,prior,checkpoint,journal,carried,checkChain,masterFile:prior.masterFile,executionFile:prior.executionFile+'.concurrency-plan-5.json',globalFile:prior.masterFile+'.concurrency-plan-5-v1.json',nextAttempt:5 as const,maximumAttempts:5 as const});envelopes.add(e);return e;
}
export type LocalConcurrencyEnvelope=ReturnType<typeof loadLocalConcurrencyContinuation>;
const preparations=new WeakSet<object>(),denied=():never=>engineSiteFail('local_concurrency_replay_dispatch_forbidden');
function assertEnvelope(e:LocalConcurrencyEnvelope){if(!envelopes.has(e))engineSiteFail('local_concurrency_envelope');e.checkChain();}
function assertAuthority(e:LocalConcurrencyEnvelope,a:EngineOrderAuthority){if(a.purpose!=='test'||a.storyboardConcurrencyPolicy!==ENGINE_SOURCE_CONCURRENCY_POLICY||canonicalHash(a.storyboardAttemptExtension)!==canonicalHash(e.extension)||canonicalHash(a.budget.steps)!==canonicalHash(localConcurrencySteps())||a.requestSha256!==e.oldAuthority.requestSha256||a.optionsSha256!==e.oldAuthority.optionsSha256||a.budget.maximumMicroUsd!==12000000||a.budget.maximumCalls!==121)engineSiteFail('local_concurrency_execution_scope');}
export async function replayLocalConcurrency(e:LocalConcurrencyEnvelope,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 assertEnvelope(e);assertAuthority(e,authority);const snapshotSha256=canonicalHash(snapshot),old=await replayLocalAttemptExtension(e.prior,snapshot,e.oldAuthority),used=new Set<string>();
 const replay:EngineRuntime={checkpoint:structuredClone(e.checkpoint),signal:new AbortController().signal,check:e.checkChain,load:denied,save:denied,advance:denied,result:denied,async call(plan){e.checkChain();plan.revalidate?.();const c=e.journal.claims.get(plan.call.step),r=e.journal.results.get(plan.call.step);if(!c||!r||used.has(plan.call.step)||canonicalHash(plan.call)!==canonicalHash(c.claim.call)||canonicalHash(plan.wire)!==c.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('local_concurrency_old_wire');await plan.admitSaved(r);used.add(plan.call.step);e.checkChain();return r;}};
 const held=await admitEngineHeldExtendedPreparation(replay,snapshot,old.held,old.repair);if(used.size!==2||canonicalHash(snapshot)!==snapshotSha256)engineSiteFail('local_concurrency_old_wire');
 const repair:StoryboardRepair={parentStoryboardDigest:held.initial.diagnostic.storyboardDigest,draft:held.initial.draft,review:held.initial.diagnostic.rawReview,parentRepair:held.heldExtendedRepair,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true},extension:e.extension,addedContracts:['sourceConcurrency']};
 Object.freeze(repair.parentCompile);Object.freeze(repair.addedContracts);Object.freeze(repair);
 const v=Object.freeze({held,repair,snapshotSha256,authoritySha256:canonicalHash(authority),carried:e.carried,envelope:e});preparations.add(v);return v;
}
export type AdmittedLocalConcurrency=Awaited<ReturnType<typeof replayLocalConcurrency>>;
function check(v:AdmittedLocalConcurrency,r:Pick<EngineRuntime,'checkpoint'>,snapshot:StorySnapshot){if(!preparations.has(v))engineSiteFail('local_concurrency_preparation');assertEnvelope(v.envelope);assertAuthority(v.envelope,r.checkpoint.authority);if(v.authoritySha256!==canonicalHash(r.checkpoint.authority)||v.snapshotSha256!==canonicalHash(snapshot))engineSiteFail('local_concurrency_snapshot');assertEngineInitialPreparation(v.held,r.checkpoint.authority,r.checkpoint);}
export async function preflightLocalConcurrency(v:AdmittedLocalConcurrency,snapshot:StorySnapshot,authority:EngineOrderAuthority){
 const checkpoint={...v.envelope.checkpoint,authority},plans:any[]=[];check(v,{checkpoint},snapshot);
 const runtime:EngineRuntime={checkpoint,signal:new AbortController().signal,check(){},load:denied,save:denied,advance:denied,result:denied,async call(p){p.revalidate?.();plans.push({call:p.call,wire:p.wire});throw Error('local_concurrency_preflight_boundary');}};
 let reason='';try{await prepareEngineStoryboard(runtime,snapshot,v.held.source,{fetch:denied,openAIKey:denied,anthropicKey:denied},'initial_repair_4',undefined,v.repair);}catch(e){reason=e instanceof Error?e.message:String(e);}if(plans.length!==1)engineSiteFail(reason||'local_concurrency_preflight');check(v,{checkpoint},snapshot);return plans[0];
}
export async function runLocalConcurrency(runtime:LocalEngineTrialRuntime,snapshot:StorySnapshot,v:AdmittedLocalConcurrency,ports:EngineProviderPorts){
 const guard=()=>{check(v,runtime,snapshot);runtime.check();};guard();const m=await runtime.meter();guard();if(m.carriedMicroUsd!==v.carried.accountedMicroUsd||m.carriedCalls!==v.carried.logicalCalls||m.lostLocalCalls===undefined||m.lostLocalCalls||m.blocked)engineSiteFail('local_concurrency_runtime_carry');
 const bound:EngineRuntime={checkpoint:runtime.checkpoint,signal:runtime.signal,check:guard,load:n=>runtime.load(n),save:(n,x)=>runtime.save(n,x),advance:p=>runtime.advance(p),result:s=>runtime.result(s),async call(p){guard();const r=await runtime.call(p);guard();return r;}};
 const result=await prepareEngineStoryboard(bound,snapshot,v.held.source,ports,'initial_repair_4',undefined,v.repair);guard();if(!engineStoryboardSupported(result.diagnostic.status))engineSiteFail('engine_storyboard_held');
 const replay:EngineRuntime={...bound,load:denied,save:denied,advance:denied,async call(p){guard();p.revalidate?.();const c=runtime.checkpoint.calls[p.call.step],r=await runtime.result(p.call.step);if(!c?.settled||c.wireSha256!==p.call.wireSha256||!r||!p.admitSaved)engineSiteFail('local_concurrency_new_receipt');await p.admitSaved(r);guard();return r;}};
 const accepted=await admitEngineSupportedInitialPreparation(replay,snapshot,v.held,v.repair);guard();return accepted;
}
export function claimLocalConcurrency(e:LocalConcurrencyEnvelope,binding:unknown,resume:boolean,masterFile:string){assertEnvelope(e);if(resume||masterFile!==e.masterFile)engineSiteFail('local_concurrency_capability');if(existsSync(e.globalFile)||existsSync(e.executionFile))engineSiteFail('local_concurrency_already_claimed');writeFileSync(e.globalFile,JSON.stringify({version:'engine-local-concurrency-claim/v1',executionFile:e.executionFile,ownerGoSha256:e.goSha256,binding},null,2)+'\n',{flag:'wx',mode:0o600});writeFileSync(e.executionFile,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});return e.executionFile;}
export function localConcurrencyWitness(e:LocalConcurrencyEnvelope,binding:any,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 assertEnvelope(e);assertAuthority(e,authority);const b=canonicalHash(binding),ad=canonicalHash(authority);if(binding.authoritySha256!==ad||binding.ownerGoSha256!==e.goSha256)engineSiteFail('local_concurrency_dispatch_binding');
 const guard=()=>{assertEnvelope(e);const pointer=json(e.globalFile);if(pointer.version!=='engine-local-concurrency-claim/v1'||pointer.executionFile!==e.executionFile||pointer.ownerGoSha256!==e.goSha256||canonicalHash(pointer.binding)!==b||canonicalHash(json(e.executionFile))!==b)engineSiteFail('local_concurrency_dispatch_binding');};
 const slot=(step:string)=>authority.budget.steps.find(s=>s.id===step)??engineSiteFail('local_concurrency_dispatch_slot'),file=(step:string)=>{slot(step);return e.masterFile+'.concurrency-plan-5-v1.'+step+'.dispatch.json';};
 // One synchronous scan has no await/user callback. Guard the complete scan, rather than
 // re-hashing all ancestor trees once per unused budget slot; validate every record itself.
 const record=(step:string)=>{const f=file(step);if(!existsSync(f))return null;const r=json(f);if(r.version!=='engine-local-concurrency-dispatch/v1'||r.executionSha256!==b||r.authoritySha256!==ad||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd||!digest.safeParse(r.claimSha256).success)engineSiteFail('local_concurrency_dispatch_binding');return r;};guard();
 return{list:()=>{guard();const records=authority.budget.steps.map(s=>record(s.id)).filter(x=>x!==null);guard();return records;},check(step,claimSha256,dispatched){guard();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_concurrency_unknown_dispatch');},begin(step,claimSha256){guard();digest.parse(claimSha256);if(existsSync(file(step)))engineSiteFail('local_concurrency_unknown_dispatch');writeFileSync(file(step),JSON.stringify({version:'engine-local-concurrency-dispatch/v1',executionSha256:b,authoritySha256:ad,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}};
}
