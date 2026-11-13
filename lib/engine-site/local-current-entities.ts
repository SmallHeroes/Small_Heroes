/** Bounded local sheet continuations. Historical receipts and the prepared source are read-only. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {PrismaClient} from '@prisma/client';
import {canonicalHash} from '@/lib/canonical-json';
import type {AuditionAttempt} from '@/lib/personal-wizard/simple-book-reviewed-audition';
import {PICTURE_BOOK_SCALE_REPORTING} from '@/lib/personal-wizard/picture-book-direction';
import {auditionUsageCost} from '@/scripts/personal-simple-book-illustrator';
import {anthropicAuthorCost} from './anthropic-author';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import {ENGINE_CURRENT_CUSTOMER_V2,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V4,ENGINE_CURRENT_CUSTOMER_V5,ENGINE_CURRENT_CUSTOMER_V6,ENGINE_CURRENT_CUSTOMER_V7} from './current-engine-policy';
import {parseEngineCheckpoint,type EngineRuntime} from './durable-worker';
import {admitLocalCurrentRegistration,localConsentDispatchWitness,localConsentLedger,localConsentRecordSchema,type LocalConsentLedger} from './local-consent-ledger';
import {assertLocalParentEvidence,readLocalSettledJournal} from './local-trial-continuation';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';
import {createEngineNativeRecipe,type EngineNativeSheetObservation} from './native-recipe';
import {locationRepairFindings} from './local-trial-location-repair';
import {locationV2RepairFindings} from './local-trial-location-repair-v2';
import type {LocalTrialCarry} from './local-trial-runtime';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const pin=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localCurrentEntitiesSchema=z.object({version:z.literal('engine-local-current-entities-continuation/v1'),
 parentGo:pin,parentStop:pin,parentExit:pin,parentLaunch:pin,parentLauncherLog:pin,parentEvidence:pin,parentConsentSha256:digest}).strict();
export const localCurrentLocationsSchema=localCurrentEntitiesSchema.extend({version:z.literal('engine-local-current-locations-continuation/v1'),
 previousLink:pin,targetImageSha256:digest}).strict();
export const localCurrentPictureBookSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-picture-book-continuation/v1')}).strict();
export const localCurrentSpatialSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-spatial-continuation/v1')}).strict();
export const localCurrentSpatialCorrectionSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-spatial-correction/v1')}).strict();
export const localCurrentScaleContinuationSchema=localCurrentLocationsSchema.extend({version:z.literal('engine-local-current-scale-continuation/v1'),
 targetReviewStep:z.string().regex(/^page_[0-8]_[0-2]_qa2$/)}).strict();
type Spec=z.infer<typeof localCurrentEntitiesSchema>|z.infer<typeof localCurrentLocationsSchema>|z.infer<typeof localCurrentPictureBookSchema>|z.infer<typeof localCurrentSpatialSchema>|z.infer<typeof localCurrentSpatialCorrectionSchema>|z.infer<typeof localCurrentScaleContinuationSchema>;
export const localCurrentBoundaries=['entities','locations','locations-art-direction','locations-spatial-direction','locations-spatial-correction','page-scale-abstention'] as const;
const localCurrentVersions=[ENGINE_CURRENT_CUSTOMER_V2,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V3,ENGINE_CURRENT_CUSTOMER_V4,ENGINE_CURRENT_CUSTOMER_V5,ENGINE_CURRENT_CUSTOMER_V6,ENGINE_CURRENT_CUSTOMER_V7] as const;
export function localCurrentBoundary(spec:Spec) {
 if(spec.version==='engine-local-current-scale-continuation/v1')return 'page-scale-abstention';
 if(spec.version==='engine-local-current-spatial-correction/v1')return 'locations-spatial-correction';
 if(spec.version==='engine-local-current-spatial-continuation/v1')return 'locations-spatial-direction';
 if(spec.version==='engine-local-current-picture-book-continuation/v1')return 'locations-art-direction';
 return spec.version==='engine-local-current-locations-continuation/v1'?'locations':'entities';
}
export function localCurrentTransition(boundary:ReturnType<typeof localCurrentBoundary>){
 const index=localCurrentBoundaries.indexOf(boundary) as 0|1|2|3|4|5;
 return {index,previousBoundary:localCurrentBoundaries[index-1],from:localCurrentVersions[index],to:localCurrentVersions[index+1]};
}
type Snapshot=Parameters<typeof createEngineNativeRecipe>[0]['snapshot'];
const bytes=(file:string)=>{
 const stat=lstatSync(file);
 if(/(^|[\\/])\.env(?:\.|$)/i.test(file)||!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==path.resolve(file)||stat.size>64*1024*1024)
  engineSiteFail('local_entities_file');
 return readFileSync(file);
};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const json=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
const pinned=(r:z.infer<typeof pin>)=>{const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_entities_evidence_changed');return b;};
const sorted=(rows:Iterable<string>)=>[...rows].sort().join(',');
const denied=():never=>engineSiteFail('local_entities_replay_dispatch_forbidden');
const ports={fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied};
const db=new Proxy({},{get:denied}) as PrismaClient,storage={put:denied,read:denied,sign:denied};
const oldStep=/^(?:story_(?:author|editor|final_review(?:_citation)?|comparison(?:_citation)?)|initial_storyboard(?:_review|_repair_[12](?:_review)?)?|reference_child(?:_repair)?(?:_style_qa|_qa|_identity)?|prep_child_bound_(?:review|repair(?:_review)?)|sheet_entities_0(?:_qa)?)$/;
export const localEntityMediaStep=(step:string)=>/^(?:sheet_(?:entities|locations)_0(?:_qa)?|page_[0-8]_[0-2](?:_qa2?|_identity)?|narration_[0-8])$/.test(step);
type LocationAttempt=0|1|2|3|4;
const locationSteps=(attempt:number)=>[`sheet_locations_${attempt}`,`sheet_locations_${attempt}_qa`];
export const localLocationMediaStep=(step:string,attempt:Exclude<LocationAttempt,0>=1)=>locationSteps(attempt).includes(step)||localEntityMediaStep(step)&&!step.startsWith('sheet_');
export const localCurrentLocationRepairSlots=(steps:EngineOrderAuthority['budget']['steps'],attempt:LocationAttempt=1,from:LocationAttempt=0)=>
 steps.map(s=>locationSteps(from).includes(s.id)?{...s,id:s.id.replace(`_${from}`,`_${attempt}`)}:s);
export const localCurrentLocationAttempt=(stage:number):LocationAttempt=>Math.min(stage,4) as LocationAttempt;
type ParentGo={approvalReference:string;approvedAt:string;sourceRevision:string;profileSha256:string;readerId:string;maximumMicroUsd:number;maximumCalls:number};
export function readLocalEntityParentGo(spec:Spec):unknown{return JSON.parse(pinned(spec.parentGo).toString('utf8'));}

type Admitted={readonly carried:Readonly<LocalTrialCarry>;readonly preparedSha256:string;readonly parentLedger:Readonly<LocalConsentLedger>;
 readonly boundary:ReturnType<typeof localCurrentBoundary>;readonly orderId:string;
 readonly parentConsentSha256:string;readonly parentApprovalReference:string};
type SettlementReplay={targetReviewStep:string;parentAuthoritySha256:string;receipts:ReturnType<typeof readLocalSettledJournal>};
type Admission={prepared:unknown;authoritySha256:string;snapshotSha256:string;ownerId:string;draftId:string;check:()=>void;
 settledMedia?:SettlementReplay;
 sheets?:{entities:EngineNativeSheetObservation;locations:EngineNativeSheetObservation;previousLocations:AuditionAttempt[]}};
const admissions=new WeakMap<Admitted,Admission>();
export type LocalEntitiesPreparation=Admitted;
function admission(cap:Admitted){return admissions.get(cap)??engineSiteFail('local_entities_preparation_required');}
export function checkLocalEntitiesPreparation(cap:Admitted){admission(cap).check();}
export function localEntitiesPreparedSource(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],snapshot:Snapshot,cached?:unknown){
 const a=admission(cap);
 if(a.authoritySha256!==canonicalHash(checkpoint.authority)||a.snapshotSha256!==checkpoint.snapshotSha256||a.snapshotSha256!==canonicalHash(snapshot)||
    a.ownerId!==checkpoint.ownerId||a.draftId!==checkpoint.draftId)engineSiteFail('local_entities_preparation_binding');
 if(cached!==undefined&&canonicalHash(cached)!==cap.preparedSha256)engineSiteFail('local_entities_prepared_changed');
 return structuredClone(a.prepared);
}
/** The native edit path can only obtain a sheet pair from a successful raw replay of the two real parent executions. */
export function localEntitiesSheetPair(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],snapshot:Snapshot,prepared:unknown){
 const a=admission(cap);
 if(cap.boundary==='entities'||!a.sheets)engineSiteFail('local_locations_current_preparation');
 localEntitiesPreparedSource(cap,checkpoint,snapshot,prepared);
 return structuredClone(a.sheets);
}

