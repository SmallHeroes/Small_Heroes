/** Versioned mechanical child binding: unchanged admitted world + current child authority + NEW review. */
import 'server-only';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition } from '@/lib/personal-wizard/storyboard';
import { reviewSimpleStoryboardDraft } from '@/lib/personal-wizard/simple-storyboard-diagnostic';
import { existingChildAppearanceData, assertExistingChildAppearance, type ExistingChildAppearance } from '@/lib/personal-wizard/existing-child-appearance';
import { PREPARATION_CONTRACTS } from '@/lib/personal-wizard/source-preparation-contracts';
import { STORYBOARD_REVIEW_CAPACITY } from '@/lib/personal-wizard/storyboard-review-capacity';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '@/lib/personal-wizard/book-openai';
import { STORYBOARD_BOUND_REPAIR_VERSION, assertStoryboardRepair, type StoryboardRepair } from '@/lib/personal-wizard/storyboard-repair';
import type { EngineRuntime } from './durable-worker';
import type { EngineProviderPorts } from './provider-plans';
import { prepareEngineResponse } from './provider-plans';
import { prepareEngineStoryboard, type StorySnapshot } from './story-preparation';
import { engineSiteFail } from './contract';
import { isCurrentCustomerEngine, usesTypedCustomerCorrections } from './current-engine-policy';
import { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP, ENGINE_BOUND_REPAIR_STEP, ENGINE_BOUND_REPAIR_REVIEW_STEP } from './storyboard-binding-policy';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from './response-schema';
import { enginePreparationContracts } from './storyboard-concurrency-policy';
import type { EngineOrderAuthority } from './contract';

export { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP } from './storyboard-binding-policy';
const supported = (s:string) => ['review_supported','review_supported_with_notes'].includes(s);
const flags = {selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true} as const;
const parents = new WeakMap<object,string>();
const freeze = <T>(v:T):T => { if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v; };

function input(snapshot:StorySnapshot, source:unknown, repair?:StoryboardRepair, existing?:ExistingChildAppearance,authority?:EngineOrderAuthority){
 return prepareCurrentPersonalStoryboard(snapshot.request,source,snapshot.options,true,true,true,undefined,true,true,repair,
  true,true,true,true,true,true,true,true,true,(authority?enginePreparationContracts(authority):PREPARATION_CONTRACTS).engineContinuity,existing);
}
function scope(runtime:EngineRuntime){const c=runtime.checkpoint,a=c.authority;return {orderId:a.orderId,requestSha256:a.requestSha256,optionsSha256:a.optionsSha256,ownerId:c.ownerId,draftId:c.draftId,
 ...(a.storyboardConcurrencyPolicy?{storyboardConcurrencyPolicy:a.storyboardConcurrencyPolicy}:{})};}
/** The caller must have obtained source/initial through its live runtime or complete raw receipt replay.
 * This compiler rechecks the actual draft + bound review; a supplied diagnostic alone is never authority. */
