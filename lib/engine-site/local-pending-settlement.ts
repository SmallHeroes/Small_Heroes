/** Dedicated existing-response collection. Never resumes a book or requests a new generation. */
import 'server-only';
import {existsSync,lstatSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
import {engineSiteFail} from './contract';
import {assertLocalHistoricalProcessGone} from './local-trial-startup-recovery';
import {rebindEnginePendingResponse} from './provider-plans';
import {inspectCapturedPending,pendingPinned,pendingPinnedBytes,pendingRefSchema,pendingRead,pendingFileSha,type CapturedLocalPendingResponse} from './local-pending-capture';

export const PENDING_SETTLEMENT_QA_SCOPE='M42_PENDING_SETTLEMENT_CODE_AND_ENVELOPE';
export const pendingOwnerGoSchema=z.object({version:z.literal('engine-local-pending-owner-go/v1'),approvedBy:z.literal('Guy'),approvedAt:z.string().datetime(),
 decision:z.literal('new_explicit_existing_response_retrieval'),sourceHead:z.string().regex(/^[a-f0-9]{40}$/),specSha256:z.string().regex(/^[a-f0-9]{64}$/),
 claimSha256:z.string().regex(/^[a-f0-9]{64}$/),responseId:z.string().regex(/^resp_[A-Za-z0-9_-]+$/),directory:z.string().refine(path.isAbsolute),
 maximumGETs:z.literal(120),pollWindowMs:z.literal(900000),newLogicalCalls:z.literal(0),newReserveMicroUsd:z.literal(0),allowPOST:z.literal(false),allowMedia:z.literal(false),
 independentReviewSeal:pendingRefSchema}).strict();
const permits=new WeakMap<object,{check:()=>void;globalFile:string;approvalSha256:string;capture:CapturedLocalPendingResponse}>();
type Ref=z.infer<typeof pendingRefSchema>;
const json=(f:string)=>JSON.parse(pendingRead(f).toString('utf8'));
const pin=(file:string):Ref=>({file,sha256:pendingFileSha(pendingRead(file))});
const exclusive=(file:string,value:unknown)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
function sourceFence(cap:CapturedLocalPendingResponse,seal:any){
 const git=(...a:string[])=>execFileSync('git',['-C',cap.spec.sourceRoot,...a],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}).trim();
 if(git('rev-parse','HEAD')!==cap.spec.sourceHead||git('status','--porcelain','--untracked-files=no')||git('ls-files','--others','--exclude-standard','--','app','lib','scripts','backend','config'))engineSiteFail('pending_execution_source');
 const index=pendingPinned(seal.sourcePins);if(path.resolve(index.root)!==cap.spec.sourceRoot||!Array.isArray(index.rows)||!index.rows.length)engineSiteFail('pending_review_source');
 for(const r of index.rows){const f=path.resolve(cap.spec.sourceRoot,r.path);if(!f.startsWith(cap.spec.sourceRoot+path.sep))engineSiteFail('pending_review_source');const b=pendingRead(f);if(b.length!==r.bytes||pendingFileSha(b)!==r.sha256)engineSiteFail('pending_review_source');}
}
/** Admission itself is provider/credential-free. No current owner GO is fabricated by preparation. */
export function admitPendingSettlementExecution(cap:CapturedLocalPendingResponse,goRef:Ref,now=Date.now()){
 const data=inspectCapturedPending(cap),go=pendingOwnerGoSchema.parse(pendingPinned(goRef)),seal=pendingPinned(go.independentReviewSeal),at=Date.parse(go.approvedAt);
 if(go.sourceHead!==cap.spec.sourceHead||go.specSha256!==cap.binding.specSha256||go.claimSha256!==cap.binding.claimSha256||go.responseId!==cap.binding.responseId||go.directory!==cap.spec.directory||at>now||now-at>1_200_000||!Number.isFinite(at))engineSiteFail('pending_owner_go');
 if(seal.version!=='codex-complete-independent-review-seal/v1'||seal.scope!==PENDING_SETTLEMENT_QA_SCOPE||seal.disposition!=='PASS'||seal.sourceHead!==cap.spec.sourceHead||seal.specSha256!==cap.binding.specSha256||seal.claimSha256!==cap.binding.claimSha256||seal.actualReviewerTurnComplete!==true||!Number.isFinite(Date.parse(seal.verifiedAt))||Date.parse(seal.verifiedAt)>at||!Array.isArray(seal.actualProcessesExited)||!seal.actualProcessesExited.length||seal.actualProcessesExited.some((e:any)=>e.code!==0||e.historicalProcessGone!==true))engineSiteFail('pending_review');
 const ready=pendingPinned(seal.ready),report=pendingRead(seal.report.file).toString('utf8'),rows=pendingPinned(seal.index);
 if(pin(seal.report.file).sha256!==seal.report.sha256||ready.complete!==true||ready.disposition!=='PASS'||ready.scope!==seal.scope||ready.sourceHead!==seal.sourceHead||ready.specSha256!==seal.specSha256||ready.providerCalls!==0||ready.spendMicroUsd!==0||path.resolve(path.dirname(seal.ready.file),ready.report.file)!==seal.report.file||ready.report.sha256!==seal.report.sha256||path.resolve(path.dirname(seal.ready.file),ready.index.file)!==seal.index.file||ready.index.sha256!==seal.index.sha256)engineSiteFail('pending_review');
 const lines=report.replace(/^\uFEFF/,'').trimStart().split(/\r?\n/),headers=new Map<string,string>();if(lines[0]!=='DISPOSITION: PASS'||[...report.matchAll(/^DISPOSITION: (?:PASS|HOLD)\s*$/gm)].length!==1)engineSiteFail('pending_review_header');
 for(const line of lines){if(!line.trim())break;const m=/^([A-Z0-9_]+): (.+)$/.exec(line);if(!m||headers.has(m[1]))engineSiteFail('pending_review_header');headers.set(m[1],m[2]);}
 if(headers.get('SCOPE')!==seal.scope||headers.get('SOURCE_HEAD')!==seal.sourceHead||headers.get('SETTLEMENT_SPEC_SHA256')!==seal.specSha256||headers.get('ORIGINAL_CLAIM_SHA256')!==seal.claimSha256)engineSiteFail('pending_review_header');
 if(!Array.isArray(rows.files)||!rows.files.length)engineSiteFail('pending_review_index');const root=path.dirname(seal.index.file),seen=new Set<string>();
 for(const r of rows.files){const f=path.resolve(root,r.path);if(!f.startsWith(root+path.sep)||seen.has(f))engineSiteFail('pending_review_index');seen.add(f);const b=pendingRead(f);if(b.length!==r.bytes||pendingFileSha(b)!==r.sha256)engineSiteFail('pending_review_index');}
 for(const e of seal.actualProcessesExited)assertLocalHistoricalProcessGone(e.pid,seal.verifiedAt);
 const goSha=goRef.sha256,goSnapshot=canonicalHash(go),sealSnapshot=canonicalHash(seal),globalFile=data.masterFile+'.pending-settlement-v1.'+cap.binding.claimSha256+'.json';
 const check=()=>{inspectCapturedPending(cap);if(pin(goRef.file).sha256!==goSha||canonicalHash(go)!==goSnapshot||canonicalHash(seal)!==sealSnapshot)engineSiteFail('pending_execution_changed');pendingPinned(go.independentReviewSeal);pendingPinned(seal.ready);pendingPinnedBytes(seal.report);pendingPinned(seal.index);sourceFence(cap,seal);};check();
 const permit=Object.freeze({version:'engine-local-pending-execution/v1',specSha256:cap.binding.specSha256,approvalSha256:goSha});permits.set(permit,{capture:cap,check,globalFile,approvalSha256:goSha});return permit;
}
export type PendingSettlementExecution=ReturnType<typeof admitPendingSettlementExecution>;

