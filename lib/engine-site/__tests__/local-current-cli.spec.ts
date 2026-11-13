/** The local current-engine CLI consumes one GO once (copies, races, another folder, a lost journal) and resumes from intact state. No provider. */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import type {CausalDispatch} from '@/lib/personal-wizard/story-causal-experiment-runner';

const m=vi.hoisted(()=>({book:vi.fn()}));
// The source is treated as frozen at one synthetic HEAD; every other git call reports a clean tree.
vi.mock('node:child_process',async original=>({...await original<any>(),execFileSync:(_cmd:string,args:string[])=>args.includes('rev-parse')?'f'.repeat(40):''}));
vi.mock('@/lib/engine-site/local-trial-book',()=>({runLocalEngineTrialBook:m.book,localTrialReaderBundle:vi.fn()}));
import {localCurrentBookCLI} from '@/scripts/engine-local-current-book';
import {LOCAL_ACTIVATION_REVIEW_SCOPE,localApprovalIdentity,registerLocalCurrentActivation} from '../local-consent-ledger';
import {canonicalHash} from '@/lib/canonical-json';
import {prepareEngineAnthropic} from '../provider-plans';
import {syntheticEngineOrderInput} from './synthetic-order';

const repo=realpathSync(path.resolve(__dirname,'../../..'));
const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(r)!==realpathSync(tmpdir())||!path.basename(r).startsWith('sh_local_cli_'))throw Error('owned_test_only');rmSync(r,{recursive:true,force:true});}});
beforeEach(()=>{m.book.mockReset();});
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const base=realpathSync(mkdtempSync(path.join(tmpdir(),'sh_local_cli_')));roots.push(base);
 const profile=path.join(base,'profile.json');
 writeFileSync(profile,JSON.stringify({version:'local-fictional-book-profile/v1',fictional:true,provenance:'synthetic, no provider',input:syntheticEngineOrderInput('dad_v2')}));
 const go={version:'engine-local-current-book-go/v1',approvedBy:'Guy',approvedAt:'2026-11-12T00:00:00.000Z',approvalReference:'synthetic_cli_consent',
  ownerWords:'SYNTHETIC FIXTURE NO SPEND',sourceRevision:'f'.repeat(40),profileSha256:sha(readFileSync(profile)),maximumMicroUsd:12_000_000,maximumCalls:124,
  readerId:'synthetic-cli-'+path.basename(base).toLowerCase().replace(/[^a-z0-9-]/g,''),fictional:true,realPayment:false,publicDelivery:false};
 const run=(name:string,over:Record<string,unknown>={},register=true)=>{const out=path.join(base,name);mkdirSync(out,{recursive:true});
  writeFileSync(path.join(out,'OWNER-GO.json'),JSON.stringify({...go,...over})+'\n');if(register)activate(out);return out;};
 /** The separate, independently reviewed registration of exactly this run's GO bytes (synthetic seal in the scratch folder only). */
 const activate=(out:string)=>{const bytes=readFileSync(path.join(out,'OWNER-GO.json')),value=JSON.parse(bytes.toString('utf8'));
  const seal=path.join(base,'seal-'+path.basename(out)+'.json');
  writeFileSync(seal,JSON.stringify({version:'codex-complete-independent-review-seal/v1',disposition:'PASS',scope:LOCAL_ACTIVATION_REVIEW_SCOPE,
   sourceHead:value.sourceRevision,goSha256:sha(bytes),actualReviewerTurnComplete:true,verifiedAt:'2026-11-12T00:00:01.000Z'}));
  return registerLocalCurrentActivation(path.join(base,'ledger'),{approvalReference:value.approvalReference,approvalIdentitySha256:localApprovalIdentity(value),
   goSha256:sha(bytes),goCanonicalSha256:canonicalHash(value),sourceRevision:value.sourceRevision,profileSha256:value.profileSha256,out,readerId:value.readerId,
   independentReview:{file:seal,sha256:sha(readFileSync(seal))}});};
 const cli=async(out:string,...flags:string[])=>{const cwd=vi.spyOn(process,'cwd').mockReturnValue(repo);
  try{return await localCurrentBookCLI(['--profile',profile,'--out',out,'--key-env-file',path.join(base,'absent-key-file'),'--execute',...flags],{consentRoot:path.join(base,'ledger')});}
  finally{cwd.mockRestore();}};
 return {base,go,run,activate,cli,ledger:path.join(base,'ledger')};
}
const dispatch=():CausalDispatch=>({role:'opus',stage:'author',conversationKey:'synthetic_author',input:'SYNTHETIC brief',
 instructions:'SYNTHETIC instructions',schema:z.object({text:z.string().min(2)}).strict(),maxOutputTokens:8000});
