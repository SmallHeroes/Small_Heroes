import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {canonicalHash} from '@/lib/canonical-json';
import {previewQualityContextSha,QUALITY_CATEGORIES} from '@/lib/local-preview-quality';
import {assessComparisonPair,comparisonSchedule,selectComparisonModel,comparisonCarry,COMPARISON_MODELS,PAIR_SCALE_CHECK,type ComparisonPairBinding} from '../image-comparison';
import {claimComparison,comparisonMasterFile,verifyComparisonGo,verifyComparisonReady,type ComparisonEnvelope} from '../image-comparison-journal';
import {LocalEngineTrialRuntime} from '../local-trial-runtime';
import {engineOrderAuthoritySchema} from '../contract';
import {runImageComparison,type ComparisonBundle} from '../image-comparison-runner';
import {prepareComparisonImage} from '../image-comparison-provider';
const host=vi.hoisted(()=>({root:''}));
vi.mock('@/lib/personal-wizard/native-page-proof-authority-host',()=>({get NATIVE_PAGE_PROOF_AUTHORITY_ROOT(){return host.root;}}));
const roots:string[]=[],H=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex'),S=(x:string)=>x.repeat(64),ids=['identity','anatomy',PAIR_SCALE_CHECK,'source_state'];
const measured=(ratio=.7)=>({comparable:true,reason:'same_plane_standing',estimatedRatio:ratio});
const abstain=(reason='airborne')=>({comparable:false,reason,estimatedRatio:null});
const scale={version:'companion-scale/v1' as const,companionId:'synthetic_companion',scale:{standingHeightInChildHeights:{min:.6,max:.75}}};
function temp(){const r=mkdtempSync(path.join(realpathSync(tmpdir()),'sh_comparison_'));roots.push(r);host.root=path.join(r,'authority');mkdirSync(host.root);return r;}
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(realpathSync(r))!==realpathSync(tmpdir())||!path.basename(r).startsWith('sh_comparison_'))throw Error('owned_temp_only');rmSync(r,{recursive:true,force:true});}});
function binding():ComparisonPairBinding{return{sourceDigest:S('a'),storyboardDigest:S('b'),canonicalReferenceShas:['c','d','e','f'].map(S),checkIds:ids,scaleAuthority:scale,
 frames:[{pageNumber:0,candidateSha:S('1'),contextSha:S('2'),supported:true,scaleEvidence:measured(),applicableChecks:ids},{pageNumber:7,candidateSha:S('3'),contextSha:S('4'),supported:true,scaleEvidence:abstain(),applicableChecks:ids}]};}
function pair(b= binding()){return{version:'image-comparison-pair/v2',sourceDigest:b.sourceDigest,storyboardDigest:b.storyboardDigest,candidateShas:b.frames.map(f=>f.candidateSha),contextShas:b.frames.map(f=>f.contextSha),canonicalReferenceShas:[...b.canonicalReferenceShas],
 checks:b.checkIds.map(id=>({id,frames:b.frames.map(f=>({pageNumber:f.pageNumber,verdict:id===PAIR_SCALE_CHECK&&!(f.scaleEvidence as any).comparable||id!==PAIR_SCALE_CHECK&&!f.applicableChecks.includes(id)?'not_applicable':'pass',observation:'Synthetic frame-specific observation.'})),reason:'Synthetic test, no pixel judgement.'}))};}