/** Supplied transport is wrapped below; the source plan is rebound without changing its old body/decoder. */
export async function collectExistingPendingResponse(cap:CapturedLocalPendingResponse,permit:PendingSettlementExecution,ports:{fetch:typeof fetch;key:()=>string;
 signal?:AbortSignal;now?:()=>number;pause?:(ms:number)=>Promise<void>}){
 const allowed=permits.get(permit);if(!allowed||allowed.capture!==cap)engineSiteFail('pending_execution_capability');allowed.check();
 const dir=cap.spec.directory,parent=path.dirname(dir);if(existsSync(dir)||existsSync(allowed.globalFile)||!existsSync(parent)||lstatSync(parent).isSymbolicLink()||realpathSync(parent)!==parent)engineSiteFail('pending_already_used');
 if(dir.startsWith(cap.spec.sourceRoot+path.sep)||cap.spec.sourceRoot.startsWith(dir+path.sep))engineSiteFail('pending_output_path');
 const now=ports.now??Date.now,start=now(),deadlineAt=start+cap.spec.pollWindowMs,signal=ports.signal??new AbortController().signal;let requests=0,lastAt=start;
 if(!Number.isSafeInteger(start)||start<0)engineSiteFail('pending_clock');
 const marker={version:'engine-local-pending-collection-claim/v1',at:new Date(start).toISOString(),binding:cap.binding,approvalSha256:allowed.approvalSha256,directory:dir};
 exclusive(allowed.globalFile,marker);mkdirSync(dir,{mode:0o700});exclusive(path.join(dir,'START.json'),{...marker,deadlineAt,newLogicalCalls:0,newReserveMicroUsd:0});
 const check=()=>{if(signal.aborted)engineSiteFail('pending_cancelled');allowed.check();if(canonicalHash(json(allowed.globalFile))!==canonicalHash(marker))engineSiteFail('pending_execution_changed');const t=now();if(!Number.isSafeInteger(t)||t<lastAt||t>=deadlineAt)engineSiteFail('pending_window');lastAt=t;};
 const endpoint='https://api.openai.com/v1/responses/'+encodeURIComponent(cap.binding.responseId),denied=():never=>engineSiteFail('pending_generation_forbidden');
 const original=inspectCapturedPending(cap).plan,plan=rebindEnginePendingResponse(original,{openAIKey:ports.key,anthropicKey:denied,image:denied,
  fetch:async(url,init)=>{check();if(url!==endpoint||init?.method!=='GET'||init.body!==undefined||init.redirect!=='error'||requests>=cap.spec.maximumPolls)engineSiteFail('pending_get_only');requests++;return ports.fetch(url,init);}});
 try{
  for(let n=0;n<cap.spec.maximumPolls;n++){
   check();const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,deadlineAt-now()))]);
   const answer=await plan.execute(cap.binding.responseId,requestSignal,async()=>{check();plan.revalidate?.();});
   // Preserve received raw/price bytes BEFORE any after-await source/owner/semantic fence.
   exclusive(path.join(dir,'answer-'+String(n).padStart(5,'0')+'.json'),{at:now(),responseId:cap.binding.responseId,answer});check();
   if(answer.kind==='pending'){if(answer.id!==cap.binding.responseId)engineSiteFail('pending_response_changed');await(ports.pause?.(5000)??new Promise<void>(r=>setTimeout(r,5000)));continue;}
   const raw=answer.result.raw as any,cost=answer.result.estimatedMicroUsd;
   if(raw?.id!==cap.binding.responseId||raw.status!=='completed'||!Number.isSafeInteger(cost)||cost===null||cost<0||cost>cap.binding.maximumMicroUsd||!plan.admitSaved)engineSiteFail('pending_completion_unresolved');
   await plan.admitSaved(answer.result);check();rebindEnginePendingResponse(original,{fetch:denied,openAIKey:denied,anthropicKey:denied});
   const outcome={version:'engine-local-pending-settlement-result/v1',status:'priced_receipt_admitted',at:new Date(now()).toISOString(),binding:cap.binding,
    estimatedMicroUsd:cost,accountedMicroUsd:cap.binding.knownMicroUsd+cost,logicalCalls:cap.binding.logicalCalls,newLogicalCalls:0,newReserveMicroUsd:0,
    previousAccountedMicroUsd:cap.binding.accountedMicroUsd,previousReserveMicroUsd:cap.binding.maximumMicroUsd,financialEffect:'resolve_original_call_only',
    providerGETs:requests,originalBookBytesChanged:false,styleApproved:false,productAccepted:false,mediaAuthorized:false};exclusive(path.join(dir,'RESULT.json'),outcome);return outcome;
  }engineSiteFail('pending_poll_limit');
 }catch(e){const message=e instanceof Error?e.message:'';exclusive(path.join(dir,'STOP.json'),{version:'engine-local-pending-settlement-stop/v1',at:new Date(now()).toISOString(),reason:/^[a-z][a-z0-9_]{0,100}$/.test(message)?message:'pending_failed',
  binding:cap.binding,providerGETs:requests,fullOriginalReserveRetainedMicroUsd:cap.binding.maximumMicroUsd,accountedMicroUsd:cap.binding.accountedMicroUsd,logicalCalls:cap.binding.logicalCalls,newLogicalCalls:0,financialEffect:'none',retryAuthorized:false});throw e;}
}
