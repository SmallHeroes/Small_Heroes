import { beforeAll, describe, expect, it } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { preparePersonalStoryboard, compilePersonalStoryboard, storyboardInstructions, storyboardDraftSchema,
  personalStoryboardReviewInput, storyboardReviewDisposition, personalStoryboardFrame } from '../storyboard';
import { SOURCE_CONCURRENCY_VERSION, SOURCE_CONCURRENCY_DRAWN_RULE } from '../storyboard-source-concurrency';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { claimBasisSectionsView, CLAIM_BASIS_DRAWN_INSTANT_RULE } from '../storyboard-claim-basis';
import { previewStoryEvidence } from '../../local-story-preview';
import { changedSections } from '../storyboard-diagnosis';
import { storyboardReviewInstructions, reviewSimpleStoryboardDraft, runSimpleStoryboardDiagnostic } from '../simple-storyboard-diagnostic';
import { personalBookProviderPayload, personalBookProviderSchema, decodePersonalBookProviderOutput } from '../book-openai';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { auditionPageContext, auditionJudgeInstruction, LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION } from '../simple-book-reviewed-audition';

const action='They walk down the lane.',change='Meanwhile the ribbon turns blue.';
const prose=['נועה and Dini wait inside their wooden hut. A red ribbon is in her hand.',
  'They look out from inside the hut. נועה considers another idea.',
  'They leave the hut for the garden, carrying the ribbon.',`${action} ${change}`,
  'They turn back into the garden and stop beside the same hut.',
  'They climb inside the hut again, and the ribbon stays with נועה.'];
const contracts={momentContract:true,drawnInstantContract:true,visibleMomentContract:true,selfCheckContract:true,reviewImpactPolicy:true,
  claimBasisContract:true,calibrationContract:true,presenceContract:true,stateParityContract:true} as const;
type F=Awaited<ReturnType<typeof personalStoryboardFixture>>;
function prepare(f:F,on?:true,repair?:any,writerResult:unknown=f.result){return preparePersonalStoryboard(f.request,writerResult,f.current.options,undefined,true,undefined,
  undefined,undefined,undefined,repair,true,true,true,true,true,true,true,true,undefined,on?{sourceConcurrency:true}:undefined);}
function draft(f:F,source:ReturnType<typeof prepare>,on?:true){
  const d:any=structuredClone(f.draft),texts=previewStoryEvidence(source.story).texts;
  d.sequence.mutableAttributes=[{entityId:'ribbon',attribute:'color'}];
  d.plan.continuity.pages[4].changes=[{entityId:'ribbon',attribute:'color',value:'blue',storyEvidence:change}];
  d.moments={version:STORYBOARD_MOMENTS_VERSION,frames:d.plan.pages.map(()=>({requirements:[],staging:[],depicted:null}))};
  d.moments.frames[4].depicted={evidence:action,relations:[],attributes:[],actorStates:[],presence:[]};
  if(on){d.concurrency={version:SOURCE_CONCURRENCY_VERSION,frames:d.plan.pages.map(()=>({changes:[]}))};
    d.concurrency.frames[4].changes=[{kind:'attribute',entityId:'ribbon',attribute:'color',evidence:change}];}
  d.selfCheck={...fullSelfCheck({...claimBasisSectionsView(d),...(on?{sourceConcurrency:d.concurrency}:{})},texts),visualStates:[]};
  return d;
}
function review(f:F,book:any){const r:any=structuredClone(f.review);r.sourceDigest=book.sourceDigest;r.storyboardDigest=book.storyboardDigest;
  for(const c of [...r.bookChecks,...r.frames.flatMap((x:any)=>x.checks)])c.issues=[];return r;}
