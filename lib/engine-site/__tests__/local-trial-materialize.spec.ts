/** Joined file-runtime + SAME production materializer, all providers synthetic. Not model efficacy/producer QA. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import type {PrismaClient} from '@prisma/client';
import {canonicalHash} from '@/lib/canonical-json';
import {LocalEngineTrialRuntime} from '../local-trial-runtime';
import {createEngineMaterializer,validateEngineMaterializedBook,type EngineMaterializationAssets} from '../materialize';
import {engineRecipeSteps} from '../platform-policy';
import {prepareEngineOrder,resolveEngineWizardOptions} from '../personal-orders';
import {syntheticEngineOrderInput} from './synthetic-order';
import {authority,frames} from './fixtures';
import {assetBytesSha256} from '../private-assets';
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)){if(path.dirname(root)!==path.resolve(tmpdir())||!path.basename(root).startsWith('sh_trial_materialize_'))throw Error('owned_test_only');rmSync(root,{recursive:true,force:true});}});
async function setup(){
 const root=mkdtempSync(path.join(tmpdir(),'sh_trial_materialize_'));roots.push(root);const snapshot=prepareEngineOrder(syntheticEngineOrderInput(),{id:'local_owner',email:'fixture@example.invalid',name:'Synthetic'},resolveEngineWizardOptions()).snapshot;
 const a={...authority(),purpose:'test' as const,entitlements:{narration:true,pdf:true},budget:{...authority().budget,maximumMicroUsd:10_000_000,maximumCalls:121,steps:engineRecipeSteps()}};
 const runtime=new LocalEngineTrialRuntime({root:path.join(root,'journal'),authority:a,ownerId:snapshot.ownerId,draftId:snapshot.request.draftId,snapshotSha256:'a'.repeat(64),assertCurrent:()=>{}});
 const image=await sharp({create:{width:1024,height:1536,channels:3,background:'#396a70'}}).png().toBuffer(),imageSha=assetBytesSha256(image),title='סֵפֶר סִינְתֵּטִי',texts=[title,...Array(8).fill('הילד הסינתטי הביט סביבו ושיחק עם המלווה.')];
 for(let n=0;n<9;n++){const step='page_'+n+'_0',wire={synthetic:true,n},result={usable:true,output:{b64:image.toString('base64'),imageSha},raw:{synthetic:true},estimatedMicroUsd:1};await runtime.call({wire,call:{step,wireSha256:canonicalHash(wire),maximumMicroUsd:a.budget.steps.find(s=>s.id===step)!.maximumMicroUsd},requiredMs:1000,execute:async()=>({kind:'completed',result}),admitSaved:answer=>{expect(answer).toEqual(result);}});}
 const pages=frames().map((f,n)=>({pageNumber:n,contextSha:canonicalHash(n),status:'qa_supported',attempts:[],chosen:{...f.attempt,attempt:0,status:'qa_supported',review:{},candidate:{imageName:'page_'+n+'_0.png',imageSha}}}));
 await runtime.save('prepared_source',{source:{manuscript:{title,pages:texts.slice(1).map(text=>({text}))}},sourceDigest:'a'.repeat(64),storyboardDigest:'b'.repeat(64)});await runtime.save('native_book',{pages});await runtime.advance('materialize');
 const load=createRequire(path.resolve('package.json')),audioFile=path.join(root,'synthetic-tone.mp3');execFileSync(load('@ffmpeg-installer/ffmpeg').path,['-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1.2','-b:a','96k',audioFile],{windowsHide:true});const audio=readFileSync(audioFile);
 const fetch=vi.fn(async(_url:any,init:any)=>new Response(new Uint8Array(audio),{headers:{'content-type':'audio/mpeg','request-id':'synthetic_tts','character-cost':String(JSON.parse(init.body).text.length)}}));
 const objects=new Map<string,Buffer>(),assets:EngineMaterializationAssets={put:async(_kind,_ct,bytes)=>{const ref={assetId:randomUUID(),sha256:assetBytesSha256(bytes)};objects.set(ref.assetId,Buffer.from(bytes));return ref;},read:async ref=>objects.get(ref.assetId)!};
 const denied=():never=>{throw Error('external_database_forbidden');},db=new Proxy({},{get:denied}) as PrismaClient,storage={put:denied,read:denied,sign:denied};
 return {root,runtime,snapshot,title,texts,fetch,assets,objects,db,storage};
}
describe('file trial runtime and shared production narration/PDF materializer, zero external service',()=>{
 it('builds exact9 image/audio/PDF bindings; a free resume does not repurchase narration',async()=>{const s=await setup(),materialize=createEngineMaterializer({...s,narration:{fetch:s.fetch as typeof fetch,key:()=> 'SYNTHETIC_ONLY'}});
  await materialize(s.runtime);const book=validateEngineMaterializedBook(s.runtime,await s.runtime.load('materialized_book'));expect(book.pages).toHaveLength(9);expect(s.fetch).toHaveBeenCalledTimes(9);expect((await PDFDocument.load(s.objects.get(book.pdf.assetId)!)).getPageCount()).toBe(9);
  for(const p of book.pages){expect(p.text).toBe(s.texts[p.pageNumber]);expect(assetBytesSha256(s.objects.get(p.image.assetId)!)).toBe(p.image.sha256);expect(assetBytesSha256(s.objects.get(p.audio.assetId)!)).toBe(p.audio.sha256);}
  const resumed=new LocalEngineTrialRuntime({root:path.join(s.root,'journal'),authority:s.runtime.checkpoint.authority,ownerId:s.snapshot.ownerId,draftId:s.snapshot.request.draftId,snapshotSha256:'a'.repeat(64),assertCurrent:()=>{}});await materialize(resumed);expect(s.fetch).toHaveBeenCalledTimes(9);expect(await resumed.meter()).toMatchObject({logicalCalls:18,unknownCalls:0,pendingCalls:0,blocked:false});
 },120000);
 it('stores and settles paid bytes before a free decoder outage; changed local stored audio refuses on resume',async()=>{const s=await setup(),probe=vi.fn().mockRejectedValueOnce(Object.assign(Error('missing_codec'),{code:'ENOENT'})).mockResolvedValue(1.2),materialize=createEngineMaterializer({...s,narration:{fetch:s.fetch as typeof fetch,key:()=> 'SYNTHETIC_ONLY',probe}});
  await expect(materialize(s.runtime)).rejects.toThrow('engine_narration_decode_unavailable');const ref=await s.runtime.load('reader_audio_0');s.objects.set(ref.assetId,Buffer.from('tampered audio'));
  await expect(materialize(s.runtime)).rejects.toThrow('engine_materialization_bytes_changed');expect(s.fetch).toHaveBeenCalledTimes(1);expect(await s.runtime.meter()).toMatchObject({logicalCalls:10,pendingCalls:0,unknownCalls:0});
 });
});
