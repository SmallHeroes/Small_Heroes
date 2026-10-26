import { describe, it, expect, afterAll, vi } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { NextRequest } from 'next/server';
const mon=vi.hoisted(()=>({keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0}));
vi.mock('node:child_process',async()=>({...await vi.importActual('node:child_process'),execFileSync:(cmd:string,args:string[])=>{if(cmd!=='git')throw Error('unexpected process');return args.includes('rev-parse')?'a'.repeat(40):'';}}));
vi.mock('node:fs',async()=>{const actual:any=await vi.importActual('node:fs');return {...actual,readFileSync:(p:any,...args:any[])=>{if(typeof p==='string'&&p.split('\\').join('/').toLowerCase()==='c:/gnart/work/small_heroes/.env.local'){mon.keys++;return'OPENAI_API_KEY=SYNTHETIC-HTTP-KEY\n';}return actual.readFileSync(p,...args);}};});
vi.mock('../../auth-session',()=>({resolveUserFromRequest:()=>{mon.auth++;throw Error('auth forbidden');}}));
vi.mock('../audio-probe',async()=>({...await vi.importActual('../audio-probe'),measureAudioDuration:async()=>{mon.measure++;return{ok:true,durationMs:73000,decodedMs:73000,timelineMs:73000};}}));
vi.mock('../intake-openai',()=>({createOpenAiIntakeProvider:()=>{mon.provider++;return{
 async transcribe(){mon.transcribe++;return{text:'בדיקה ילד בן שש שאוהב לצייר',usage:{seconds:73}};},
 async extract(){mon.extract++;return{status:'completed',outputText:JSON.stringify({understood:true,mentionedName:'בדיקה',mentionedAge:6,mentionedAddress:null,residence:null,loves:['לצייר'],hard:[],bonus:[],storyPlace:null,explicitTopicId:null,hardTopicId:null}),usage:{input_tokens:1000,output_tokens:200}};}
};}}));
import { POST } from '../../../app/api/dev/personal-wizard/intake/audio/route';
import { GET } from '../../../app/api/dev/personal-wizard/intake/status/route';
import { voiceFiles,voiceDigest,voiceBytesDigest,LOCAL_VOICE_VERSION } from '../local-voice-intake-evidence';
const R=tmpdir();
const envKeys=['NODE_ENV','PERSONAL_WIZARD_PREVIEW','PERSONAL_WIZARD_LOCAL_UI_ONLY','PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER','PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG','APP_URL','NEXT_PUBLIC_APP_URL','VERCEL','VERCEL_ENV','VERCEL_URL','VERCEL_PROJECT_ID','PERSONAL_WIZARD_LIVE_INTAKE','PERSONAL_WIZARD_NATIVE_BOOK_RUNNER','PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER'];
const oldEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));let seq=1;
function setup(){
 Object.assign(mon,{keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0});
 Object.assign(process.env,{NODE_ENV:'development',PERSONAL_WIZARD_PREVIEW:'true',PERSONAL_WIZARD_LOCAL_UI_ONLY:'true',PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER:'true',APP_URL:'http://127.0.0.1:3482',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3482'});
 for(const k of ['VERCEL','VERCEL_ENV','VERCEL_URL','VERCEL_PROJECT_ID','PERSONAL_WIZARD_LIVE_INTAKE','PERSONAL_WIZARD_NATIVE_BOOK_RUNNER','PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER'])delete process.env[k];
 const root=mkdtempSync(path.join(R,'http-')),run=path.join(root,'run');mkdirSync(run);
 const config={version:'local-momentum-wizard-config/v1',cycle:'owner-momentum-book-20261025/v1',seed:'http-independent-seed',intakeFile:path.join(run,'wizard-intake.json'),runDirectory:run,bookDir:path.join(root,'book')};
 const configFile=path.join(run,'wizard-config.json');writeFileSync(configFile,JSON.stringify(config));process.env.PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG=configFile;
 const files=voiceFiles(run);mkdirSync(files.root);const ownerFile=path.join(root,'owner'),priorLedgerFile=path.join(root,'prior');writeFileSync(ownerFile,'synthetic owner');writeFileSync(priorLedgerFile,JSON.stringify({cumulativeParentBudgetMicroUsd:3185794,apiReservedUnsettledMicroUsd:0}));
 const grant={version:LOCAL_VOICE_VERSION,cycle:config.cycle,configSha256:voiceDigest(config),sourceRoot:process.cwd(),sourceHead:'a'.repeat(40),ownerFile,ownerSha256:voiceBytesDigest('synthetic owner'),priorLedgerFile,priorLedgerSha256:voiceBytesDigest(readFileSync(priorLedgerFile)),keyFile:'C:/GNart/Work/Small_Heroes/.env.local',origin:'http://127.0.0.1:3482',priorApiMicroUsd:3185794,apiCapMicroUsd:7000000,combinedCapMicroUsd:8000000,maxCalls:2,reservationMicroUsd:30000,transcribeModel:'gpt-transcribe',extractModel:'gpt-6-luna',priceVersion:'openai-standard/2026-10-26-local-voice-v1'};
 writeFileSync(files.grant,JSON.stringify(grant));return{root,run,config,files,grant};
}
function request(method='POST',extra:any={}){const ip=`192.0.2.${seq++}`;return new NextRequest(`http://127.0.0.1:3482/api/dev/personal-wizard/intake/${method==='GET'?'status':'audio'}`,{method,headers:{host:'127.0.0.1:3482',origin:'http://127.0.0.1:3482','x-forwarded-for':ip,'content-type':'audio/webm','x-pw-job-id':'j_httpindependent','x-pw-draft-id':'d_httpindependent',...extra},...(method==='POST'?{body:Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(4096,83)])}:{})});}
afterAll(()=>{for(const[k,v]of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
describe('actual local voice HTTP handler with NextRequest normalization',()=>{
 it('status truthfully selects audio-only without key, provider, auth, or measurement',async()=>{setup();const r=await GET(request('GET'));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({live:true,audioOnly:true,reason:null});expect(mon).toEqual({keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0});});
 it('real POST calls unchanged audio core and original reader parsing only after claims, then rejects a second request',async()=>{const s=setup();const r=await POST(request());expect(r.status).toBe(200);const body=await r.json();expect(body.extraction.mentionedName).toBe('בדיקה');expect(mon).toEqual({keys:2,provider:2,transcribe:1,extract:1,auth:0,measure:1});expect(existsSync(s.files.claim)).toBe(true);expect(existsSync(s.files.outcome)).toBe(true);const second=await POST(request());expect(second.status).toBe(409);expect(mon.keys).toBe(2);});
 it('selected invalid or stale local authority fails before any normal auth fallback or audio/key/provider',async()=>{const s=setup();writeFileSync(s.files.grant,JSON.stringify({...s.grant,sourceHead:'b'.repeat(40)}));const r=await POST(request());expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'voice_source'});expect(mon).toEqual({keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0});writeFileSync(s.files.grant,'{');const malformed=await POST(request());expect(malformed.status).toBe(503);expect((await malformed.json()).error).toBe('voice_unavailable');expect(mon.auth).toBe(0);});
 it('foreign origin and cloud marker cannot use configured authority',async()=>{setup();const r=await POST(request('POST',{origin:'https://foreign.example'}));expect(r.status).toBe(403);process.env.VERCEL='1';const cloud=await POST(request());expect(cloud.status).toBe(503);expect(mon).toEqual({keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0});});
});

describe('normalization never relaxes actual Host/Origin grant binding',()=>{
 it.each([
  {host:'localhost:3482'},
  {host:'127.0.0.1:3483'},
  {origin:'http://localhost:3482'},
  {origin:'http://127.0.0.1:3483'},
  {host:'foo@127.0.0.1:3482'},
  {host:'127.0.0.1:3482/path'},
 ])('refuses a foreign/sibling/malformed authority %j before audio, key and provider',async changed=>{
  setup();const r=await POST(request('POST',changed));expect(r.status).toBe(403);
  expect(mon).toEqual({keys:0,provider:0,transcribe:0,extract:0,auth:0,measure:0});
 });
 it('proves the actual constructor normalizes the URL but retains the exact browser authority headers',()=>{
  setup();const r=request();expect(new URL(r.url).hostname).toBe('localhost');
  expect(r.headers.get('host')).toBe('127.0.0.1:3482');expect(r.headers.get('origin')).toBe('http://127.0.0.1:3482');
 });
});
