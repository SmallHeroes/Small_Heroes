/**
 * One-use owner consent for the local current-engine rehearsal (engine-local-current-consent/v1).
 *
 * The run's own CLAIM.json lives inside its output folder, so a copy of the same OWNER-GO in another folder, or a lost journal, used to look
 * like a new approval. This ledger lives OUTSIDE every output and journal tree and is keyed by the consent's immutable identity (its
 * approvalReference):
 * - claim: one atomic write-once record per consent, bound to the exact captured GO bytes, source, profile, authority, output and journal.
 *   A second execute anywhere (a copy, another folder, a race) is refused; only --resume of that same binding is admitted.
 * - lease: at most one live process per consent (a stale lease of a dead process is taken over only by --resume).
 * - dispatch witness: one write-once record per dispatched step BEFORE the provider is called, and the provider's first id once it is
 *   known. The runtime counts every witnessed step at its full reserve whenever its local evidence is missing or disagrees, and refuses.
 * Nothing here reads a credential or calls a provider.
 */
import 'server-only';
import {randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import type {LocalTrialDispatchWitness} from './local-trial-runtime';

/** The owner's machine-wide consent ledger (the same folder that already holds the older local books' master claims). */
export const LOCAL_CONSENT_LEDGER_ROOT='C:\\GNart\\Work\\book-authority';
export const LOCAL_CONSENT_VERSION='engine-local-current-consent/v1' as const;
const digest=z.string().regex(/^[a-f0-9]{64}$/),reference=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);
export const localConsentRecordSchema=z.object({version:z.literal(LOCAL_CONSENT_VERSION),approvalReference:reference,goSha256:digest,goCanonicalSha256:digest,
 sourceRevision:z.string().regex(/^[a-f0-9]{40}$/),profileSha256:digest,authoritySha256:digest,out:z.string().min(1),journal:z.string().min(1),
 claimedAt:z.string().datetime({precision:3})}).strict();
export type LocalConsentBinding=Omit<z.infer<typeof localConsentRecordSchema>,'version'|'claimedAt'>;
const leaseSchema=z.object({version:z.literal('engine-local-current-lease/v1'),consentSha256:digest,pid:z.number().int().positive(),startedAt:z.string()}).strict();
const dispatchSchema=z.object({version:z.literal('engine-local-current-dispatch/v1'),consentSha256:digest,authoritySha256:digest,step:z.string().min(1),
 claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
const providerSchema=z.object({version:z.literal('engine-local-current-provider-id/v1'),consentSha256:digest,authoritySha256:digest,step:z.string().min(1),
 claimSha256:digest,id:z.string().regex(/^(?:msgbatch|resp)_[A-Za-z0-9_-]+$/),dispatchAt:z.number().int().nonnegative()}).strict();

const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return (error as {code?:string}).code==='EPERM';}};
function read(file:string):unknown{if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==path.resolve(file))engineSiteFail('local_consent_file');return JSON.parse(readFileSync(file,'utf8'));}
/** Create exactly once; an existing file (a copy, a race) refuses with `code`. */
function createOnce(file:string,value:unknown,code:string){try{writeFileSync(file,json(value),{flag:'wx',mode:0o600});}catch(error){if((error as {code?:string}).code==='EEXIST')engineSiteFail(code);throw error;}}

export function localConsentLedger(root:string,approvalReference:string){
 reference.parse(approvalReference);mkdirSync(root,{recursive:true,mode:0o700});
 const real=realpathSync(root);if(lstatSync(root).isSymbolicLink()||real!==path.resolve(root))engineSiteFail('local_consent_ledger_path');
 const base=path.join(real,'local-current-'+approvalReference);
 const stepName=(step:string)=>{if(!/^[a-z][a-z0-9_]{0,99}$/.test(step))engineSiteFail('local_consent_step');return step;};
 return {root:real,consentFile:base+'.consent.json',leaseFile:base+'.lease.json',
  dispatchFile:(step:string)=>base+'.dispatch.'+stepName(step)+'.json',providerFile:(step:string)=>base+'.dispatch.'+stepName(step)+'.provider.json'};
}
export type LocalConsentLedger=ReturnType<typeof localConsentLedger>;

/**
 * The one consumption of a consent: a first execute creates the record atomically; anything else that finds it refuses, except a --resume
 * whose binding (the same captured GO bytes, source, profile, authority, output and journal) is exactly the recorded one.
 */
