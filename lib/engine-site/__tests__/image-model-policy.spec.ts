import {describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {canonicalHash} from '@/lib/canonical-json';
import {planGPTImageRequest,type GenerateGPTImageInput} from '@/lib/generate-image';
import {authority} from './fixtures';
import {engineOrderAuthoritySchema,type EngineOrderAuthority} from '../contract';
import {engineRecipeSteps} from '../platform-policy';
import {ENGINE_IMAGE26_POLICY} from '../image-model-policy';
import {prepareEngineImage,type EngineProviderPorts} from '../provider-plans';

const selected=(model:'gpt-image-2.6-sunburst'|'gpt-image-2.6-flare'='gpt-image-2.6-sunburst'):EngineOrderAuthority=>{
 const a=authority();return {...a,purpose:'test',imageModelPolicy:{version:ENGINE_IMAGE26_POLICY,model,complexity:'high'},budget:{...a.budget,maximumMicroUsd:12_000_000,maximumCalls:121,steps:engineRecipeSteps()}};
};
const denied=()=>{throw Error('unexpected_provider_or_key');};
const noPorts:EngineProviderPorts={fetch:denied as any,openAIKey:denied,anthropicKey:denied,image:denied as any};
const png=()=>sharp({create:{width:1024,height:1536,channels:3,background:'#456789'}}).png().toBuffer();
async function synthetic(rawPatch:Record<string,unknown>={},override?:Partial<GenerateGPTImageInput>,sdkUsage?:Record<string,number>){
 const bytes=await png(),raw={data:[{b64_json:bytes.toString('base64')}],usage:{input_tokens:100,output_tokens:100},...rawPatch};
 const image=vi.fn(async(input:GenerateGPTImageInput)=>{await input.assertBeforeProviderDispatch?.();input.observeProviderResponse?.(raw);
  return {buffer:bytes,model:input.modelOverride!,finalPrompt:input.finalPrompt,hasReferencePhoto:false,apiMode:'images.generate' as const,referenceCountRequested:0,referenceCountPassed:0,durationMs:1,usage:sdkUsage??raw.usage as any,fallbackUsed:false};});
 const plan=prepareEngineImage(selected(),'page_0_0',{finalPrompt:'Synthetic scene',...override},{...noPorts,openAIKey:()=> 'SYNTHETIC_ONLY',image});
 const answer=await plan.execute(undefined,new AbortController().signal,async()=>{});
 if(answer.kind!=='completed')throw Error('synthetic_answer');return{plan,answer,image,raw,bytes};
}
describe('explicit Image2.6 full-book model policy, no live providers',()=>{
 it.each(['gpt-image-2.6-sunburst','gpt-image-2.6-flare'] as const)('binds %s to source authority, complete wire and all reference/page roles',model=>{
  const a=selected(model);for(const step of ['reference_child','page_0_0','page_7_0']){
   const b=Buffer.from('SYNTHETIC_REFERENCE'),plan=prepareEngineImage(a,step,{finalPrompt:'Synthetic',referenceImages:['data:image/png;base64,Uw=='],exactReferenceBytes:[b],requireReferenceEdit:true},noPorts);
   expect(plan.wire).toMatchObject({version:'engine-site-image/v2',authoritySha256:canonicalHash(a),mode:'images.edit',body:{model,complexity:'high',quality:'low',n:1}});
   expect(canonicalHash(plan.wire)).toBe(plan.call.wireSha256);expect((plan.wire as any).references).toHaveLength(1);
  }
 });
 it('keeps absent-policy legacy authority and wire fields exact',()=>{
  const old={...selected(),imageModelPolicy:undefined};delete old.imageModelPolicy;
  const input={finalPrompt:'Synthetic'},plan=prepareEngineImage(old,'page_0_0',input,noPorts),expected=planGPTImageRequest({...input,quality:'low',modelOverride:'gpt-image-2',requestTimeoutMs:180000},{defaultModel:'gpt-image-2',defaultQuality:'low',maxReferences:4});
  expect(plan.wire).toEqual({version:'engine-site-image/v1',step:'page_0_0',authoritySha256:canonicalHash(old),mode:expected.apiMode,body:expected.bodyWithoutBinaryImage,references:[],maxRetries:0});
  expect((plan.wire as any).body).not.toHaveProperty('complexity');expect(engineOrderAuthoritySchema.parse(old)).not.toHaveProperty('imageModelPolicy');
 });
 it.each([{purpose:'customer'},{imageModelPolicy:{...selected().imageModelPolicy,model:'gpt-image-2'}},{imageModelPolicy:{...selected().imageModelPolicy,complexity:'extreme'}},{imageModelPolicy:{...selected().imageModelPolicy,version:'other'}}])('refuses unauthorized policy %j',patch=>{
  expect(()=>prepareEngineImage({...selected(),...patch} as any,'page_0_0',{finalPrompt:'Synthetic'},noPorts)).toThrow();
 });
 it('rejects caller complexity/quality/key overrides and insufficient actual full-prompt reserve',()=>{
  for(const patch of [{complexity:'low'},{quality:'medium'},{apiKey:'SYNTHETIC_FORBIDDEN'}])expect(()=>prepareEngineImage(selected(),'page_0_0',{finalPrompt:'Synthetic',...patch} as any,noPorts)).toThrow('authority_mismatch');
  const a=selected();a.budget.steps=[{id:'page_0_0',maximumMicroUsd:1}];expect(()=>prepareEngineImage(a,'page_0_0',{finalPrompt:'Synthetic'},noPorts)).toThrow('reserve_insufficient');
 });
 it('makes complexity available only on explicit 2.6 models in the real request planner',()=>{
  const base={defaultQuality:'low' as const,defaultModel:'gpt-image-2',maxReferences:4};
  expect(()=>planGPTImageRequest({finalPrompt:'Synthetic',complexity:'high'},base)).toThrow('complexity');
  expect(planGPTImageRequest({finalPrompt:'Synthetic',modelOverride:'gpt-image-2.6-sunburst',complexity:'high'},base).bodyWithoutBinaryImage).toMatchObject({complexity:'high'});
 });
 it('sends the bound model once and records missing optional model echo honestly',async()=>{
  const {plan,answer,image}=await synthetic();expect(image).toHaveBeenCalledTimes(1);expect(image.mock.calls[0][0]).toMatchObject({modelOverride:'gpt-image-2.6-sunburst',complexity:'high',quality:'low'});
  expect(answer.result).toMatchObject({usable:true,model:'gpt-image-2.6-sunburst',estimatedMicroUsd:3800,output:{requestedModel:'gpt-image-2.6-sunburst',reportedModel:null,modelEvidence:'request_bound_only'}});
  expect(()=>plan.admitSaved!(answer.result)).not.toThrow();
  expect(()=>plan.admitSaved!({...answer.result,output:{...answer.result.output as any,modelEvidence:'response_reported'}})).toThrow('saved_image_invalid');
 });
 it('preserves a genuine matching provider echo',async()=>{
  const {plan,answer}=await synthetic({model:'gpt-image-2.6-sunburst'});expect(answer.result).toMatchObject({usable:true,output:{reportedModel:'gpt-image-2.6-sunburst',modelEvidence:'response_reported'}});expect(()=>plan.admitSaved!(answer.result)).not.toThrow();
 });
 it.each([{model:'gpt-image-2.6-flare'},{usage:{model:'gpt-image-2',input_tokens:100,output_tokens:100}},{model:123},{usage:null}])('retains unknown cost for wrong model/missing usage %j',async patch=>{
  const {plan,answer,image}=await synthetic(patch);expect(answer.result.usable).toBe(false);expect(answer.result.estimatedMicroUsd).toBeNull();expect(image).toHaveBeenCalledTimes(1);expect(()=>plan.admitSaved!(answer.result)).toThrow();
 });
 it('keeps known paid cost on an invalid returned image and never silently accepts it',async()=>{
  const {answer}=await synthetic({data:[]});expect(answer.result).toMatchObject({usable:false,estimatedMicroUsd:3800});
 });
 it('does not clamp a known over-reserve cost',async()=>{
  const {answer}=await synthetic({usage:{input_tokens:0,output_tokens:100000}});expect(answer.result.estimatedMicroUsd).toBe(3_000_000);
 });
 it('prices the preserved raw receipt rather than a conflicting SDK projection',async()=>{
  const {plan,answer}=await synthetic({},undefined,{input_tokens:1,output_tokens:1});expect(answer.result.estimatedMicroUsd).toBe(3800);expect(()=>plan.admitSaved!(answer.result)).not.toThrow();
 });
 it('checks changed wire and the external dispatch fence before the single provider invocation',async()=>{
  const image=vi.fn(),plan=prepareEngineImage(selected(),'page_0_0',{finalPrompt:'Synthetic'},{...noPorts,image});
  await expect(plan.execute(undefined,new AbortController().signal,async()=>{throw Error('lease_lost');})).rejects.toThrow('lease_lost');expect(image).not.toHaveBeenCalled();
  (plan.wire as any).body.complexity='low';await expect(plan.execute(undefined,new AbortController().signal,async()=>{})).rejects.toThrow('plan_changed');expect(image).not.toHaveBeenCalled();
 });
});
