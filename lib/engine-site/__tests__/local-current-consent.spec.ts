/** One-use consent, durable dispatch witnesses and resume-by-one-provider-id of the local current-engine rehearsal. Synthetic, no provider. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,renameSync,rmSync,unlinkSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {CausalDispatch} from '@/lib/personal-wizard/story-causal-experiment-runner';
import {LocalEngineTrialRuntime,LOCAL_CURRENT_ENGINE_MAX_CALLS} from '../local-trial-runtime';
import {ENGINE_CURRENT_CUSTOMER} from '../current-engine-policy';
import {engineSpendPolicySchema} from '../platform-policy';
import {prepareEngineAnthropic} from '../provider-plans';
import {engineCustomerAuthority} from '../personal-jobs';
import {prepareEngineOrder,resolveEngineWizardOptions} from '../personal-orders';
import {syntheticEngineOrderInput} from './synthetic-order';
import {localConsentLedger,claimLocalConsent,acquireLocalLease,localConsentDispatchWitness,localLedgerTransaction,type LocalConsentBinding} from '../local-consent-ledger';

const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(r)!==path.resolve(tmpdir())||!path.basename(r).startsWith('sh_local_consent_'))throw Error('owned_test_only');rmSync(r,{recursive:true,force:true});}});
const scratch=()=>{const r=mkdtempSync(path.join(tmpdir(),'sh_local_consent_'));roots.push(r);return r;};
const policy=()=>engineSpendPolicySchema.parse({version:'engine-site-spend-policy/v1',sourceRevision:'a'.repeat(40),maximumMicroUsd:12_000_000,
 maximumCalls:LOCAL_CURRENT_ENGINE_MAX_CALLS,approvalReference:'SYNTHETIC_LOCAL',approvedBy:'synthetic_owner',approvedAt:'2026-11-12T00:00:00.000Z',
 paidProviderActivation:'owner_approved_live_personal_orders',
 engineProfile:{version:ENGINE_CURRENT_CUSTOMER,imageModelPolicy:{version:'image26-local-book/v1',model:'gpt-image-2.6-sunburst',complexity:'high'}}});
const current=()=>{const p=prepareEngineOrder(syntheticEngineOrderInput(),{id:'local_owner',email:'fixture@example.invalid',name:'Synthetic'},resolveEngineWizardOptions());
 return engineCustomerAuthority('local_current_synthetic',p.snapshot,p.inputSha256,policy());};
const dispatch=():CausalDispatch=>({role:'opus',stage:'author',conversationKey:'synthetic_author',input:'SYNTHETIC brief',
 instructions:'SYNTHETIC instructions',schema:z.object({text:z.string().min(2)}).strict(),maxOutputTokens:8000});
const message={id:'msg_synthetic',type:'message',model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({text:'Synthetic story'})}],
 usage:{input_tokens:1000,output_tokens:500,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'batch'}};
const reply=(value:unknown)=>new Response(JSON.stringify(value),{status:200});
/** A fake Anthropic batch endpoint: POST creates `id`, polls report it in progress until `endedAfter`, then the results. */
function batchFetch(id='msgbatch_original',endedAfter=1){
 const calls:{url:string;method:string}[]=[];let polls=0;
 const fetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{const url=String(input),method=init?.method??'GET';calls.push({url,method});
  if(method==='POST')return reply({id,processing_status:'in_progress'});
  if(url.endsWith('/results'))return new Response(JSON.stringify({custom_id:'story_author',result:{type:'succeeded',message}})+'\n');
  polls++;return reply({id:url.split('/batches/')[1]?.split('/')[0],processing_status:polls>endedAfter?'ended':'in_progress',
   results_url:`https://api.anthropic.com/v1/messages/batches/${id}/results`});}) as unknown as typeof globalThis.fetch;
 return {fetch,calls,posts:()=>calls.filter(c=>c.method==='POST').length,polled:()=>calls.filter(c=>c.method==='GET').map(c=>c.url)};
}
const ports=(fetch:typeof globalThis.fetch)=>({fetch,openAIKey:()=>'unused',anthropicKey:()=>'SYNTHETIC_KEY'});
function binding(out:string,authority:unknown,goSha256='1'.repeat(64)):LocalConsentBinding{
 return {approvalReference:'synthetic_consent',registrationSha256:'5'.repeat(64),goSha256,goCanonicalSha256:'2'.repeat(64),sourceRevision:'a'.repeat(40),profileSha256:'3'.repeat(64),
  authoritySha256:canonicalHash(authority),out,journal:path.join(out,'journal')};
}
/** One claimed consent with its witness and a runtime over `journal`; `pause` interrupts the first pending poll by default. */
function claimed(a=current()){
 const base=scratch(),ledger=localConsentLedger(path.join(base,'ledger'),'synthetic_consent'),out=path.join(base,'run');mkdirSync(out);
 const consent=claimLocalConsent(ledger,binding(out,a),false),witness=localConsentDispatchWitness(ledger,consent.consentSha256,a);
 let interrupt=true;
 const options={root:path.join(out,'journal'),authority:a,ownerId:'local_owner',draftId:'d_localcurrent1',snapshotSha256:'a'.repeat(64),assertCurrent:()=>{},
  dispatchWitness:witness,pause:async()=>{if(interrupt)throw Error('synthetic_process_exit');}};
 return {a,base,ledger,out,consent,witness,options,resumeFreely:()=>{interrupt=false;},runtime:()=>new LocalEngineTrialRuntime(options)};
}
const stepDir=(s:{out:string},step='story_author')=>path.join(s.out,'journal','calls',step);
const responsesDone={usable:true,output:{ok:true},raw:{},estimatedMicroUsd:100};
/** A synthetic OpenAI background response plan: the first dispatch returns resp_original pending; collection completes (or, `stop`, refuses). */
function responsesPlan(a:ReturnType<typeof current>,seen:(string|undefined)[],stop=false){
 const step=a.budget.steps.find(x=>x.id==='page_0_0_qa')!,wire={endpoint:'https://api.openai.com/v1/responses',step:step.id,synthetic:true};
 return {wire,call:{step:step.id,wireSha256:canonicalHash(wire),maximumMicroUsd:step.maximumMicroUsd},requiredMs:20_000,completionDeadlineMs:240_000,admitSaved:()=>{},
  execute:async(id:string|undefined)=>{seen.push(id);if(id&&stop)throw Error('synthetic_collection_reached');
   return id?{kind:'completed',result:responsesDone}:{kind:'pending',id:'resp_original',raw:{id:'resp_original',status:'queued'}};}} as any;
}
const editJson=(file:string,edit:(v:any)=>unknown)=>writeFileSync(file,JSON.stringify(edit(JSON.parse(readFileSync(file,'utf8'))),null,2)+'\n');

