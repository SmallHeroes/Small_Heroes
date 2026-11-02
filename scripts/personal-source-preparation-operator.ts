/** Isolated launch boundary. Import/preflight never reads credentials or constructs a provider. */
import 'server-only';
import path from 'node:path';
import {existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import OpenAI,{toFile} from 'openai';
import {z} from 'zod';
import {previewSha} from '../lib/local-story-preview';
import {canonicalJson} from '../lib/personal-wizard/request-acceptance';
import {resolvePersonalWizardOptions} from '../lib/personal-wizard/options';
import {preparationGrantSchema,preparationOwnerSchema,preparationPinSchema,preparationPin,preparationFile,verifyPreparationPins,verifyPreparationReview,
  preparationAuthority,PREPARATION_STEPS,prepFail,type PreparationGrant} from '../lib/personal-wizard/source-preparation-policy';
import {verifyNativePageProofCode,verifyNativePageProofOutput} from '../lib/personal-wizard/native-page-proof';
import {NATIVE_PAGE_PROOF_AUTHORITY_ROOT} from '../lib/personal-wizard/native-page-proof-authority-host';
import {exclusiveJson,realDirectory} from './personal-causal-trial-journal';
import {planSourcePreparation,startSourcePreparation,continueSourcePreparation,preparationMeterRules,preparationErrorCode,type PreparationTransport} from './personal-source-preparation';
import {longCallFetch} from './personal-long-call-fetch';
import {SOL_WRITING} from './personal-sol-writing-transport';

const hash=z.string().regex(/^[a-f0-9]{64}$/),head=z.string().regex(/^[a-f0-9]{40}$/),pin=preparationPinSchema;
export const PREPARATION_OPERATOR='source-preparation-operator/v1' as const;
export const preparationLaunchSchema=z.object({version:z.literal(PREPARATION_OPERATOR),state:z.literal('PROSPECTIVE_REQUIRES_GUY_ACTIVATION'),
  grant:pin,layout:pin,supervisor:pin,activationFile:z.string().min(1),traceRoot:z.string().min(1),
  engineQa:z.object({head,ready:pin}).strict(),sourceServerPort:z.literal(3482),credential:z.literal('inherited_OPENAI_API_KEY_after_activation_only'),
  phaseCapMs:z.literal(5400000)}).strict();
export const preparationActivationSchema=z.object({version:z.literal('source-preparation-owner-activation/v1'),owner:z.literal('Guy'),
  approvalReference:z.string().min(30).max(4000),envelopeSha256:hash,grantSha256:hash,ownerTermsSha256:hash,sourceHead:head,
  capMicroUsd:z.literal(5000000),maxCalls:z.literal(6),maxNewLowReferenceImages:z.literal(2),noPaidRetries:z.literal(true),
  phases:z.tuple([z.literal('start'),z.literal('continue')]),reuseExistingCredential:z.literal(true),executionReview:pin,
  approvedAt:z.string().datetime(),expiresAt:z.string().datetime()}).strict();
type Phase='start'|'continue';
const read=(f:string)=>JSON.parse(preparationFile(f).toString('utf8'));
const match=(x:z.infer<typeof pin>)=>{const actual=preparationPin(x.file);if(actual.bytes!==x.bytes||actual.sha256!==x.sha256)prepFail('operator_pin_changed');};
const same=(a:string,b:string)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const git=(workspace:string,...args:string[])=>execFileSync('git',['-C',workspace,...args],{encoding:'utf8',windowsHide:true,maxBuffer:32000000}).trim();
const postEnginePaths=new Set(['scripts/personal-source-preparation-operator.ts','scripts/supervise-source-preparation.ps1',
 'lib/personal-wizard/__tests__/source-preparation-operator.spec.ts','lib/personal-wizard/__tests__/source-preparation-operator-integration.spec.ts',
 'CURRENT.md','ROADMAP.md','docs/ai-workflow/SOURCE_PREPARATION_EXECUTION_GATE_20261102.md']);

export function inspectPreparationLaunch(envelopeFile:string){
  const bytes=preparationFile(envelopeFile),envelope=preparationLaunchSchema.parse(JSON.parse(bytes.toString('utf8')));
  for(const x of [envelope.grant,envelope.layout,envelope.supervisor,envelope.engineQa.ready])match(x);
  for(const f of [envelope.activationFile,envelope.traceRoot])if(!path.isAbsolute(f))prepFail('operator_path');
  const grant=preparationGrantSchema.parse(read(envelope.grant.file)),plan=planSourcePreparation({bookDir:grant.originalBookDir,layoutFile:envelope.layout.file,workspace:grant.workspace});
  if(!same(grant.workspace,process.cwd())||!same(grant.operator.file,__filename))prepFail('operator_entry');
  verifyNativePageProofCode(grant.workspace,grant.sourceHead);match(grant.operator);match(grant.ownerApproval);
  if(!same(envelope.supervisor.file,path.join(grant.workspace,'scripts','supervise-source-preparation.ps1')))prepFail('operator_supervisor');
  const terms=preparationOwnerSchema.parse(read(grant.ownerApproval.file));
  if(!terms.approvalReference.startsWith('PROPOSED TERMS ONLY'))prepFail('operator_terms');
  const required=[...plan.inputs.map(x=>x.file),grant.ownerApproval.file,grant.operator.file];verifyPreparationPins(grant.inputs,required);
  if(grant.originalSourceDigest!==plan.original.book.sourceDigest||grant.originalStoryboardDigest!==plan.original.book.storyboardDigest||
    grant.layoutSha256!==previewSha(canonicalJson(plan.layout))||grant.firstWireSha256!==plan.firstWire.digest)prepFail('operator_source_binding');
  const qa=read(envelope.engineQa.ready.file);
  if(qa.complete!==true||qa.disposition!=='PASS'||qa.scope!=='SOURCE_PREPARATION_CORRECTIONS_R2'||qa.head!==envelope.engineQa.head)prepFail('operator_engine_qa');
  const report=preparationPinSchema.parse(qa.report);match(report);
  const lines=preparationFile(report.file).toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/),header=new Map<string,string>();
  if(lines[0]!=='DISPOSITION: PASS')prepFail('operator_engine_qa');
  for(const line of lines){const m=/^([A-Z][A-Z0-9_]*):[ \t]*(.*)$/.exec(line);if(!m)break;if(header.has(m[1]))prepFail('operator_engine_qa');header.set(m[1],m[2]);}
  if(header.get('SCOPE')!=='SOURCE_PREPARATION_CORRECTIONS_R2'||header.get('SOURCE_HEAD')!==envelope.engineQa.head||header.get('BASE_HEAD')!==qa.base)prepFail('operator_engine_qa');
  git(grant.workspace,'merge-base','--is-ancestor',envelope.engineQa.head,grant.sourceHead);
  const changed=git(grant.workspace,'diff','--name-only',envelope.engineQa.head+'..'+grant.sourceHead).split(/\r?\n/).filter(Boolean);
  if(changed.some(f=>!postEnginePaths.has(f)))prepFail('operator_engine_range');
  verifyNativePageProofOutput(envelope.traceRoot,[grant.workspace,grant.originalBookDir,grant.out,NATIVE_PAGE_PROOF_AUTHORITY_ROOT]);
  return{envelope,envelopeFile,envelopeSha256:previewSha(bytes),grant,plan,required,terms,summary:{version:PREPARATION_OPERATOR,
    sourceHead:grant.sourceHead,grantSha256:envelope.grant.sha256,firstWireBytes:plan.firstWire.bytes,firstWireSha256:plan.firstWire.digest,
    inputFiles:required.length,activationPresent:existsSync(envelope.activationFile),providerCalls:0,executionReady:false,paidAuthority:false}};
}
export function authorizePreparationLaunch(envelopeFile:string,phase:Phase,now=Date.now()){
  if(!['start','continue'].includes(phase))prepFail('operator_phase');
  const state=inspectPreparationLaunch(envelopeFile),{envelope,grant}=state;
  if(!existsSync(envelope.activationFile))prepFail('operator_activation_missing');
  const activationBytes=preparationFile(envelope.activationFile),activation=preparationActivationSchema.parse(JSON.parse(activationBytes.toString('utf8'))),
    approved=Date.parse(activation.approvedAt),expires=Date.parse(activation.expiresAt);
  if(activation.envelopeSha256!==state.envelopeSha256||activation.grantSha256!==envelope.grant.sha256||
    activation.ownerTermsSha256!==grant.ownerApproval.sha256||activation.sourceHead!==grant.sourceHead||
    approved>now||expires<=now||expires-approved>86400000||expires<=approved)prepFail('operator_activation_binding');
  match(activation.executionReview);verifyPreparationReview({file:activation.executionReview.file,sha256:activation.executionReview.sha256},envelope.grant.sha256,grant.sourceHead);
  // Public authority guard is read-only here. Start claims only in the reviewed core, after the final activation checks.
  preparationAuthority({grant,grantFile:envelope.grant.file,review:activation.executionReview,requiredInputs:state.required,...(phase==='continue'?{continuation:true as const}:{})});
  return{...state,activation,activationSha256:previewSha(activationBytes)};
}
export type PreparationRawClient={responses:(payload:any,signal:AbortSignal,timeoutMs:number)=>Promise<any>;
  images:(body:any,refs:readonly {name:string;bytes:Buffer}[],signal:AbortSignal,guard:()=>void)=>Promise<any>};
