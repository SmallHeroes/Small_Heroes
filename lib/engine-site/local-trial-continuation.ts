import 'server-only';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineOrderAuthoritySchema,engineSiteFail} from './contract';
import {parseEngineCheckpoint,type EngineCheckpoint,type EngineRuntime,type EngineProviderResult} from './durable-worker';
import {anthropicAuthorCost} from './anthropic-author';
import {auditionUsageCost} from '@/scripts/personal-simple-book-illustrator';
import {admitEngineInitialPreparation,type StorySnapshot} from './story-preparation';
import type {LocalTrialCarry} from './local-trial-runtime';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute);
const ref=z.object({file:absolute,sha256:digest}).strict();
export const localContinuationSchema=z.object({version:z.literal('engine-local-initial-hold-continuation/v1'),
 parentGrant:ref,parentStop:ref,parentExit:ref,parentEvidence:ref}).strict();
export type LocalContinuation=z.infer<typeof localContinuationSchema>;
const indexSchema=z.object({version:z.literal('engine-local-parent-evidence/v1'),root:absolute,
 rows:z.array(z.object({path:z.string().min(1),bytes:z.number().int().positive().max(64*1024*1024),sha256:digest}).strict()).min(1).max(2048)}).strict();
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function bytes(file:string){if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file||lstatSync(file).size>64*1024*1024)engineSiteFail('local_parent_file');return readFileSync(file);}
function json(file:string){return JSON.parse(bytes(file).toString('utf8'));}
function pinned(row:z.infer<typeof ref>){if(sha(bytes(row.file))!==row.sha256)engineSiteFail('local_parent_evidence_changed');return json(row.file);}
/** Parent's whole terminal tree is sealed, including failures and pending-poll history. No write or dispatch exists here. */
export function assertLocalParentEvidence(spec:LocalContinuation){
 const s=localContinuationSchema.parse(spec);for(const r of [s.parentGrant,s.parentStop,s.parentExit])pinned(r);
 const index=indexSchema.parse(pinned(s.parentEvidence)),root=path.resolve(index.root),actual:string[]=[];
 if(lstatSync(root).isSymbolicLink()||realpathSync(root)!==root)engineSiteFail('local_parent_path');
 const walk=(dir:string)=>{for(const e of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(lstatSync(file).isSymbolicLink())engineSiteFail('local_parent_path');if(e.isDirectory())walk(file);else actual.push(path.relative(root,file).replace(/\\/g,'/'));if(actual.length>2048)engineSiteFail('local_parent_size');}};walk(root);
 const names=index.rows.map(r=>r.path);
 if(new Set(names).size!==names.length||canonicalHash([...names].sort())!==canonicalHash(actual.sort()))engineSiteFail('local_parent_tree_changed');
 for(const r of index.rows){const file=path.resolve(root,r.path);if(!file.startsWith(root+path.sep)||/(^|[\\/])(?:\.env(?:\.|$)|credentials|node_modules|\.git)([\\/]|$)/i.test(r.path))engineSiteFail('local_parent_path');const b=bytes(file);if(b.length!==r.bytes||sha(b)!==r.sha256)engineSiteFail('local_parent_evidence_changed');}
 return {root,index};
}
export const INITIAL_PARENT_STEPS=Object.freeze(['story_author','story_editor','story_final_review','story_comparison','initial_storyboard','initial_storyboard_review']);
const allowed=new Set([...INITIAL_PARENT_STEPS,'story_final_review_citation','story_comparison_citation']);
/** Sealed terminal journals only. Costs come from raw receipts, never from a caller-supplied carry. */
export function readLocalSettledJournal(root:string,checkpoint:EngineCheckpoint,required:readonly string[],permitted:ReadonlySet<string>,price?: (step:string,result:EngineProviderResult)=>number|null){
 const authority=checkpoint.authority;
 const asset=(id:string)=>{if(!/^[a-f0-9-]{36}$/.test(id))engineSiteFail('local_parent_asset');const record=json(path.join(root,'journal/assets',id+'.json'));if(record.id!==id||record.version!=='engine-local-asset/v1'||record.sha256!==canonicalHash(record.value))engineSiteFail('local_parent_asset');return record.value;};
 const claims=new Map<string,any>(),results=new Map<string,EngineProviderResult>();let known=0;
 const steps=readdirSync(path.join(root,'journal/calls'));
 if(required.some(s=>!steps.includes(s))||steps.some(s=>!permitted.has(s))||canonicalHash([...steps].sort())!==canonicalHash(Object.keys(checkpoint.calls).sort()))engineSiteFail('local_parent_scope');
 for(const step of steps){const dir=path.join(root,'journal/calls',step),claim=json(path.join(dir,'claim.json')),settled=json(path.join(dir,'result.json')),request=asset(claim.requestAssetId),saved=asset(settled.assetId),r=settled.result as EngineProviderResult;
  const slot=authority.budget.steps.find(s=>s.id===step),c=checkpoint.calls[step];
  if(claim.version!=='engine-local-claim/v1'||claim.authoritySha256!==canonicalHash(authority)||claim.call.step!==step||!slot||slot.maximumMicroUsd!==claim.call.maximumMicroUsd||
   !c?.settled||c.requestAssetId!==claim.requestAssetId||c.resultAssetId!==settled.assetId||c.wireSha256!==claim.call.wireSha256||request.authoritySha256!==canonicalHash(authority)||canonicalHash(request.call)!==canonicalHash(claim.call)||canonicalHash(request.wire)!==claim.call.wireSha256||
   settled.version!=='engine-local-result/v1'||settled.claimSha256!==canonicalHash(claim)||settled.assetSha256!==canonicalHash(saved)||saved.wireSha256!==claim.call.wireSha256||saved.completed!==true||canonicalHash(saved.result)!==canonicalHash(r))engineSiteFail('local_parent_receipt');
  const raw=r.raw as any,cost=price?price(step,r):step==='story_author'?anthropicAuthorCost(raw):raw.model==='gpt-6.1-sol'&&raw.service_tier==='default'?auditionUsageCost(raw.usage,'sol'):null;
  if(r.usable!==true||cost===null||cost!==r.estimatedMicroUsd||cost>slot.maximumMicroUsd)engineSiteFail('local_parent_unsettled');
  known+=cost;claims.set(step,{claim,request});results.set(step,r);
 }
 if(!Number.isSafeInteger(known))engineSiteFail('local_parent_meter');
 return {asset,claims,results,known};
}
/** Strictly ONE root initial-plan HOLD. No recursive continuation, UNKNOWN, failed call, changed request or new book. */
export function loadLocalParentEnvelope(g:LocalEngineGrant,parent:LocalEngineGrant){
 if(!g.continuation||g.planningRecovery||g.mediaContinuation||parent.continuation||parent.planningRecovery||parent.mediaContinuation)engineSiteFail('local_parent_scope');
 const {root}=assertLocalParentEvidence(g.continuation);
 if(root!==parent.directory||parent.directory===g.directory||g.approvalReference!==parent.approvalReference||g.approvedBy!==parent.approvedBy||g.approvedAt!==parent.approvedAt||
  g.profile.sha256!==parent.profile.sha256||g.profile.file!==parent.profile.file||g.readerId!==parent.readerId||g.source.root!==parent.source.root||
  g.maximumMicroUsd>parent.maximumMicroUsd||g.maximumCalls>parent.maximumCalls)engineSiteFail('local_parent_scope');
 const stop=pinned(g.continuation.parentStop),exit=pinned(g.continuation.parentExit);
 if(path.dirname(g.continuation.parentStop.file)!==root||stop.version!=='engine-local-book-stop/v1'||stop.reason!=='engine_storyboard_held'||stop.phase!=='story'||stop.grantSha256!==g.continuation.parentGrant.sha256||exit.code!==1||exit.outcomeExists!==false)engineSiteFail('local_parent_not_terminal_hold');
 try {process.kill(exit.childPid,0);engineSiteFail('local_parent_process_alive');} catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
 const checkpoint=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))}),authority=engineOrderAuthoritySchema.parse(checkpoint.authority);
 if(authority.purpose!=='test'||authority.orderId!==parent.approvalReference||authority.sourceRevision!==parent.source.head||authority.budget.maximumMicroUsd!==parent.maximumMicroUsd||authority.budget.maximumCalls!==parent.maximumCalls||checkpoint.phase!=='story'||checkpoint.snapshotSha256!==authority.requestSha256||Object.keys(checkpoint.outputs).length)engineSiteFail('local_parent_authority');
 const {asset,claims,results,known}=readLocalSettledJournal(root,checkpoint,INITIAL_PARENT_STEPS,allowed),steps=[...results.keys()];
 if(!Number.isSafeInteger(known)||known!==stop.meter?.knownEstimateMicroUsd||known!==stop.meter?.accountedMicroUsd||steps.length!==stop.meter?.logicalCalls||stop.meter?.pendingCalls!==0||stop.meter?.unknownCalls!==0||stop.meter?.failedCalls!==0||stop.meter?.overReservedCalls!==0||known>=g.maximumMicroUsd||steps.length>=g.maximumCalls)engineSiteFail('local_parent_meter');
 const carried:LocalTrialCarry=Object.freeze({accountedMicroUsd:known,logicalCalls:steps.length,evidenceSha256:g.continuation.parentEvidence.sha256});
 return {parent,checkpoint,authority,carried,claims,results,asset};
}
export type LocalParentEnvelope=ReturnType<typeof loadLocalParentEnvelope>;
/** All six original operations are re-created under the OLD authority; execute/key/transport are unreachable. */
export async function replayLocalInitialPreparation(parent:LocalParentEnvelope,snapshot:StorySnapshot){
 const used=new Set<string>(),denied=():never=>engineSiteFail('local_parent_replay_write_forbidden');
 const runtime:EngineRuntime={checkpoint:structuredClone(parent.checkpoint),signal:new AbortController().signal,check(){},
  load:async()=>null,save:denied,advance:denied,result:async step=>{const r=parent.results.get(step);if(!r)engineSiteFail('local_parent_call_missing');return r;},
  async call(plan){const prior=parent.claims.get(plan.call.step),r=parent.results.get(plan.call.step);plan.revalidate?.();
   if(!prior||!r||used.has(plan.call.step)||canonicalHash(plan.call)!==canonicalHash(prior.claim.call)||canonicalHash(plan.wire)!==prior.claim.call.wireSha256||!plan.admitSaved)engineSiteFail('local_parent_wire_changed');
   await plan.admitSaved(r);used.add(plan.call.step);return r;
  }};
 const admitted=await admitEngineInitialPreparation(runtime,snapshot);
 if(canonicalHash([...used].sort())!==canonicalHash([...parent.results.keys()].sort()))engineSiteFail('local_parent_unread_call');
 return admitted;
}