describe('one owner consent is consumed once, machine-wide',()=>{
 it('a serial copy, another folder and a changed binding are refused; only the exact recorded binding resumes',()=>{
  const a=current(),base=scratch(),ledger=localConsentLedger(path.join(base,'ledger'),'synthetic_consent');
  const first=claimLocalConsent(ledger,binding(path.join(base,'a'),a),false);
  expect(()=>claimLocalConsent(ledger,binding(path.join(base,'a'),a),false)).toThrow('local_current_consent_used');
  // The same GO copied into another folder is the same consent, not a new approval.
  expect(()=>claimLocalConsent(ledger,binding(path.join(base,'b'),a),false)).toThrow('local_current_consent_used');
  expect(()=>claimLocalConsent(ledger,binding(path.join(base,'b'),a),true)).toThrow('local_current_consent_binding');
  expect(()=>claimLocalConsent(ledger,binding(path.join(base,'a'),a,'9'.repeat(64)),true)).toThrow('local_current_consent_binding');
  expect(claimLocalConsent(ledger,binding(path.join(base,'a'),a),true).consentSha256).toBe(first.consentSha256);
  // A consent never claimed cannot be resumed.
  expect(()=>claimLocalConsent(localConsentLedger(path.join(base,'ledger'),'other_consent'),binding(path.join(base,'c'),a),true)).toThrow('local_current_resume_without_consent');
 });
 it('four processes racing one consent from four folders: exactly one claim succeeds',async()=>{
  const base=scratch(),ledgerRoot=path.join(base,'ledger'),repo=path.resolve(__dirname,'../../..');
  const script=path.join(base,'claim.ts');
  writeFileSync(script,`import {localConsentLedger,claimLocalConsent} from ${JSON.stringify(path.join(repo,'lib/engine-site/local-consent-ledger.ts'))};
const [root,out]=process.argv.slice(2);
try{claimLocalConsent(localConsentLedger(root,'synthetic_consent'),{approvalReference:'synthetic_consent',registrationSha256:'5'.repeat(64),goSha256:'1'.repeat(64),goCanonicalSha256:'2'.repeat(64),
 sourceRevision:'a'.repeat(40),profileSha256:'3'.repeat(64),authoritySha256:'4'.repeat(64),out,journal:out+'/journal'},false);console.log('CLAIMED');}
catch(e){console.log('REFUSED '+(e as Error).message);}`);
  const run=(out:string)=>new Promise<string>((resolve,reject)=>{const child=spawn(process.execPath,[path.join(repo,'node_modules/tsx/dist/cli.mjs'),
   '--require',path.join(repo,'scripts/shims/register-server-only.cjs'),script,ledgerRoot,out],{cwd:repo,stdio:['ignore','pipe','pipe']});let text='';
   child.stdout.on('data',d=>{text+=d;});child.on('error',reject);child.on('close',()=>resolve(text.trim()));});
  const results=await Promise.all(['a','b','c','d'].map(n=>run(path.join(base,n))));
  expect(results.filter(r=>r==='CLAIMED')).toHaveLength(1);
  expect(results.filter(r=>r==='REFUSED local_current_consent_used')).toHaveLength(3);
 },60_000);
 it('one live process per consent; a dead holder is taken over by --resume only',()=>{
  const s=claimed(),lease=acquireLocalLease(s.ledger,s.consent.consentSha256,false);
  expect(()=>acquireLocalLease(s.ledger,s.consent.consentSha256,true)).toThrow('local_current_running');
  lease.assert();lease.release();expect(existsSync(s.ledger.leaseFile)).toBe(false);
  writeFileSync(s.ledger.leaseFile,JSON.stringify({version:'engine-local-current-lease/v1',consentSha256:s.consent.consentSha256,pid:2147483646,startedAt:'x'}));
  expect(()=>acquireLocalLease(s.ledger,s.consent.consentSha256,false)).toThrow('local_current_resume_required');
  const taken=acquireLocalLease(s.ledger,s.consent.consentSha256,true);taken.assert();
  expect(readdirSync(s.ledger.root).some(n=>n.includes('.lease-stale-'))).toBe(true);
  taken.release();
 });
});

