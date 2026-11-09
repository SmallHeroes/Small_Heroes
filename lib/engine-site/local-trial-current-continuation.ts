/** One whole-plan repair of a settled current-policy initial HOLD, without repurchasing the story. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail} from './contract';
import {assertLocalParentEvidence,localInitialParentSpec,type LocalParentEnvelope} from './local-trial-continuation';
import {assertLocalStartupRecoveryEvidence} from './local-trial-startup-recovery';

type Ref={file:string;sha256:string};
function bytes(file:string){
 if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_current_private_path');
 const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024||realpathSync(file)!==file)engineSiteFail('local_current_file');return readFileSync(file);
}
function pinned(r:Ref){if(!r||typeof r.file!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256))engineSiteFail('local_current_parent_pin');const b=bytes(r.file);if(createHash('sha256').update(b).digest('hex')!==r.sha256)engineSiteFail('local_current_evidence_changed');return JSON.parse(b.toString('utf8'));}
/** Read-only fence, also called before and after each provider await. No parent file is changed. */
export function assertLocalCurrentContinuationEvidence(g:LocalEngineGrant){
 const s=g.currentContinuation;if(!s)engineSiteFail('local_current_scope');
 assertLocalParentEvidence(localInitialParentSpec(g)!);const start=pinned(s.parentStart);pinned(start.envelope);pinned(s.parentExecutionClaim);
 const prior=pinned(s.parentGrant) as LocalEngineGrant;
 pinned(prior.ownerApproval);
 if(prior.startupRecovery)assertLocalStartupRecoveryEvidence(prior.startupRecovery);
}
const admitted=new WeakSet<object>();
export type LocalCurrentContinuationEnvelope={readonly masterFile:string;readonly executionFile:string;readonly parentExecutionFile:string;readonly check:()=>void;readonly claim:(binding:unknown,resume:boolean,masterFile:string)=>string};
/** The caller has recomputed the OLD authority and compared it to the actual six-receipt checkpoint. */
export function loadLocalCurrentContinuation(g:LocalEngineGrant,parent:LocalParentEnvelope,masterFile:string):LocalCurrentContinuationEnvelope{
 const s=g.currentContinuation;if(!s)engineSiteFail('local_current_scope');
 assertLocalCurrentContinuationEvidence(g);
 const prior=parent.parent,parentExecutionFile=prior.startupRecovery?masterFile+'.startup-cap-recovery.json':masterFile;
 const binding={version:'engine-local-book-claim/v1',grantFile:s.parentGrant.file,grantSha256:s.parentGrant.sha256,
  authoritySha256:canonicalHash(parent.authority),directory:prior.directory,sourceRoot:prior.source.root,
  ...(prior.startupRecovery?{startupRecoverySha256:canonicalHash(prior.startupRecovery)}:{})};
 const expected=prior.startupRecovery?{version:'engine-local-startup-cap-claim/v1',parentClaimSha256:prior.startupRecovery.parentClaim.sha256,binding}:binding;
 if(s.parentExecutionClaim.file!==parentExecutionFile||canonicalHash(pinned(s.parentExecutionClaim))!==canonicalHash(expected))engineSiteFail('local_current_parent_claim');
 const globalFile=masterFile+'.continuation.json',executionFile=parentExecutionFile+'.continuation.json';
 // Legacy and current-mode children share the original consent's ONE-child consumption key.
 if(existsSync(globalFile)||existsSync(executionFile))engineSiteFail('local_current_already_claimed');
 const specSha256=canonicalHash(s);
 let claimed:unknown|undefined,globalClaim:unknown|undefined;
 const check=()=>{
  if(canonicalHash(g.currentContinuation)!==specSha256)engineSiteFail('local_current_scope_changed');
  assertLocalCurrentContinuationEvidence(g);
  if(claimed!==undefined){
   if(!existsSync(globalFile)||!existsSync(executionFile)||canonicalHash(JSON.parse(bytes(globalFile).toString('utf8')))!==canonicalHash(globalClaim)||
    canonicalHash(JSON.parse(bytes(executionFile).toString('utf8')))!==canonicalHash(claimed))engineSiteFail('local_current_claim_changed');
  }
 };
 const value:LocalCurrentContinuationEnvelope={masterFile,executionFile,parentExecutionFile,check,
  claim(next,resume,actualMaster){
   if(!admitted.has(value)||resume||actualMaster!==masterFile)engineSiteFail('local_current_capability');check();
   if(existsSync(globalFile)||existsSync(executionFile))engineSiteFail('local_current_already_claimed');
   const write=(file:string,v:unknown)=>writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
   // Consume the global key FIRST. A crash/missing child journal cannot free an approval.
   const lock=executionFile===globalFile?next:{version:'engine-local-current-continuation-claim/v1',parentExecutionClaim:s.parentExecutionClaim,executionFile,binding:next};
   write(globalFile,lock);if(executionFile!==globalFile)write(executionFile,next);
   claimed=structuredClone(next);globalClaim=structuredClone(lock);check();return executionFile;
  }};
 Object.freeze(value);admitted.add(value);return value;
}
