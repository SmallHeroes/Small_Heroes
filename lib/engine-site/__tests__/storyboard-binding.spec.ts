import {describe,expect,it,vi} from 'vitest';
import {canonicalHash} from '@/lib/canonical-json';
// Pure capability/carry-forward tests. Real compiler/anchor/raw14-call coverage is the separate provider-denied replay gate.
vi.mock('@/lib/personal-wizard/storyboard',()=>({
 prepareCurrentPersonalStoryboard:(...args:any[])=>({source:args[1],existing:args[args.length-1]}),
 compilePersonalStoryboard:(_source:any,draft:any)=>({...structuredClone(draft),version:'synthetic-world',sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64)}),
 storyboardReviewDisposition:(_book:any,review:any)=>({disposition:review.disposition}),
}));
import {admitEngineBindingParent,assertEngineBoundWorld,engineBindingOrigin} from '../storyboard-binding';

function fixture(){
 const runtime:any={checkpoint:{ownerId:'synthetic_owner',draftId:'synthetic_draft',authority:{orderId:'synthetic_order',requestSha256:'c'.repeat(64),optionsSha256:'d'.repeat(64)}}};
 const snapshot:any={request:{},options:{}},source={synthetic:'compiler-unit-fixture'},draft={plan:{locations:[{id:'place',design:'fixed geometry'}],
  actorAppearance:{child:{clothing:['shirt','trousers']}},continuity:{entities:[{id:'built_object'}]}},sequence:{state:'fixed'},moments:[{instant:'fixed'}],
  instanceDistinction:{populations:[{id:'place',population:['repeated_material']}]},materialFunction:{builtFrom:[{id:'built_object',source:'material'}]},companionScale:{ratio:.7}};
 const initial:any={draft,diagnostic:{sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64),rawReview:{disposition:'review_supported'}}};
 const parent=admitEngineBindingParent(runtime,snapshot,source,initial);
 return{runtime,snapshot,source,initial,parent};
}
describe('accepted compiled world capability and exact carry-forward',()=>{
 it('allows only identity/provenance re-binding while retaining every world contract',()=>{
  const f=fixture(),bound:any=structuredClone(f.parent.book);bound.sourceDigest='e'.repeat(64);bound.storyboardDigest='f'.repeat(64);
  bound.existingChildAppearance={synthetic:true};bound.repair={parentStoryboardDigest:'0'.repeat(64)};
  expect(()=>assertEngineBoundWorld(f.parent,bound)).not.toThrow();
  expect(f.parent.draftSha256).toBe(canonicalHash(f.initial.draft));expect(Object.isFrozen(f.parent.draft)).toBe(true);
 });
 it.each(['location','entity','population','material','moments','sequence','scale','wardrobe','future_contract'])('rejects lost or changed %s state',kind=>{
  const f=fixture(),bound:any=structuredClone(f.parent.book);
  if(kind==='location')bound.plan.locations=[];
  if(kind==='entity')bound.plan.continuity.entities=[];
  if(kind==='population')delete bound.instanceDistinction;
  if(kind==='material')delete bound.materialFunction;
  if(kind==='moments')bound.moments=[];
  if(kind==='sequence')bound.sequence.state='changed';
  if(kind==='scale')bound.companionScale.ratio=1.4;
  if(kind==='wardrobe')bound.plan.actorAppearance.child.clothing.reverse();
  if(kind==='future_contract')bound.futureContract={introduced:'without parent authority'};
  expect(()=>assertEngineBoundWorld(f.parent,bound)).toThrow('engine_binding_world_changed');
 });
 it('refuses cloned capabilities even when every serialized byte matches',()=>{
  const f=fixture();expect(()=>assertEngineBoundWorld(structuredClone(f.parent),f.parent.book)).toThrow('engine_binding_world_changed');
  expect(()=>engineBindingOrigin(structuredClone(f.parent),{} as any)).toThrow('engine_binding_parent_changed');
 });
 it.each(['held','source_digest','storyboard_digest'])('refuses %s parent without accepting its supplied diagnostic',kind=>{
  const f=fixture(),initial=structuredClone(f.initial);
  if(kind==='held')initial.diagnostic.rawReview.disposition='review_held';
  if(kind==='source_digest')initial.diagnostic.sourceDigest='e'.repeat(64);
  if(kind==='storyboard_digest')initial.diagnostic.storyboardDigest='e'.repeat(64);
  expect(()=>admitEngineBindingParent(f.runtime,f.snapshot,f.source,initial)).toThrow('engine_binding_parent_not_supported');
 });
});
