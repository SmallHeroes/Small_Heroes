import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import sharp from 'sharp';
import { isAllowedAssetUrl, inspectAsset } from '@/lib/generation-pipeline/asset-integrity';

const PUB = (p: string) => `https://proj123.supabase.co/storage/v1/object/public/book-images/${p}`;

describe('asset-integrity allowlist (SSRF-safe)', () => {
  let prevUrl: string | undefined;
  let prevBucket: string | undefined;
  beforeEach(() => {
    prevUrl = process.env.SUPABASE_URL;
    prevBucket = process.env.SUPABASE_STORAGE_BUCKET;
    process.env.SUPABASE_URL = 'https://proj123.supabase.co';
    process.env.SUPABASE_STORAGE_BUCKET = 'book-images';
  });
  afterEach(() => {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = prevUrl;
    if (prevBucket === undefined) delete process.env.SUPABASE_STORAGE_BUCKET; else process.env.SUPABASE_STORAGE_BUCKET = prevBucket;
  });

  it('allows a https URL on the configured host under the public bucket path', () => {
    expect(isAllowedAssetUrl(PUB('order-1/pages/page-1.png'))).toBe(true);
  });

  it('rejects a different host (SSRF guard)', () => {
    expect(isAllowedAssetUrl('https://evil.example.com/storage/v1/object/public/book-images/x.png')).toBe(false);
  });

  it('rejects http (non-https)', () => {
    expect(isAllowedAssetUrl('http://proj123.supabase.co/storage/v1/object/public/book-images/x.png')).toBe(false);
  });

  it('rejects a path outside the public bucket prefix', () => {
    expect(isAllowedAssetUrl('https://proj123.supabase.co/storage/v1/object/sign/book-images/x.png')).toBe(false);
    expect(isAllowedAssetUrl('https://proj123.supabase.co/other/x.png')).toBe(false);
  });

  it('rejects a different bucket', () => {
    expect(isAllowedAssetUrl('https://proj123.supabase.co/storage/v1/object/public/other-bucket/x.png')).toBe(false);
  });

  it('rejects empty / null / malformed', () => {
    expect(isAllowedAssetUrl(null)).toBe(false);
    expect(isAllowedAssetUrl('')).toBe(false);
    expect(isAllowedAssetUrl('not a url')).toBe(false);
  });

  it('is closed when SUPABASE_URL is unset (fails safe)', () => {
    delete process.env.SUPABASE_URL;
    expect(isAllowedAssetUrl(PUB('order-1/page.png'))).toBe(false);
  });

  it('inspectAsset rejects a non-allowlisted URL without any network call', async () => {
    const r = await inspectAsset('https://evil.example.com/x.png');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('url_not_allowlisted');
    expect(r.sha256).toBeNull();
  });
});

describe('inspectAsset — streaming cap + full decode + pixel cap (B7)', () => {
  const URL = 'https://proj123.supabase.co/storage/v1/object/public/book-images/o/p.png';
  let prevUrl: string | undefined;
  beforeEach(() => { prevUrl = process.env.SUPABASE_URL; process.env.SUPABASE_URL = 'https://proj123.supabase.co'; });
  afterEach(() => { vi.restoreAllMocks(); if (prevUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = prevUrl; });

  const mockFetch = (buf: Buffer) => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(buf)); c.close(); } });
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, headers: new Headers(), body, arrayBuffer: async () => buf } as unknown as Response);
  };
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();

  it('accepts a valid image (ok + mime + dims + sha)', async () => {
    mockFetch(await png(8, 8));
    const r = await inspectAsset(URL);
    expect(r).toMatchObject({ ok: true, mime: 'image/png', width: 8, height: 8 });
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a header-valid-but-corrupt-pixels file (full decode fails)', async () => {
    const buf = Buffer.from(await png(8, 8));
    buf.fill(0, 40); // keep the PNG signature/IHDR, trash the pixel (IDAT) data
    mockFetch(buf);
    const r = await inspectAsset(URL);
    expect(r.ok).toBe(false);
    expect(['not_decodable', 'pixel_limit']).toContain(r.error);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/); // still hashed
  });

  it('aborts mid-stream when the body exceeds the byte cap', async () => {
    mockFetch(Buffer.alloc(2048, 7));
    const r = await inspectAsset(URL, { maxBytes: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('too_large');
  });

  it('rejects a decompression bomb beyond the pixel cap', async () => {
    mockFetch(await png(64, 64)); // 4096 px
    const r = await inspectAsset(URL, { maxPixels: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('pixel_limit');
  });
});
