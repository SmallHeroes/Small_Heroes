import { beforeAll, describe, expect, it, vi } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardReviewInput,
  personalStoryboardFrame, storyboardInstructions, storyboardReviewDisposition } from '../storyboard';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { claimBasisSectionsView } from '../storyboard-claim-basis';
import { previewStoryEvidence } from '../../local-story-preview';
import { WHOLE_BOOK_AUTHORING_RULES } from '../../local-book-planning';
import { CALIBRATION_STORYBOARD_ADDENDUM, CALIBRATION_REVIEW_ADDENDUM } from '../storyboard-calibration';
import { STORYBOARD_STATE_PARITY_VERSION, stateParityRules, stateParityAuthority, STATE_PARITY_RENDER_ADDENDUM } from '../storyboard-state-parity';
import { runSimpleStoryboardDiagnostic, storyboardReviewInstructions } from '../simple-storyboard-diagnostic';
import { savedStateParityContract } from '../../../scripts/personal-simple-book-reviewed-audition';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { personalBookProviderSchema } from '../book-openai';
import { assertStoryboardRepair } from '../storyboard-repair';

type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
const contracts = { momentContract:true,drawnInstantContract:true,visibleMomentContract:true,selfCheckContract:true,
  reviewImpactPolicy:true,claimBasisContract:true,calibrationContract:true } as const;
const prep = (f:Fixture,on?:true,repair?:any)=>preparePersonalStoryboard(f.request,f.result,f.current.options,undefined,true,undefined,undefined,
  undefined,undefined,repair,true,true,true,true,true,true,undefined,on);
function draftFor(f:Fixture,source:ReturnType<typeof prep>){
  const d:any={...structuredClone(f.draft),moments:{version:STORYBOARD_MOMENTS_VERSION,frames:f.draft.plan.pages.map(()=>({requirements:[],staging:[],depicted:null}))}};
  d.selfCheck={...fullSelfCheck(claimBasisSectionsView(d),previewStoryEvidence(source.story).texts),visualStates:[]};return d;
}
const reviewFor=(f:Fixture,book:{sourceDigest:string;storyboardDigest:string})=>{
  const r:any={...structuredClone(f.review),sourceDigest:book.sourceDigest,storyboardDigest:book.storyboardDigest};
  for(const c of [...r.bookChecks,...r.frames.flatMap((p:any)=>p.checks)])c.issues=[];
  return r; // Synthetic callback wiring only, NOT a semantic judgment.
};

