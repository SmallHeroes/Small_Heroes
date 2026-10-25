import { describe,it,expect } from 'vitest';
import { prepareSimpleStory,simpleAuthorCall,simpleEditorCall,pickStoryShape,SIMPLE_STORY_SHAPES,writeSimpleStory,type SimpleStoryCall } from '../simple-story-engine';
import { resolvePersonalWizardOptions } from '../options';
import { SIMPLE_CHILD_SHAPE_EXPERIENCE,SIMPLE_CHILD_SHAPE_VERSION,SIMPLE_CHILD_EXPERIENCE,SIMPLE_CHILD_VERSION,type SimpleStoryExperience } from '../simple-story-experience';
import { resolveChildStoryShape } from '../simple-story-shape-policy';
import { createSolWritingTransport,prepareSolWritingWire,SOL_WRITING } from '../../../scripts/personal-sol-writing-transport';
import { createCurrentSimpleStorySource,admitCurrentSimpleStorySource,simpleStoryReadingPackets,projectSimpleSolReceipt,prepareSimpleStoryRepair,createRepairedSimpleStorySource } from '../simple-story-source';
import { causalSourceReviewPacket,compileCausalSourceReading } from '../story-causal-experiment';
import { citationTokens } from '../story-source-citations';
const options=resolvePersonalWizardOptions();
const request=(age:number)=>({kind:'personal_book_request',version:'reviewed-personal-book-request/v3',draftId:'d_shapeage20261025',draftRevision:1,
 child:{name:'תמר',age,address:'girl',residence:'עיר הדמיון',nameSource:'typed',ageSource:'typed',addressSource:'typed',residenceSource:'typed'},
 facts:[{id:'f_shapeage20261025',kind:'interest',value:'לצייר',source:'typed'}],noDifficulty:true,storyPlace:null,
 companion:{id:'dragon_dini'},intent:{kind:'just_for_fun'},avoid:[],appearance:{photo:'none'},bookOptions:{lengthId:'short',voiceId:null}});
const selected=(age:number,id:string)=>{
 const req=request(age),requestId=prepareSimpleStory(req,options).accepted.requestId;
 for(let i=0;i<10000;i++){const seed=`shape-age-${age}-${i}`;if(pickStoryShape(requestId,seed).id===id)return seed;}
 throw Error('bounded_seed');
};
function output(call:SimpleStoryCall){
 const book=JSON.parse(call.input).book;
 const value={title:'תמר ודיני משחקות',pages:Array.from({length:8},()=>({text:`תמר ודיני רצו לצייר ולשחק. ${'הציור נשאר על השולחן ליד הכיסא והן הסתכלו בו וצחקו יחד. '.repeat(5)}`})),
  childGoal:'תמר רוצה לשחק',companionWant:'דיני רוצה לצייר',comicPromise:'משחק משותף',ending:'הן ממשיכות לשחק',
  pageMap:Array.from({length:8},(_,i)=>({location:'חצר דמיונית',transitionReason:'המשחק נמשך',childAction:'תמר מציירת',
   companionAction:'דיני משחקת',consequence:'המשחק נמשך',continuity:'הציור על השולחן',factIds:i?[]:['f_shapeage20261025']})),
  resilienceMoments:[{page:4,childChoice:'תמר בוחרת לשחק',whatHelps:'הציור משותף'}],
  writingContractVersion:book.storyExperience===SIMPLE_CHILD_SHAPE_EXPERIENCE?SIMPLE_CHILD_SHAPE_VERSION:SIMPLE_CHILD_VERSION};
 return call.stage==='editor'?{...value,editorChanges:['Synthetic wiring, not a literary example.']}:value;
}
let seq=0;
async function receipt(call:SimpleStoryCall,value:any=output(call)){
 const raw={id:`resp_shape_synthetic_${seq++}`,model:SOL_WRITING.model,status:'completed',service_tier:'default',
  output_text:JSON.stringify(value),usage:{input_tokens:100,output_tokens:100},
  output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}]};
 return createSolWritingTransport({key:()=> 'SYNTHETIC-NOT-A-REAL-KEY',fetch:async()=>new Response(JSON.stringify(raw),
  {status:200,headers:{'content-type':'application/json'}})})(prepareSolWritingWire(call),call,new AbortController().signal);
}
async function fixture(age=4,experience:SimpleStoryExperience=SIMPLE_CHILD_SHAPE_EXPERIENCE){
 const req=request(age),p=prepareSimpleStory(req,options,selected(age,'something_missing'),experience),records:Record<string,any>={};
 const generated=await writeSimpleStory(p,async call=>{const r=await receipt(call);records[call.stage]=r;
  return{output:r.output,usage:r.usage!,estimatedUsd:r.estimatedMicroUsd!/1e6};},{model:SOL_WRITING.model,reservedUsd:1.2});
 return{req,p,records,generated,source:createCurrentSimpleStorySource(req,generated,records as any,options,SOL_WRITING.model)};
}
function reading(packet:any,material=false){
 const n=causalSourceReviewPacket(packet),body:any=n.packet,unit=body.manuscript?.pages[0].units[0];
 return{packetDigest:n.packetDigest,summary:'Synthetic wiring only, not product acceptance.',findings:material?[{
  severity:'meaningful',kind:'issue',criterion:'Synthetic age concern',explanation:'Synthetic effect for binding test.',original:[],
  revised:[{startId:unit.id,endId:unit.id,anchor:citationTokens(unit.text).slice(0,2).join(' ')}]}]:[]};
}