describe('stale-lease takeover is one serialized transaction that revalidates the exact generation (R2-LC1B)',()=>{
 const deadPid=2147483646;
 const stale=(s:ReturnType<typeof claimed>)=>writeFileSync(s.ledger.leaseFile,JSON.stringify({version:'engine-local-current-lease/v1',consentSha256:s.consent.consentSha256,pid:deadPid,startedAt:'x'}));
 /** process.kill(deadPid) reports the holder dead; on its `at`-th liveness probe it first runs `inside` (a second contender, interleaved). */
 const interleave=(at:number,inside:()=>void)=>{const native=process.kill.bind(process);let probes=0;
  return vi.spyOn(process,'kill').mockImplementation(((pid:number,signal?:string|number)=>{if(pid!==deadPid)return native(pid,signal);
   if(++probes===at)inside();throw Object.assign(Error('synthetic dead holder'),{code:'ESRCH'});}) as typeof process.kill);};
 const archived=(s:ReturnType<typeof claimed>)=>readdirSync(s.ledger.root).filter(n=>n.includes('.lease-stale-')).map(n=>JSON.parse(readFileSync(path.join(s.ledger.root,n),'utf8')).pid);
 it('positive control: one resumer takes over a dead holder, archives exactly that generation and leaves no transaction behind',()=>{
  const s=claimed();stale(s);
  const taken=acquireLocalLease(s.ledger,s.consent.consentSha256,true);taken.assert();
  expect(archived(s)).toEqual([deadPid]);expect(existsSync(s.ledger.leaseTransactionFile)).toBe(false);
  taken.release();expect(existsSync(s.ledger.leaseFile)).toBe(false);
 });
 it('two stale contenders, the second completing first: the first refuses inside the transaction and never moves the newly live lease',()=>{
  const s=claimed();stale(s);let inner:ReturnType<typeof acquireLocalLease>|undefined;
  // Both inspect the same dead generation; the inner contender completes its takeover during the outer one's first liveness probe.
  const spy=interleave(1,()=>{inner=acquireLocalLease(s.ledger,s.consent.consentSha256,true,process.pid);});
  try{expect(()=>acquireLocalLease(s.ledger,s.consent.consentSha256,true,process.ppid)).toThrow('local_current_running');}finally{spy.mockRestore();}
  expect(inner).toBeDefined();inner!.assert();
  expect(archived(s)).toEqual([deadPid]);expect(existsSync(s.ledger.leaseTransactionFile)).toBe(false);
  inner!.release();
 });
 it('two stale contenders, the second arriving while the first holds the transaction: the second refuses and the first takes over',()=>{
  const s=claimed();stale(s);let refused='';
  const spy=interleave(2,()=>{try{acquireLocalLease(s.ledger,s.consent.consentSha256,true,process.pid);}catch(e){refused=(e as Error).message;}});
  let outer:ReturnType<typeof acquireLocalLease>|undefined;
  try{outer=acquireLocalLease(s.ledger,s.consent.consentSha256,true,process.ppid);}finally{spy.mockRestore();}
  expect(refused).toBe('local_current_running');outer!.assert();expect(archived(s)).toEqual([deadPid]);
  outer!.release();
 });
 it('a transaction left by a crash is never guessed away: every contender refuses until it is resolved',()=>{
  const s=claimed();stale(s);
  writeFileSync(s.ledger.leaseTransactionFile,JSON.stringify({version:'engine-local-current-transaction/v1',pid:deadPid,startedAt:'x'}));
  expect(()=>acquireLocalLease(s.ledger,s.consent.consentSha256,true)).toThrow('local_current_transaction_ambiguous');
  writeFileSync(s.ledger.leaseTransactionFile,'not json');
  expect(()=>acquireLocalLease(s.ledger,s.consent.consentSha256,true)).toThrow('local_current_transaction_ambiguous');
  expect(archived(s)).toEqual([]);
  // A body that fails after it began mutating keeps its lock (ambiguous); one that refuses before leaves nothing.
  const lock=path.join(s.base,'tx.json');
  expect(()=>localLedgerTransaction(lock,()=>{throw Error('refused_before');})).toThrow('refused_before');expect(existsSync(lock)).toBe(false);
  expect(()=>localLedgerTransaction(lock,mutating=>{mutating();throw Error('failed_inside');})).toThrow('failed_inside');expect(existsSync(lock)).toBe(true);
 });
});

