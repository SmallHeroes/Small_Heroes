import 'server-only';
import path from 'node:path';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { previewSha } from '../local-story-preview';
import { canonicalJson } from './request-acceptance';
import { exclusiveJson, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { NATIVE_PAGE_PROOF_AUTHORITY_ROOT } from './native-page-proof-authority-host';

export const NATIVE_PAGE_PROOF_VERSION='native-cde-page-proof/v1' as const;
export const NATIVE_PAGE_PROOF_CAP_MICRO_USD=1_000_000;
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const pin=z.object({file:z.string().min(1),bytes:z.number().int().nonnegative().max(20_000_000),sha256:hash}).strict();
export const nativePageProofSchema=z.object({version:z.literal(NATIVE_PAGE_PROOF_VERSION),workspace:z.string().min(1),sourceHead:z.string().regex(/^[a-f0-9]{40}$/),
  sourceDigest:hash,reviewSha256:hash,layoutSha256:hash,ownerApproval:pin,inputs:z.array(pin).min(1).max(128)}).strict();
export type NativePageProof=z.infer<typeof nativePageProofSchema>;
export const nativePageProofOwnerApprovalSchema=z.object({version:z.literal('native-page-proof-owner-approval/v1'),owner:z.literal('Guy'),approvalId:hash,
  approvalReference:z.string().min(30).max(3000),capMicroUsd:z.literal(NATIVE_PAGE_PROOF_CAP_MICRO_USD),maxLowImages:z.literal(2),
  allReviewsAndFullUnknownReserves:z.literal(true),fullBook:z.literal(false),narration:z.literal(false),paidRetries:z.literal(false)}).strict();
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
const forbiddenInput=/(^|[\\/])(?:\.env(?:\.|$)|auth\.json$|credentials(?:\.|$)|[^\\/]*api[_-]?keys?[^\\/]*$)/i;
const safeName=(file:string)=>path.isAbsolute(file)&&!forbiddenInput.test(file);
type GrantScope={mode:string;pages?:number[];sample?:number[];pageAttempts?:number;reuseSheets?:{sourceRun:string;roles:string[]};
  recovery?:unknown;scaleLineup?:unknown;pageProof?:NativePageProof};
type GrantLike={scope:GrantScope;capMicroUsd:number;maxCalls:number;ledger:{priorKnownApiMicroUsd:number;carriedUnresolvedMicroUsd?:number;
  evidence:{file:string;sha256:string}[]};experiment?:unknown;book:{requestId:string;storyboardDigest:string}};
/** Additive opt-in only. No grant can buy sheets, a remainder, retries or a larger/carry-reset allowance through this mode. */
export function nativePageProofGrantValid(g:GrantLike):boolean{
  const s=g.scope,p=s.pages;if(!s.pageProof)return true;
  return s.mode==='render'&&path.isAbsolute(s.pageProof.workspace)&&safeName(s.pageProof.ownerApproval.file)&&s.pageProof.inputs.every(p=>safeName(p.file))&&g.ledger.evidence.length===1&&!!p&&p.length>=1&&p.length<=2&&p.every((n,i)=>Number.isInteger(n)&&n>=1&&n<=8&&(i===0||n>p[i-1]))&&
    canonicalJson(p)===canonicalJson(s.sample)&&s.pageAttempts===1&&!!s.reuseSheets&&path.isAbsolute(s.reuseSheets.sourceRun)&&
    canonicalJson([...s.reuseSheets.roles].sort())===canonicalJson(['entities','locations'])&&s.recovery===undefined&&s.scaleLineup===undefined&&
    g.capMicroUsd>0&&g.capMicroUsd<=NATIVE_PAGE_PROOF_CAP_MICRO_USD&&g.maxCalls===p.length*3&&g.ledger.priorKnownApiMicroUsd===0&&
    g.ledger.carriedUnresolvedMicroUsd===undefined&&g.experiment===undefined&&
    g.ledger.evidence.some(e=>path.resolve(e.file)===path.resolve(s.pageProof!.ownerApproval.file)&&e.sha256===s.pageProof!.ownerApproval.sha256);
}
/** Snapshot caller routing before the reference-preflight await; cancellation signal remains live. */
export function snapshotNativePageProofArgs<T extends {bookDir:string;out:string;keyFile:string;grantFile:string;layout?:unknown;proofReview?:{file:string;sha256:string}}>(args:T):T{
  if([args.bookDir,args.out,args.keyFile,args.grantFile].some(p=>typeof p!=='string'||!path.isAbsolute(p)))return fail('page_proof_scope');
  return {...args,...(args.layout!==undefined?{layout:structuredClone(args.layout)}:{}),proofReview:args.proofReview?{...args.proofReview}:undefined};
}
export const nativePageProofSteps=(pages:readonly number[])=>pages.flatMap(n=>['','_qa','_identity'].map(s=>'page_'+n+'_0'+s));
function safeFile(file:string){
  if(!path.isAbsolute(file)||/(^|[\\/])(?:\.env(?:\.|$)|auth\.json$|credentials(?:\.|$)|[^\\/]*api[_-]?keys?[^\\/]*$)/i.test(file))fail('page_proof_input_path');
  const st=lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>20_000_000||realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())fail('page_proof_input_path');
  return readFileSync(file);
}
/** Exact input set, not a caller-chosen partial list. Runs before admission and each asynchronous dispatch boundary. */
export function verifyNativePageProofPins(proof:NativePageProof,required:readonly string[]){
  const wanted=[...new Set(required.map(f=>path.resolve(f)))].sort(),actual=proof.inputs.map(p=>path.resolve(p.file)).sort();
  if(actual.length!==new Set(actual).size||canonicalJson(actual)!==canonicalJson(wanted))fail('page_proof_input_set');
  for(const p of [...proof.inputs,proof.ownerApproval]){const b=safeFile(p.file);if(b.length!==p.bytes||previewSha(b)!==p.sha256)fail('page_proof_input_changed');}
  nativePageProofOwnerApprovalSchema.parse(JSON.parse(safeFile(proof.ownerApproval.file).toString('utf8')));
}
export function verifyNativePageProofCode(workspace:string,head:string){
  const git=(...a:string[])=>execFileSync('git',['-C',workspace,...a],{encoding:'utf8',maxBuffer:8_000_000}).trim();
  if(path.resolve(git('rev-parse','--show-toplevel')).toLowerCase()!==path.resolve(workspace).toLowerCase()||git('rev-parse','HEAD')!==head||git('status','--porcelain'))fail('page_proof_source_changed');
}
const executionReady=z.object({complete:z.literal(true),disposition:z.literal('PASS'),scope:z.literal('NATIVE_CDE_PAGE_PROOF_EXECUTION'),
  sourceHead:z.string().regex(/^[a-f0-9]{40}$/),grantSha256:hash,report:z.object({file:z.string().min(1),sha256:hash}).passthrough()}).passthrough();