export function localSettledMedia(cap:Admitted,checkpoint:EngineRuntime['checkpoint'],step:string){
 const {settledMedia,authoritySha256}=admission(cap);
 if(!settledMedia)return null;
 if(authoritySha256!==canonicalHash(checkpoint.authority))engineSiteFail('local_entities_preparation_binding');
 const record=settledMedia.receipts.claims.get(step);
 if(!record)return null;
 if(checkpoint.calls[step]||step===settledMedia.targetReviewStep)engineSiteFail('local_scale_replay_collision');
 return {request:structuredClone(record.request),result:structuredClone(settledMedia.receipts.results.get(step)!)};
}

/** Earlier re-asks still used the normal judge path. Only the now unneeded terminal re-ask is counted separately. */
export function localSpentReviewReasks(cap:Admitted){
 return admission(cap).settledMedia?1:undefined;
}

/** The stopped run is fully re-derived under its original authority at admission. This adapter can only return those settled bytes.
 * For the replayed calls, authority identity and the prospective scale-reporting sentence are the sole wire differences. */
export function withLocalSettledMedia(cap:Admitted,runtime:EngineRuntime):EngineRuntime{
 const {settledMedia}=admission(cap);
 if(!settledMedia)return runtime;
 const {targetReviewStep,parentAuthoritySha256,receipts}=settledMedia;
 const first=targetReviewStep.replace(/_qa2$/,'_identity');
 const used=new Set<string>();
 let crossed=false;
 return {...runtime,
  load:name=>runtime.load(name),save:(name,value)=>runtime.save(name,value),advance:phase=>runtime.advance(phase),
  async result(step){return localSettledMedia(cap,runtime.checkpoint,step)?.result??runtime.result(step);},
  async call(plan){
   const step=plan.call.step,archived=localSettledMedia(cap,runtime.checkpoint,step);
   if(!archived){
    if(!crossed){
     if(step!==first||used.size!==receipts.results.size-1)engineSiteFail('local_scale_first_call');
     crossed=true;
    }
    return runtime.call(plan);
   }
   runtime.check();plan.revalidate?.();
   if(crossed||used.has(step)||!plan.admitSaved||canonicalHash(plan.wire)!==plan.call.wireSha256||
     plan.call.maximumMicroUsd!==archived.request.call.maximumMicroUsd)engineSiteFail('local_scale_replay_wire');
   const wire=plan.wire as Record<string,any>;
   const previous={...wire,authoritySha256:parentAuthoritySha256};
   if(/^page_[0-8]_[0-2]_qa2?$/.test(step)){
    const suffix='\n'+PICTURE_BOOK_SCALE_REPORTING;
    if(typeof wire.body?.instructions!=='string'||!wire.body.instructions.endsWith(suffix))engineSiteFail('local_scale_replay_wire');
    Object.assign(previous,{body:{...wire.body,instructions:wire.body.instructions.slice(0,-suffix.length)}});
   }
   if(canonicalHash(previous)!==archived.request.call.wireSha256)engineSiteFail('local_scale_replay_wire');
   await plan.admitSaved(archived.result);runtime.check();used.add(step);return archived.result;
  }};
}
function assertFreshOutput(out:string,parent:string,ledger:string){
 const n=(s:string)=>path.resolve(s).toLowerCase(),d=n(out);
 if([parent,ledger].some(p=>d===n(p)||d.startsWith(n(p)+path.sep)||n(p).startsWith(d+path.sep))||realpathSync(out)!==out)
  engineSiteFail('local_entities_output_scope');
 const entries=readdirSync(out);
 if(entries.length!==1||entries[0]!=='OWNER-GO.json')engineSiteFail('local_entities_output_exists');
}