describe('a lost journal or checkpoint keeps every reserve and refuses before any provider',()=>{
 it('the journal of a pending author call is lost: full reserve, blocked, no second POST (with and without the consent witness)',async()=>{
  for(const witnessed of [true,false]){
   const s=claimed(),f=batchFetch();if(!witnessed)delete (s.options as any).dispatchWitness;
   const slot=s.a.budget.steps.find(x=>x.id==='story_author')!.maximumMicroUsd;
   await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
   renameSync(path.join(s.out,'journal','calls'),path.join(s.out,'journal','calls-moved'));
   const again=s.runtime(),meter=await again.meter();
   expect(meter).toMatchObject({pendingCalls:1,accountedMicroUsd:slot,blocked:true});
   await expect(again.call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('local_trial_budget_or_unknown');
   expect(f.posts()).toBe(1);
  }
 });
 it('a missing checkpoint beside saved calls refuses to start; a whole missing journal keeps the witnessed reserve and refuses the call',async()=>{
  const s=claimed(),f=batchFetch(),slot=s.a.budget.steps.find(x=>x.id==='story_author')!.maximumMicroUsd;
  await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
  unlinkSync(path.join(s.out,'journal','checkpoint.json'));
  expect(()=>s.runtime()).toThrow('local_trial_checkpoint_missing');
  rmSync(path.join(s.out,'journal'),{recursive:true});
  const fresh=s.runtime();expect(await fresh.meter()).toMatchObject({pendingCalls:1,accountedMicroUsd:slot,lostLocalCalls:1,blocked:true});
  await expect(fresh.call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('local_trial_budget_or_unknown');
  expect(f.posts()).toBe(1);
 });
});

describe('a resume collects exactly the one provider id the first dispatch returned',()=>{
 it('intact: the same batch id resumes with one POST, and the witness holds the first id and dispatch time',async()=>{
  const s=claimed(),f=batchFetch('msgbatch_original',3);
  await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
  const first=s.witness.observed!('story_author')!;
  expect(first).toMatchObject({id:'msgbatch_original'});
  expect(first.dispatchAt).toBe(JSON.parse(readFileSync(path.join(stepDir(s),'dispatch.json'),'utf8')).at);
  s.resumeFreely();
  expect(await s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).toMatchObject({usable:true});
  expect(f.posts()).toBe(1);expect(f.polled().every(u=>u.includes('msgbatch_original'))).toBe(true);
 });
 it('a conflicting saved observation, raw answer, checkpoint id or first-id witness stops before the transport',async()=>{
  const conflicts:[string,(s:ReturnType<typeof claimed>)=>void][]=[
   ['observation',s=>editJson(path.join(stepDir(s),'pending-00000.json'),v=>({...v,id:'msgbatch_other'}))],
   ['raw',s=>editJson(path.join(stepDir(s),'pending-00000.json'),v=>({...v,raw:{...v.raw,id:'msgbatch_other'}}))],
   ['checkpoint',s=>editJson(path.join(s.out,'journal','checkpoint.json'),v=>{v.calls.story_author.pendingId='msgbatch_other';return v;})],
   ['witness',s=>editJson(s.ledger.providerFile('story_author'),v=>({...v,id:'msgbatch_other'}))],
   ['gap',s=>renameSync(path.join(stepDir(s),'pending-00000.json'),path.join(stepDir(s),'pending-00001.json'))],
  ];
  for(const [name,conflict] of conflicts){
   const s=claimed(),f=batchFetch();
   await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
   conflict(s);s.resumeFreely();const before=f.calls.length;
   await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch))),name).rejects.toThrow('local_trial_pending_id');
   expect(f.calls.length,name).toBe(before);
   expect(await s.runtime().meter(),name).toMatchObject({pendingCalls:1,accountedMicroUsd:s.a.budget.steps.find(x=>x.id==='story_author')!.maximumMicroUsd});
  }
 });
 it('the one consistent window: the first id is durable but its first local observation was never written; it resumes by that id, never a POST',async()=>{
  const s=claimed(),f=batchFetch('msgbatch_original',2);
  await expect(s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_process_exit');
  unlinkSync(path.join(stepDir(s),'pending-00000.json'));
  editJson(path.join(s.out,'journal','checkpoint.json'),v=>{delete v.calls.story_author.pendingId;v.calls.story_author.polls=0;return v;});
  s.resumeFreely();
  expect(await s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).toMatchObject({usable:true});
  expect(f.posts()).toBe(1);
  // Without the durable id the same journal is an unknown dispatch: stop, reserve kept.
  const t=claimed(),g=batchFetch();
  await expect(t.runtime().call(prepareEngineAnthropic(t.a,dispatch(),ports(g.fetch)))).rejects.toThrow('synthetic_process_exit');
  unlinkSync(path.join(stepDir(t),'pending-00000.json'));unlinkSync(t.ledger.providerFile('story_author'));
  editJson(path.join(t.out,'journal','checkpoint.json'),v=>{delete v.calls.story_author.pendingId;v.calls.story_author.polls=0;return v;});
  t.resumeFreely();
  await expect(t.runtime().call(prepareEngineAnthropic(t.a,dispatch(),ports(g.fetch)))).rejects.toThrow('local_trial_unknown_dispatch');
  expect(g.posts()).toBe(1);
 });
 it('no local observation: a persisted poll, a pending id, a settled or a missing checkpoint entry stops before any collection, full reserve kept (Batch and Responses, R2-LC2)',async()=>{
  const contradictions:[string,(v:any)=>void][]=[
   ['persisted poll and another id',e=>{e.polls=1;e.pendingId='OTHER';}],['persisted poll',e=>{e.polls=1;delete e.pendingId;}],
   ['persisted id',e=>{e.polls=0;e.pendingId='SAME';}],['settled',e=>{e.polls=0;delete e.pendingId;e.settled=true;}],['missing entry',()=>{}],
  ];
  for(const transport of ['batch','responses'] as const)for(const [name,edit] of contradictions){
   const s=claimed(),f=batchFetch('msgbatch_original'),seen:(string|undefined)[]=[],step=transport==='batch'?'story_author':'page_0_0_qa';
   const plan=()=>transport==='batch'?prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)):responsesPlan(s.a,seen,true);
   const id=transport==='batch'?'msgbatch_original':'resp_original',other=transport==='batch'?'msgbatch_other':'resp_other';
   await expect(s.runtime().call(plan())).rejects.toThrow('synthetic_process_exit');
   // Every local pending observation is gone; the external first-id witness stays intact.
   for(const n of readdirSync(stepDir(s,step)).filter(x=>x.startsWith('pending-')))unlinkSync(path.join(stepDir(s,step),n));
   expect(s.witness.observed!(step)).toMatchObject({id});
   editJson(path.join(s.out,'journal','checkpoint.json'),v=>{const e=v.calls[step];
    if(name==='missing entry')delete v.calls[step];else{edit(e);if(e.pendingId==='OTHER')e.pendingId=other;if(e.pendingId==='SAME')e.pendingId=id;}return v;});
   s.resumeFreely();const before=f.calls.length,seenBefore=seen.length,label=transport+': '+name;
   const again=s.runtime(),reserve=s.a.budget.steps.find(x=>x.id===step)!.maximumMicroUsd;
   await expect(again.call(plan()),label).rejects.toThrow('local_trial_pending_id');
   expect(f.calls.length,label).toBe(before);expect(seen.length,label).toBe(seenBefore);
   expect(await again.meter(),label).toMatchObject({pendingCalls:1,accountedMicroUsd:reserve});
  }
 });
 it('the valid first-id-before-observation window still resumes by that id in both transports (positive control, R2-LC2)',async()=>{
  // A real crash between the first-id witness and the first local observation: the checkpoint is exactly zero polls and no pending id.
  const crashAfterWitness=(s:ReturnType<typeof claimed>)=>new LocalEngineTrialRuntime({...s.options,dispatchWitness:{...s.witness,
   observe:(...a:Parameters<NonNullable<typeof s.witness.observe>>)=>{s.witness.observe!(...a);throw Error('synthetic_crash_after_witness');}}});
  const s=claimed(),f=batchFetch('msgbatch_original',2);
  await expect(crashAfterWitness(s).call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).rejects.toThrow('synthetic_crash_after_witness');
  expect(readdirSync(stepDir(s)).some(n=>n.startsWith('pending-'))).toBe(false);
  expect(JSON.parse(readFileSync(path.join(s.out,'journal','checkpoint.json'),'utf8')).calls.story_author).toMatchObject({polls:0,settled:false});
  s.resumeFreely();
  expect(await s.runtime().call(prepareEngineAnthropic(s.a,dispatch(),ports(f.fetch)))).toMatchObject({usable:true});
  expect(f.posts()).toBe(1);expect(f.polled().every(u=>u.includes('msgbatch_original'))).toBe(true);
  const t=claimed(),seen:(string|undefined)[]=[];
  await expect(crashAfterWitness(t).call(responsesPlan(t.a,seen))).rejects.toThrow('synthetic_crash_after_witness');
  t.resumeFreely();expect(await t.runtime().call(responsesPlan(t.a,seen))).toEqual(responsesDone);expect(seen).toEqual([undefined,'resp_original']);
 });
 it('an OpenAI background response resumes by its one id too; a conflicting id stops before the transport',async()=>{
  const plan=(a:ReturnType<typeof current>,execute:(id:string|undefined)=>Promise<any>)=>{const step=a.budget.steps.find(x=>x.id==='page_0_0_qa')!,
   wire={endpoint:'https://api.openai.com/v1/responses',step:step.id,synthetic:true};
   return {wire,call:{step:step.id,wireSha256:canonicalHash(wire),maximumMicroUsd:step.maximumMicroUsd},requiredMs:20_000,completionDeadlineMs:240_000,execute,admitSaved:()=>{}} as any;};
  const done={usable:true,output:{ok:true},raw:{},estimatedMicroUsd:100};
  for(const tamper of [false,true]){
   const s=claimed(),seen:(string|undefined)[]=[];
   const execute=async(id:string|undefined)=>{seen.push(id);return id?{kind:'completed',result:done}:{kind:'pending',id:'resp_original',raw:{id:'resp_original',status:'queued'}};};
   await expect(s.runtime().call(plan(s.a,execute))).rejects.toThrow('synthetic_process_exit');
   if(tamper)editJson(path.join(stepDir(s,'page_0_0_qa'),'pending-00000.json'),v=>({...v,id:'resp_other',raw:{...v.raw,id:'resp_other'}}));
   s.resumeFreely();
   if(tamper){await expect(s.runtime().call(plan(s.a,execute))).rejects.toThrow('local_trial_pending_id');expect(seen).toEqual([undefined]);}
   else{expect(await s.runtime().call(plan(s.a,execute))).toEqual(done);expect(seen).toEqual([undefined,'resp_original']);}
  }
 });
});
