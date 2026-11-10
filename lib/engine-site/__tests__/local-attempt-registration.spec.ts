import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdirSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {canonicalHash} from '@/lib/canonical-json';
import {syntheticAttemptExtension} from './local-attempt-extension-fixture';
import {finalRead as read,finalWrite as write} from './local-final-plan-fixture';
import {admitLocalAttemptStartupRegistration} from '../local-attempt-startup-registration';
import {loadLocalAttemptExtension} from '../local-trial-attempt-extension';
import {localAttemptApprovalSchema,localAttemptOwnerGoSchema} from '../local-attempt-extension-policy';
const roots:string[]=[];
beforeEach(()=>{vi.spyOn(process,'kill').mockImplementation(()=>{throw Object.assign(Error(),{code:'ESRCH'});});});
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(realpathSync(r))!==realpathSync(tmpdir())||!path.basename(r).startsWith('sh_current_parent_'))throw Error('owned_temp_only');rmSync(r,{recursive:true,force:true});}});
function fixture(){
 const s=syntheticAttemptExtension();roots.push(s.dir);const now=Date.now(),ownerAt=new Date(now-3600000).toISOString();
 const go={...s.go,approvedAt:ownerAt};write(s.goFile,go);const scope=localAttemptApprovalSchema.parse(s.scope),ownerGo=localAttemptOwnerGoSchema.parse(go),original=structuredClone(s.g),oldGrant=path.join(s.dir,'original-attempt4.json');write(oldGrant,original);
 const g={...s.g,directory:path.join(s.dir,'new-startup','book'),source:{...s.g.source,head:'e'.repeat(40)},currentAttemptExtension:{...s.g.currentAttemptExtension!,startupRegistrationFile:path.join(s.dir,'STARTUP-REGISTRATION.json')}};
 const rec=(name:string,v:unknown)=>{const f=path.join(s.dir,name);write(f,v);return s.pin(f);};
 const report=rec('new-report.txt',{SYNTHETIC_QA_ONLY:true}),index=rec('new-index.json',{files:[]});
 const ready=rec('new-ready.json',{complete:true,disposition:'PASS',scope:'M39_ZERO_DISPATCH_STARTUP_CODE_AND_ENVELOPE',sourceHead:g.source.head,envelopeSha256:'a'.repeat(64),report:{file:path.basename(report.file),sha256:report.sha256},providerCalls:0,spendMicroUsd:0});
 const seal=rec('new-source-review.json',{version:'codex-complete-independent-review-seal/v1',disposition:'PASS',scope:'M39_ZERO_DISPATCH_STARTUP_CODE_AND_ENVELOPE',startupGrantCanonicalSha256:canonicalHash(g),sourceHead:g.source.head,actualReviewerTurnComplete:true,verifiedAt:new Date(now-10000).toISOString(),envelopeSha256:'a'.repeat(64),ready,report,index,actualProcessesExited:[{pid:2000000010,code:0,historicalProcessGone:true}]});
 const start=rec('zero-start.json',{at:new Date(now-20000).toISOString(),pid:2000000011,childPid:2000000012,grantSha256:s.pin(oldGrant).sha256,sourceHead:original.source.head});
 const exit=rec('zero-exit.json',{at:new Date(now-15000).toISOString(),childPid:2000000012,code:1,signal:null,outcomeExists:false,supervisorExitCode:1,completionStatus:'native_failed'});
 const stderr=rec('zero-stderr.json',{status:'stopped',code:'local_book_preflight_failed',providerDispatchNotConfirmed:true}),stdoutFile=path.join(s.dir,'zero-stdout.log');write(stdoutFile,'');
 // finalWrite JSON-encodes strings; stdout really must contain zero bytes.
 const fs=require('node:fs') as typeof import('node:fs');fs.writeFileSync(stdoutFile,'');
 const registration={version:'engine-local-attempt-startup-registration/v1',registeredBy:'Codex technical operator',registeredAt:new Date(now).toISOString(),ownerDecisionUnchanged:true,sourceHead:g.source.head,grantCanonicalSha256:canonicalHash(g),ownerGo:s.pin(s.goFile),originalGrant:s.pin(oldGrant),originalStart:start,originalExit:exit,originalStderr:stderr,originalStdout:s.pin(stdoutFile),sourceReviewSeal:seal};
 write(g.currentAttemptExtension.startupRegistrationFile,registration);
 const load=()=>admitLocalAttemptStartupRegistration(g,scope,ownerGo,s.pin(s.goFile).sha256,s.master,s.prior.executionFile+'.attempt-extension-4.json');
 const patch=(key:keyof typeof registration,fn:(v:any)=>any)=>{const r=registration[key] as {file:string;sha256:string};write(r.file,fn(read(r.file)));(registration as any)[key]=s.pin(r.file);write(g.currentAttemptExtension.startupRegistrationFile,registration);};
 return{...s,g,scope,go:ownerGo,registration,load,patch,start,exit,seal,original,oldGrant,regFile:g.currentAttemptExtension.startupRegistrationFile};
}
describe('truthful zero-dispatch startup registration for an already approved, unspent attempt4',()=>{
 it('uses a fresh OPERATOR registration, retaining a one-hour-old owner decision and original six-hour deadline',()=>{const s=fixture(),before=readFileSync(s.goFile),r=s.load();expect(r.originalApprovedAt).toBe(s.go.approvedAt);expect(Date.parse(r.originalDeadline)-Date.parse(r.originalApprovedAt)).toBe(21600000);expect(readFileSync(s.goFile)).toEqual(before);expect(r.registeredAt).toBe(s.registration.registeredAt);expect(()=>r.check()).not.toThrow();});
 it('the real extension loader carries the same ten paid calls and exact owner scope into a new technical source',()=>{const s=fixture(),e=loadLocalAttemptExtension(s.g,s.failed,s.failedAuthority,s.prior);expect(e.carried).toMatchObject({accountedMicroUsd:132,logicalCalls:10});expect(e.maximumAttempts).toBe(4);expect(e.extension.approvalSha256).toBe(s.g.currentAttemptExtension.approval.sha256);expect(e.startupRegistration?.originalApprovedAt).toBe(s.go.approvedAt);expect(e.scope.sourceHead).not.toBe(s.g.source.head);expect(()=>e.checkChain()).not.toThrow();});
 it('the original expired v1 still refuses without an explicit technical registration',()=>{const s=fixture(),g={...s.original};expect(()=>loadLocalAttemptExtension(g,s.failed,s.failedAuthority,s.prior)).toThrow('owner_go');});
 it.each(['sourceHead','grantCanonicalSha256','registeredBy','ownerDecisionUnchanged'])('refuses registration %s drift',key=>{const s=fixture();write(s.regFile,{...s.registration,[key]:key==='ownerDecisionUnchanged'?false:'wrong'});expect(s.load).toThrow();});
 it.each([-1000,-1200001,1000])('refuses future/stale/preceding-review registration offset %d',offset=>{const s=fixture();write(s.regFile,{...s.registration,registeredAt:new Date(offset===-1000?Date.parse(s.registration.registeredAt)-20000:Date.now()+offset).toISOString()});expect(s.load).toThrow();});
 it('never renews the original six-hour window',()=>{const s=fixture(),go={...s.go,approvedAt:new Date(Date.now()-21600001).toISOString()};write(s.goFile,go);write(s.regFile,{...s.registration,ownerGo:s.pin(s.goFile)});expect(()=>admitLocalAttemptStartupRegistration(s.g,s.scope,go,s.pin(s.goFile).sha256,s.master,s.prior.executionFile+'.attempt-extension-4.json')).toThrow('time_or_scope');});
 it.each(['profile','credentials','readerId','maximumMicroUsd','maximumCalls','imageModelPolicy'])('rejects new product/budget scope %s',key=>{const s=fixture();(s.g as any)[key]=key==='readerId'?'other':key==='maximumCalls'?120:key==='maximumMicroUsd'?11000000:undefined;s.registration.grantCanonicalSha256=canonicalHash(s.g);write(s.regFile,s.registration);expect(s.load).toThrow('original_scope');});
 it('refuses an original startup registration as its parent, never a chain or fifth attempt',()=>{const s=fixture();s.patch('originalGrant',v=>({...v,currentAttemptExtension:{...v.currentAttemptExtension,startupRegistrationFile:s.regFile}}));expect(s.load).toThrow('original_scope');});
 it.each(['journal','OUTCOME.json'])('any original book state %s blocks recovery',name=>{const s=fixture();mkdirSync(path.join(s.original.directory,name),{recursive:true});expect(s.load).toThrow('not_zero_dispatch');});
 it.each(['global','execution'])('an existing engine %s claim prevents any registration/re-purchase',which=>{const s=fixture(),file=which==='global'?s.master+'.attempt-extension-4-v1.json':s.prior.executionFile+'.attempt-extension-4.json';write(file,{used:true});expect(s.load).toThrow('not_zero_dispatch');});
 it.each([{code:0},{signal:'SIGTERM'},{outcomeExists:true},{supervisorExitCode:0},{completionStatus:'incomplete'}])('rejects unproven terminal outcome %j',patch=>{const s=fixture();s.patch('originalExit',v=>({...v,...patch}));expect(s.load).toThrow('not_zero_dispatch');});
 it('nonempty stdout or another error cannot be treated as zero dispatch',()=>{const s=fixture();s.patch('originalStderr',v=>({...v,code:'unknown_dispatch'}));expect(s.load).toThrow('not_zero_dispatch');});
 it.each([{disposition:'HOLD'},{sourceHead:'f'.repeat(40)},{actualReviewerTurnComplete:false},{actualProcessesExited:[]},{scope:'OTHER'},{startupGrantCanonicalSha256:'f'.repeat(64)}])('rejects an unqualified technical seal %j',patch=>{const s=fixture();s.patch('sourceReviewSeal',v=>({...v,...patch}));expect(s.load).toThrow('review');});
 it('registration/source/old receipt mutations are detected around awaits, while our later own claim does not invalidate the capability',()=>{const s=fixture(),r=s.load();write(s.master+'.attempt-extension-4-v1.json',{syntheticOurLaterClaim:true});expect(()=>r.check()).not.toThrow();write(s.regFile,{...s.registration,registeredAt:new Date().toISOString()});expect(r.check).toThrow('changed');});
 it('a changed original owner receipt is never silently replaced with a fresh approval',()=>{const s=fixture(),r=s.load();write(s.goFile,{...s.go,approvedAt:new Date().toISOString()});expect(r.check).toThrow('pin_changed');});
});
