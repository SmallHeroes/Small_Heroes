import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decodeTrialStoryboardReview,SOL_RECEIPT_RECOVERY,trialApiRules } from '../../../scripts/personal-book-e2e-trial';
import { STORYBOARD_BOOK_CHECKS,STORYBOARD_FRAME_CHECKS } from '../storyboard';
import { decodePersonalBookProviderOutput } from '../book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
const check=()=>({verdict:'supported',observation:'Synthetic schema and launch-mode proof only, not pixel or model evidence.'});
const group=(names:readonly string[])=>Object.fromEntries(names.map(n=>[n,check()]));
const answer=()=>({bookChecks:group(STORYBOARD_BOOK_CHECKS),frames:Array.from({length:9},()=>group(STORYBOARD_FRAME_CHECKS))});
const call={stage:'review',context:{narrativeSpreads:8,sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64)},maxOutputTokens:39000} as SimpleStoryboardDiagnosticCall;
const raw=(value:unknown,extra:Record<string,unknown>={})=>({model:'gpt-6.1-sol',service_tier:'default',status:'completed',output_text:JSON.stringify(value),usage:{input_tokens:12,output_tokens:3},...extra});
describe('native review decoder on a completed, already-priced response',()=>{
 it('uses the exact shared decoder, binding metadata rather than a second classifier',()=>{
  const value=answer(),response=raw(value),decoded=decodeTrialStoryboardReview(call,response);
  expect(decoded.value).toEqual(decodePersonalBookProviderOutput(call,value));expect(decoded.estimatedMicroUsd).toBe(54);
  expect(decoded.receipt.raw).toBe(response);expect(decoded.receipt.stage).toBe('storyboard_review');
 });
 it.each([
  ['wrong model',{model:'gpt-6-astra'}],['wrong tier',{service_tier:'priority'}],['unknown usage',{usage:null}],
  ['incomplete',{status:'incomplete'}],['output cap',{usage:{input_tokens:12,output_tokens:39001}}],
 ])('refuses %s before decoding without losing the original receipt',(_name,extra)=>{
  const response=raw(answer(),extra);try{decodeTrialStoryboardReview(call,response);throw Error('not refused');}
  catch(e:any){expect(e.message).toBe('trial_review_invalid');expect(e.receipt.raw).toBe(response);}
 });
 it.each(['missing_group','missing_frame','extra_field','wrong_enum'])('does not normalize or invent schema data for %s',kind=>{
  const value:any=answer();if(kind==='missing_group')delete value.bookChecks.continuity;if(kind==='missing_frame')value.frames.pop();
  if(kind==='extra_field')value.approved=true;if(kind==='wrong_enum')value.frames[0].moment.verdict='PASS';
  const response=raw(value);try{decodeTrialStoryboardReview(call,response);throw Error('not refused');}
  catch(e:any){expect(e.message).toBe('trial_review_schema');expect(e.decodeCause).toBe('book_provider_schema');expect(e.receipt.estimatedMicroUsd).toBe(54);expect(e.receipt.raw).toBe(response);}
 });
 it('preserves known cost and bounded diagnostic cause on malformed JSON',()=>{
  try{decodeTrialStoryboardReview(call,raw(null,{output_text:'not-json'}));throw Error('not refused');}
  catch(e:any){expect(e.decodeCause).toBe('malformed_json');expect(e.receipt.estimatedMicroUsd).toBe(54);}
 });
 it('does not turn a structurally valid uncertainty into supported or rewrite its observation',()=>{
  const value=answer();value.frames[1].moment={verdict:'uncertain',observation:'Synthetic insufficient evidence'};
  const result:any=decodeTrialStoryboardReview(call,raw(value)).value;
  expect(result.frames[1].checks[0]).toMatchObject({verdict:'uncertain',observation:'Synthetic insufficient evidence'});
 });
 it('fixes one recovery slot, never a newly priced text slot or an extra model attempt',()=>{
  expect(SOL_RECEIPT_RECOVERY.version).toBe('reader-safe-sol-receipt-recovery/v1');
  for(const name of ['sol_receipt_storyboard','sol_receipt_review','sol2_storyboard','receipt_recovery_review'])expect(trialApiRules(name)).toBeUndefined();
  const source=readFileSync(path.join(process.cwd(),'scripts/personal-book-e2e-trial.ts'),'utf8');
  expect(source).not.toContain("await import('../lib/personal-wizard/book-openai')");
 });
});
