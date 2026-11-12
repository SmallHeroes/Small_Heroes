import {describe,expect,it,vi,beforeEach} from 'vitest';
import {canonicalHash} from '@/lib/canonical-json';
// Pure orchestration tests of the engine's one bound repair. The real compiler binding is covered in personal-wizard/storyboard-bound-repair.
const m=vi.hoisted(()=>({calls:[] as any[],status:'review_supported'}));
vi.mock('@/lib/personal-wizard/storyboard',()=>({
 prepareCurrentPersonalStoryboard:(...args:any[])=>({source:args[1],existing:args[args.length-1]}),
 compilePersonalStoryboard:(_source:any,draft:any)=>({...structuredClone(draft),version:'synthetic-world',sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64)}),
 storyboardReviewDisposition:(_book:any,review:any)=>({disposition:review.disposition}),
}));
vi.mock('@/lib/personal-wizard/existing-child-appearance',async original=>({...await original<any>(),
 assertExistingChildAppearance:()=>{},existingChildAppearanceData:(x:any)=>({synthetic:x.candidateSha})}));
vi.mock('../story-preparation',async original=>({...await original<any>(),prepareEngineStoryboard:async(...args:any[])=>{m.calls.push(args);
 return {diagnostic:{status:m.status,sourceDigest:'c'.repeat(64),storyboardDigest:'d'.repeat(64),rawReview:{disposition:m.status},
  storyboard:{existingChildAppearance:{synthetic:'e'.repeat(64)}}},draft:{repaired:true}};}}));
import {admitEngineBindingParent,prepareEngineBoundRepair,engineBoundRepairOrigin,engineBoundRepairInput} from '../storyboard-binding';
import {ENGINE_BOUND_REPAIR_STEP,ENGINE_BOUND_REPAIR_REVIEW_STEP,ENGINE_BOUND_REVIEW_STEP,ENGINE_STORYBOARD_BINDING} from '../storyboard-binding-policy';
import {ENGINE_CURRENT_CUSTOMER} from '../current-engine-policy';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from '../response-schema';
import {STORYBOARD_BOUND_REPAIR_VERSION} from '@/lib/personal-wizard/storyboard-repair';

const steps=[ENGINE_BOUND_REVIEW_STEP,ENGINE_BOUND_REPAIR_STEP,ENGINE_BOUND_REPAIR_REVIEW_STEP].map(id=>({id,maximumMicroUsd:1_200_000}));
function fixture(authorityOverride:Record<string,unknown>={}){
 const authority:any={orderId:'synthetic_order',requestSha256:'c'.repeat(64),optionsSha256:'d'.repeat(64),purpose:'customer',currentEngine:ENGINE_CURRENT_CUSTOMER,
  storyboardBindingPolicy:ENGINE_STORYBOARD_BINDING,responseSchemaPolicy:ENGINE_RESPONSE_SCHEMA_POLICY,budget:{steps},...authorityOverride};
 const runtime:any={checkpoint:{ownerId:'synthetic_owner',draftId:'synthetic_draft',authority}};
 const snapshot:any={request:{},options:{}},source:any={synthetic:'bound-repair-fixture'},draft={plan:{actorAppearance:{child:{clothing:['shirt','trousers']}}},sequence:{state:'fixed'}};
 const parent=admitEngineBindingParent(runtime,snapshot,source,{draft,diagnostic:{sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64),rawReview:{disposition:'review_supported'}}});
 const existing:any={originalSourceDigest:'a'.repeat(64),originalStoryboardDigest:'b'.repeat(64),child:{clothing:['shirt','trousers']},candidateSha:'e'.repeat(64)};
 const held={diagnostic:{status:'review_held',sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64),rawReview:{disposition:'review_held',finding:'bound continuity'}}};
 return {authority,runtime,snapshot,source,draft,parent,existing,held};
}
const ports:any={};
beforeEach(()=>{m.calls.length=0;m.status='review_supported';});

