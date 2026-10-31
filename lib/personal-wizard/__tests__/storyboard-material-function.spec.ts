import { runSimpleWizardBook } from '../simple-book-flow';
import { personalBookProviderSchema } from '../book-openai';
import { assertEngineContinuityOptions } from '../engine-continuity-contracts';
import { vi } from 'vitest';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { prepareCurrentPersonalStoryboard } from '../storyboard';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { textCanonOptions } from '../../../scripts/personal-simple-story';
import { describe, expect, it } from 'vitest';
import { ENTITY_MATERIAL_FUNCTION_VERSION, builtFromSchema, compileMaterialFunction, splitMaterialFunction, materialRenderAppendix } from '../storyboard-material-function';
import { INSTANCE_DISTINCTION_VERSION } from '../storyboard-instance-distinction';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, compilePersonalStoryboard, personalStoryboardReviewInput, storyboardDraftSchema, personalStoryboardFrame, storyboardReviewDisposition } from '../storyboard';
import { sourceSpans } from '../storyboard-claim-basis';
import { simpleReferenceDesigns } from '../simple-reference-designs';
import { auditionSheetContext, auditionPageChecks, auditionJudgeInstruction } from '../simple-book-reviewed-audition';

const E='personal_storyboard_material_function';
const texts=['A court','They built the court from the colourful blocks.'];
const plan={continuity:{entities:[{id:'court'},{id:'block'}]}};
const instances={version:INSTANCE_DISTINCTION_VERSION,populations:[{locationId:'garden',kinds:['block']}],entities:[]};
const lineage=(sources: any[]=[{entityId:'block'}])=>({sources,evidence:{citation:'p1:s1',quote:texts[1]}});
const rows=(b: unknown=lineage())=>[{id:'court',builtFrom:b},{id:'block',builtFrom:null}];
const compile=(r: unknown=rows())=>compileMaterialFunction(plan,instances,texts,r);

describe('entity-material-function/v1: source-bound general construction',()=>{
  it('the full flow rejects an invalid visual contract before any text-provider callback',async()=>{
    const callback=vi.fn();
    await expect(runSimpleWizardBook({request:{},options:{} as never,seed:'synthetic',signal:new AbortController().signal,
      opus:callback,reader:callback,visual:callback,engineContinuity:{materialFunction:true}} as never)).rejects.toThrow('engine_continuity_policy');
    expect(callback).not.toHaveBeenCalled();
  });
  it('refuses malformed flags or a missing instance contract before any planning call',()=>{
    expect(assertEngineContinuityOptions(undefined)).toBeUndefined();
    for(const v of [{},{materialFunction:false},{materialFunction:true,other:true},{materialFunction:true}])
      expect(()=>assertEngineContinuityOptions(v)).toThrow('engine_continuity_policy');
    expect(assertEngineContinuityOptions({materialFunction:true},true)).toEqual({materialFunction:true});
  });
  it('binds a construction to exact manuscript span and declared entity components',()=>{
    expect(compile()).toEqual({version:ENTITY_MATERIAL_FUNCTION_VERSION,entities:[{id:'court',builtFrom:lineage()}]});
    expect(compile(rows(null)).entities).toEqual([]);
  });
  it('accepts declared location populations as components, never guessed source kinds',()=>{
    expect(compile(rows(lineage([{locationId:'garden',kind:'block'}]))).entities).toHaveLength(1);
    for(const source of [{locationId:'missing',kind:'block'},{locationId:'garden',kind:'stone'},{locationId:'garden',kind:'Block'}])
      expect(()=>compile(rows(lineage([source])))).toThrow(E);
  });
  it('refuses missing annotations, unknown or duplicate owners, unknown/self/duplicate components',()=>{
    for(const r of [rows().slice(0,1),[...rows(),rows()[0]],[{id:'other',builtFrom:null},rows()[1]],
      rows(lineage([{entityId:'court'}])),rows(lineage([{entityId:'missing'}])),rows(lineage([{entityId:'block'},{entityId:'block'}])),
      [{id:'court'},{id:'block',builtFrom:null}]]) expect(()=>compile(r)).toThrow(E);
  });
  it('refuses unquoted evidence, a quote from another span and invented fields',()=>{
    for(const evidence of [{citation:'p1:s2',quote:texts[1]},{citation:'p1:s1',quote:'Invented colourful blocks.'},{citation:'p0:s1',quote:texts[1]}])
      expect(()=>compile(rows({...lineage(),evidence}))).toThrow(E);
    expect(builtFromSchema.safeParse({...lineage(),shape:'cube'}).success).toBe(false);
  });
  it('refuses cyclic material ownership, but shared acyclic components do not recurse repeatedly',()=>{
    expect(()=>compile([{id:'court',builtFrom:lineage()},{id:'block',builtFrom:lineage([{entityId:'court'}])}])).toThrow(E);
  });
  it('unmarked contexts produce byte-empty appendices; malformed opt-in markers refuse',()=>{
    expect(materialRenderAppendix({})).toBe('');
    expect(()=>materialRenderAppendix({materialFunction:{version:'wrong',entities:[]}})).toThrow();
  });
});

