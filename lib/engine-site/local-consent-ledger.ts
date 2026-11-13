/**
 * One-use owner consent for the local current-engine rehearsal (engine-local-current-consent/v2).
 *
 * The run's own CLAIM.json lives inside its output folder, so a copy of the same OWNER-GO in another folder, or a lost journal, used to look
 * like a new approval. This ledger lives OUTSIDE every output and journal tree:
 * - registration (engine-local-current-registration/v1): the GO alone is never paid authority. An activation exists only when a separate,
 *   independently reviewed operator step registered it here first, write-once under both its reference and its approval identity (the GO
 *   without its reference), bound to the exact GO bytes, source, profile, output and reader and to a pinned independent PASS seal of those GO
 *   bytes. A copied, edited-reference or reserialized GO has no matching registration and never reaches the executor. The execute path only
 *   reads registrations; it never creates one.
 * - claim: one atomic write-once record per registered consent, bound to that registration and the exact captured GO bytes, source, profile,
 *   authority, output and journal. A second execute anywhere (a copy, another folder, a race) is refused; only --resume of that same binding
 *   is admitted.
 * - lease: at most one live process per consent. Every lease creation and stale takeover runs inside one write-once ledger transaction that
 *   re-reads the exact generation it inspected; a newly live holder is never moved, and a transaction left by a crash is never guessed away.
 * - dispatch witness: one write-once record per dispatched step BEFORE the provider is called, and the provider's first id once it is
 *   known. The runtime counts every witnessed step at its full reserve whenever its local evidence is missing or disagrees, and refuses.
 * Nothing here reads a credential or calls a provider.
 */
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import {engineSiteFail,type EngineOrderAuthority} from './contract';
import type {LocalTrialDispatchWitness} from './local-trial-runtime';

/** The owner's machine-wide consent ledger (the same folder that already holds the older local books' master claims). */
export const LOCAL_CONSENT_LEDGER_ROOT='C:\\GNart\\Work\\book-authority';
export const LOCAL_CONSENT_VERSION='engine-local-current-consent/v2' as const;
export const LOCAL_REGISTRATION_VERSION='engine-local-current-registration/v1' as const;
/** The scope an independent review seal must name to back one registered activation. */
export const LOCAL_ACTIVATION_REVIEW_SCOPE='LOCAL_CURRENT_ENGINE_ACTIVATION' as const;
const digest=z.string().regex(/^[a-f0-9]{64}$/),reference=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/),revision=z.string().regex(/^[a-f0-9]{40}$/);
const pin=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const localConsentRecordSchema=z.object({version:z.literal(LOCAL_CONSENT_VERSION),approvalReference:reference,registrationSha256:digest,goSha256:digest,
 goCanonicalSha256:digest,sourceRevision:revision,profileSha256:digest,authoritySha256:digest,out:z.string().min(1),journal:z.string().min(1),
 claimedAt:z.string().datetime({precision:3})}).strict();
export type LocalConsentBinding=Omit<z.infer<typeof localConsentRecordSchema>,'version'|'claimedAt'>;
export const localRegistrationSchema=z.object({version:z.literal(LOCAL_REGISTRATION_VERSION),registeredBy:z.literal('Codex technical operator'),
 registeredAt:z.string().datetime({precision:3}),approvalReference:reference,approvalIdentitySha256:digest,goSha256:digest,goCanonicalSha256:digest,
 sourceRevision:revision,profileSha256:digest,out:z.string().refine(path.isAbsolute),readerId:z.string().min(1),independentReview:pin}).strict();
export type LocalRegistrationInput=Omit<z.infer<typeof localRegistrationSchema>,'version'|'registeredBy'|'registeredAt'>;
const approvalIndexSchema=z.object({version:z.literal('engine-local-current-approval/v1'),approvalIdentitySha256:digest,approvalReference:reference}).strict();
const transactionSchema=z.object({version:z.literal('engine-local-current-transaction/v1'),pid:z.number().int().positive(),startedAt:z.string()}).strict();
const leaseSchema=z.object({version:z.literal('engine-local-current-lease/v1'),consentSha256:digest,pid:z.number().int().positive(),startedAt:z.string()}).strict();
const dispatchSchema=z.object({version:z.literal('engine-local-current-dispatch/v1'),consentSha256:digest,authoritySha256:digest,step:z.string().min(1),
 claimSha256:digest,maximumMicroUsd:z.number().int().positive()}).strict();
const providerSchema=z.object({version:z.literal('engine-local-current-provider-id/v1'),consentSha256:digest,authoritySha256:digest,step:z.string().min(1),
 claimSha256:digest,id:z.string().regex(/^(?:msgbatch|resp)_[A-Za-z0-9_-]+$/),dispatchAt:z.number().int().nonnegative()}).strict();