async function currentSource(f:F){
  const prepared=prepareSimpleStory(f.request,f.current.options,'source-concurrency-fixture'),p=f.result.plan,records:Record<string,any>={};
  const sd:SimpleStoryDraft={title:p.title,childGoal:p.childGoal,companionWant:p.companionWant,comicPromise:p.comicPromise,ending:p.ending,
    pages:f.result.manuscript.pages.map(x=>({text:x.text+' נועה ודיני משחקות בציור.'})),pageMap:p.beats.map(({pageNumber:_n,...x})=>x),
    resilienceMoments:p.resilience.moments.map(({pageNumber,...x})=>({page:pageNumber,...x}))};
  const generated=await writeSimpleStory(prepared,async c=>{const output=c.stage==='author'?sd:{...sd,editorChanges:['Synthetic only']},usage={inputTokens:100,outputTokens:100},termination={code:0,signal:null};
    records[c.stage]={output,usage,estimatedMicroUsd:100000,metadata:{kind:'cli_reported_estimate_not_invoice',reportedModels:['claude-opus-5-5'],termination},raw:{termination,killConfirmed:true,stopped:false,
      stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:c.stage==='author'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',total_cost_usd:.1,modelUsage:{'claude-opus-5-5':usage},structured_output:output})}};
    return{output,usage,estimatedUsd:.1};},{model:'claude-opus-5-5',reservedUsd:2});
  return createCurrentSimpleStorySource(f.request,generated,records as any,f.current.options);
}
// All positive reviews below are supplied structural test callbacks, NOT model or product acceptance.
describe('prospective concurrency travels through the real storyboard flow',()=>{
  let f:F;
  beforeAll(async()=>{f=await personalStoryboardFixture('short','dragon_dini',resolvePersonalWizardOptions(),prose);});
  it('reproduces the old mandatory FROM override and explicitly admits only the quote-bound new declaration',()=>{
    const old=prepare(f),next=prepare(f,true),raw=draft(f,old);
    expect(()=>compilePersonalStoryboard(old,raw)).toThrow('drawn_instant_attribute');
    const d=draft(f,next,true),before=JSON.stringify(d),book=compilePersonalStoryboard(next,d);
    expect(JSON.stringify(d)).toBe(before);expect(book.sourceConcurrency?.frames[4].changes).toEqual(d.concurrency.frames[4].changes);
    expect(book.plan.continuity!.pages[4].changes[0].value).toBe('blue');expect(book.moments!.frames[4].depicted!.attributes).toEqual([]);
    expect(book.status).toBe('pending_semantic_review');expect(book.runtimeEligible).toBe(false);
  });
  it('replaces the old unconditional rule only when enabled; ordinary schema/instructions remain unchanged',()=>{
    const old=prepare(f),next=prepare(f,true),a=storyboardInstructions(old),b=storyboardInstructions(next);
    expect(a).toContain(CLAIM_BASIS_DRAWN_INSTANT_RULE);expect(a).not.toContain(SOURCE_CONCURRENCY_VERSION);
    expect(b).not.toContain(CLAIM_BASIS_DRAWN_INSTANT_RULE);expect(b).toContain(SOURCE_CONCURRENCY_DRAWN_RULE);
    expect(b).toContain('depicted with empty');expect(b).toContain('background state');
    expect(storyboardDraftSchema(old).shape).not.toHaveProperty('concurrency');expect(storyboardDraftSchema(next).shape).toHaveProperty('concurrency');
    expect(storyboardInstructions(prepare(f))).toBe(a);expect(next.sourceDigest).not.toBe(old.sourceDigest);
  });
  it('binds declarations into the source/book/review and actual render/judge context without leaking a picture override',()=>{
    const source=prepare(f,true),d=draft(f,source,true),book=compilePersonalStoryboard(source,d),r=review(f,book),input=personalStoryboardReviewInput(book),ledgerBefore=JSON.stringify(book.sequence);
    expect(input.sourceConcurrency).toEqual(d.concurrency);
    expect(input.reviewImpact!.reviewRefs).toContain('p4:concurrent:attribute:ribbon:color');
    expect(book.selfCheck!.frames[4].claims.some(c=>c.ref==='p4:concurrent:attribute:ribbon:color')).toBe(true);
    const frame=personalStoryboardFrame(book,r,4,f.current);expect(frame.context.sourceConcurrency).toEqual({version:SOURCE_CONCURRENCY_VERSION,changes:d.concurrency.frames[4].changes});
    expect(frame.render.prompt).toContain(SOURCE_CONCURRENCY_VERSION);expect(frame.render.prompt).toContain(change);
    expect(frame.context.moment!.depicted!.attributes).toEqual([]);
    expect(personalStoryboardFrame(book,r,5,f.current).context.sourceConcurrency!.changes).toEqual([]);
    expect(JSON.stringify(book.sequence)).toBe(ledgerBefore);
    expect(book.sequence.pages.map(p=>p.transitions)).toEqual(d.sequence.pages.map((p:any)=>p.transitions));
    book.sourceConcurrency!.frames[4].changes[0].evidence='tampered';expect(()=>personalStoryboardReviewInput(book)).toThrow('unvalidated_or_changed_book');
  });
  it('binds changes in declaration evidence into the book digest even when existing self-check quote parts support both',()=>{
    const s=prepare(f,true),a=draft(f,s,true),b=structuredClone(a);b.concurrency.frames[4].changes[0].evidence=`${action} ${change}`;
    expect(b.selfCheck).toEqual(a.selfCheck);
    expect(compilePersonalStoryboard(s,a).storyboardDigest).not.toBe(compilePersonalStoryboard(s,b).storyboardDigest);
  });
  it('retains the exact declaration in the native image-judge packet and refuses missing or mismatched packet data',()=>{
    const s=prepare(f,true),book=compilePersonalStoryboard(s,draft(f,s,true)),r=review(f,book),packet=personalStoryboardFrame(book,r,4,f.current).context;
    const image=(x:string)=>({imageName:x+'.png',imageSha:x.repeat(64)}),images=['a','b','c','d'].map(image),
      refs={entities:{image:images[2],status:'approved_reference' as const,knownFlaws:[]},locations:{image:images[3],status:'approved_reference' as const,knownFlaws:[]}};
    const native=auditionPageContext(book,packet,4,'Synthetic companion',images,refs,null);
    expect(native.context.packet).toBe(packet);expect(auditionJudgeInstruction('page',native.context)).toContain('SOURCE-SUPPORTED CONCURRENT STATE');
    const missing={...packet};delete missing.sourceConcurrency;expect(()=>auditionPageContext(book,missing,4,'Synthetic companion',images,refs,null)).toThrow('audition_source_concurrency_binding');
    const bad=structuredClone(packet);bad.sourceConcurrency!.changes=[];expect(()=>auditionPageContext(book,bad,4,'Synthetic companion',images,refs,null)).toThrow('audition_source_concurrency_binding');
    const malformed=structuredClone(packet);(malformed.sourceConcurrency as any).version='unreviewed';expect(()=>auditionJudgeInstruction('page',{packet:malformed})).toThrow();
  });
  it('composes concurrency with actual C/D/E compilation, Momo scale and the native v7 pixel-judge context',async()=>{
    const m=await personalStoryboardFixture('short','elephant_momo',resolvePersonalWizardOptions(),prose);
    const s=preparePersonalStoryboard(m.request,m.result,m.current.options,undefined,true,true,undefined,true,true,undefined,
      true,true,true,true,true,true,true,true,true,{materialFunction:true,companionScale:true,sourceConcurrency:true});
    const d=draft(m,s,true);d.plan.continuity.companionStandingHeightInChildHeights=.7;
    for(const l of d.plan.locations)l.population=[];
    for(const e of d.plan.continuity.entities){e.builtFrom=null;e.invariants.push({attribute:'kind',value:e.id==='hut'?'hut':'ribbon'});}
    d.selfCheck={...fullSelfCheck({...claimBasisSectionsView(d),sourceConcurrency:d.concurrency},previewStoryEvidence(s.story).texts),visualStates:[]};
    const book=compilePersonalStoryboard(s,d),packet=personalStoryboardFrame(book,review(m,book),4,m.current).context;
    const images=['a','b','c','d'].map(x=>({imageName:x+'.png',imageSha:x.repeat(64)})),refs={entities:{image:images[2],status:'approved_reference' as const,knownFlaws:[]},locations:{image:images[3],status:'approved_reference' as const,knownFlaws:[]}};
    const ctx=auditionPageContext(book,packet,4,'Synthetic standing Momo',images,refs,null,LANDMARK_DESIGN_HEAD_VERSION,LANDMARK_COVERAGE_TOPOLOGY_VERSION,true).context;
    expect(ctx.version).toBe('audition-page-context/v7');expect(ctx.companionScale?.companionId).toBe('elephant_momo');
    expect(ctx.materialFunction?.version).toBe('entity-material-function/v1');expect((ctx.packet as any).sourceConcurrency.changes).toEqual(d.concurrency.frames[4].changes);
    const instructions=auditionJudgeInstruction('page',ctx);expect(instructions).toContain('SOURCE-SUPPORTED CONCURRENT STATE');expect(instructions).toContain('COMPANION SCALE CONTRACT');
  });
  it('keeps a semantic concurrency contradiction/uncertainty held and does not accept an old review',()=>{
    const s=prepare(f,true),book=compilePersonalStoryboard(s,draft(f,s,true));
    for(const verdict of ['uncertain','contradiction']){const r=review(f,book),c=r.frames[4].checks.find((x:any)=>x.category==='physical_state');
      c.verdict=verdict;c.observation='Synthetic rejection of temporal meaning';c.issues=[{impact:'evidence',ref:'p4:concurrent:attribute:ribbon:color',note:'Source does not establish concurrency',whyNotMaterial:'',citation:'',basis:verdict==='uncertain'?'unsupported':'contradiction'}];
      expect(storyboardReviewDisposition(book,r).disposition).toMatch(/^held_/);expect(()=>personalStoryboardFrame(book,r,4,f.current)).toThrow(/held_/);}
    const r=review(f,book);r.sourceDigest='a'.repeat(64);expect(()=>storyboardReviewDisposition(book,r)).toThrow('review_binding');
  });
  it.each(['evidence','continuity','detail'].flatMap(impact=>['inference','setting'].map(basis=>({impact,basis}))))('cannot downgrade uncertain/contradicted temporal claim $impact/$basis into a note',({impact,basis})=>{
    const s=prepare(f,true),book=compilePersonalStoryboard(s,draft(f,s,true));
    for(const verdict of ['uncertain','contradiction']){
      const r=review(f,book),c=r.frames[4].checks.find((x:any)=>x.category==='physical_state');c.verdict=verdict;c.observation='Synthetic uncertain temporal relationship';
      c.issues=[{impact,basis,ref:'p4:concurrent:attribute:ribbon:color',note:'Timing is merely inferred',whyNotMaterial:'Synthetic attempted downgrade',citation:''}];
      expect(storyboardReviewDisposition(book,r).disposition).toMatch(/^held_/);expect(()=>personalStoryboardFrame(book,r,4,f.current)).toThrow(/held_/);
    }
  });
  it('retains ordinary calibrated notes while any issue on a temporal declaration remains material even with a citation',()=>{
    const s=prepare(f,true),book=compilePersonalStoryboard(s,draft(f,s,true)),r=review(f,book),c=r.frames[4].checks.find((x:any)=>x.category==='physical_state');
    c.verdict='uncertain';c.issues=[{impact:'detail',basis:'inference',ref:'p4:composition',note:'Synthetic harmless arrangement',whyNotMaterial:'Does not change any source state',citation:''}];
    expect(storyboardReviewDisposition(book,r).disposition).toBe('review_supported_with_notes');
    c.issues=[{impact:'evidence',basis:'unsupported',ref:'p4:concurrent:attribute:ribbon:color',note:'Timing not supported',whyNotMaterial:'Attempted citation waiver',citation:'p4:s1+p4:s2'}];
    expect(storyboardReviewDisposition(book,r).disposition).toBe('held_uncertain');
    expect(storyboardReviewDisposition(book,review(f,book)).disposition).toBe('review_supported');
  });
  it('refuses absent opt-in, absent declaration, staged temporal claims and missing self-check coverage',()=>{
    const s=prepare(f,true),d=draft(f,s,true);
    expect(()=>compilePersonalStoryboard(prepare(f),d)).toThrow('source_concurrency_not_enabled');
    const missing=structuredClone(d);delete missing.concurrency;expect(()=>compilePersonalStoryboard(s,missing)).toThrow('source_concurrency_required');
    const staged=structuredClone(d);staged.moments.frames[4].staging=[{ref:'p4:concurrent:attribute:ribbon:color',reason:'decorative'}];expect(()=>compilePersonalStoryboard(s,staged)).toThrow('staging_ref');
    const partial=structuredClone(d);partial.selfCheck.frames[4].claims=partial.selfCheck.frames[4].claims.filter((c:any)=>!c.ref.includes(':concurrent:'));expect(()=>compilePersonalStoryboard(s,partial)).toThrow('claim_coverage');
  });
  it('maps concurrency edits to their own moment section without treating an empty adoption marker as a story edit',()=>{
    const s=prepare(f,true),a=draft(f,s,true),b=structuredClone(a);b.concurrency.frames[4].changes[0].evidence=`${action} ${change}`;
    expect(changedSections(a,b)).toEqual(['p4:moment']);
    const none=structuredClone(a);none.concurrency.frames[4].changes=[];const old=structuredClone(none);delete old.concurrency;
    expect(changedSections(old,none)).toEqual([]);
  });
  it('reconstructs a held historical parent under its old contracts when a prospective repair adds concurrency',()=>{
    const oldSource=prepare(f),oldDraft=draft(f,oldSource);oldDraft.moments.frames[4].depicted=null;
    oldDraft.selfCheck={...fullSelfCheck(claimBasisSectionsView(oldDraft),previewStoryEvidence(oldSource.story).texts),visualStates:[]};
    const parent=compilePersonalStoryboard(oldSource,oldDraft),held=review(f,parent),c=held.frames[4].checks.find((x:any)=>x.category==='physical_state');
    c.verdict='uncertain';c.observation='Synthetic held instant';c.issues=[{impact:'evidence',ref:'p4:scene',note:'Wrong instant',whyNotMaterial:'',citation:'',basis:'unsupported'}];
    const repair={parentStoryboardDigest:parent.storyboardDigest,draft:oldDraft,review:held,addedContracts:['sourceConcurrency']};
    const next=prepare(f,true,repair);
    expect(next.repair!.parentStoryboardDigest).toBe(parent.storyboardDigest);
    expect((next.planningInput as any).priorReviewedStoryboard.storyboard).not.toHaveProperty('concurrency');
    expect(compilePersonalStoryboard(oldSource,oldDraft).storyboardDigest).toBe(parent.storyboardDigest);
    expect(()=>prepare(f,undefined,repair)).toThrow('repair_policy');
    expect(()=>prepare(f,true,{...repair,parentStoryboardDigest:'f'.repeat(64)})).toThrow('repair_binding');
    const {addedContracts:_added,...noAdoption}=repair;
    expect(()=>prepare(f,true,noAdoption)).toThrow('repair_binding');
  });
  it('rejects policy dependency loss and replaces the review rule without altering legacy instructions',()=>{
    expect(()=>storyboardReviewInstructions({engineContinuity:{sourceConcurrency:true}})).toThrow('source_concurrency_policy');
    const old=storyboardReviewInstructions(contracts),next=storyboardReviewInstructions({...contracts,engineContinuity:{sourceConcurrency:true}});
    expect(old).not.toContain(SOURCE_CONCURRENCY_VERSION);expect(next).toContain(SOURCE_CONCURRENCY_VERSION);expect(next).toContain('uncertain');
    expect(old).toContain('inference and setting with a positive reason are notes.');
    expect(next).not.toContain('inference and setting with a positive reason are notes.');expect(next).toContain('ordinary non-concurrency references');
  });
  it('the review-only seam buys no planner callback and rechecks policy after await',async()=>{
    const writerResult=await currentSource(f),source=prepare(f,true,undefined,writerResult),d=draft(f,source,true),book=compilePersonalStoryboard(source,d),calls:string[]=[],ec:any={sourceConcurrency:true};
    await expect(reviewSimpleStoryboardDraft({request:f.request,writerResult,options:f.current.options,signal:new AbortController().signal,
      ...contracts,engineContinuity:ec,generate:async c=>{calls.push(c.stage);ec.sourceConcurrency=undefined;return review(f,book);}},d)).rejects.toThrow();
    expect(calls).toEqual(['review']);
  });
  it('actual planner SDK wire and decoder retain the declaration through a fresh injected review and all frame packets',async()=>{
    const writerResult=await currentSource(f),s=prepare(f,true,undefined,writerResult),d=draft(f,s,true),book=compilePersonalStoryboard(s,d),calls:any[]=[];
    const result=await runSimpleStoryboardDiagnostic({request:f.request,writerResult,options:f.current.options,signal:new AbortController().signal,
      ...contracts,engineContinuity:{sourceConcurrency:true},generate:async call=>{
        calls.push(call);const payload=personalBookProviderPayload(call,'gpt-6.1-sol');
        if(call.stage==='review'){expect(JSON.parse(call.input).sourceConcurrency).toEqual(d.concurrency);return review(f,book);}
        expect(JSON.stringify(payload.text.format.schema)).toContain('concurrency');
        const wire=structuredClone(d);for(const p of wire.plan.pages)delete p.pageNumber;for(const p of wire.plan.continuity.pages)delete p.pageNumber;for(const p of wire.sequence.pages)delete p.pageNumber;
        expect(personalBookProviderSchema(call).safeParse(wire).success).toBe(true);
        const missing=structuredClone(wire);missing.concurrency.frames.pop();expect(personalBookProviderSchema(call).safeParse(missing).success).toBe(false);
        return decodePersonalBookProviderOutput(call,wire);
      }});
    expect(calls.map(c=>c.stage)).toEqual(['storyboard','review']);expect(calls.every(c=>c.context.engineContinuity.sourceConcurrency===true)).toBe(true);
    expect(result.status).toBe('review_supported');expect(result.framePackets).toHaveLength(9);
    expect(result.framePackets[4].qa.context.sourceConcurrency?.changes).toEqual(d.concurrency.frames[4].changes);
  });
});
