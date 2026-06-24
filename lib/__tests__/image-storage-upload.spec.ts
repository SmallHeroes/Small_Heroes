import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadOrderSubpathAsset } from '../image-storage';

/**
 * Validates the serverless-hardened Supabase upload: a POST that reaches Supabase (object
 * stored) but whose client response hangs/times out must NOT fail the render — the
 * exists-check treats the stored object as success. (Root cause 2026-06-23: supabase-js
 * upload returns 200 + ObjectCreated every attempt yet the function never sees success.)
 */
const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  SUPABASE_STORAGE_BUCKET: 'book-images',
};

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  saved.SUPABASE_UPLOAD_MAX_ATTEMPTS = process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS;
  saved.SUPABASE_UPLOAD_TIMEOUT_MS = process.env.SUPABASE_UPLOAD_TIMEOUT_MS;
  process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS = '1'; // keep tests fast (no backoff)
  process.env.SUPABASE_UPLOAD_TIMEOUT_MS = '60';
});
afterEach(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const okUploadResponse = () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () => '{"Key":"book-images/orders/o1/x.png"}',
});

const args = { orderId: 'o1', subpath: 'character-anchors/child-canonical-method-b-a1.png', buffer: Buffer.from('PNGDATA'), contentType: 'image/png' };

describe('uploadOrderSubpathAsset — serverless-hardened upload', () => {
  it('happy path: direct REST POST with x-upsert + Content-Length, returns public URL', async () => {
    const calls: Array<{ url: string; method?: string; headers?: Record<string, string> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method, headers: init?.headers as Record<string, string> });
      return okUploadResponse() as unknown as Response;
    }));

    const out = await uploadOrderSubpathAsset(args);
    expect(out).toBe('https://proj.supabase.co/storage/v1/object/public/book-images/orders/o1/character-anchors/child-canonical-method-b-a1.png');

    const post = calls.find((c) => c.method === 'POST')!;
    expect(post).toBeTruthy();
    expect(post.url).toContain('/storage/v1/object/book-images/orders/o1/character-anchors/');
    expect(post.headers!['x-upsert']).toBe('true');
    expect(post.headers!['Content-Length']).toBe(String(args.buffer.length));
    expect(post.headers!['Authorization']).toContain('service-role-test-key');
  });

  it('upload times out (object stored server-side) → exists-check HEAD ok → treated as success', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        // Simulate the serverless hang: never resolves until the per-attempt timeout aborts.
        return await new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted due to timeout')));
        });
      }
      // HEAD exists-check: the object IS stored.
      return { ok: true, status: 200 } as unknown as Response;
    }));

    const out = await uploadOrderSubpathAsset(args);
    expect(out).toContain('/object/public/book-images/orders/o1/character-anchors/');
  });

  it('upload fails AND object absent → throws with the call-site error prefix', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') throw new Error('fetch failed');
      return { ok: false, status: 404 } as unknown as Response; // HEAD: not stored
    }));

    await expect(uploadOrderSubpathAsset(args)).rejects.toThrow(/Supabase upload failed \(orders\/o1\/character-anchors\/.*\): fetch failed/);
  });
});