const message={id:'msg_synthetic',type:'message',model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({text:'Synthetic story'})}],
 usage:{input_tokens:1000,output_tokens:500,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'batch'}};
function batch(){let posts=0;const fetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{const url=String(input);
 if(init?.method==='POST'){posts++;return new Response(JSON.stringify({id:'msgbatch_cli',processing_status:'in_progress'}));}
 if(url.endsWith('/results'))return new Response(JSON.stringify({custom_id:'story_author',result:{type:'succeeded',message}})+'\n');
 return new Response(JSON.stringify({id:'msgbatch_cli',processing_status:'ended',results_url:'https://api.anthropic.com/v1/messages/batches/msgbatch_cli/results'}));}) as unknown as typeof globalThis.fetch;
 return {fetch,posts:()=>posts};}
/** The mocked book: one REAL runtime call of the author through the fake batch, then a synthetic stop before any further step. */
const oneCallThenStop=(f:ReturnType<typeof batch>)=>async({runtime}:{runtime:any})=>{
 await runtime.call(prepareEngineAnthropic(runtime.checkpoint.authority,dispatch(),{fetch:f.fetch,openAIKey:()=>'unused',anthropicKey:()=>'SYNTHETIC_KEY'}));
 throw Error('synthetic_stop_before_next_step');};

