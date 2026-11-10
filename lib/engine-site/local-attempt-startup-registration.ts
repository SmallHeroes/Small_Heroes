/** A technical startup record, never a new owner decision or another planning attempt. */
import 'server-only';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import type {LocalEngineGrant} from '@/scripts/engine-local-book';
import {engineSiteFail} from './contract';
import {localAttemptApprovalSchema,localAttemptOwnerGoSchema} from './local-attempt-extension-policy';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';

const digest=z.string().regex(/^[a-f0-9]{64}$/),ref=z.object({file:z.string().refine(path.isAbsolute),sha256:digest}).strict();
export const LOCAL_ATTEMPT_STARTUP_REVIEW_SCOPE='M39_ZERO_DISPATCH_STARTUP_CODE_AND_ENVELOPE' as const;
export const localAttemptStartupRegistrationSchema=z.object({version:z.literal('engine-local-attempt-startup-registration/v1'),
 registeredBy:z.literal('Codex technical operator'),registeredAt:z.string().datetime({precision:3}),ownerDecisionUnchanged:z.literal(true),
 sourceHead:z.string().regex(/^[a-f0-9]{40}$/),grantCanonicalSha256:digest,
 ownerGo:ref,originalGrant:ref,originalStart:ref,originalExit:ref,originalStderr:ref,originalStdout:ref,sourceReviewSeal:ref,
}).strict();
function bytes(file:string){if(!path.isAbsolute(file)||/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('local_registration_private_path');const f=path.resolve(file),s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024||realpathSync(f)!==f)engineSiteFail('local_registration_file');return readFileSync(f);}
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const json=(f:string)=>JSON.parse(bytes(f).toString('utf8'));
function pinned(r:z.infer<typeof ref>){const b=bytes(r.file);if(sha(b)!==r.sha256)engineSiteFail('local_registration_pin_changed');return b;}
/** No grant/claim/journal may have been consumed. The original six-hour book window is NEVER reset. */
export function admitLocalAttemptStartupRegistration(g:LocalEngineGrant,scope:z.infer<typeof localAttemptApprovalSchema>,go:z.infer<typeof localAttemptOwnerGoSchema>,goSha256:string,masterFile:string,executionFile:string){
 const file=g.currentAttemptExtension?.startupRegistrationFile;if(!file)engineSiteFail('local_registration_required');
 const raw=bytes(file),registrationSha256=sha(raw),r=localAttemptStartupRegistrationSchema.parse(JSON.parse(raw.toString('utf8')));
 const now=Date.now(),registered=Date.parse(r.registeredAt),ownerAt=Date.parse(go.approvedAt);
 if(r.sourceHead!==g.source.head||r.grantCanonicalSha256!==canonicalHash(g)||r.ownerGo.file!==scope.ownerGoFile||r.ownerGo.sha256!==goSha256||registered>now||now-registered>1200000||registered<ownerAt||ownerAt>now||now-ownerAt>=21600000)engineSiteFail('local_registration_time_or_scope');
 const original=JSON.parse(pinned(r.originalGrant).toString('utf8')) as LocalEngineGrant;
 if(!original.currentAttemptExtension||original.currentAttemptExtension.startupRegistrationFile||original.source.head!==scope.sourceHead||go.sourceHead!==scope.sourceHead||original.directory!==scope.directory||original.source.root!==g.source.root||original.currentAttemptExtension.approval.sha256!==g.currentAttemptExtension!.approval.sha256)engineSiteFail('local_registration_original_scope');
 const current={...g.currentAttemptExtension};delete current.startupRegistrationFile;
 if(canonicalHash(current)!==canonicalHash(original.currentAttemptExtension))engineSiteFail('local_registration_original_scope');
 for(const k of ['profile','credentials','readerId','approvalReference','approvedBy','approvedAt','maximumMicroUsd','maximumCalls','imageModelPolicy','responseSchemaPolicy','storyboardBindingPolicy','locationSheetPolicy','fictional','publicDelivery','realPayment'] as const)
  if(canonicalHash(g[k]??null)!==canonicalHash(original[k]??null))engineSiteFail('local_registration_original_scope');
 const destination=path.resolve(g.directory).toLowerCase(),old=path.resolve(original.directory).toLowerCase();
 if(destination===old||destination.startsWith(old+path.sep)||old.startsWith(destination+path.sep))engineSiteFail('local_registration_destination');
 const start=JSON.parse(pinned(r.originalStart).toString('utf8')),exit=JSON.parse(pinned(r.originalExit).toString('utf8')),stderr=JSON.parse(pinned(r.originalStderr).toString('utf8'));
 if(start.grantSha256!==r.originalGrant.sha256||start.sourceHead!==original.source.head||start.childPid!==exit.childPid||exit.code!==1||exit.signal!==null||exit.outcomeExists!==false||exit.supervisorExitCode!==1||exit.completionStatus!=='native_failed'||
  !Number.isFinite(Date.parse(start.at))||!Number.isFinite(Date.parse(exit.at))||Date.parse(start.at)>Date.parse(exit.at)||Date.parse(exit.at)>registered||stderr.status!=='stopped'||stderr.code!=='local_book_preflight_failed'||stderr.providerDispatchNotConfirmed!==true||pinned(r.originalStdout).length!==0)engineSiteFail('local_registration_not_zero_dispatch');
 const review=JSON.parse(pinned(r.sourceReviewSeal).toString('utf8'));
 if(review.version!=='codex-complete-independent-review-seal/v1'||review.disposition!=='PASS'||review.scope!==LOCAL_ATTEMPT_STARTUP_REVIEW_SCOPE||review.startupGrantCanonicalSha256!==r.grantCanonicalSha256||review.sourceHead!==g.source.head||review.actualReviewerTurnComplete!==true||!Number.isFinite(Date.parse(review.verifiedAt))||Date.parse(review.verifiedAt)>registered||!Array.isArray(review.actualProcessesExited)||!review.actualProcessesExited.length||review.actualProcessesExited.some((p:{code?:number;historicalProcessGone?:boolean})=>p.code!==0||p.historicalProcessGone!==true))engineSiteFail('local_registration_review');
 // The root seal binds its complete independent READY/report/index; no supplied green verdict alone.
 const ready=JSON.parse(pinned(review.ready).toString('utf8'));
 if(!ready.complete||ready.disposition!=='PASS'||ready.scope!==review.scope||ready.sourceHead!==g.source.head||ready.envelopeSha256!==review.envelopeSha256||canonicalHash(ready.report)!==canonicalHash({file:path.basename(review.report.file),sha256:review.report.sha256})||ready.providerCalls!==0||ready.spendMicroUsd!==0)engineSiteFail('local_registration_review');
 pinned(review.report);pinned(review.index);
 const refs=[r.ownerGo,r.originalGrant,r.originalStart,r.originalExit,r.originalStderr,r.originalStdout,r.sourceReviewSeal,original.ownerApproval];
 const check=()=>{if(sha(bytes(file))!==registrationSha256)engineSiteFail('local_registration_changed');for(const x of refs)pinned(x);
  if(existsSync(original.directory)||existsSync(masterFile+'.attempt-extension-4-v1.json')||existsSync(executionFile))engineSiteFail('local_registration_not_zero_dispatch');
  assertLocalHistoricalProcessGone(exit.childPid,exit.at);assertLocalHistoricalProcessGone(start.pid,exit.at);};check();
 // Claim absence is required at initial registration only. Subsequent source fences preserve all original inputs, not absence of our own claim.
 const revalidate=()=>{if(sha(bytes(file))!==registrationSha256)engineSiteFail('local_registration_changed');for(const x of refs)pinned(x);if(existsSync(original.directory))engineSiteFail('local_registration_not_zero_dispatch');};
 return Object.freeze({registrationSha256,registeredAt:r.registeredAt,originalApprovedAt:go.approvedAt,originalDeadline:new Date(ownerAt+21600000).toISOString(),check:revalidate});
}