export function verifyNativePageProofReview(input:{file:string;sha256:string}|undefined,grantSha256:string,sourceHead:string){
  if(!input||!hash.safeParse(input.sha256).success)return fail('page_proof_execution_review_required');
  const bytes=safeFile(input.file);if(previewSha(bytes)!==input.sha256)fail('page_proof_execution_review_changed');
  const r=executionReady.parse(JSON.parse(bytes.toString('utf8')));if(r.sourceHead!==sourceHead||r.grantSha256!==grantSha256)fail('page_proof_execution_review_binding');
  const file=path.isAbsolute(r.report.file)?r.report.file:path.resolve(path.dirname(input.file),r.report.file),report=safeFile(file);
  if(previewSha(report)!==r.report.sha256)fail('page_proof_execution_review_changed');
  const lines=report.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/);
  if(lines[0]!=='DISPOSITION: PASS')fail('page_proof_execution_review_binding');
  // Only the leading unindented metadata header owns authority. Body examples never do.
  const header=new Map<string,string>();
  for(const line of lines){const field=/^([A-Z][A-Z0-9_]*):[ \t]*(.*)$/.exec(line);if(!field)break;
    if(header.has(field[1]))fail('page_proof_execution_review_binding');header.set(field[1],field[2]);}
  if(header.get('GRANT_SHA256')!==grantSha256||header.get('SOURCE_HEAD')!==sourceHead)fail('page_proof_execution_review_binding');
}
export function verifyNativePageProofOutput(out:string,protectedRoots:readonly string[]){
  const output=path.resolve(out).toLowerCase(),inside=(a:string,b:string)=>a===b||a.startsWith(b+path.sep);
  if(!path.isAbsolute(out)||protectedRoots.some(r=>inside(output,path.resolve(r).toLowerCase())||inside(path.resolve(r).toLowerCase(),output)))fail('page_proof_output_fence');
  // Refuse aliased/missing parent directories before a one-use claim or mkdir can touch a protected tree.
  try{realDirectory(path.dirname(out));}catch{fail('page_proof_output_fence');}
}
/** Owner-approval keyed, so another grant/output cannot silently restart this same visual allowance. No resume/recovery path. */
export function nativePageProofAuthority(args:{workspace:string;out:string;protectedRoots:readonly string[];grantFile:string;grantSha256:string;
  grant:GrantLike;requiredInputs:readonly string[];review:{file:string;sha256:string}|undefined}){
  const proof=args.grant.scope.pageProof??fail('page_proof_scope');if(!nativePageProofGrantValid(args.grant))fail('page_proof_scope');
  if(path.resolve(args.workspace).toLowerCase()!==path.resolve(proof.workspace).toLowerCase())fail('page_proof_workspace');
  const approvalBytes=safeFile(proof.ownerApproval.file);if(previewSha(approvalBytes)!==proof.ownerApproval.sha256)fail('page_proof_input_changed');
  const approval=nativePageProofOwnerApprovalSchema.parse(JSON.parse(approvalBytes.toString('utf8')));
  verifyNativePageProofOutput(args.out,args.protectedRoots);const output=path.resolve(args.out).toLowerCase();
  const root=NATIVE_PAGE_PROOF_AUTHORITY_ROOT,claim=path.join(root,'native-page-proof-'+approval.approvalId+'.claim.json');
  const checkAuthorityRoot=()=>{try{realDirectory(root);}catch{fail('page_proof_authority_root');}};
  checkAuthorityRoot();
  let active=false,claimSha:string|null=null;
  const beforeClaim=()=>{
    checkAuthorityRoot();
    verifyNativePageProofOutput(args.out,args.protectedRoots);
    verifyNativePageProofCode(args.workspace,proof.sourceHead);verifyNativePageProofPins(proof,args.requiredInputs);
    if(previewSha(safeFile(args.grantFile))!==args.grantSha256)fail('page_proof_grant_changed');
    verifyNativePageProofReview(args.review,args.grantSha256,proof.sourceHead);
    if(!active&&existsSync(claim))fail('page_proof_consumed');
    if(active&&(claimSha===null||previewSha(safeFile(claim))!==claimSha))fail('page_proof_claim_changed');
  };
  const activate=()=>{
    if(active)fail('page_proof_consumed');beforeClaim();
    try{exclusiveJson(claim,{version:'native-page-proof-claim/v1',ownerApprovalSha256:proof.ownerApproval.sha256,ownerApprovalId:approval.approvalId,grantSha256:args.grantSha256,
      sourceHead:proof.sourceHead,out:output,requestId:args.grant.book.requestId,storyboardDigest:args.grant.book.storyboardDigest,pages:args.grant.scope.pages,
      capMicroUsd:args.grant.capMicroUsd,maxCalls:args.grant.maxCalls});}catch(error){if((error as any)?.code==='EEXIST')fail('page_proof_consumed');throw error;}
    claimSha=previewSha(safeFile(claim));active=true;
  };
  return{beforeClaim,activate,guard:()=>{if(!active)fail('page_proof_unclaimed');beforeClaim();},claimFile:claim};
}
