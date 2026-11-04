import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { ENGINE_PRIVATE_BUCKET, enginePrivateStorage, type EnginePrivateStorage } from '../private-storage';
import { assetBytesSha256, loadEnginePrivateAsset, readEnginePrivateBytes, uploadEngineChildPhoto, verifyEngineOrderPhoto } from '../private-assets';
import { handleEnginePhotoRead, handleEnginePhotoUpload } from '../private-http';
import { ENGINE_PHOTO_MAX_BYTES } from '../photo-policy';

const rows = new Map<string, unknown>();
const objects = new Map<string, Buffer>();
let databaseSafe = true;
const db = { $queryRaw: async () => [{ safe: databaseSafe }], wizardSession: {
  create: async ({ data }: { data: { sessionId: string; data: unknown } }) => { rows.set(data.sessionId, data.data); return data; },
  findUnique: async ({ where }: { where: { sessionId: string } }) => rows.has(where.sessionId) ? { data: rows.get(where.sessionId) } : null,
} } as unknown as PrismaClient;
const storage: EnginePrivateStorage = {
  put: vi.fn(async (key, bytes) => { objects.set(key, Buffer.from(bytes)); }),
  read: vi.fn(async key => Buffer.from(objects.get(key)!)),
  sign: vi.fn(async key => `https://storage.example.invalid/storage/v1/object/sign/${ENGINE_PRIVATE_BUCKET}/${key}?synthetic-token`),
};
const parent = { id: 'synthetic_parent', name: null, email: 'synthetic@example.invalid' };
const photo = () => sharp({ create: { width: 80, height: 100, channels: 3, background: '#123456' } }).png().toBuffer();
const ports = () => ({ enabled: true, db, storage: () => storage, parent: async () => parent });
const request = (bytes: Uint8Array, contentType = 'image/png', origin = 'https://synthetic.invalid') =>
  new NextRequest('https://synthetic.invalid/api/engine-site/v1/photos', { method: 'POST',
    headers: { origin, 'content-type': contentType, 'x-engine-draft': 'd_synthetic0001' }, body: bytes as BodyInit });
beforeEach(() => { rows.clear(); objects.clear(); vi.clearAllMocks(); databaseSafe = true; });

