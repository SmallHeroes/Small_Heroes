import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {LEGACY_STARTUP_CAP_CODE,assertLocalStartupRecoveryEvidence,claimLocalStartupRecovery,loadLocalStartupRecovery,type LocalStartupRecovery} from '../local-trial-startup-recovery';
import {authority} from './fixtures';

const roots:string[]=[],hash=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
const legacyHead='b17a5b6860a5539a0d17d3787ea2bedcc408c816';
afterEach(()=>{for(const root of roots.splice(0)){if(path.dirname(realpathSync(root))!==realpathSync(tmpdir())||!path.basename(root).startsWith('sh_startup_cap_'))throw Error('owned_test_only');rmSync(root,{recursive:true,force:true});}});
function fixture(){
 const dir=mkdtempSync(path.join(realpathSync(tmpdir()),'sh_startup_cap_'));roots.push(dir);
 const sourceRoot=realpathSync(process.cwd()),root=path.join(dir,'parent','book');mkdirSync(root,{recursive:true});
 const pin=(name:string,value:unknown)=>{const file=path.join(dir,name),text=typeof value==='string'?value:JSON.stringify(value);writeFileSync(file,text);return{file,sha256:hash(text)};};
 const imageModelPolicy={version:'image26-local-book/v1' as const,model:'gpt-image-2.6-sunburst' as const,complexity:'high' as const};
 const codePins=Object.entries(LEGACY_STARTUP_CAP_CODE).map(([file,sha256])=>({path:file,sha256,bytes:execFileSync('git',['show',legacyHead+':'+file],{cwd:sourceRoot,stdio:['ignore','pipe','pipe']}).length}));
 const prior:LocalEngineGrant={version:'engine-local-book-grant/v1',fictional:true,source:{root:sourceRoot,head:legacyHead,pins:codePins},profile:{file:path.join(dir,'profile.json'),sha256:'a'.repeat(64)},ownerApproval:{file:path.join(dir,'activation.json'),sha256:'b'.repeat(64)},credentials:{file:path.join(dir,'synthetic-no-key.txt'),sha256:'c'.repeat(64)},directory:root,readerId:'synthetic-same-one-book',approvalReference:'synthetic_one_campaign',approvedBy:'synthetic_owner',approvedAt:'2026-11-09T10:00:00.000Z',maximumMicroUsd:12000000,maximumCalls:121,independentQA:'pending_owner_authorized_internal_trial',publicDelivery:false,realPayment:false,freshBookPolicy:'fresh-current-policies/v1',imageModelPolicy,responseSchemaPolicy:'json-schema-null/v1',storyboardBindingPolicy:'accepted-board-child-binding/v1',locationSheetPolicy:'location-ownership-and-views/v2'};
 const oldAuthority={...authority(),purpose:'test' as const,imageModelPolicy,sourceRevision:legacyHead,budget:{...authority().budget,maximumMicroUsd:12000000,maximumCalls:121}};
 const parentGrant=pin('parent-grant.json',prior),claim={version:'engine-local-book-claim/v1',grantFile:parentGrant.file,grantSha256:parentGrant.sha256,authoritySha256:canonicalHash(oldAuthority),directory:root,sourceRoot};
 const parentClaim=pin('master-claim.json',claim),parentEnvelope=pin('envelope.json',{version:'m34-one-fresh-book-envelope/v1',sourceHead:legacyHead,sourceRoot,masterClaim:parentClaim.file,futureGrantSha256:parentGrant.sha256});
 const parentStart=pin('start.json',{version:'m34-supervisor-start/v1',pid:2000000001,childPid:2000000000,sourceHead:legacyHead,grantSha256:parentGrant.sha256,envelope:parentEnvelope,carriedMicroUsd:0,carriedCalls:0,maximumTotalMicroUsd:12000000,maximumTotalCalls:121});
 const parentExit=pin('exit.json',{version:'m34-supervisor-exit/v1',at:'2026-11-09T18:32:28.465Z',childPid:2000000000,code:1,signal:null,outcomeExists:false,terminalSha256:null,supervisorExitCode:1,completionStatus:'native_failed',completionReason:'native_exit_failure'});
 const running=JSON.stringify({pid:2000000000,startedAt:'2026-11-09T18:32:22.000Z',grantSha256:parentGrant.sha256});writeFileSync(path.join(root,'RUNNING.json'),running);
 const parentBook=pin('book-index.json',{root,rows:[{path:'RUNNING.json',bytes:Buffer.byteLength(running),sha256:hash(running)}]});
 const spec:LocalStartupRecovery={version:'engine-local-startup-cap-recovery/v1',boundary:'known_constructor_refusal_before_provider',parentGrant,parentClaim,parentEnvelope,parentStart,parentExit,parentBook,parentStdout:pin('stdout.log',''),parentStderr:pin('stderr.log',{status:'stopped',code:'local_trial_authority',providerDispatchNotConfirmed:true})};
 const g:LocalEngineGrant={...prior,source:{...prior.source,head:'a'.repeat(40)},directory:path.join(dir,'replacement','book'),startupRecovery:spec};
 return{dir,root,g,prior,oldAuthority,spec,pin,master:parentClaim.file,load:()=>loadLocalStartupRecovery(g,prior,oldAuthority,parentClaim.file)};
}
function change(s:ReturnType<typeof fixture>,key:keyof Omit<LocalStartupRecovery,'version'|'boundary'>,fn:(v:any)=>any){const old=s.spec[key],next=fn(JSON.parse(readFileSync(old.file,'utf8'))),text=JSON.stringify(next);writeFileSync(old.file,text);s.spec[key]={file:old.file,sha256:hash(text)};}
describe('one known pre-provider constructor migration; never a missing-journal paid retry',()=>{
 it('admits exact known code and pristine terminal state without writing anything',()=>{const s=fixture(),before=readFileSync(s.master);const e=s.load();expect(e.claimFile).toBe(s.master+'.startup-cap-recovery.json');expect(existsSync(e.claimFile)).toBe(false);expect(existsSync(s.g.directory)).toBe(false);expect(readFileSync(s.master)).toEqual(before);});
 it('allows readonly authority recomputation after the destination exists, but refuses execution there',()=>{const s=fixture();mkdirSync(s.g.directory,{recursive:true});const e=s.load();expect(()=>claimLocalStartupRecovery(e,{},false,s.master)).toThrow('local_startup_destination');expect(existsSync(e.claimFile)).toBe(false);});
 it('claims once globally and preserves the consumed root; another source parent cannot buy again',()=>{const s=fixture(),before=readFileSync(s.master),e=s.load();claimLocalStartupRecovery(e,{synthetic:'first'},false,s.master);expect(readFileSync(s.master)).toEqual(before);expect(()=>claimLocalStartupRecovery(s.load(),{synthetic:'copy'},false,s.master)).toThrow('local_startup_already_claimed');});
 it('refuses copied capabilities, another consent key and any resume',()=>{const s=fixture(),e=s.load();expect(()=>claimLocalStartupRecovery({...e},{},false,s.master)).toThrow('local_startup_capability');expect(()=>claimLocalStartupRecovery(e,{},false,s.master+'.other-owner')).toThrow('local_startup_capability');expect(()=>claimLocalStartupRecovery(e,{},true,s.master)).toThrow('local_startup_capability');expect(existsSync(e.claimFile)).toBe(false);});
 it.each(['journal','OUTCOME.json','STOP.json','other-file'])('rejects any extra parent entry including %s',name=>{const s=fixture();if(name==='journal')mkdirSync(path.join(s.root,name));else writeFileSync(path.join(s.root,name),'{}');expect(s.load).toThrow('local_startup_tree');});
 it('rejects changed/missing parent evidence after admission, before a claim or dispatch fence',()=>{const s=fixture(),e=s.load();writeFileSync(s.spec.parentExit.file,'{}');expect(e.check).toThrow('local_startup_evidence_changed');expect(()=>claimLocalStartupRecovery(e,{},false,s.master)).toThrow();expect(existsSync(e.claimFile)).toBe(false);});
 it.each(['readerId','approvalReference','approvedAt','maximumMicroUsd','maximumCalls','profile','credentials','imageModelPolicy','storyboardBindingPolicy'])('refuses changing %s for the same campaign',key=>{const s=fixture();(s.g as any)[key]=key==='maximumMicroUsd'?12000001:key==='maximumCalls'?120:key==='profile'||key==='credentials'?{file:s.master,sha256:'f'.repeat(64)}:key==='imageModelPolicy'?{...s.g.imageModelPolicy,model:'gpt-image-2.6-flare'}:'changed';expect(s.load).toThrow('local_startup_scope');});
 it('refuses recursive recovery',()=>{const s=fixture();s.prior.startupRecovery=s.spec;expect(s.load).toThrow('local_startup_scope');});
 it.each(['implementation','revision','under10M'])('refuses an unproven %s even with an absent journal',kind=>{const s=fixture();if(kind==='implementation')s.prior.source.pins[0].sha256='f'.repeat(64);if(kind==='revision')s.prior.source.head='0'.repeat(40);if(kind==='under10M')s.prior.maximumMicroUsd=10000000;const t=JSON.stringify(s.prior);writeFileSync(s.spec.parentGrant.file,t);s.spec.parentGrant.sha256=hash(t);expect(s.load).toThrow();});
 it.each([{code:0},{signal:'SIGTERM'},{outcomeExists:true},{terminalSha256:'a'.repeat(64)},{completionStatus:'incomplete'}])('refuses other terminal outcomes %j',patch=>{const s=fixture();change(s,'parentExit',v=>({...v,...patch}));expect(s.load).toThrow('local_startup_terminal');});
 it('refuses UNKNOWN or any other native error',()=>{const s=fixture();change(s,'parentStderr',v=>({...v,code:'local_trial_unknown_dispatch'}));expect(s.load).toThrow('local_startup_terminal');});
 it('refuses non-empty stdout even if re-pinned',()=>{const s=fixture();s.spec.parentStdout=s.pin('stdout.log','{"status":"provider_started"}\n');expect(s.load).toThrow('local_startup_terminal');});
 it('refuses a live supervisor and a changed original claim',()=>{const s=fixture();change(s,'parentStart',v=>({...v,pid:process.pid}));change(s,'parentExit',v=>({...v,at:new Date().toISOString()}));expect(s.load).toThrow('local_startup_process_alive');change(s,'parentClaim',v=>({...v,authoritySha256:'0'.repeat(64)}));expect(s.load).toThrow('local_startup_claim');});
 it('accepts a PID demonstrably created after the sealed historical exit',()=>{const s=fixture();change(s,'parentStart',v=>({...v,pid:process.pid}));expect(s.load).not.toThrow();});
 it('refuses directories nested inside the preserved parent',()=>{const s=fixture();s.g.directory=path.join(s.root,'nested','book');expect(s.load).toThrow('local_startup_destination');});
 it('never replaces the exact whole-tree requirement with a caller zero-cost assertion',()=>{const s=fixture();change(s,'parentBook',v=>({...v,knownMicroUsd:0}));expect(()=>assertLocalStartupRecoveryEvidence(s.spec)).toThrow();});
});
