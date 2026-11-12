import 'server-only';
import { illustrateReviewedAudition, auditionSheetDesigns, reviewedAuditionPolicy, LANDMARK_COVERAGE_TOPOLOGY_VERSION, REFERENCE_QUALIFICATION_VERSION, type ScenePreservationRun, type SavedPage } from './simple-book-reviewed-audition';
import { SCENE_PRESERVATION_VERSION, SCENE_PRESERVATION_MODE } from './scene-preservation';
import { COMPANION_SCALE_SAMPLE_GATE, COMPANION_SCALE_VERSION } from './companion-scale';
import { INSTANCE_DISTINCTION_VERSION } from './storyboard-instance-distinction';
import { ENTITY_MATERIAL_FUNCTION_VERSION } from './storyboard-material-function';
import { trialPageRenderEvidence } from './native-page-render-evidence';
import { nativePageProofSteps, NATIVE_BOOK_FRAMES, NATIVE_BOOK_PAGE_ATTEMPTS, NATIVE_BOOK_REVIEW_REASKS } from './native-page-proof';
type Input=Pick<Parameters<typeof illustrateReviewedAudition>[0],
  'book'|'rawReview'|'texts'|'current'|'child'|'companion'|'companionDescription'|'render'|'judge'|'identity'|'check'|'save'|'progress'|'reuseSheets'|'typedCorrections'>&{pages:readonly number[]};
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
const keys=new Set(['book','rawReview','texts','current','child','companion','companionDescription','render','judge','identity','check','save','progress','reuseSheets','pages','typedCorrections']);
const nativeSource=(args:Input)=>args.book?.instanceDistinction?.version===INSTANCE_DISTINCTION_VERSION&&args.book?.materialFunction?.version===ENTITY_MATERIAL_FUNCTION_VERSION&&
  args.book?.companionScale?.version===COMPANION_SCALE_VERSION&&!!args.reuseSheets?.entities&&!!args.reuseSheets?.locations;
/** Every paid step is one of the allowlist, used once, of its own kind; the engine's own attempt loop decides which are reached.
 *  `terminalRender`: a rejected render ends the run with its original error (the engine's attempt step rechecks `check` in its catch), so a
 *  later attempt only ever corrects a reviewed image and never re-buys a failed call. */
function fencedFrames(args:Input,attempts:number,options:{sample?:readonly number[];sampleScaleGate?:typeof COMPANION_SCALE_SAMPLE_GATE;reviewReask?:true;scenePreservation?:ScenePreservationRun},terminalRender=false,resumePages?:Partial<Record<number,SavedPage>>){
  const pages=[...args.pages],allowed=new Set(nativePageProofSteps(pages,attempts,options.reviewReask===true)),used=new Set<string>();
  let renderFailed=false,renderFailure:unknown,reasks=Object.values(resumePages??{}).reduce((n,p)=>n+(p?.attempts.filter(a=>a.reviewReask!==undefined).length??0),0);
  if(reasks>NATIVE_BOOK_REVIEW_REASKS)fail('audition_call_limit');
  const check=()=>{if(renderFailed)throw renderFailure;args.check();};
  const begin=(step:string,kind:'render'|'review'|'identity')=>{
    if(!allowed.has(step)||used.has(step)||kind==='render'&&!/^page_[0-8]_[0-2]$/.test(step)||kind==='review'&&!/_qa2?$/.test(step)||kind==='identity'&&!step.endsWith('_identity'))fail('page_proof_step');
    check();
    // The owner's re-ask allowance is its own book-wide count, independent of the call and USD limits; past it the run ends (fatal code).
    if(kind==='review'&&step.endsWith('_qa2')){if(reasks>=NATIVE_BOOK_REVIEW_REASKS)fail('audition_call_limit');reasks++;}
    used.add(step);
  };
  const observed=trialPageRenderEvidence(args.render,args.save);
  return illustrateReviewedAudition({...args,check,pages,...options,pageAttempts:attempts,
    ...(resumePages?{resume:{designs:{policy:reviewedAuditionPolicy(undefined,true,LANDMARK_COVERAGE_TOPOLOGY_VERSION,true),designs:auditionSheetDesigns(args.book,args.texts)},
      sheets:{},pages:resumePages,stepPrefix:'',durable:{version:'native-order-checkpoint/v1' as const,requestId:args.book.requestId,storyboardDigest:args.book.storyboardDigest}}}:{}),
    structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,referenceQualification:REFERENCE_QUALIFICATION_VERSION,
    render:async(...a)=>{begin(a[0],'render');let v;try{v=await observed(...a);}catch(error){if(terminalRender&&!renderFailed){renderFailed=true;renderFailure=error;}throw error;}check();return v;},
    judge:async(...a)=>{if(a[6]!=='page')fail('page_proof_step');begin(a[0],'review');const v=await args.judge(...a);check();return v;},
    identity:async(...a)=>{begin(a[0],'identity');const v=await args.identity(...a);check();return v;}});
}
/** Explicit page-only boundary. No full-native guard/default changes and no authority granted by this composable engine primitive. */
export async function runNativePageProofFrames(args:Input){
  if(!args||Object.keys(args).some(k=>!keys.has(k))||!Array.isArray(args.pages)||args.pages.length<1||args.pages.length>2||
    args.pages.some((n,i)=>!Number.isInteger(n)||n<1||n>8||i>0&&n<=args.pages[i-1])||!nativeSource(args))fail('page_proof_scope');
  return fencedFrames(args,1,{sample:[...args.pages],sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE});
}
/** The whole native book: the fixed cover + 8 frames, no sample stop, the engine's bounded correction ceiling per frame, and one
 *  identical re-ask of an unusable review answer per image (a structural slip in one answer is not a reason to end a whole book). */
