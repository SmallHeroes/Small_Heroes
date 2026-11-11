import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertEngineStorageProjectBinding } from './storage-project';

export const ENGINE_PRIVATE_BUCKET = 'engine-site-private';
export interface EnginePrivateStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  sign(key: string, downloadName?: 'small-heroes-book.pdf'): Promise<string>;
}
const safeKey = (key: string) => {
  if (!/^[a-f0-9]{64}\/[a-f0-9]{64}\/[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(key)) throw Error('engine_private_key_invalid');
};
/** No public URL, bucket creation, upsert or default-bucket fallback. SDK injection keeps tests key-free. */
export function enginePrivateStorage(client: SupabaseClient): EnginePrivateStorage {
  async function bucket(key: string) {
    safeKey(key);
    const result = await client.storage.getBucket(ENGINE_PRIVATE_BUCKET);
    if (result.error || !result.data || result.data.public !== false || result.data.id !== ENGINE_PRIVATE_BUCKET)
      throw Error('engine_private_bucket_required');
    return client.storage.from(ENGINE_PRIVATE_BUCKET);
  }
  return {
    async put(key, bytes, contentType) {
      const result = await (await bucket(key)).upload(key, bytes, { contentType, upsert: false, cacheControl: '0' });
      if (result.error) throw Error('engine_private_upload_failed');
    },
    async read(key) {
      const result = await (await bucket(key)).download(key);
      if (result.error || !result.data) throw Error('engine_private_read_failed');
      return Buffer.from(await result.data.arrayBuffer());
    },
    async sign(key, downloadName) {
      const result = await (await bucket(key)).createSignedUrl(key, 60, ...(downloadName ? [{ download: downloadName }] as const : []));
      if (result.error || !result.data?.signedUrl) throw Error('engine_private_sign_failed');
      const url = new URL(result.data.signedUrl);
      if (url.protocol !== 'https:' || !url.pathname.includes(`/object/sign/${ENGINE_PRIVATE_BUCKET}/`))
        throw Error('engine_private_signed_url_invalid');
      return url.href;
    },
  };
}
/** Called only by an authorized production request, never at import time. No credential logging. */
export function productionEnginePrivateStorage() {
  const url = process.env.SUPABASE_URL;
  assertEngineStorageProjectBinding(url, process.env.DATABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error('engine_private_storage_unconfigured');
  return enginePrivateStorage(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000) }) } }));
}