const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return (error as {code?:string}).code==='EPERM';}};
function bytes(file:string){if(/(^|[\\/])\.env(?:\.|$)/i.test(file)||lstatSync(file).isSymbolicLink()||realpathSync(file)!==path.resolve(file))engineSiteFail('local_consent_file');return readFileSync(file);}
function read(file:string):unknown{return JSON.parse(bytes(file).toString('utf8'));}
/** Create exactly once; an existing file (a copy, a race) refuses with `code`. */
function createOnce(file:string,value:unknown,code:string){try{writeFileSync(file,json(value),{flag:'wx',mode:0o600});}catch(error){if((error as {code?:string}).code==='EEXIST')engineSiteFail(code);throw error;}}
/**
 * One serialized ledger mutation (engine-local-current-transaction/v1): a write-once lock file around `body`. A contender that finds the lock
 * refuses: `local_current_running` while its holder is alive, `local_current_transaction_ambiguous` when that holder is gone or unreadable (a
 * crash inside a mutation is never guessed away). A body that refuses before calling `mutating()` leaves nothing behind; a failure after it
 * keeps the lock, so the state stays refused until an operator resolves it.
 */
export function localLedgerTransaction<T>(lockFile:string,body:(mutating:()=>void)=>T,pid=process.pid):T{
 try{writeFileSync(lockFile,json({version:'engine-local-current-transaction/v1',pid,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}
 catch(error){if((error as {code?:string}).code!=='EEXIST')throw error;
  let holder:number|null=null;try{holder=transactionSchema.parse(read(lockFile)).pid;}catch{holder=null;}
  engineSiteFail(holder!==null&&alive(holder)?'local_current_running':'local_current_transaction_ambiguous');}
 let mutated=false;
 try{const out=body(()=>{mutated=true;});unlinkSync(lockFile);return out;}
 catch(error){if(!mutated)unlinkSync(lockFile);throw error;}
}
/** The approval identity of a GO: every field except its self-declared reference (a renamed copy is the same approval). */
export const localApprovalIdentity=(go:Record<string,unknown>)=>{const {approvalReference:_reference,...approval}=go;return canonicalHash(approval);};

export function localConsentLedger(root:string,approvalReference:string){
 reference.parse(approvalReference);mkdirSync(root,{recursive:true,mode:0o700});
 const real=realpathSync(root);if(lstatSync(root).isSymbolicLink()||real!==path.resolve(root))engineSiteFail('local_consent_ledger_path');
 const base=path.join(real,'local-current-'+approvalReference);
 const stepName=(step:string)=>{if(!/^[a-z][a-z0-9_]{0,99}$/.test(step))engineSiteFail('local_consent_step');return step;};
 return {root:real,consentFile:base+'.consent.json',leaseFile:base+'.lease.json',leaseTransactionFile:base+'.lease-transaction.json',
  registrationFile:base+'.registration.json',approvalFile:(identity:string)=>path.join(real,'local-current-approval-'+digest.parse(identity)+'.json'),
  dispatchFile:(step:string)=>base+'.dispatch.'+stepName(step)+'.json',providerFile:(step:string)=>base+'.dispatch.'+stepName(step)+'.provider.json'};
}
export type LocalConsentLedger=ReturnType<typeof localConsentLedger>;

/** The independent PASS seal of exactly these GO bytes on this source (the startup-registration seal shape, scoped to one activation). */
function admitReview(r:z.infer<typeof localRegistrationSchema>){
 const b=bytes(r.independentReview.file);if(sha(b)!==r.independentReview.sha256)engineSiteFail('local_current_registration_review');
 const review=JSON.parse(b.toString('utf8'));
 if(review.version!=='codex-complete-independent-review-seal/v1'||review.disposition!=='PASS'||review.scope!==LOCAL_ACTIVATION_REVIEW_SCOPE||review.sourceHead!==r.sourceRevision||
  review.goSha256!==r.goSha256||review.actualReviewerTurnComplete!==true||!Number.isFinite(Date.parse(review.verifiedAt))||Date.parse(review.verifiedAt)>Date.parse(r.registeredAt))
  engineSiteFail('local_current_registration_review');
}
/**
 * The separate, later, explicitly approved operator step (never the execute path): registers ONE activation write-once, first under its approval
 * identity (so a renamed copy of the same approval cannot register again), then under its reference. A crash between the two leaves the
 * identity taken and no registration: execution refuses and re-registration refuses (fail closed, for an operator).
 */
export function registerLocalCurrentActivation(root:string,input:LocalRegistrationInput,now=()=>new Date()){
 const record=localRegistrationSchema.parse({version:LOCAL_REGISTRATION_VERSION,registeredBy:'Codex technical operator',registeredAt:now().toISOString(),...input});
 admitReview(record);const ledger=localConsentLedger(root,record.approvalReference);
 createOnce(ledger.approvalFile(record.approvalIdentitySha256),{version:'engine-local-current-approval/v1',approvalIdentitySha256:record.approvalIdentitySha256,
  approvalReference:record.approvalReference},'local_current_approval_registered');
 createOnce(ledger.registrationFile,record,'local_current_registration_exists');
 return {record,registrationSha256:sha(bytes(ledger.registrationFile))};
}
/**
 * Admits a GO only through its existing registration: the same reference, approval identity, exact GO bytes and canonical GO, source, profile,
 * output and reader, its pinned independent seal, and the identity index naming this reference. `check` re-pins both before every use.
 */
export function admitLocalCurrentRegistration(ledger:LocalConsentLedger,go:Record<string,unknown>&{approvalReference:string;approvedAt:string},
 bound:{goSha256:string;sourceRevision:string;profileSha256:string;out:string;readerId:string},now=()=>Date.now()){
 if(!existsSync(ledger.registrationFile))engineSiteFail('local_current_registration_required');
 const raw=bytes(ledger.registrationFile),registrationSha256=sha(raw),identity=localApprovalIdentity(go);
 const r=localRegistrationSchema.parse(JSON.parse(raw.toString('utf8'))),registered=Date.parse(r.registeredAt);
 if(r.approvalReference!==go.approvalReference||r.approvalIdentitySha256!==identity||r.goSha256!==bound.goSha256||r.goCanonicalSha256!==canonicalHash(go)||
  r.sourceRevision!==bound.sourceRevision||r.profileSha256!==bound.profileSha256||r.out!==bound.out||r.readerId!==bound.readerId||
  registered<Date.parse(go.approvedAt)||registered>now())engineSiteFail('local_current_registration_binding');
 admitReview(r);
 const approvalFile=ledger.approvalFile(identity);if(!existsSync(approvalFile))engineSiteFail('local_current_registration_binding');
 const index=approvalIndexSchema.parse(read(approvalFile));
 if(index.approvalIdentitySha256!==identity||index.approvalReference!==r.approvalReference)engineSiteFail('local_current_registration_binding');
 const check=()=>{if(!existsSync(ledger.registrationFile)||sha(bytes(ledger.registrationFile))!==registrationSha256)engineSiteFail('local_current_registration_changed');admitReview(r);};
 return {record:r,registrationSha256,check};
}

/**
 * The one consumption of a consent: a first execute creates the record atomically; anything else that finds it refuses, except a --resume
 * whose binding (the same registration, captured GO bytes, source, profile, authority, output and journal) is exactly the recorded one.
 */
export function claimLocalConsent(ledger:LocalConsentLedger,binding:LocalConsentBinding,resume:boolean,now=()=>new Date()){
 if(existsSync(ledger.consentFile)){
  const saved=localConsentRecordSchema.safeParse(read(ledger.consentFile));
  if(!saved.success)engineSiteFail('local_current_consent_binding');
  if(!resume)engineSiteFail('local_current_consent_used');
  const {version:_v,claimedAt:_c,...recorded}=saved.data;
  if(canonicalHash(recorded)!==canonicalHash(binding))engineSiteFail('local_current_consent_binding');
  return {record:saved.data,consentSha256:canonicalHash(saved.data)};
 }
 if(resume)engineSiteFail('local_current_resume_without_consent');
 const record=localConsentRecordSchema.parse({version:LOCAL_CONSENT_VERSION,...binding,claimedAt:now().toISOString()});
 createOnce(ledger.consentFile,record,'local_current_consent_used');
 return {record,consentSha256:canonicalHash(record)};
}

/**
 * At most one live process per consent. A dead holder's lease is taken over only by --resume. Creation and takeover are one ledger transaction:
 * inside it the exact generation (bytes) first inspected must still be the lease and its holder still dead, otherwise the contender refuses
 * (a newly live holder is never moved).
 */
export function acquireLocalLease(ledger:LocalConsentLedger,consentSha256:string,resume:boolean,pid=process.pid){
 const value={version:'engine-local-current-lease/v1' as const,consentSha256,pid,startedAt:new Date().toISOString()};
 const seen=existsSync(ledger.leaseFile)?bytes(ledger.leaseFile):null,old=seen?leaseSchema.parse(JSON.parse(seen.toString('utf8'))):null;
 if(old){
  if(old.pid===pid||alive(old.pid))engineSiteFail('local_current_running');
  if(!resume||old.consentSha256!==consentSha256)engineSiteFail('local_current_resume_required');
 }
 localLedgerTransaction(ledger.leaseTransactionFile,mutating=>{
  const current=existsSync(ledger.leaseFile)?bytes(ledger.leaseFile):null;
  if(seen===null?current!==null:current===null||!current.equals(seen))engineSiteFail('local_current_running');
  if(old){if(alive(old.pid))engineSiteFail('local_current_running');
   mutating();renameSync(ledger.leaseFile,ledger.leaseFile.replace(/\.lease\.json$/,'.lease-stale-'+Date.now()+'-'+randomUUID()+'.json'));}
  mutating();createOnce(ledger.leaseFile,value,'local_current_running');
 },pid);
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
