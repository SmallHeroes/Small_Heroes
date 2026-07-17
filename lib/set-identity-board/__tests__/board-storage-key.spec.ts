import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setIdentityBoardStorageKey } from '../liveResolverDeps';

/**
 * (P0-4a) The storage half of "bytes are not swappable".
 *
 * Two independent properties are proven here, and they are independent on purpose — either one alone leaves a
 * hole:
 *   1. The KEY is CONTENT-ADDRESSED. Different bytes ⇒ different key, always. An approved entry's `storageKey`
 *      therefore addresses the approved bytes and nothing else; there is no key you can write new bytes to that an
 *      existing approval already points at.
 *   2. The WRITE is NO-OVERWRITE (`x-upsert:false`). Even a same-key write cannot clobber. This is what stops the
 *      "re-render at the same key" move that voided approvals silently.
 *
 * The legacy upsert:true behaviour of every OTHER caller of image-storage.ts is asserted UNCHANGED in
 * `lib/__tests__/image-storage-upload.spec.ts` — this is an additive path, not a change of the shared one.
 */

/** The stored object, per test. `null` = the key is empty. */
let storedBytes: Buffer | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: async () =>
          storedBytes
            ? { data: { arrayBuffer: async () => storedBytes as unknown as ArrayBuffer }, error: null }
            : { data: null, error: { message: 'not found' } },
      }),
    },
  }),
}));

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  SUPABASE_STORAGE_BUCKET: 'book-images',
};

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  storedBytes = null;
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  saved.SUPABASE_UPLOAD_MAX_ATTEMPTS = process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS;
  process.env.SUPABASE_UPLOAD_MAX_ATTEMPTS = '1'; // no backoff — keep the spec fast
});
afterEach(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const IDENTITY = {
  storyKey: 'synthetic_story',
  setIdentityId: 'set_alpha',
  styleId: 'soft_hand_drawn_storybook',
  setDefinitionHash: 'a'.repeat(64),
  assetSha256: 'b'.repeat(64),
};

// ─────────────────────────────────────────────────────────────────────────────
// (1) The key is content-addressed
// ─────────────────────────────────────────────────────────────────────────────

describe('setIdentityBoardStorageKey — CONTENT-ADDRESSED (P0-4a)', () => {
  it('embeds the asset sha256, so the key CHANGES when the bytes change', () => {
    const original = setIdentityBoardStorageKey(IDENTITY);
    const reRendered = setIdentityBoardStorageKey({ ...IDENTITY, assetSha256: 'c'.repeat(64) });

    expect(original).toContain(IDENTITY.assetSha256);
    expect(original).not.toBe(reRendered);
    // The whole point: new bytes are a DIFFERENT OBJECT. They cannot land where the approved ones live.
    expect(reRendered).not.toContain(IDENTITY.assetSha256);
  });

  it('changes when ANY component of the registry identity changes (no two boards share a key)', () => {
    const base = setIdentityBoardStorageKey(IDENTITY);
    const variants = [
      { ...IDENTITY, storyKey: 'another_story' },
      { ...IDENTITY, setIdentityId: 'set_beta' },
      { ...IDENTITY, styleId: 'detailed_whimsical_world' },
      { ...IDENTITY, setDefinitionHash: 'd'.repeat(64) },
      { ...IDENTITY, assetSha256: 'e'.repeat(64) },
    ];
    for (const v of variants) expect(setIdentityBoardStorageKey(v)).not.toBe(base);
    expect(new Set(variants.map((v) => setIdentityBoardStorageKey(v))).size).toBe(variants.length);
  });

  it('is deterministic and stays inside the board registry prefix', () => {
    expect(setIdentityBoardStorageKey(IDENTITY)).toBe(setIdentityBoardStorageKey({ ...IDENTITY }));
    expect(setIdentityBoardStorageKey(IDENTITY).startsWith('set-identity-boards/')).toBe(true);
  });

  it('sanitizes hostile id segments — a key can never traverse out of the board prefix', () => {
    for (const hostile of ['../../etc/passwd', '..', '.', '', '/absolute/path']) {
      const key = setIdentityBoardStorageKey({ ...IDENTITY, setIdentityId: hostile });
      expect(key.startsWith('set-identity-boards/')).toBe(true);
      expect(key).not.toContain('..'); // no parent-dir hop
      expect(key.split('/')).toHaveLength(5); // prefix/story/style/identity/file — fixed depth, no extra segments
      expect(key.split('/').some((s) => s.length === 0 || /^\.+$/.test(s))).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) The write is no-overwrite
// ─────────────────────────────────────────────────────────────────────────────

describe('uploadContentAddressedObjectNoOverwrite — NO-OVERWRITE (P0-4a)', () => {
  const bytes = Buffer.from('BOARD-PNG-BYTES');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const key = setIdentityBoardStorageKey({ ...IDENTITY, assetSha256: sha });

  async function subject() {
    return (await import('@/lib/image-storage')).uploadContentAddressedObjectNoOverwrite;
  }

  const okUpload = () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => '{}',
  });

  it('sends x-upsert:false — the gateway REFUSES to replace an existing object', async () => {
    const headers: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') headers.push(init.headers as Record<string, string>);
        return okUpload() as unknown as Response;
      })
    );

    const out = await (await subject())({ key, buffer: bytes, contentType: 'image/png', expectedSha256: sha });

    expect(headers[0]['x-upsert']).toBe('false'); // NOT 'true' — this is the whole fix
    expect(out.storageKey).toBe(key);
    expect(out.alreadyPresent).toBe(false);
    expect(out.url).toBe(`https://proj.supabase.co/storage/v1/object/public/book-images/${key}`);
  });

  it('is idempotent: identical bytes already at the key → no re-upload, no error', async () => {
    storedBytes = bytes;
    const fetchSpy = vi.fn(async () => okUpload() as unknown as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const out = await (await subject())({ key, buffer: bytes, contentType: 'image/png', expectedSha256: sha });

    expect(out.alreadyPresent).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled(); // a re-run of the mint tool costs nothing and changes nothing
  });

  it('REFUSES when the key already holds DIFFERENT bytes (sha collision / corrupted object)', async () => {
    storedBytes = Buffer.from('SOMETHING-ELSE-ENTIRELY');
    vi.stubGlobal('fetch', vi.fn(async () => okUpload() as unknown as Response));

    await expect(
      (await subject())({ key, buffer: bytes, contentType: 'image/png', expectedSha256: sha })
    ).rejects.toThrow(/refusing to overwrite/);
  });

  it('REFUSES a key that is not content-addressed (the invariant is enforced, not trusted)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okUpload() as unknown as Response));
    await expect(
      (await subject())({
        key: 'set-identity-boards/synthetic_story/style/set_alpha/board.png', // no sha in the key
        buffer: bytes,
        contentType: 'image/png',
        expectedSha256: sha,
      })
    ).rejects.toThrow(/is not content-addressed/);
  });

  it('REFUSES when the declared sha does not match the buffer (mint cannot mis-file bytes)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okUpload() as unknown as Response));
    const lie = 'f'.repeat(64);
    await expect(
      (await subject())({
        key: setIdentityBoardStorageKey({ ...IDENTITY, assetSha256: lie }),
        buffer: bytes,
        contentType: 'image/png',
        expectedSha256: lie,
      })
    ).rejects.toThrow(/does not match expectedSha256/);
  });
});
