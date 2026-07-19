import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client so createSignedUrl is exercised without a real project.
const createSignedUrl = vi.fn(async (key: string, ttl: number) => ({ data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${key}?token=t&exp=${ttl}` }, error: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.SUPABASE_PRIVATE_STORAGE_BUCKET = 'child-photos-private';
  createSignedUrl.mockClear();
});

describe('Track-4 Unit 1 — private child-photo signing infrastructure', () => {
  it('isBareStorageKey distinguishes a private KEY from a legacy URL / data URL', async () => {
    const { isBareStorageKey } = await import('@/lib/image-storage');
    expect(isBareStorageKey('wizard/char-photos/1-a.jpg')).toBe(true);
    expect(isBareStorageKey('orders/o1/references/main-child-1.jpg')).toBe(true);
    expect(isBareStorageKey('https://proj.supabase.co/storage/v1/object/public/book-images/x.jpg')).toBe(false);
    expect(isBareStorageKey('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(isBareStorageKey('')).toBe(false);
    expect(isBareStorageKey(null)).toBe(false);
  });

  it('toFetchableChildPhotoReference SIGNS a bare key (short-lived, never persisted)', async () => {
    const { toFetchableChildPhotoReference } = await import('@/lib/image-storage');
    const out = await toFetchableChildPhotoReference('wizard/char-photos/1-a.jpg', 600);
    expect(out).toContain('/object/sign/wizard/char-photos/1-a.jpg');
    expect(out).toContain('exp=600');
    expect(createSignedUrl).toHaveBeenCalledWith('wizard/char-photos/1-a.jpg', 600);
  });

  it('toFetchableChildPhotoReference PASSES THROUGH a legacy public URL and a data URL (backward compatible, no signing)', async () => {
    const { toFetchableChildPhotoReference } = await import('@/lib/image-storage');
    const url = 'https://proj.supabase.co/storage/v1/object/public/book-images/wizard/char-photos/1-a.jpg';
    expect(await toFetchableChildPhotoReference(url)).toBe(url);
    expect(await toFetchableChildPhotoReference('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(await toFetchableChildPhotoReference(null)).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled(); // pass-through must never touch storage
  });

  it('storeChildPhotoToPrivateBucket returns a KEY, not a URL', async () => {
    const { storeChildPhotoToPrivateBucket, isBareStorageKey } = await import('@/lib/image-storage');
    // uploadToSupabaseWithRetry hits a REST endpoint; stub global fetch so the upload "succeeds".
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    try {
      const key = await storeChildPhotoToPrivateBucket({ buffer: Buffer.from('x'), contentType: 'image/jpeg', key: 'wizard/char-photos/fixed.jpg' });
      expect(key).toBe('wizard/char-photos/fixed.jpg');
      expect(isBareStorageKey(key)).toBe(true);
      expect(key).not.toMatch(/^https?:\/\//);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
