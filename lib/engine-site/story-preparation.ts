import 'server-only';
import { zodTextFormat } from 'openai/helpers/zod';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalJson } from '@/lib/personal-wizard/request-acceptance';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import type { PersonalWizardOptions } from '@/lib/personal-wizard/options';
import { prepareSimpleStory,writeSimpleStory } from '@/lib/personal-wizard/simple-story-engine';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE } from '@/lib/personal-wizard/simple-story-experience';
import { SIMPLE_WRITING_ROLES } from '@/lib/personal-wizard/simple-writing-roles';
import { simpleStoryReadingPackets,simpleStoryFindingIsMaterial } from '@/lib/personal-wizard/simple-story-source';
import { causalSourceReviewPacket,compileCausalSourceReadingWithCorrection } from '@/lib/personal-wizard/story-causal-experiment';
import { runSimpleStoryboardDiagnostic } from '@/lib/personal-wizard/simple-storyboard-diagnostic';
import { personalBookProviderPayload,decodePersonalBookProviderOutput } from '@/lib/personal-wizard/book-openai';
import { STORYBOARD_REVIEW_CAPACITY } from '@/lib/personal-wizard/storyboard-review-capacity';
import type { ExistingChildAppearance } from '@/lib/personal-wizard/existing-child-appearance';
import { STORYBOARD_BOUND_REPAIR_VERSION, type StoryboardRepair } from '@/lib/personal-wizard/storyboard-repair';
import { ENGINE_BOUND_REPAIR_STEP, ENGINE_BOUND_REPAIR_REVIEW_STEP } from './storyboard-binding-policy';
import { prepareSolWritingWire } from '@/scripts/personal-sol-writing-transport';
import { createEngineStoryApiSource,simpleAnthropicDispatch } from './story-api-source';
import { prepareEngineAnthropic,prepareEngineResponse,type EngineProviderPorts } from './provider-plans';
import type { EngineRuntime,EngineProviderResult } from './durable-worker';
import type { EngineOrderAuthority } from './contract';
import { engineSiteFail } from './contract';
import {compactSchemaDefinitions} from '@/scripts/personal-opus-storyboard-transport';
import {LOCAL_INITIAL_REPAIR_WIRE_BYTES,LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD} from './local-trial-recovery-policy';
import type {SimpleStoryboardDiagnosticCall} from '@/lib/personal-wizard/simple-storyboard-diagnostic';
import { enginePreparationContracts } from './storyboard-concurrency-policy';
import { isCurrentCustomerEngine } from './current-engine-policy';

