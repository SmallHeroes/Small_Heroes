import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase client so createSignedUrl is exercised without a real project.
const createSignedUrl = vi.fn(async (key: string, ttl: number) => ({ data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${key}?token=t&exp=${ttl}` }, error: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));

const SAVED: Record<string, string | undefined> = {};
const KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PRIVATE_STORAGE_BUCKET'] as const;
beforeEach(() => {
  for (const k of KEYS) SAVED[k] = process.env[k];
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.SUPABASE_PRIVATE_STORAGE_BUCKET = 'child-photos-private';
  createSignedUrl.mockClear();
});
afterEach(() => {
  for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
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

  // (storeChildPhotoToPrivateBucket's key-return contract is covered by isBareStorageKey above + the resolver tests;
  //  its actual upload is exercised by the real-Supabase staging test in the 1b cutover, not here — a mocked global
  //  fetch would race the parallel suite.)
});
