import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QaAnchorCacheEntry } from '../qa-console-anchor';

// Durable layer (0096 M5a): persistJson (store) writes the candidate; downloadOrderArtifactJson
// (image-storage) reads it back in a later invocation. Partial-mock both so the real /tmp fast-path
// and isServerlessRuntime stay intact.
const persistJson = vi.fn(async () => ({
  url: 'https://staging/x',
  storageKey: 'orders/qa-anchor/k/candidate.json',
}));
const downloadOrderArtifactJson = vi.fn<(input: unknown) => Promise<unknown>>(async () => null);

vi.mock('@/lib/generation-pipeline/runtime-artifact-store', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/runtime-artifact-store')
  >();
  return { ...actual, persistJson };
});
vi.mock('@/lib/image-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-storage')>();
  return { ...actual, downloadOrderArtifactJson };
});

const ENTRY: QaAnchorCacheEntry = {
  cacheKey: 'lion_bedtime__fp123__wh456',
  storyFileKey: 'lion_bedtime',
  companionId: 'lion_shaket',
  wardrobeLockHash: 'wh456',
  childPhotoFingerprint: 'fp123',
  anchorUrl: 'https://staging.supabase.co/.../character-anchors/child-canonical-method-b-qa.png',
  localPath: '/tmp/small-heroes/qa-anchors/lion_bedtime__fp123__wh456/anchor.png',
  approved: false,
  resemblanceScore: 0.9,
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('qa-console-anchor durable candidate (0096 M5a)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'preview';
    vi.clearAllMocks();
    vi.resetModules();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved;
  });

  it('persists the candidate to Supabase on a serverless save', async () => {
    const mod = await import('../qa-console-anchor');
    await mod.saveQaAnchorCache(ENTRY);
    expect(persistJson).toHaveBeenCalledWith('qa-anchor', ENTRY.cacheKey, 'candidate.json', ENTRY);
  });

  it('reads the durable candidate on a serverless load (separate invocation)', async () => {
    downloadOrderArtifactJson.mockResolvedValueOnce(ENTRY);
    const mod = await import('../qa-console-anchor');
    const loaded = await mod.loadQaAnchorCache(ENTRY.cacheKey);
    expect(downloadOrderArtifactJson).toHaveBeenCalledWith({
      orderId: 'qa-anchor',
      kind: ENTRY.cacheKey,
      filename: 'candidate.json',
    });
    expect(loaded).toEqual(ENTRY);
  });

  it('approve loads durable + skips the local-PNG existsSync on serverless', async () => {
    downloadOrderArtifactJson.mockResolvedValue(ENTRY);
    const mod = await import('../qa-console-anchor');
    const approved = await mod.approveQaAnchorCache(ENTRY.cacheKey);
    expect(approved.approved).toBe(true);
    expect(persistJson).toHaveBeenCalled(); // re-saved durable as approved
  });
});
