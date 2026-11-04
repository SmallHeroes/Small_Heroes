/** Explicit preparation-only caller. No CLI/default transport/key/SDK construction. Future spend needs an exact independently reviewed grant. */
import 'server-only';
import path from 'node:path';
import {existsSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import sharp from 'sharp';
import {canonicalJson} from '../lib/personal-wizard/request-acceptance';
import {previewSha} from '../lib/local-story-preview';
import {resolvePersonalWizardOptions} from '../lib/personal-wizard/options';
import {deriveExistingChildAppearance,existingChildAppearanceData,EXISTING_CHILD_APPEARANCE_FILE} from '../lib/personal-wizard/existing-child-appearance';
import {prepareCurrentPersonalStoryboard,storyboardInstructions,storyboardDraftSchema} from '../lib/personal-wizard/storyboard';
import {runSimpleStoryboardDiagnostic,type SimpleStoryboardDiagnosticCall} from '../lib/personal-wizard/simple-storyboard-diagnostic';
import {personalBookOutputLimits} from '../lib/personal-wizard/book-config';
import {personalBookProviderPayload,decodePersonalBookProviderOutput} from '../lib/personal-wizard/book-openai';
import {STORYBOARD_REVIEW_CAPACITY} from '../lib/personal-wizard/storyboard-review-capacity';
import {prepareSolWritingWire,solWritingRuleFor} from './personal-sol-writing-transport';
import {stageRules} from './personal-new-book-experiment';
import {solCacheReserveMargin,solCacheWriteAdjustment} from './personal-sol-cache-budget';
import {AuditionMeter,auditionRenderRule,auditionReviewRule,auditionRenderPlan,auditionJudgePayload,readReviewedBookLayout,loadReviewedBook,
  reviewedBookLayoutSchema,derivedSheetContexts,readReusedSheets,dryNativePageProof,type ReviewedBookLayout,type MeterRule,type MeterRules} from './personal-simple-book-reviewed-audition';
import {auditionSheetDesigns,auditionSheetContext,auditionSheetPrompt,assessAuditionReview,attemptStatus,selectAuditionAttempt,
  type AuditionAttempt,type SavedSheet} from '../lib/personal-wizard/simple-book-reviewed-audition';
import type {AuditionImage} from '../lib/personal-wizard/simple-book-illustrations';
import {preflightNativePageProofFrames} from '../lib/personal-wizard/native-page-proof-frames';
import {exclusiveJson,exclusiveText,realDirectory} from './personal-causal-trial-journal';
import {preparationGrantSchema,preparationPageChoiceSchema,preparationAuthority,preparationPin,preparationFile,verifyPreparationPins,verifyApprovedWaiting,
  PREPARATION_STEPS,PREPARATION_SLOTS,SOURCE_PREPARATION,prepFail,type PreparationGrant} from '../lib/personal-wizard/source-preparation-policy';

export { PREPARATION_CONTRACTS } from '../lib/personal-wizard/source-preparation-contracts';
import { PREPARATION_CONTRACTS } from '../lib/personal-wizard/source-preparation-contracts';
export const PREPARATION_ADMISSION={instanceDistinctionContract:true,engineContinuity:PREPARATION_CONTRACTS.engineContinuity} as const;
type Step=typeof PREPARATION_STEPS[number];
const read=(f:string)=>JSON.parse(preparationFile(f).toString('utf8'));
const hash=(v:unknown)=>previewSha(canonicalJson(v));
const at=(root:string,...parts:string[])=>path.join(root,...parts);
const supported=(status:string)=>status==='review_supported'||status==='review_supported_with_notes';

/** Native full UNKNOWN reserve includes the entire cache margin; known cost settles as the same labeled conservative tariff estimate. */
const cacheRule=(base:MeterRule,floor=0):MeterRule=>({reserve(w){const raw=base.reserve(w);if(raw===null)return null;const n=Math.max(floor,raw);return n+solCacheReserveMargin(w,n);},
  settle(w,r,completed){const s=base.settle(w,r,completed);if(s.estimatedMicroUsd===null)return s;
    try{return{coherent:s.coherent,estimatedMicroUsd:s.estimatedMicroUsd+solCacheWriteAdjustment(w,r?.raw)};}catch{return{coherent:s.coherent,estimatedMicroUsd:null};}}});
const writerRule=cacheRule(solWritingRuleFor('storyboard'));
const semanticRule=cacheRule(stageRules.text.storyboard_review,600000);
const pixelRule=cacheRule(auditionReviewRule);
export const preparationMeterRules:MeterRules=step=>{
  const i=(PREPARATION_STEPS as readonly string[]).indexOf(step);if(i<0)return undefined;
  const base=i===0?writerRule:i===1?semanticRule:i===2||i===4?auditionRenderRule:pixelRule;
  return{settle:base.settle,reserve(w:any){
    if(i===0&&(w?.stage!=='storyboard'||w.outputCap!==50000))return null;
    if(i===1&&(w?.model!=='gpt-6.1-sol'||w.max_output_tokens!==39000||w.metadata?.storyboard_review_capacity!==STORYBOARD_REVIEW_CAPACITY.version||
      Buffer.byteLength(JSON.stringify(w),'utf8')>240000||Buffer.byteLength(String(w.instructions)+String(w.input),'utf8')>208000))return null;
    if((i===2||i===4)&&(w?.references?.length!==2||Buffer.byteLength(w.body?.prompt??'','utf8')>32768||w.body?.size!=='1024x1024'))return null;
    if((i===3||i===5)&&(w?.max_output_tokens!==12000||w.metadata!==undefined||w.input?.[0]?.content?.filter((x:any)=>x.type==='input_image').length!==7||
      Buffer.byteLength(String(w.instructions)+String(w.input?.[0]?.content?.[0]?.text),'utf8')>104000))return null;
    const amount=base.reserve(w);return amount!==null&&Number.isSafeInteger(amount)&&amount>0&&amount<=PREPARATION_SLOTS[i]?amount:null;
  }};
};

export function preparationOriginalInputFiles(bookDir:string,layoutFile:string,layout:ReviewedBookLayout,workspace:string){
  const story=at(bookDir,layout.storyboardDir),child=at(bookDir,layout.childDir),companion=read(at(bookDir,'request.json')).request.companion.id;
  const files=[layoutFile,at(bookDir,'request.json'),at(story,'visual_simple_book_result.json'),at(story,'owned_storyboard_draft.json'),
    at(child,'reference_child_adoption.json'),at(child,'illustrations',layout.childImage),
    ...['manifest.json','front.png','3-4.png','side.png','back.png','happy.png','theme.png'].map(n=>at(workspace,'public','companions',companion,'style01-sheets',n))];
  for(const n of ['storyboard_repair_input.json',EXISTING_CHILD_APPEARANCE_FILE]){const f=n===EXISTING_CHILD_APPEARANCE_FILE?at(child,n):at(story,n);if(existsSync(f))files.push(f);}
  if(layout.savedCompanion!==null)files.push(at(bookDir,...layout.savedCompanion.split('/')));
  // Every selectable companion contributes to the original request fingerprint, not only the selected one.
  for(const card of resolvePersonalWizardOptions(workspace).companions){
    files.push(at(workspace,'public',card.image.replace(/^\//,'')));
    for(const n of ['manifest.json','front.png','3-4.png','side.png','back.png','happy.png','theme.png'])files.push(at(workspace,'public','companions',card.id,'style01-sheets',n));
  }
  return [...new Set(files.map(f=>path.resolve(f)))].sort();
}

/** N1 and F4, zero provider/claim/output: original genuine request/seed/child load, then complete NEW wire measurement. */
export function planSourcePreparation(args:{bookDir:string;layoutFile:string;workspace?:string}){
  const workspace=path.resolve(args.workspace??process.cwd());
  const layout=reviewedBookLayoutSchema.parse(read(args.layoutFile));
  const files=preparationOriginalInputFiles(args.bookDir,args.layoutFile,layout,workspace),inputs=files.map(preparationPin);
  const original=loadReviewedBook(args.bookDir,workspace,undefined,layout);
  if(!layout.childAnchor||'ownerAcceptance'in original||original.replan||original.book.existingChildAppearance)prepFail('original_scope');
  const adoption=read(at(args.bookDir,layout.childDir,'reference_child_adoption.json'));
  const appearance=deriveExistingChildAppearance({requestId:original.queued.requestId,sourceDigest:original.book.sourceDigest,
    storyboardDigest:original.book.storyboardDigest,clothing:original.book.plan.actorAppearance!.child.clothing},
    {age:original.prepared.brief.child.age,gender:original.prepared.brief.child.address as 'boy'|'girl',design:layout.childDesign,
      acceptance:layout.childAnchor,pose:layout.childAnchorPose},adoption,previewSha(original.childBytes));
  const c=PREPARATION_CONTRACTS;
  const source=prepareCurrentPersonalStoryboard(original.queued.request,original.result.source,resolvePersonalWizardOptions(workspace),true,true,true,undefined,true,true,undefined,
    true,true,true,true,true,true,true,true,true,c.engineContinuity,appearance);
  const context={narrativeSpreads:8,sourceDigest:source.sourceDigest,actorOwnedAppearance:true as const,momentContract:true as const,landmarkKindContract:true as const,
    drawnInstantContract:true as const,selfCheckContract:true as const,claimBasisContract:true as const,calibrationContract:true as const,presenceContract:true as const,
    stateParityContract:true as const,instanceDistinctionContract:true as const,engineContinuity:c.engineContinuity,existingChildAppearance:existingChildAppearanceData(appearance)};
  const call:SimpleStoryboardDiagnosticCall={stage:'storyboard',instructions:storyboardInstructions(source),input:canonicalJson(source.planningInput),schema:storyboardDraftSchema(source),
    maxOutputTokens:personalBookOutputLimits(8,{selfCheck:true}).storyboardOutputTokens,context};
  // The real wire builder, including compact schema, runs BEFORE a one-use approval is claimed.
  const firstWire=prepareSolWritingWire(call);if(preparationMeterRules(PREPARATION_STEPS[0])!.reserve(firstWire)===null)prepFail('first_wire_reserve');
  return{workspace,layout,original,adoption,appearance,source,firstCall:call,firstWire,inputs,
    targetLayout:reviewedBookLayoutSchema.parse({...layout,storyboardDir:'storyboard_cde_0'}),providerCalls:0 as const,executionReady:false as const};
}

export type PreparationTransport=(step:Step,wire:unknown,signal:AbortSignal)=>Promise<any>;
type Execution={grantFile:string;layoutFile:string;review:{file:string;sha256:string};signal:AbortSignal;transport:PreparationTransport};
function executionSnapshot<T extends Execution>(args:T):T{
  if(!args||![args.grantFile,args.layoutFile,args.review?.file].every(f=>typeof f==='string'&&path.isAbsolute(f))||
    !/^[a-f0-9]{64}$/.test(args.review?.sha256??'')||!(args.signal instanceof AbortSignal)||typeof args.transport!=='function')prepFail('execution_input');
  return{...args,review:{...args.review}};
}
const bookFiles=(root:string,layout:ReviewedBookLayout)=>[at(root,'request.json'),at(root,'book-layout.json'),at(root,layout.storyboardDir,'owned_storyboard_draft.json'),
  at(root,layout.storyboardDir,'visual_simple_book_result.json'),at(root,layout.childDir,'reference_child_adoption.json'),
  at(root,layout.childDir,EXISTING_CHILD_APPEARANCE_FILE),at(root,layout.childDir,'illustrations',layout.childImage)];
function exclusiveBinary(file:string,bytes:Buffer){realDirectory(path.dirname(file));const fd=openSync(file,'wx');try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}
function directories(out:string,layout:ReviewedBookLayout){
  mkdirSync(out);realDirectory(out);
  for(const dir of [at(out,'book'),at(out,'book',layout.storyboardDir),at(out,'book',layout.childDir),at(out,'book',layout.childDir,'illustrations'),
    at(out,'sourceRun'),at(out,'sourceRun','illustrations')]){mkdirSync(dir);realDirectory(dir);}
}
function openExecution(args:Execution,continuation?:true){
  if(args.signal.aborted)prepFail('cancelled');
  const grant=preparationGrantSchema.parse(read(args.grantFile));if(path.resolve(grant.workspace).toLowerCase()!==path.resolve(process.cwd()).toLowerCase())prepFail('workspace');
  // Preflight has no writes, no claim, no transport. Real source is re-admitted on continuation too.
  const plan=planSourcePreparation({bookDir:grant.originalBookDir,layoutFile:args.layoutFile,workspace:grant.workspace});
  if(grant.originalSourceDigest!==plan.original.book.sourceDigest||grant.originalStoryboardDigest!==plan.original.book.storyboardDigest||
    grant.layoutSha256!==hash(plan.layout)||grant.firstWireSha256!==plan.firstWire.digest)prepFail('source_binding');
  const required=[...plan.inputs.map(x=>x.file),grant.ownerApproval.file,grant.operator.file];
  const authority=preparationAuthority({grant,grantFile:args.grantFile,review:args.review,requiredInputs:required,...(continuation?{continuation}:{})});
  const check=()=>{if(args.signal.aborted)prepFail('cancelled');authority.guard();
    if(resolvePersonalWizardOptions(grant.workspace).fingerprint!==plan.original.queued.optionsFingerprint)prepFail('options_changed');};
  return{grant,plan,authority,check};
}
type DispatchFailure={details?:{step:Step;code:string}};
/** Internal engine refusals throw message-only codes with these fixed prefixes (e.g. a compiler gate after a paid answer). */
const INTERNAL_CODE=/^(?:storyboard|personal_storyboard|existing_child_appearance|book_provider|audition|page_proof|source_prep)_[a-z0-9_]{1,120}$/;
export const preparationErrorCode=(error:unknown)=>{
  if(error&&typeof error==='object'&&'code'in error&&typeof error.code==='string'&&error.code.length<=128&&/^[a-z0-9_]+$/.test(error.code))return error.code;
  // Only internal code-shaped messages are classified; arbitrary error text (provider, I/O) is never logged.
  if(error instanceof Error&&INTERNAL_CODE.test(error.message))return error.message;
  return undefined;
};
function stop(out:string,error:unknown,meter?:AuditionMeter,failure?:DispatchFailure){
  if(!existsSync(out)||existsSync(at(out,'PREPARATION-STOP.json')))return;
  let spend:unknown=null;try{spend=meter?.snapshot()??null;}catch{/* A corrupt/unknown ledger stays preserved and blocks. */}
  const wrapperCode=preparationErrorCode(error),details=failure?.details,code=details?.code??wrapperCode??'source_prep_failed';
  try{exclusiveJson(at(out,'PREPARATION-STOP.json'),{version:SOURCE_PREPARATION,status:'HELD',code,
    ...(details?{failedStep:details.step}:{}),...(wrapperCode&&wrapperCode!==code?{wrapperCode}:{}),spend,paidRetryAllowed:false,at:new Date().toISOString()});}catch{/* Preserve original error. */}
}
function dispatcher(args:Execution,grant:PreparationGrant,meter:AuditionMeter,check:()=>void,failure:DispatchFailure,offset=0){
  return async<T>(step:Step,wire:unknown,decode:(raw:any)=>T):Promise<T>=>{
    try{
    // offset: the steps an adopted preparation did not run in this ledger (its storyboard and review); those steps can never dispatch here.
    check();const i=PREPARATION_STEPS.indexOf(step),state=meter.snapshot();
    if(i<offset||state.calls!==i-offset||state.failed||state.unknownCost||state.unknownOutcome||existsSync(at(grant.out,'PREPARATION-STOP.json')))prepFail('stage_order');
    const own=preparationMeterRules(step)!,maximum=own.reserve(wire);if(maximum===null)prepFail('wire_policy');
    let actual:number|null=null;
    const value=await meter.run(step,wire,maximum,async()=>{
      check();
      let raw:any;
      try{raw=await args.transport(step,structuredClone(wire),args.signal);}
      catch{throw Object.assign(new Error('source_prep_unresolved_transport'),{code:'source_prep_unresolved_transport',durableReviewPending:true});}
      if((i===0||i===1||i===3||i===5)&&!['completed','failed','incomplete','cancelled'].includes(raw?.status)){
        exclusiveJson(at(grant.out,'PENDING-'+step+'.json'),{step,raw,knownTerminal:false});
        throw Object.assign(new Error('source_prep_pending_outcome'),{code:'source_prep_pending_outcome',durableReviewPending:true});
      }
      const receipt:any={raw,model:i===2||i===4?'gpt-image-2':raw?.model,stage:i===0?'storyboard':i===1?'storyboard_review':undefined,
        usage:raw?.usage&&typeof raw.usage.input_tokens==='number'?{inputTokens:raw.usage.input_tokens,outputTokens:raw.usage.output_tokens}:null,
        metadata:{reportedModel:raw?.model}};
      const settled=own.settle(wire,receipt,i===2||i===4||raw.status==='completed');receipt.estimatedMicroUsd=actual=settled.estimatedMicroUsd;
      try{check();if(!settled.coherent)prepFail('unusable_receipt');const value=decode(raw);check();return{value,receipt,estimatedMicroUsd:actual};}
      catch(error){throw Object.assign(error instanceof Error?error:new Error('source_prep_failed'),{receipt});}
    });
    check();if(actual===null)prepFail('unknown_cost');if(actual>maximum)prepFail('cost_over_reserve');
    meter.snapshot();return value;
    }catch(error){const code=preparationErrorCode(error);if(code)failure.details={step,code};throw error;}
  };
}

/**
 * An earlier preparation's sealed, review-supported board for the SAME original inputs: its WAITING bytes match the fixed host's seal, its
 * pinned book files are unchanged, and the actual reader reloads it as supported for this request and target layout. Checked before any claim.
 */
function approvedPreparation(adopt:{out:string;approvalId:string},plan:ReturnType<typeof planSourcePreparation>,grant:PreparationGrant){
  const out=path.resolve(adopt.out);if(out.toLowerCase()===path.resolve(grant.out).toLowerCase())prepFail('adopt_scope');
  const waitingBytes=preparationFile(at(out,'WAITING-OWNER.json')),waiting=verifyApprovedWaiting(adopt,waitingBytes),bookDir=at(out,'book');
  if(waiting.status!=='WAITING_FOR_OWNER_PAGE_SELECTION'||path.resolve(waiting.bookDir)!==path.resolve(bookDir))prepFail('adopt_binding');
  const layout=reviewedBookLayoutSchema.parse(waiting.layout);if(canonicalJson(layout)!==canonicalJson(plan.targetLayout))prepFail('adopt_binding');
  verifyPreparationPins(waiting.files,bookFiles(bookDir,layout));
  const loaded=loadReviewedBook(bookDir,grant.workspace,undefined,layout,PREPARATION_ADMISSION);
  if(!supported(loaded.result.status)||loaded.book.storyboardDigest!==waiting.storyboardDigest||loaded.book.sourceDigest!==waiting.sourceDigest||
    loaded.queued.requestId!==plan.original.queued.requestId)prepFail('adopt_binding');
  // The sealed pins, not the mutable approved files, are the authority for every later byte: keyed by the approved book's own file paths.
  const pins=new Map((waiting.files as {file:string;bytes:number;sha256:string}[]).map(p=>[path.resolve(p.file).toLowerCase(),p]));
  return{out,bookDir,approvalId:adopt.approvalId,waitingSha256:previewSha(waitingBytes),grantSha256:waiting.grantSha256 as string,pins,
    storyboardDigest:waiting.storyboardDigest as string,sourceDigest:waiting.sourceDigest as string};
}
/** Every destination book file must equal the approved book's SEALED pin for the same file (by position in bookFiles). */
function assertAdoptedBytes(adopted:NonNullable<ReturnType<typeof approvedPreparation>>,mine:readonly string[],theirs:readonly string[]){
  mine.forEach((file,k)=>{const pin=adopted.pins.get(path.resolve(theirs[k]).toLowerCase()),b=preparationFile(file);
    if(!pin||b.length!==pin.bytes||previewSha(b)!==pin.sha256)prepFail('adopt_bytes');});
}

/**
 * Storyboard + semantic review, then durable zero-cost wait. Under grant.adoptApproved the two text calls are replaced by the earlier sealed,
 * supported board (byte-identical book files), and no provider call runs. No reference/page callback can run here.
 */
export async function startSourcePreparation(args:Execution){
  args=executionSnapshot(args);
  const e=openExecution(args),{grant,plan,authority,check}=e;
  if(existsSync(grant.out))prepFail('output_exists');
  const adopted=grant.adoptApproved?approvedPreparation(grant.adoptApproved,plan,grant):null;
  // All input admission, exact wire size, price, code and execution review checks precede this one-use claim.
  authority.activate();let meter:AuditionMeter|undefined;const failure:DispatchFailure={};
  try{
    directories(grant.out,plan.targetLayout);const bookDir=at(grant.out,'book'),sourceRun=at(grant.out,'sourceRun');
    exclusiveJson(at(grant.out,'PROCESS-START.json'),{version:SOURCE_PREPARATION,grantSha256:authority.grantSha256,sourceHead:grant.sourceHead,
      operator:grant.operator,executionMode:grant.executionMode,pid:process.pid,parentPid:process.ppid,startedAt:new Date().toISOString()});
    exclusiveText(at(bookDir,'request.json'),preparationFile(at(grant.originalBookDir,'request.json')).toString('utf8'));
    exclusiveJson(at(bookDir,'book-layout.json'),plan.targetLayout);
    exclusiveText(at(bookDir,plan.targetLayout.childDir,'reference_child_adoption.json'),preparationFile(at(grant.originalBookDir,plan.layout.childDir,'reference_child_adoption.json')).toString('utf8'));
    exclusiveBinary(at(bookDir,plan.targetLayout.childDir,'illustrations',plan.targetLayout.childImage),plan.original.childBytes);
    exclusiveJson(at(bookDir,plan.targetLayout.childDir,EXISTING_CHILD_APPEARANCE_FILE),existingChildAppearanceData(plan.appearance));
    meter=new AuditionMeter(at(sourceRun,'paid-stages'),5000000,6,0,0,preparationMeterRules);
    if(adopted){
      for(const name of ['owned_storyboard_draft.json','visual_simple_book_result.json']){
        const source=at(adopted.bookDir,plan.targetLayout.storyboardDir,name),pin=adopted.pins.get(path.resolve(source).toLowerCase()),bytes=preparationFile(source);
        if(!pin||bytes.length!==pin.bytes||previewSha(bytes)!==pin.sha256)prepFail('adopt_bytes');
        exclusiveBinary(at(bookDir,plan.targetLayout.storyboardDir,name),bytes);
      }
      const mine=bookFiles(bookDir,plan.targetLayout),theirs=bookFiles(adopted.bookDir,plan.targetLayout);
      assertAdoptedBytes(adopted,mine,theirs);
      const loaded=loadReviewedBook(bookDir,grant.workspace,undefined,plan.targetLayout,PREPARATION_ADMISSION);
      if(!supported(loaded.result.status)||loaded.book.storyboardDigest!==adopted.storyboardDigest||loaded.book.sourceDigest!==adopted.sourceDigest)prepFail('adopt_binding');
      const waiting={version:SOURCE_PREPARATION,status:'WAITING_FOR_OWNER_PAGE_SELECTION',grantSha256:authority.grantSha256,sourceHead:grant.sourceHead,
        storyboardDigest:loaded.book.storyboardDigest,sourceDigest:loaded.book.sourceDigest,bookDir,sourceRun,layout:plan.targetLayout,
        // The new WAITING pins are the approved SEALED pins at the destination paths, never re-read from mutable destination bytes.
        files:mine.map((file,k)=>{const pin=adopted.pins.get(path.resolve(theirs[k]).toLowerCase());if(!pin)return prepFail('adopt_bytes');
          return{file:path.resolve(file),bytes:pin.bytes,sha256:pin.sha256};}),spend:meter.snapshot(),at:new Date().toISOString(),noPaidRetries:true,
        adoptedFrom:{out:adopted.out,approvalId:adopted.approvalId,waitingSha256:adopted.waitingSha256,grantSha256:adopted.grantSha256}};
      check();assertAdoptedBytes(adopted,mine,theirs);exclusiveJson(at(grant.out,'WAITING-OWNER.json'),waiting);authority.sealWaiting(preparationFile(at(grant.out,'WAITING-OWNER.json')));return waiting;
    }
    const dispatch=dispatcher(args,grant,meter,check,failure);let rawDraft:unknown;
    const diagnostic=await runSimpleStoryboardDiagnostic({request:plan.original.queued.request,writerResult:plan.original.result.source,options:resolvePersonalWizardOptions(grant.workspace),
      ...PREPARATION_CONTRACTS,existingChildAppearance:plan.appearance,reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version,signal:args.signal,
      generate:async call=>{
        const wire=call.stage==='storyboard'?prepareSolWritingWire(call):personalBookProviderPayload(call,'gpt-6.1-sol');
        if(call.stage==='storyboard'&&(wire as ReturnType<typeof prepareSolWritingWire>).digest!==grant.firstWireSha256)prepFail('first_wire_changed');
        return dispatch(call.stage==='storyboard'?'prep_storyboard_0':'prep_storyboard_0_review',wire,raw=>{
          const parsed=decodePersonalBookProviderOutput(call,JSON.parse(raw.output_text));if(call.stage==='storyboard')rawDraft=structuredClone(parsed);return parsed;
        });
      }});
    check();if(!supported(diagnostic.status))prepFail('storyboard_held');
    const result={version:'prepared-source-result/v1',status:diagnostic.status,source:plan.original.result.source,storyboard:diagnostic,runtimeEligible:false};
    exclusiveJson(at(bookDir,plan.targetLayout.storyboardDir,'owned_storyboard_draft.json'),rawDraft);
    exclusiveJson(at(bookDir,plan.targetLayout.storyboardDir,'visual_simple_book_result.json'),result);
    // N2: diagnostic.framePackets were created WITHOUT readerFraming; loading checks their actual base bytes.
    loadReviewedBook(bookDir,grant.workspace,undefined,plan.targetLayout,PREPARATION_ADMISSION);
    const waiting={version:SOURCE_PREPARATION,status:'WAITING_FOR_OWNER_PAGE_SELECTION',grantSha256:authority.grantSha256,sourceHead:grant.sourceHead,
      storyboardDigest:diagnostic.storyboardDigest,sourceDigest:diagnostic.sourceDigest,bookDir,sourceRun,layout:plan.targetLayout,
      files:bookFiles(bookDir,plan.targetLayout).map(preparationPin),spend:meter.snapshot(),at:new Date().toISOString(),noPaidRetries:true};
    check();exclusiveJson(at(grant.out,'WAITING-OWNER.json'),waiting);authority.sealWaiting(preparationFile(at(grant.out,'WAITING-OWNER.json')));return waiting;
  }catch(error){stop(grant.out,error,meter,failure);throw error;}
}

/** Forward-only after owner choice, same claim and ledger. No retry/replan/re-review/recovery, even after interruption. */
export async function continueSourcePreparation(args:Execution&{choiceFile:string}){
  args=executionSnapshot(args);if(!path.isAbsolute(args.choiceFile))prepFail('page_choice_path');
  const e=openExecution(args,true),{grant,authority,check}=e,waitingFile=at(grant.out,'WAITING-OWNER.json'),waitingBytes=preparationFile(waitingFile),waiting=JSON.parse(waitingBytes.toString('utf8'));
  authority.assertWaiting(waitingBytes);
  if(waiting.status!=='WAITING_FOR_OWNER_PAGE_SELECTION'||waiting.grantSha256!==authority.grantSha256||waiting.sourceHead!==grant.sourceHead||
    existsSync(at(grant.out,'PREPARATION-STOP.json'))||existsSync(at(grant.out,'PREPARATION-COMPLETE.json')))prepFail('waiting_binding');
  const layout=reviewedBookLayoutSchema.parse(waiting.layout),bookDir=at(grant.out,'book'),sourceRun=at(grant.out,'sourceRun');
  if(canonicalJson(layout)!==canonicalJson(e.plan.targetLayout))prepFail('waiting_binding');
  if(path.resolve(waiting.bookDir)!==path.resolve(bookDir)||path.resolve(waiting.sourceRun)!==path.resolve(sourceRun))prepFail('waiting_binding');
  verifyPreparationPins(waiting.files,bookFiles(bookDir,layout));
  // An adopted board ran no text calls in this ledger: it must be bound to this grant's adoptApproved, and its ledger starts empty.
  const adopted=grant.adoptApproved;
  if(!!adopted!==!!waiting.adoptedFrom||(adopted&&(path.resolve(waiting.adoptedFrom.out)!==path.resolve(adopted.out)||waiting.adoptedFrom.approvalId!==adopted.approvalId)))prepFail('waiting_binding');
  const priorCalls=adopted?0:2;
  const loaded=loadReviewedBook(bookDir,grant.workspace,undefined,layout,PREPARATION_ADMISSION);
  const choiceBytes=preparationFile(args.choiceFile),choice=preparationPageChoiceSchema.parse(JSON.parse(choiceBytes.toString('utf8')));
  const packets=loaded.result.storyboard.framePackets;
  if(choice.approvalId!==authority.owner.approvalId||choice.grantSha256!==authority.grantSha256||choice.storyboardDigest!==loaded.book.storyboardDigest||
    waiting.storyboardDigest!==loaded.book.storyboardDigest||waiting.sourceDigest!==loaded.book.sourceDigest||
    packets[choice.standingPage].packetDigest!==choice.standingPacketSha256||packets[choice.continuityPage].packetDigest!==choice.continuityPacketSha256)prepFail('page_choice_binding');
  const guard=()=>{check();if(previewSha(preparationFile(waitingFile))!==previewSha(waitingBytes)||previewSha(preparationFile(args.choiceFile))!==previewSha(choiceBytes))prepFail('waiting_changed');verifyPreparationPins(waiting.files,bookFiles(bookDir,layout));};
  const meter=new AuditionMeter(at(sourceRun,'paid-stages'),5000000,6,0,0,preparationMeterRules),before=meter.snapshot(),failure:DispatchFailure={};
  if(before.calls!==priorCalls||before.failed||before.unknownCost||before.unknownOutcome||canonicalJson(before)!==canonicalJson(waiting.spend))prepFail('waiting_ledger');
  // Exclusive and permanent: even a crashed continuation cannot dispatch again under another process/output alias.
  guard();exclusiveJson(at(grant.out,'CONTINUATION-ENTERED.json'),{grantSha256:authority.grantSha256,waitingSha256:previewSha(waitingBytes),choiceSha256:previewSha(choiceBytes),pid:process.pid,parentPid:process.ppid,startedAt:new Date().toISOString()});
  try{
    exclusiveText(at(grant.out,'OWNER-PAGE-CHOICE.json'),choiceBytes.toString('utf8'));
    const child:AuditionImage={imageName:'reference_child.png',imageSha:previewSha(loaded.childBytes)},companion:AuditionImage={imageName:'reference_companion.png',imageSha:previewSha(loaded.companionBytes)};
    exclusiveBinary(at(sourceRun,'illustrations',child.imageName),loaded.childBytes);exclusiveBinary(at(sourceRun,'illustrations',companion.imageName),loaded.companionBytes);
    exclusiveJson(at(sourceRun,'admission.json'),{version:SOURCE_PREPARATION,requestId:loaded.queued.requestId,storyboardDigest:loaded.book.storyboardDigest,child,companion,
      sourceDigest:loaded.book.sourceDigest,grantSha256:authority.grantSha256});
    const designs=auditionSheetDesigns(loaded.book,loaded.texts),dispatch=dispatcher(args,grant,meter,guard,failure,2-priorCalls),sheets={} as Record<'entities'|'locations',SavedSheet>;
    for(const role of ['entities','locations'] as const){
      guard();const context=auditionSheetContext(role,designs[role]),prompt=auditionSheetPrompt(role,designs[role]);
      const render=auditionRenderPlan(at(sourceRun,'illustrations'),prompt,[child,companion],'book_design',['child_design_authority','companion_design_authority']);
      const image=await dispatch(`sheet_${role}_0`,render.wire,raw=>{
        const encoded=raw?.data?.[0]?.b64_json;if(typeof encoded!=='string')prepFail('image_response');return Buffer.from(encoded,'base64');});
      const meta=await sharp(image).metadata();guard();if(meta.format!=='png'||meta.width!==1024||meta.height!==1024)prepFail('image_format');
      const candidate:AuditionImage={imageName:`sheet_${role}_0.png`,imageSha:previewSha(image)};
      exclusiveBinary(at(sourceRun,'illustrations',candidate.imageName),image);
      const wire=await auditionJudgePayload({candidate,candidateBytes:image,context:context.context,contextSha:context.contextSha,
        refs:[loaded.childBytes,loaded.companionBytes],predecessor:null,kind:'sheet'});guard();
      const judged=await dispatch(`sheet_${role}_0_qa`,wire,raw=>assessAuditionReview(JSON.parse(raw.output_text),candidate.imageSha,context.contextSha,context.requirementIds));
      const attempt:AuditionAttempt={attempt:0,candidate,review:judged.review,assessment:judged.assessment,status:'unavailable'};
      attempt.status=attemptStatus('sheet',attempt);const chosen=selectAuditionAttempt('sheet',[attempt]);
      if(!chosen){exclusiveJson(at(sourceRun,`held_sheet_${role}.json`),attempt);prepFail('reference_held');}
      sheets[role]={...context,attempts:[attempt],chosen,status:attempt.status};exclusiveJson(at(sourceRun,`sheet_${role}.json`),sheets[role]);
      if(attempt.status!=='qa_supported')prepFail('reference_held');
    }
    guard();const reused=readReusedSheets({sourceRun,roles:['entities','locations']},{requestId:loaded.queued.requestId,storyboardDigest:loaded.book.storyboardDigest,child,companion},
      at(grant.out,'future-proof-output'),derivedSheetContexts(loaded.book,loaded.texts,['entities','locations']));
    await preflightNativePageProofFrames({book:loaded.book,rawReview:loaded.rawReview,texts:loaded.texts,current:loaded.current,child,companion,
      companionDescription:loaded.companionDescription,pages:choice.pages,reuseSheets:reused.sheets,check:guard});guard();
    const outcome={version:SOURCE_PREPARATION,status:'REFERENCES_QUALIFIED_EXACT_PAGE_PROOF_DRY_PENDING',grantSha256:authority.grantSha256,
      sourceHead:grant.sourceHead,bookDir,sourceRun,storyboardDigest:loaded.book.storyboardDigest,pages:choice.pages,spend:meter.snapshot(),
      runtimeEligible:false,productAccepted:false,executionReady:false,remainingGates:['actual dryNativePageProof with exact prospective USD1 grant','independent exact page execution review','Guy explicit page go'],at:new Date().toISOString()};
    exclusiveJson(at(grant.out,'PREPARATION-COMPLETE.json'),outcome);return outcome;
  }catch(error){stop(grant.out,error,meter,failure);throw error;}
}

/** Separate provider-free consumer check. Never creates a page grant/claim/output and never executes a provider. */
export async function admitPreparationToPageProof(args:Parameters<typeof dryNativePageProof>[0]){return dryNativePageProof(args);}
