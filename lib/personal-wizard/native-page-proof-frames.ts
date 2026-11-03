import 'server-only';
import { illustrateReviewedAudition, LANDMARK_COVERAGE_TOPOLOGY_VERSION, REFERENCE_QUALIFICATION_VERSION } from './simple-book-reviewed-audition';
import { COMPANION_SCALE_SAMPLE_GATE, COMPANION_SCALE_VERSION } from './companion-scale';
import { INSTANCE_DISTINCTION_VERSION } from './storyboard-instance-distinction';
import { ENTITY_MATERIAL_FUNCTION_VERSION } from './storyboard-material-function';
import { trialPageRenderEvidence } from './native-page-render-evidence';
import { nativePageProofSteps, NATIVE_BOOK_FRAMES, NATIVE_BOOK_PAGE_ATTEMPTS } from './native-page-proof';
type Input=Pick<Parameters<typeof illustrateReviewedAudition>[0],
  'book'|'rawReview'|'texts'|'current'|'child'|'companion'|'companionDescription'|'render'|'judge'|'identity'|'check'|'save'|'progress'|'reuseSheets'>&{pages:readonly number[]};
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
const keys=new Set(['book','rawReview','texts','current','child','companion','companionDescription','render','judge','identity','check','save','progress','reuseSheets','pages']);
const nativeSource=(args:Input)=>args.book?.instanceDistinction?.version===INSTANCE_DISTINCTION_VERSION&&args.book?.materialFunction?.version===ENTITY_MATERIAL_FUNCTION_VERSION&&
  args.book?.companionScale?.version===COMPANION_SCALE_VERSION&&!!args.reuseSheets?.entities&&!!args.reuseSheets?.locations;
/** Every paid step is one of the allowlist, used once, of its own kind; the engine's own attempt loop decides which are reached. */
function fencedFrames(args:Input,attempts:number,options:{sample?:readonly number[];sampleScaleGate?:typeof COMPANION_SCALE_SAMPLE_GATE}){
  const pages=[...args.pages],allowed=new Set(nativePageProofSteps(pages,attempts)),used=new Set<string>();
  const begin=(step:string,kind:'render'|'review'|'identity')=>{
    if(!allowed.has(step)||used.has(step)||kind==='render'&&!/^page_[0-8]_[0-2]$/.test(step)||kind==='review'&&!step.endsWith('_qa')||kind==='identity'&&!step.endsWith('_identity'))fail('page_proof_step');
    args.check();used.add(step);
  };
  const observed=trialPageRenderEvidence(args.render,args.save);
  return illustrateReviewedAudition({...args,pages,...options,pageAttempts:attempts,
    structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,referenceQualification:REFERENCE_QUALIFICATION_VERSION,
    render:async(...a)=>{begin(a[0],'render');const v=await observed(...a);args.check();return v;},
    judge:async(...a)=>{if(a[6]!=='page')fail('page_proof_step');begin(a[0],'review');const v=await args.judge(...a);args.check();return v;},
    identity:async(...a)=>{begin(a[0],'identity');const v=await args.identity(...a);args.check();return v;}});
}
/** Explicit page-only boundary. No full-native guard/default changes and no authority granted by this composable engine primitive. */
export async function runNativePageProofFrames(args:Input){
  if(!args||Object.keys(args).some(k=>!keys.has(k))||!Array.isArray(args.pages)||args.pages.length<1||args.pages.length>2||
    args.pages.some((n,i)=>!Number.isInteger(n)||n<1||n>8||i>0&&n<=args.pages[i-1])||!nativeSource(args))fail('page_proof_scope');
  return fencedFrames(args,1,{sample:[...args.pages],sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE});
}
/** The whole native book: the fixed cover + 8 frames, no sample stop, the engine's bounded correction ceiling per frame. */
export async function runNativeBookFrames(args:Input){
  if(!args||Object.keys(args).some(k=>!keys.has(k))||!Array.isArray(args.pages)||JSON.stringify(args.pages)!==JSON.stringify(NATIVE_BOOK_FRAMES)||!nativeSource(args))fail('page_proof_scope');
  return fencedFrames(args,NATIVE_BOOK_PAGE_ATTEMPTS,{});
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
