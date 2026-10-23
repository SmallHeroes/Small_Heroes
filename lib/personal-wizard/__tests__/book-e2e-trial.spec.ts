import {describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {BOOK_E2E_TRIAL,TrialApiMeter,TrialMaxBudget,trialApiRules,trialConfigSchema} from '../../../scripts/personal-book-e2e-trial';
import {auditionRenderPlan} from '../../../scripts/personal-simple-book-reviewed-audition';
import {prepareSourceImpactReview,compileSourceImpactReview,SOURCE_REVIEW_IMPACT,prepareSourceImpactCompletion,compileSourceImpactCompletion,SOURCE_IMPACT_COMPLETION} from '../source-review-impact';

const root=()=>mkdtempSync(path.join(tmpdir(),'new-book-trial-test-'));
const raw={model:'gpt-6.1-sol',service_tier:'default',status:'completed',output_text:'{}',usage:{input_tokens:12,output_tokens:3}};
const wire={role:'astra',stage:'final_review',model:'gpt-6.1-sol',outputCap:16000,json:JSON.stringify({model:'gpt-6.1-sol',input:'test'})};
const receipt=()=>({raw:structuredClone(raw),usage:{inputTokens:12,outputTokens:3},estimatedMicroUsd:54});
describe('new full-book native trial',()=>{
  it('fixes one new slot and both ceilings, not a renamed old consumed grant',()=>{
    expect(BOOK_E2E_TRIAL.id).toBe('owner-new-book-e2e-20261023/v1');expect(BOOK_E2E_TRIAL.apiCapMicroUsd).toBe(7000000);
    expect(BOOK_E2E_TRIAL.maxResourceMicroUsd).toBe(6000000);expect(BOOK_E2E_TRIAL.pageAttempts).toBe(3);
    expect(BOOK_E2E_TRIAL.routes.identityThreshold).toBe(.7);
    const config={version:'book-e2e-trial-config/v1',cycle:BOOK_E2E_TRIAL.id,ownerFile:'C:/o',ownerSha:'a'.repeat(64),bookDir:'C:/b',profileFile:'C:/p',
      profileSha:'b'.repeat(64),executable:'C:/exe',executableSha256:'c'.repeat(64),keyFile:'C:/existing'};
    expect(trialConfigSchema.safeParse(config).success).toBe(true);
    expect(trialConfigSchema.safeParse({...config,cycle:'owner-autonomous-book-api-20261017/fresh-book-usd7'}).success).toBe(false);
    expect(trialConfigSchema.safeParse({...config,apiCapMicroUsd:100000000}).success).toBe(false);
  });
  it.each(['s0_final_review','s0_comparison','s1_final_review','s2_citation_correction'])('keeps ordinary review reserve %s',step=>{
    expect(trialApiRules(step)?.reserve(wire)).toBe(600000);
    expect(trialApiRules(step)?.reserve({...wire,model:'gpt-6-astra'})).toBeNull();
  });
  it.each(['s4_final_review','s0_author','s0_storyboard','another_slot','diagnosis_qa'])('refuses unpriced API route %s',step=>expect(trialApiRules(step)).toBeUndefined());
  it('actual meter settles the prefixed native reader from raw usage and refuses coherent-looking altered cost',async()=>{
    const meter=new TrialApiMeter(root(),'s0_');let calls=0;
    await meter.run('final_review',wire,600000,async()=>{calls++;return{value:1,estimatedMicroUsd:54,receipt:receipt()};});
    expect(calls).toBe(1);expect(meter.snapshot().newKnownApiMicroUsd).toBe(54);
    const file=path.join(meter.root,'s0_final_review.result.json'),r=JSON.parse(readFileSync(file,'utf8'));r.estimatedMicroUsd=0;writeFileSync(file,JSON.stringify(r));
    expect(()=>meter.snapshot()).toThrow();
  });
  it('wrong review reservation refuses before claim/callback',async()=>{
    const meter=new TrialApiMeter(root(),'s0_');let calls=0;
    await expect(meter.run('final_review',wire,1,async()=>{calls++;return{value:1,estimatedMicroUsd:54,receipt:receipt()};})).rejects.toThrow('audition_meter_cost');
    expect(calls).toBe(0);expect(meter.snapshot().calls).toBe(0);
  });
  it('a settled unknown is not free headroom or an automatic retry',async()=>{
    const meter=new TrialApiMeter(root(),'s0_');let calls=0;
    await expect(meter.run('final_review',wire,600000,async()=>{calls++;throw new Error('transport');})).rejects.toThrow('transport');
    expect(meter.snapshot().unknownCost).toBe(1);
    await expect(meter.run('comparison',wire,600000,async()=>{calls++;return{value:1,estimatedMicroUsd:54,receipt:receipt()};})).rejects.toThrow('audition_unknown_cost');
    expect(calls).toBe(1);
  });
  it('the actual local scene adapter derives LOW and all four reference roles with the original failed scene first',()=>{
    const refs=Array.from({length:4},(_,i)=>({imageName:`ref_${i}.png`,imageSha:String(i).repeat(64)}));
    const plan=auditionRenderPlan(root(),'Fix only the verified defect, keep story/canon',refs,'book_scene_edit',
      ['scene_edit_target','child_design_authority','companion_design_authority','entity_design_authority']);
    expect(plan.wire.body.model).toBe('gpt-image-2');expect(plan.wire.body.quality).toBe('low');expect(plan.wire.references).toEqual(refs);
    expect(trialApiRules('r1_page_7_1')?.reserve(plan.wire)).toBe(plan.maximumMicroUsd);
  });
  it('separate Max budget checks raw reported cost and the USD6 cumulative guard, not the permissive underlying meter',async()=>{
    const meter=new TrialMaxBudget(root(),'s0_');let calls=0;
    const produce=async()=>{calls++;return{value:1,estimatedMicroUsd:1500000,receipt:{estimatedMicroUsd:1500000,raw:{termination:{code:0},
      stdout:JSON.stringify({total_cost_usd:1.5,modelUsage:{'claude-opus-5-5':{}}})}}};};
    for(const name of ['author','editor','storyboard'])await meter.run(name,{},2000000,produce);
    expect(meter.snapshot().knownEstimateMicroUsd).toBe(4500000);
    expect(()=>meter.run('another',{},2000000,produce)).toThrow('trial_max_cap');expect(calls).toBe(3);
    expect(()=>meter.run('another',{},1,produce)).toThrow('trial_max_session_guard');
  });
});

describe('prospective diagnostic source impact (legacy literary HOLD preserved)',()=>{
  const prepared=(blocking=false)=>prepareSourceImpactReview({sourceSha:'a'.repeat(64),age:6,
    finalPacket:{version:'synthetic/final-v1',instructions:"Every finding quote must be a contiguous verbatim substring copied from the cited version's actual page text at that pageNumber, not a paraphrase or a quote from the brief/title/plan. A literal quote proves provenance, not the truth of your interpretation.",
      manuscript:{title:'טיול חדש',pages:Array.from({length:8},(_,n)=>({pageNumber:n+1,text:'רות יצאה לשביל. החבר עזר והיא חייכה.'}))}} as any,
    readings:[{stage:'final_review',findings:[{severity:blocking?'blocking':'meaningful',kind:'issue',criterion:'אבחנה כללית לדוגמה',explanation:'טענה ספרותית שמחייבת בדיקת השפעה חדשה',original:[],revised:[]}]},
      {stage:'comparison',findings:[{severity:'meaningful',kind:'new_regression',criterion:'טענת עריכה לדוגמה',explanation:'השפעת הניסוח על ההבנה צריכה להיבדק',original:[],revised:[]}]}] as any});
  const evidence=[{startId:'r-p1-u1',endId:'r-p1-u1',anchor:'רות יצאה'}];
  const positive=(p=prepared())=>({version:SOURCE_REVIEW_IMPACT,packetDigest:p.packetDigest,summary:'בדיקה חדשה מפורשת של אותה גרסה בדיוק',
    guards:['safety','age_readability','causality','identity','continuity'].map(domain=>({domain,status:'supported',reason:'הטקסט מדגים פעולה מובנת ורצף שמור לילד',evidence:structuredClone(evidence)})),
    decisions:p.body.requiredFindings.map(f=>({id:f.id,impact:'detail',certainty:'supported',reason:'ההשפעה מקומית ועריכתית ואינה שוברת הבנה או זהות',evidence:structuredClone(evidence)})),additional:[]});
  it('fresh supported detail admits diagnostics only, retaining old raw severity and binding',()=>{
    const p=prepared(),before=JSON.stringify(p.context.readings),answer=positive(p),result=compileSourceImpactReview(p,answer);
    expect(result.status).toBe('diagnostic_source_supported_with_notes');expect(result.productAccepted).toBe(false);
    expect(result.historicalLiteraryHoldPreserved).toBe(true);expect(JSON.stringify(p.context.readings)).toBe(before);
    expect(p.context.readings[0].findings[0].severity).toBe('meaningful');
  });
  it.each(['safety','story','identity','continuity'])('a fresh %s finding still holds',impact=>{
    const p=prepared(),a=positive(p);a.decisions[0].impact=impact;
    expect(compileSourceImpactReview(p,a).status).toBe('held_material');
  });
  it.each(['safety','age_readability','causality','identity','continuity'])('uncertain %s guard cannot be waved through',domain=>{
    const p=prepared(),a=positive(p);a.guards.find(g=>g.domain===domain)!.status='uncertain';
    expect(compileSourceImpactReview(p,a).status).toBe('held_uncertain');
  });
  it('required evidence uncertainty holds even when labeled detail',()=>{
    const p=prepared(),a=positive(p);a.decisions[0].certainty='uncertain';expect(compileSourceImpactReview(p,a).status).toBe('held_uncertain');
  });
  it.each(['missing','duplicate','foreign'])('refuses %s prior-finding coverage',variant=>{
    const p=prepared(),a=positive(p);if(variant==='missing')a.decisions.pop();else a.decisions[1].id=variant==='duplicate'?a.decisions[0].id:'foreign';
    expect(()=>compileSourceImpactReview(p,a)).toThrow('source_impact_coverage');
  });
  it('does not demote an old blocking claim to detail',()=>{
    const p=prepared(true);expect(()=>compileSourceImpactReview(p,positive(p))).toThrow('source_impact_blocking_demotion');
  });
  it('rejects duplicate guards, false letter anchor, foreign digest and changed instructions/context',()=>{
    const p=prepared(),a=positive(p);a.guards[1].domain=a.guards[0].domain;expect(()=>compileSourceImpactReview(p,a)).toThrow('source_impact_guards');
    const b=positive(p);b.decisions[0].evidence[0].anchor='רות יצא';expect(()=>compileSourceImpactReview(p,b)).toThrow();
    const c=positive(p);c.packetDigest='b'.repeat(64);expect(()=>compileSourceImpactReview(p,c)).toThrow('source_impact_binding');
    const d=positive(p);p.instructions+=' changed';expect(()=>compileSourceImpactReview(p,d)).toThrow('source_impact_binding');
    const p2=prepared(),a2=positive(p2);p2.context.sourceSha='b'.repeat(64);expect(()=>compileSourceImpactReview(p2,a2)).toThrow('source_impact_binding');
  });
  it('counts the one prospective review in the SAME native API ledger and reservation floor',async()=>{
    const meter=new TrialApiMeter(root()),w={...wire,stage:'source_impact_review'};
    expect(trialApiRules('source_impact_review')?.reserve(w)).toBe(600000);
    await meter.run('source_impact_review',w,600000,async()=>({value:1,estimatedMicroUsd:54,receipt:receipt()}));
    expect(meter.snapshot().calls).toBe(1);let dispatched=false;
    await expect(meter.run('source_impact_review',w,600000,async()=>{dispatched=true;return{value:1,estimatedMicroUsd:54,receipt:receipt()};})).rejects.toThrow();
    expect(dispatched).toBe(false);expect(meter.snapshot().newKnownApiMicroUsd).toBe(54);
    expect(trialApiRules('s4_storyboard_review')).toBeDefined();
    expect(trialApiRules('s4_final_review')).toBeUndefined();
  });
  it('provider schema encodes exact complete cardinality and stable finding IDs',()=>{
    const p=prepared(),a=positive(p);expect(p.schema.safeParse(a).success).toBe(true);
    a.decisions.pop();expect(p.schema.safeParse(a).success).toBe(false);
    const b=positive(p);b.decisions[0].id='foreign';expect(p.schema.safeParse(b).success).toBe(false);
  });
  const completionFixture=()=>{const p=prepared(),full=positive(p),partial=structuredClone(full),missing=partial.decisions.pop()!;
    const c=prepareSourceImpactCompletion(p,partial);return{p,full,partial,c,answer:{version:SOURCE_IMPACT_COMPLETION,completionDigest:c.completionDigest,missingDecisions:[missing],additionalFindings:[] as typeof full.decisions}};};
  it('fills only a unique missing decision, preserving every prior typed field and original invalid response',()=>{
    const {p,partial,c,answer}=completionFixture(),before=JSON.stringify(partial),r=compileSourceImpactCompletion(c,answer);
    expect(r.status).toBe('diagnostic_source_supported_with_notes');expect(r.raw.guards).toEqual(partial.guards);
    expect(r.raw.summary).toBe(partial.summary);expect(r.raw.decisions[0]).toEqual(partial.decisions[0]);
    expect(JSON.stringify(partial)).toBe(before);expect(r.completion.originalIncompleteResponseStillInvalid).toBe(true);
    expect(()=>compileSourceImpactReview(p,partial)).toThrow('source_impact_coverage');
    expect(()=>prepareSourceImpactCompletion(p,r.raw)).toThrow('source_completion_not_needed');
  });
  it.each(['safety','story','identity','continuity'])('a missing decision completed as %s remains material HOLD',impact=>{
    const {c,answer}=completionFixture();answer.missingDecisions[0].impact=impact;expect(compileSourceImpactCompletion(c,answer).status).toBe('held_material');
  });
  it('uncertain completion and newly discovered blocker are not detail-PASS',()=>{
    const {c,answer}=completionFixture();answer.missingDecisions[0].certainty='uncertain';expect(compileSourceImpactCompletion(c,answer).status).toBe('held_uncertain');
    const other=completionFixture();other.answer.additionalFindings=[{...other.answer.missingDecisions[0],id:'add-1',impact:'safety'}];
    expect(compileSourceImpactCompletion(other.c,other.answer).status).toBe('held_material');
  });
  it.each(['held-guard','uncertain-guard','material-row','uncertain-row','foreign-row','duplicate-row','invalid-evidence'])('refuses format-only recovery of %s',variant=>{
    const {p,partial}=completionFixture();
    if(variant==='held-guard')partial.guards[0].status='held';
    if(variant==='uncertain-guard')partial.guards[0].status='uncertain';
    if(variant==='material-row')partial.decisions[0].impact='story';
    if(variant==='uncertain-row')partial.decisions[0].certainty='uncertain';
    if(variant==='foreign-row')partial.decisions[0].id='foreign';
    if(variant==='duplicate-row')partial.decisions.push(structuredClone(partial.decisions[0]));
    if(variant==='invalid-evidence')partial.decisions[0].evidence[0].anchor='רות יצא';
    expect(()=>prepareSourceImpactCompletion(p,partial)).toThrow();
  });
  it('rejects missing/foreign completion IDs, changed digest and changed parent raw',()=>{
    const {c,answer}=completionFixture();expect(()=>compileSourceImpactCompletion(c,{...answer,missingDecisions:[]})).toThrow();
    const b=structuredClone(answer);b.missingDecisions[0].id='foreign';expect(()=>compileSourceImpactCompletion(c,b)).toThrow();
    expect(()=>compileSourceImpactCompletion(c,{...answer,completionDigest:'b'.repeat(64)})).toThrow('source_completion_binding');
    c.partialRaw={...(c.partialRaw as object),summary:'Changed existing typed summary is forbidden'};
    expect(()=>compileSourceImpactCompletion(c,answer)).toThrow('source_completion_binding');
  });
  it('the completion is one separately claimed step within the same cumulative98-call/USD7 ledger',async()=>{
    const meter=new TrialApiMeter(root()),w={...wire,stage:'source_impact_completion'};expect(trialApiRules('source_impact_completion')?.reserve(w)).toBe(600000);
    await meter.run('source_impact_review',{...wire,stage:'source_impact_review'},600000,async()=>({value:1,estimatedMicroUsd:54,receipt:receipt()}));
    await meter.run('source_impact_completion',w,600000,async()=>({value:2,estimatedMicroUsd:54,receipt:receipt()}));
    expect(meter.snapshot().calls).toBe(2);expect(meter.snapshot().newKnownApiMicroUsd).toBe(108);
    let dispatched=false;await expect(meter.run('source_impact_completion',w,600000,async()=>{dispatched=true;return{value:1,estimatedMicroUsd:54,receipt:receipt()};})).rejects.toThrow();
    expect(dispatched).toBe(false);expect(trialApiRules('s5_storyboard_review')).toBeDefined();
    expect(trialApiRules('s5_final_review')).toBeUndefined();
  });
});
