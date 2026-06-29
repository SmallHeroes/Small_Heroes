import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