describe('material/function production compiler and image projection (no provider)',()=>{
  async function world(enabled=true){
    const f=await personalStoryboardFixture(),options=resolvePersonalWizardOptions(),flags=Array(16).fill(undefined);
    flags[2]=true;flags[15]=true;
    const source=preparePersonalStoryboard(...([f.request,f.result,options,...flags,...(enabled?[{materialFunction:true}]:[])] as Parameters<typeof preparePersonalStoryboard>));
    const draft=structuredClone(f.draft) as any;
    for(const l of draft.plan.locations)l.population=[];
    for(const e of draft.plan.continuity.entities){e.invariants.push({attribute:'kind',value:e.id==='hut'?'hut':'ribbon'});if(enabled)e.builtFrom=null;}
    const spans=sourceSpans([f.result.manuscript.title,...f.result.manuscript.pages.map(p=>p.text)]);
    if(enabled)draft.plan.continuity.entities.find((e:any)=>e.id==='hut').builtFrom={sources:[{entityId:'ribbon'}],evidence:{citation:spans.p1[0].id,quote:spans.p1[0].text}};
    return {...f,source,draft,book:compilePersonalStoryboard(source,draft)};
  }
  it('is opt-in, binds the compiled book/review and preserves legacy plan data without annotations',async()=>{
    const on=await world(),off=await world(false);
    expect(on.book.materialFunction?.entities[0].id).toBe('hut');
    expect(personalStoryboardReviewInput(on.book).materialFunction).toEqual(on.book.materialFunction);
    expect(off.book.materialFunction).toBeUndefined();expect(on.book.sourceDigest).not.toBe(off.book.sourceDigest);
    expect(on.book.plan.continuity!.entities.some(e=>'builtFrom' in e)).toBe(false);
    const stripped=splitMaterialFunction(on.draft);
    expect(compilePersonalStoryboard(off.source,stripped.draft).plan).toEqual(on.book.plan);
  });
  it('extends the actual planner schema with explicit nullable builtFrom and refuses unquoted data before admission',async()=>{
    const w=await world(),bad=structuredClone(w.draft);
    bad.plan.continuity.entities[0].builtFrom.evidence.quote='not a manuscript sentence';
    expect(()=>compilePersonalStoryboard(w.source,bad)).toThrow(E);
    const schema=storyboardDraftSchema({landmarkKindContract:true,instanceDistinctionContract:true,engineContinuity:{materialFunction:true}}) as any;
    const entity=schema.shape.plan.shape.continuity.shape.entities.element;
    expect(entity.safeParse(w.draft.plan.continuity.entities[1]).success).toBe(true);
    const missing={...w.draft.plan.continuity.entities[1]};delete missing.builtFrom;
    expect(entity.safeParse(missing).success).toBe(false);
    const wire=personalBookProviderSchema({stage:'storyboard',input:'{}',instructions:'synthetic',maxOutputTokens:1000,
      context:{narrativeSpreads:8,sourceDigest:'a'.repeat(64),landmarkKindContract:true,instanceDistinctionContract:true,
        engineContinuity:{materialFunction:true}}}) as any;
    expect(wire.shape.plan.shape.continuity.shape.entities.element.shape.builtFrom.safeParse(null).success).toBe(true);
  });
  it('reaches real sheet contexts and both render/judge instructions; page metadata is scoped to visibility',async()=>{
    const w=await world(),designs=simpleReferenceDesigns(w.book,true);
    const sheet=auditionSheetContext('entities',designs.entities);
    expect(sheet.context.materialFunction).toEqual(w.book.materialFunction);
    expect(sheet.requirementIds).toContain('material:hut');
    expect(materialRenderAppendix(sheet.context)).toContain(w.book.materialFunction!.entities[0].builtFrom.evidence.quote);
    expect(auditionJudgeInstruction('sheet',sheet.context)).toContain('A grey or shaded assembled');
    const checks=auditionPageChecks(w.book,0,'synthetic companion');
    expect(checks.materialFunction?.entities.every(e=>w.book.plan.continuity!.pages[0].visibleEntityIds.includes(e.id))).toBe(true);
  });
  it('a recorded material/contact contradiction holds actual frame admission; accepted wedge/grey cases do not invent a defect',async()=>{
    const w=await world();
    // Controlled reviewer answers prove gating, not pixel recognition or model diligence.
    const cases=[
      ['wedge on a flat face',false],['cube on a flat face',false],['grey/shaded assembled blocks; no stated palette',false],
      ['assembled blocks in the source palette',false],['tilted edge contradicts flat-face landing',true],
      ['monolithic carved mass replaces discrete source blocks',true],['grey contradicts a source-explicit colourful palette',true],
      ['square contradicts a source-explicit round shape',true],
    ] as const;
    for(const [observation,held] of cases){
      const review={...structuredClone(w.review),sourceDigest:w.book.sourceDigest,storyboardDigest:w.book.storyboardDigest};
      if(held)Object.assign(review.bookChecks.find(c=>c.category==='continuity')!,{verdict:'contradiction',observation});
      expect(storyboardReviewDisposition(w.book,review).disposition).toBe(held?'held_contradiction':'review_supported');
      if(held)expect(()=>personalStoryboardFrame(w.book,review,1,w.current)).toThrow('held_contradiction');
      else expect(personalStoryboardFrame(w.book,review,1,w.current).context.storyboardDigest).toBe(w.book.storyboardDigest);
    }
  });

});