export function admitEngineBindingParent(runtime:EngineRuntime,snapshot:StorySnapshot,source:unknown,
 initial:{draft:unknown;diagnostic:{sourceDigest:string;storyboardDigest:string;rawReview:unknown}},repair?:StoryboardRepair){
 const original=input(snapshot,source,repair,undefined,runtime.checkpoint.authority),book=compilePersonalStoryboard(original,initial.draft,flags),review=storyboardReviewDisposition(book,initial.diagnostic.rawReview);
 if(!supported(review.disposition)||book.sourceDigest!==initial.diagnostic.sourceDigest||book.storyboardDigest!==initial.diagnostic.storyboardDigest)engineSiteFail('engine_binding_parent_not_supported');
 const parent=freeze({version:ENGINE_STORYBOARD_BINDING,scope:scope(runtime),source,sourceSha256:canonicalHash(source),draft:initial.draft,
  draftSha256:canonicalHash(initial.draft),review:initial.diagnostic.rawReview,reviewSha256:canonicalHash(initial.diagnostic.rawReview),book});
 parents.set(parent,canonicalHash(parent));return parent;
}
export type EngineStoryboardBindingParent=ReturnType<typeof admitEngineBindingParent>;
function assertParent(parent:EngineStoryboardBindingParent,runtime:EngineRuntime,source:unknown){
 if(!parents.has(parent)||parents.get(parent)!==canonicalHash(parent)||canonicalHash(parent.scope)!==canonicalHash(scope(runtime))||canonicalHash(source)!==parent.sourceSha256)engineSiteFail('engine_binding_parent_changed');
}
/** Exact equality prevents id, population, material, geometry, state or composition loss without language heuristics. */
function world(book:ReturnType<typeof compilePersonalStoryboard>){
 // Only these identity/provenance fields legitimately change. Include every other current/future compiled contract.
 const {sourceDigest:_source,storyboardDigest:_digest,repair:_repair,existingChildAppearance:_child,...acceptedWorld}=book;
 return acceptedWorld;
}
export function assertEngineBoundWorld(parent:EngineStoryboardBindingParent,book:ReturnType<typeof compilePersonalStoryboard>){
 if(!parents.has(parent)||parents.get(parent)!==canonicalHash(parent)||canonicalHash(world(parent.book))!==canonicalHash(world(book)))engineSiteFail('engine_binding_world_changed');
}
export function engineBindingOrigin(parent:EngineStoryboardBindingParent,existing:ExistingChildAppearance){
 if(!parents.has(parent)||parents.get(parent)!==canonicalHash(parent))engineSiteFail('engine_binding_parent_changed');
 assertExistingChildAppearance(existing);
 if(existing.originalSourceDigest!==parent.book.sourceDigest||existing.originalStoryboardDigest!==parent.book.storyboardDigest||
  canonicalHash(existing.child.clothing)!==canonicalHash(parent.book.plan.actorAppearance!.child.clothing))engineSiteFail('engine_binding_child_origin_changed');
 return {version:ENGINE_STORYBOARD_BINDING,parentSourceDigest:parent.book.sourceDigest,parentStoryboardDigest:parent.book.storyboardDigest,
  parentDraftSha256:parent.draftSha256,parentReviewSha256:parent.reviewSha256,appearanceSha256:canonicalHash(existingChildAppearanceData(existing)),
  childImageSha256:existing.candidateSha,worldSha256:canonicalHash(world(parent.book)),plannerInvoked:false as const};
}
export async function prepareEngineBoundStoryboard(runtime:EngineRuntime,snapshot:StorySnapshot,source:unknown,ports:EngineProviderPorts,
 parent:EngineStoryboardBindingParent,existing:ExistingChildAppearance){
 const check=()=>{assertParent(parent,runtime,source);return engineBindingOrigin(parent,existing);};const origin=check(),authority=runtime.checkpoint.authority;
 if(authority.storyboardBindingPolicy!==ENGINE_STORYBOARD_BINDING||authority.responseSchemaPolicy!==ENGINE_RESPONSE_SCHEMA_POLICY||
  !authority.budget.steps.some(s=>s.id===ENGINE_BOUND_REVIEW_STEP))engineSiteFail('engine_binding_policy_required');
 // Compile and compare BEFORE buying a review. The raw accepted draft is never changed or "fixed".
 const bound=compilePersonalStoryboard(input(snapshot,source,undefined,existing,authority),parent.draft,flags);assertEngineBoundWorld(parent,bound);
 const diagnostic=await reviewSimpleStoryboardDraft({request:snapshot.request,writerResult:source,options:snapshot.options,signal:runtime.signal,
  ...enginePreparationContracts(authority),existingChildAppearance:existing,reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version,
  generate:async call=>{
   check();if(call.stage!=='review'||call.context.sourceDigest!==bound.sourceDigest||call.context.storyboardDigest!==bound.storyboardDigest)engineSiteFail('engine_binding_review_changed');
   const answer=await runtime.call(prepareEngineResponse(authority,ENGINE_BOUND_REVIEW_STEP,personalBookProviderPayload(call,'gpt-6.1-sol'),x=>decodePersonalBookProviderOutput(call,x),ports));
   check();return answer.output;
  }},parent.draft);
 check();assertEngineBoundWorld(parent,diagnostic.storyboard);
 if(diagnostic.draftOrigin?.canonicalSha256!==parent.draftSha256||canonicalHash(parent.draft)!==parent.draftSha256)engineSiteFail('engine_binding_draft_changed');
 return {diagnostic,draft:parent.draft,bindingParent:origin};
}