describe('the local current-engine CLI consumes one GO once',()=>{
 it('refuses a continuation resume even before checking the parent or a registration',async()=>{
  const f=fixture(),pin={file:path.join(f.base,'absent-parent'),sha256:'0'.repeat(64)};
  const out=f.run('continue',{entitiesContinuation:{firstWireSha256:pin.sha256,parent:{
   version:'engine-local-current-entities-continuation/v1',parentGo:pin,parentStop:pin,parentExit:pin,parentLaunch:pin,
   parentLauncherLog:pin,parentEvidence:pin,parentConsentSha256:pin.sha256}}},false);
  await expect(f.cli(out,'--resume')).rejects.toThrow('local_entities_resume_forbidden');
  expect(m.book).not.toHaveBeenCalled();
  expect(readdirSync(out)).toEqual(['OWNER-GO.json']);
 });
 it('refuses a locations resume before replaying any parent or reading credentials',async()=>{
  const f=fixture(),pin={file:path.join(f.base,'absent-parent'),sha256:'0'.repeat(64)};
  const out=f.run('locations',{entitiesContinuation:{firstWireSha256:pin.sha256,parent:{
   version:'engine-local-current-locations-continuation/v1',parentGo:pin,parentStop:pin,parentExit:pin,parentLaunch:pin,
   parentLauncherLog:pin,parentEvidence:pin,parentConsentSha256:pin.sha256,previousLink:pin,targetImageSha256:pin.sha256}}},false);
  await expect(f.cli(out,'--resume')).rejects.toThrow('local_entities_resume_forbidden');
  expect(m.book).not.toHaveBeenCalled();
  expect(readdirSync(out)).toEqual(['OWNER-GO.json']);
 });
 it('a second execute, a copy in another folder and a racing copy are refused; one launch reaches the book',async()=>{
  const f=fixture(),a=f.run('a'),b=f.run('b',{},false),c=f.run('c',{},false);m.book.mockRejectedValue(Error('synthetic_stop_before_provider'));
  expect(await f.cli(a)).toBe(1);
  await expect(f.cli(a)).rejects.toThrow('local_current_consent_used');
  // A copy elsewhere has no registration of its own: the registered activation names the original output folder.
  await expect(f.cli(b)).rejects.toThrow('local_current_registration_binding');
  // Racing launches of two more copies of the same GO: nothing new reaches the book.
  const raced=await Promise.allSettled([f.cli(b),f.cli(c)]);
  expect(raced.every(r=>r.status==='rejected'&&/local_current_registration_binding/.test(String(r.reason)))).toBe(true);
  expect(m.book).toHaveBeenCalledTimes(1);
  expect(existsSync(path.join(b,'CLAIM.json'))||existsSync(path.join(c,'CLAIM.json'))).toBe(false);
 });
 it('a resume from a changed output folder (a copy of the run) is refused; the original folder resumes',async()=>{
  const f=fixture(),a=f.run('a');m.book.mockRejectedValue(Error('synthetic_stop_before_provider'));
  expect(await f.cli(a)).toBe(1);
  const copy=path.join(f.base,'copy');cpSync(a,copy,{recursive:true});
  await expect(f.cli(copy,'--resume')).rejects.toThrow('local_current_registration_binding');
  expect(await f.cli(a,'--resume')).toBe(1);expect(m.book).toHaveBeenCalledTimes(2);
 });
 it('a real resume from intact state never repurchases the settled call; a lost journal refuses before the book',async()=>{
  const f=fixture(),a=f.run('a'),g=batch();m.book.mockImplementation(oneCallThenStop(g));
  expect(await f.cli(a)).toBe(1);expect(g.posts()).toBe(1);
  expect(await f.cli(a,'--resume')).toBe(1);expect(g.posts()).toBe(1);expect(m.book).toHaveBeenCalledTimes(2);
  rmSync(path.join(a,'journal'),{recursive:true});
  await expect(f.cli(a,'--resume')).rejects.toThrow('local_current_journal_blocked');
  expect(m.book).toHaveBeenCalledTimes(2);expect(g.posts()).toBe(1);
 },120_000); // the real runtime waits its real 30 s batch poll once
 it('a running holder of the same consent refuses a second process; the lease is released on exit',async()=>{
  const f=fixture(),a=f.run('a');let inside:Promise<unknown>|null=null;
  m.book.mockImplementation(async()=>{inside=f.cli(a,'--resume');await inside.catch(()=>{});throw Error('synthetic_stop_before_provider');});
  expect(await f.cli(a)).toBe(1);
  await expect(inside).rejects.toThrow('local_current_running');
  expect(existsSync(path.join(f.ledger,'local-current-synthetic_cli_consent.lease.json'))).toBe(false);
 });
});

