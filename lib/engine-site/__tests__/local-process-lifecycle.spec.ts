import {afterEach,describe,expect,it} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {tmpdir} from 'node:os';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)){if(path.dirname(root)!==path.resolve(tmpdir())||!path.basename(root).startsWith('sh_cli_lifetime_')||realpathSync(root)!==root)throw Error('owned_test_directory_only');rmSync(root,{recursive:true,force:true});}});

/** Executes exact current entry bytes in REAL Node. Business imports are synthetic; no SDK, provider, grant or key. */
function invoke(mode:string){
 const root=mkdtempSync(path.join(tmpdir(),'sh_cli_lifetime_'));roots.push(root);
 const entry=path.join(root,'entry.cjs'),hook=path.join(root,'hook.cjs');writeFileSync(entry,readFileSync(path.join(process.cwd(),'scripts/engine-local-book.cjs')));
 writeFileSync(hook,`'use strict';
 const M=require('node:module'),load=M._load,fs=require('node:fs'),p=require('node:path'),read=fs.readFileSync;
 fs.readFileSync=function(file,...args){if(/^\\.env(?:\\.|$)/i.test(p.basename(String(file))))throw Error('ENV_DENIED');return read.call(this,file,...args);};
 globalThis.fetch=()=>{throw Error('PROVIDER_DENIED');};
 M._load=function(id,parent,...rest){if(['openai','@anthropic-ai/sdk','replicate','node:http','node:https','node:net','node:tls'].includes(id))throw Error('NETWORK_MODULE_DENIED');
  if(id==='tsx/cjs'||id==='./shims/register-server-only.cjs')return{};
  if(id==='./engine-local-book.ts')return{localEngineBookCLI(argv){
   const mode=${JSON.stringify(mode)};console.log(JSON.stringify({marker:'invoked_once',argv,credentialVariablesPresent:Object.keys(process.env).some(x=>/KEY|TOKEN|SECRET/.test(x))}));
   if(mode==='sync-reject')throw Object.assign(Error('SYNTHETIC_PRIVATE_ERROR_TEXT'),{code:'synthetic_sync'});
   const complete=()=>{console.log('AFTER_AWAIT');return 0;},error=Object.assign(Error('SYNTHETIC_PRIVATE_ERROR_TEXT'),{code:mode==='unsafe-error'?'invalid\\nSYNTHETIC_PRIVATE_ERROR_TEXT':'synthetic_delayed'});
   if(mode==='unref-reject'){const pulse=setInterval(()=>{},10);pulse.unref();const signal=AbortSignal.timeout(120);return new Promise((_,reject)=>signal.addEventListener('abort',()=>{clearInterval(pulse);reject(error);},{once:true}));}
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>mode==='referenced-reject'||mode==='unsafe-error'?reject(error):resolve(complete()),120);if(mode==='unref-resolve')timer.unref();});
  }};return load.call(this,id,parent,...rest);};
 `);
 const env:NodeJS.ProcessEnv={NODE_ENV:'test'};for(const k of ['SystemRoot','WINDIR','PATH','PATHEXT','COMSPEC','TEMP','TMP'])if(process.env[k])env[k]=process.env[k]!;
 const args=['--grant','SYNTHETIC_NOT_A_REAL_GRANT','--grant-sha','f'.repeat(64),'--execute'];
 const child=spawnSync(process.execPath,['--require',hook,entry,...args],{env,cwd:root,windowsHide:true,encoding:'utf8',timeout:5000,maxBuffer:16384});
 expect(child.error).toBeUndefined();expect(child.signal).toBeNull();
 const lines=child.stdout.trim().split('\n'),invocations=lines.filter(x=>x.includes('invoked_once')).map(x=>JSON.parse(x));
 expect(invocations).toEqual([{marker:'invoked_once',argv:args,credentialVariablesPresent:false}]);
 return child;
}

