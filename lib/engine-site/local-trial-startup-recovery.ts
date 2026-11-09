/** One migration of a known constructor refusal, not recovery of a lost provider journal. */
import 'server-only';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail,type EngineOrderAuthority} from './contract';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute);
const ref=z.object({file:absolute,sha256:digest}).strict();
export const localStartupRecoverySchema=z.object({version:z.literal('engine-local-startup-cap-recovery/v1'),
 boundary:z.literal('known_constructor_refusal_before_provider'),parentGrant:ref,parentClaim:ref,parentEnvelope:ref,
 parentStart:ref,parentExit:ref,parentStderr:ref,parentStdout:ref,parentBook:ref}).strict();
export type LocalStartupRecovery=z.infer<typeof localStartupRecoverySchema>;
// Explicit code migration: these bytes always reject a 12M authority BEFORE journal/key/provider work.
// Absence of a journal alone NEVER proves zero spend. Other implementations/failures cannot use this path.
export const LEGACY_STARTUP_CAP_CODE=Object.freeze({
 'scripts/engine-local-book.ts':'a2b00c33d02849d6b2ea831cbd1d169ba0f9990634702980844f024f65049713',
 'lib/engine-site/local-trial-runtime.ts':'ab497e93804288ae459ad8c9675ba7802f59f58a6b902e10b742b5cf388e0bd5',
});
const indexSchema=z.object({root:absolute,rows:z.tuple([z.object({path:z.literal('RUNNING.json'),bytes:z.number().int().positive().max(4096),sha256:digest}).strict()])}).strict();
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function bytes(file:string){
 if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_startup_private_path');
 const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024||realpathSync(file)!==file)engineSiteFail('local_startup_file');
 return readFileSync(file);
}
function pinned(r:z.infer<typeof ref>){const b=bytes(r.file);if(hash(b)!==r.sha256)engineSiteFail('local_startup_evidence_changed');return b;}
const json=(r:z.infer<typeof ref>)=>JSON.parse(pinned(r).toString('utf8'));
function dead(pid:unknown,finishedAt:string){if(!Number.isSafeInteger(pid)||Number(pid)<1)engineSiteFail('local_startup_process');
 try{process.kill(Number(pid),0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')return;throw e;}
 // Windows recycles PIDs. A process born after the sealed exit is not the historical writer.
 const script="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+Number(pid)+"';if($null -ne $p){[Console]::Out.Write($p.CreationDate.ToUniversalTime().ToString('o'))}";
 const out=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','pipe']}).trim();
 if(!out||Number.isFinite(Date.parse(out))&&Date.parse(out)>Date.parse(finishedAt))return;engineSiteFail('local_startup_process_alive');
}
/** Rechecked before/after every paid await; old evidence is never modified or manufactured here. */
export function assertLocalStartupRecoveryEvidence(spec:LocalStartupRecovery){
 const s=localStartupRecoverySchema.parse(spec);
 for(const r of [s.parentGrant,s.parentClaim,s.parentEnvelope,s.parentStart,s.parentExit,s.parentStderr,s.parentStdout])pinned(r);
 const index=indexSchema.parse(json(s.parentBook)),root=index.root;
 if(realpathSync(root)!==root||lstatSync(root).isSymbolicLink()||canonicalHash(readdirSync(root).sort())!==canonicalHash(['RUNNING.json']))engineSiteFail('local_startup_tree');
 const row=index.rows[0],b=pinned({file:path.join(root,row.path),sha256:row.sha256});if(b.length!==row.bytes)engineSiteFail('local_startup_evidence_changed');
 return {root,running:JSON.parse(b.toString('utf8'))};
}
const admitted=new WeakSet<object>();
export type LocalStartupRecoveryEnvelope={readonly claimFile:string;readonly spec:LocalStartupRecovery;readonly parentPid:number;readonly supervisorPid:number;readonly finishedAt:string;readonly check:()=>void};
export function loadLocalStartupRecovery(g:LocalEngineGrant,prior:LocalEngineGrant,priorAuthority:EngineOrderAuthority,masterFile:string):LocalStartupRecoveryEnvelope{
 const s=localStartupRecoverySchema.parse(g.startupRecovery),{root,running}=assertLocalStartupRecoveryEvidence(s);
 if(!g.freshBookPolicy||!g.imageModelPolicy||!prior.freshBookPolicy||!prior.imageModelPolicy||prior.startupRecovery||
  [prior.continuation,prior.planningRecovery,prior.mediaContinuation,prior.childBindingContinuation,prior.locationsRepairContinuation,prior.locationsV2RepairContinuation].some(Boolean)||
  canonicalHash(json(s.parentGrant))!==canonicalHash(prior)||root!==prior.directory||s.parentClaim.file!==masterFile||
  prior.maximumMicroUsd!==12_000_000||g.maximumMicroUsd!==prior.maximumMicroUsd||g.maximumCalls!==prior.maximumCalls||
  g.source.root!==prior.source.root||g.source.head===prior.source.head||g.readerId!==prior.readerId||
  g.approvalReference!==prior.approvalReference||g.approvedBy!==prior.approvedBy||g.approvedAt!==prior.approvedAt||
  canonicalHash(g.profile)!==canonicalHash(prior.profile)||canonicalHash(g.credentials)!==canonicalHash(prior.credentials)||
  canonicalHash(g.imageModelPolicy)!==canonicalHash(prior.imageModelPolicy)||g.responseSchemaPolicy!==prior.responseSchemaPolicy||
  g.storyboardBindingPolicy!==prior.storyboardBindingPolicy||g.locationSheetPolicy!==prior.locationSheetPolicy)engineSiteFail('local_startup_scope');
 const destination=path.resolve(g.directory).toLowerCase(),old=path.resolve(root).toLowerCase();
 if(destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep)||existsSync(g.directory))engineSiteFail('local_startup_destination');
 for(const [file,expected] of Object.entries(LEGACY_STARTUP_CAP_CODE)){
  const pins=prior.source.pins.filter(x=>x.path===file);if(pins.length!==1||pins[0].sha256!==expected)engineSiteFail('local_startup_implementation');
  const blob=execFileSync('git',['-c','safe.directory='+g.source.root,'-C',g.source.root,'show',prior.source.head+':'+file],{maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
  if(hash(blob)!==expected)engineSiteFail('local_startup_implementation');
 }
 const claim={version:'engine-local-book-claim/v1',grantFile:s.parentGrant.file,grantSha256:s.parentGrant.sha256,
  authoritySha256:canonicalHash(priorAuthority),directory:prior.directory,sourceRoot:prior.source.root};
 if(canonicalHash(json(s.parentClaim))!==canonicalHash(claim))engineSiteFail('local_startup_claim');
 const envelope=json(s.parentEnvelope),start=json(s.parentStart),exit=json(s.parentExit),error=json(s.parentStderr);
 if(envelope.version!=='m34-one-fresh-book-envelope/v1'||envelope.sourceHead!==prior.source.head||envelope.sourceRoot!==prior.source.root||envelope.masterClaim!==masterFile||envelope.futureGrantSha256!==s.parentGrant.sha256||
  start.version!=='m34-supervisor-start/v1'||exit.version!=='m34-supervisor-exit/v1'||start.sourceHead!==prior.source.head||start.grantSha256!==s.parentGrant.sha256||canonicalHash(start.envelope)!==canonicalHash(s.parentEnvelope)||
  start.carriedMicroUsd!==0||start.carriedCalls!==0||start.maximumTotalMicroUsd!==prior.maximumMicroUsd||start.maximumTotalCalls!==prior.maximumCalls||
  exit.childPid!==start.childPid||exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.terminalSha256!==null||
  exit.supervisorExitCode!==1||exit.completionStatus!=='native_failed'||exit.completionReason!=='native_exit_failure'||
  canonicalHash(error)!==canonicalHash({status:'stopped',code:'local_trial_authority',providerDispatchNotConfirmed:true})||pinned(s.parentStdout).length!==0||
  running.pid!==start.childPid||running.grantSha256!==s.parentGrant.sha256||!Number.isFinite(Date.parse(running.startedAt))||
  !Number.isFinite(Date.parse(exit.at))||Date.parse(exit.at)>Date.now()||Date.parse(exit.at)<Date.parse(running.startedAt))engineSiteFail('local_startup_terminal');
 dead(start.childPid,exit.at);dead(start.pid,exit.at);
 for(const r of [s.parentGrant,s.parentClaim,s.parentEnvelope,s.parentStart,s.parentExit,s.parentStderr,s.parentStdout,s.parentBook])Object.freeze(r);Object.freeze(s);
 const value:LocalStartupRecoveryEnvelope=Object.freeze({claimFile:masterFile+'.startup-cap-recovery.json',spec:s,parentPid:start.childPid,supervisorPid:start.pid,finishedAt:exit.at,
  check:()=>{assertLocalStartupRecoveryEvidence(s);}});admitted.add(value);return value;
}
/** A fixed consent-global namespace; copied grants, lost journals and recursive recovery cannot repurchase. */
export function claimLocalStartupRecovery(e:LocalStartupRecoveryEnvelope,binding:unknown,resume:boolean,masterFile:string){
 if(!admitted.has(e)||resume||e.claimFile!==masterFile+'.startup-cap-recovery.json')engineSiteFail('local_startup_capability');e.check();dead(e.parentPid,e.finishedAt);dead(e.supervisorPid,e.finishedAt);
 if(existsSync(e.claimFile))engineSiteFail('local_startup_already_claimed');
 writeFileSync(e.claimFile,JSON.stringify({version:'engine-local-startup-cap-claim/v1',parentClaimSha256:e.spec.parentClaim.sha256,binding},null,2)+'\n',{flag:'wx',mode:0o600});
 return e.claimFile;
}
