import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Stage-0 anchor durability: anchor_persist is split from anchor_generate so a persistence failure
 * never re-runs GPT. storeGeneratedAnchorBuffer uses the SUPABASE_PERSIST_* contract + a deterministic
 * content-hash key + HEAD recovery, and throws a tagged ImagePersistenceError on genuine failure. The
 * synthetic latency probe separates infra degradation from a too-tight budget.
 */

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'ANCHOR_PERSIST_MAX_ATTEMPTS',
  'ANCHOR_PERSIST_TIMEOUT_MS',
  'STORAGE_PROBE_TIMEOUT_MS',
  'VERCEL_REGION',
];
let snap: Record<string, string | undefined>;
beforeEach(() => {
  snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'role-key';
  process.env.SUPABASE_STORAGE_BUCKET = 'book-images';
  process.env.ANCHOR_PERSIST_MAX_ATTEMPTS = '2';
  process.env.ANCHOR_PERSIST_TIMEOUT_MS = '1000';
  process.env.STORAGE_PROBE_TIMEOUT_MS = '1000';
  process.env.VERCEL_REGION = 'iad1';
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

/** Mock fetch: POST = upload endpoint (behavior), HEAD = supabaseObjectExists / probe HEAD (headOk). */
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

describe('storeGeneratedAnchorBuffer', () => {
  it('uploads to a deterministic content-hash key and returns url + storageKey', async () => {
    const fetchMock = makeFetch({ post: 'ok', headOk: true });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('@/lib/image-storage');

    const { url, storageKey } = await mod.storeGeneratedAnchorBuffer({
      orderId: 'ord1',
      attemptSuffix: 'a1',
      buffer: Buffer.from('anchor-bytes'),
    });

    expect(storageKey).toMatch(/^orders\/ord1\/character-anchors\/child-canonical-method-b-a1-[0-9a-f]{16}\.png$/);
    expect(url).toContain('/storage/v1/object/public/book-images/orders/ord1/character-anchors/child-canonical-method-b-a1-');
    // The POST went to the object endpoint with x-upsert (idempotent retry).
    const post = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === 'POST');
    expect((post?.[1] as { headers: Record<string, string> }).headers['x-upsert']).toBe('true');
  });

  it('is deterministic: same buffer → same key, different buffer → different key', async () => {
    const fetchMock = makeFetch({ post: 'ok', headOk: true });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('@/lib/image-storage');
    const buf = Buffer.from('same-anchor');

    const a = await mod.storeGeneratedAnchorBuffer({ orderId: 'ord1', attemptSuffix: 'a1', buffer: buf });
    const b = await mod.storeGeneratedAnchorBuffer({ orderId: 'ord1', attemptSuffix: 'a1', buffer: buf });
    expect(a.storageKey).toBe(b.storageKey);

    const c = await mod.storeGeneratedAnchorBuffer({
      orderId: 'ord1',
      attemptSuffix: 'a1',
      buffer: Buffer.from('DIFFERENT'),
    });
    expect(c.storageKey).not.toBe(a.storageKey);
  });

  it('recovers via HEAD when the POST hangs but the object is actually stored (no re-GPT)', async () => {
    vi.stubGlobal('fetch', makeFetch({ post: 'abort', headOk: true }));
    const mod = await import('@/lib/image-storage');
    const { url } = await mod.storeGeneratedAnchorBuffer({
      orderId: 'ord1',
      attemptSuffix: 'a1',
      buffer: Buffer.from('anchor-bytes'),
    });
    expect(url).toContain('/character-anchors/child-canonical-method-b-a1-');
  });

  it('throws a tagged ImagePersistenceError when the upload genuinely fails (object absent)', async () => {
    const fetchMock = makeFetch({ post: 'abort', headOk: false });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('@/lib/image-storage');
    await expect(
      mod.storeGeneratedAnchorBuffer({ orderId: 'ord1', attemptSuffix: 'a1', buffer: Buffer.from('x') })
    ).rejects.toSatisfy((e: unknown) => mod.isImagePersistenceError(e));
    // The anchor persist budget (ANCHOR_PERSIST_MAX_ATTEMPTS=2) was respected.
    expect(postUrls(fetchMock).length).toBe(2);
  });
});

describe('probeSupabaseStorageLatency', () => {
  it('emits a structured probe with the required fields and never throws', async () => {
    const fetchMock = makeFetch({ post: 'ok', headOk: true });
    vi.stubGlobal('fetch', fetchMock);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await import('@/lib/image-storage');

    const probe = await mod.probeSupabaseStorageLatency({ bytes: 1024 });

    expect(probe.ok).toBe(true);
    expect(probe.bytes).toBe(1024);
    expect(probe.vercelRegion).toBe('iad1');
    expect(probe.supabaseProjectRef).toBe('proj');
    expect(probe.status).toBe(200);
    expect(probe.headStatus).toBe(200);
    const line = logSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes('storage_latency_probe'));
    expect(line).toBeTruthy();
    expect(line).toContain('supabaseProjectRef=proj');
    expect(line).toContain('vercelRegion=iad1');
    logSpy.mockRestore();
  });

  it('returns a best-effort probe (never throws) when the upload fails', async () => {
    vi.stubGlobal('fetch', makeFetch({ post: 'abort', headOk: false }));
    const mod = await import('@/lib/image-storage');
    const probe = await mod.probeSupabaseStorageLatency();
    expect(probe.ok).toBe(false);
  });
});

describe('supabaseProjectRefFromUrl', () => {
  it('extracts the project ref from the storage host', async () => {
    const mod = await import('@/lib/image-storage');
    expect(mod.supabaseProjectRefFromUrl('https://qvksgpzzosotubcbizay.supabase.co')).toBe('qvksgpzzosotubcbizay');
    expect(mod.supabaseProjectRefFromUrl(undefined)).toBe('unknown');
    expect(mod.supabaseProjectRefFromUrl('not a url')).toBe('unknown');
  });
});