describe('M33 pair evidence cannot replace or overstate a native frame judgement',()=>{
 it('F1 valid cover plus action-frame scale N/A supports the pair',()=>{const b=binding();expect(assessComparisonPair(pair(b),b)).toMatchObject({supported:true,scaleCoverage:'observed_within_range'});});
 it.each(['airborne','not_standing','occluded','different_depth'])('F1 %s abstains only on that frame',reason=>{const b=binding();b.frames[1].scaleEvidence=abstain(reason);expect(assessComparisonPair(pair(b),b).supported).toBe(true);});
 it('optional source check can be N/A on one bound frame, never both',()=>{const b=binding();b.frames[0].applicableChecks=ids.filter(x=>x!=='source_state');expect(assessComparisonPair(pair(b),b).supported).toBe(true);b.frames[1].applicableChecks=ids.filter(x=>x!=='source_state');expect(assessComparisonPair(pair(b),b).supported).toBe(false);});
 it('pair PASS cannot provide the missing standing measurement',()=>{const b=binding();b.frames[0].scaleEvidence=abstain();const r=pair(b);for(const f of r.checks.find(c=>c.id===PAIR_SCALE_CHECK)!.frames)f.verdict='pass';expect(assessComparisonPair(r,b)).toMatchObject({supported:false,scaleCoverage:'unverified'});});
 it.each([.59,.76])('native measured ratio%s cannot be waived by pair N/A or PASS',ratio=>{const b=binding();b.frames[0].scaleEvidence=measured(ratio);const r=pair(b);expect(assessComparisonPair(r,b).supported).toBe(false);r.checks.find(c=>c.id===PAIR_SCALE_CHECK)!.frames[0].verdict='not_applicable';expect(assessComparisonPair(r,b).supported).toBe(false);});
 it.each(['identity','anatomy'])('required%s cannot be labelled N/A',id=>{const b=binding(),r=pair(b);r.checks.find(c=>c.id===id)!.frames[0].verdict='not_applicable';expect(assessComparisonPair(r,b).supported).toBe(false);});
 it('native HOLD remains held despite a perfect pair report',()=>{const b=binding();b.frames[1].supported=false;expect(assessComparisonPair(pair(b),b).supported).toBe(false);});
 it.each(['sourceDigest','storyboardDigest'])('refuses%s drift',key=>{const b=binding(),r:any=pair(b);r[key]=S('9');expect(()=>assessComparisonPair(r,b)).toThrow('comparison_pair_binding');});
 it('refuses candidate, context, reference reordering, duplicate or absent checks',()=>{for(const change of [(r:any)=>r.candidateShas.reverse(),(r:any)=>r.contextShas.reverse(),(r:any)=>r.canonicalReferenceShas.reverse(),(r:any)=>r.checks[1]=r.checks[0],(r:any)=>r.checks.pop()]){const b=binding(),r=pair(b);change(r);expect(()=>assessComparisonPair(r,b)).toThrow();}});
 it('per-frame verdicts cannot be swapped to another page',()=>{const b=binding(),r=pair(b);r.checks[0].frames.reverse();expect(()=>assessComparisonPair(r,b)).toThrow('comparison_pair_frame_binding');});
 it('a malformed native abstention with an invented ratio refuses',()=>{const b=binding();b.frames[1].scaleEvidence={...abstain(),estimatedRatio:.7};expect(()=>assessComparisonPair(pair(b),b)).toThrow();});
 it('two measurements at the inclusive bounds pass',()=>{const b=binding();b.frames[0].scaleEvidence=measured(.6);b.frames[1].scaleEvidence=measured(.75);expect(assessComparisonPair(pair(b),b).supported).toBe(true);});
 it.each(['defect','uncertain'])('applicable pair%s adds HOLD',verdict=>{const b=binding(),r=pair(b);r.checks[0].frames[0].verdict=verdict;expect(assessComparisonPair(r,b).supported).toBe(false);});
});
describe('comparison scope and original campaign carry',()=>{
 it('fixed14 steps, four images balanced across same two pages, no retry slots',()=>{const s=comparisonSchedule([0,7]);expect(s).toHaveLength(14);expect(s.filter(s=>s.kind==='image').map(s=>[s.cell,s.model,s.pageNumber])).toEqual([['C01',COMPARISON_MODELS[0],0],['C02',COMPARISON_MODELS[1],0],['C03',COMPARISON_MODELS[1],7],['C04',COMPARISON_MODELS[0],7]]);expect(s.reduce((n,s)=>n+s.maximumMicroUsd,0)).toBe(8903616);});
 it.each([[],[0],[7,0],[0,0],[0,9],[0,1,2]].map(pages=>[pages]))('rejects invalid pages%j',pages=>expect(()=>comparisonSchedule(pages)).toThrow('comparison_pages'));
 it('known spend is deducted from SAME10M/121, not reset',()=>expect(comparisonCarry({knownEstimateMicroUsd:940000,accountedMicroUsd:940000,logicalCalls:14,pendingCalls:0,unknownCalls:0,blocked:false})).toMatchObject({remainingBookMicroUsd:9060000,remainingBookCalls:107,grantAuthority:false}));
 it.each([{pendingCalls:1},{unknownCalls:1},{blocked:true},{accountedMicroUsd:1000000}])('unsettled cannot fund a new book%j',change=>expect(()=>comparisonCarry({knownEstimateMicroUsd:940000,accountedMicroUsd:940000,logicalCalls:14,pendingCalls:0,unknownCalls:0,blocked:false,...change})).toThrow('comparison_unsettled'));
 it('unknown second model never permits a winner',()=>{const rows=COMPARISON_MODELS.map(model=>({model,supported:true,settled:true,knownMicroUsd:1000,imageLatencyMs:1000}));rows[1].settled=false;expect(selectComparisonModel(rows)).toBeNull();});
 it('quality before price, then >10% cost, >10% latency and declared tie',()=>{const rows=COMPARISON_MODELS.map(model=>({model,supported:true,settled:true,knownMicroUsd:1000,imageLatencyMs:1000}));rows[1].knownMicroUsd=100;rows[1].supported=false;expect(selectComparisonModel(rows)).toBe(COMPARISON_MODELS[0]);rows[1].supported=true;expect(selectComparisonModel(rows)).toBe(COMPARISON_MODELS[1]);rows[1].knownMicroUsd=1000;rows[1].imageLatencyMs=100;expect(selectComparisonModel(rows)).toBe(COMPARISON_MODELS[1]);rows[1].imageLatencyMs=1000;expect(selectComparisonModel(rows)).toBe(COMPARISON_MODELS[0]);});
});
function authority(){return engineOrderAuthoritySchema.parse({version:'engine-site/v1',orderId:'synthetic_comparison',requestSha256:S('a'),optionsSha256:S('b'),offer:{id:'synthetic',revisionSha256:S('c')},engine:'native-cde-book/v1',sourceRevision:'a'.repeat(40),policySha256:S('d'),purpose:'test',imageQuality:'low',narrativePages:8,entitlements:{narration:false,pdf:false},budget:{maximumMicroUsd:2500000,maximumCalls:14,approvalReference:'synthetic',approvedBy:'SYNTHETIC',approvedAt:'2026-11-09T00:00:00.000Z',steps:comparisonSchedule([0,7]).map(s=>({id:s.id,maximumMicroUsd:s.maximumMicroUsd}))}});}
async function fixture(options:{unknownAt?:number;wrongModel?:boolean;omitModel?:boolean;changeAfterCall?:()=>void;held?:boolean;imageCostAtFullReserve?:boolean}={}){
 const root=temp(),png=await sharp({create:{width:1024,height:1536,channels:4,background:'#123456'}}).png().toBuffer(),a=authority(),references=Array.from({length:4},()=>({sha256:H(png),bytes:Buffer.from(png)}));
 const frames=[0,7].map(pageNumber=>{const context={version:'audition-page-context/v2',packet:{syntheticPage:pageNumber},references:references.map((r,i)=>({imageName:'canonical_'+i+'.png',imageSha:r.sha256})),requirementIds:['companion_scale','synthetic_identity'],checks:{uniqueLandmarks:[],castIdentity:[]},companionScale:scale};return{pageNumber,prompt:options.imageCostAtFullReserve?'x'.repeat(96000):'SYNTHETIC provider-denied frame '+pageNumber,context,contextSha:previewQualityContextSha(context),applicableChecks:ids};});
 const bundle:ComparisonBundle={sourceDigest:S('a'),storyboardDigest:S('b'),references,frames,checkIds:ids,pairInstruction:'SYNTHETIC NOT LIVE',sourceFrames:[{synthetic:true}],bundleSha256:S('c')};
 const g={ownerAuthority:{sha256:S('9')},outputDirectory:path.join(root,'output')} as ComparisonEnvelope;
 const execution=claimComparison(g,S('8'),a);let calls=0;const observed:any[]=[];
 const fetch=vi.fn(async(url:any,init:any)=>{calls++;if(options.unknownAt===calls)throw Error('SYNTHETIC_CONNECTION_LOST');observed.push({url:String(url),body:init.body});
  let raw:any;
  if(String(url).endsWith('/images/edits')){
   const form=init.body as FormData,model=String(form.get('model'));
   raw={data:[{b64_json:png.toString('base64')}],...(options.omitModel?{}:{model:options.wrongModel?'different_model':model}),
    usage:options.imageCostAtFullReserve?{input_tokens:128768,output_tokens:8192,total_tokens:136960}:{input_tokens:100,output_tokens:30,total_tokens:130}};
  }else if(String(url).endsWith('/chat/completions'))raw={model:'gpt-4o',usage:{prompt_tokens:100,completion_tokens:50},choices:[{message:{content:JSON.stringify({referenceChildVisible:true,candidateChildVisible:true,candidateChildCount:1,comparisonUsable:true,sameChildDecision:'same',faceStructure:'match',eyesBrows:'match',noseMouth:'match',hairIdentity:'match',distinctiveFeatures:'match'})}}]};
  else{
   const body=JSON.parse(init.body),text=JSON.parse(body.input[0].content[0].text);let output:any;
   if(body.text.format.name==='image_comparison_pair_v2')output={version:'image-comparison-pair/v2',sourceDigest:text.sourceDigest,storyboardDigest:text.storyboardDigest,candidateShas:text.candidateShas,contextShas:text.contextShas,canonicalReferenceShas:text.canonicalReferenceShas,
    checks:text.checkIds.map((id:string)=>({id,frames:text.frames.map((f:any)=>({pageNumber:f.pageNumber,verdict:id===PAIR_SCALE_CHECK&&!f.scaleEvidence.comparable?'not_applicable':'pass',observation:'SYNTHETIC only'})),reason:'SYNTHETIC only'}))};
   else{const frame=frames.find(f=>f.contextSha===text.contextSha)!;output={candidateSha:text.candidateSha,contextSha:text.contextSha,checks:QUALITY_CATEGORIES.map(category=>({category,verdict:options.held&&category==='identity'?'defect':'pass',observation:'SYNTHETIC only',correction:options.held&&category==='identity'?'Restore synthetic identity.':'',issues:options.held&&category==='identity'?[{impact:'identity',requirement:'synthetic_identity',note:'Synthetic held identity.'}]:[]})),
    landmarkInventory:{objects:[],landmarks:[]},scaleEvidence:frame.pageNumber===0?measured():abstain()};}
   raw={id:'resp_synthetic_'+calls,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:100,output_tokens:50},output_text:JSON.stringify(output)};
  }
  options.changeAfterCall?.();return new Response(JSON.stringify(raw),{status:200,headers:{'x-request-id':'synthetic-'+calls}});
 });
 const runtime=new LocalEngineTrialRuntime({root:path.join(root,'journal'),authority:a,ownerId:'synthetic',draftId:'synthetic',snapshotSha256:bundle.bundleSha256,assertCurrent:execution.check,dispatchWitness:execution.witness});
 const ports={fetch:fetch as typeof globalThis.fetch,openAIKey:()=> 'SYNTHETIC_NOT_A_KEY',anthropicKey:()=>{throw Error('DENIED');}},saved=new Map<string,Buffer>();
 return{root,png,a,bundle,execution,runtime,ports,observed,saved,calls:()=>calls,run:()=>runImageComparison(runtime,bundle,ports,{assertCurrent:execution.check,saveImage:(cell,b)=>saved.set(cell,b)})};
}
describe('real diagnostic recipe, transport planners and durable journal with fake HTTP only',()=>{
 it('completes14 real runtime calls, four identical paired edit inputs, native assessments and honest scale abstention',async()=>{
  const f=await fixture(),r=await f.run();expect(r.complete).toBe(true);expect(r.bookCreated).toBe(false);expect(f.calls()).toBe(14);expect(f.saved.size).toBe(4);expect(r.winner).not.toBeNull();
  const image=f.observed.filter(x=>x.url.endsWith('/images/edits')).map(x=>x.body as FormData);
  expect(image.map(f=>f.get('model'))).toEqual([COMPARISON_MODELS[0],COMPARISON_MODELS[1],COMPARISON_MODELS[1],COMPARISON_MODELS[0]]);
  for(const [a,b]of [[image[0],image[1]],[image[2],image[3]]]){for(const key of ['prompt','quality','size','output_format','complexity','n'])expect(a.get(key)).toEqual(b.get(key));for(let i=0;i<4;i++)expect(Buffer.from(await(a.getAll('image[]')[i] as Blob).arrayBuffer())).toEqual(Buffer.from(await(b.getAll('image[]')[i] as Blob).arrayBuffer()));}
  expect((await f.runtime.meter()).logicalCalls).toBe(14);
 });
 it('known visual HOLD still completes the fixed diagnostic matrix, cannot select a model',async()=>{const f=await fixture({held:true}),r=await f.run();expect(f.calls()).toBe(14);expect(r.winner).toBeNull();expect(r.scores.every(s=>!s.supported)).toBe(true);});
 it('full conditional image cost refuses the next full image reserve before sending',async()=>{const f=await fixture({imageCostAtFullReserve:true});await expect(f.run()).rejects.toThrow('local_trial_budget_or_unknown');expect(f.calls()).toBe(3);expect(await f.runtime.meter()).toMatchObject({logicalCalls:3,pendingCalls:0,knownEstimateMicroUsd:1277354});});
 it('lost review keeps FULL600000 and refuses every repeat POST',async()=>{const f=await fixture({unknownAt:2});await expect(f.run()).rejects.toThrow('SYNTHETIC_CONNECTION_LOST');expect(await f.runtime.meter()).toMatchObject({pendingCalls:1,accountedMicroUsd:601700,logicalCalls:2});await expect(f.run()).rejects.toThrow();expect(f.calls()).toBe(2);expect(()=>claimComparison({ownerAuthority:{sha256:S('9')},outputDirectory:path.join(f.root,'copied-output')}as ComparisonEnvelope,S('6'),f.a)).toThrow('comparison_consent_consumed');});
 it('an explicit wrong response model becomes UNKNOWN and never gets quality checks',async()=>{const f=await fixture({wrongModel:true});await expect(f.run()).rejects.toThrow('local_trial_settled_hold');expect(f.calls()).toBe(1);expect(await f.runtime.meter()).toMatchObject({unknownCalls:1,accountedMicroUsd:1275904,logicalCalls:1});});
 it('optional model absence is recorded as request-only, never fabricated as provider attestation',async()=>{const f=await fixture({omitModel:true}),r=await f.run();expect(r.imageRecords[0]).toMatchObject({reportedModel:null,requestedModel:COMPARISON_MODELS[0]});const v=await f.runtime.result('C01_image');expect(v.model).toBeUndefined();expect((v.output as any).modelEvidence).toBe('request_bound_only');});
 it('candidate input mutation during await is stopped after receipt settlement, before a second call',async()=>{const f=await fixture();const fetch=f.ports.fetch;f.ports.fetch=async(...args)=>{const r=await fetch(...args);f.bundle.references[0].bytes[0]^=1;return r;};await expect(f.run()).rejects.toThrow('comparison_bundle_changed');expect(f.calls()).toBe(1);expect(await f.runtime.meter()).toMatchObject({logicalCalls:1,pendingCalls:0,knownEstimateMicroUsd:1700});});
 it('deleting a dispatched local journal cannot reset the consent-global full reservation',async()=>{const f=await fixture({unknownAt:1});await expect(f.run()).rejects.toThrow();const call=path.join(f.root,'journal/calls/C01_image');expect(path.resolve(call).startsWith(path.resolve(f.root)+path.sep)).toBe(true);rmSync(call,{recursive:true});expect(await f.runtime.meter()).toMatchObject({pendingCalls:1,lostLocalCalls:1,accountedMicroUsd:1275904});});
 it('after-await model mutation in the caller cannot retarget the immutable request',async()=>{const f=await fixture(),input={model:COMPARISON_MODELS[0],prompt:'SYNTHETIC',references:f.bundle.references.map(r=>r.bytes)};const plan=prepareComparisonImage(f.a,'C01_image',input,f.ports),old=f.ports.fetch;f.ports.fetch=async(...args)=>{const r=await old(...args);input.model=COMPARISON_MODELS[1] as typeof COMPARISON_MODELS[0];return r;};const r=await f.runtime.call(plan);expect((r.output as any).requestedModel).toBe(COMPARISON_MODELS[0]);});
});
