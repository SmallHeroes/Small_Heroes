import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { planPageChildResemblanceVisionRequest,evaluatePageChildResemblanceVision } from '@/lib/generation-pipeline/page-child-resemblance-vision';
import { engineSiteFail,type EngineOrderAuthority } from './contract';
import type { PreparedEngineCall,EngineProviderResult } from './durable-worker';
import type { EngineProviderPorts } from './provider-plans';
import { COMPARISON_MODELS,COMPARISON_RESERVES } from './image-comparison';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const data=(b:Buffer)=>'data:image/png;base64,'+b.toString('base64');
export type ComparisonImageInput={model:typeof COMPARISON_MODELS[number];prompt:string;references:readonly Buffer[]};
const safeJson=async(r:Response)=>{const text=await r.text();try{return JSON.parse(text);}catch{return{unparseableBody:text,httpStatus:r.status};}};
function slot(a:EngineOrderAuthority,step:string,maximum:number){const s=a.budget.steps.find(s=>s.id===step);if(a.purpose!=='test'||a.imageQuality!=='low'||s?.maximumMicroUsd!==maximum)engineSiteFail('comparison_slot');}
export function prepareComparisonImage(a:EngineOrderAuthority,step:string,input:ComparisonImageInput,ports:EngineProviderPorts):PreparedEngineCall{
 slot(a,step,COMPARISON_RESERVES.image);
 if(!COMPARISON_MODELS.includes(input.model)||!input.prompt||Buffer.byteLength(input.prompt)>96000||input.references.length!==4)engineSiteFail('comparison_image_input');
 const model=input.model,refs=input.references.map(b=>Buffer.from(b)),body={model,prompt:input.prompt,size:'1024x1536',quality:'low',n:1,complexity:'high',output_format:'png'};
 const wire={version:'image-comparison-edit/v1',authoritySha256:canonicalHash(a),step,endpoint:'https://api.openai.com/v1/images/edits',body,references:refs.map(sha),maxRetries:0};
 const call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:COMPARISON_RESERVES.image};
 const revalidate=()=>{if(canonicalHash(wire)!==call.wireSha256)engineSiteFail('comparison_image_wire_changed');};
 const result=async(raw:any,ok:boolean,requestId:string|null,latencyMs:number):Promise<EngineProviderResult>=>{
  const usage=raw?.usage,cost=auditionUsageCost(usage,'image');
  // Images API documents model as optional. Never invent a provider model echo from our request.
  const reportedModel=typeof raw?.model==='string'?raw.model:null,modelMatches=reportedModel===null||reportedModel===model;
  const b=typeof raw?.data?.[0]?.b64_json==='string'?Buffer.from(raw.data[0].b64_json,'base64'):null;
  let valid=false;if(b&&b.length<=20_000_000)try{const m=await sharp(b).metadata();valid=m.format==='png'&&m.width===1024&&m.height===1536;}catch{/* Exact raw reply is retained as unusable. */}
  const usable=ok&&raw?.data?.length===1&&valid&&modelMatches&&cost!==null&&usage.output_tokens<=8192&&usage.input_tokens<=Buffer.byteLength(body.prompt)+4*8192&&Number.isSafeInteger(usage?.total_tokens)&&usage.total_tokens===usage.input_tokens+usage.output_tokens;
  return {raw,output:b?{b64:b.toString('base64'),imageSha:sha(b),requestedModel:model,reportedModel,modelEvidence:reportedModel?'response_reported':'request_bound_only',requestId,latencyMs}:null,
   estimatedMicroUsd:usable?cost:cost!==null&&cost>call.maximumMicroUsd?cost:null,usable,...(reportedModel?{model:reportedModel}:{})};
 };
 return {wire,call,requiredMs:180000,completionDeadlineMs:180000,revalidate,
  async execute(pending,signal,assertDispatch){
   if(pending)engineSiteFail('comparison_image_no_resume');
   const form=new FormData();for(const[k,v]of Object.entries(body))form.set(k,String(v));
   refs.forEach((b,i)=>form.append('image[]',new Blob([new Uint8Array(b)],{type:'image/png'}),'reference_'+i+'.png'));
   await assertDispatch();revalidate();const start=Date.now();
   const response=await ports.fetch(wire.endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+ports.openAIKey()},body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
   const raw=await safeJson(response);
   return{kind:'completed',result:await result(raw,response.ok,response.headers.get('x-request-id'),Date.now()-start)};
  },
  async admitSaved(saved){
   revalidate();
   const out=saved.output as any;
   const again=await result(saved.raw,saved.usable===true,out?.requestId??null,out?.latencyMs??0);
   if(!again.usable||canonicalHash(again)!==canonicalHash(saved))engineSiteFail('comparison_image_saved_invalid');
  }};
}
export function prepareComparisonIdentity(a:EngineOrderAuthority,step:string,reference:Buffer,candidate:Buffer,ports:EngineProviderPorts):PreparedEngineCall{
 slot(a,step,COMPARISON_RESERVES.identity);
 const body=planPageChildResemblanceVisionRequest(data(reference),data(candidate),'gpt-4o');
 const wire={version:'image-comparison-identity/v1',authoritySha256:canonicalHash(a),step,body,maxRetries:0},call={step,wireSha256:canonicalHash(wire),maximumMicroUsd:COMPARISON_RESERVES.identity};
 const decode=async(raw:any,status:number)=>{
  const cost=['gpt-4o','gpt-4o-2024-08-06','gpt-4o-2024-11-20'].includes(raw?.model)&&raw?.usage
   ?auditionUsageCost({input_tokens:raw.usage.prompt_tokens,output_tokens:raw.usage.completion_tokens},'identity'):null;
  const output=await evaluatePageChildResemblanceVision({referenceImageUrl:data(reference),candidateImageUrl:data(candidate),threshold:.70,model:'gpt-4o',maxRetries:0,apiKey:'SAVED_RESPONSE_REPLAY',
   fetchImpl:async()=>new Response(JSON.stringify(raw),{status})});
  return{output,raw,estimatedMicroUsd:cost,usable:status>=200&&status<300&&cost!==null&&raw.usage.completion_tokens<=180} satisfies EngineProviderResult;
 };
 return{wire,call,requiredMs:60000,revalidate(){if(canonicalHash(wire)!==call.wireSha256)engineSiteFail('comparison_identity_wire_changed');},
  async execute(pending,signal,assertDispatch){if(pending)engineSiteFail('comparison_identity_no_resume');await assertDispatch();
   const r=await ports.fetch('https://api.openai.com/v1/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+ports.openAIKey(),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
   return{kind:'completed',result:await decode(await safeJson(r),r.status)};},
  async admitSaved(saved){const again=await decode(saved.raw,200);if(!again.usable||canonicalHash(again)!==canonicalHash(saved))engineSiteFail('comparison_identity_saved_invalid');}};
}
