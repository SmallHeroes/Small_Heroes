/** Versioned mechanical child binding: unchanged admitted world + current child authority + NEW review. */
import 'server-only';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition } from '@/lib/personal-wizard/storyboard';
import { reviewSimpleStoryboardDraft } from '@/lib/personal-wizard/simple-storyboard-diagnostic';
import { existingChildAppearanceData, assertExistingChildAppearance, type ExistingChildAppearance } from '@/lib/personal-wizard/existing-child-appearance';
import { PREPARATION_CONTRACTS } from '@/lib/personal-wizard/source-preparation-contracts';
import { STORYBOARD_REVIEW_CAPACITY } from '@/lib/personal-wizard/storyboard-review-capacity';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '@/lib/personal-wizard/book-openai';
import type { StoryboardRepair } from '@/lib/personal-wizard/storyboard-repair';
import type { EngineRuntime } from './durable-worker';
import type { EngineProviderPorts } from './provider-plans';
import { prepareEngineResponse } from './provider-plans';
import type { StorySnapshot } from './story-preparation';
import { engineSiteFail } from './contract';
import { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP } from './storyboard-binding-policy';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from './response-schema';

export { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP } from './storyboard-binding-policy';
const supported = (s:string) => ['review_supported','review_supported_with_notes'].includes(s);
const flags = {selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true} as const;
const parents = new WeakMap<object,string>();
const freeze = <T>(v:T):T => { if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v; };

function input(snapshot:StorySnapshot, source:unknown, repair?:StoryboardRepair, existing?:ExistingChildAppearance){
 return prepareCurrentPersonalStoryboard(snapshot.request,source,snapshot.options,true,true,true,undefined,true,true,repair,
  true,true,true,true,true,true,true,true,true,PREPARATION_CONTRACTS.engineContinuity,existing);
}
function scope(runtime:EngineRuntime){const c=runtime.checkpoint,a=c.authority;return {orderId:a.orderId,requestSha256:a.requestSha256,optionsSha256:a.optionsSha256,ownerId:c.ownerId,draftId:c.draftId};}
/** The caller must have obtained source/initial through its live runtime or complete raw receipt replay.
 * This compiler rechecks the actual draft + bound review; a supplied diagnostic alone is never authority. */
export function admitEngineBindingParent(runtime:EngineRuntime,snapshot:StorySnapshot,source:unknown,
 initial:{draft:unknown;diagnostic:{sourceDigest:string;storyboardDigest:string;rawReview:unknown}},repair?:StoryboardRepair){
 const original=input(snapshot,source,repair),book=compilePersonalStoryboard(original,initial.draft,flags),review=storyboardReviewDisposition(book,initial.diagnostic.rawReview);
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
 const bound=compilePersonalStoryboard(input(snapshot,source,undefined,existing),parent.draft,flags);assertEngineBoundWorld(parent,bound);
 const diagnostic=await reviewSimpleStoryboardDraft({request:snapshot.request,writerResult:source,options:snapshot.options,signal:runtime.signal,
  ...PREPARATION_CONTRACTS,existingChildAppearance:existing,reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version,
  generate:async call=>{
   check();if(call.stage!=='review'||call.context.sourceDigest!==bound.sourceDigest||call.context.storyboardDigest!==bound.storyboardDigest)engineSiteFail('engine_binding_review_changed');
   const answer=await runtime.call(prepareEngineResponse(authority,ENGINE_BOUND_REVIEW_STEP,personalBookProviderPayload(call,'gpt-6.1-sol'),x=>decodePersonalBookProviderOutput(call,x),ports));
   check();return answer.output;
  }},parent.draft);
 check();assertEngineBoundWorld(parent,diagnostic.storyboard);
 if(diagnostic.draftOrigin?.canonicalSha256!==parent.draftSha256||canonicalHash(parent.draft)!==parent.draftSha256)engineSiteFail('engine_binding_draft_changed');
 return {diagnostic,draft:parent.draft,bindingParent:origin};
}
