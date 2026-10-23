import {describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {BOOK_E2E_TRIAL,TrialApiMeter,TrialMaxBudget,trialApiRules,trialConfigSchema} from '../../../scripts/personal-book-e2e-trial';
import {auditionRenderPlan} from '../../../scripts/personal-simple-book-reviewed-audition';

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
