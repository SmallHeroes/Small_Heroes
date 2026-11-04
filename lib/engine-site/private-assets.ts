import 'server-only';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import sharp from 'sharp';
import type { Prisma, PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { ID_PATTERNS } from '@/lib/personal-wizard/contract';
import { digestSchema, engineSiteFail } from './contract';
import { ENGINE_PRIVATE_BUCKET, type EnginePrivateStorage } from './private-storage';
import { ENGINE_PHOTO_MAX_BYTES } from './photo-policy';
export { ENGINE_PHOTO_MAX_BYTES } from './photo-policy';

export const assetBytesSha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export const privateAssetSchema = z.object({
  version: z.literal('engine-site-private-asset/v1'), assetId: z.string().uuid(),
  ownerId: z.string().min(1), draftId: z.string().regex(ID_PATTERNS.draft), orderId: z.string().nullable(),
  kind: z.enum(['child_photo', 'reference', 'candidate', 'page', 'audio', 'pdf', 'receipt', 'story']),
  sha256: digestSchema, bytes: z.number().int().positive().max(64 * 1024 * 1024),
  contentType: z.string().min(1).max(80), bucket: z.literal(ENGINE_PRIVATE_BUCKET), key: z.string(),
}).strict();
export type EnginePrivateAsset = z.infer<typeof privateAssetSchema>;
type AssetDb = Pick<Prisma.TransactionClient, 'wizardSession' | '$queryRaw'>;

/** Session JSON contains child data. Public Data API roles must have no table privileges before any new write/read. */
export async function assertEnginePrivateDatabase(db: Pick<Prisma.TransactionClient, '$queryRaw'>) {
  const rows = await db.$queryRaw<Array<{ safe: boolean }>>`
    SELECT count(*) = 3 AND bool_and(c.relrowsecurity AND NOT (
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
      has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') OR
      has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))) AS safe
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('WizardSession', 'Order', 'GenerationJob')`;
  if (rows.length !== 1 || rows[0].safe !== true) engineSiteFail('engine_private_database_required');
}
/** A restrictive policy remains effective even if a pre-existing permissive policy covers every bucket. */
export async function assertEnginePrivateStoragePolicy(db: Pick<Prisma.TransactionClient, '$queryRaw'>) {
  const rows = await db.$queryRaw<Array<{ safe: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      WHERE p.polrelid = 'storage.objects'::regclass AND c.relrowsecurity
        AND p.polname = 'engine_site_private_server_only' AND NOT p.polpermissive AND p.polcmd = '*'
        AND ARRAY['anon'::regrole::oid, 'authenticated'::regrole::oid] <@ p.polroles
        AND regexp_replace(pg_get_expr(p.polqual, p.polrelid), '[[:space:]()]', '', 'g') = 'bucket_id<>''engine-site-private''::text'
        AND regexp_replace(pg_get_expr(p.polwithcheck, p.polrelid), '[[:space:]()]', '', 'g') = 'bucket_id<>''engine-site-private''::text'
    ) AS safe`;
  if (rows.length !== 1 || rows[0].safe !== true) engineSiteFail('engine_private_storage_policy_required');
}
export function privateAssetKey(asset: Pick<EnginePrivateAsset, 'ownerId' | 'draftId' | 'assetId' | 'sha256'>) {
  return `${canonicalHash(asset.ownerId)}/${canonicalHash(asset.draftId)}/${asset.assetId}/${asset.sha256}`;
}
export async function loadEnginePrivateAsset(db: AssetDb, assetId: string) {
  z.string().uuid().parse(assetId);
  await assertEnginePrivateDatabase(db);
  await assertEnginePrivateStoragePolicy(db);
  const row = await db.wizardSession.findUnique({ where: { sessionId: `engine-site-asset/v1/${assetId}` } });
  const asset = privateAssetSchema.parse(row?.data);
  if (asset.assetId !== assetId || asset.key !== privateAssetKey(asset)) engineSiteFail('engine_private_asset_binding_invalid');
  return asset;
}
export async function verifyEngineOrderPhoto(db: AssetDb, assetId: string, ownerId: string, draftId: string) {
  const asset = await loadEnginePrivateAsset(db, assetId);
  if (asset.kind !== 'child_photo' || asset.ownerId !== ownerId || asset.draftId !== draftId || asset.orderId !== null)
    engineSiteFail('engine_private_photo_access_denied');
  return asset;
}
export async function readEnginePrivateBytes(storage: EnginePrivateStorage, asset: EnginePrivateAsset) {
  const bytes = await storage.read(asset.key);
  if (bytes.length !== asset.bytes || assetBytesSha256(bytes) !== asset.sha256) engineSiteFail('engine_private_bytes_changed');
  return bytes;
}
export async function persistEnginePrivateAsset(db: AssetDb, storage: EnginePrivateStorage,
  input: Omit<EnginePrivateAsset, 'version' | 'assetId' | 'sha256' | 'bytes' | 'bucket' | 'key'>, bytes: Buffer) {
  await assertEnginePrivateDatabase(db);
  await assertEnginePrivateStoragePolicy(db);
  const base = { ...input, version: 'engine-site-private-asset/v1' as const, assetId: randomUUID(),
    sha256: assetBytesSha256(bytes), bytes: bytes.length, bucket: ENGINE_PRIVATE_BUCKET };
  const asset = privateAssetSchema.parse({ ...base, key: privateAssetKey(base) });
  await storage.put(asset.key, bytes, asset.contentType);
  // A crash here may leave a private orphan; never expose it or regenerate paid work to fix a storage failure.
  await db.wizardSession.create({ data: { sessionId: `engine-site-asset/v1/${asset.assetId}`,
    data: asset as unknown as Prisma.InputJsonValue } });
  return asset;
}
export async function uploadEngineChildPhoto(db: PrismaClient, storage: EnginePrivateStorage,
  ownerId: string, draftId: string, contentType: string, raw: Buffer) {
  if (!ID_PATTERNS.draft.test(draftId) || raw.length === 0 || raw.length > ENGINE_PHOTO_MAX_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) engineSiteFail('engine_private_photo_invalid');
  const image = sharp(raw, { limitInputPixels: 24_000_000, failOn: 'error', animated: false });
  const metadata = await image.metadata();
  const formats: Readonly<Record<string, string>> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const format = formats[metadata.format ?? ''];
  if (format !== contentType || !metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64 ||
      (metadata.pages ?? 1) !== 1) engineSiteFail('engine_private_photo_invalid');
  const canonical = await image.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  return persistEnginePrivateAsset(db, storage, { ownerId, draftId, orderId: null, kind: 'child_photo', contentType: 'image/jpeg' }, canonical);
}
