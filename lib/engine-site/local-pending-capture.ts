/** Provider-free reconstruction of a real stopped native Responses call. No credential access. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import {prepareLocalEngineTrial,localEngineGrantSchema} from '@/scripts/engine-local-book';
import {parseEngineCheckpoint,type EngineRuntime,type PreparedEngineCall,type EngineProviderResult} from './durable-worker';
import {engineSiteFail,identifierSchema} from './contract';
import {replayLocalConcurrency} from './local-trial-concurrency-continuation';
import {admitEngineSupportedInitialPreparation} from './story-preparation';
import {createEngineNativeRecipe} from './native-recipe';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';

export const pendingDigest=z.string().regex(/^[a-f0-9]{64}$/),pendingAbsolute=z.string().refine(path.isAbsolute);
export const pendingRefSchema=z.object({file:pendingAbsolute,sha256:pendingDigest}).strict();
export const pendingSettlementSpecSchema=z.object({version:z.literal('engine-local-pending-settlement/v1'),
 sourceRoot:pendingAbsolute,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),directory:pendingAbsolute,
 parentGrant:pendingRefSchema,parentBookEvidence:pendingRefSchema,parentStop:pendingRefSchema,parentStart:pendingRefSchema,parentExit:pendingRefSchema,
 targetStep:identifierSchema,targetClaim:pendingRefSchema,targetDispatch:pendingRefSchema,targetWitness:pendingRefSchema,lastPoll:pendingRefSchema,
 maximumPolls:z.literal(120),pollWindowMs:z.literal(900000)}).strict();
export type PendingSettlementSpec=z.infer<typeof pendingSettlementSpecSchema>;
export const pendingFileSha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function pendingRead(file:string){const f=path.resolve(file);if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(f))engineSiteFail('pending_private_path');
 const st=lstatSync(f);if(!st.isFile()||st.isSymbolicLink()||realpathSync(f)!==f||st.size>64*1024*1024)engineSiteFail('pending_file');return readFileSync(f);}
export function pendingPinnedBytes(ref:z.infer<typeof pendingRefSchema>){const b=pendingRead(ref.file);if(pendingFileSha(b)!==ref.sha256)engineSiteFail('pending_pin_changed');return b;}
export function pendingPinned(ref:z.infer<typeof pendingRefSchema>){return JSON.parse(pendingPinnedBytes(ref).toString('utf8'));}
const read=(f:string)=>JSON.parse(pendingRead(f).toString('utf8'));
const beneath=(a:string,b:string)=>{const x=path.resolve(a).toLowerCase(),y=path.resolve(b).toLowerCase();return x===y||x.startsWith(y+path.sep);};
function assertTree(ref:z.infer<typeof pendingRefSchema>,root:string){
 const index=pendingPinned(ref);if(index.complete!==true||index.root!==root||!Array.isArray(index.files)||!index.files.length||realpathSync(root)!==root||lstatSync(root).isSymbolicLink())engineSiteFail('pending_parent_tree');
 const actual:string[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isSymbolicLink())engineSiteFail('pending_parent_tree');if(e.isDirectory())walk(f);else actual.push(path.relative(root,f).replace(/\\/g,'/'));}};walk(root);
 const paths=new Set<string>();for(const row of index.files){if(typeof row.path!=='string'||!row.path||path.isAbsolute(row.path)||row.path.split(/[\\/]/).some((x:string)=>!x||x==='..'||x==='.'))engineSiteFail('pending_parent_tree');
  const f=path.resolve(root,row.path);if(!beneath(f,root)||paths.has(row.path))engineSiteFail('pending_parent_tree');paths.add(row.path);const b=pendingRead(f);if(b.length!==row.bytes||pendingFileSha(b)!==row.sha256)engineSiteFail('pending_parent_tree_changed');}
 if(canonicalHash(actual.sort())!==canonicalHash([...paths].sort()))engineSiteFail('pending_parent_tree_changed');
 if(!Array.isArray(index.controls))engineSiteFail('pending_parent_tree');for(const r of index.controls)pendingPinnedBytes(r);
}
const captured=new WeakMap<object,{plan:PreparedEngineCall;check:()=>void;masterFile:string}>();
export async function captureLocalPendingResponse(input:PendingSettlementSpec){
 const spec=pendingSettlementSpecSchema.parse(input),specSha256=canonicalHash(spec),g=localEngineGrantSchema.parse(pendingPinned(spec.parentGrant));
 if(!g.currentConcurrencyContinuation||g.source.root!==spec.sourceRoot||path.resolve(process.cwd())!==spec.sourceRoot||realpathSync(spec.sourceRoot)!==spec.sourceRoot||path.resolve(spec.directory)!==spec.directory||beneath(spec.directory,spec.sourceRoot)||beneath(spec.sourceRoot,spec.directory)||beneath(spec.directory,g.directory)||beneath(g.directory,spec.directory)||existsSync(spec.directory))engineSiteFail('pending_scope');
 assertTree(spec.parentBookEvidence,g.directory);const stop=pendingPinned(spec.parentStop),start=pendingPinned(spec.parentStart),exit=pendingPinned(spec.parentExit);
 if(path.dirname(spec.parentStop.file)!==g.directory||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='local_trial_pending_deadline'||stop.grantSha256!==spec.parentGrant.sha256||start.grantSha256!==spec.parentGrant.sha256||start.sourceHead!==g.source.head||start.childPid!==exit.childPid||exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.supervisorExitCode!==1||!(Date.parse(start.at)<=Date.parse(stop.at)&&Date.parse(stop.at)<=Date.parse(exit.at)&&Date.parse(exit.at)<=Date.now())||existsSync(path.join(g.directory,'OUTCOME.json')))engineSiteFail('pending_terminal');
 assertLocalHistoricalProcessGone(start.pid,exit.at);assertLocalHistoricalProcessGone(exit.childPid,exit.at);
 const x=prepareLocalEngineTrial(g,true);if(!x.concurrency?.historicalReplay||x.prepared.snapshot.appearance.kind!=='description')engineSiteFail('pending_native_boundary');
 const root=path.join(g.directory,'journal'),cp=parseEngineCheckpoint({engineSite:read(path.join(root,'checkpoint.json'))});
 if(canonicalHash(cp.authority)!==canonicalHash(x.authority)||Object.keys(cp.outputs).length||cp.phase!=='story')engineSiteFail('pending_native_boundary');
 if(canonicalHash(read(path.join(root,'carry.json')))!==canonicalHash(x.concurrency.carried))engineSiteFail('pending_carry');
 const asset=(id:string)=>{if(!/^[a-f0-9-]{36}$/.test(id))engineSiteFail('pending_asset');const r=read(path.join(root,'assets',id+'.json'));if(r.version!=='engine-local-asset/v1'||r.id!==id||r.sha256!==canonicalHash(r.value))engineSiteFail('pending_asset');return r.value;};
 const known=new Map<string,{claim:any;wire:any;result:EngineProviderResult}>();let knownCost=x.concurrency.carried.accountedMicroUsd;
 if(canonicalHash(readdirSync(path.join(root,'calls')).sort())!==canonicalHash(Object.keys(cp.calls).sort()))engineSiteFail('pending_calls');
 for(const step of Object.keys(cp.calls)){
  identifierSchema.parse(step);const d=path.join(root,'calls',step),claim=read(path.join(d,'claim.json')),req=asset(claim.requestAssetId),s=cp.calls[step];
  if(claim.authoritySha256!==canonicalHash(cp.authority)||req.authoritySha256!==claim.authoritySha256||canonicalHash(req.call)!==canonicalHash(claim.call)||canonicalHash(req.wire)!==claim.call.wireSha256||s.wireSha256!==claim.call.wireSha256||s.requestAssetId!==claim.requestAssetId||s.deadlineAt!==claim.deadlineAt)engineSiteFail('pending_request');
  if(step===spec.targetStep){if(s.settled||existsSync(path.join(d,'result.json')))engineSiteFail('pending_already_settled');continue;}
  if(!s.settled)engineSiteFail('pending_multiple_unresolved');const r=read(path.join(d,'result.json')),v=asset(r.assetId);
  if(r.version!=='engine-local-result/v1'||r.claimSha256!==canonicalHash(claim)||r.assetId!==s.resultAssetId||r.assetSha256!==canonicalHash(v)||v.wireSha256!==claim.call.wireSha256||v.completed!==true||canonicalHash(v.result)!==canonicalHash(r.result)||r.result.usable!==true||!Number.isSafeInteger(r.result.estimatedMicroUsd)||r.result.estimatedMicroUsd<0)engineSiteFail('pending_result');
  known.set(step,{claim,wire:req.wire,result:r.result});knownCost+=r.result.estimatedMicroUsd;
 }
 const dir=path.join(root,'calls',spec.targetStep),claim=pendingPinned(spec.targetClaim),dispatch=pendingPinned(spec.targetDispatch),last=pendingPinned(spec.lastPoll),witness=pendingPinned(spec.targetWitness);
 const polls=readdirSync(dir).filter(f=>/^pending-\d{5}\.json$/.test(f)).sort(),seenId=last.id;
 if(spec.targetClaim.file!==path.join(dir,'claim.json')||spec.targetDispatch.file!==path.join(dir,'dispatch.json')||!polls.length||spec.lastPoll.file!==path.join(dir,polls[polls.length-1])||!/^resp_[A-Za-z0-9_-]+$/.test(seenId)||cp.calls[spec.targetStep]?.pendingId!==seenId||cp.calls[spec.targetStep]?.polls!==polls.length||dispatch.claimSha256!==canonicalHash(claim)||!Number.isSafeInteger(dispatch.at)||dispatch.at>claim.deadlineAt||Date.parse(stop.at)<claim.deadlineAt||spec.targetWitness.file!==x.concurrency.masterFile+'.concurrency-plan-5-v1.'+spec.targetStep+'.dispatch.json'||witness.claimSha256!==canonicalHash(claim)||witness.authoritySha256!==canonicalHash(cp.authority)||witness.step!==spec.targetStep||witness.maximumMicroUsd!==claim.call.maximumMicroUsd)engineSiteFail('pending_identity');
 for(const n of polls){const r=read(path.join(dir,n));if(r.id!==seenId||!Number.isSafeInteger(r.at)||r.at<dispatch.at||r.raw?.id!==undefined&&r.raw.id!==seenId||r.raw?.transientPoll!==true&&!['queued','in_progress'].includes(r.raw?.status))engineSiteFail('pending_identity');}
 const logicalCalls=x.concurrency.carried.logicalCalls+Object.keys(cp.calls).length,reserve=claim.call.maximumMicroUsd;
 if(witness.version!=='engine-local-concurrency-dispatch/v1'||witness.executionSha256!==canonicalHash(read(x.concurrency.executionFile))||!Number.isSafeInteger(reserve)||reserve<=0||stop.meter?.knownEstimateMicroUsd!==knownCost||stop.meter.accountedMicroUsd!==knownCost+reserve||stop.meter.logicalCalls!==logicalCalls||stop.meter.pendingCalls!==1||stop.meter.unknownCalls!==0||stop.meter.failedCalls!==0||stop.meter.overReservedCalls!==0||stop.meter.lostLocalCalls!==0)engineSiteFail('pending_meter');
 const memory=()=>canonicalHash({spec,g,cp,claim,dispatch,last,witness,known:[...known]}),memorySha=memory();
 const check=()=>{if(memory()!==memorySha||canonicalHash(input)!==specSha256)engineSiteFail('pending_memory_changed');assertTree(spec.parentBookEvidence,g.directory);for(const r of [spec.parentGrant,spec.parentStop,spec.parentStart,spec.parentExit,spec.targetClaim,spec.targetDispatch,spec.targetWitness,spec.lastPoll])pendingPinned(r);x.concurrency!.checkChain();};
 const cap=await replayLocalConcurrency(x.concurrency,x.prepared.snapshot,x.authority),used=new Set<string>(),denied=():never=>engineSiteFail('pending_replay_forbidden');
 let target:PreparedEngineCall|undefined;
 const runtime:EngineRuntime={checkpoint:cp,signal:new AbortController().signal,check,load:async()=>null,save:denied,advance:denied,result:denied,
  async call(plan){check();plan.revalidate?.();if(used.has(plan.call.step))engineSiteFail('pending_replay_duplicate');
   if(plan.call.step===spec.targetStep){if(canonicalHash(plan.call)!==canonicalHash(claim.call)||canonicalHash(plan.wire)!==claim.call.wireSha256||(plan.wire as any).endpoint!=='https://api.openai.com/v1/responses')engineSiteFail('pending_replay_wire');target=plan;throw boundary;}
   const r=known.get(plan.call.step);if(!r||canonicalHash(plan.call)!==canonicalHash(r.claim.call)||canonicalHash(plan.wire)!==r.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('pending_replay_wire');await plan.admitSaved(r.result);used.add(plan.call.step);check();return r.result;
  }};
 const boundary=Object.freeze({pendingSettlementBoundary:true}),initial=await admitEngineSupportedInitialPreparation(runtime,x.prepared.snapshot,cap.held,cap.repair),db=new Proxy({},{get:denied}) as any;
 try{await createEngineNativeRecipe({db,storage:{put:denied,read:denied,sign:denied},snapshot:x.prepared.snapshot,ports:{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},initialPreparation:initial,materialize:denied,accept:denied})(runtime);}catch(e){if(e!==boundary)throw e;}
 if(!target||used.size!==known.size)engineSiteFail('pending_replay_incomplete');check();
 const binding=Object.freeze({version:'engine-local-pending-capture/v1',specSha256,parentGrantSha256:spec.parentGrant.sha256,authoritySha256:canonicalHash(cp.authority),claimSha256:canonicalHash(claim),wireSha256:claim.call.wireSha256,responseId:seenId,step:spec.targetStep,maximumMicroUsd:reserve,knownMicroUsd:knownCost,accountedMicroUsd:knownCost+reserve,logicalCalls,maximumTotalMicroUsd:g.maximumMicroUsd,maximumTotalCalls:g.maximumCalls});
 const value=Object.freeze({spec,binding});captured.set(value,Object.freeze({plan:target,check,masterFile:x.concurrency.masterFile}));return value;
}
export type CapturedLocalPendingResponse=Awaited<ReturnType<typeof captureLocalPendingResponse>>;
/** Internal capability boundary: an object copy is never sufficient. */
export function inspectCapturedPending(value:CapturedLocalPendingResponse){const x=captured.get(value);if(!x)engineSiteFail('pending_capability');x.check();return x;}