/** Whether this authority owns the bound repair (the current customer engine with both slots); every other authority keeps the old stop. */
export function engineBoundRepairAvailable(authority:EngineOrderAuthority){
 return usesTypedCustomerCorrections(authority)&&authority.storyboardBindingPolicy===ENGINE_STORYBOARD_BINDING&&authority.responseSchemaPolicy===ENGINE_RESPONSE_SCHEMA_POLICY&&
  [ENGINE_BOUND_REVIEW_STEP,ENGINE_BOUND_REPAIR_STEP,ENGINE_BOUND_REPAIR_REVIEW_STEP].every(id=>authority.budget.steps.some(s=>s.id===id));
}
/**
 * The exact bound-repair input: the bound board (the admitted parent draft recompiled UNCHANGED with this appearance, recompiled here and
 * compared with the parent's world) and the raw bound review that held it. Nothing is supplied as authority: the storyboard engine recompiles
 * that board again from this input and refuses a review that does not hold it.
 */
export function engineBoundRepairInput(snapshot:StorySnapshot,source:unknown,parent:EngineStoryboardBindingParent,existing:ExistingChildAppearance,
 rawReview:unknown,authority:EngineOrderAuthority):StoryboardRepair{
 if(!parents.has(parent)||parents.get(parent)!==canonicalHash(parent)||canonicalHash(source)!==parent.sourceSha256)engineSiteFail('engine_binding_parent_changed');
 engineBindingOrigin(parent,existing);
 const bound=compilePersonalStoryboard(input(snapshot,source,undefined,existing,authority),parent.draft,flags);assertEngineBoundWorld(parent,bound);
 if(supported(storyboardReviewDisposition(bound,rawReview).disposition))engineSiteFail('engine_bound_repair_not_held');
 const repair={parentStoryboardDigest:bound.storyboardDigest,draft:structuredClone(parent.draft),review:structuredClone(rawReview),
  parentCompile:{...flags},binding:STORYBOARD_BOUND_REPAIR_VERSION};
 assertStoryboardRepair(repair);return repair;
}
/** The provenance of a repaired binding: the unchanged parent origin plus the held bound board and review the one repair replaced. */
export function engineBoundRepairOrigin(snapshot:StorySnapshot,source:unknown,parent:EngineStoryboardBindingParent,existing:ExistingChildAppearance,
 repair:StoryboardRepair,authority:EngineOrderAuthority){
 const expected=engineBoundRepairInput(snapshot,source,parent,existing,repair.review,authority);
 if(canonicalHash(repair)!==canonicalHash(expected))engineSiteFail('engine_bound_repair_parent_changed');
 return {...engineBindingOrigin(parent,existing),plannerInvoked:true as const,
  boundRepair:{version:STORYBOARD_BOUND_REPAIR_VERSION,boundStoryboardDigest:repair.parentStoryboardDigest,boundReviewSha256:canonicalHash(repair.review)}};
}
/**
 * One focused repair of a held bound board (storyboard-bound-repair/v1), then a NEW review of the repaired board. The child stays pinned:
 * the planner gets the existing appearance as typed identity authority and its schema/compile refuse any other clothing. The world is
 * allowed to change only through this repair of the bound review's own findings, so the accepted parent stays the recorded origin.
 */
export async function prepareEngineBoundRepair(runtime:EngineRuntime,snapshot:StorySnapshot,source:Parameters<typeof prepareEngineStoryboard>[2],
 ports:EngineProviderPorts,parent:EngineStoryboardBindingParent,existing:ExistingChildAppearance,held:{diagnostic:{status:string;sourceDigest:string;storyboardDigest:string;rawReview:unknown}}){
 const authority=runtime.checkpoint.authority;
 if(!engineBoundRepairAvailable(authority))engineSiteFail('engine_bound_repair_authority');
 assertParent(parent,runtime,source);
 const repair=engineBoundRepairInput(snapshot,source,parent,existing,held.diagnostic.rawReview,authority);
 if(supported(held.diagnostic.status)||held.diagnostic.storyboardDigest!==repair.parentStoryboardDigest)engineSiteFail('engine_bound_repair_parent_changed');
 const result=await prepareEngineStoryboard(runtime,snapshot,source,ports,'bound_repair',existing,repair);
 assertParent(parent,runtime,source);
 const bindingParent=engineBoundRepairOrigin(snapshot,source,parent,existing,repair,authority);
 if(canonicalHash(result.diagnostic.storyboard.existingChildAppearance)!==canonicalHash(existingChildAppearanceData(existing)))engineSiteFail('engine_bound_repair_child_changed');
 return {diagnostic:result.diagnostic,draft:result.draft,repair,bindingParent};
}
