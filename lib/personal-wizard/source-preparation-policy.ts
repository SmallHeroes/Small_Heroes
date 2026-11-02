import 'server-only';
import path from 'node:path';
import {existsSync,lstatSync,readFileSync,realpathSync,openSync,fstatSync,closeSync} from 'node:fs';
import {z} from 'zod';
import {previewSha} from '../local-story-preview';
import {canonicalJson} from './request-acceptance';
import {exclusiveJson,realDirectory} from '../../scripts/personal-causal-trial-journal';
import {verifyNativePageProofCode,verifyNativePageProofOutput} from './native-page-proof';
import {NATIVE_PAGE_PROOF_AUTHORITY_ROOT} from './native-page-proof-authority-host';

export const SOURCE_PREPARATION='native-source-preparation/v1' as const;
export const PREPARATION_STEPS=['prep_storyboard_0','prep_storyboard_0_review','sheet_entities_0','sheet_entities_0_qa','sheet_locations_0','sheet_locations_0_qa'] as const;
export const PREPARATION_SLOTS=[1000000,1200000,650000,750000,650000,750000] as const;
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const preparationPinSchema=z.object({file:z.string().min(1),bytes:z.number().int().min(0).max(32000000),sha256:hash}).strict();
export type PreparationPin=z.infer<typeof preparationPinSchema>;
const head=z.string().regex(/^[a-f0-9]{40}$/);
export const preparationOwnerSchema=z.object({version:z.literal('source-preparation-owner-approval/v1'),owner:z.literal('Guy'),approvalId:hash,
  approvalReference:z.string().min(30).max(3000),capMicroUsd:z.literal(5000000),maxCalls:z.literal(6),maxNewLowReferenceImages:z.literal(2),
  paidRetries:z.literal(false),pages:z.literal(false),narration:z.literal(false),allReviewsAndFullUnknownReserves:z.literal(true)}).strict();
export const preparationGrantSchema=z.object({version:z.literal(SOURCE_PREPARATION),workspace:z.string().min(1),sourceHead:head,
  originalBookDir:z.string().min(1),out:z.string().min(1),originalSourceDigest:hash,originalStoryboardDigest:hash,layoutSha256:hash,firstWireSha256:hash,
  ownerApproval:preparationPinSchema,operator:preparationPinSchema,executionMode:z.literal('synchronous-or-durable-detached/v1'),inputs:z.array(preparationPinSchema).min(1).max(128),capMicroUsd:z.literal(5000000),maxCalls:z.literal(6)}).strict();
export type PreparationGrant=z.infer<typeof preparationGrantSchema>;
export const preparationPageChoiceSchema=z.object({version:z.literal('source-preparation-page-choice/v1'),owner:z.literal('Guy'),approvalId:hash,
  grantSha256:hash,storyboardDigest:hash,pages:z.array(z.number().int().min(1).max(8)).length(2),standingPage:z.number().int().min(1).max(8),
  continuityPage:z.number().int().min(1).max(8),standingPacketSha256:hash,continuityPacketSha256:hash,
  naturalSamePlaneStandingConfirmed:z.literal(true),canonicalContinuityConfirmed:z.literal(true),noStoryboardEdits:z.literal(true)}).strict()
  .refine(x=>x.pages[0]<x.pages[1]&&x.standingPage!==x.continuityPage&&x.pages.includes(x.standingPage)&&x.pages.includes(x.continuityPage),'source_prep_page_choice');
