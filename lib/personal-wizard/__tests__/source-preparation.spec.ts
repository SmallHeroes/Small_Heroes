import {beforeAll,describe,it,expect,vi} from 'vitest';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {planSourcePreparation,PREPARATION_CONTRACTS,preparationMeterRules} from '../../../scripts/personal-source-preparation';
import {compilePersonalStoryboard,personalStoryboardReviewInput} from '../storyboard';
const R17=process.env.SMALL_HEROES_R17_READONLY_BOOK??'';
const read=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
let plan:ReturnType<typeof planSourcePreparation>;
beforeAll(()=>{if(!R17)return;plan=planSourcePreparation({bookDir:R17,layoutFile:path.join(R17,'book-layout.json')});});
describe.runIf(!!R17)('N1 exact real-input source/wire preflight with providers denied',()=>{
  it('admits the original request and builds the COMPLETE new CDE/appearance wire without claiming or writing',()=>{
    expect(plan.original.queued.requestId).toBe('efaf91e2a0d94d9bbb3d773a62978c940978dd59ddd99b77860e8d779a4e64ea');
    expect(plan.firstWire.bytes).toBeLessThanOrEqual(104000);expect(plan.firstWire.outputCap).toBe(50000);
    expect(plan.firstCall.context.engineContinuity).toEqual(PREPARATION_CONTRACTS.engineContinuity);
    expect(plan.firstCall.input).toContain('existing-admitted-child-appearance/v1');
    expect(plan.firstWire.json).toContain('Plain teal short-sleeved T-shirt');
    expect(plan.providerCalls).toBe(0);expect(plan.executionReady).toBe(false);
    expect(preparationMeterRules('page_6_0')).toBeUndefined();expect(preparationMeterRules('sheet_entities_1')).toBeUndefined();
  });
  it('compiler fixture: only the new paid ANSWER is synthetic; real request/writerResult/child/options stay unchanged',()=>{
    const draft=read(path.join(R17,'text_1','owned_storyboard_draft.json'));
    // Explicitly SYNTHETIC, not source correction/product or model efficacy evidence.
    draft.plan.continuity.companionStandingHeightInChildHeights=.7;
    for(const location of draft.plan.locations)location.population=[];
    for(const entity of draft.plan.continuity.entities){entity.builtFrom=null;
      if(!entity.invariants.some((x:any)=>x.attribute==='kind'))entity.invariants.push({attribute:'kind',value:entity.id.replaceAll('_',' ')});}
    for(const design of draft.selfCheck.designs){if(!design.attributes.some((x:any)=>x.attribute==='kind'))design.attributes.push({attribute:'kind',designPhrase:null,agrees:true});}
    const book=compilePersonalStoryboard(plan.source,draft,{selfCheckNames:true,selfCheckSourceSpans:true,stagingFields:true});
    expect(book.existingChildAppearance?.contextSha).toBe('1616d35bae4c0a3485218fe62594d1bc5b53e8d63bd63e8f579827a771093f17');
    expect(personalStoryboardReviewInput(book)).toHaveProperty('existingChildAppearance');
    expect(book.plan.wardrobe).toBe(plan.original.book.plan.wardrobe);
  });
});
