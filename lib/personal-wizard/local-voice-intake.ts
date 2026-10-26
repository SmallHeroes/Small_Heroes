import 'server-only';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { AuditionMeter, keyReader, type MeterRule, type MeterRules } from '../../scripts/personal-simple-book-reviewed-audition';
import { exclusiveJson, fencedText } from '../../scripts/personal-causal-trial-journal';
import { momentumBookConfig, type MomentumWizardConfig } from './momentum-book-bridge';
import { IntakeLedger } from './intake-ledger';
import { runAudioIntake, type IntakeProvider, type IntakeServiceDeps } from './intake-service';
import { LOCAL_VOICE_VERSION, voiceDigest, voiceBytesDigest, voiceFiles, voiceFail,
  type LocalVoiceGrant, type LocalVoiceOutcome, settleLocalVoiceForBook, localVoiceGrantSchema, readVoiceJson } from './local-voice-intake-evidence';

/** Published Standard prices, verified 2026-10-26. An accounted conservative usage estimate, never a provider invoice.
 * No cached-input discount: the reservation/settlement includes the largest cache-write rate (0.25/M) and10% regional uplift.
 * Measured decoded audio duration is charged at0.0045/min. Missing extraction token usage is UNKNOWN and stops downstream.
 */
const extractionCost = (input: number, output: number) => Math.ceil((input * 275 + output * 550) / 1000);
const validN = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const steps = ['voice_transcribe','voice_extract'] as const;
export const localVoiceRules: MeterRules = step => {
  if (!steps.includes(step as typeof steps[number])) return undefined;
  const rule: MeterRule = {
    reserve(w) {
      if (!w || w.version !== LOCAL_VOICE_VERSION || w.step !== step || !/^[a-f0-9]{64}$/.test(w.grantSha256) ||
          !/^[a-f0-9]{64}$/.test(w.inputSha256) || !validN(w.inputBytes) || w.inputBytes < 1) return null;
      if (step === 'voice_transcribe') return w.model === 'gpt-transcribe' && validN(w.durationMs) && w.durationMs >= 250 && w.durationMs <= 91500
        ? Math.ceil(Math.ceil(w.durationMs/1000) * 4950 / 60) : null;
      return w.model === 'gpt-6-luna' && w.inputBytes <= 100000 && w.maxOutputTokens === 3000 ? extractionCost(w.inputBytes,3000) : null;
    },
    settle(w, r, completed) {
      const coherent = r?.version === LOCAL_VOICE_VERSION && r?.wireSha256 === voiceDigest(w) && r?.model === w.model &&
        /^[a-f0-9]{64}$/.test(r?.outputSha256 ?? '') && completed;
      const cost = !coherent ? null : step === 'voice_transcribe' ? Math.ceil(w.durationMs * 4950 / 60000)
        : validN(r.usage?.input_tokens) && validN(r.usage?.output_tokens) && r.usage.output_tokens <= 3000 && r.usage.input_tokens <= w.inputBytes
          ? extractionCost(r.usage.input_tokens,r.usage.output_tokens) : null;
      return { coherent: completed ? coherent : r === null, estimatedMicroUsd: cost };
    },
  };
  return rule;
};
export function localVoiceMeter(config: MomentumWizardConfig, grant: LocalVoiceGrant) {
  // Reservation is a sub-allocation of the already approved cap; no new budget authority.
  return new AuditionMeter(voiceFiles(config.runDirectory).meter,
    Math.min(grant.apiCapMicroUsd, grant.priorApiMicroUsd + grant.reservationMicroUsd), 2, grant.priorApiMicroUsd, 0, localVoiceRules);
}
export function localVoiceJournalDigest(directory: string) {
  return voiceDigest(readdirSync(directory).sort().map(name => [name,voiceBytesDigest(fencedText(path.join(directory,name),64000))]));
}
export async function runLocalVoiceIntake(args: {
  config: MomentumWizardConfig; grant: LocalVoiceGrant; grantSha256: string; guard: (claimed?: boolean) => void;
  input: { jobId: string; draftId: string; declaredType: string; bytes: Buffer; signal?: AbortSignal };
  measureAudio: IntakeServiceDeps['measureAudio']; topics: IntakeServiceDeps['topics'];
  provider: (key: string) => IntakeProvider; readKey?: () => string;
}) {
  const { config, grant, grantSha256, input } = args, files = voiceFiles(config.runDirectory);
  let measuredMs = 0, claimed = false;
  const preclaim = () => args.guard();
  const postclaim = () => {
    args.guard(true);
    if (existsSync(config.intakeFile) || existsSync(files.skipped) ||
        voiceBytesDigest(fencedText(files.grant,64000)) !== grantSha256) voiceFail('voice_binding');
  };
  class DurableVoiceLedger extends IntakeLedger {
    override begin(userId: string, jobId: string, reservedUsd: number, limits: { budgetUsd:number; maxJobs:number }) {
      preclaim();
      const permitted = super.begin(userId,jobId,reservedUsd,limits); if (!permitted.ok) return permitted;
      exclusiveJson(files.claim,{ version:LOCAL_VOICE_VERSION,grantSha256,configSha256:voiceDigest(config),jobId,draftId:input.draftId,
        audioSha256:voiceBytesDigest(input.bytes),audioBytes:input.bytes.length,durationMs:measuredMs });
      claimed = true; postclaim(); return permitted;
    }
  }
  const meter = localVoiceMeter(config,grant), ledger = new DurableVoiceLedger();
  const key = args.readKey ?? keyReader(grant.keyFile);
  const outcome = await runAudioIntake({ ledger,config:{transcribeModel:grant.transcribeModel,extractModel:grant.extractModel,
      budgetUsd:grant.reservationMicroUsd/1e6,maxJobs:1},topics:args.topics,
    measureAudio:async (...p) => { const r=await args.measureAudio(...p); if(r.ok) measuredMs=r.durationMs; return r; },
    createProvider: () => {
      const send = async <T extends {usage?: Record<string,number>|null}>(step:typeof steps[number],wire:Record<string,unknown>, run:(p:IntakeProvider)=>Promise<T>) => {
        postclaim();
        if (args.input.signal?.aborted) throw new Error('voice_client_aborted');
        const maximum=localVoiceRules(step)!.reserve(wire) ?? voiceFail('voice_cost');
        return meter.run(step,wire,maximum,async()=>{
          postclaim();
          // Only this claimed callback can call the original credential reader. Never an SDK retry, key/env copy or log.
          let value:T;
          try { value=await run(args.provider(key())); } catch { throw new Error('voice_provider_failed'); }
          const outputSha256=voiceDigest(value), receipt={version:LOCAL_VOICE_VERSION,wireSha256:voiceDigest(wire),model:wire.model,
            outputSha256,usage:step==='voice_extract'?{input_tokens:value.usage?.input_tokens,output_tokens:value.usage?.output_tokens}:null};
          const settled=localVoiceRules(step)!.settle(wire,receipt,true);
          return {value,receipt,estimatedMicroUsd:settled.estimatedMicroUsd};
        });
      };
      return {
        transcribe: p=>send('voice_transcribe',{version:LOCAL_VOICE_VERSION,step:'voice_transcribe',grantSha256,model:grant.transcribeModel,
          inputSha256:voiceBytesDigest(p.audio),inputBytes:p.audio.length,durationMs:measuredMs},provider=>provider.transcribe(p)),
        extract: p=>send('voice_extract',{version:LOCAL_VOICE_VERSION,step:'voice_extract',grantSha256,model:grant.extractModel,
          inputSha256:voiceDigest({instructions:p.instructions,userText:p.userText,schema:p.schema,maxOutputTokens:p.maxOutputTokens}),
          inputBytes:512+Buffer.byteLength(p.instructions)+Buffer.byteLength(p.userText)+Buffer.byteLength(JSON.stringify(p.schema)),
          maxOutputTokens:p.maxOutputTokens},provider=>provider.extract(p)),
      };
    },
  },{...input,userId:config.cycle});
  if(claimed) {
    const s=meter.snapshot();
    const record:LocalVoiceOutcome={version:LOCAL_VOICE_VERSION,grantSha256,claimSha256:voiceBytesDigest(fencedText(files.claim,64000)),ok:outcome.ok,
      resultSha256:outcome.ok?voiceDigest(outcome.result):null,calls:s.calls,knownMicroUsd:s.newKnownApiMicroUsd,unknownCost:s.unknownCost,
      unknownOutcome:s.unknownOutcome,journalSha256:localVoiceJournalDigest(files.meter)};
    exclusiveJson(files.outcome,record);
  }
  return outcome;
}

