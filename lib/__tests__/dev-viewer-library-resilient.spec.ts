import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /api/dev/viewer/library 500'd on staging: the route had no error handling and
 * listDevViewerLibrary hard-coupled two independent sources — cloud auditions (Supabase storage,
 * made serverless-safe in 0096 M5b) and generated-book orders (Postgres). If EITHER threw, the whole
 * endpoint returned an opaque 500. These tests pin the resilience contract: a failure in one source
 * is isolated + logged, and the library still lists from the other (so Supabase auditions render in
 * serverless even when the DB query hiccups).
 */

vi.mock('@/lib/style01-audition-preview', () => ({
  listStyle01DiniAuditions: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { generatedBook: { findMany: vi.fn() } },
}));

const AUDITION = {
  dir: 'qa-leo-20260622-083000',
  root: 'outputs' as const,
  mtimeMs: 2000,
  pageCount: 10,
  label: 'qa-leo',
};

const BOOK_ROW = {
  id: 'book1',
  title: 'ליאו',
  createdAt: new Date(1000),
  order: {
    id: 'order1',
    paymentId: 'pay_abc',
    childName: 'נועה',
    childImageUrl: 'https://x/p.jpg',
    status: 'paid',
    illustrationStyle: 'pencil_watercolor',
    storyDirection: 'adventure',
    bookName: null,
  },
};

let listAuditions: ReturnType<typeof vi.fn>;
let findMany: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const audMod = await import('@/lib/style01-audition-preview');
  const prismaMod = await import('@/lib/prisma');
  listAuditions = vi.mocked(audMod.listStyle01DiniAuditions);
  findMany = vi.mocked(prismaMod.prisma.generatedBook.findMany);
  listAuditions.mockReset();
  findMany.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('listDevViewerLibrary resilience', () => {
  it('merges both sources, newest first, when both succeed', async () => {
    listAuditions.mockResolvedValue([AUDITION]);
    findMany.mockResolvedValue([BOOK_ROW] as never);
    const { listDevViewerLibrary } = await import('@/lib/dev-viewer-library');

    const entries = await listDevViewerLibrary();
    expect(entries.map((e) => e.kind)).toEqual(['audition', 'order']); // mtime 2000 > 1000
    expect(entries.find((e) => e.kind === 'order')?.accessKey).toBe('pay_abc');
  });

  it('still lists Supabase auditions when the Postgres order query throws (no 500)', async () => {
    listAuditions.mockResolvedValue([AUDITION]);
    findMany.mockRejectedValue(new Error('db connection reset'));
    const { listDevViewerLibrary } = await import('@/lib/dev-viewer-library');

    const entries = await listDevViewerLibrary();
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('audition');
  });

  it('still lists orders when the audition (Supabase) source throws', async () => {
    listAuditions.mockRejectedValue(new Error('supabase list failed'));
    findMany.mockResolvedValue([BOOK_ROW] as never);
    const { listDevViewerLibrary } = await import('@/lib/dev-viewer-library');

    const entries = await listDevViewerLibrary();
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('order');
  });

  it('returns [] (never throws) when BOTH sources fail', async () => {
    listAuditions.mockRejectedValue(new Error('supabase down'));
    findMany.mockRejectedValue(new Error('db down'));
    const { listDevViewerLibrary } = await import('@/lib/dev-viewer-library');

    await expect(listDevViewerLibrary()).resolves.toEqual([]);
  });
});
