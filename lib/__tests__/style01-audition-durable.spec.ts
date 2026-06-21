import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 0096 M5b: in serverless the audition manifest is persisted to / read from Supabase. Partial-mock the
// storage layer; isServerlessRuntime stays real (driven by VERCEL_ENV).
const uploadOrderArtifact = vi.fn(async () => ({ url: 'https://x', storageKey: 'k' }));
const downloadOrderArtifactJson = vi.fn<(input: unknown) => Promise<unknown>>(async () => null);
const listStorageFolder = vi.fn<(prefix: string) => Promise<{ name: string }[]>>(async () => []);

vi.mock('@/lib/image-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-storage')>();
  return { ...actual, uploadOrderArtifact, downloadOrderArtifactJson, listStorageFolder };
});

const DIR = 'qa-console-dragon_dini-bedtime-low-20260101-120000';
const MANIFEST = {
  qaConsole: true,
  storyKey: 'dragon_dini_bedtime',
  childProfile: { name: 'נועם' },
  pages: [{ pageNumber: 1, imageUrl: 'https://staging.supabase.co/.../pages/page-001.png' }],
  renderedPageNumbers: [1],
};

describe('style01 audition durable manifest (0096 M5b)', () => {
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

  it('persists the manifest to Supabase on serverless', async () => {
    const mod = await import('../style01-audition-preview');
    await mod.persistAuditionManifestDurable(DIR, MANIFEST);
    expect(uploadOrderArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'qa-auditions',
        kind: DIR,
        filename: 'manifest.json',
        contentType: 'application/json',
      })
    );
  });

  it('loads the durable manifest on serverless (no local FS)', async () => {
    downloadOrderArtifactJson.mockResolvedValueOnce(MANIFEST);
    const mod = await import('../style01-audition-preview');
    const res = await mod.loadStyle01AuditionManifest(DIR, 'outputs');
    expect(downloadOrderArtifactJson).toHaveBeenCalledWith({
      orderId: 'qa-auditions',
      kind: DIR,
      filename: 'manifest.json',
    });
    expect(res.manifest.manifestDir).toBe(DIR);
    expect(res.dirPath).toBe('');
    expect(res.manifest.pages?.[0].imageUrl).toContain('pages/page-001.png');
  });

  it('lists durable auditions with parsed mtime + label on serverless', async () => {
    listStorageFolder.mockResolvedValueOnce([{ name: DIR }]);
    downloadOrderArtifactJson.mockResolvedValueOnce(MANIFEST);
    const mod = await import('../style01-audition-preview');
    const list = await mod.listStyle01DiniAuditions();
    expect(list).toHaveLength(1);
    expect(list[0].dir).toBe(DIR);
    expect(list[0].label).toContain('dragon_dini_bedtime');
    expect(list[0].mtimeMs).toBe(Date.parse('2026-01-01T12:00:00Z'));
  });
});