describe('material/function actual diagnostic boundary with injected text transports only',()=>{
  it.each([false,true])('propagates the contract across every await; held=%s',async held=>{
    const f=await personalStoryboardFixture(),options=textCanonOptions(resolvePersonalWizardOptions()),plan=f.result.plan;
    const prepared=prepareSimpleStory(f.request,options,'material-diagnostic-fixture');
    const draft:SimpleStoryDraft={title:plan.title,childGoal:plan.childGoal,companionWant:plan.companionWant,comicPromise:plan.comicPromise,
      ending:plan.ending,pages:f.result.manuscript.pages.map(p=>({text:p.text+' נועה ודיני משחקות בציור.'})),
      pageMap:plan.beats.map(({pageNumber:_n,...b})=>b),resilienceMoments:plan.resilience.moments.map(({pageNumber,...m})=>({page:pageNumber,...m}))};
    const records:Record<string,any>={};
    const generated=await writeSimpleStory(prepared,async call=>{
      const output=call.stage==='author'?structuredClone(draft):{...structuredClone(draft),editorChanges:['Synthetic structure only.']};
      const usage={inputTokens:1000,outputTokens:2000},termination={code:0,signal:null};
      records[call.stage]={output,usage,estimatedMicroUsd:100000,metadata:{kind:'cli_reported_estimate_not_invoice',reportedModels:['claude-opus-5-5'],termination},
        raw:{termination,killConfirmed:true,stopped:false,stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,
          session_id:call.stage==='author'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',
          total_cost_usd:.1,modelUsage:{'claude-opus-5-5':usage},structured_output:output})}};
      return {output,usage,estimatedUsd:.1};
    },{model:'claude-opus-5-5',reservedUsd:2});
    const writerResult=createCurrentSimpleStorySource(f.request,generated,records as {author:unknown;editor:unknown},options);
    const flags=Array(16).fill(undefined);flags[2]=true;flags[15]=true;
    const source=prepareCurrentPersonalStoryboard(...([f.request,writerResult,options,...flags,{materialFunction:true}] as unknown as Parameters<typeof prepareCurrentPersonalStoryboard>));
    const annotated=structuredClone(f.draft) as any;
    for(const l of annotated.plan.locations)l.population=[];
    for(const e of annotated.plan.continuity.entities){e.invariants.push({attribute:'kind',value:e.id==='hut'?'hut':'ribbon'});e.builtFrom=null;}
    const book=compilePersonalStoryboard(source,annotated),review={...structuredClone(f.review),sourceDigest:book.sourceDigest,storyboardDigest:book.storyboardDigest};
    if(held)Object.assign(review.bookChecks.find(c=>c.category==='continuity')!,{verdict:'contradiction',observation:'Source construction is not supported.'});
    const generate=vi.fn(async(call:SimpleStoryboardDiagnosticCall)=>structuredClone(call.stage==='storyboard'?annotated:review));
    const result=await runSimpleStoryboardDiagnostic({request:f.request,writerResult,options,signal:new AbortController().signal,generate,
      landmarkKindContract:true,instanceDistinctionContract:true,engineContinuity:{materialFunction:true}});
    expect(generate).toHaveBeenCalledTimes(2);
    expect(JSON.parse(generate.mock.calls[0][0].input).materialSourceSpans.p1).toBeDefined();
    expect(generate.mock.calls.every(([call])=>call.context.engineContinuity?.materialFunction)).toBe(true);
    expect(generate.mock.calls[1][0].instructions).toContain('ENTITY MATERIAL/FUNCTION CONTRACT');
    expect(JSON.parse(generate.mock.calls[1][0].input).materialFunction).toEqual(book.materialFunction);
    expect(result.status).toBe(held?'held_contradiction':'review_supported');
    expect(result.framePackets.length).toBe(held?0:book.narrativeSpreads+1);
  });
});
