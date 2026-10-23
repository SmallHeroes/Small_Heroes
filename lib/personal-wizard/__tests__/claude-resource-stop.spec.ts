import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { claudeQuotaStop, observeClaudeQuotaStop, trialFailureDetails, type ClaudeQuotaStop } from '../claude-resource-stop';
import { SimpleBookBudget } from '../simple-book-budget';

const output=()=>({type:'result',is_error:true,terminal_reason:'api_error',api_error_status:429,total_cost_usd:0,
  usage:{input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0},modelUsage:{},
  result:"You've hit your weekly limit · resets Oct 25, 4am (Asia/Jerusalem)"});
const receipt=()=>({estimatedMicroUsd:0,raw:{termination:{code:1,signal:null},killConfirmed:true,stopped:false,stdout:JSON.stringify(output()),stderr:''}});
describe('strict Claude quota observability, never recovery/payment authority',()=>{
  it.each(['weekly','daily','monthly'] as const)('recognizes a terminated known-reported0 %s refusal without promising future availability',period=>{
    const r=receipt(),raw=output();raw.result=`You've hit your ${period} limit`;r.raw.stdout=JSON.stringify(raw);
    expect(claudeQuotaStop(r)).toEqual({version:'claude-resource-stop/v1',code:'provider_quota_exhausted',provider:'claude_max',quotaPeriod:period,
      providerStatus:429,reportedResourceMicroUsd:0,automaticRetryAllowed:false,continuationGranted:false,futureAvailabilityVerified:false});
  });
  it.each([
    ['unknown cost',(r:any)=>r.estimatedMicroUsd=null],['positive cost',(r:any)=>r.estimatedMicroUsd=1],
    ['live process',(r:any)=>r.raw.killConfirmed=false],['signal',(r:any)=>r.raw.termination.signal='SIGTERM'],
    ['successful termination',(r:any)=>r.raw.termination.code=0],['stopped wrapper',(r:any)=>r.raw.stopped=true],
    ['malformed stdout',(r:any)=>r.raw.stdout='{'],['oversized stdout',(r:any)=>r.raw.stdout='x'.repeat(16001)],
    ['ordinary429',(r:any,o:any)=>o.result='Rate limit exceeded, try later'],['auth403',(r:any,o:any)=>o.api_error_status=403],
    ['generated answer',(r:any,o:any)=>o.is_error=false],['non-api stop',(r:any,o:any)=>o.terminal_reason='interrupted'],
    ['unknown usage',(r:any,o:any)=>o.usage=null],['missing token field',(r:any,o:any)=>delete o.usage.input_tokens],
    ['positive usage',(r:any,o:any)=>o.usage.output_tokens=1],['positive raw cost',(r:any,o:any)=>o.total_cost_usd=.1],
    ['model billed',(r:any,o:any)=>o.modelUsage={'claude-opus-5-5':{}}],['malformed modelUsage',(r:any,o:any)=>o.modelUsage=true],
    ['structured answer',(r:any,o:any)=>o.structured_output={}],['wrong type',(r:any,o:any)=>o.type='message'],
  ])('does not misclassify %s as a known0 quota refusal',(name,mutate)=>{
    const r=receipt(),raw:any=output();(mutate as any)(r,raw);
    if(!['malformed stdout','oversized stdout'].includes(name as string))r.raw.stdout=JSON.stringify(raw);
    expect(claudeQuotaStop(r)).toBeNull();
  });
  it.each([null,undefined,0,'weekly limit',{},[]])('refuses missing/unstructured evidence %s',r=>expect(claudeQuotaStop(r)).toBeNull());
  it('captures the cause before a generic callback wrapper but rethrows the exact original and does not retry or mutate the receipt',async()=>{
    const r=receipt(),before=JSON.stringify(r),error=Object.assign(new Error('CLI refused'),{code:'cli_termination',receipt:r});
    let stop:ClaudeQuotaStop|null=null;const dispatch=vi.fn(async()=>{throw error;});
    await expect(observeClaudeQuotaStop(dispatch,s=>{stop=s;})).rejects.toBe(error);
    expect(dispatch).toHaveBeenCalledTimes(1);expect(JSON.stringify(r)).toBe(before);
    expect(trialFailureDetails(new Error('personal_storyboard_author_failed'),stop)).toMatchObject({code:'provider_quota_exhausted',providerStop:{continuationGranted:false}});
    expect(trialFailureDetails(Object.assign(new Error('x'),{code:'existing_failure'}),null)).toEqual({code:'existing_failure'});
    expect(trialFailureDetails(new Error('x'),null)).toEqual({code:'trial_failure'});
  });
  it('an observer/logging failure cannot erase the original provider receipt or replace its failure',async()=>{
    const error=Object.assign(new Error('quota'),{receipt:receipt()}),dispatch=vi.fn(async()=>{throw error;});
    await expect(observeClaudeQuotaStop(dispatch,()=>{throw Error('log failed');})).rejects.toBe(error);
    expect(error.receipt.estimatedMicroUsd).toBe(0);expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('a successful result passes through unchanged without producing any stop observation',async()=>{
    const value={value:'synthetic success'},observe=vi.fn();expect(await observeClaudeQuotaStop(async()=>value,observe)).toBe(value);
    expect(observe).not.toHaveBeenCalled();
  });
  it('the real budget journal still consumes the failed attempt, preserves original failure, and refuses another callback even at reported0',async()=>{
    const root=mkdtempSync(path.join(tmpdir(),'quota-observe-test-')),meter=new SimpleBookBudget(root,0),r=receipt(),error=Object.assign(new Error('quota'),{code:'cli_termination',receipt:r});
    let stop:ClaudeQuotaStop|null=null;const dispatch=vi.fn(async()=>{throw error;});
    await expect(meter.run('storyboard',{},2000000,()=>observeClaudeQuotaStop(dispatch,s=>{stop=s;}))).rejects.toBe(error);
    expect(meter.snapshot()).toMatchObject({logicalAttempts:1,accountedMicroUsd:0,knownEstimateMicroUsd:0,unknownAttemptCosts:0,stopped:true});
    expect(JSON.parse(readFileSync(path.join(root,'storyboard.failure.json'),'utf8'))).toEqual({code:'cli_termination',receipt:r});
    await expect(meter.run('storyboard_again',{},2000000,dispatch)).rejects.toThrow('simple_paid_outcome_unknown_or_failed');
    expect(dispatch).toHaveBeenCalledTimes(1);expect(trialFailureDetails(new Error('generic callback failed'),stop).code).toBe('provider_quota_exhausted');
  });
  it('unknown usage/cost remains fully reserved and stopped, not made free by a quota-looking message',async()=>{
    const root=mkdtempSync(path.join(tmpdir(),'quota-unknown-test-')),meter=new SimpleBookBudget(root,0),r:any=receipt();r.estimatedMicroUsd=null;
    const observe=vi.fn(),error=Object.assign(new Error('unknown'),{receipt:r});
    await expect(meter.run('storyboard',{},2000000,()=>observeClaudeQuotaStop(async()=>{throw error;},observe))).rejects.toBe(error);
    expect(observe).not.toHaveBeenCalled();expect(meter.snapshot()).toMatchObject({accountedMicroUsd:2000000,unknownAttemptCosts:1,stopped:true});
  });
});
