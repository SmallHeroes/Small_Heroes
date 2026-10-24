import { describe,it,expect } from 'vitest';
import { z } from 'zod';
import sharp from 'sharp';
import { mkdtempSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory,writeSimpleStory,type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource,admitCurrentSimpleStorySource,projectSimpleSolReceipt,SOL_SIMPLE_SOURCE_VERSION,
  prepareSimpleStoryRepair,createRepairedSimpleStorySource,SOL_REPAIRED_SOURCE_VERSION,simpleStoryReadingPackets } from '../simple-story-source';
import { causalSourceReviewPacket,compileCausalSourceReading } from '../story-causal-experiment';
import { citationTokens } from '../story-source-citations';
import { SOL_WRITING,prepareSolWritingWire } from '../../../scripts/personal-sol-writing-transport';
import { PORTRAIT_BOOK_TRIAL,BOOK_E2E_TRIAL,READER_SAFE_BOOK_TRIAL,trialApiRules,trialConfigSchema,bookTrialPolicy,TrialApiMeter,trialStoryboardLayout } from '../../../scripts/personal-book-e2e-trial';
import { auditionJudgePayload,auditionReviewOutputCap,auditionReviewRule,AUDITION_REVIEW_CAPACITY_VERSION as capV1,durableReviewPayload } from '../../../scripts/personal-simple-book-reviewed-audition';
import { prepareCurrentPersonalStoryboard } from '../storyboard';
import { READER_PORTRAIT_FRAMING_VERSION as portrait } from '../../storybook-scene-framing';
import { runSimpleWizardBook } from '../simple-book-flow';

const options=resolvePersonalWizardOptions(),folder=()=>mkdtempSync(path.join(tmpdir(),'portrait-book-'));
function solRecord(stage:string,output:unknown,id=`resp_synthetic_${stage}`){return{stage,output,estimatedMicroUsd:22000,usage:{inputTokens:1000,outputTokens:2000},
  metadata:{reportedModel:SOL_WRITING.model,serviceTier:'default',responseId:id,status:'completed',kind:'provider_reported_usage_estimate_not_invoice'},
  raw:{id,model:SOL_WRITING.model,status:'completed',service_tier:'default',output_text:JSON.stringify(output),usage:{input_tokens:1000,output_tokens:2000}}};}
