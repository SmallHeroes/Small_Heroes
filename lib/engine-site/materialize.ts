import 'server-only';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { narrationVoice, planBookNarration } from '@/scripts/personal-book-narration';
import type { ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import type { PersonalWizardOptions } from '@/lib/personal-wizard/options';
import type { SavedPage } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { attemptStatus, localEvaluationEligible } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { authorityDigest, boundBookManifest, engineBookManifestSchema, engineSiteFail } from './contract';
import { assetBytesSha256, loadEnginePrivateAsset, persistEnginePrivateAsset, readEnginePrivateBytes } from './private-assets';
import type { EnginePrivateStorage } from './private-storage';
import type { EngineRuntime } from './durable-worker';
import {localEntitiesPreparedSource,localMediaRecovery,type LocalEntitiesPreparation} from './local-current-entities';
import { prepareEngineNarration,validateEngineNarrationAudio, type EngineNarrationPorts } from './narration';
import { buildEngineBookPdf } from './book-pdf';

const assetRef = z.object({ assetId: z.string().uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const engineMaterializedBookSchema = z.object({ version: z.literal('engine-site-reader/v1'), manifest: engineBookManifestSchema,
  title: z.string().min(1).max(1000), childName: z.string().min(1).max(120),
  voiceId: z.string().min(1), pages: z.array(z.object({ pageNumber: z.number().int().min(0).max(8), text: z.string().min(1).max(5000),
    image: assetRef, audio: assetRef, duration: z.number().positive().max(180) }).strict()).length(9), pdf: assetRef }).strict();
export type EngineMaterializedBook = z.infer<typeof engineMaterializedBookSchema>;
/** Internal test/operator storage port. Production always defaults to the private DB/storage implementation. */
export type EngineMaterializationAssets = {
  put: (kind: 'page' | 'audio' | 'pdf', contentType: string, bytes: Buffer) => Promise<z.infer<typeof assetRef>>;
  read: (ref: z.infer<typeof assetRef>, kind: 'page' | 'audio' | 'pdf') => Promise<Buffer>;
};
export function validateEngineMaterializedBook(runtime: Pick<EngineRuntime, 'checkpoint'>, value: unknown) {
  const book = engineMaterializedBookSchema.parse(value), manifest = boundBookManifest(runtime.checkpoint.authority, book.manifest);
  if (book.pdf.sha256 !== manifest.pdfSha256 || book.pages.some((p, i) => p.pageNumber !== i ||
      assetBytesSha256(Buffer.from(p.text, 'utf8')) !== manifest.pages[i].textSha256 || p.image.sha256 !== manifest.pages[i].imageSha256 ||
      p.audio.sha256 !== manifest.pages[i].audioSha256) || book.pages[0].text !== book.title) engineSiteFail('engine_reader_manifest_changed');
  return book;
}
export async function verifyEngineBookAsset(db: PrismaClient, storage: EnginePrivateStorage, runtime: Pick<EngineRuntime, 'checkpoint'>,
  ref: z.infer<typeof assetRef>, kind: 'page' | 'audio' | 'pdf') {
  const a = await loadEnginePrivateAsset(db, ref.assetId), c = runtime.checkpoint;
  if (a.ownerId !== c.ownerId || a.draftId !== c.draftId || a.orderId !== c.authority.orderId || a.kind !== kind || a.sha256 !== ref.sha256 ||
      a.contentType !== ({ page: 'image/png', audio: 'audio/mpeg', pdf: 'application/pdf' } as const)[kind]) engineSiteFail('engine_reader_asset_changed');
  return readEnginePrivateBytes(storage, a);
}
export function createEngineMaterializer(args: { db: PrismaClient; storage: EnginePrivateStorage;
  snapshot: { request: ReviewedPersonalBookRequest; options: PersonalWizardOptions }; narration: EngineNarrationPorts;
  pdf?: typeof buildEngineBookPdf; assets?: EngineMaterializationAssets; localEvaluation?:{cap:LocalEntitiesPreparation;snapshot:Parameters<typeof localEntitiesPreparedSource>[2]} }) {
  return async (runtime: EngineRuntime) => {
    const authority = runtime.checkpoint.authority, prior = await runtime.load('materialized_book');
    const evaluation=args.localEvaluation?localMediaRecovery(args.localEvaluation.cap):undefined;
    if(evaluation?.localReaderCompletion){
      if(!args.assets||!args.localEvaluation)engineSiteFail('engine_local_evaluation_scope');
      const {cap,snapshot}=args.localEvaluation;
      const prepared=await runtime.load('prepared_source');
      if(!prepared||snapshot!==args.snapshot)engineSiteFail('engine_local_evaluation_scope');
      localEntitiesPreparedSource(cap,runtime.checkpoint,snapshot,prepared);
    }
    if (prior) { validateEngineMaterializedBook(runtime, prior); await runtime.advance('accept'); return; }
    const prepared = await runtime.load('prepared_source') as any, native = await runtime.load('native_book') as { pages: SavedPage[] } | null;
    if (!prepared || !native || native.pages.length !== 9 || native.pages.some((p, i) => p.pageNumber !== i || !p.chosen || (evaluation?.localReaderCompletion ? !localEvaluationEligible(p.chosen) : p.status !== 'qa_supported')))
      engineSiteFail('engine_materialization_incomplete');
    const source = prepared.source, title = source.manuscript.title as string;
    const texts = [title, ...source.manuscript.pages.map((p: { text: string }) => p.text)];
    if (texts.length !== 9 || texts.some(t => typeof t !== 'string' || !t.trim())) engineSiteFail('engine_materialization_texts');
    const voiceId = args.snapshot.request.bookOptions.voiceId!, voice = narrationVoice(voiceId, args.snapshot.options.voices.map(v => v.id));
    // Plan all exact TTS wires before the first TTS claim. The order-wide meter still owns the cap.
    const plan = planBookNarration(texts.map((text, pageNumber) => ({ text, pageNumber })), voice,
      authority.budget.steps.filter(s => /^narration_[0-8]$/.test(s.id)).reduce((s, p) => s + p.maximumMicroUsd, 0));
    const persist = async (name: string, kind: 'page' | 'audio' | 'pdf', contentType: string, bytes: Buffer) => {
      const found = await runtime.load(name) as z.infer<typeof assetRef> | null;
      if (found) {
        if (assetBytesSha256(bytes) !== found.sha256) engineSiteFail('engine_materialization_bytes_changed');
        const saved = args.assets ? await args.assets.read(found, kind) : await verifyEngineBookAsset(args.db, args.storage, runtime, found, kind);
        if (assetBytesSha256(saved) !== found.sha256) engineSiteFail('engine_materialization_bytes_changed'); return found;
      }
      runtime.check(); const asset = args.assets ? await args.assets.put(kind, contentType, bytes) : await persistEnginePrivateAsset(args.db, args.storage, { ownerId: runtime.checkpoint.ownerId,
        draftId: runtime.checkpoint.draftId, orderId: authority.orderId, kind, contentType }, bytes);
      const ref = assetRef.parse({ assetId: asset.assetId, sha256: asset.sha256 });
      if (ref.sha256 !== assetBytesSha256(bytes)) engineSiteFail('engine_materialization_bytes_changed');
      await runtime.save(name, ref); return ref;
    };
    const pages: EngineMaterializedBook['pages'] = [], pdfPages: Parameters<typeof buildEngineBookPdf>[1] = [];
    for (const page of native.pages) {
      const n = page.pageNumber, chosen = page.chosen;
      if (!chosen || (evaluation?.localReaderCompletion ? !localEvaluationEligible(chosen) : attemptStatus('page', chosen) !== 'qa_supported')) engineSiteFail('engine_materialization_page_held');
      const step = chosen.candidate.imageName.replace(/\.png$/, '');
      if (!(new RegExp(`^page_${n}_[0-2]$`)).test(step) && !(step === `page_${n}_3` && chosen.attempt === 3 &&
          chosen.sceneRepair?.version === 'audition-local-material-scene/v1' && authority.budget.steps.some(slot=>slot.id===step)) &&
          !(evaluation?.localReaderCompletion && evaluation.edit.page===n && step===`page_${n}_4` && chosen.attempt===4 && authority.budget.steps.some(slot=>slot.id===step)))
        engineSiteFail('engine_materialization_frame_changed');
      const generated = await runtime.result(step), output = z.object({ b64: z.string(), imageSha: z.literal(chosen.candidate.imageSha) }).parse(generated.output);
      const image = Buffer.from(output.b64, 'base64'); if (assetBytesSha256(image) !== output.imageSha) engineSiteFail('engine_materialization_image_changed');
      const imageRef = await persist(`reader_image_${n}`, 'page', 'image/png', image);
      const narrated = await runtime.call(prepareEngineNarration(authority, plan.rows[n].wire, args.narration));
      const audio = z.object({ b64: z.string(), audioSha256: z.string().length(64) }).parse(narrated.output);
      const bytes = Buffer.from(audio.b64, 'base64'); if (assetBytesSha256(bytes) !== audio.audioSha256) engineSiteFail('engine_materialization_audio_changed');
      const audioRef = await persist(`reader_audio_${n}`, 'audio', 'audio/mpeg', bytes);
      const verificationSchema=z.object({audioSha256:z.literal(audio.audioSha256),duration:z.number().positive().max(180)}).strict();
      const existing=await runtime.load(`reader_audio_verified_${n}`);
      const verified=existing?verificationSchema.parse(existing):{audioSha256:audio.audioSha256,duration:await validateEngineNarrationAudio(bytes,args.narration.probe)};
      if(!existing)await runtime.save(`reader_audio_verified_${n}`,verified);
      pages.push({ pageNumber: n, text: texts[n], image: imageRef, audio: audioRef, duration: verified.duration });
      pdfPages.push({ pageNumber: n, text: texts[n], image });
    }
    const pdf = await persist('reader_pdf', 'pdf', 'application/pdf', await (args.pdf ?? buildEngineBookPdf)(title, pdfPages));
    const book = validateEngineMaterializedBook(runtime, { version: 'engine-site-reader/v1', title,
      childName: args.snapshot.request.child.name, voiceId, pages, pdf, manifest: { version: 'engine-site-book/v1', orderId: authority.orderId,
        authoritySha256: authorityDigest(authority), sourceSha256: prepared.sourceDigest, storyboardSha256: prepared.storyboardDigest,
        imageQuality: authority.imageQuality, pages: pages.map(p => ({ pageNumber: p.pageNumber, textSha256: assetBytesSha256(Buffer.from(p.text, 'utf8')),
          imageSha256: p.image.sha256, audioSha256: p.audio.sha256 })), pdfSha256: pdf.sha256 } });
    await runtime.save('materialized_book', book); await runtime.advance('accept');
  };
}
