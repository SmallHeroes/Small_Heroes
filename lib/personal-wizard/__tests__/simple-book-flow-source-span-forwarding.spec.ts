import { beforeAll, describe, expect, it, vi } from 'vitest';
const diagnostic=vi.hoisted(()=>({run:vi.fn()}));
vi.mock('../simple-storyboard-diagnostic',()=>({runSimpleStoryboardDiagnostic:diagnostic.run}));
import { runSimpleWizardBook } from '../simple-book-flow';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import type { TransportReply } from '../../../scripts/personal-causal-trial-adapters';

describe('actual simple-book flow forwards prospective source-span contract',()=>{
  let f:Awaited<ReturnType<typeof personalStoryboardFixture>>;
  beforeAll(async()=>{f=await personalStoryboardFixture();});
  it.each([undefined,true] as const)('preserves absent behavior or forwards exact opt-in %s',async flag=>{
    diagnostic.run.mockReset();diagnostic.run.mockResolvedValue({status:'review_supported',framePackets:[]});
    const plan=f.result.plan,draft={title:plan.title,childGoal:plan.childGoal,companionWant:plan.companionWant,
      comicPromise:plan.comicPromise,ending:plan.ending,pages:f.result.manuscript.pages.map(p=>({text:p.text+' נועה ודיני מציירות.'})),
      pageMap:plan.beats.map(({pageNumber:_n,...b})=>b),
      resilienceMoments:plan.resilience.moments.map(({pageNumber,...m})=>({page:pageNumber,...m}))};
    const calls:string[]=[];
    const result=await runSimpleWizardBook({request:f.request,options:f.current.options,seed:'test-source-span-forwarding',
      signal:new AbortController().signal,reservedWritingUsd:2,publish:()=>{},selfCheckSourceSpans:flag,
      visual:async()=>{throw Error('mocked diagnostic must not dispatch');},
      reader:async call=>({packetDigest:JSON.parse(call.input).packetDigest,summary:'Synthetic structural reading, not real quality proof',findings:[]}),
      opus:async call=>{calls.push(call.stage);const usage={inputTokens:100,outputTokens:100},termination={code:0,signal:null};
        const output=call.stage==='author'?structuredClone(draft):{...structuredClone(draft),editorChanges:['Synthetic only']};
        return {output,usage,estimatedMicroUsd:100000,metadata:{kind:'cli_reported_estimate_not_invoice',reportedModels:['claude-opus-5-5'],termination},
          raw:{termination,killConfirmed:true,stopped:false,stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,
            session_id:call.stage==='author'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',
            total_cost_usd:.1,modelUsage:{'claude-opus-5-5':usage},structured_output:output})}} as TransportReply;
      }});
    expect(result.status).toBe('review_supported');expect(calls).toEqual(['author','editor']);
    expect(diagnostic.run).toHaveBeenCalledTimes(1);expect(diagnostic.run.mock.calls[0][0].selfCheckSourceSpans).toBe(flag);
  });
});
