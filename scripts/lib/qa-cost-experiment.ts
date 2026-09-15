// Experimental request builder only; no import from active generation paths.
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { PreviewPlan, previewCheckpoint, previewSha } from '../../lib/local-story-preview';
import { ANATOMY_INSPECTION_INSTRUCTION, anatomyInspectionSchema, PREVIEW_JUDGE_INSTRUCTION,
  PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, PREVIEW_QUALITY_VERSION, previewQualityReviewSchema,
  previewContinuityContext, qualityDisposition } from '../../lib/local-preview-quality';

export const EXPERIMENT_VERSION = 'qa-cost-flex-compact/v1';
export const COMPACT_INSTRUCTION = PREVIEW_JUDGE_INSTRUCTION + '\nREPORT LENGTH: Keep each passing observation to one short evidence phrase, ideally under140characters. For defects/uncertainties give a concise location and evidence, ideally under400characters, and a specific correction. Still inspect EVERY category and all people; brevity applies to the report, not inspection. The page plan is projected from a validated full book plan with resolved current states and canonical inventory. Do not infer missing future scenes.';
type Content = OpenAI.Responses.ResponseInputContent;
export type Request = OpenAI.Responses.ResponseCreateParamsNonStreaming;
export function compactContext(plan: PreviewPlan, pageNumber: number, text: string, priorPages: unknown[]) {
  if (!plan.continuity || plan.pages[pageNumber]?.pageNumber !== pageNumber) throw Error('experiment_page_binding');
  return { pageNumber, text, wardrobe: plan.wardrobe, visualLanguage: plan.visualLanguage,
    canonicalProps: plan.recurringProps, canonicalLocations: plan.locations,
    canonicalEntities: plan.continuity.entities,
    currentPage: plan.pages[pageNumber], currentState: previewContinuityContext(plan.continuity, pageNumber),
    cameraSequence: plan.pages.map(p => ({ pageNumber:p.pageNumber,shot:p.shot,angle:p.angle,locationId:p.locationId })),
    priorPages, calibrationStatus:'not_established',purpose:'diagnostic_only' };
}
export const inputImage = (bytes: Buffer): Content => ({ type:'input_image',image_url:`data:image/png;base64,${bytes.toString('base64')}`,detail:'high' });
export async function candidateViews(bytes: Buffer): Promise<Content[]> {
  const meta=await sharp(bytes).metadata();if(!meta.width||!meta.height)throw Error('experiment_dimensions');
  const content:Content[]=[{type:'input_text',text:'COMPLETE CANDIDATE'},inputImage(bytes)];
  const width=Math.ceil(meta.width*.65),height=Math.ceil(meta.height*.6);
  for(const [label,left,top] of [['top-left',0,0],['top-right',meta.width-width,0],['bottom-left',0,meta.height-height],['bottom-right',meta.width-width,meta.height-height]] as const){
    content.push({type:'input_text',text:`DETAIL ${label}, same candidate pixels`},inputImage(await sharp(bytes).extract({left,top,width,height}).png().toBuffer()));
  }return content;
}
const base = { model:PREVIEW_JUDGE_MODEL,reasoning:{effort:PREVIEW_JUDGE_EFFORT},service_tier:'flex',store:false,stream:false } as const;
export function anatomyRequest(views:Content[]):Request {
  return {...base,instructions:ANATOMY_INSPECTION_INSTRUCTION,input:[{role:'user',content:views}],max_output_tokens:10000,text:{format:zodTextFormat(anatomyInspectionSchema,'anatomy_inspection')}};
}
export function contextualRequest(args:{arm:'control'|'compact';views:Content[];references:{role:string;sha:string;bytes:Buffer}[];anatomy:unknown;candidateSha:string;context:unknown}) {
  if(args.references.length>6)throw Error('experiment_reference_limit');
  const contextSha=previewSha(JSON.stringify({version:PREVIEW_QUALITY_VERSION,context:args.context}));
  const instruction=args.arm==='control'?PREVIEW_JUDGE_INSTRUCTION:COMPACT_INSTRUCTION;
  const input={version:PREVIEW_QUALITY_VERSION,instruction,anatomy:args.anatomy,candidateSha:args.candidateSha,contextSha,context:args.context,
    references:args.references.map(({role,sha})=>({role,sha})),model:PREVIEW_JUDGE_MODEL,effort:PREVIEW_JUDGE_EFFORT,maxOutputTokens:4500};
  if(JSON.stringify(input).length>50000)throw Error('experiment_text_limit');
  const refs:Content[]=args.references.flatMap(r=>[{type:'input_text',text:`REFERENCE ONLY: ${r.role}`} as Content,inputImage(r.bytes)]);
  const dynamic:Content={type:'input_text',text:JSON.stringify(input)};
  const content=args.arm==='control'?[dynamic,...refs,...args.views]:[...refs,dynamic,...args.views];
  return {contextSha,request:{...base,instructions:instruction,input:[{role:'user',content}],max_output_tokens:4500,
    text:{format:zodTextFormat(previewQualityReviewSchema,'preview_quality')}} as Request};
}
export function mergedDecision(raw:unknown,anatomy:ReturnType<typeof anatomyInspectionSchema.parse>,candidateSha:string,contextSha:string) {
  const review=previewQualityReviewSchema.parse(raw);
  // Validate binding/category coverage BEFORE applying blind-anatomy override.
  qualityDisposition(review,candidateSha,contextSha);
  if(anatomy.verdict!=='pass'){const check=review.checks.find(c=>c.category==='anatomy')!;Object.assign(check,{verdict:anatomy.verdict,observation:anatomy.observation,correction:anatomy.correction});}
  return qualityDisposition(review,candidateSha,contextSha);
}
export async function paidFlex(root:string,step:string,request:Request,apiKey:string) {
  if(request.model!=='gpt-5.5'||request.service_tier!=='flex'||request.reasoning?.effort!=='medium'||request.store!==false)throw Error('experiment_request_policy');
  const record=await previewCheckpoint({root,step,input:{version:EXPERIMENT_VERSION,requestSha:previewSha(JSON.stringify(request))},reserveUsd:1,budgetUsd:8,
    produce:async()=>{
      let dispatched=false;const start=Date.now();
      const client=new OpenAI({apiKey,baseURL:'https://api.openai.com/v1',maxRetries:0,timeout:900000,
        fetch:async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
          if(dispatched||url.origin!=='https://api.openai.com'||url.pathname!=='/v1/responses')throw Error('experiment_dispatch_fence');
          dispatched=true;return fetch(input,{...init,redirect:'error'});
        }});
      const response=await client.responses.create(request);
      return {value:{status:response.status,text:response.output_text,model:response.model,serviceTier:response.service_tier,
        responseId:response.id,incompleteDetails:response.incomplete_details,durationMs:Date.now()-start},usage:response.usage as unknown as Record<string,unknown>};
    }});
  if(record.value.serviceTier!=='flex')throw Error('experiment_served_tier_mismatch');
  if(record.value.model!=='gpt-5.5'&&!record.value.model.startsWith('gpt-5.5-'))throw Error('experiment_served_model_mismatch');
  return record;
}