describe('private photo lifecycle with synthetic pixels', () => {
  it('sanitizes actual image bytes, stores no public URL and binds owner/draft before ordering', async () => {
    const asset = await uploadEngineChildPhoto(db, storage, parent.id, 'd_synthetic0001', 'image/png', await photo());
    expect(asset).toMatchObject({ ownerId: parent.id, kind: 'child_photo', contentType: 'image/jpeg', orderId: null });
    expect(asset.key).not.toContain(parent.id); expect(JSON.stringify(asset)).not.toContain('https:');
    expect(asset.sha256).toBe(assetBytesSha256(objects.get(asset.key)!));
    expect(await sharp(objects.get(asset.key)!).metadata()).toMatchObject({ format: 'jpeg', width: 80, height: 100 });
    expect(await verifyEngineOrderPhoto(db, asset.assetId, parent.id, 'd_synthetic0001')).toEqual(asset);
    for (const [owner, draft] of [['foreign_parent', 'd_synthetic0001'], [parent.id, 'd_otherdraft01']])
      await expect(verifyEngineOrderPhoto(db, asset.assetId, owner, draft)).rejects.toThrow('access_denied');
    expect(await readEnginePrivateBytes(storage, asset)).toEqual(objects.get(asset.key));
    objects.set(asset.key, Buffer.from('changed'));
    await expect(readEnginePrivateBytes(storage, asset)).rejects.toThrow('bytes_changed');
  });
  it('rejects forged MIME, invalid image, excessive bytes, animated/invalid dimensions, database exposure and key drift', async () => {
    for (const [mime, bytes] of [['image/jpeg', await photo()], ['image/png', Buffer.from('<svg/>')],
      ['image/png', Buffer.alloc(ENGINE_PHOTO_MAX_BYTES + 1)], ['image/png', await sharp({ create: {
        width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer()]] as const)
      await expect(uploadEngineChildPhoto(db, storage, parent.id, 'd_synthetic0001', mime, bytes)).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled();
    databaseSafe = false;
    await expect(uploadEngineChildPhoto(db, storage, parent.id, 'd_synthetic0001', 'image/png', await photo())).rejects.toThrow('private_database_required');
    databaseSafe = true;
    const asset = await uploadEngineChildPhoto(db, storage, parent.id, 'd_synthetic0001', 'image/png', await photo());
    rows.set(`engine-site-asset/v1/${asset.assetId}`, { ...asset, key: 'changed' });
    await expect(loadEnginePrivateAsset(db, asset.assetId)).rejects.toThrow('binding_invalid');
  });
  it('authenticates and validates origin/stream before any storage call and exposes only id/hash', async () => {
    expect((await handleEnginePhotoUpload(request(await photo()), { ...ports(), enabled: false })).status).toBe(404);
    expect((await handleEnginePhotoUpload(request(await photo()), { ...ports(), parent: async () => null })).status).toBe(401);
    expect((await handleEnginePhotoUpload(request(await photo(), 'image/png', 'https://foreign.invalid'), ports())).status).toBe(403);
    expect((await handleEnginePhotoUpload(request(Buffer.alloc(ENGINE_PHOTO_MAX_BYTES + 1)), ports())).status).toBe(422);
    expect(storage.put).not.toHaveBeenCalled();
    const response = await handleEnginePhotoUpload(request(await photo()), ports());
    expect(response.status).toBe(201); const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['assetId', 'sha256']);
    const get = new NextRequest('https://synthetic.invalid/api/photo');
    expect((await handleEnginePhotoRead(get, body.assetId, { ...ports(), parent: async () => ({ ...parent, id: 'foreign_parent' }) })).status).toBe(404);
    expect((await handleEnginePhotoRead(get, body.assetId, { ...ports(), parent: async () => null })).status).toBe(401);
    const read = await handleEnginePhotoRead(get, body.assetId, ports());
    expect(read.status).toBe(307); expect(read.headers.get('cache-control')).toContain('no-store');
    expect(storage.sign).toHaveBeenCalledTimes(1);
  });
});
describe('real Supabase SDK boundary, synthetic injected client', () => {
  it('refuses public/missing buckets and never asks for a public URL or upsert', async () => {
    const upload = vi.fn(async () => ({ error: null })); const sign = vi.fn(async () => ({ error: null,
      data: { signedUrl: `https://storage.invalid/storage/v1/object/sign/${ENGINE_PRIVATE_BUCKET}/synthetic?token=fixture` } }));
    const getBucket = vi.fn(async () => ({ error: null, data: { id: ENGINE_PRIVATE_BUCKET, public: true } }));
    const from = vi.fn(() => ({ upload, createSignedUrl: sign }));
    const client = { storage: { getBucket, from } } as unknown as SupabaseClient;
    const privateStore = enginePrivateStorage(client);
    const key = `${'a'.repeat(64)}/${'b'.repeat(64)}/${randomUUID()}/${'c'.repeat(64)}`;
    await expect(privateStore.put(key, Buffer.from('synthetic'), 'image/jpeg')).rejects.toThrow('private_bucket_required');
    expect(from).not.toHaveBeenCalled();
    getBucket.mockResolvedValue({ error: null, data: { id: ENGINE_PRIVATE_BUCKET, public: false } });
    await privateStore.put(key, Buffer.from('synthetic'), 'image/jpeg');
    expect(from).toHaveBeenCalledWith(ENGINE_PRIVATE_BUCKET);
    expect(upload).toHaveBeenCalledWith(key, expect.any(Buffer), { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
    expect(await privateStore.sign(key)).toContain('/object/sign/'); expect(sign).toHaveBeenCalledWith(key, 60);
    await expect(privateStore.put('../escape', Buffer.from('x'), 'image/jpeg')).rejects.toThrow('key_invalid');
  });
});
