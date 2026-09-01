import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * (Track-4 Unit 1, item 5) A failed child-photo deletion must be OBSERVABLE (structured log + a greppable
 * `child_photo_deletion_failed` metric event), never a silent console.warn — so the sweeper retries it.
 */
const orderFindUnique = vi.fn();
const orderUpdate = vi.fn(async () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: orderFindUnique, update: orderUpdate, findMany: vi.fn(async () => []) } } }));
const remove = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({
  error: { message: 'storage boom' },
})); // deletion FAILS
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ remove, list: async () => ({ data: [], error: null }) }) } }),
}));

const PUBLIC_URL = 'https://proj.supabase.co/storage/v1/object/public/book-images/wizard/char-photos/1-a.jpg';

describe('child-photo deletion observability', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'] as const;
  beforeEach(() => {
    for (const k of KEYS) SAVED[k] = process.env[k];
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_STORAGE_BUCKET = 'book-images';
    orderFindUnique.mockResolvedValue({ id: 'ord1', status: 'ready', packageStatus: 'done', childImageUrl: PUBLIC_URL, characterAnchors: null });
    remove.mockClear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore(); logSpy.mockRestore();
    for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  });

  it('a failed deletion emits a structured error log AND a child_photo_deletion_failed metric event (not silence)', async () => {
    const { tryDeleteOriginalChildPhotoAfterGeneration } = await import('@/lib/child-photo-deletion');
    await tryDeleteOriginalChildPhotoAfterGeneration('ord1');

    // structured error log (createLogger → console.error with subsystem tag)
    const errLines = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errLines).toMatch(/child-photo-deletion/);
    expect(errLines).toMatch(/still reachable|FAILED/i);
    // greppable metric event (logServerEvent → console.log '[Analytics]' ... child_photo_deletion_failed)
    const analytics = logSpy.mock.calls.filter((c) => String(c[0]).includes('[Analytics]')).map((c) => String(c[1] ?? '')).join('\n');
    expect(analytics).toMatch(/child_photo_deletion_failed/);
    // the order was NOT scrubbed (childImageUrl not nulled) because deletion failed — it awaits sweeper retry
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('compensating cleanup deletes only the exact release draft reference key', async () => {
    remove.mockResolvedValueOnce({ error: null });
    const { deleteDraftChildPhotoUpload } = await import('@/lib/child-photo-deletion');

    await deleteDraftChildPhotoUpload({
      publicUrl:
        'https://proj.supabase.co/storage/v1/object/public/book-images/' +
        'orders/draft-release-1/references/main-child-123.png',
      draftScopeId: 'draft-release-1',
    });

    expect(remove).toHaveBeenCalledWith([
      'orders/draft-release-1/references/main-child-123.png',
    ]);
  });

  it('refuses to compensate a photo outside the exact draft scope', async () => {
    const { deleteDraftChildPhotoUpload } = await import('@/lib/child-photo-deletion');

    await expect(deleteDraftChildPhotoUpload({
      publicUrl:
        'https://proj.supabase.co/storage/v1/object/public/book-images/' +
        'orders/draft-other/references/main-child-123.png',
      draftScopeId: 'draft-release-1',
    })).rejects.toThrow('draft_child_photo_cleanup_scope_mismatch');

    expect(remove).not.toHaveBeenCalled();
  });
});