describe('real local-book process lifetime, synthetic business logic only',()=>{
 it('keeps an unref delayed rejection alive until the real error path settles',()=>{const r=invoke('unref-reject');expect(r.status).toBe(1);expect(JSON.parse(r.stderr)).toEqual({status:'stopped',code:'synthetic_delayed',providerDispatchNotConfirmed:true});});
 it('keeps an unref delayed completion alive and then releases the lifetime handle',()=>{const r=invoke('unref-resolve');expect(r.status).toBe(0);expect(r.stdout).toContain('AFTER_AWAIT');expect(r.stderr).toBe('');});
 it('releases the lifetime reference after ordinary referenced success',()=>{const r=invoke('referenced-resolve');expect(r.status).toBe(0);expect(r.stdout).toContain('AFTER_AWAIT');expect(r.stderr).toBe('');});
 it('releases the reference after referenced rejection without logging private error text',()=>{const r=invoke('referenced-reject');expect(r.status).toBe(1);expect(r.stderr).not.toContain('SYNTHETIC_PRIVATE_ERROR_TEXT');expect(JSON.parse(r.stderr).code).toBe('synthetic_delayed');});
 it('captures a synchronous entry failure through the same sanitized completion path',()=>{const r=invoke('sync-reject');expect(r.status).toBe(1);expect(JSON.parse(r.stderr).code).toBe('synthetic_sync');expect(r.stderr).not.toContain('SYNTHETIC_PRIVATE_ERROR_TEXT');});
 it('retains the narrow safe error-code policy',()=>{const r=invoke('unsafe-error');expect(r.status).toBe(1);expect(JSON.parse(r.stderr).code).toBe('local_book_preflight_failed');expect(r.stderr).not.toContain('SYNTHETIC_PRIVATE_ERROR_TEXT');});
});

const requireFromRepo=createRequire(path.join(process.cwd(),'package.json'));
const classify=(input:any)=>requireFromRepo('./scripts/shims/engine-local-terminal.cjs').classifyLocalBookExit(input);
const good=()=>({native:{code:0,signal:null},terminalState:'record',expected:{grantSha256:'a'.repeat(64),sourceRevision:'b'.repeat(40),readerId:'synthetic-only',maximumMicroUsd:10000000,maximumCalls:121,carriedMicroUsd:1860870,carriedCalls:21},
 terminal:{version:'engine-local-book-outcome/v1',status:'automated_supported_internal_review_pending',fictional:true,grantSha256:'a'.repeat(64),sourceRevision:'b'.repeat(40),admittedFrames:9,reader:{url:'http://127.0.0.1:3482/dev/local-reader?book=synthetic-only'},productAccepted:false,productionQualified:false,
  meter:{accountedMicroUsd:2600000,knownEstimateMicroUsd:2600000,logicalCalls:38,carriedMicroUsd:1860870,carriedCalls:21,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,lostLocalCalls:0,blocked:false}}});

describe('supervisor completion metadata, never product acceptance or reserve release',()=>{
 it('records a bound settled internal outcome without promoting product acceptance',()=>{expect(classify(good())).toEqual({supervisorExitCode:0,completionStatus:'terminal_outcome_recorded',completionReason:'bound_settled_internal_outcome'});});
 it.each(['missing','invalid'])('refuses native0 with %s terminal data while preserving native0',state=>{const x=good();x.terminalState=state;const before=structuredClone(x);expect(classify(x)).toMatchObject({supervisorExitCode:1,completionStatus:'incomplete'});expect(x).toEqual(before);expect(x.native.code).toBe(0);});
 it.each(['version','status','grantSha256','sourceRevision','fictional','admittedFrames','reader','productAccepted','productionQualified'])('refuses changed terminal %s',key=>{const x:any=good();x.terminal[key]=key==='admittedFrames'?8:key==='fictional'?false:key==='productAccepted'||key==='productionQualified'?true:key==='reader'?{url:'https://example.invalid/other'}:'changed';expect(classify(x).supervisorExitCode).toBe(1);});
 it.each(['pendingCalls','unknownCalls','failedCalls','overReservedCalls','lostLocalCalls'])('keeps %s incomplete; cannot manufacture settled accounting',key=>{const x:any=good();x.terminal.meter[key]=1;const before=structuredClone(x.terminal.meter);expect(classify(x).supervisorExitCode).toBe(1);expect(x.terminal.meter).toEqual(before);});
 it.each(['accountedMicroUsd','knownEstimateMicroUsd','logicalCalls','carriedMicroUsd','carriedCalls','blocked'])('refuses corrupt/over-cap/reset %s',key=>{const x:any=good();x.terminal.meter[key]=key==='blocked'?true:key==='logicalCalls'?122:key.startsWith('carried')?0:key==='knownEstimateMicroUsd'?1:10000001;expect(classify(x).supervisorExitCode).toBe(1);});
 it('retains original nonzero native exit and signal/spawn-failure evidence',()=>{for(const native of [{code:7,signal:null},{code:null,signal:'SIGTERM'},{code:null,signal:null,errorCode:'ENOENT'}]){const x:any=good();x.native=native;const before=structuredClone(x);expect(classify(x)).toMatchObject({supervisorExitCode:native.code===7?7:1,completionStatus:'native_failed'});expect(x).toEqual(before);}});
 it.each([null,[],{},false])('refuses a non-terminal value %#',value=>{const x:any=good();x.terminal=value;expect(classify(x).supervisorExitCode).toBe(1);});
});
