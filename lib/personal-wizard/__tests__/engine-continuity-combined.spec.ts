import {it,expect} from 'vitest';
import {personalStoryboardFixture} from './personal-storyboard-fixture';
import {resolvePersonalWizardOptions} from '../options';
import {preparePersonalStoryboard,compilePersonalStoryboard} from '../storyboard';
import {sourceSpans} from '../storyboard-claim-basis';
import {auditionPageContext,auditionPageReviewSchemaForContext,auditionJudgeInstruction,LANDMARK_DESIGN_HEAD_VERSION,LANDMARK_COVERAGE_TOPOLOGY_VERSION} from '../simple-book-reviewed-audition';

it('C/D/E compose on one actually compiled source and one native page review context, without provider calls',async()=>{
  const f=await personalStoryboardFixture('short','elephant_momo'),flags=Array(16).fill(undefined);flags[2]=true;flags[15]=true;
  const source=preparePersonalStoryboard(...([f.request,f.result,resolvePersonalWizardOptions(),...flags,{materialFunction:true,companionScale:true}] as unknown as Parameters<typeof preparePersonalStoryboard>));
  const draft=structuredClone(f.draft) as any;draft.plan.continuity.companionStandingHeightInChildHeights=.7;
  for(const l of draft.plan.locations)l.population=[];
  for(const e of draft.plan.continuity.entities){e.invariants.push({attribute:'kind',value:e.id==='hut'?'hut':'ribbon'});e.builtFrom=null;}
  const sentence=sourceSpans([f.result.manuscript.title,...f.result.manuscript.pages.map(p=>p.text)]).p1[0];
  draft.plan.continuity.entities[0].builtFrom={sources:[{entityId:'ribbon'}],evidence:{citation:sentence.id,quote:sentence.text}};
  const book=compilePersonalStoryboard(source,draft),image=(name:string)=>({imageName:name+'.png',imageSha:name.padEnd(64,'a').slice(0,64)});
  const images=[image('c'),image('d'),image('e'),image('f')],refs={entities:{image:images[2],status:'approved_reference' as const,knownFlaws:[]},locations:{image:images[3],status:'approved_reference' as const,knownFlaws:[]}};
  const {context}=auditionPageContext(book,{pageNumber:1},1,'Momo in his approved natural standing pose',images,refs,null,
    LANDMARK_DESIGN_HEAD_VERSION,LANDMARK_COVERAGE_TOPOLOGY_VERSION,true);
  expect(context).toMatchObject({version:'audition-page-context/v7',instanceDistinction:'instance-distinction/v1',
    materialFunction:{version:'entity-material-function/v1'},companionScale:{version:'companion-scale/v1',companionId:'elephant_momo'}});
  expect(auditionPageReviewSchemaForContext(context).shape).toHaveProperty('scaleEvidence');
  const instructions=auditionJudgeInstruction('page',context);
  expect(instructions).toContain('INSTANCE DISTINCTION');expect(instructions).toContain('ENTITY MATERIAL/FUNCTION');expect(instructions).toContain('COMPANION SCALE CONTRACT');
  expect(source.planningInput.materialSourceSpans).toBeDefined();expect(source.planningInput.companionScale?.companionId).toBe('elephant_momo');
});