/** Prove the original terminal execution, including its global dispatch witnesses; rebuild the original producer, without a key. */
export async function admitLocalEntitiesContinuation(o:{spec:Spec;parentGo:ParentGo;parentAuthority:EngineOrderAuthority;authority:EngineOrderAuthority;
 snapshot:Snapshot;profileSha256:string;out:string;readerId:string;ledgerRoot:string;upstream?:Admitted;terminalTargetForReplay?:true}):Promise<Admitted>{
 const {spec,parentGo:g,parentAuthority:old,authority:a,snapshot,out}=o;
 const boundary=localCurrentBoundary(spec),location='previousLink' in spec,upstream=o.upstream;
 const scale=spec.version==='engine-local-current-scale-continuation/v1'?spec:null;
 const transition=localCurrentTransition(boundary),priorLocation=transition.index>=2;
 if(location?(!upstream||upstream.boundary!==transition.previousBoundary||admission(upstream).authoritySha256!==canonicalHash(old)):upstream!==undefined)
  engineSiteFail('local_locations_current_parent_scope');
 const evidence={version:'engine-local-initial-hold-continuation/v1' as const,parentGrant:spec.parentGo,parentStop:spec.parentStop,
  parentExit:spec.parentExit,parentEvidence:spec.parentEvidence};
 const {root}=assertLocalParentEvidence(evidence);
 const go=readLocalEntityParentGo(spec);
 const oldShape=(v:EngineOrderAuthority)=>{
  const {currentEngine:_version,sourceRevision:_head,policySha256:_policy,budget:{approvalReference:_ref,approvedAt:_at,...budget},...rest}=v;
  return {...rest,budget};
 };
 if(spec.parentGo.file!==path.join(root,'OWNER-GO.json')||path.dirname(spec.parentStop.file)!==root||canonicalHash(go)!==canonicalHash(g)||
  o.profileSha256!==g.profileSha256||o.readerId!==g.readerId||a.budget.approvalReference===g.approvalReference||old.budget.approvalReference!==g.approvalReference||
  old.orderId!==(upstream?.orderId??g.approvalReference)||
  old.sourceRevision!==g.sourceRevision||old.currentEngine!==transition.from||a.currentEngine!==transition.to||
  old.imageQuality!=='low'||old.imageModelPolicy?.model!=='gpt-image-2.6-sunburst'||old.budget.maximumMicroUsd!==g.maximumMicroUsd||
  old.budget.maximumCalls!==g.maximumCalls||canonicalHash(oldShape(a))!==canonicalHash(oldShape(location&&!scale?
   {...old,budget:{...old.budget,steps:localCurrentLocationRepairSlots(old.budget.steps,localCurrentLocationAttempt(transition.index),localCurrentLocationAttempt(transition.index-1))}}:old))||snapshot.appearance.kind!=='description'||
  snapshot.request.bookOptions.voiceId!=='dad_v2'||a.requestSha256!==canonicalHash(snapshot))engineSiteFail('local_entities_scope');
 if(!o.terminalTargetForReplay)assertFreshOutput(out,root,o.ledgerRoot);
 const ledger=localConsentLedger(o.ledgerRoot,g.approvalReference);
 if(existsSync(ledger.leaseFile)||existsSync(ledger.leaseTransactionFile))engineSiteFail('local_entities_parent_active');
 const registration=admitLocalCurrentRegistration(ledger,g,{goSha256:spec.parentGo.sha256,sourceRevision:g.sourceRevision,
  profileSha256:g.profileSha256,out:root,readerId:g.readerId});
 const consent=localConsentRecordSchema.parse(json(ledger.consentFile)),consentSha256=canonicalHash(consent),authoritySha256=canonicalHash(old);
 if(consentSha256!==spec.parentConsentSha256||consent.approvalReference!==g.approvalReference||consent.registrationSha256!==registration.registrationSha256||
  consent.goSha256!==spec.parentGo.sha256||consent.goCanonicalSha256!==canonicalHash(g)||consent.authoritySha256!==authoritySha256||
  consent.out!==root||consent.journal!==path.join(root,'journal')||consent.sourceRevision!==g.sourceRevision||consent.profileSha256!==g.profileSha256||
  canonicalHash(json(path.join(root,'AUTHORITY.json')))!==authoritySha256||canonicalHash(json(path.join(root,'CLAIM.json')))!==canonicalHash({
   version:'engine-local-current-book-claim/v1',authoritySha256,sourceRevision:g.sourceRevision,profileSha256:g.profileSha256,goSha256:spec.parentGo.sha256,out:root}))
   engineSiteFail('local_entities_parent_claim');
 const stop=json(spec.parentStop.file),running=json(path.join(root,'RUNNING.json')),terminal=json(spec.parentExit.file);
 const launch=JSON.parse(pinned(spec.parentLaunch).toString('utf8'));
 const log=pinned(spec.parentLauncherLog);
 const exit=location?JSON.parse(log.toString('utf8')):null;
 const legacy=location?null:/^started (\S+) pid (\d+)\r?\nexit 1 at (\S+)\r?\n?$/.exec(log.toString('ascii'));
 const exitedAt=location?exit.at:legacy?.[3],startedAt=location?launch.at:legacy?.[1],supervisor=location?exit.pid:Number(legacy?.[2]);
 if((location?(exit.code!==1||exit.outcomeExists!==false||exit.head!==g.sourceRevision||exit.goSha256!==spec.parentGo.sha256||
    launch.head!==g.sourceRevision||launch.registrationSha256!==registration.registrationSha256):!legacy)||
  !Number.isFinite(Date.parse(exitedAt))||!(Date.parse(launch.at)<=Date.parse(startedAt)&&Date.parse(startedAt)<=Date.parse(running.startedAt)&&Date.parse(running.startedAt)<=Date.parse(stop.at)&&Date.parse(stop.at)<=Date.parse(exitedAt))||
  stop.version!=='engine-local-current-book-stop/v1'||stop.reason!==(scale?'audition_review_unusable':'engine_reference_sheet_held')||stop.phase!=='native'||stop.productAccepted!==false||
  launch.pid!==supervisor||launch.authoritySha256!==authoritySha256||launch.goSha256!==spec.parentGo.sha256||
  terminal.version!=='local-book-independent-outcome/v1'||terminal.sourceHead!==g.sourceRevision||terminal.exitCode!==1||terminal.outcome!=='held'||
  terminal.reason!==stop.reason||terminal.phase!==stop.phase||terminal.launcherExitAt!==exitedAt||
  running.authoritySha256!==authoritySha256||existsSync(path.join(root,'OUTCOME.json'))||
  sorted(readdirSync(root).filter(n=>/^STOP-/.test(n)))!==path.basename(spec.parentStop.file)||
  canonicalHash(json(path.join(root,'journal/carry.json')))!==canonicalHash(upstream?.carried??null))
   engineSiteFail('local_entities_parent_terminal');
 assertLocalHistoricalProcessGone(running.pid,exitedAt);assertLocalHistoricalProcessGone(supervisor,exitedAt);
 if(location&&upstream){
  const expected=path.join(ledger.root,'local-current-'+upstream.parentApprovalReference+'.'+upstream.boundary+'-continuation.json');
  const link=JSON.parse(pinned(spec.previousLink).toString('utf8'));
  if(spec.previousLink.file!==expected||canonicalHash(link)!==canonicalHash({version:'engine-local-current-'+upstream.boundary+'-claim/v1',
   parentConsentSha256:upstream.parentConsentSha256,preparedSha256:upstream.preparedSha256,carried:upstream.carried,
   consentSha256,goSha256:spec.parentGo.sha256,authoritySha256,out:root}))engineSiteFail('local_locations_current_parent_claim');
 }
 const cp=parseEngineCheckpoint({engineSite:json(path.join(root,'journal/checkpoint.json'))}),steps=Object.keys(cp.calls);
 const targetRender=scale?.targetReviewStep.replace(/_qa2$/,'');
 const required=scale?[...locationSteps(4),targetRender!,targetRender+'_qa',scale.targetReviewStep]:
  priorLocation?locationSteps(transition.index-1):['sheet_entities_0','sheet_entities_0_qa',...(location?locationSteps(0):[])];
 const outputNames=Object.keys(cp.outputs);
 const validOutputs=scale?outputNames.includes('prepared_source')&&outputNames.every(n=>n==='prepared_source'||/^native_page_[0-8]$/.test(n)):sorted(outputNames)==='prepared_source';
 if(cp.phase!=='native'||cp.waiting!==null||canonicalHash(cp.authority)!==authoritySha256||cp.snapshotSha256!==a.requestSha256||
  cp.ownerId!==snapshot.ownerId||cp.draftId!==snapshot.request.draftId||!validOutputs||
  sorted(steps)!==sorted(stop.calls)||(scale?steps.some(step=>!localLocationMediaStep(step,4)||step.startsWith('narration_')):
   location?sorted(steps)!==sorted(required):steps.some(s=>!oldStep.test(s))))engineSiteFail('local_entities_parent_checkpoint');
 const receipts=readLocalSettledJournal(root,cp,required,new Set(steps),(step,r)=>{
  const raw=r.raw as any;
  if(step==='story_author')return anthropicAuthorCost(raw,'batch');
  if(/^(?:reference_child(?:_repair)?|sheet_entities_0|sheet_locations_[0-4]|page_[0-8]_[0-2])$/.test(step))
   return r.model===old.imageModelPolicy?.model?auditionUsageCost(raw.usage,'image'):null;
  if(step.endsWith('_identity'))return auditionUsageCost({input_tokens:raw.usage?.prompt_tokens,output_tokens:raw.usage?.completion_tokens},'identity');
  return raw.model==='gpt-6.1-sol'&&raw.service_tier==='default'?auditionUsageCost(raw.usage,'sol'):null;
 });
 const known=receipts.known+(upstream?.carried.accountedMicroUsd??0),count=steps.length+(upstream?.carried.logicalCalls??0),m=stop.meter;
 if(m?.blocked!==false||m.accountedMicroUsd!==known||m.knownEstimateMicroUsd!==known||m.logicalCalls!==count||
  (upstream&&(m.carriedMicroUsd!==upstream.carried.accountedMicroUsd||m.carriedCalls!==upstream.carried.logicalCalls||
   terminal.newKnownMicroUsd!==receipts.known||terminal.newLogicalCalls!==steps.length||canonicalHash(terminal.carried)!==canonicalHash(upstream.carried)))||
  ['pendingCalls','unknownCalls','failedCalls','overReservedCalls','lostLocalCalls'].some(k=>m[k]!==0)||
  terminal.meter?.accountedMicroUsd!==known||terminal.meter?.logicalCalls!==count||terminal.meter?.reservedMicroUsd!==0||
  known>=a.budget.maximumMicroUsd||count>=a.budget.maximumCalls)engineSiteFail('local_entities_parent_meter');
 const witness=localConsentDispatchWitness(ledger,consentSha256,old);
 const witnessPins=new Map<string,string>();
 const ledgerNames=()=>readdirSync(ledger.root).filter(n=>n.startsWith(path.basename(ledger.dispatchFile('dummy')).replace(/dummy\.json$/,'')));
 if(sorted(witness.list().map(w=>w.step))!==sorted(steps))engineSiteFail('local_entities_parent_witness');
 for(const [step,{claim}] of receipts.claims){
  const claimSha=canonicalHash(claim),dir=path.join(root,'journal','calls',step),dispatch=json(path.join(dir,'dispatch.json')),entry=cp.calls[step];
  if(dispatch.claimSha256!==claimSha||!Number.isSafeInteger(dispatch.at)||dispatch.at<Date.parse(running.startedAt)||dispatch.at>Date.parse(stop.at))
   engineSiteFail('local_entities_parent_witness');
  witness.check(step,claimSha,true);const observed=witness.observed!(step);
  const polls=readdirSync(dir).filter(n=>/^pending-\d{5}\.json$/.test(n)).sort();
  if(polls.length!==entry.polls||(polls.length===0?(observed!==null||entry.pendingId!==undefined):(
   !observed||observed.dispatchAt!==dispatch.at||observed.id!==entry.pendingId||polls.some((n,i)=>{
    const saved=json(path.join(dir,n));
    return n!=='pending-'+String(i).padStart(5,'0')+'.json'||saved.id!==observed.id||
     saved.raw?.id!==undefined&&saved.raw.id!==observed.id||!Number.isSafeInteger(saved.at)||saved.at<dispatch.at||saved.at>Date.parse(stop.at);
   }))))engineSiteFail('local_entities_parent_witness');
  const files=[ledger.dispatchFile(step),...(observed?[ledger.providerFile(step)]:[])];
  for(const file of files)witnessPins.set(file,sha(bytes(file)));
 }
 const expectedNames=sorted([...witnessPins.keys()].map(f=>path.basename(f)));
 const check=()=>{
  assertLocalParentEvidence(evidence);pinned(spec.parentLaunch);pinned(spec.parentLauncherLog);registration.check();
  if(location){pinned(spec.previousLink);checkLocalEntitiesPreparation(upstream!);}
  if(existsSync(ledger.leaseFile)||existsSync(ledger.leaseTransactionFile))engineSiteFail('local_entities_parent_active');
  if(canonicalHash(localConsentRecordSchema.parse(json(ledger.consentFile)))!==consentSha256||sorted(ledgerNames())!==expectedNames)
   engineSiteFail('local_entities_parent_witness');
  for(const [f,h] of witnessPins)if(sha(bytes(f))!==h)engineSiteFail('local_entities_parent_witness');
 };
 const accepted=receipts.asset(cp.outputs.prepared_source),preparedSha256=canonicalHash(accepted);
 const used=new Set<string>(),verifiedOutputs=new Set<string>(),observations:EngineNativeSheetObservation[]=[];
 let prepared:unknown=upstream?localEntitiesPreparedSource(upstream,cp,snapshot,accepted):null;
 const runtime:EngineRuntime={checkpoint:{...structuredClone(cp),phase:location?'native':'story'},signal:new AbortController().signal,check(){},result:denied,
  async load(name){if(name==='prepared_source')return prepared;return null;},
  async save(name,value){
   if(scale&&/^native_page_[0-8]$/.test(name)){
    const id=cp.outputs[name];
    if(!id||verifiedOutputs.has(name)||canonicalHash(receipts.asset(id))!==canonicalHash(value))engineSiteFail('local_entities_replay_output');
    verifiedOutputs.add(name);return;
   }
   if(name!=='prepared_source'||prepared!==null||canonicalHash(value)!==preparedSha256)engineSiteFail('local_entities_replay_output');
   prepared=structuredClone(value);
  },
  async advance(phase){if(phase!=='native')engineSiteFail('local_entities_replay_output');runtime.checkpoint.phase=phase;},
  async call(plan){
   plan.revalidate?.();const {step}=plan.call,found=receipts.claims.get(step),result=receipts.results.get(step);
   if(!found||!result||!plan.admitSaved||used.has(step)||canonicalHash(plan.call)!==canonicalHash(found.claim.call)||
    canonicalHash(plan.wire)!==found.claim.call.wireSha256)engineSiteFail('local_entities_replay_wire');
   await plan.admitSaved(result);used.add(step);return result;
  }};
 try{await createEngineNativeRecipe({db,storage,snapshot,ports,observeReferenceSheet:v=>observations.push(v),
  ...(priorLocation?{currentLocationsRepair:upstream}:{})})(runtime);}
 catch(error){if((error as {code?:unknown})?.code!==stop.reason)throw error;}
 if(prepared===null||sorted(used)!==sorted(steps)||observations.length!==(location&&!priorLocation?2:1)||observations[0].role!==(priorLocation?'locations':'entities'))
  engineSiteFail('local_entities_parent_not_repairable');
 let sheets:Admission['sheets'],settledMedia:Admission['settledMedia'];
 if(scale){
  if(outputNames.length!==verifiedOutputs.size+1||[...used][used.size-1]!==scale.targetReviewStep||
    observations[0].attempt.status!=='qa_supported'||
    (receipts.results.get(targetRender!)?.output as {imageSha?:string})?.imageSha!==scale.targetImageSha256)
   engineSiteFail('local_scale_parent_target');
  sheets=localEntitiesSheetPair(upstream!,cp,snapshot,prepared);
  settledMedia={targetReviewStep:scale.targetReviewStep,parentAuthoritySha256:authoritySha256,receipts};
 }
 else if(location){
  const locations=observations[priorLocation?0:1];
  if(locations.role!=='locations'||locations.attempt.candidate?.imageSha!==spec.targetImageSha256)engineSiteFail('local_locations_current_target');
  if(priorLocation){
   if(transition.index===2)locationV2RepairFindings(locations.attempt);
   else{
    const attempt=locations.attempt,assessment=attempt.assessment;
    const material=assessment?.findings.filter(f=>f.impact!=='detail')??[];
    if(attempt.attempt!==transition.index-1||attempt.status!=='held'||!attempt.review||!assessment||assessment.safetyBlocked||assessment.invalidCitations||
     !material.some(f=>f.verdict==='defect')||material.some(f=>!f.bound||f.impact!=='continuity'))engineSiteFail('local_locations_current_target');
   }
   const prior=localEntitiesSheetPair(upstream!,cp,snapshot,prepared);
   sheets={entities:prior.entities,locations,previousLocations:[...prior.previousLocations,prior.locations.attempt]};
  }else{
   if(observations[0].attempt.status!=='qa_supported')engineSiteFail('local_locations_current_target');
   locationRepairFindings(locations.attempt);
   sheets={entities:observations[0],locations,previousLocations:[]};
  }
 }else if(observations[0].attempt.status!=='held'||!observations[0].attempt.candidate||observations[0].attempt.assessment?.safetyBlocked!==false||
  observations[0].attempt.assessment?.invalidCitations!==0)engineSiteFail('local_entities_parent_not_repairable');
 check();
 const carried=Object.freeze({accountedMicroUsd:known,logicalCalls:count,evidenceSha256:canonicalHash(spec)});
 const cap=Object.freeze({carried,preparedSha256,parentLedger:Object.freeze(ledger),parentConsentSha256:consentSha256,parentApprovalReference:g.approvalReference,
  boundary,orderId:old.orderId});
 admissions.set(cap,{prepared,authoritySha256:canonicalHash(a),snapshotSha256:a.requestSha256,ownerId:cp.ownerId,draftId:cp.draftId,check,sheets,settledMedia});
 return cap;
}

