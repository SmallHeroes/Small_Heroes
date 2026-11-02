import {beforeAll,describe,it,expect} from 'vitest';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {admitExistingChildAppearance,deriveExistingChildAppearance,assertExistingChildAppearance,assertExistingChildClothing,
  existingChildAppearanceData} from '../existing-child-appearance';
import {prepareCurrentPersonalStoryboard,storyboardInstructions,storyboardDraftSchema,compilePersonalStoryboard} from '../storyboard';
import {loadReviewedBook,readReviewedBookLayout} from '../../../scripts/personal-simple-book-reviewed-audition';
import {resolvePersonalWizardOptions} from '../options';
import {previewSha} from '../../local-story-preview';
import {canonicalJson} from '../request-acceptance';
import {personalBookProviderSchema} from '../book-openai';
import {prepareSolWritingWire} from '../../../scripts/personal-sol-writing-transport';
import {personalBookOutputLimits} from '../book-config';

// Read-only genuine original inputs. Test-only answers elsewhere are never written into this directory.
export const R17_BOOK=process.env.SMALL_HEROES_R17_READONLY_BOOK??'';
const read=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
let original:ReturnType<typeof loadReviewedBook>,layout:ReturnType<typeof readReviewedBookLayout>,adoption:any,appearance:ReturnType<typeof deriveExistingChildAppearance>;
beforeAll(()=>{
  if(!R17_BOOK)return;
  layout=readReviewedBookLayout(path.join(R17_BOOK,'book-layout.json'));original=loadReviewedBook(R17_BOOK,process.cwd(),undefined,layout);
  adoption=read(path.join(R17_BOOK,layout.childDir,'reference_child_adoption.json'));
  appearance=deriveExistingChildAppearance({requestId:original.queued.requestId,sourceDigest:original.book.sourceDigest,
    storyboardDigest:original.book.storyboardDigest,clothing:original.book.plan.actorAppearance!.child.clothing},
    {age:original.prepared.brief.child.age,gender:original.prepared.brief.child.address as 'boy'|'girl',design:layout.childDesign,
      acceptance:layout.childAnchor!,pose:layout.childAnchorPose},adoption,previewSha(original.childBytes));
});
const source=(a=appearance)=>{
  const rest:any[]=Array(18).fill(undefined);rest[0]=true;rest[17]=a;
  return prepareCurrentPersonalStoryboard(...([original.queued.request,original.result.source,resolvePersonalWizardOptions(),...rest] as Parameters<typeof prepareCurrentPersonalStoryboard>));
};
describe.runIf(!!R17_BOOK)('general existing-admitted-child identity input, real R17 acceptance, provider denied',()=>{
  it('N1 original request/options/seed/book and adopted child genuinely admit at this source',()=>{
    expect(original.queued.requestId).toBe('efaf91e2a0d94d9bbb3d773a62978c940978dd59ddd99b77860e8d779a4e64ea');
    expect(original.book.narrativeSpreads).toBe(8);expect(original.prepared.seed).toBe(layout.seed);
    expect(appearance.contextSha).toBe('1616d35bae4c0a3485218fe62594d1bc5b53e8d63bd63e8f579827a771093f17');
    expect(appearance.child.clothing.join('; ')).toBe(original.book.plan.wardrobe);
  });
  it('restores only from the actual candidate/adoption/context/recipe; a JSON object alone is no compiler authority',()=>{
    const data=existingChildAppearanceData(appearance),restored=admitExistingChildAppearance(data,adoption,appearance.candidateSha);
    expect(restored).toEqual(appearance);expect(()=>assertExistingChildAppearance(data as any)).toThrow('existing_child_appearance_binding');
  });
  it.each(['candidate','context','recipe','adoption','wardrobe','order','unknown-field'])('refuses altered %s authority',kind=>{
    const data:any=existingChildAppearanceData(appearance);
    if(kind==='candidate')data.candidateSha='a'.repeat(64);if(kind==='context')data.contextSha='a'.repeat(64);
    if(kind==='recipe')data.recipeSha='a'.repeat(64);if(kind==='adoption')data.adoptionSha='a'.repeat(64);
    if(kind==='wardrobe')data.child.clothing[0]='Plain teal short-sleeve T-shirt';if(kind==='order')data.child.clothing.reverse();
    if(kind==='unknown-field')data.pages=[6,7];
    expect(()=>admitExistingChildAppearance(data,adoption,appearance.candidateSha)).toThrow();
  });
  it('binds identity to source, instructions, planner data and response schema, without a sample/page hint',()=>{
    const current=source(),plain=prepareCurrentPersonalStoryboard(original.queued.request,original.result.source,resolvePersonalWizardOptions(),true);
    expect(current.sourceDigest).not.toBe(plain.sourceDigest);expect(current.planningInput).toHaveProperty('existingChildAppearance');
    expect(storyboardInstructions(current)).toContain('Copy child.clothing exactly');
    const schema:any=storyboardDraftSchema(current);expect(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options).toEqual(appearance.child.clothing);
    expect(canonicalJson(existingChildAppearanceData(appearance))).not.toMatch(/selectedPages|sample|page6|depicted/);
    expect(plain).not.toHaveProperty('existingChildAppearance');expect(storyboardInstructions(plain)).not.toContain('EXISTING ADMITTED');
  });
  it('actual metadata-free Sol wire schema carries the source-owned clothing enum; no SDK constructor',()=>{
    const s=source(),call={stage:'storyboard' as const,instructions:storyboardInstructions(s),input:canonicalJson(s.planningInput),
      schema:storyboardDraftSchema(s),maxOutputTokens:24000,context:{narrativeSpreads:8,sourceDigest:s.sourceDigest,actorOwnedAppearance:true as const,
        existingChildAppearance:existingChildAppearanceData(appearance)}};
    // Ordinary no-self-check cap is read from the same existing limits as the real payload.
    call.maxOutputTokens=personalBookOutputLimits(8).storyboardOutputTokens;
    const schema:any=personalBookProviderSchema(call);
    expect(schema.shape.plan.shape.actorAppearance.shape.child.shape.clothing.element.options).toEqual(appearance.child.clothing);
    const wire=prepareSolWritingWire(call);expect(wire.payload.text.format.schema).toBeTruthy();
    expect(JSON.stringify(wire.payload.text.format.schema)).toContain('Plain teal short-sleeved T-shirt');
  });
  it.each(['synonym','order','missing','extra'])('raw %s clothing refuses before ordinary compile, never rewrites the answer',kind=>{
    const clothing=[...appearance.child.clothing];if(kind==='synonym')clothing[0]+=' shirt';if(kind==='order')clothing.reverse();
    if(kind==='missing')clothing.pop();if(kind==='extra')clothing.push('new hat');
    const draft={plan:{actorAppearance:{child:{clothing}}}},before=JSON.stringify(draft);
    expect(()=>assertExistingChildClothing(appearance,draft)).toThrow();expect(()=>compilePersonalStoryboard(source(),draft)).toThrow('existing_child_appearance_binding');
    expect(JSON.stringify(draft)).toBe(before);
  });
  it('changed admitted object or a different current request cannot borrow the input',()=>{
    const restored=admitExistingChildAppearance(existingChildAppearanceData(appearance),adoption,appearance.candidateSha);
    restored.child.clothing.reverse();expect(()=>source(restored)).toThrow('existing_child_appearance_binding');
    expect(()=>assertExistingChildAppearance(appearance,'a'.repeat(64))).toThrow();
  });
});