/** Read-only accounting admission for the same Wizard slot. No new folder, reservation, reset or provider. */
export function momentumVoiceAccounting(operatorFile: string, bookDir: string) {
  const run=path.dirname(operatorFile), configFile=path.join(run,'wizard-config.json'), files=voiceFiles(run);
  if(!existsSync(configFile)) {
    if(existsSync(files.claim)||existsSync(files.outcome)) voiceFail('voice_binding');
    return null;
  }
  const config=momentumBookConfig(configFile);
  if(!existsSync(files.claim)) {
    if(existsSync(files.outcome)||existsSync(files.meter)&&readdirSync(files.meter).length)voiceFail('voice_unsettled');
    return null;
  }
  if(path.resolve(config.runDirectory)!==path.resolve(run)||path.resolve(config.bookDir)!==path.resolve(bookDir))voiceFail('voice_binding');
  if(!existsSync(files.grant))voiceFail('voice_binding');
  const outcome=settleLocalVoiceForBook(config)??voiceFail('voice_unsettled');
  const grant=localVoiceGrantSchema.parse(readVoiceJson(files.grant));
  // Constructor may create a missing meter, so prove it exists before replaying a settled journal.
  if(!existsSync(files.meter))voiceFail('voice_unsettled');
  const s=localVoiceMeter(config,grant).snapshot();
  if(s.unknownCost||s.unknownOutcome||s.calls!==outcome.calls||s.newKnownApiMicroUsd!==outcome.knownMicroUsd||
    outcome.journalSha256!==localVoiceJournalDigest(files.meter))voiceFail('voice_unsettled');
  return {version:LOCAL_VOICE_VERSION,configFile,configSha256:voiceBytesDigest(fencedText(configFile,16000)),
    grantSha256:outcome.grantSha256,claimSha256:outcome.claimSha256,outcomeFile:files.outcome,
    outcomeSha256:voiceBytesDigest(fencedText(files.outcome,64000)),journalSha256:outcome.journalSha256,
    calls:outcome.calls,knownMicroUsd:outcome.knownMicroUsd,priorApiMicroUsd:grant.priorApiMicroUsd};
}