/** Called ONLY after complete activation/source/review checks; no .env reader, implicit account switch or key output. */
export function createLivePreparationRawClient():PreparationRawClient{
  const key=process.env.OPENAI_API_KEY;if(!key)prepFail('operator_credential_missing');
  return{responses:async(payload,signal,timeoutMs)=>{
    const client=new OpenAI({apiKey:key,baseURL:'https://api.openai.com/v1',maxRetries:0,logLevel:'off',fetch:longCallFetch(timeoutMs+60000)});
    return client.responses.create(payload,{signal,timeout:timeoutMs,maxRetries:0});
  },images:async(body,refs,signal,guard)=>{
    const image=await Promise.all(refs.map(r=>toFile(r.bytes,r.name,{type:'image/png'})));guard();
    const client=new OpenAI({apiKey:key,baseURL:'https://api.openai.com/v1',maxRetries:0,logLevel:'off'});
    return client.images.edit({...body,image},{signal,timeout:180000,maxRetries:0});
  }};
}
/** Raw replies are returned untouched; the reviewed core settles/captures them before its after-await checks. */
export function preparationOperatorTransport(args:{grant:PreparationGrant;client:PreparationRawClient;guard:()=>void}):PreparationTransport{
  return async(step,wire:any,signal)=>{
    args.guard();if(signal.aborted||preparationMeterRules(step)?.reserve(wire)==null)prepFail('operator_wire');
    if(step==='sheet_entities_0'||step==='sheet_locations_0'){
      if(wire.mode!=='images.edit'||wire.body?.model!=='gpt-image-2'||wire.retries!==0||wire.deadlineMs!==180000)prepFail('operator_image_route');
      const refs=wire.references.map((r:any)=>{
        if(!/^[a-z0-9_]+\.png$/.test(r.imageName)||!/^[a-f0-9]{64}$/.test(r.imageSha))prepFail('operator_reference');
        const bytes=preparationFile(path.join(args.grant.out,'sourceRun','illustrations',r.imageName));
        if(previewSha(bytes)!==r.imageSha)prepFail('operator_reference_changed');return{name:r.imageName,bytes};
      });
      args.guard();return args.client.images(structuredClone(wire.body),refs,signal,args.guard);
    }
    const payload=step==='prep_storyboard_0'?wire.payload:wire;
    if(payload?.model!=='gpt-6.1-sol'||payload.store!==false||payload.background===true)prepFail('operator_text_route');
    args.guard();return args.client.responses(structuredClone(payload),signal,SOL_WRITING.timeoutMs);
  };
}
function noSourceServer(){
  const command="$ErrorActionPreference='Stop'; $l=[Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 3482; if($l){exit 23}";
  try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{stdio:'ignore',windowsHide:true,timeout:15000});}
  catch{prepFail('operator_source_listener');}
}
export async function runPreparationOperator(args:{envelopeFile:string;phase:Phase;choiceFile?:string;signal:AbortSignal},
 deps:{clientFactory?:()=>PreparationRawClient;assertNoSourceServer?:()=>void}={}){
  args={...args};
  if(!(args.signal instanceof AbortSignal)||args.phase==='continue'&&(!args.choiceFile||!path.isAbsolute(args.choiceFile)))prepFail('operator_args');
  const state=authorizePreparationLaunch(args.envelopeFile,args.phase),{envelope,grant,activation}=state;
  if(args.signal.aborted)prepFail('operator_cancelled');
  (deps.assertNoSourceServer??noSourceServer)(); // Read-only listener query. No server/power setting is started or changed.
  const stable=[args.envelopeFile,envelope.activationFile,envelope.grant.file,activation.executionReview.file].map(preparationPin);
  const check=()=>{
    if(args.signal.aborted||Date.now()>=Date.parse(activation.expiresAt))prepFail('operator_cancelled');
    for(const x of stable)match(x);
    if(resolvePersonalWizardOptions(grant.workspace).fingerprint!==state.plan.original.queued.optionsFingerprint)prepFail('operator_options');
    preparationAuthority({grant,grantFile:envelope.grant.file,review:activation.executionReview,requiredInputs:state.required,continuation:true}).guard();
  };
  const client=(deps.clientFactory??createLivePreparationRawClient)(); // Credential availability refuses before core claim.
  for(const x of stable)match(x);if(args.signal.aborted||Date.now()>=Date.parse(activation.expiresAt))prepFail('operator_cancelled');
  if(!existsSync(envelope.traceRoot))mkdirSync(envelope.traceRoot);realDirectory(envelope.traceRoot);
  exclusiveJson(path.join(envelope.traceRoot,args.phase+'.operator-start.json'),{version:PREPARATION_OPERATOR,phase:args.phase,
    pid:process.pid,parentPid:process.ppid,at:new Date().toISOString(),sourceHead:grant.sourceHead,grantSha256:envelope.grant.sha256,
    envelopeSha256:state.envelopeSha256,activationSha256:state.activationSha256,reviewSha256:activation.executionReview.sha256});
  try{
    const common={grantFile:envelope.grant.file,layoutFile:envelope.layout.file,review:activation.executionReview,signal:args.signal,
      transport:preparationOperatorTransport({grant,client,guard:check})};
    const result=args.phase==='start'?await startSourcePreparation(common):
      await continueSourcePreparation({...common,choiceFile:args.choiceFile??prepFail('operator_choice_missing')});
    for(const x of stable)match(x);if(args.signal.aborted||Date.now()>=Date.parse(activation.expiresAt))prepFail('operator_cancelled');
    exclusiveJson(path.join(envelope.traceRoot,args.phase+'.operator-outcome.json'),{status:result.status,at:new Date().toISOString(),result,paidRetryAllowed:false});
    return result;
  }catch(error){
    const code=preparationErrorCode(error)??'operator_held';
    try{exclusiveJson(path.join(envelope.traceRoot,args.phase+'.operator-outcome.json'),{status:'HELD',code,at:new Date().toISOString(),paidRetryAllowed:false});}catch{/* Preserve original error and core journal. */}
    throw error;
  }
}
export async function preparationOperatorMain(argv:readonly string[]){
  const value=(name:string)=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];},
    envelopeFile=value('--envelope'),phase=value('--phase')??'preflight',choiceFile=value('--choice');
  const allowed=new Set(['--envelope','--phase','--choice']);
  if(!envelopeFile||argv.length%2||argv.some((v,i)=>i%2===0&&!allowed.has(v))||new Set(argv.filter((_,i)=>i%2===0)).size!==argv.length/2)prepFail('operator_args');
  if(phase==='preflight'){const result=inspectPreparationLaunch(envelopeFile).summary;console.log(JSON.stringify(result));return result;}
  if(phase==='check-start'||phase==='check-continue'){const s=authorizePreparationLaunch(envelopeFile,phase==='check-start'?'start':'continue');noSourceServer();
    const result={...s.summary,authorityChecked:true,executionReady:false};console.log(JSON.stringify(result));return result;}
  if(phase!=='start'&&phase!=='continue')prepFail('operator_phase');
  const controller=new AbortController(),abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
  const cap=setTimeout(abort,5400000);
  try{const result=await runPreparationOperator({envelopeFile,phase,choiceFile,signal:controller.signal});
    console.log(JSON.stringify({status:result.status,providerCalls:result.spend.calls,spend:result.spend}));return result;}
  finally{clearTimeout(cap);process.off('SIGINT',abort);process.off('SIGTERM',abort);}
}
if(process.argv[1]&&same(process.argv[1],__filename))preparationOperatorMain(process.argv.slice(2)).catch(()=>{
  // Never print provider errors, request bodies, headers, environment values or credentials.
  console.error('SOURCE_PREPARATION_OPERATOR_HELD');process.exitCode=2;
});
