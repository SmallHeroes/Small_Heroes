import {beforeAll,describe,expect,it} from 'vitest';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {personalStoryboardFixture} from './personal-storyboard-fixture';
import {runSimpleWizardBook} from '../simple-book-flow';
import {runSimpleStoryboardDiagnostic} from '../simple-storyboard-diagnostic';
import {prepareSimpleStory} from '../simple-story-engine';
import {admitReviewedStoryboardBundle,loadReviewedStoryboard,reviewedBookLayoutSchema} from '../../../scripts/personal-simple-book-reviewed-audition';
import {assertSolBundleCheckpoint,READER_SAFE_BOOK_TRIAL,SOL_RECEIPT_RECOVERY} from '../../../scripts/personal-book-e2e-trial';

const seed='complete-bundle-synthetic-fixture',copy=<T>(v:T):T=>structuredClone(v);
async function fixture(){
 const f=await personalStoryboardFixture(),p=f.result.plan,plan=copy(f.draft) as any;
 delete plan.plan.wardrobe;plan.plan.actorAppearance={child:{role:'child',clothing:['red shirt','blue shorts','teal shoes']},companion:{role:'companion',authority:'companionVisualAuthority'}};
 const story={title:p.title,childGoal:p.childGoal,companionWant:p.companionWant,comicPromise:p.comicPromise,ending:p.ending,
  pages:f.result.manuscript.pages.map(x=>({text:x.text+' נועה ודיני משחקות בציור.'})),pageMap:p.beats.map(({pageNumber:_n,...b})=>b),
  resilienceMoments:p.resilience.moments.map(({pageNumber,...b})=>({page:pageNumber,...b}))};
 const opus=async(call:any)=>{const output=call.stage==='author'?story:{...story,editorChanges:['Synthetic bundle wiring only.']},usage={inputTokens:100,outputTokens:100},termination={code:0,signal:null};
  return{output,usage,estimatedMicroUsd:100000,metadata:{kind:'cli_reported_estimate_not_invoice',reportedModels:['claude-opus-5-5'],termination},
   raw:{termination,killConfirmed:true,stopped:false,stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,
    session_id:call.stage==='author'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',total_cost_usd:.1,modelUsage:{'claude-opus-5-5':usage},structured_output:output})}};};
 const visual=async(call:any)=>copy(call.stage==='storyboard'?plan:{...f.review,sourceDigest:call.context.sourceDigest,storyboardDigest:call.context.storyboardDigest});
 const original=await runSimpleWizardBook({request:f.request,options:f.current.options,seed,signal:new AbortController().signal,opus,
  reader:async(call:any)=>({packetDigest:JSON.parse(call.input).packetDigest,summary:'Synthetic complete reading only.',findings:[]}),visual,publish:()=>{},reservedWritingUsd:2,actorOwnedAppearance:true});
 if(!original.storyboard)throw Error('synthetic fixture failed');
 const held:any=copy(original.storyboard.rawReview);held.frames[1].checks[0].verdict='uncertain';
 const repair={parentStoryboardDigest:original.storyboard.storyboard!.storyboardDigest,draft:plan,review:held};
 const board=await runSimpleStoryboardDiagnostic({request:f.request,writerResult:original.source,options:f.current.options,signal:new AbortController().signal,
  actorOwnedAppearance:true,repair,generate:visual});
 const prepared=prepareSimpleStory(f.request,f.current.options,seed),queued={version:'local-simple-wizard-request/v1',requestId:prepared.accepted.requestId,
  optionsFingerprint:prepared.accepted.optionsFingerprint,request:prepared.accepted.canonical},layout=reviewedBookLayoutSchema.parse({version:'reviewed-book-layout/v1',
  seed,childDesign:'A generic fictional child design for a provider-free structural test.',storyboardDir:'story',childDir:'child',childImage:'reference_child.png',savedCompanion:null});
 return{layout,original:{queued,result:original,draft:plan},repaired:{queued,result:{...original,status:board.status,storyboard:board},draft:plan,repair}};
}
describe('one shared complete storyboard bundle admission,not a second QA engine',()=>{
 let f:Awaited<ReturnType<typeof fixture>>;
 beforeAll(async()=>{f=await fixture();});
 it('retains unrepaired legacy admission and accepts the complete repaired bundle without altering any input',()=>{
  const before=JSON.stringify(f),old=admitReviewedStoryboardBundle(f.original,process.cwd(),f.layout),next=admitReviewedStoryboardBundle(f.repaired,process.cwd(),f.layout);
  expect(old.result.status).toBe('review_supported');expect(next.result.status).toBe('review_supported');
  expect(next.result.storyboard.framePackets).toHaveLength(9);expect(next.book.repair).toBeDefined();expect(JSON.stringify(f)).toBe(before);
 });
 it('reproduces the actual missing-repair integration defect rather than weakening the filesystem gate',()=>{
  const b=copy(f.repaired);delete (b as any).repair;expect(()=>admitReviewedStoryboardBundle(b,process.cwd(),f.layout)).toThrow('audition_repair_binding');
  expect(()=>admitReviewedStoryboardBundle({...f.original,repair:f.repaired.repair},process.cwd(),f.layout)).toThrow('audition_repair_binding');
 });
 it.each(['repair','draft','review','request','frame','uncertain'])('refuses changed %s before a consumer/provider is created',kind=>{
  const b:any=copy(f.repaired);
  if(kind==='repair')b.repair.draft.plan.visualLanguage+='changed';
  if(kind==='draft')b.draft.plan.visualLanguage+='changed';
  if(kind==='review')b.result.storyboard.rawReview.sourceDigest='f'.repeat(64);
  if(kind==='request')b.queued.request.child.name='ילדה אחרת';
  if(kind==='frame')b.result.storyboard.framePackets[1].render.prompt+='changed';
  if(kind==='uncertain')b.result.storyboard.rawReview.frames[1].checks[0].verdict='uncertain';
  expect(()=>admitReviewedStoryboardBundle(b,process.cwd(),f.layout)).toThrow();
 });
 it('filesystem wrapper returns the same admission and still rejects an absent repair input',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'synthetic-storyboard-bundle-')),dir=path.join(root,'story');mkdirSync(dir);
  const save=(name:string,v:unknown)=>writeFileSync(path.join(dir,name),JSON.stringify(v));
  writeFileSync(path.join(root,'request.json'),JSON.stringify(f.repaired.queued));save('visual_simple_book_result.json',f.repaired.result);save('owned_storyboard_draft.json',f.repaired.draft);
  expect(()=>loadReviewedStoryboard(root,process.cwd(),f.layout)).toThrow('audition_repair_binding');
  save('storyboard_repair_input.json',f.repaired.repair);
  expect(loadReviewedStoryboard(root,process.cwd(),f.layout)).toEqual(admitReviewedStoryboardBundle(f.repaired,process.cwd(),f.layout));
 });
});