describe('prospective storyboard-state-parity/v1, no provider or legacy reinterpretation',()=>{
  let f:Fixture;
  beforeAll(async()=>{f=await personalStoryboardFixture();});
  it('reproduces the old contract contradiction and replaces only the conflicting entries when explicitly enabled',()=>{
    expect(WHOLE_BOOK_AUTHORING_RULES.attributeBinding.invariantsAreInitialAttributeValuesWithExplicitMutableExceptions).toBe(true);
    const old=prep(f),next=prep(f,true),before=storyboardInstructions(old),after=storyboardInstructions(next);
    expect(before).toContain('never keep an attribute invariant that the visual language or the text changes');
    expect(before).toContain(CALIBRATION_STORYBOARD_ADDENDUM);
    expect(storyboardReviewInstructions(contracts)).toContain(CALIBRATION_REVIEW_ADDENDUM);
    expect(storyboardReviewInstructions(contracts)).toContain('or that an invariant forbids');
    expect(after).not.toContain('never keep an attribute invariant that the visual language or the text changes');
    expect(after).toContain('INITIAL VALUE');expect(after).toContain('END OF BODY PAGE1');
    const review=storyboardReviewInstructions({...contracts,stateParityContract:true});
    expect(review).not.toContain('or that an invariant forbids');expect(review).toContain('NOT a contradiction merely');
    expect(review).toContain('Uncertainty remains uncertain');expect(after).toContain('Do not paint successive instants together');
    expect(next.planningInput.stateParity).toEqual(stateParityRules());expect('stateParity' in old.planningInput).toBe(false);
    expect(next.sourceDigest).not.toBe(old.sourceDigest);expect(storyboardInstructions(prep(f))).toBe(before);
  });
  it('partitions the existing baseline and source-change timeline without banning legal mutable attributes or changing any state',()=>{
    const plan=structuredClone(f.book.plan),sequence=structuredClone(f.book.sequence),before=JSON.stringify([plan,sequence]);
    sequence.mutableAttributes=[{entityId:'ribbon',attribute:'color'}];
    plan.continuity!.pages[3].changes=[{entityId:'ribbon',attribute:'color',value:'blue',storyEvidence:'synthetic source quote, not semantic proof'}];
    const configured=JSON.stringify([plan,sequence]),a=stateParityAuthority(plan,sequence),ribbon=a.entities.find(e=>e.entityId==='ribbon')!;
    expect(ribbon.fixedAttributes).toEqual([]);expect(ribbon.mutableAttributes).toEqual([{attribute:'color',initialValue:'red',changes:[{
      pageNumber:3,value:'blue',storyEvidence:'synthetic source quote, not semantic proof'}]}]);
    expect(a.entities.find(e=>e.entityId==='hut')!.fixedAttributes).toEqual([{attribute:'material',value:'wood'}]);
    expect(a.attributeAuthority.declarationAloneIsSemanticPermission).toBe(false);
    expect(a.temporalAuthority).toMatchObject({initialStates:'end_of_first_body_page',firstBodyPageTransitions:'must_be_empty',depicted:'this_picture_instant_only_never_persisted'});
    expect(JSON.stringify([plan,sequence])).toBe(configured);expect(configured).not.toBe(before);
    sequence.mutableAttributes=[];expect(()=>stateParityAuthority(plan,sequence)).toThrow('state_parity_fixed_change');
    sequence.mutableAttributes=[{entityId:'unknown',attribute:'color'}];expect(()=>stateParityAuthority(plan,sequence)).toThrow('state_parity_mutable_binding');
  });
  it('does not change compiler refusals for undeclared changes, missing initial attributes, unsupported quotes or page1 transitions',()=>{
    const source=prep(f,true);
    const bad=draftFor(f,source);bad.plan.continuity.pages[3].changes=[{entityId:'ribbon',attribute:'color',value:'blue',storyEvidence:'carrying the ribbon'}];
    expect(()=>compilePersonalStoryboard(source,bad)).toThrow('immutable_attribute_change');
    const missing=draftFor(f,source);missing.sequence.mutableAttributes=[{entityId:'ribbon',attribute:'nonexistent'}];
    expect(()=>compilePersonalStoryboard(source,missing)).toThrow('mutable_attribute');
    bad.sequence.mutableAttributes=[{entityId:'ribbon',attribute:'color'}];bad.plan.continuity.pages[3].changes[0].storyEvidence='NOT IN SOURCE';
    expect(()=>compilePersonalStoryboard(source,bad)).toThrow();
    const initial=draftFor(f,source);initial.sequence.pages[0].transitions=[{entityId:'child',from:{relation:'inside',targetId:'hut'},to:{relation:'beside',targetId:'hut'},evidence:'נועה'}];
    expect(()=>compilePersonalStoryboard(source,initial)).toThrow('initial_state');
  });
  it('binds the marker through source,compiled book,review,restore and every render/judge frame; old reviews do not become fresh evidence',()=>{
    const old=prep(f),next=prep(f,true),oldBook=compilePersonalStoryboard(old,draftFor(f,old)),book=compilePersonalStoryboard(next,draftFor(f,next));
    expect(book.stateParity).toBe(STORYBOARD_STATE_PARITY_VERSION);expect('stateParity' in oldBook).toBe(false);
    expect(personalStoryboardReviewInput(book).stateParity).toEqual(stateParityAuthority(book.plan,book.sequence));
    expect(()=>storyboardReviewDisposition(book,reviewFor(f,oldBook))).toThrow();
    expect([savedStateParityContract(undefined),savedStateParityContract({}),savedStateParityContract(book)]).toEqual([undefined,undefined,true]);
    expect(()=>savedStateParityContract({stateParity:'storyboard-state-parity/v2'})).toThrow('audition_board_binding');
    for(let n=0;n<=book.narrativeSpreads;n++){
      const p=personalStoryboardFrame(book,reviewFor(f,book),n,f.current);
      expect(p.context.stateParity).toEqual(stateParityRules());expect(p.render.prompt).toContain(STATE_PARITY_RENDER_ADDENDUM);
      expect(p.qa.context).toBe(p.context);expect(p.render.contextSha).toBe(p.packetDigest);
    }
    expect(personalStoryboardFrame(oldBook,reviewFor(f,oldBook),1,f.current).render.prompt).not.toContain(STATE_PARITY_RENDER_ADDENDUM);
  });
  it('an earlier pictured relation stays local to that frame, while the same end ledger governs later pages',()=>{
    const source=prep(f,true),draft=draftFor(f,source),quote='They climb inside the hut again';
    draft.moments.frames[6].depicted={evidence:quote,attributes:[],actorStates:[],relations:['child','companion'].map(entityId=>({
      entityId,value:{relation:'beside',targetId:'hut'},evidence:quote}))};
    draft.selfCheck={...fullSelfCheck(claimBasisSectionsView(draft),previewStoryEvidence(source.story).texts),visualStates:[]};
    const book=compilePersonalStoryboard(source,draft),raw=reviewFor(f,book),at=personalStoryboardFrame(book,raw,6,f.current),later=personalStoryboardFrame(book,raw,7,f.current);
    expect((at.context.sequence as any).relations.find((s:any)=>s.entityId==='child').value).toEqual({relation:'beside',targetId:'hut'});
    expect(book.sequence.pages[5].states.find(s=>s.entityId==='child')!.value).toEqual({relation:'inside',targetId:'hut'});
    expect((later.context.sequence as any).relations.find((s:any)=>s.entityId==='child').value).toEqual({relation:'inside',targetId:'hut'});
    expect(at.context.stateParity!.temporalAuthority.depicted).toBe('this_picture_instant_only_never_persisted');
  });
  it.each(['medium','long'])('applies the same contract across every %s-book frame without story/name/length special cases',async length=>{
    const other=await personalStoryboardFixture(length),source=prep(other,true),book=compilePersonalStoryboard(source,draftFor(other,source)),raw=reviewFor(other,book);
    for(let n=0;n<=book.narrativeSpreads;n++)expect(personalStoryboardFrame(book,raw,n,other.current).context.stateParity?.version).toBe(STORYBOARD_STATE_PARITY_VERSION);
    expect(book.narrativeSpreads).toBe(length==='medium'?12:16);
  });
  it.each(['safety','identity','story','continuity','evidence'])('retains the genuine %s/uncertain blocker; declaration does not mint PASS',impact=>{
    const source=prep(f,true),book=compilePersonalStoryboard(source,draftFor(f,source)),r=reviewFor(f,book);
    Object.assign(r.frames[1].checks[0],{verdict:'uncertain',observation:'Synthetic unresolved material issue',issues:[{
      impact,ref:'p1',basis:'unsupported',note:'Synthetic uncertainty, not a pixel judgment',citation:'',whyNotMaterial:''}]});
    expect(storyboardReviewDisposition(book,r).disposition).toBe('held_uncertain');
  });
  it('upgrades a held parent only by explicit addContracts and exact old-parent recompile; its old HOLD stays unchanged',()=>{
    const source=prep(f),draft=draftFor(f,source),parent=compilePersonalStoryboard(source,draft),r=reviewFor(f,parent);
    Object.assign(r.frames[1].checks[0],{verdict:'uncertain',observation:'Synthetic held source',issues:[{impact:'story',ref:'p1',basis:'unsupported',note:'Needs fresh plan',citation:'',whyNotMaterial:''}]});
    const repair={parentStoryboardDigest:parent.storyboardDigest,draft,review:r,addedContracts:['stateParityContract']};
    expect(()=>assertStoryboardRepair(repair)).not.toThrow();const oldBytes=JSON.stringify([draft,r]);
    const upgraded=prep(f,true,repair),candidate=compilePersonalStoryboard(upgraded,draftFor(f,upgraded));
    expect(candidate.repair?.parentStoryboardDigest).toBe(parent.storyboardDigest);expect(candidate.stateParity).toBe(STORYBOARD_STATE_PARITY_VERSION);
    expect(JSON.stringify([draft,r])).toBe(oldBytes);expect(storyboardReviewDisposition(parent,r).disposition).toBe('held_uncertain');
    expect(()=>storyboardReviewDisposition(candidate,r)).toThrow();expect(()=>prep(f,true,{parentStoryboardDigest:parent.storyboardDigest,draft,review:r})).toThrow('repair_binding');
  });
  it('rejects invalid opt-ins at source and provider boundaries before callbacks',()=>{
    expect(()=>preparePersonalStoryboard(f.request,f.result,f.current.options,undefined,true,undefined,undefined,undefined,undefined,undefined,true,true,true,true,true,undefined,undefined,true)).toThrow('state_parity_policy');
    expect(()=>storyboardReviewInstructions({stateParityContract:true})).toThrow('state_parity_policy');
    expect(()=>personalBookProviderSchema({stage:'review',context:{narrativeSpreads:8,sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64),stateParityContract:true}} as any)).toThrow('book_provider_context');
  });
  it('actual injected diagnostic sends the same prospective contract to planner and fresh reviewer, not just a dormant helper',async()=>{
    const prepared=prepareSimpleStory(f.request,f.current.options,'state-parity-fixture'),p=f.result.plan,records:Record<string,any>={};
    const d:SimpleStoryDraft={title:p.title,childGoal:p.childGoal,companionWant:p.companionWant,comicPromise:p.comicPromise,ending:p.ending,
      pages:f.result.manuscript.pages.map(x=>({text:x.text+' נועה ודיני משחקות בציור.'})),pageMap:p.beats.map(({pageNumber:_n,...x})=>x),
      resilienceMoments:p.resilience.moments.map(({pageNumber,...x})=>({page:pageNumber,...x}))};
    const generated=await writeSimpleStory(prepared,async call=>{const output=call.stage==='author'?d:{...d,editorChanges:['Synthetic only']},usage={inputTokens:100,outputTokens:100},termination={code:0,signal:null};
      records[call.stage]={output,usage,estimatedMicroUsd:100000,metadata:{kind:'cli_reported_estimate_not_invoice',reportedModels:['claude-opus-5-5'],termination},
        raw:{termination,killConfirmed:true,stopped:false,stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,
          session_id:call.stage==='author'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',total_cost_usd:.1,modelUsage:{'claude-opus-5-5':usage},structured_output:output})}};
      return{output,usage,estimatedUsd:.1};},{model:'claude-opus-5-5',reservedUsd:2});
    const writerResult=createCurrentSimpleStorySource(f.request,generated,records as any,f.current.options);
    const source=prepareCurrentPersonalStoryboard(f.request,writerResult,f.current.options,undefined,true,undefined,undefined,undefined,undefined,undefined,true,true,true,true,true,true,undefined,true);
    const draft=draftFor(f,source as any),book=compilePersonalStoryboard(source,draft),calls:any[]=[];
    const generate=vi.fn(async(call:any)=>{calls.push(call);return structuredClone(call.stage==='storyboard'?draft:reviewFor(f,book));});
    const result=await runSimpleStoryboardDiagnostic({request:f.request,writerResult,options:f.current.options,signal:new AbortController().signal,generate,...contracts,stateParityContract:true});
    expect(result.status).toBe('review_supported');expect(generate).toHaveBeenCalledTimes(2);
    expect(calls.map(c=>c.context.stateParityContract)).toEqual([true,true]);
    expect(JSON.parse(calls[0].input).stateParity).toEqual(stateParityRules());expect(JSON.parse(calls[1].input).stateParity.version).toBe(STORYBOARD_STATE_PARITY_VERSION);
    expect(result.framePackets).toHaveLength(9);expect(calls[0].instructions).not.toContain('never keep an attribute invariant that the visual language or the text changes');
    expect(calls[1].instructions).not.toContain('or that an invariant forbids');
  });
});
