import 'server-only';
import type { PrismaClient } from '@prisma/client';
import type { ReaderBookPayload } from '@/lib/reader-book-source';
import { identifierSchema, bookDigest, engineSiteFail } from './contract';
import { loadEngineOrderSnapshot } from './personal-jobs';
import { parseEngineCheckpoint } from './durable-worker';
import { requireRegisteredEngineAuthority } from './order-meter';
import { loadEnginePrivateAsset, readEnginePrivateBytes } from './private-assets';
import { validateEngineMaterializedBook, type EngineMaterializedBook } from './materialize';
import type { EnginePrivateStorage } from './private-storage';

export function engineReaderEnabled(env: Readonly<Record<string, string | undefined>> = process.env) { return env.ENGINE_SITE_READER_ENABLED === 'true'; }
/** Stable session user IDs, supplied by deployment configuration. No client-supplied actor or shared secret. */
export function engineOperatorIds(env: Readonly<Record<string, string | undefined>> = process.env): string[] {
  try { const ids = JSON.parse(env.ENGINE_SITE_OPERATOR_USER_IDS ?? '[]');
    return Array.isArray(ids) && ids.length <= 30 && ids.every(id => identifierSchema.safeParse(id).success) ? ids : []; } catch { return []; }
}
export async function loadEngineReaderBook(db: PrismaClient, storage: EnginePrivateStorage, orderId: string) {
  const loaded = await loadEngineOrderSnapshot(db, orderId), job = await db.generationJob.findUnique({ where: { orderId } });
  const checkpoint = parseEngineCheckpoint(job?.pipelineCache);
  if (checkpoint.authority.orderId !== orderId || checkpoint.snapshotSha256 !== loaded.inputSha256 || checkpoint.ownerId !== loaded.snapshot.ownerId)
    engineSiteFail('engine_reader_order_changed');
  await db.$transaction(tx => requireRegisteredEngineAuthority(tx, checkpoint.authority));
  const id = checkpoint.outputs.materialized_book; if (!id) engineSiteFail('engine_reader_not_materialized');
  const asset = await loadEnginePrivateAsset(db, id);
  if (asset.ownerId !== checkpoint.ownerId || asset.draftId !== checkpoint.draftId || asset.orderId !== orderId || asset.kind !== 'receipt')
    engineSiteFail('engine_reader_order_changed');
  const book = validateEngineMaterializedBook({ checkpoint }, JSON.parse((await readEnginePrivateBytes(storage, asset)).toString('utf8')));
  return { ...loaded, job: job!, checkpoint, book, bookSha256: bookDigest(book.manifest) };
}
export type EngineReaderContext = Awaited<ReturnType<typeof loadEngineReaderBook>>;
/** Same current-policy/history/byte-bound publication predicate used by the outbox send CAS. */
export async function engineFamilyBookReady(db: PrismaClient, context: EngineReaderContext): Promise<boolean> {
  return (await import('./fulfillment')).readEngineFamilyReady(db, context);
}
export function engineReaderPayload(orderId: string, book: EngineMaterializedBook, preview: boolean): ReaderBookPayload {
  const assetUrl = (id: string) => `/api/engine-site/v1/books/${encodeURIComponent(orderId)}/assets/${id}${preview ? '?preview=1' : ''}`;
  return { id: orderId, status: 'ready', childName: book.childName, storyLength: 'short', powerCard: null,
    book: { title: book.title, coverText: book.title, narrationVoiceId: book.voiceId, pages: book.pages.map(p => ({ pageNumber: p.pageNumber, text: p.text,
      title: p.pageNumber === 0 ? book.title : null, isCover: p.pageNumber === 0, narrationText: p.text,
      imageUrl: assetUrl(p.image.assetId), presentationImageUrl: assetUrl(p.image.assetId), audioUrl: assetUrl(p.audio.assetId),
      layout: 'standard', illustrationAspect: 'portrait', textTreatment: 'standard' })) } };
}
