import {describe,it,expect} from 'vitest';
import {QUALITY_CATEGORIES} from '../../local-preview-quality';
import {previewSha} from '../../local-story-preview';
import {canonicalJson} from '../request-acceptance';
import {ownedWholeBookDraftSchema} from '../../local-book-planning';
import {CHILD_ANCHOR_TECHNIQUE_MANIFEST,CHILD_ANCHOR_MANIFEST_SHA256,CHILD_ANCHOR_STYLE_VERSION,CHILD_ANCHOR_INSPECTION_VERSION,
  CHILD_ANCHOR_REQUIRED_VISIBLE,childAnchorRecipeSchema,childAnchorRecipeSha,childAnchorDescriptionRequest,childAnchorInspectionContext,
  childAnchorInspectionContextSha,childAnchorInspectedAdoptionRecord} from '../child-anchor-style';
import {deriveExistingChildAppearance,admitExistingChildAppearance,existingChildAppearanceData,assertExistingChildAppearance,
  assertExistingChildClothing,withExistingChildAppearanceSchema} from '../existing-child-appearance';

function fixture(){
  const clothing=['red sweater','blue jeans','navy shoes'],child={age:6,gender:'girl' as const,design:'An entirely fictional six-year-old girl with short curly dark hair, brown eyes and ordinary child proportions.',wardrobe:clothing.join('; ')};
  const request=childAnchorDescriptionRequest(child),context=childAnchorInspectionContext(child,request.prompt),contextSha=childAnchorInspectionContextSha(context),candidateSha=previewSha('SYNTHETIC child bytes, not an image outcome');
  const recipe=childAnchorRecipeSchema.parse({version:CHILD_ANCHOR_STYLE_VERSION,identitySource:'description',manifestSha256:CHILD_ANCHOR_MANIFEST_SHA256,step:'reference_child',referenceMode:'style',
    references:CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e=>({role:e.label,sha256:e.sha256})),promptSha256:previewSha(request.prompt),requestedAge:6});
  const recipeSha=childAnchorRecipeSha(recipe),style={candidateSha,contextSha,recipeSha,assessable:true,style01Match:true,looksPhotoreal:false,looksPortrait:false,notes:'Synthetic structural answer only'};
  const design={candidateSha,contextSha,recipeSha,inspectionVersion:CHILD_ANCHOR_INSPECTION_VERSION,
    checks:QUALITY_CATEGORIES.map(category=>({category,verdict:'pass',observation:'Synthetic structural answer only',correction:''})),
    apparentAge:{requestedAge:6,verdict:'compatible',observation:'Synthetic age answer',correction:''},visibleEvidence:CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect=>({aspect,verdict:'matched',observation:'Synthetic aspect'})),unobservedConditional:[]};
  const adoption={name:'child',context,candidate:{imageName:'synthetic.png',imageSha:candidateSha},anchor:childAnchorInspectedAdoptionRecord(context,recipe,style,design)};
  const origin={requestId:previewSha('Synthetic request'),sourceDigest:previewSha('Synthetic source'),storyboardDigest:previewSha('Synthetic storyboard'),clothing};
  const authority=deriveExistingChildAppearance(origin,{age:6,gender:'girl',design:child.design,acceptance:CHILD_ANCHOR_INSPECTION_VERSION},adoption,candidateSha);
  return{authority,adoption,candidateSha,contextSha,clothing};
}
describe('portable generic admitted appearance contract, no R17 or provider dependency',()=>{
  it('derives accepted context/recipe/design from actual existing validators, with arbitrary source-owned clothes',()=>{
    const f=fixture();expect(f.authority.contextSha).toBe(f.contextSha);expect(f.authority.child.clothing).toEqual(f.clothing);
    expect(admitExistingChildAppearance(existingChildAppearanceData(f.authority),f.adoption,f.candidateSha)).toEqual(f.authority);
  });
  it('a clone or changed admitted object is not compiler authority',()=>{
    const f=fixture();expect(()=>assertExistingChildAppearance(existingChildAppearanceData(f.authority) as any)).toThrow();
    f.authority.child.clothing.reverse();expect(()=>assertExistingChildAppearance(f.authority)).toThrow();
  });
  it.each(['word','order','extra','candidate','recipe','context','adoption'])('refuses %s drift',kind=>{
    const f=fixture(),data=existingChildAppearanceData(f.authority);
    if(kind==='word')data.child.clothing[0]='scarlet sweater';if(kind==='order')data.child.clothing.reverse();if(kind==='extra')data.child.clothing.push('hat');
    if(kind==='candidate')data.candidateSha='0'.repeat(64);if(kind==='recipe')data.recipeSha='0'.repeat(64);if(kind==='context')data.contextSha='0'.repeat(64);if(kind==='adoption')data.adoptionSha='0'.repeat(64);
    expect(()=>admitExistingChildAppearance(data,f.adoption,f.candidateSha)).toThrow();
  });
  it('response schema narrows source-owned items; raw equality retains their order with no answer editing',()=>{
    const f=fixture(),schema:any=withExistingChildAppearanceSchema(ownedWholeBookDraftSchema,existingChildAppearanceData(f.authority));
    expect(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options).toEqual(f.clothing);
    const answer={plan:{actorAppearance:{child:{clothing:[...f.clothing]}}}},before=canonicalJson(answer);assertExistingChildClothing(f.authority,answer);expect(canonicalJson(answer)).toBe(before);
    answer.plan.actorAppearance.child.clothing.reverse();expect(()=>assertExistingChildClothing(f.authority,answer)).toThrow();
    expect(withExistingChildAppearanceSchema(ownedWholeBookDraftSchema)).toBe(ownedWholeBookDraftSchema);
  });
});
