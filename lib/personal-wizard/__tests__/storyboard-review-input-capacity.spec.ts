import { beforeAll,describe,it,expect } from 'vitest';
import { replanFixture } from './storyboard-replan-fixture';
import { runSimpleStoryboardDiagnostic,type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { personalBookProviderPayload } from '../book-openai';
import { personalStoryboardReviewSchema } from '../storyboard';
import { STORYBOARD_REVIEW_CAPACITY as capacity,storyboardReviewCapacity } from '../storyboard-review-capacity';
import { trialApiRules,portraitReviewInputApprovalSchema,PORTRAIT_REVIEW_INPUT_RECOVERY,PORTRAIT_BOOK_TRIAL } from '../../../scripts/personal-book-e2e-trial';

describe('prospective review-only input capacity, unchanged evidence and legacy planner',()=>{
  let f:Awaited<ReturnType<typeof replanFixture>>,old:Awaited<ReturnType<typeof runSimpleStoryboardDiagnostic>>,next:typeof old;
  beforeAll(async()=>{f=await replanFixture();const run=(reviewCapacity?:typeof capacity.version)=>runSimpleStoryboardDiagnostic({request:f.request,writerResult:f.writerResult,options:f.options,
    signal:new AbortController().signal,actorOwnedAppearance:true,reviewCapacity,generate:async c=>c.stage==='storyboard'?f.draft:f.review});old=await run();next=await run(capacity.version);});
  it('keeps the exact same source/book/draft/review semantics and input/instructions/schema with a bigger review boundary only',()=>{
    expect(next.storyboard).toEqual(old.storyboard);expect(next.rawReview).toEqual(old.rawReview);expect(next.framePackets).toEqual(old.framePackets);expect(next.status).toBe(old.status);
    expect(next.calls[0]).toEqual(old.calls[0]);expect(next.calls[1].input).toBe(old.calls[1].input);expect(next.calls[1].instructions).toBe(old.calls[1].instructions);
    expect(next.calls[1].contentByteLimit).toBe(208000);expect(old.calls[1].contentByteLimit).toBe(104000);expect(next.calls[0].contentByteLimit).toBe(104000);
    expect(next.calls[1].context.reviewCapacity).toBe(capacity.version);expect(old.calls[1].context).not.toHaveProperty('reviewCapacity');
  });
  function call(marker?:typeof capacity.version):SimpleStoryboardDiagnosticCall{return{...next.calls[1],schema:personalStoryboardReviewSchema,
    context:{...next.calls[1].context,...(marker?{reviewCapacity:marker}:{reviewCapacity:undefined})}};}
  it('real SDK payload admits rich review data only prospectively, without dropping a byte',()=>{
    const base=call(),input=JSON.stringify({syntheticEvidence:'x'.repeat(140000)});
    expect(()=>personalBookProviderPayload({...base,input},'gpt-6.1-sol')).toThrow('book_provider_input_limit');
    const p=personalBookProviderPayload({...base,input,context:{...base.context,reviewCapacity:capacity.version}},'gpt-6.1-sol');
    expect(p.input).toBe(input);expect(p.metadata?.storyboard_review_capacity).toBe(capacity.version);
    expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThan(240000);expect(trialApiRules('portrait_s0_storyboard_review')!.reserve(p)).toBeGreaterThanOrEqual(600000);
  });
  it('legacy SDK wire has no marker; only metadata changes for equivalent ordinary input',()=>{
    const a=personalBookProviderPayload(call(),'gpt-6.1-sol'),b=personalBookProviderPayload(call(capacity.version),'gpt-6.1-sol');expect(a).not.toHaveProperty('metadata');
    expect({...b,metadata:undefined}).toEqual({...a,metadata:undefined});expect(b.max_output_tokens).toBe(a.max_output_tokens);
  });
  it('refuses unknown policy, mixed explicit limit, planner marker or an enlarged marked wire before callback/provider',async()=>{
    expect(()=>storyboardReviewCapacity('v2')).toThrow('storyboard_review_capacity');expect(storyboardReviewCapacity(undefined)).toBeNull();
    let calls=0;await expect(runSimpleStoryboardDiagnostic({request:f.request,writerResult:f.writerResult,options:f.options,signal:new AbortController().signal,actorOwnedAppearance:true,
      reviewCapacity:capacity.version,inputByteLimit:104000,generate:async()=>{calls++;throw Error('must not run');}})).rejects.toThrow('input_policy');expect(calls).toBe(0);
    const p={...call(capacity.version),stage:'storyboard' as const};expect(()=>personalBookProviderPayload(p,'gpt-6.1-sol')).toThrow('book_provider_context');
    expect(()=>personalBookProviderPayload({...call(capacity.version),input:'x'.repeat(240000)},'gpt-6.1-sol')).toThrow('book_provider_input_limit');
    const valid=personalBookProviderPayload(call(capacity.version),'gpt-6.1-sol');expect(()=>trialApiRules('portrait_s0_storyboard_review')!.reserve({...valid,input:'x'.repeat(240000)})).toThrow('new_book_wire_limit');
  });
  it('successor is fixed within the SAME book and cannot inject new allowance fields',()=>{
    expect(PORTRAIT_REVIEW_INPUT_RECOVERY.claim).not.toBe(PORTRAIT_BOOK_TRIAL.claim);expect(PORTRAIT_REVIEW_INPUT_RECOVERY.claim).toContain('owner-portrait-book-20261024');
    const a={ownerFile:'C:/scope.txt',ownerSha:'a'.repeat(64),operatorFile:'C:/operator.cjs',operatorSha:'b'.repeat(64)};
    expect(portraitReviewInputApprovalSchema.safeParse(a).success).toBe(true);for(const extra of[{apiCapMicroUsd:8000000},{newPlannerAttempts:3},{bookDir:'C:/new-book'},{reset:true}])expect(portraitReviewInputApprovalSchema.safeParse({...a,...extra}).success).toBe(false);
  });
});
