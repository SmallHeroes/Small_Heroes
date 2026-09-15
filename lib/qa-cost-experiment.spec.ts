import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { PreviewPlan,previewSha } from './local-story-preview';
import { ANATOMY_INSPECTION_INSTRUCTION, PREVIEW_JUDGE_INSTRUCTION, QUALITY_CATEGORIES } from './local-preview-quality';
const {create,options}=vi.hoisted(()=>({create:vi.fn(),options:vi.fn()}));
vi.mock('openai',()=>({default:class{responses={create};constructor(o:unknown){options(o)}}}));
import { anatomyRequest,candidateViews,compactContext,contextualRequest,mergedDecision,paidFlex } from '../scripts/lib/qa-cost-experiment';
let root:string;
beforeEach(()=>{create.mockReset();options.mockReset();root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-cost-test-'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
const sha='a'.repeat(64),ctx='b'.repeat(64);
const anatomy={verdict:'pass' as const,visibleBodyTraces:['two attached arms'],observation:'coherent',correction:''};
const review=()=>({candidateSha:sha,contextSha:ctx,checks:QUALITY_CATEGORIES.map(category=>({category,verdict:'pass',observation:'visible evidence',correction:''}))});
const response=(tier='flex')=>({status:'completed',output_text:'{}',model:'gpt-5.5-2026-04-23',service_tier:tier,id:'resp_test',incomplete_details:null,usage:{input_tokens:100,output_tokens:100}});
describe('isolated QA cost experiment',()=>{
  it('keeps five high-detail views and unchanged blind instruction/limits',async()=>{
    const bytes=await sharp({create:{width:100,height:150,channels:3,background:'#fff'}}).png().toBuffer();
    const views=await candidateViews(bytes),request=anatomyRequest(views);
    expect(views.filter(c=>c.type==='input_image')).toHaveLength(5);
    expect(views.filter(c=>c.type==='input_image').every(c=>c.detail==='high')).toBe(true);
    expect(request).toMatchObject({model:'gpt-5.5',reasoning:{effort:'medium'},service_tier:'flex',store:false,max_output_tokens:10000,instructions:ANATOMY_INSPECTION_INSTRUCTION});
  });
  it('only compact arm puts references before dynamic context; both keep schemas and limits',()=>{
    const args={views:[],references:[{role:'child',sha,bytes:Buffer.from('image')}],anatomy,candidateSha:sha,context:{sentinel:'dynamic'}};
    const control=contextualRequest({...args,arm:'control'}),compact=contextualRequest({...args,arm:'compact'});
    const c=control.request.input as {content:{text?:string}[]}[],p=compact.request.input as {content:{text?:string}[]}[];
    expect(c[0].content[0].text).toContain('dynamic');expect(p[0].content[0].text).toBe('REFERENCE ONLY: child');
    expect(control.request.instructions).toBe(PREVIEW_JUDGE_INSTRUCTION);
    expect(compact.request.text).toEqual(control.request.text);
    expect(compact.request.max_output_tokens).toBe(4500);expect(control.contextSha).toBe(compact.contextSha);
  });
  it('projects current state without importing future changes or later scene prose',()=>{
    const pages=[0,1,2].map(pageNumber=>({pageNumber,locationId:'meadow',shot:'wide',angle:'high',props:[],scene:pageNumber===2?'FUTURE_SCENE':'now'}));
    const plan={pages,wardrobe:'blue',visualLanguage:'watercolor',locations:[{id:'meadow',design:'grass'}],recurringProps:[],continuity:{companionStandingHeightInChildHeights:.75,entities:[{id:'path',kind:'prop',invariants:[{attribute:'flower',value:'absent'}]}],pages:pages.map(p=>({pageNumber:p.pageNumber,visibleEntityIds:['path'],visibleLocationIds:['meadow'],childHeightFraction:.33,environmentAreaFraction:.65,changes:p.pageNumber===2?[{entityId:'path',attribute:'flower',value:'blue',storyEvidence:'appears'}]:[]}))}} as unknown as PreviewPlan;
    const early=compactContext(plan,1,'current',[]),late=compactContext(plan,2,'later',[]);
    expect(early.currentState.entities[0].currentState.flower).toBe('absent');expect(late.currentState.entities[0].currentState.flower).toBe('blue');
    expect(JSON.stringify(early)).not.toContain('FUTURE_SCENE');expect(early.cameraSequence).toHaveLength(3);
  });
  it('preserves blind defect over contextual pass',()=>{
    const result=mergedDecision(review(),{...anatomy,verdict:'defect',observation:'extra hand',correction:'remove hand'},sha,ctx);
    expect(result.disposition).toBe('repair');
  });
  it('preserves blind uncertainty as hold',()=>expect(mergedDecision(review(),{...anatomy,verdict:'uncertain'},sha,ctx).disposition).toBe('held_uncertain'));
  it('rejects wrong bindings and duplicate categories',()=>{
    expect(()=>mergedDecision(review(),anatomy,'c'.repeat(64),ctx)).toThrow('quality_evidence_binding');
    const r=review();r.checks[1]=r.checks[0];expect(()=>mergedDecision(r,anatomy,sha,ctx)).toThrow('quality_category_coverage');
  });
  it('checkpoints served metadata and replays with zero calls',async()=>{
    create.mockResolvedValue(response());const request=anatomyRequest([]);
    const first=await paidFlex(root,'anatomy',request,'fake');expect((await paidFlex(root,'anatomy',request,'fake'))).toEqual(first);
    expect(create).toHaveBeenCalledTimes(1);expect(options.mock.calls[0][0]).toMatchObject({maxRetries:0,timeout:900000});
    expect(first.value).toMatchObject({serviceTier:'flex',responseId:'resp_test'});
  });
  it('rejects non-Flex policy before dispatch',async()=>{
    await expect(paidFlex(root,'bad',{...anatomyRequest([]),service_tier:'default'},'fake')).rejects.toThrow('experiment_request_policy');expect(create).not.toHaveBeenCalled();
  });
  it('retains served-tier mismatch without fallback/rebilling',async()=>{
    create.mockResolvedValue(response('default'));
    await expect(paidFlex(root,'tier',anatomyRequest([]),'fake')).rejects.toThrow('experiment_served_tier_mismatch');
    await expect(paidFlex(root,'tier',anatomyRequest([]),'fake')).rejects.toThrow('experiment_served_tier_mismatch');expect(create).toHaveBeenCalledTimes(1);
  });
  it('unknown outcome cannot retry',async()=>{
    create.mockRejectedValue(new Error('transport'));
    await expect(paidFlex(root,'unknown',anatomyRequest([]),'fake')).rejects.toThrow('transport');
    await expect(paidFlex(root,'unknown',anatomyRequest([]),'fake')).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry');expect(create).toHaveBeenCalledTimes(1);
  });
  it('request changes invalidate checkpoint',async()=>{
    create.mockResolvedValue(response());await paidFlex(root,'changed',anatomyRequest([]),'fake');
    await expect(paidFlex(root,'changed',{...anatomyRequest([]),instructions:'changed'},'fake')).rejects.toThrow('checkpoint_identity_changed');
  });
});