describe('the GO is never paid authority on its own: only an existing registration of exactly it executes (R2-LC1A)',()=>{
 it('no registration, an edited reference, a reserialized or an edited GO never reach the executor; a second registration of the same approval is refused',async()=>{
  const f=fixture();m.book.mockRejectedValue(Error('synthetic_stop_before_provider'));
  const unregistered=f.run('unregistered',{},false);
  await expect(f.cli(unregistered)).rejects.toThrow('local_current_registration_required');
  const first=f.run('first');expect(await f.cli(first)).toBe(1);expect(m.book).toHaveBeenCalledTimes(1);
  // The same approval evidence with only a new self-declared reference: no registration exists under that reference.
  const renamed=f.run('renamed',{approvalReference:'synthetic_cli_consent_renamed'},false);
  await expect(f.cli(renamed)).rejects.toThrow('local_current_registration_required');
  // Registering that renamed copy is refused too: its approval identity is already registered under the first reference.
  expect(()=>f.activate(renamed)).toThrow('local_current_approval_registered');
  await expect(f.cli(renamed)).rejects.toThrow('local_current_registration_required');
  // The registered folder with other bytes (reserialized, or one field edited): the registration binds the exact GO bytes.
  const g=fixture(),fresh=g.run('fresh');writeFileSync(path.join(fresh,'OWNER-GO.json'),JSON.stringify(g.go,null,1));
  await expect(g.cli(fresh)).rejects.toThrow('local_current_registration_binding');
  writeFileSync(path.join(fresh,'OWNER-GO.json'),JSON.stringify({...g.go,ownerWords:'EDITED'})+'\n');
  await expect(g.cli(fresh)).rejects.toThrow('local_current_registration_binding');
  expect(m.book).toHaveBeenCalledTimes(1);
  expect(existsSync(path.join(unregistered,'CLAIM.json'))||existsSync(path.join(renamed,'CLAIM.json'))||existsSync(path.join(fresh,'CLAIM.json'))).toBe(false);
 });
 it('a registration needs a pinned independent PASS seal of exactly these GO bytes; a changed seal or registration stops before the book',async()=>{
  const f=fixture();m.book.mockRejectedValue(Error('synthetic_stop_before_provider'));
  const a=f.run('a',{},false),bytes=readFileSync(path.join(a,'OWNER-GO.json')),value=JSON.parse(bytes.toString('utf8')),seal=path.join(f.base,'seal-bad.json');
  const input=(review:Record<string,unknown>)=>{writeFileSync(seal,JSON.stringify({version:'codex-complete-independent-review-seal/v1',disposition:'PASS',scope:LOCAL_ACTIVATION_REVIEW_SCOPE,
   sourceHead:value.sourceRevision,goSha256:sha(bytes),actualReviewerTurnComplete:true,verifiedAt:'2026-11-12T00:00:01.000Z',...review}));
   return {approvalReference:value.approvalReference,approvalIdentitySha256:localApprovalIdentity(value),goSha256:sha(bytes),goCanonicalSha256:canonicalHash(value),
    sourceRevision:value.sourceRevision,profileSha256:value.profileSha256,out:a,readerId:value.readerId,independentReview:{file:seal,sha256:sha(readFileSync(seal))}};};
  for(const review of [{disposition:'HOLD'},{goSha256:'0'.repeat(64)},{sourceHead:'0'.repeat(40)},{scope:'OTHER'},{actualReviewerTurnComplete:false}])
   expect(()=>registerLocalCurrentActivation(f.ledger,input(review))).toThrow('local_current_registration_review');
  const ok=input({});registerLocalCurrentActivation(f.ledger,ok);
  // The seal changes after registration: the pin no longer matches.
  writeFileSync(seal,JSON.stringify({changed:true}));
  await expect(f.cli(a)).rejects.toThrow('local_current_registration_review');
  expect(m.book).not.toHaveBeenCalled();
 });
 it('a genuinely new approval registers and executes on its own; the registration is re-pinned before every dispatch',async()=>{
  const f=fixture();const first=f.run('first');m.book.mockRejectedValue(Error('synthetic_stop_before_provider'));
  expect(await f.cli(first)).toBe(1);
  const second=f.run('second',{approvalReference:'synthetic_cli_consent_second',approvedAt:'2026-11-12T01:00:00.000Z',ownerWords:'SYNTHETIC SECOND APPROVAL',
   readerId:'synthetic-cli-second-'+path.basename(f.base).toLowerCase().replace(/[^a-z0-9-]/g,'')});
  m.book.mockImplementation(async({runtime}:{runtime:any})=>{
   // The registration is edited while the run is live: the next fence refuses before any provider work.
   writeFileSync(path.join(f.ledger,'local-current-synthetic_cli_consent_second.registration.json'),'{}');
   await runtime.save('synthetic_output',{x:1});throw Error('unreachable');});
  expect(await f.cli(second)).toBe(1);
  const stops=readdirSync(second).filter(n=>n.startsWith('STOP-'));
  expect(JSON.parse(readFileSync(path.join(second,stops[0]),'utf8')).reason).toBe('local_current_registration_changed');
 });
});