export function claimLocalConsent(ledger:LocalConsentLedger,binding:LocalConsentBinding,resume:boolean,now=()=>new Date()){
 if(existsSync(ledger.consentFile)){
  const saved=localConsentRecordSchema.parse(read(ledger.consentFile));
  if(!resume)engineSiteFail('local_current_consent_used');
  const {version:_v,claimedAt:_c,...recorded}=saved;
  if(canonicalHash(recorded)!==canonicalHash(binding))engineSiteFail('local_current_consent_binding');
  return {record:saved,consentSha256:canonicalHash(saved)};
 }
 if(resume)engineSiteFail('local_current_resume_without_consent');
 const record=localConsentRecordSchema.parse({version:LOCAL_CONSENT_VERSION,...binding,claimedAt:now().toISOString()});
 createOnce(ledger.consentFile,record,'local_current_consent_used');
 return {record,consentSha256:canonicalHash(record)};
}

/** At most one live process per consent. A dead holder's lease is taken over only by --resume, atomically (a racing resume refuses). */
export function acquireLocalLease(ledger:LocalConsentLedger,consentSha256:string,resume:boolean,pid=process.pid){
 const value={version:'engine-local-current-lease/v1' as const,consentSha256,pid,startedAt:new Date().toISOString()};
 if(existsSync(ledger.leaseFile)){
  const old=leaseSchema.parse(read(ledger.leaseFile));
  if(old.pid===pid||alive(old.pid))engineSiteFail('local_current_running');
  if(!resume||old.consentSha256!==consentSha256)engineSiteFail('local_current_resume_required');
  try{renameSync(ledger.leaseFile,ledger.leaseFile.replace(/\.lease\.json$/,'.lease-stale-'+Date.now()+'-'+randomUUID()+'.json'));}
  catch(error){if((error as {code?:string}).code==='ENOENT')engineSiteFail('local_current_running');throw error;}
 }
 createOnce(ledger.leaseFile,value,'local_current_running');
 const mine=()=>{if(!existsSync(ledger.leaseFile))return false;const r=leaseSchema.parse(read(ledger.leaseFile));return r.pid===pid&&r.consentSha256===consentSha256&&r.startedAt===value.startedAt;};
 return {assert:()=>{if(!mine())engineSiteFail('local_current_lease_lost');},release:()=>{if(mine())unlinkSync(ledger.leaseFile);}};
}

/** The consent-global dispatch witness of one claimed consent (LocalTrialDispatchWitness, plus the provider's first id). */
export function localConsentDispatchWitness(ledger:LocalConsentLedger,consentSha256:string,authority:EngineOrderAuthority):LocalTrialDispatchWitness{
 const authoritySha256=canonicalHash(authority);
 const consent=()=>{if(!existsSync(ledger.consentFile)||canonicalHash(localConsentRecordSchema.parse(read(ledger.consentFile)))!==consentSha256)engineSiteFail('local_current_consent_binding');};
 const slot=(step:string)=>authority.budget.steps.find(s=>s.id===step)??engineSiteFail('local_current_dispatch_binding');
 const record=(step:string)=>{const f=ledger.dispatchFile(step);if(!existsSync(f))return null;const r=dispatchSchema.parse(read(f));
  if(r.consentSha256!==consentSha256||r.authoritySha256!==authoritySha256||r.step!==step||r.maximumMicroUsd!==slot(step).maximumMicroUsd)engineSiteFail('local_current_dispatch_binding');return r;};
 const observed=(step:string)=>{consent();const f=ledger.providerFile(step);if(!existsSync(f))return null;const p=providerSchema.parse(read(f)),r=record(step);
  if(!r||p.consentSha256!==consentSha256||p.authoritySha256!==authoritySha256||p.step!==step||p.claimSha256!==r.claimSha256)engineSiteFail('local_current_provider_binding');
  return {claimSha256:p.claimSha256,id:p.id,dispatchAt:p.dispatchAt};};
 return {
  list:()=>{consent();return authority.budget.steps.map(s=>record(s.id)).filter((r):r is NonNullable<typeof r>=>r!==null);},
  check(step,claimSha256,dispatched){consent();const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('local_current_unknown_dispatch');},
  begin(step,claimSha256){consent();digest.parse(claimSha256);
   createOnce(ledger.dispatchFile(step),{version:'engine-local-current-dispatch/v1',consentSha256,authoritySha256,step,claimSha256,maximumMicroUsd:slot(step).maximumMicroUsd},'local_current_unknown_dispatch');},
  observed,
  observe(step,claimSha256,id,dispatchAt){const r=record(step);if(!r||r.claimSha256!==claimSha256)engineSiteFail('local_current_dispatch_binding');
   const old=observed(step);if(old){if(old.id!==id||old.dispatchAt!==dispatchAt)engineSiteFail('local_trial_pending_id');return;}
   createOnce(ledger.providerFile(step),providerSchema.parse({version:'engine-local-current-provider-id/v1',consentSha256,authoritySha256,step,claimSha256,id,dispatchAt}),'local_trial_pending_id');},
 };
}