describe('the current engine repairs a held bound board once, from its own bound review, with the child pinned',()=>{
 it('derives the exact repair input (bound board digest, unchanged parent draft, raw bound review, marker) and runs ONE bound-repair stage',async()=>{
  const f=fixture(),r=await prepareEngineBoundRepair(f.runtime,f.snapshot,f.source,ports,f.parent,f.existing,f.held);
  expect(m.calls).toHaveLength(1);const [, , source, , prefix, existing, repair]=m.calls[0];
  expect(prefix).toBe('bound_repair');expect(source).toBe(f.source);expect(existing).toBe(f.existing);
  expect(repair).toEqual({parentStoryboardDigest:'b'.repeat(64),draft:f.draft,review:f.held.diagnostic.rawReview,
   parentCompile:{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true},binding:STORYBOARD_BOUND_REPAIR_VERSION});
  expect(r.repair).toEqual(repair);expect(r.draft).toEqual({repaired:true});
  expect(r.bindingParent).toMatchObject({version:ENGINE_STORYBOARD_BINDING,parentDraftSha256:canonicalHash(f.draft),plannerInvoked:true,
   boundRepair:{version:STORYBOARD_BOUND_REPAIR_VERSION,boundStoryboardDigest:'b'.repeat(64),boundReviewSha256:canonicalHash(f.held.diagnostic.rawReview)}});
 });
 it('refuses a supported bound review, a review of another board, and an authority without both slots, before any repair',async()=>{
  const f=fixture();
  const supported={diagnostic:{...f.held.diagnostic,status:'review_supported',rawReview:{disposition:'review_supported'}}};
  await expect(prepareEngineBoundRepair(f.runtime,f.snapshot,f.source,ports,f.parent,f.existing,supported)).rejects.toThrow('engine_bound_repair_not_held');
  const other={diagnostic:{...f.held.diagnostic,storyboardDigest:'f'.repeat(64)}};
  await expect(prepareEngineBoundRepair(f.runtime,f.snapshot,f.source,ports,f.parent,f.existing,other)).rejects.toThrow('engine_bound_repair_parent_changed');
  for(const override of [{budget:{steps:steps.filter(s=>s.id!==ENGINE_BOUND_REPAIR_REVIEW_STEP)}},{purpose:'test'},{currentEngine:undefined}]){
   const g=fixture(override);
   await expect(prepareEngineBoundRepair(g.runtime,g.snapshot,g.source,ports,g.parent,g.existing,g.held)).rejects.toThrow('engine_bound_repair_authority');
  }
  expect(m.calls).toHaveLength(0);
 });
 it('refuses a repaired board whose child appearance differs from the admitted one',async()=>{
  const f=fixture(),existing={...f.existing,candidateSha:'9'.repeat(64)};
  // The repaired board must carry exactly the admitted appearance; the stage's board carries another one here.
  await expect(prepareEngineBoundRepair(f.runtime,f.snapshot,f.source,ports,f.parent,existing,f.held)).rejects.toThrow('engine_bound_repair_child_changed');
 });
 it('the recorded origin binds that exact repair: another draft, review or marker is refused on restore',()=>{
  const f=fixture(),repair=engineBoundRepairInput(f.snapshot,f.source,f.parent,f.existing,f.held.diagnostic.rawReview,f.authority);
  expect(engineBoundRepairOrigin(f.snapshot,f.source,f.parent,f.existing,repair,f.authority).boundRepair.boundReviewSha256).toBe(canonicalHash(f.held.diagnostic.rawReview));
  const {binding:_marker,...unmarked}=repair;
  for(const changed of [{...repair,draft:{other:true}},unmarked,{...repair,parentStoryboardDigest:'f'.repeat(64)},{...repair,review:{disposition:'review_supported'}}])
   expect(()=>engineBoundRepairOrigin(f.snapshot,f.source,f.parent,f.existing,changed as any,f.authority)).toThrow(/engine_bound_repair_(parent_changed|not_held)/);
  // Another held review gives another origin, so the restore's comparison with the recorded origin refuses it.
  const recorded=engineBoundRepairOrigin(f.snapshot,f.source,f.parent,f.existing,repair,f.authority);
  const swapped=engineBoundRepairOrigin(f.snapshot,f.source,f.parent,f.existing,{...repair,review:{disposition:'review_held',finding:'another'}},f.authority);
  expect(canonicalHash(swapped)).not.toBe(canonicalHash(recorded));
 });
});