async function fixture(){
  const f=await personalStoryboardFixture('short','panda_anat'),p=prepareSimpleStory(f.request,options,'portrait-source-synthetic');
  const plan=f.result.plan,draft:SimpleStoryDraft={title:plan.title,childGoal:plan.childGoal,companionWant:plan.companionWant,comicPromise:plan.comicPromise,ending:plan.ending,
    pages:f.result.manuscript.pages.map(page=>({text:`${page.text} נועה ו${p.book.companion.shortName} משחקות בציור.`})),
    pageMap:plan.beats.map(({pageNumber:_n,...row})=>row),resilienceMoments:plan.resilience.moments.map(({pageNumber,...m})=>({page:pageNumber,...m}))};
  const records:any={},calls:any[]=[];
  const generated=await writeSimpleStory(p,async call=>{calls.push(call);const output=call.stage==='author'?structuredClone(draft):{...structuredClone(draft),editorChanges:['Synthetic edit, not product acceptance.']};
    records[call.stage]=solRecord(call.stage,output);return{output,usage:records[call.stage].usage,estimatedUsd:.022};},{model:SOL_WRITING.model,reservedUsd:2});
  const source=createCurrentSimpleStorySource(f.request,generated,records,options,SOL_WRITING.model);return{f,p,generated,records,calls,source};
}
describe('one new opt-in portrait Sol book, no history resets',()=>{
  it('keeps fixed old routes/claims and creates exactly one distinct limited new authority',()=>{
    expect(bookTrialPolicy(PORTRAIT_BOOK_TRIAL.id)).toBe(PORTRAIT_BOOK_TRIAL);expect(PORTRAIT_BOOK_TRIAL).toMatchObject({apiCapMicroUsd:7000000,maxApiCalls:98,maxResourceMicroUsd:0,pageAttempts:3,storyboardAttempts:3,readerFraming:portrait,reviewCapacity:capV1});
    expect(PORTRAIT_BOOK_TRIAL.routes).toMatchObject({writing:'gpt-6.1-sol/openai_responses',images:'gpt-image-2/low',numericIdentity:'gpt-4o',identityThreshold:.7});
    expect(new Set([BOOK_E2E_TRIAL.claim,READER_SAFE_BOOK_TRIAL.claim,PORTRAIT_BOOK_TRIAL.claim]).size).toBe(3);
    expect(BOOK_E2E_TRIAL.routes.writing).toBe('claude-opus-5-5/claude-max');expect(READER_SAFE_BOOK_TRIAL.readerFraming).toBe('reader-safe-scene-framing/v1');
    expect(()=>bookTrialPolicy('portrait-new-folder' as any)).toThrow('trial_cycle');
    const config={version:'book-e2e-trial-config/v1',cycle:PORTRAIT_BOOK_TRIAL.id,ownerFile:'C:/o',ownerSha:'a'.repeat(64),bookDir:'C:/b',profileFile:'C:/p',profileSha:'b'.repeat(64),
      executable:'C:/exe',executableSha256:'c'.repeat(64),keyFile:'C:/existing'};
    expect(trialConfigSchema.safeParse(config).success).toBe(false);
    expect(trialConfigSchema.safeParse({...config,operatorFile:'C:/operator.cjs',operatorSha:'d'.repeat(64)}).success).toBe(true);
  });
  it.each(['author','editor','storyboard'] as const)('binds prospective %s stage to actual Sol wire purpose, ordinary reserve, not legacy renaming',stage=>{
    const call:any={stage,instructions:'General synthetic source.',input:'Synthetic only.',maxOutputTokens:12000,schema:z.object({title:z.string()}).strict()};
    if(stage==='storyboard'){expect(trialApiRules('portrait_s0_storyboard')).toBeDefined();return;} // Actual storyboard wire exercised in sol-writing-transport.spec.ts.
    const wire=prepareSolWritingWire(call);expect(trialApiRules(`portrait_s0_${stage}`)?.reserve(wire)).toBeGreaterThanOrEqual(600000);
    expect(trialApiRules(`portrait_s1_${stage==='author'?'editor':'author'}`)?.reserve(wire)).toBeNull();
    expect(trialApiRules(`s0_${stage}`)).toBeUndefined();expect(trialApiRules(`portrait_s6_${stage}`)).toBeUndefined();
  });
  it('honestly imports actual Responses provenance/model/usage and admits it through the real storyboard source path',async()=>{
    const x=await fixture();expect(x.source.simpleSource.version).toBe(SOL_SIMPLE_SOURCE_VERSION);expect(x.source.accounting.model).toBe(SOL_WRITING.model);
    expect(x.source.accounting.providerCalls).toBe(2);expect(x.source.accounting.estimatedUsd).toBe(.044);
    expect(admitCurrentSimpleStorySource(x.f.request,x.source,options)).toEqual(x.source);
    expect(prepareCurrentPersonalStoryboard(x.f.request,x.source,options).planningInput.simpleSourceEvidence).toMatchObject({version:SOL_SIMPLE_SOURCE_VERSION});
    expect(()=>createCurrentSimpleStorySource(x.f.request,x.generated,x.records,options)).toThrow('receipt_invalid');
    const forged=structuredClone(x.source);forged.simpleSource.version='personal-simple-story-source/diagnostic-v1' as any;
    expect(()=>admitCurrentSimpleStorySource(x.f.request,forged,options)).toThrow('receipt_route');
  });
  it('refuses wrong raw model/tier/cost/output/response id and incomplete provider result, not cosmetically relabelled receipts',async()=>{
    const x=await fixture();
    for(const mutate of [(r:any)=>r.raw.model='claude-opus-5-5',(r:any)=>r.raw.service_tier='priority',(r:any)=>r.estimatedMicroUsd=0,
      (r:any)=>r.raw.status='incomplete',(r:any)=>r.metadata.responseId='different_response',(r:any)=>r.raw.output_text='{}']){
      const r=structuredClone(x.records.author);mutate(r);expect(()=>projectSimpleSolReceipt(x.calls[0],r)).toThrow();
    }
  });
  it('the real generic flow reaches visual planning after two Sol receipts and two bound source readings, with no CLI',async()=>{
    const x=await fixture(),stages:string[]=[];
    await expect(runSimpleWizardBook({request:x.f.request,options,seed:x.p.seed,signal:new AbortController().signal,writingModel:SOL_WRITING.model,reservedWritingUsd:2,
      opus:async call=>{stages.push(call.stage);return x.records[call.stage];},reader:async call=>{stages.push(call.stage);return{packetDigest:JSON.parse(call.input).packetDigest,summary:'Synthetic source reading only, not a literary PASS.',findings:[]};},
      visual:async call=>{stages.push(call.stage);throw Error('synthetic_stop_at_planner');},publish:()=>{}})).rejects.toThrow('personal_storyboard_author_failed');
    expect(stages).toEqual(['author','editor','final_review','comparison','storyboard']);
  });
  it('repairs once with the SAME Responses source lineage, retaining old records and aggregate accounting',async()=>{
    const x=await fixture(),before=JSON.stringify(x.source),packets=simpleStoryReadingPackets(x.f.request,x.source,options);
    const readings=[packets.final,packets.comparison].map((packet,i)=>{const n=causalSourceReviewPacket(packet),body:any=n.packet,u=i?body.revised.pages[0].units[0]:body.manuscript.pages[0].units[0];
      return compileCausalSourceReading(packet,{packetDigest:n.packetDigest,summary:'Synthetic supported binding only.',findings:i?[]:[{severity:'meaningful',kind:'issue',original:[],
        revised:[{startId:u.id,endId:u.id,anchor:citationTokens(u.text).slice(0,2).join(' ')}],criterion:'Synthetic causality concern.',explanation:'Synthetic reader uncertainty requiring one bound edit.'}]});});
    const ready=prepareSimpleStoryRepair(x.f.request,x.source,readings,options),output={...structuredClone(ready.priorEvidence.edited),editorChanges:ready.guidance.findings.map(f=>`${f.id} changed: Synthetic one edit.`)},
      repaired=createRepairedSimpleStorySource(x.f.request,x.source,readings,solRecord('editor',output,'resp_synthetic_repair'),options,2);
    expect(repaired.source.simpleSource.version).toBe(SOL_REPAIRED_SOURCE_VERSION);expect(repaired.source.accounting.providerCalls).toBe(3);
    expect(repaired.source.accounting.estimatedUsd).toBe(.066);expect(repaired.source.simpleSource.author).toEqual(x.source.simpleSource.author);
    expect(JSON.stringify(x.source)).toBe(before);expect(()=>prepareSimpleStoryRepair(x.f.request,repaired.source,readings,options)).toThrow();
  });
  it('carries exact v3 from new layout while old defaults remain v1 or absent',()=>{
    const p:any={seed:'synthetic-portrait-profile',child:{design:'Synthetic fictional child design used only for layout tests.'},childAnchor:'child-anchor-materiality/v1'};
    expect(trialStoryboardLayout(p,'text',true,portrait).readerFraming).toBe(portrait);
    expect(trialStoryboardLayout(p,'text',true).readerFraming).toBe('reader-safe-scene-framing/v1');expect(trialStoryboardLayout(p,'text',false).readerFraming).toBeUndefined();
  });
  it('uses exact review capacity pairs without changing instructions/refs/schema or durable metadata binding',async()=>{
    const b=await sharp({create:{width:20,height:30,channels:3,background:'white'}}).png().toBuffer(),a:any={candidate:{imageName:'test.png',imageSha:'a'.repeat(64)},candidateBytes:b,context:{},contextSha:'b'.repeat(64),refs:[],predecessor:null,kind:'sheet'};
    const old=await auditionJudgePayload(a),next=await auditionJudgePayload({...a,reviewCapacity:capV1});
    expect(old.max_output_tokens).toBe(12000);expect(old).not.toHaveProperty('metadata');expect(next.max_output_tokens).toBe(24000);
    expect({...next,max_output_tokens:12000,metadata:undefined}).toEqual({...old,metadata:undefined});
    expect(durableReviewPayload(next).metadata.review_capacity_version).toBe(capV1);expect(auditionReviewRule.reserve(next)).toBe(600000);
    for(const w of[{...next,metadata:undefined},{...old,metadata:{review_capacity_version:capV1}},{...next,max_output_tokens:24001}])expect(auditionReviewRule.reserve(w)).toBeNull();
    const raw={model:SOL_WRITING.model,service_tier:'default',status:'completed',output_text:'{}',usage:{input_tokens:1000,output_tokens:20000}};
    expect(auditionReviewRule.settle(next,{raw},true).coherent).toBe(true);expect(auditionReviewRule.settle(old,{raw},true).coherent).toBe(false);
    expect(()=>auditionReviewOutputCap('unknown' as any)).toThrow('audition_review_capacity');
  });
  it('stage and root meters retain conservative cache-write accounting and stop a new unknown before another callback',async()=>{
    const dir=folder(),m=new TrialApiMeter(dir,'portrait_s0_',true),call:any={stage:'author',instructions:'Synthetic',input:'Synthetic',maxOutputTokens:12000,schema:z.object({title:z.string()}).strict()},w=prepareSolWritingWire(call);
    let calls=0;await expect(m.run('author',w,w.reservedMicroUsd,async()=>{calls++;throw Error('unknown');})).rejects.toThrow('unknown');
    expect(new TrialApiMeter(dir,'',true).snapshot().unknownCost).toBe(1);expect((m.snapshot() as any).pendingCacheWriteReserveMicroUsd).toBeGreaterThan(0);
    await expect(m.run('editor',w,w.reservedMicroUsd,async()=>{calls++;throw Error('must not run');})).rejects.toThrow();expect(calls).toBe(1);
    expect(existsSync(path.join(dir,'portrait_s0_editor.claim.json'))).toBe(false);
  });
});
