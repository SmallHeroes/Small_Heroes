import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runLocalVoiceIntake, localVoiceMeter, localVoiceRules, localVoiceJournalDigest, momentumVoiceAccounting } from '../local-voice-intake';
import { authorizeLocalVoice, voiceFiles, voiceDigest, voiceBytesDigest, LOCAL_VOICE_VERSION,
  settleLocalVoiceForBook, localVoiceGrantSchema, type LocalVoiceGrant } from '../local-voice-intake-evidence';
import type { MomentumWizardConfig } from '../momentum-book-bridge';
import type { IntakeProvider } from '../intake-service';
import { fetchLiveIntakeAvailability } from '../intake-live-client';

import { TrialApiMeter, BOOK_E2E_TRIAL } from '../../../scripts/personal-book-e2e-trial';

const original=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(2000,7)]);
const env={NODE_ENV:'development',PERSONAL_WIZARD_PREVIEW:'true',PERSONAL_WIZARD_LOCAL_UI_ONLY:'true',
  PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER:'true',APP_URL:'http://127.0.0.1:3482',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3482'};
const req={url:'http://127.0.0.1:3482/api/dev/personal-wizard/intake/audio',host:'127.0.0.1:3482',origin:'http://127.0.0.1:3482',method:'POST'};
const revision=()=>({head:'a'.repeat(40),clean:true});
function setup() {
  const root=mkdtempSync(path.join(tmpdir(),'voice-test-')), run=path.join(root,'run');mkdirSync(run);
  const config:MomentumWizardConfig={version:'local-momentum-wizard-config/v1',cycle:'owner-momentum-book-20261025/v1',seed:'fictional-test-seed',
    intakeFile:path.join(run,'wizard-intake.json'),runDirectory:run,bookDir:path.join(root,'book')};
  const files=voiceFiles(run);mkdirSync(files.root);writeFileSync(path.join(root,'owner.txt'),'SYNTHETIC OWNER');
  const priorFile=path.join(root,'prior.json');writeFileSync(priorFile,JSON.stringify({cumulativeParentBudgetMicroUsd:3185794,apiReservedUnsettledMicroUsd:0}));
  const grant:LocalVoiceGrant={version:LOCAL_VOICE_VERSION,cycle:config.cycle,configSha256:voiceDigest(config),sourceRoot:root,sourceHead:'a'.repeat(40),
    ownerFile:path.join(root,'owner.txt'),ownerSha256:voiceBytesDigest('SYNTHETIC OWNER'),priorLedgerFile:priorFile,
    priorLedgerSha256:voiceBytesDigest(readFileSync(priorFile)),keyFile:path.join(root,'not-read.env'),origin:req.origin,
    priorApiMicroUsd:3185794,apiCapMicroUsd:7000000,combinedCapMicroUsd:8000000,maxCalls:2,reservationMicroUsd:30000,
    transcribeModel:'gpt-transcribe',extractModel:'gpt-6-luna',priceVersion:'openai-standard/2026-10-26-local-voice-v1'};
  writeFileSync(files.grant,JSON.stringify(grant));writeFileSync(path.join(run,'wizard-config.json'),JSON.stringify(config));
  return {root,config,files,grant,grantSha256:voiceBytesDigest(readFileSync(files.grant))};
}
const data={understood:true,mentionedName:'תמר',mentionedAge:6,mentionedAddress:'girl',residence:null,loves:['לשחק'],hard:[],bonus:[],
  storyPlace:null,explicitTopicId:null,hardTopicId:null};
function run(s:ReturnType<typeof setup>, options:{fail?:'transcribe'|'extract';unknown?:boolean;invalid?:boolean;hold?:Promise<void>;text?:string;malformed?:boolean;changed?:()=>void}={}) {
  const calls:string[]=[];let keys=0;
  const provider:IntakeProvider={
    async transcribe(){calls.push('transcribe');expect(existsSync(s.files.claim)).toBe(true);expect(existsSync(path.join(s.files.meter,'voice_transcribe.claim.json'))).toBe(true);
      if(options.hold)await options.hold;if(options.fail==='transcribe')throw new Error('DO NOT JOURNAL secret transcript');options.changed?.();
      return {text:options.text??'תמר בת שש אוהבת לשחק בחוץ',usage:{seconds:73}};},
    async extract(){calls.push('extract');expect(existsSync(path.join(s.files.meter,'voice_extract.claim.json'))).toBe(true);
      if(options.fail==='extract')throw new Error('private transcript');return {status:'completed',outputText:options.malformed?'not-json':JSON.stringify(data),
        usage:options.unknown?null:{input_tokens:1000,output_tokens:200}};},
  };
  const promise=runLocalVoiceIntake({config:s.config,grant:s.grant,grantSha256:s.grantSha256,
    guard:claimed=>{authorizeLocalVoice(s.config,req,env,revision,claimed);},
    input:{jobId:'j_1234567890',draftId:'d_1234567890',declaredType:'audio/webm',bytes:options.invalid?Buffer.alloc(100):original},
    measureAudio:async()=>({ok:true,durationMs:73000,decodedMs:73000,timelineMs:73000}),topics:[],
    readKey:()=>{keys++;expect(existsSync(s.files.claim)).toBe(true);return 'SYNTHETIC-NOT-A-KEY';},provider:()=>provider});
  return {promise,calls,keys:()=>keys};
}
describe('local voice grant and real core wiring (no provider)',()=>{
  it('requires complete local bootstrap, exact origin, owner/source/config and unused authority',()=>{
    const s=setup();expect(authorizeLocalVoice(s.config,req,env,revision).grant).toEqual(s.grant);
    for(const changed of [{NODE_ENV:'production'},{PERSONAL_WIZARD_LOCAL_UI_ONLY:'false'},{VERCEL:'1'},
      {PERSONAL_WIZARD_LIVE_INTAKE:'true'},{APP_URL:'https://public.example'}])
      expect(()=>authorizeLocalVoice(s.config,req,{...env,...changed},revision)).toThrow();
    for(const changed of [{host:'evil.example'},{origin:'http://evil.example'},{host:'127.0.0.1:9999'},{host:'foo@127.0.0.1:3482'},{host:'127.0.0.1:3482/path'},
      {url:'http://public.example/api'},{host:null},{origin:null}])expect(()=>authorizeLocalVoice(s.config,{...req,...changed},env,revision)).toThrow();
    expect(()=>authorizeLocalVoice(s.config,req,env,()=>({head:'b'.repeat(40),clean:true}))).toThrow('voice_source');
    expect(()=>authorizeLocalVoice(s.config,req,env,()=>({head:'a'.repeat(40),clean:false}))).toThrow('voice_source');
    expect(()=>authorizeLocalVoice({...s.config,seed:'changed-seed'},req,env,revision)).toThrow('voice_binding');
    writeFileSync(s.grant.ownerFile,'CHANGED');expect(()=>authorizeLocalVoice(s.config,req,env,revision)).toThrow('voice_binding');
  });
  it('refuses extra models, extra calls, over-allocation and malformed grants',()=>{
    const s=setup();for(const x of [{extractModel:'other'},{maxCalls:3},{reservationMicroUsd:30001},{apiCapMicroUsd:7000001},
      {priorApiMicroUsd:6999999},{combinedCapMicroUsd:9000000},{keyFile:'relative'}, {extra:true}])expect(localVoiceGrantSchema.safeParse({...s.grant,...x}).success).toBe(false);
  });
  it('parses actual injected speech through the unchanged service; master claim precedes keys, fixed per-call claims precede provider',async()=>{
    const s=setup(), x=run(s),result=await x.promise;expect(result.ok).toBe(true);expect(x.calls).toEqual(['transcribe','extract']);expect(x.keys()).toBe(2);
    if(result.ok){expect(result.result.extraction.mentionedName).toBe('תמר');expect(result.result.source).toBe('transcript');}
    const meter=localVoiceMeter(s.config,s.grant).snapshot();expect(meter.calls).toBe(2);expect(meter.newKnownApiMicroUsd).toBe(6408);
    expect(meter.unknownCost).toBe(0);expect(meter.priorKnownApiMicroUsd).toBe(3185794);
    expect(settleLocalVoiceForBook(s.config)?.knownMicroUsd).toBe(6408);
    const outcome=JSON.parse(readFileSync(s.files.outcome,'utf8'));expect(outcome.journalSha256).toBe(localVoiceJournalDigest(s.files.meter));
    const saved=[s.files.claim,s.files.outcome,...readdirSync(s.files.meter).map(n=>path.join(s.files.meter,n))].map(f=>readFileSync(f,'utf8')).join('');
    expect(saved).not.toContain('תמר');expect(saved).not.toContain('SYNTHETIC-NOT-A-KEY');expect(saved).not.toContain(original.toString('base64'));
  });
  it('invalid audio does not consume master allowance or touch key/provider',async()=>{
    const s=setup(),x=run(s,{invalid:true});expect((await x.promise).ok).toBe(false);expect(x.calls).toEqual([]);expect(x.keys()).toBe(0);expect(existsSync(s.files.claim)).toBe(false);
  });
  it('does not duplicate a consumed job across a new service/meter or another job ID',async()=>{
    const s=setup();await run(s).promise;await expect(run(s).promise).rejects.toThrow('voice_consumed');
    expect(localVoiceMeter(s.config,s.grant).snapshot().calls).toBe(2);
  });
  it('refuses a concurrent master job and canonical submit while original provider is active',async()=>{
    const s=setup();let release!:()=>void;const hold=new Promise<void>(r=>{release=r;});const first=run(s,{hold});
    await new Promise(r=>setTimeout(r,10));await expect(run(s).promise).rejects.toThrow('voice_consumed');
    expect(()=>settleLocalVoiceForBook(s.config)).toThrow('voice_pending');release();expect((await first.promise).ok).toBe(true);
  });
  it('failed first call is UNKNOWN, stops extraction and blocks book without leaking error',async()=>{
    const s=setup(),x=run(s,{fail:'transcribe'});expect((await x.promise).ok).toBe(false);expect(x.calls).toEqual(['transcribe']);
    expect(localVoiceMeter(s.config,s.grant).snapshot()).toMatchObject({calls:1,unknownCost:1});
    expect(()=>settleLocalVoiceForBook(s.config)).toThrow('voice_unsettled');
    expect(readFileSync(path.join(s.files.meter,'voice_transcribe.failure.json'),'utf8')).not.toContain('secret');
  });
  it('missing extraction usage consumes that call and blocks book; cannot retry',async()=>{
    const s=setup(),x=run(s,{unknown:true});expect((await x.promise).ok).toBe(false);expect(x.calls).toEqual(['transcribe','extract']);
    expect(localVoiceMeter(s.config,s.grant).snapshot()).toMatchObject({calls:2,unknownCost:1});
    expect(()=>settleLocalVoiceForBook(s.config)).toThrow('voice_unsettled');
  });
  it('source/phase changes after transcription do not start extraction',async()=>{
    const s=setup(),x=run(s,{changed:()=>writeFileSync(s.config.intakeFile,'{}')});expect((await x.promise).ok).toBe(false);expect(x.calls).toEqual(['transcribe']);
  });
  it('manual selection claims the phase before the canonical file and prevents later voice',()=>{
    const s=setup();expect(settleLocalVoiceForBook(s.config)).toBeNull();expect(existsSync(s.files.skipped)).toBe(true);
    expect(()=>authorizeLocalVoice(s.config,req,env,revision)).toThrow('voice_consumed');
  });
  it('does not invent extraction on unintelligible speech; records only the real single call',async()=>{
    const s=setup(),x=run(s,{text:'...'});const r=await x.promise;expect(r.ok).toBe(true);expect(x.calls).toEqual(['transcribe']);
    expect(settleLocalVoiceForBook(s.config)?.calls).toBe(1);
  });
  it('meter rejects unknown steps and bad pricing inputs',()=>{
    expect(localVoiceRules('another_label')).toBeUndefined();
    expect(localVoiceRules('voice_transcribe')!.reserve({})).toBeNull();
    expect(localVoiceRules('voice_extract')!.reserve({version:LOCAL_VOICE_VERSION,step:'voice_extract',grantSha256:'f'.repeat(64),inputSha256:'f'.repeat(64),
      model:'gpt-6-luna',inputBytes:100001,maxOutputTokens:3000})).toBeNull();
  });
  it('advertises audio-only without exposing unsupported paid text operations',async()=>{
    const response=await fetchLiveIntakeAvailability(async()=>new Response(JSON.stringify({live:true,audioOnly:true,reason:null}),{status:200}));
    expect(response).toEqual({live:true,signInRequired:false,audioOnly:true});
    const wizard=readFileSync('app/dev/personal-wizard/PersonalWizard.tsx','utf8');
    expect(wizard).toContain("setLiveIntake(status.live ? status.audioOnly ? 'audio' : true : false)");
    expect(wizard).toContain('onSubmitWritten={liveIntake === true ? submitWritten : undefined}');
    expect(wizard).toContain('onReorganize={liveIntake === true ? reorganizeTranscript : undefined}');
    expect(wizard).toContain("!liveIntake || !sendRequested || recorderPhase !== 'recorded'");
    const recorder=readFileSync('app/dev/personal-wizard/RecorderPanel.tsx','utf8');
    expect(recorder).toContain('עיבוד ההקלטה והמשך');expect(recorder).toContain('שמירת ההקלטה במכשיר');
  });
});

describe('voice accounting continues the same native book allowance',()=>{
 it('binds a known settled voice journal into read-only carry and reduces real native call room',async()=>{
  const s=setup();await run(s).promise;
  const carry=momentumVoiceAccounting(path.join(s.config.runDirectory,'operator.cjs'),s.config.bookDir)!;
  expect(carry).toMatchObject({calls:2,knownMicroUsd:6408,priorApiMicroUsd:3185794});
  const native=new TrialApiMeter(path.join(s.root,'book-meter'),'',true,carry.priorApiMicroUsd+carry.knownMicroUsd,undefined,98-carry.calls);
  expect(native.snapshot()).toMatchObject({priorKnownApiMicroUsd:3192202,maxCalls:96,calls:0});
  expect(()=>new TrialApiMeter(path.join(s.root,'forbidden-meter'),'',false,0,undefined,BOOK_E2E_TRIAL.maxApiCalls+1)).toThrow('trial_call_limit');
  expect(()=>momentumVoiceAccounting(path.join(s.config.runDirectory,'operator.cjs'),path.join(s.root,'another-book'))).toThrow('voice_binding');
  const nativeSource=readFileSync('scripts/personal-book-e2e-trial.ts','utf8');
  expect(nativeSource).toContain('maxApiCalls:trial.maxApiCalls-voiceIntake.calls');
  expect(nativeSource).toContain('MOMENTUM_BOOK_TRIAL.priorApiMicroUsd+(plan.voiceIntake?.knownMicroUsd??0)');
  expect(nativeSource).toContain('trial.maxApiCalls-(plan.voiceIntake?.calls??0)');
  expect(nativeSource).toContain('trial_voice_changed');
 });
 it('cannot hide an unknown/pending voice job by omitting a carry field or removing its config',async()=>{
  const s=setup();await run(s,{unknown:true}).promise;
  expect(()=>momentumVoiceAccounting(path.join(s.config.runDirectory,'operator.cjs'),s.config.bookDir)).toThrow('voice_unsettled');
 });
 it('known malformed extraction remains a failed intake, but manual entry can carry its real costs without another paid call',async()=>{
  const s=setup();expect((await run(s,{malformed:true}).promise).ok).toBe(false);
  const out=settleLocalVoiceForBook(s.config)!;expect(out.ok).toBe(false);expect(out.calls).toBe(2);expect(out.knownMicroUsd).toBe(6408);
  expect(momentumVoiceAccounting(path.join(s.config.runDirectory,'operator.cjs'),s.config.bookDir)?.calls).toBe(2);
 });
 it('tampered outcome cost is refused by native replay even when the journal digest is unchanged',async()=>{
  const s=setup();await run(s).promise;const o=JSON.parse(readFileSync(s.files.outcome,'utf8'));o.knownMicroUsd=0;writeFileSync(s.files.outcome,JSON.stringify(o));
  expect(()=>momentumVoiceAccounting(path.join(s.config.runDirectory,'operator.cjs'),s.config.bookDir)).toThrow('voice_unsettled');
 });
});