export type StorySnapshot={request:ReviewedPersonalBookRequest;options:PersonalWizardOptions};
export const engineStoryboardSupported=(status:string)=>['review_supported','review_supported_with_notes'].includes(status);
/** Complete untruncated schema/source, bounded only for the explicit owner-test repair slot. */
export function localInitialRepairBody(authority:EngineOrderAuthority,call:SimpleStoryboardDiagnosticCall,repair:StoryboardRepair|undefined,step='initial_storyboard_repair_1'){
 const extended=(step==='initial_storyboard_repair_3'||step==='initial_storyboard_repair_4'&&authority.storyboardConcurrencyPolicy&&authority.storyboardAttemptExtension?.maxAttempts===5)&&authority.storyboardAttemptExtension&&repair?.extension&&canonicalHash(authority.storyboardAttemptExtension)===canonicalHash(repair.extension);
 // The current engine's bound repair uses the same complete repair wire and reserve as its base repairs.
 const bound=step===ENGINE_BOUND_REPAIR_STEP&&isCurrentCustomerEngine(authority)&&repair?.binding===STORYBOARD_BOUND_REPAIR_VERSION;
 if(!(['initial_storyboard_repair_1','initial_storyboard_repair_2'].includes(step)&&repair?.binding===undefined||extended||bound)||!repair||call.stage!=='storyboard'||call.maxOutputTokens>50_000||(authority.purpose!=='test'&&!isCurrentCustomerEngine(authority))||authority.budget.steps.find(s=>s.id===step)?.maximumMicroUsd!==LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD)engineSiteFail('engine_initial_repair_authority');
 const body=personalBookProviderPayload(call,'gpt-6.1-sol');body.text.format.schema=compactSchemaDefinitions(body.text.format.schema);
 if(Buffer.byteLength(JSON.stringify({...body,background:true,store:false}))>LOCAL_INITIAL_REPAIR_WIRE_BYTES)engineSiteFail('engine_initial_repair_wire_limit');return body;
}
/** Same four story operations and exact wire construction as the native recipe; no default transport. */
export async function prepareEngineStorySource(runtime:EngineRuntime,snapshot:StorySnapshot,ports:EngineProviderPorts){
 const authority=runtime.checkpoint.authority,seed=`engine-site-${authority.orderId}`;
 const simple=prepareSimpleStory(snapshot.request,snapshot.options,seed,SIMPLE_CHILD_MOMENTUM_EXPERIENCE);
 const records={} as Record<'author'|'editor',EngineProviderResult>;
 const generated=await writeSimpleStory(simple,async call=>{
  const answer=await runtime.call(call.stage==='author'?prepareEngineAnthropic(authority,simpleAnthropicDispatch(call,authority.orderId),ports)
   :prepareEngineResponse(authority,'story_editor',prepareSolWritingWire(call).payload,x=>call.schema.parse(x),ports));
  if(!answer.usage||answer.estimatedMicroUsd===null)engineSiteFail('engine_story_usage_unknown');records[call.stage]=answer;
  return {output:answer.output,usage:answer.usage,estimatedUsd:answer.estimatedMicroUsd/1e6};
 },{model:SIMPLE_WRITING_ROLES.label,reservedUsd:authority.budget.maximumMicroUsd/1e6});
 const source=createEngineStoryApiSource(authority,snapshot.request,snapshot.options,seed,generated,records),readings=[];
 const packets=simpleStoryReadingPackets(snapshot.request,source,snapshot.options);
 for(const stage of ['final_review','comparison'] as const){
  const numbered=causalSourceReviewPacket(packets[stage==='final_review'?'final':'comparison']);
  const body={model:'gpt-6.1-sol',store:false,service_tier:'default',reasoning:{effort:'medium'},instructions:numbered.instructions,
   input:canonicalJson({packetDigest:numbered.packetDigest,packet:numbered.packet}),max_output_tokens:16_000,text:{format:zodTextFormat(numbered.schema,'engine_story_reading')}};
  const answer=await runtime.call(prepareEngineResponse(authority,`story_${stage}`,body,x=>x,ports));
  const checked=await compileCausalSourceReadingWithCorrection(packets[stage==='final_review'?'final':'comparison'],answer.output,
   async correction=>(await runtime.call(prepareEngineResponse(authority,`story_${stage}_citation`,{model:'gpt-6.1-sol',store:false,service_tier:'default',reasoning:{effort:'medium'},
    instructions:correction.instructions,input:correction.input,max_output_tokens:correction.maxOutputTokens,text:{format:zodTextFormat(correction.schema,'engine_story_citation_correction')}},x=>x,ports))).output);
  readings.push(checked.reading);
 }
 if(readings.some(reading=>reading.findings.some(simpleStoryFindingIsMaterial)))engineSiteFail('engine_story_reading_held');
 return {source,readings};
}
export async function prepareEngineStoryboard(runtime:EngineRuntime,snapshot:StorySnapshot,source:Awaited<ReturnType<typeof prepareEngineStorySource>>['source'],
 ports:EngineProviderPorts,prefix:'initial'|'prep'|'initial_repair_1'|'initial_repair_2'|'initial_repair_3'|'initial_repair_4'|'bound_repair',existingChildAppearance?:ExistingChildAppearance,repair?:StoryboardRepair){
 // A bound repair exists only as the current engine's one repair of a held bound board: with its appearance, its marker and both slots.
 if((prefix==='bound_repair')!==(repair?.binding!==undefined)||prefix==='bound_repair'&&(!existingChildAppearance||repair?.binding!==STORYBOARD_BOUND_REPAIR_VERSION||
  !isCurrentCustomerEngine(runtime.checkpoint.authority)||![ENGINE_BOUND_REPAIR_STEP,ENGINE_BOUND_REPAIR_REVIEW_STEP].every(id=>runtime.checkpoint.authority.budget.steps.some(s=>s.id===id))))
  engineSiteFail('engine_bound_repair_authority');
 if(prefix==='initial_repair_3'&&(!runtime.checkpoint.authority.storyboardAttemptExtension||!repair?.extension||canonicalHash(repair.extension)!==canonicalHash(runtime.checkpoint.authority.storyboardAttemptExtension)))engineSiteFail('engine_initial_extension_authority');
 if(prefix==='initial_repair_4'&&(!runtime.checkpoint.authority.storyboardConcurrencyPolicy||runtime.checkpoint.authority.storyboardAttemptExtension?.maxAttempts!==5||!repair?.extension||canonicalHash(repair.extension)!==canonicalHash(runtime.checkpoint.authority.storyboardAttemptExtension)))engineSiteFail('engine_initial_concurrency_authority');
 let draft:unknown=null;
 const diagnostic=await runSimpleStoryboardDiagnostic({request:snapshot.request,writerResult:source,options:snapshot.options,signal:runtime.signal,
  ...enginePreparationContracts(runtime.checkpoint.authority),existingChildAppearance,...(repair?{repair}:{}),reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version,
  generate:async call=>{
   let body;
   if(call.stage==='storyboard'&&prefix.startsWith('initial_repair_')){
    body=localInitialRepairBody(runtime.checkpoint.authority,call,repair,prefix.replace('initial_repair_','initial_storyboard_repair_'));
   }else if(call.stage==='storyboard'&&prefix==='bound_repair')body=localInitialRepairBody(runtime.checkpoint.authority,call,repair,ENGINE_BOUND_REPAIR_STEP);
   else body=call.stage==='storyboard'?prepareSolWritingWire(call).payload:personalBookProviderPayload(call,'gpt-6.1-sol');
   const repairStep=prefix.replace('initial_repair_','initial_storyboard_repair_');
   const step=prefix==='initial'?(call.stage==='storyboard'?'initial_storyboard':'initial_storyboard_review'):
    prefix==='prep'?(call.stage==='storyboard'?'prep_storyboard_0':'prep_storyboard_0_review'):
    prefix==='bound_repair'?(call.stage==='storyboard'?ENGINE_BOUND_REPAIR_STEP:ENGINE_BOUND_REPAIR_REVIEW_STEP):
     (call.stage==='storyboard'?repairStep:`${repairStep}_review`);
   const answer=await runtime.call(prepareEngineResponse(runtime.checkpoint.authority,step,body,x=>decodePersonalBookProviderOutput(call,x),ports));
   if(call.stage==='storyboard')draft=answer.output;return answer.output;
  }});
 return {diagnostic,draft};
}
const admitted=new WeakSet<object>(),supportedAdmissions=new WeakSet<object>();
type InitialPreparation=Awaited<ReturnType<typeof admitEngineInitialPreparation>>;
type HeldRepairPreparation=Awaited<ReturnType<typeof admitEngineHeldInitialRepair>>;
type HeldFinalPreparation=Awaited<ReturnType<typeof admitEngineHeldFinalPreparation>>;
type HeldExtendedPreparation=Awaited<ReturnType<typeof admitEngineHeldExtendedPreparation>>;
export type AdmittedEngineInitialPreparation=InitialPreparation|HeldRepairPreparation|HeldFinalPreparation|HeldExtendedPreparation|Awaited<ReturnType<typeof admitEngineSupportedInitialPreparation>>;
function sealPreparation<T extends object>(value:T):T{
 const freeze=(v:unknown):void=>{if(!v||typeof v!=='object'||Object.isFrozen(v))return;for(const x of Object.values(v))freeze(x);Object.freeze(v);};freeze(value);admitted.add(value);return value;
}
/** Only a complete provider-DENIED raw replay can create this in-memory capability. No supplied source/draft becomes approved. */
export async function admitEngineInitialPreparation(runtime:EngineRuntime,snapshot:StorySnapshot){
 if(runtime.checkpoint.authority.purpose!=='test')engineSiteFail('engine_preparation_parent_authority');
 const denied=():never=>engineSiteFail('engine_preparation_replay_dispatch_forbidden'),ports={fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied};
 const prepared=await prepareEngineStorySource(runtime,snapshot,ports),initial=await prepareEngineStoryboard(runtime,snapshot,prepared.source,ports,'initial');
 if(engineStoryboardSupported(initial.diagnostic.status))engineSiteFail('engine_preparation_parent_not_held');
 const value={...prepared,initial,requestSha256:runtime.checkpoint.authority.requestSha256,optionsSha256:runtime.checkpoint.authority.optionsSha256,orderId:runtime.checkpoint.authority.orderId,ownerId:runtime.checkpoint.ownerId,draftId:runtime.checkpoint.draftId};
 return sealPreparation(value);
}
/** One complete held repair, admitted only by reproducing BOTH old raw wires with dispatch denied. */
export async function admitEngineHeldInitialRepair(runtime:EngineRuntime,snapshot:StorySnapshot,previous:InitialPreparation,repair:StoryboardRepair){
 assertEngineInitialPreparation(previous,runtime.checkpoint.authority,runtime.checkpoint);
 const expected={parentStoryboardDigest:previous.initial.diagnostic.storyboardDigest,draft:previous.initial.draft,review:previous.initial.diagnostic.rawReview,
  parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true}};
 if(supportedAdmissions.has(previous)||'heldRepair' in previous||canonicalHash(repair)!==canonicalHash(expected))engineSiteFail('engine_held_repair_parent_changed');
 const denied=():never=>engineSiteFail('engine_preparation_replay_dispatch_forbidden');
 const initial=await prepareEngineStoryboard(runtime,snapshot,previous.source,{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},'initial_repair_1',undefined,repair);
 if(engineStoryboardSupported(initial.diagnostic.status))engineSiteFail('engine_held_repair_not_held');
 return sealPreparation({...previous,initial,heldRepair:repair});
}
/** Admit the spent third BASE attempt under its old authority, with provider dispatch denied. */
export async function admitEngineHeldFinalPreparation(runtime:EngineRuntime,snapshot:StorySnapshot,previous:HeldRepairPreparation,repair:StoryboardRepair){
 assertEngineInitialPreparation(previous,runtime.checkpoint.authority,runtime.checkpoint);
 const expected={parentStoryboardDigest:previous.initial.diagnostic.storyboardDigest,draft:previous.initial.draft,review:previous.initial.diagnostic.rawReview,
  parentRepair:previous.heldRepair,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true}};
 if(supportedAdmissions.has(previous)||!('heldRepair' in previous)||'heldFinalRepair' in previous||canonicalHash(repair)!==canonicalHash(expected)||runtime.checkpoint.authority.storyboardAttemptExtension)engineSiteFail('engine_held_final_parent_changed');
 const denied=():never=>engineSiteFail('engine_preparation_replay_dispatch_forbidden');
 const initial=await prepareEngineStoryboard(runtime,snapshot,previous.source,{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},'initial_repair_2',undefined,repair);
 if(engineStoryboardSupported(initial.diagnostic.status))engineSiteFail('engine_held_final_not_held');
 return sealPreparation({...previous,initial,heldFinalRepair:repair});
}
/** Historical fourth attempt: real old-authority replay only, no new dispatch or implicit upgrade. */
export async function admitEngineHeldExtendedPreparation(runtime:EngineRuntime,snapshot:StorySnapshot,previous:HeldFinalPreparation,repair:StoryboardRepair){
 assertEngineInitialPreparation(previous,runtime.checkpoint.authority,runtime.checkpoint);
 const expected={parentStoryboardDigest:previous.initial.diagnostic.storyboardDigest,draft:previous.initial.draft,review:previous.initial.diagnostic.rawReview,parentRepair:previous.heldFinalRepair,parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true},extension:runtime.checkpoint.authority.storyboardAttemptExtension};
 if(supportedAdmissions.has(previous)||'heldExtendedRepair' in previous||runtime.checkpoint.authority.storyboardAttemptExtension?.maxAttempts!==4||runtime.checkpoint.authority.storyboardConcurrencyPolicy||canonicalHash(repair)!==canonicalHash(expected))engineSiteFail('engine_held_extended_parent_changed');
 const denied=():never=>engineSiteFail('engine_preparation_replay_dispatch_forbidden');
 const initial=await prepareEngineStoryboard(runtime,snapshot,previous.source,{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},'initial_repair_3',undefined,repair);
 if(engineStoryboardSupported(initial.diagnostic.status))engineSiteFail('engine_held_extended_not_held');return sealPreparation({...previous,initial,heldExtendedRepair:repair});
}
/** Replays the final repaired plan and fresh review, never accepts a supplied diagnostic or dispatches. */
export async function admitEngineSupportedInitialPreparation(runtime:EngineRuntime,snapshot:StorySnapshot,
 previous:InitialPreparation|HeldRepairPreparation|HeldFinalPreparation|HeldExtendedPreparation,repair:StoryboardRepair){
 assertEngineInitialPreparation(previous,runtime.checkpoint.authority,runtime.checkpoint);
 const expected={parentStoryboardDigest:previous.initial.diagnostic.storyboardDigest,draft:previous.initial.draft,review:previous.initial.diagnostic.rawReview,
  ...('heldExtendedRepair' in previous?{parentRepair:previous.heldExtendedRepair,extension:runtime.checkpoint.authority.storyboardAttemptExtension,addedContracts:['sourceConcurrency']}:'heldFinalRepair' in previous?{parentRepair:previous.heldFinalRepair,extension:runtime.checkpoint.authority.storyboardAttemptExtension}:'heldRepair' in previous?{parentRepair:previous.heldRepair}:{}),parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true}};
 if('heldExtendedRepair' in previous&&(runtime.checkpoint.authority.storyboardAttemptExtension?.maxAttempts!==5||!runtime.checkpoint.authority.storyboardConcurrencyPolicy))engineSiteFail('engine_initial_concurrency_authority');
 if('heldFinalRepair' in previous&&!runtime.checkpoint.authority.storyboardAttemptExtension)engineSiteFail('engine_initial_extension_authority');
 if(supportedAdmissions.has(previous)||canonicalHash(repair)!==canonicalHash(expected))engineSiteFail('engine_supported_preparation_parent_changed');
 const denied=():never=>engineSiteFail('engine_preparation_replay_dispatch_forbidden');
 const initial=await prepareEngineStoryboard(runtime,snapshot,previous.source,{fetch:denied,openAIKey:denied,anthropicKey:denied,image:denied},'heldExtendedRepair' in previous?'initial_repair_4':'heldFinalRepair' in previous?'initial_repair_3':'initial_repair_2',undefined,repair);
 if(!engineStoryboardSupported(initial.diagnostic.status))engineSiteFail('engine_supported_preparation_held');
 const value=sealPreparation({...previous,initial,initialRepair:repair});supportedAdmissions.add(value);return value;
}
export function assertEngineInitialPreparation(value:AdmittedEngineInitialPreparation,authority:EngineOrderAuthority,scope?:{ownerId:string;draftId:string}){
 if(!admitted.has(value)||authority.purpose!=='test'||!scope||value.ownerId!==scope.ownerId||value.draftId!==scope.draftId||value.orderId!==authority.orderId||value.requestSha256!==authority.requestSha256||value.optionsSha256!==authority.optionsSha256||engineStoryboardSupported(value.initial.diagnostic.status)!==supportedAdmissions.has(value))engineSiteFail('engine_preparation_parent_changed');
 if(supportedAdmissions.has(value)&&'initialRepair' in value&&canonicalHash(value.initialRepair.extension??null)!==canonicalHash(authority.storyboardAttemptExtension??null))engineSiteFail('engine_initial_extension_authority');
}
/** A cached native preparation cannot replace the admitted paid source/initial plan during resume or readmission. */
export function assertEngineSupportedPreparationCache(value:AdmittedEngineInitialPreparation,authority:EngineOrderAuthority,scope:{ownerId:string;draftId:string},cached:unknown){
 assertEngineInitialPreparation(value,authority,scope);
 if(!supportedAdmissions.has(value)||!('initialRepair' in value))engineSiteFail('engine_supported_preparation_parent_changed');
 if(cached===null)return;
 const c=cached as Record<string,unknown>|null,expected={source:value.source,readings:value.readings,initialDraft:value.initial.draft,initialReview:value.initial.diagnostic.rawReview,initialRepair:value.initialRepair};
 if(!c||typeof c!=='object'||Object.entries(expected).some(([key,v])=>!Object.prototype.hasOwnProperty.call(c,key)||c[key]===undefined||canonicalHash(c[key])!==canonicalHash(v)))engineSiteFail('engine_supported_preparation_cache_changed');
}
