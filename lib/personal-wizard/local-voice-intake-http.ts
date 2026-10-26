import 'server-only';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveMomentumBookSettings, momentumBookConfig } from './momentum-book-bridge';
import { localVoiceConfigured, authorizeLocalVoice, LocalVoiceError } from './local-voice-intake-evidence';
import { NO_STORE, readBodyWithLimit } from './intake-gate';
import { LIMITS } from './contract';
import { enforceRateLimit } from '../request-security';

export const localVoiceResponse = (error:unknown) => {
  const code=error instanceof LocalVoiceError ? error.code : 'voice_unavailable';
  return NextResponse.json({error:code},{status:code==='voice_consumed'?409:code==='voice_origin'?403:503,headers:NO_STORE});
};
/** Undefined means not opted in. An invalid configured authority returns an error, never an auth fallback. */
type AllowedLocalVoice = ReturnType<typeof authorizeLocalVoice> & {config: ReturnType<typeof momentumBookConfig>; guard: (claimed?:boolean)=>void};
export function localVoiceAccess(req:NextRequest): AllowedLocalVoice | {error:NextResponse} | undefined {
  const settings=resolveMomentumBookSettings(); if(!settings) return undefined;
  try {
    const config=momentumBookConfig(settings.configFile); if(!localVoiceConfigured(config)) return undefined;
    const request={url:req.url,host:req.headers.get('host'),origin:req.headers.get('origin'),method:req.method};
    const admitted=authorizeLocalVoice(config,request);
    if(path.resolve(admitted.grant.sourceRoot)!==path.resolve(process.cwd()) ||
      path.resolve(admitted.grant.keyFile)!==path.resolve('C:/GNart/Work/Small_Heroes/.env.local')) throw new LocalVoiceError('voice_binding');
    return {config,...admitted,guard:(claimed=false)=>{authorizeLocalVoice(config,request,process.env,undefined,claimed);}};
  } catch(error) {return {error:localVoiceResponse(error)};}
}
export async function postLocalVoice(req:NextRequest, access:Exclude<ReturnType<typeof localVoiceAccess>,undefined|{error:NextResponse}>) {
  const limited=enforceRateLimit(req,{namespace:'dev-personal-wizard-local-voice',limit:4,windowMs:60000});if(limited)return limited;
  const length=Number(req.headers.get('content-length')??'NaN');
  if(Number.isFinite(length)&&length>LIMITS.recordingMaxBytes)return NextResponse.json({error:'too_large'},{status:413,headers:NO_STORE});
  const bytes=await readBodyWithLimit(req,LIMITS.recordingMaxBytes);
  if(!bytes)return NextResponse.json({error:'too_large'},{status:413,headers:NO_STORE});
  try {
    const [{runLocalVoiceIntake},{createOpenAiIntakeProvider},{measureAudioDuration},{resolvePersonalWizardOptions}]=await Promise.all([
      import('./local-voice-intake'),import('./intake-openai'),import('./audio-probe'),import('./options')]);
    const outcome=await runLocalVoiceIntake({...access,input:{jobId:req.headers.get('x-pw-job-id')??'',draftId:req.headers.get('x-pw-draft-id')??'',
        declaredType:req.headers.get('content-type')??'',bytes,signal:req.signal},
      measureAudio:(audio,container,maxDurationMs)=>measureAudioDuration(audio,container,{maxDurationMs}),topics:resolvePersonalWizardOptions().topics,
      provider:apiKey=>createOpenAiIntakeProvider({apiKey,transcribeModel:access.grant.transcribeModel,extractModel:access.grant.extractModel})});
    return outcome.ok?NextResponse.json(outcome.result,{headers:NO_STORE}):NextResponse.json({error:outcome.code},{status:outcome.status,headers:NO_STORE});
  } catch(error) {return localVoiceResponse(error);}
}
