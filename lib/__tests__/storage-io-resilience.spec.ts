import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P0 storage resilience: an upload failure must NOT bubble as a generic render failure (which makes
 * the engine re-run GPT). Persistence is hardened (retry + HEAD-net + idempotent content-hash keys)
 * and, when it genuinely fails, throws a TAGGED ImagePersistenceError the render loop treats as
 * "do not regenerate".
 */

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'SUPABASE_PERSIST_MAX_ATTEMPTS',
  'SUPABASE_PERSIST_TIMEOUT_MS',
];
let snap: Record<string, string | undefined>;
beforeEach(() => {
  snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'role-key';
  process.env.SUPABASE_STORAGE_BUCKET = 'book-images';
  process.env.SUPABASE_PERSIST_MAX_ATTEMPTS = '2';
  process.env.SUPABASE_PERSIST_TIMEOUT_MS = '1000';
  vi.resetModules();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

type FetchResp = { ok: boolean; status: number; headers: { get: () => string | null }; text: () => Promise<string> };
function resp(ok: boolean, status: number): FetchResp {
  return { ok, status, headers: { get: () => null }, text: async () => '' };
}

/** Mock fetch: POST = upload endpoint (behavior), HEAD = supabaseObjectExists (headOk). */
function makeFetch(opts: { post: 'ok' | 'abort'; headOk: boolean }) {
  return vi.fn(async (_input: unknown, init?: { method?: string }) => {
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'HEAD') return resp(opts.headOk, opts.headOk ? 200 : 404);
    if (method === 'POST') {
      if (opts.post === 'abort') {
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        throw e;
      }
      return resp(true, 200);
    }
    return resp(true, 200);
  });
}

const postUrls = (m: ReturnType<typeof vi.fn>): string[] =>
  m.mock.calls.filter((c) => (c[1] as { method?: string })?.method === 'POST').map((c) => String(c[0]));

describe('storeImageFromBuffer persistence', () => {
  it('throws a tagged ImagePersistenceError when upload fails after budget + HEAD-net', async () => {
    vi.stubGlobal('fetch', makeFetch({ post: 'abort', headOk: false }));
    const mod = await import('@/lib/image-storage');
    await expect(
      mod.storeImageFromBuffer({ buffer: Buffer.from('img-bytes'), orderId: 'o1', pageNumber: 3 })
    ).rejects.toSatisfy((e: unknown) => mod.isImagePersistenceError(e));
  });

  it('recovers via HEAD when the POST aborts but the object is actually stored (no error, no regenerate)', async () => {
    vi.stubGlobal('fetch', makeFetch({ post: 'abort', headOk: true }));
    const mod = await import('@/lib/image-storage');
    const url = await mod.storeImageFromBuffer({ buffer: Buffer.from('img-bytes'), orderId: 'o1', pageNumber: 3 });
    expect(url).toContain('/storage/v1/object/public/book-images/orders/o1/pages/page-003-');
  });

  it('uses a deterministic content-hash key (no Date.now): same buffer → same key, different buffer → different key', async () => {
    const fetchMock = makeFetch({ post: 'ok', headOk: true });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('@/lib/image-storage');
    const buf = Buffer.from('same-image-content');

    await mod.storeImageFromBuffer({ buffer: buf, orderId: 'o1', pageNumber: 3 });
    await mod.storeImageFromBuffer({ buffer: buf, orderId: 'o1', pageNumber: 3 });
    const urls = postUrls(fetchMock);
    expect(urls[0]).toBe(urls[1]); // deterministic across calls
    expect(urls[0]).toMatch(/page-003-[0-9a-f]{16}\.png$/); // content-hash, not a timestamp

    await mod.storeImageFromBuffer({ buffer: Buffer.from('DIFFERENT-content'), orderId: 'o1', pageNumber: 3 });
    expect(postUrls(fetchMock)[2]).not.toBe(urls[0]); // regenerated image → new key
  });
});

describe('uploadToSupabaseWithRetry honors the persistence budget', () => {
  it('retries up to the configured attempts before failing', async () => {
    const fetchMock = makeFetch({ post: 'abort', headOk: false });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('@/lib/image-storage');
    await expect(
      mod.uploadToSupabaseWithRetry({
        bucket: 'book-images',
        key: 'orders/o1/pages/page-003-abc.png',
        body: Buffer.from('x'),
        contentType: 'image/png',
        errorPrefix: 'Supabase buffer upload failed',
        attempts: 3,
        timeoutMs: 500,
      })
    ).rejects.toThrow(/Supabase buffer upload failed/);
    // 3 POST attempts were made (budget respected).
    expect(postUrls(fetchMock).length).toBe(3);
  });
});