describe('general shape-age contract, not literary proof',()=>{
 it.each([4,8])('assembles an explicitly new policy for age%s instead of the old conflicting spine',age=>{
  const p=prepareSimpleStory(request(age),options,'shape-age',SIMPLE_CHILD_SHAPE_EXPERIENCE);
  expect(p.version).toBe(SIMPLE_CHILD_SHAPE_VERSION);
  const resolution=resolveChildStoryShape(p.shape.id,age);
  expect(p.book.storyShapeResolution).toEqual(resolution);
  for(const call of [simpleAuthorCall(p),simpleEditorCall(p,{pages:[]} as any,[])]){
   expect(JSON.parse(call.input).book.storyShapeResolution).toEqual(resolution);
  }
 });
 it.each(SIMPLE_STORY_SHAPES.flatMap(s=>[3,4,5,6,7,8].map(age=>({id:s.id,age}))))('resolves $id for exact age$age through both real builders',({id,age})=>{
  const p=prepareSimpleStory(request(age),options,selected(age,id),SIMPLE_CHILD_SHAPE_EXPERIENCE),resolution=resolveChildStoryShape(id,age);
  expect(p.shape.id).toBe(id);expect(p.book.storyShapeResolution).toEqual(resolution);
  expect(p.book.storyShape).toBe(`${resolution.premise} ${resolution.interpretation}`);
  expect(p.book.storyShape).not.toBe(p.shape.spine);
  for(const call of [simpleAuthorCall(p),simpleEditorCall(p,output(simpleAuthorCall(p)) as any,[])]){
   const b=JSON.parse(call.input).book;expect(b.storyShapeResolution).toEqual(resolution);expect(b.childStoryProfile.age).toBe(age);
   expect((call.schema as any).shape.writingContractVersion.safeParse(SIMPLE_CHILD_SHAPE_VERSION).success).toBe(true);
  }
 });
 it('keeps mystery discovery possible without making young listeners infer an unspoken motive',()=>{
  const young=resolveChildStoryShape('something_missing',4),older=resolveChildStoryShape('something_missing',8);
  expect(young.premise).toBe(older.premise);expect(young.interpretation).toContain('show it concretely');
  expect(older.interpretation).toContain('reward inference');expect(young.interpretation).not.toBe(older.interpretation);
 });
 it.each(['missing','constructor','__proto__'])('rejects unknown shape%s instead of an implicit fallback',id=>{
  expect(()=>resolveChildStoryShape(id as any,4)).toThrow('story_shape_id');
 });
 it.each([2,9,4.5])('does not extend or clamp unsupported age%s',age=>{
  expect(()=>resolveChildStoryShape('the_chase',age)).toThrow();
  expect(()=>prepareSimpleStory(request(age),options,'shape-age',SIMPLE_CHILD_SHAPE_EXPERIENCE)).toThrow();
 });
 it.each(['shape-text','resolution','id','brief-age','co-age'])('rejects%s drift before both writer calls',kind=>{
  const p=structuredClone(prepareSimpleStory(request(4),options,'shape-age',SIMPLE_CHILD_SHAPE_EXPERIENCE));
  const draft=output(simpleAuthorCall(p));
  if(kind==='shape-text')p.book.storyShape+=' unrelated';
  if(kind==='resolution')p.book.storyShapeResolution!.premise='unrelated';
  if(kind==='id')(p.shape as any).id=p.shape.id==='the_chase'?'great_mixup':'the_chase';
  if(kind==='brief-age')p.brief.child.age=8;
  if(kind==='co-age'){p.book.child.age=8;p.brief.child.age=8;p.book.childStoryProfile={...p.book.childStoryProfile!,age:8};}
  for(const build of [()=>simpleAuthorCall(p),()=>simpleEditorCall(p,draft as any,[])])expect(build).toThrow(/story_(shape|child)_/);
 });
 it.each([3,4,5,6,7,8])('admits v3source and binds all numbered review packets at age%s',async age=>{
  const f=await fixture(age);expect(admitCurrentSimpleStorySource(f.req,f.source,options)).toEqual(f.source);
  expect(f.generated.evidence.source.engineVersion).toBe(SIMPLE_CHILD_SHAPE_VERSION);
  for(const packet of Object.values(simpleStoryReadingPackets(f.req,f.source,options))){
   expect(packet.brief.childStoryProfile!.age).toBe(age);expect(packet.instructions).toContain('Child-first/v3:');
   expect((causalSourceReviewPacket(packet).packet as any).brief.childStoryProfile.age).toBe(age);
  }
 });
 it('does not relabel actual v2writer raw or parsed-only decorations as v3',async()=>{
  const old=await fixture(4,SIMPLE_CHILD_EXPERIENCE),next=prepareSimpleStory(old.req,options,old.p.seed,SIMPLE_CHILD_SHAPE_EXPERIENCE);
  const author=simpleAuthorCall(next),editor=simpleEditorCall(next,output(author) as any,[]);
  for(const call of [author,editor]){
   expect(()=>projectSimpleSolReceipt(call,old.records[call.stage])).toThrow();
   const decorated={...old.records[call.stage],output:{...old.records[call.stage].output,writingContractVersion:SIMPLE_CHILD_SHAPE_VERSION}};
   expect(()=>projectSimpleSolReceipt(call,decorated)).toThrow();
  }
 });
 it('inherits the exact v3shape and age through one bounded existing repair',async()=>{
  const f=await fixture(),packets=simpleStoryReadingPackets(f.req,f.source,options);
  const reads=[compileCausalSourceReading(packets.final,reading(packets.final,true)),compileCausalSourceReading(packets.comparison,reading(packets.comparison))];
  const ready=prepareSimpleStoryRepair(f.req,f.source,reads,options),data=JSON.parse(ready.call.input),value:any=output(ready.call);
  expect(data.book.storyShapeResolution).toEqual(f.p.book.storyShapeResolution);
  value.editorChanges=data.readerObservations.findings.map((x:any)=>`${x.id} kept: synthetic observation not a product judgment.`);
  const repaired=createRepairedSimpleStorySource(f.req,f.source,reads,await receipt(ready.call,value),options,.6);
  expect(repaired.generated.evidence.source.engineVersion).toBe(SIMPLE_CHILD_SHAPE_VERSION);
  expect(()=>prepareSimpleStoryRepair(f.req,repaired.source,reads,options)).toThrow();
 });
});
