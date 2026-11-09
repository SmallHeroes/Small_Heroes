import 'server-only';
import {randomUUID} from 'node:crypto';
import {lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import type {PrismaClient} from '@prisma/client';
import {canonicalHash} from '@/lib/canonical-json';
import {narrationVoice,writeLocalReaderBundle} from '@/scripts/personal-book-narration';
import {createEngineNativeRecipe} from './native-recipe';
import {assetBytesSha256} from './private-assets';
import type {EngineNarrationPorts} from './narration';
import {buildEngineBookPdf} from './book-pdf';
import {createEngineMaterializer,validateEngineMaterializedBook,type EngineMaterializationAssets} from './materialize';
import {engineSiteFail} from './contract';
import {replayEngineRecordedBook} from './readmission';
import type {EngineProviderPorts} from './provider-plans';
import type {LocalEngineTrialRuntime} from './local-trial-runtime';
import type {prepareEngineOrder} from './personal-orders';
import type {AdmittedEngineInitialPreparation} from './story-preparation';
import type {AdmittedEngineChildBindingPreparation} from './local-trial-child-binding';
import type {AdmittedEngineLocationRepairPreparation} from './local-trial-location-repair';
import type {AdmittedEngineLocationV2RepairPreparation} from './local-trial-location-repair-v2';

export type LocalTrialSnapshot=ReturnType<typeof prepareEngineOrder>['snapshot'];
/** Same native producer, materializer and raw re-admission. No fake paid Order/private DB/customer delivery. */
export async function runLocalEngineTrialBook(o:{runtime:LocalEngineTrialRuntime;directory:string;snapshot:LocalTrialSnapshot;
 provider:EngineProviderPorts;narration:EngineNarrationPorts;pdf?:typeof buildEngineBookPdf;initialPreparation?:AdmittedEngineInitialPreparation;childBindingPreparation?:AdmittedEngineChildBindingPreparation;locationsRepairPreparation?:AdmittedEngineLocationRepairPreparation;locationsV2RepairPreparation?:AdmittedEngineLocationV2RepairPreparation}){
 const r=o.runtime,dir=path.resolve(o.directory),files=path.join(dir,'deliverables');mkdirSync(files,{recursive:true,mode:0o700});
 if(lstatSync(files).isSymbolicLink()||realpathSync(files)!==files)engineSiteFail('local_trial_deliverable_path');
 const denied=():never=>engineSiteFail('local_trial_external_database_forbidden');
 const db=new Proxy({},{get:denied}) as PrismaClient,storage={put:denied,read:denied,sign:denied};
 const extension={page:'png',audio:'mp3',pdf:'pdf'} as const;
 const assets:EngineMaterializationAssets={
  async put(kind,_contentType,bytes){const ref={assetId:randomUUID(),sha256:assetBytesSha256(bytes)};writeFileSync(path.join(files,ref.assetId+'.'+extension[kind]),bytes,{flag:'wx',mode:0o600});return ref;},
  async read(ref,kind){if(!/^[a-f0-9-]{36}$/.test(ref.assetId))engineSiteFail('local_trial_deliverable_id');const file=path.join(files,ref.assetId+'.'+extension[kind]);if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file)engineSiteFail('local_trial_deliverable_path');const bytes=readFileSync(file);if(assetBytesSha256(bytes)!==ref.sha256)engineSiteFail('local_trial_deliverable_changed');return bytes;},
 };
 const materialize=createEngineMaterializer({db,storage,snapshot:o.snapshot,narration:o.narration,pdf:o.pdf,assets});
 await createEngineNativeRecipe({db,storage,snapshot:o.snapshot,ports:o.provider,materialize,initialPreparation:o.initialPreparation,childBindingPreparation:o.childBindingPreparation,locationsRepairPreparation:o.locationsRepairPreparation,locationsV2RepairPreparation:o.locationsV2RepairPreparation})(r);
 const book=validateEngineMaterializedBook(r,await r.load('materialized_book'));
 const admitted=await replayEngineRecordedBook({checkpoint:r.checkpoint,snapshot:o.snapshot,book},{readJson:id=>r.readJson(id),result:step=>r.result(step)},undefined,o.initialPreparation,o.childBindingPreparation,o.locationsRepairPreparation,o.locationsV2RepairPreparation);
 if(admitted.length!==9)engineSiteFail('local_trial_readmission_incomplete');
 for(const p of book.pages){await assets.read(p.image,'page');await assets.read(p.audio,'audio');}
 await assets.read(book.pdf,'pdf');
 await r.advance('done');return {book,admittedFrames:admitted.length,files,pdfFile:path.join(files,book.pdf.assetId+'.pdf'),meter:await r.meter()};
}
/** Builds staging bytes only. The caller publishes locally with exact-path atomic rename after outcome QA. */
export function localTrialReaderBundle(directory:string,id:string,result:Awaited<ReturnType<typeof runLocalEngineTrialBook>>){
 const {book,files}=result,voice=narrationVoice(book.voiceId,[book.voiceId]);
 return writeLocalReaderBundle({root:directory,id,title:book.title,childName:book.childName,sourceSha256:canonicalHash(book.manifest),
  pages:book.pages.map(p=>({pageNumber:p.pageNumber,text:p.text,imageFile:path.join(files,p.image.assetId+'.png')})),
  narration:{voice:{id:voice.id,label:voice.label},pages:book.pages.map(p=>({pageNumber:p.pageNumber,audioFile:path.join(files,p.audio.assetId+'.mp3')}))}});
}
