import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * (Track-4 Unit 1, item 5) A failed child-photo deletion must be OBSERVABLE (structured log + a greppable
 * `child_photo_deletion_failed` metric event), never a silent console.warn — so the sweeper retries it.
 */
const orderFindUnique = vi.fn();
const orderUpdate = vi.fn(async () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: orderFindUnique, update: orderUpdate, findMany: vi.fn(async () => []) } } }));
const remove = vi.fn(async () => ({ error: { message: 'storage boom' } })); // deletion FAILS
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ remove, list: async () => ({ data: [], error: null }) }) } }),
}));

const PUBLIC_URL = 'https://proj.supabase.co/storage/v1/object/public/book-images/wizard/char-photos/1-a.jpg';

describe('child-photo deletion observability', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_STORAGE_BUCKET = 'book-images';
    orderFindUnique.mockResolvedValue({ id: 'ord1', status: 'ready', packageStatus: 'done', childImageUrl: PUBLIC_URL, characterAnchors: null });
    remove.mockClear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { errSpy.mockRestore(); logSpy.mockRestore(); });

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
});