export async function runNativeBookFrames(args:Input&{resumePages?:Partial<Record<number,SavedPage>>}){
  if(!args)fail('page_proof_scope');
  const {resumePages,...base}=args;
  if(!args||Object.keys(base).some(k=>!keys.has(k))||!Array.isArray(args.pages)||JSON.stringify(args.pages)!==JSON.stringify(NATIVE_BOOK_FRAMES)||!nativeSource(args))fail('page_proof_scope');
  if(resumePages&&(Object.keys(resumePages).map(Number).sort((a,b)=>a-b).some((n,i)=>n!==i)||Object.values(resumePages).some(p=>!p||p.status!=='qa_supported')))fail('page_proof_scope');
  return fencedFrames(base,NATIVE_BOOK_PAGE_ATTEMPTS,{reviewReask:true},true,resumePages);
}
/**
 * native-cde-book/v2: the whole book with scene-preservation/v1 (same frames, attempts, latch, re-ask fence and allowlist as v1). Its input
 * mode is the offline proof only; the real runner refuses v2 before any claim until a qualified mapping/content source exists.
 */
export async function runNativeSceneBookFrames(args:Input&{scenePreservation:ScenePreservationRun}){
  const {scenePreservation,...rest}=args;
  if(!scenePreservation||scenePreservation.version!==SCENE_PRESERVATION_VERSION||scenePreservation.mode!==SCENE_PRESERVATION_MODE)fail('page_proof_scope');
  if(!rest||Object.keys(rest).some(k=>!keys.has(k))||!Array.isArray(rest.pages)||JSON.stringify(rest.pages)!==JSON.stringify(NATIVE_BOOK_FRAMES)||!nativeSource(rest))fail('page_proof_scope');
  return fencedFrames(rest,NATIVE_BOOK_PAGE_ATTEMPTS,{reviewReask:true,scenePreservation},true);
}
/** Real source/reference preflight: virtual saves only; every provider-shaped callback denied, sentinel at the first admitted page. */
export async function preflightNativePageProofFrames(args:Omit<Input,'render'|'judge'|'identity'|'save'|'progress'>){
  const sentinel=Object.assign(new Error('page_proof_preflight_boundary'),{code:'audition_cancelled'});let boundary=false;
  try{await runNativePageProofFrames({...args,save:()=>{},render:async step=>{if(step!=='page_'+args.pages[0]+'_0')fail('page_proof_preflight_scope');boundary=true;throw sentinel;},
    judge:async()=>fail('page_proof_preflight_provider'),identity:async()=>fail('page_proof_preflight_provider')});}
  catch(error){if(error!==sentinel)throw error;if(boundary){args.check();return;}}
  fail('page_proof_preflight_scope');
}
/** Book preflight: the whole-book admission up to the cover's first render, then every story page's own context through the page preflight. */
export async function preflightNativeBookFrames(args:Omit<Input,'render'|'judge'|'identity'|'save'|'progress'>){
  const sentinel=Object.assign(new Error('page_proof_preflight_boundary'),{code:'audition_cancelled'});let boundary=false;
  try{await runNativeBookFrames({...args,save:()=>{},render:async step=>{if(step!=='page_0_0')fail('page_proof_preflight_scope');boundary=true;throw sentinel;},
    judge:async()=>fail('page_proof_preflight_provider'),identity:async()=>fail('page_proof_preflight_provider')});}
  catch(error){if(error!==sentinel)throw error;}
  if(!boundary)fail('page_proof_preflight_scope');args.check();
  for(const page of NATIVE_BOOK_FRAMES.filter(n=>n>0))await preflightNativePageProofFrames({...args,pages:[page]});
}
