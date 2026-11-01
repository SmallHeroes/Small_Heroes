import 'server-only';
import { illustrateReviewedAudition, LANDMARK_COVERAGE_TOPOLOGY_VERSION, REFERENCE_QUALIFICATION_VERSION } from './simple-book-reviewed-audition';
import { COMPANION_SCALE_SAMPLE_GATE, COMPANION_SCALE_VERSION } from './companion-scale';
import { INSTANCE_DISTINCTION_VERSION } from './storyboard-instance-distinction';
import { ENTITY_MATERIAL_FUNCTION_VERSION } from './storyboard-material-function';
import { trialPageRenderEvidence } from './native-page-render-evidence';
import { nativePageProofSteps } from './native-page-proof';
type Input=Pick<Parameters<typeof illustrateReviewedAudition>[0],
  'book'|'rawReview'|'texts'|'current'|'child'|'companion'|'companionDescription'|'render'|'judge'|'identity'|'check'|'save'|'progress'|'reuseSheets'>&{pages:readonly number[]};
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
/** Explicit page-only boundary. No full-native guard/default changes and no authority granted by this composable engine primitive. */
export async function runNativePageProofFrames(args:Input){
  const keys=new Set(['book','rawReview','texts','current','child','companion','companionDescription','render','judge','identity','check','save','progress','reuseSheets','pages']);
  if(!args||Object.keys(args).some(k=>!keys.has(k))||!Array.isArray(args.pages)||args.pages.length<1||args.pages.length>2||
    args.pages.some((n,i)=>!Number.isInteger(n)||n<1||n>8||i>0&&n<=args.pages[i-1])||
    args.book?.instanceDistinction?.version!==INSTANCE_DISTINCTION_VERSION||args.book?.materialFunction?.version!==ENTITY_MATERIAL_FUNCTION_VERSION||
    args.book?.companionScale?.version!==COMPANION_SCALE_VERSION||!args.reuseSheets?.entities||!args.reuseSheets?.locations)fail('page_proof_scope');
  const pages=[...args.pages],allowed=new Set(nativePageProofSteps(pages)),used=new Set<string>();
  const begin=(step:string,kind:'render'|'review'|'identity')=>{
    if(!allowed.has(step)||used.has(step)||kind==='render'&&!/^page_[1-8]_0$/.test(step)||kind==='review'&&!step.endsWith('_qa')||kind==='identity'&&!step.endsWith('_identity'))fail('page_proof_step');
    args.check();used.add(step);
  };
  const observed=trialPageRenderEvidence(args.render,args.save);
  return illustrateReviewedAudition({...args,pages,sample:pages,sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE,pageAttempts:1,
    structuralAnatomy:true,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,referenceQualification:REFERENCE_QUALIFICATION_VERSION,
    render:async(...a)=>{begin(a[0],'render');const v=await observed(...a);args.check();return v;},
    judge:async(...a)=>{if(a[6]!=='page')fail('page_proof_step');begin(a[0],'review');const v=await args.judge(...a);args.check();return v;},
    identity:async(...a)=>{begin(a[0],'identity');const v=await args.identity(...a);args.check();return v;}});
}
/** Real source/reference preflight: virtual saves only; every provider-shaped callback denied, sentinel at the first admitted page. */
export async function preflightNativePageProofFrames(args:Omit<Input,'render'|'judge'|'identity'|'save'|'progress'>){
  const sentinel=Object.assign(new Error('page_proof_preflight_boundary'),{code:'audition_cancelled'});let boundary=false;
  try{await runNativePageProofFrames({...args,save:()=>{},render:async step=>{if(step!=='page_'+args.pages[0]+'_0')fail('page_proof_preflight_scope');boundary=true;throw sentinel;},
    judge:async()=>fail('page_proof_preflight_provider'),identity:async()=>fail('page_proof_preflight_provider')});}
  catch(error){if(error!==sentinel)throw error;if(boundary){args.check();return;}}
  fail('page_proof_preflight_scope');
}