export function prepFail(code:string):never{throw Object.assign(new Error('source_prep_'+code),{code:'source_prep_'+code});}
export function preparationFile(file:string):Buffer{
  if(!path.isAbsolute(file)||/(^|[\\/])(?:\.env(?:[./\\]|$)|auth\.json$|credentials(?:\.|$)|[^\\/]*api[_-]?keys?[^\\/]*$)/i.test(file))prepFail('input_path');
  realDirectory(path.dirname(file));const st=lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>32000000||realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())prepFail('input_path');
  const fd=openSync(file,'r');try{const opened=fstatSync(fd);
    if(opened.dev!==st.dev||opened.ino!==st.ino||opened.size!==st.size||opened.nlink!==1)prepFail('input_path');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
export const preparationPin=(file:string):PreparationPin=>{const b=preparationFile(file);return{file:path.resolve(file),bytes:b.length,sha256:previewSha(b)};};
export function verifyPreparationPins(pins:readonly PreparationPin[],required:readonly string[]){
  const actual=pins.map(x=>path.resolve(x.file)).sort(),wanted=[...new Set(required.map(x=>path.resolve(x)))].sort();
  if(actual.length!==new Set(actual).size||canonicalJson(actual)!==canonicalJson(wanted))prepFail('input_set');
  for(const x of pins){const b=preparationFile(x.file);if(b.length!==x.bytes||previewSha(b)!==x.sha256)prepFail('input_changed');}
}
export function verifyPreparationReview(input:{file:string;sha256:string},grantSha256:string,sourceHead:string){
  const bytes=preparationFile(input.file);if(previewSha(bytes)!==input.sha256)prepFail('review_changed');
  const r=z.object({complete:z.literal(true),disposition:z.literal('PASS'),scope:z.literal('SOURCE_PREPARATION_EXECUTION'),sourceHead:head,grantSha256:hash,
    report:z.object({file:z.string().min(1),sha256:hash})}).passthrough().parse(JSON.parse(bytes.toString('utf8')));
  if(r.sourceHead!==sourceHead||r.grantSha256!==grantSha256)prepFail('review_binding');
  const report=preparationFile(path.resolve(path.dirname(input.file),r.report.file));if(previewSha(report)!==r.report.sha256)prepFail('review_changed');
  const lines=report.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/),header=new Map<string,string>();
  if(lines[0]!=='DISPOSITION: PASS')prepFail('review_binding');
  for(const line of lines){const field=/^([A-Z][A-Z0-9_]*):[ \t]*(.*)$/.exec(line);if(!field)break;if(header.has(field[1]))prepFail('review_binding');header.set(field[1],field[2]);}
  if(header.get('GRANT_SHA256')!==grantSha256||header.get('SOURCE_HEAD')!==sourceHead||header.get('SCOPE')!=='SOURCE_PREPARATION_EXECUTION')prepFail('review_binding');
}
/** The fixed host and consent ID are independent of code copy, output and grant. No real claim is made by planning. */
export function preparationAuthority(args:{grant:PreparationGrant;grantFile:string;review:{file:string;sha256:string};requiredInputs:readonly string[];continuation?:true}){
  const g=preparationGrantSchema.parse(args.grant),grantSha256=previewSha(preparationFile(args.grantFile));
  if(canonicalJson(JSON.parse(preparationFile(args.grantFile).toString('utf8')))!==canonicalJson(g))prepFail('grant_changed');
  const ownerBytes=preparationFile(g.ownerApproval.file);if(ownerBytes.length!==g.ownerApproval.bytes||previewSha(ownerBytes)!==g.ownerApproval.sha256)prepFail('owner_changed');
  const owner=preparationOwnerSchema.parse(JSON.parse(ownerBytes.toString('utf8')));
  const root=NATIVE_PAGE_PROOF_AUTHORITY_ROOT,claim=path.join(root,'source-preparation-'+owner.approvalId+'.claim.json');
  const expected={version:'source-preparation-claim/v1',approvalId:owner.approvalId,ownerSha256:g.ownerApproval.sha256,grantSha256,
    sourceHead:g.sourceHead,out:path.resolve(g.out),originalSourceDigest:g.originalSourceDigest,originalStoryboardDigest:g.originalStoryboardDigest};
  let active=!!args.continuation;
  const guard=()=>{
    realDirectory(root);verifyNativePageProofOutput(g.out,[g.workspace,g.originalBookDir,root]);
    verifyNativePageProofCode(g.workspace,g.sourceHead);verifyPreparationPins(g.inputs,args.requiredInputs);
    const op=preparationPin(g.operator.file);if(op.bytes!==g.operator.bytes||op.sha256!==g.operator.sha256)prepFail('operator_changed');
    if(previewSha(preparationFile(args.grantFile))!==grantSha256||previewSha(preparationFile(g.ownerApproval.file))!==g.ownerApproval.sha256)prepFail('grant_changed');
    verifyPreparationReview(args.review,grantSha256,g.sourceHead);
    if(active){if(!existsSync(claim)||canonicalJson(JSON.parse(preparationFile(claim).toString('utf8')))!==canonicalJson(expected))prepFail('claim_changed');}
    else if(existsSync(claim))prepFail('consumed');
  };
  guard();
  const waitingSeal=path.join(root,'source-preparation-'+owner.approvalId+'.waiting.json');
  const sealed=(waitingSha256:string)=>({version:'source-preparation-waiting-seal/v1',grantSha256,sourceHead:g.sourceHead,out:path.resolve(g.out),waitingSha256});
  return{grant:g,grantSha256,owner,claimFile:claim,guard,
    sealWaiting(bytes:Buffer){guard();exclusiveJson(waitingSeal,sealed(previewSha(bytes)));},
    assertWaiting(bytes:Buffer){guard();if(canonicalJson(JSON.parse(preparationFile(waitingSeal).toString('utf8')))!==canonicalJson(sealed(previewSha(bytes))))prepFail('waiting_changed');},
    activate(){if(active)prepFail('consumed');guard();exclusiveJson(claim,expected);active=true;guard();}};
}