/** Exact first media wire. Neither an accepted cache nor this plan is spend authority. */
export async function previewLocalEntitiesContinuation(cap:Admitted,snapshot:Snapshot,authority:EngineOrderAuthority){
 const stop=Object.assign(Error('local_entities_first_wire'),{code:'audition_cancelled'});
 const plans:Pick<Parameters<EngineRuntime['call']>[0],'call'|'wire'>[]=[];
 const continuation=admission(cap).settledMedia;
 const runtime:EngineRuntime={checkpoint:{version:'engine-site-job/v1',authority,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,
  snapshotSha256:authority.requestSha256,phase:'native',calls:{},outputs:{},waiting:null},signal:new AbortController().signal,
  check(){},result:denied,advance:async()=>denied(),
  async save(name){if(!continuation||!/^native_page_[0-8]$/.test(name))denied();},
  async load(name){return name==='prepared_source'?localEntitiesPreparedSource(cap,runtime.checkpoint,snapshot):null;},
  async call(plan){plan.revalidate?.();plans.push({call:plan.call,wire:plan.wire});throw stop;}};
 try{await createEngineNativeRecipe({db,storage,snapshot,ports,...(cap.boundary!=='entities'?{currentLocationsRepair:cap}:{})})(runtime);}catch(e){if(e!==stop)throw e;}
 const expected=continuation?continuation.targetReviewStep.replace(/_qa2$/,'_identity'):
  cap.boundary==='entities'?'sheet_entities_0':locationSteps(localCurrentTransition(cap.boundary).index)[0];
 if(plans.length!==1||plans[0].call.step!==expected||
  cap.carried.accountedMicroUsd+plans[0].call.maximumMicroUsd>authority.budget.maximumMicroUsd)
  engineSiteFail('local_entities_first_step');
 return plans[0];
}