const checkpoint=()=>{
 const api={calls:5,failed:1,unknownCost:0,unknownOutcome:0,reservedUnsettledMicroUsd:0,repeatedFailure:false,cumulativeAccountedMicroUsd:484563,capMicroUsd:7000000},
  max={accountedMicroUsd:1609594,unknownAttemptCosts:0},availability={accountedMicroUsd:1609594,cumulativeLogicalAttempts:6,originalBookLogicalAttempts:4},
  old:any={version:SOL_RECEIPT_RECOVERY.version,cycle:READER_SAFE_BOOK_TRIAL.id,engine:{head:'a'.repeat(40),branch:'synthetic'},
   parent:{claimSha:'b'.repeat(64),outcomeSha:'c'.repeat(64),availabilityAccounting:availability},receiptRecovery:{version:'known-output-decode-recovery/v1',resultSha:'d'.repeat(64),draftSha:'e'.repeat(64),providerCalls:0},
   pricing:{inheritedAdjustedApi:copy(api)},remaining:{sourceWriting:0,sourceRepairs:0,citationCorrections:0,newStoryboardReviews:0,storyboardAttemptsAlreadyConsumed:3,storyboardAttempts:0,childAttempts:2,pageAttempts:3}},
  claim={cycle:old.cycle,engine:copy(old.engine)},outcome:any={cycle:old.cycle,status:'failed_trial',code:'audition_repair_binding',runtimeEligible:false,
   parentClaimSha:old.parent.claimSha,parentOutcomeSha:old.parent.outcomeSha,receiptRecovery:copy(old.receiptRecovery),accounting:{api:copy(api),claudeMax:copy(max),claudeMaxAvailability:copy(availability)}};
 return{old,claim,outcome,api,max};
};
describe('fixed zero-new-spend local checkpoint,not reopening spent or held authority',()=>{
 it('admits only exact no-spend failed bundle checkpoint and preserves its failed status/counters',()=>{
  const c=checkpoint(),before=JSON.stringify(c);expect(()=>assertSolBundleCheckpoint(c.old,c.claim,c.outcome,c.api,c.max)).not.toThrow();expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['wrongVersion','semanticHold','otherFailure','changedParent','newText','resetAttempts','changedCost','newCall','unknown','maxUnknown','changedEngine','providerClaim'])('refuses %s',kind=>{
  const c=checkpoint();
  if(kind==='wrongVersion')c.old.version='arbitrary-retry/v1';if(kind==='semanticHold')c.outcome.status='held_child';if(kind==='otherFailure')c.outcome.code='unrelated';
  if(kind==='changedParent')c.outcome.parentOutcomeSha='f'.repeat(64);if(kind==='newText')c.old.remaining.newStoryboardReviews=1;if(kind==='resetAttempts')c.old.remaining.pageAttempts=4;
  if(kind==='changedCost')c.api.cumulativeAccountedMicroUsd++;
  if(kind==='newCall'){c.api.calls++;c.old.pricing.inheritedAdjustedApi=copy(c.api);c.outcome.accounting.api=copy(c.api);}
  if(kind==='unknown'){c.api.unknownCost++;c.old.pricing.inheritedAdjustedApi=copy(c.api);c.outcome.accounting.api=copy(c.api);}
  if(kind==='maxUnknown'){c.max.unknownAttemptCosts++;c.outcome.accounting.claudeMax=copy(c.max);}
  if(kind==='changedEngine')c.claim.engine.head='f'.repeat(40);if(kind==='providerClaim')c.outcome.receiptRecovery.providerCalls=1;
  expect(()=>assertSolBundleCheckpoint(c.old,c.claim,c.outcome,c.api,c.max)).toThrow();
 });
});
