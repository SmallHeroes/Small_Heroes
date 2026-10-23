import { describe,it,expect } from 'vitest';
import { mkdtempSync,readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { SOL_CACHE_BUDGET,solCacheWriteAdjustment,solCacheReserveMargin } from '../../../scripts/personal-sol-cache-budget';
import { TrialApiMeter } from '../../../scripts/personal-book-e2e-trial';
const root=()=>mkdtempSync(path.join(tmpdir(),'sol-cache-test-'));
const wire=(options?:unknown)=>({role:'astra',stage:'final_review',model:'gpt-6.1-sol',outputCap:16000,
 json:JSON.stringify({model:'gpt-6.1-sol',service_tier:'default',input:'synthetic',...(options!==undefined?{prompt_cache_options:options}:{})})});
const raw=(writes=11,reads=0)=>({model:'gpt-6.1-sol',service_tier:'default',status:'completed',output_text:'{}',
 usage:{input_tokens:12,output_tokens:3,input_tokens_details:{cache_write_tokens:writes,cached_tokens:reads}}});
const receipt=(r=raw())=>({raw:r,usage:{inputTokens:12,outputTokens:3},estimatedMicroUsd:54});
describe('explicit raw-based Sol cache-write budget supplement; no provider',()=>{
 it('reproduces all5 inherited real usage counts and per-call rounding without changing base records',()=>{
  const rows=[[5405,5402,20600,23301],[3647,3644,10774,12596],[24875,24872,82110,94546],[18739,18736,232748,242116],[27454,27451,98278,112004]];
  const delta=rows.map(([input,writes,base,total])=>{const r=raw();r.usage.input_tokens=input;r.usage.input_tokens_details.cache_write_tokens=writes;
   const n=solCacheWriteAdjustment(wire(),r);expect(base+n).toBe(total);return n;});
  expect(delta.reduce((a,b)=>a+b,0)).toBe(40053);expect(444510+delta.reduce((a,b)=>a+b,0)).toBe(484563);expect(SOL_CACHE_BUDGET).toBe('sol-default-cache-write-budget/v1');
 });
 it('does not take a cached-read discount or charge a write twice',()=>{
  expect(solCacheWriteAdjustment(wire(),raw(5,7))).toBe(3);expect(solCacheWriteAdjustment(wire(),raw(0,12))).toBe(0);
  expect(solCacheReserveMargin(wire(),600000)).toBe(150000);expect(solCacheReserveMargin({model:'gpt-4o'},600000)).toBe(0);
 });
 it.each([{ttl:'12h'},{ttl:'unknown'},{},{ttl:'30m',other:true},null,'30m'])('refuses unsupported/partial TTL %j',options=>{
  expect(()=>solCacheReserveMargin(wire(options),600000)).toThrow('trial_sol_cache_pricing');
 });
 it('accepts only default/explicit30m and refuses retention knobs,wrong tier/model,long context',()=>{
  expect(solCacheWriteAdjustment(wire({ttl:'30m'}),raw())).toBe(6);
  expect(()=>solCacheWriteAdjustment({...wire(),json:JSON.stringify({model:'gpt-6.1-sol',prompt_cache_retention:'12h'})},raw())).toThrow();
  expect(()=>solCacheWriteAdjustment(wire(),{...raw(),model:'gpt-6-astra'})).toThrow();
  expect(()=>solCacheWriteAdjustment(wire(),{...raw(),service_tier:'priority'})).toThrow();
  const long=raw();long.usage.input_tokens=272001;expect(()=>solCacheWriteAdjustment(wire(),long)).toThrow();
 });
 it.each([undefined,null,-1,1.2,true,13])('does not treat missing/invalid write count %j aszero',writes=>{
  const r:any=raw();r.usage.input_tokens_details.cache_write_tokens=writes;expect(()=>solCacheWriteAdjustment(wire(),r)).toThrow();
 });
 it('refuses missing/invalid reads, impossible mixed counts and partial response TTL',()=>{
  const r:any=raw();delete r.usage.input_tokens_details.cached_tokens;expect(()=>solCacheWriteAdjustment(wire(),r)).toThrow();
  expect(()=>solCacheWriteAdjustment(wire(),raw(11,2))).toThrow();expect(()=>solCacheWriteAdjustment(wire(),{...raw(),prompt_cache_options:{}})).toThrow();
 });
 it('legacy snapshots remain byte-equivalent and opt-in snapshots expose base separately',async()=>{
  const folder=root(),old=new TrialApiMeter(folder);await old.run('s0_final_review',wire(),600000,async()=>({value:1,estimatedMicroUsd:54,receipt:receipt()}));
  const before=old.snapshot(),updated=new TrialApiMeter(folder,'',true).snapshot() as any;
  expect(old.snapshot()).toEqual(before);expect(before.cumulativeAccountedMicroUsd).toBe(54);expect(before).not.toHaveProperty('cacheWritePricing');
  expect(updated).toMatchObject({baseLedgerAccountedMicroUsd:54,cacheWriteAdjustmentMicroUsd:6,pendingCacheWriteReserveMicroUsd:0,cumulativeAccountedMicroUsd:60,calls:1,failed:0});
 });
 it('pending margin becomes settled supplement once, not both and not free headroom',async()=>{
  const meter=new TrialApiMeter(root(),'',true);let release!:(v:any)=>void;const ready=new Promise<any>(r=>{release=r;});
  const running=meter.run('s0_final_review',wire(),600000,()=>ready),pending=meter.snapshot() as any;
  expect(pending).toMatchObject({cacheWriteAdjustmentMicroUsd:0,pendingCacheWriteReserveMicroUsd:150000,cumulativeAccountedMicroUsd:750000,unknownOutcome:1});
  release({value:1,estimatedMicroUsd:54,receipt:receipt()});await running;
  expect(meter.snapshot()).toMatchObject({cacheWriteAdjustmentMicroUsd:6,pendingCacheWriteReserveMicroUsd:0,cumulativeAccountedMicroUsd:60,unknownOutcome:0});
 });
 it('rejects adjusted cap boundary BEFORE any claim or callback although base reservation would fit',async()=>{
  const folder=root(),meter=new TrialApiMeter(folder,'',true);Object.defineProperty(meter,'capMicroUsd',{value:700000}); // Synthetic policy boundary,never real authority.
  let calls=0;await expect(meter.run('s0_final_review',wire(),600000,async()=>{calls++;return{value:1,estimatedMicroUsd:54,receipt:receipt()};})).rejects.toThrow('audition_budget_exhausted');
  expect(calls).toBe(0);expect(readdirSync(folder)).toEqual([]);
 });
 it('keeps failed known fees and unknown failures honestly counted; no new retry',async()=>{
  const meter=new TrialApiMeter(root(),'',true);await expect(meter.run('s0_final_review',wire(),600000,async()=>{throw Object.assign(Error('knownbadoutput'),{receipt:receipt()});})).rejects.toThrow('knownbadoutput');
  expect(meter.snapshot()).toMatchObject({cumulativeAccountedMicroUsd:60,failed:1,calls:1});
  await expect(meter.run('s0_comparison',wire(),600000,async()=>{throw Error('unknown');})).rejects.toThrow('unknown');
  expect(meter.snapshot()).toMatchObject({unknownCost:1,calls:2});let called=false;
  await expect(meter.run('s0_storyboard_review',wire(),600000,async()=>{called=true;return{} as any;})).rejects.toThrow();expect(called).toBe(false);
 });
});