export function localEntitiesAllowedStep(cap:Admitted,step:string){
 const a=admission(cap);
 if(a.settledMedia?.receipts.claims.has(step))return false;
 return cap.boundary==='entities'?localEntityMediaStep(step):localLocationMediaStep(step,localCurrentLocationAttempt(localCurrentTransition(cap.boundary).index) as Exclude<LocationAttempt,0>);
}

/** In addition to the candidate's own one-use consent, a stopped parent may have only ONE child execution, across any candidate GO. */
export function claimLocalEntitiesContinuation(cap:Admitted,binding:{consentSha256:string;goSha256:string;authoritySha256:string;out:string}){
 const a=admission(cap);
 if(a.authoritySha256!==binding.authoritySha256)engineSiteFail('local_entities_preparation_binding');
 a.check();
 const file=path.join(cap.parentLedger.root,'local-current-'+cap.parentApprovalReference+'.'+cap.boundary+'-continuation.json');
 const value={version:'engine-local-current-'+cap.boundary+'-claim/v1',parentConsentSha256:cap.parentConsentSha256,
  preparedSha256:cap.preparedSha256,carried:cap.carried,...binding};
 try{writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
 catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')engineSiteFail('local_entities_continuation_used');throw error;}
 return ()=>{if(canonicalHash(json(file))!==canonicalHash(value))engineSiteFail('local_entities_continuation_claim_changed');a.check();};
}
