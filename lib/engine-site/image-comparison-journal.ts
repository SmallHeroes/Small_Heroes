import 'server-only';
import { existsSync,lstatSync,readFileSync,realpathSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { NATIVE_PAGE_PROOF_AUTHORITY_ROOT } from '@/lib/personal-wizard/native-page-proof-authority-host';
import { engineOrderAuthoritySchema,engineSiteFail,digestSchema,type EngineOrderAuthority } from './contract';
import type { LocalTrialDispatchWitness } from './local-trial-runtime';
import { comparisonSchedule,COMPARISON_CAP,COMPARISON_CALLS,COMPARISON_MODELS,IMAGE_COMPARISON_VERSION } from './image-comparison';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const absolute=z.string().refine(p=>path.isAbsolute(p));
const pin=z.object({file:absolute,bytes:z.number().int().nonnegative(),sha256:digestSchema}).strict();
export const comparisonEnvelopeSchema=z.object({
 version:z.literal('image-comparison-envelope/v1'),scope:z.literal('diagnostic_four_low_images_only'),fictional:z.literal(true),
 source:z.object({root:absolute,head:z.string().regex(/^[a-f0-9]{40}$/),pins:pin}).strict(),supervisor:pin,
 ownerAuthority:pin,inputRoot:absolute,inputIndex:pin,outputDirectory:absolute,credentials:z.object({file:absolute,sha256:digestSchema}).strict(),
 policy:z.literal(IMAGE_COMPARISON_VERSION),maximumMicroUsd:z.literal(COMPARISON_CAP),maximumCalls:z.literal(COMPARISON_CALLS),
 parentMaximumMicroUsd:z.literal(10000000),parentMaximumCalls:z.literal(121),models:z.tuple([z.literal(COMPARISON_MODELS[0]),z.literal(COMPARISON_MODELS[1])]),
 executionWindowMs:z.literal(7200000),settlementGraceMs:z.literal(3645000),
 reserveQualification:z.object({kind:z.literal('conservative_allowance_not_provider_invoice_cap'),requiresIndependentApproval:z.literal(true),evidence:pin}).strict(),
 publicDelivery:z.literal(false),realPayment:z.literal(false),bookGeneration:z.literal(false),
}).strict();
export type ComparisonEnvelope=z.infer<typeof comparisonEnvelopeSchema>;
export function comparisonJson(file:string):any{
 if(/(^|[\\/])\.env(?:\.|$)/i.test(file))engineSiteFail('comparison_env_read_refused');
 const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024||realpathSync(file)!==path.resolve(file))engineSiteFail('comparison_file');
 return JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
}
export function verifyComparisonPin(row:z.infer<typeof pin>){
 if(/(^|[\\/])\.env(?:\.|$)/i.test(row.file))engineSiteFail('comparison_env_read_refused');
 const s=lstatSync(row.file);if(!s.isFile()||s.isSymbolicLink()||s.size!==row.bytes||s.size>64*1024*1024||realpathSync(row.file)!==path.resolve(row.file)||sha(readFileSync(row.file))!==row.sha256)engineSiteFail('comparison_pin_changed');
}
function verifyIndex(file:string,root:string){
 const j=comparisonJson(file),rows=j.rows||j.files;if(!Array.isArray(rows)||!rows.length)engineSiteFail('comparison_pin_index');
 const names=new Set<string>();
 for(const r of rows){const f=r.file?path.resolve(r.file):path.resolve(root,r.path);
  if(!f.startsWith(path.resolve(root)+path.sep)||names.has(f))engineSiteFail('comparison_pin_path');names.add(f);verifyComparisonPin({...r,file:f});}
}
export function verifyComparisonEnvelope(g:ComparisonEnvelope,requireFreshOutput=true){
 verifyComparisonPin(g.ownerAuthority);verifyComparisonPin(g.source.pins);verifyComparisonPin(g.inputIndex);verifyComparisonPin(g.supervisor);
 const owner=comparisonJson(g.ownerAuthority.file);
 if(owner.maximumMicroUsd!==10000000||owner.maximumLogicalCalls!==121)engineSiteFail('comparison_owner_cap');
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:g.source.root,encoding:'utf8'}).trim()!==g.source.head||
  execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:g.source.root,encoding:'utf8'}).trim())engineSiteFail('comparison_source_changed');
 verifyIndex(g.source.pins.file,g.source.root);verifyIndex(g.inputIndex.file,g.inputRoot);verifyComparisonPin(g.reserveQualification.evidence);
 const inputs=comparisonJson(path.join(g.inputRoot,'INPUT-PINS.json'));for(const r of [...inputs.sourceFiles,...inputs.references])verifyComparisonPin(r);
 const out=path.resolve(g.outputDirectory),source=path.resolve(g.source.root),input=path.resolve(g.inputRoot);
 const protects=(dir:string)=>out===dir||out.startsWith(dir+path.sep)||dir.startsWith(out+path.sep);
 const oldRoots=inputs.sourceFiles.map((r:any)=>{const f=path.resolve(r.file),j=f.toLowerCase().indexOf(path.sep+'journal'+path.sep);return j>=0?f.slice(0,j):path.dirname(f);});
 if(protects(input)||protects(source)||oldRoots.some(protects)||requireFreshOutput&&existsSync(out))engineSiteFail('comparison_output_not_fresh');
}
export function comparisonAuthority(g:ComparisonEnvelope,base:EngineOrderAuthority,bundleSha:string,pages:readonly number[]){
 const steps=comparisonSchedule(pages).map(s=>({id:s.id,maximumMicroUsd:s.maximumMicroUsd}));
 const parentRecordedAt=z.string().datetime({precision:3}).parse(comparisonJson(g.ownerAuthority.file).recordedAt);
 return engineOrderAuthoritySchema.parse({...base,orderId:'comparison_'+g.ownerAuthority.sha256.slice(0,24),purpose:'test',sourceRevision:g.source.head,
  requestSha256:bundleSha,policySha256:canonicalHash({policy:g.policy,envelope:g,bundleSha,pages,steps}),entitlements:{narration:false,pdf:false},
  budget:{maximumMicroUsd:COMPARISON_CAP,maximumCalls:COMPARISON_CALLS,approvalReference:'m33_comparison',approvedBy:'Guy',
   approvedAt:parentRecordedAt,steps}});
}
/** EXACT same consent-global namespace as localEngineMasterClaimFile: old full-cap book cannot run beside the comparison. */
export function comparisonMasterFile(ownerSha:string){digestSchema.parse(ownerSha);return path.join(NATIVE_PAGE_PROOF_AUTHORITY_ROOT,ownerSha+'.local-engine.claim.json');}
export function claimComparison(g:ComparisonEnvelope,envelopeSha:string,authority:EngineOrderAuthority){
 const master=comparisonMasterFile(g.ownerAuthority.sha256),host=lstatSync(path.dirname(master));
 if(!host.isDirectory()||host.isSymbolicLink()||realpathSync(path.dirname(master))!==path.resolve(path.dirname(master)))engineSiteFail('comparison_authority_host');
 const binding={version:'engine-local-image-comparison-claim/v1',ownerAuthoritySha256:g.ownerAuthority.sha256,envelopeSha256:envelopeSha,
  authoritySha256:canonicalHash(authority),directory:path.resolve(g.outputDirectory),campaignMaximumMicroUsd:10000000,campaignMaximumCalls:121,
  maximumMicroUsd:COMPARISON_CAP,maximumCalls:COMPARISON_CALLS,bookLaunchBlocked:true};
 if(existsSync(master))engineSiteFail('comparison_consent_consumed');
 writeFileSync(master,JSON.stringify(binding,null,2)+'\n',{flag:'wx',mode:0o600});
 const check=()=>{if(canonicalHash(comparisonJson(master))!==canonicalHash(binding))engineSiteFail('comparison_claim_changed');};
 const witnessFile=(step:string)=>{if(!authority.budget.steps.some(s=>s.id===step))engineSiteFail('comparison_witness_step');return master+'.image-comparison.'+step+'.dispatch.json';};
 const record=(step:string)=>{check();const file=witnessFile(step);if(!existsSync(file))return null;
  const r=comparisonJson(file),slot=authority.budget.steps.find(s=>s.id===step)!;
  if(r.version!=='image-comparison-dispatch/v1'||r.executionSha256!==canonicalHash(binding)||r.authoritySha256!==canonicalHash(authority)||
   r.step!==step||r.maximumMicroUsd!==slot.maximumMicroUsd||!digestSchema.safeParse(r.claimSha256).success)engineSiteFail('comparison_witness_changed');return r;};
 const witness:LocalTrialDispatchWitness={
  list:()=>authority.budget.steps.flatMap(s=>{const r=record(s.id);return r?[{step:s.id,claimSha256:r.claimSha256,maximumMicroUsd:r.maximumMicroUsd}]:[];}),
  check(step,claimSha256,dispatched){const r=record(step);if(dispatched?(!r||r.claimSha256!==claimSha256):r!==null)engineSiteFail('comparison_unknown_dispatch');},
  begin(step,claimSha256){check();digestSchema.parse(claimSha256);if(record(step))engineSiteFail('comparison_unknown_dispatch');const slot=authority.budget.steps.find(s=>s.id===step)!;
   writeFileSync(witnessFile(step),JSON.stringify({version:'image-comparison-dispatch/v1',executionSha256:canonicalHash(binding),authoritySha256:canonicalHash(authority),
    step,claimSha256,maximumMicroUsd:slot.maximumMicroUsd},null,2)+'\n',{flag:'wx',mode:0o600});}
 };
 return{master,binding,check,witness};
}
export function verifyComparisonReady(readyFile:string,envelopeSha:string,sourceHead:string){
 const root=path.resolve(path.dirname(readyFile)),r=comparisonJson(readyFile);
 if(r.complete!==true||r.disposition!=='PASS'||r.scope!=='IMAGE_COMPARISON_CODE_AND_EXACT_ENVELOPE'||r.envelopeSha256!==envelopeSha||
  r.sourceHead!==sourceHead||r.providerCalls!==0||r.allProcessesExited!==true||r.reserveQualified!==true)engineSiteFail('comparison_qa_not_complete');
 for(const row of [r.report,r.index]){const file=path.resolve(root,row.file||row.path);if(!file.startsWith(root+path.sep))engineSiteFail('comparison_qa_path');
  const b=readFileSync(file);if(sha(b)!==row.sha256)engineSiteFail('comparison_qa_hash');}
 const report=readFileSync(path.resolve(root,r.report.file),'utf8');
 const header=report.split(/\r?\n\r?\n/)[0],oneHeader=(name:string,want:string)=>{const matches=[...header.matchAll(new RegExp('^'+name+': ([a-f0-9]+)\\r?$','gm'))];return matches.length===1&&matches[0][1]===want;};
 if(!/^DISPOSITION: PASS\r?\n/.test(report)||report.match(/^DISPOSITION:/gm)?.length!==1||
  !oneHeader('ENVELOPE_SHA256',envelopeSha)||!oneHeader('SOURCE_HEAD',sourceHead))engineSiteFail('comparison_qa_report');
 verifyIndex(path.resolve(root,r.index.file),root);
 // Process identities/creation times belong in the completed independent evidence; PID liveness here is a conservative pre-launch refusal.
 for(const pid of r.processIds??[]){try{process.kill(pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')continue;throw e;}engineSiteFail('comparison_qa_process_active');}
 return r;
}
export function verifyComparisonGo(file:string,envelopeSha:string,ownerSha:string,now=Date.now(),qaReadySha?:string){
 const g=comparisonJson(file),issued=Date.parse(g.approvedAt);
 if(g.version!=='image-comparison-owner-go/v1'||g.owner!=='Guy'||g.envelopeSha256!==envelopeSha||g.ownerAuthoritySha256!==ownerSha||
  g.maximumMicroUsd!==COMPARISON_CAP||g.maximumCalls!==COMPARISON_CALLS||g.includedInExisting10000000And121!==true||
  qaReadySha!==undefined&&g.qaReadySha256!==qaReadySha||!Number.isFinite(issued)||issued>now||now-issued>20*60000)engineSiteFail('comparison_go_missing_or_stale');
 return g;
}
