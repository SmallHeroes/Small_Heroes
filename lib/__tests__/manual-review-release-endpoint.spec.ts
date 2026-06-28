import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * #43 — the release endpoint (anchor-hold-release) must fail CLOSED for a manual-review order, and the
 * review-asset endpoint must bind an approval to the asset's current version. Mirrors the repo's route-test
 * style (vi.doMock + dynamic import).
 */

const SILENT_LOGGER = { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
const req = (body: unknown) => ({ json: async () => body }) as never;

interface PageFix { pageNumber: number; audioUrl: string | null; reviewStatus: string; imageVersion: number; approvedImageVersion: number | null }
function makeOrder(opts: {
  status?: string;
  manualReviewRequired?: boolean;
  cover?: Partial<{ coverImageUrl: string | null; coverReviewStatus: string; coverImageVersion: number; approvedCoverImageVersion: number | null }>;
  pages?: PageFix[];
} = {}) {
  return {
    id: 'o1',
    status: opts.status ?? 'needs_human_qa',
    manualReviewRequired: opts.manualReviewRequired ?? true,
    customerEmail: 'c@e.com', customerName: 'Cust', childName: 'Kid',
    paymentId: 'pay1', paymeTransactionId: null, stripeSessionId: null,
    deliveryHoldReason: 'manual_review_required',
    book: {
      coverImageUrl: 'cover.png', coverReviewStatus: 'approved', coverImageVersion: 1, approvedCoverImageVersion: 1,
      ...opts.cover,
      pages: opts.pages ?? [{ pageNumber: 1, audioUrl: 'a.mp3', reviewStatus: 'approved', imageVersion: 1, approvedImageVersion: 1 }],
      audioAsset: { url: 'aa.mp3' }, pdfUrl: 'p.pdf', readUrl: 'r',
    },
  };
}

async function loadRelease(order: unknown) {
  const update = vi.fn(async () => ({}));
  const email = vi.fn(async () => ({}));
  vi.doMock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn(async () => order), update } } }));
  vi.doMock('@/backend/lib/email', () => ({ sendBookReadyEmail: email }));
  vi.doMock('@/lib/logger', () => SILENT_LOGGER);
  const mod = await import('@/app/api/admin/anchor-hold-release/route');
  return { POST: mod.POST, update, email };
}

describe('anchor-hold-release — manual-review fail-closed (#43)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GENERATION_SECRET = 'sek';
  });

  it('blocks (409) when a page is pending — no release, no email', async () => {
    const order = makeOrder({ pages: [{ pageNumber: 1, audioUrl: null, reviewStatus: 'pending', imageVersion: 1, approvedImageVersion: null }] });
    const { POST, update, email } = await loadRelease(order);
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('blocks (409) when a page was re-rendered since approval (version mismatch)', async () => {
    const order = makeOrder({ pages: [{ pageNumber: 1, audioUrl: 'a.mp3', reviewStatus: 'approved', imageVersion: 4, approvedImageVersion: 3 }] });
    const { POST, update, email } = await loadRelease(order);
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('releases (200) + sends email when cover + every page approved at the current version', async () => {
    const { POST, update, email } = await loadRelease(makeOrder());
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready', deliveryHoldReason: null }) }));
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — an already-released order returns 200 without re-update / re-send', async () => {
    const { POST, update, email } = await loadRelease(makeOrder({ status: 'ready' }));
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyReleased).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('non-manual-review orders release without approval checks (unchanged behavior)', async () => {
    const order = makeOrder({ manualReviewRequired: false, pages: [{ pageNumber: 1, audioUrl: null, reviewStatus: 'pending', imageVersion: 1, approvedImageVersion: null }] });
    const { POST, update } = await loadRelease(order);
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it('rejects a bad secret (401) before any work', async () => {
    const { POST, update } = await loadRelease(makeOrder());
    const res = await POST(req({ secret: 'wrong', orderId: 'o1' }));
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

async function loadReview(mocks: { bookId?: string | null; page?: { id: string; imageVersion: number } | null; coverVersion?: number }) {
  const pageUpdate = vi.fn(async () => ({}));
  const coverUpdate = vi.fn(async () => ({}));
  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      generatedBook: {
        findUnique: vi.fn(async (args: { select?: Record<string, unknown> }) =>
          args.select && 'coverImageVersion' in args.select
            ? { coverImageVersion: mocks.coverVersion ?? 0 }
            : mocks.bookId === null ? null : { id: mocks.bookId ?? 'book1' }),
        update: coverUpdate,
      },
      bookPage: { findFirst: vi.fn(async () => mocks.page ?? null), update: pageUpdate },
    },
  }));
  vi.doMock('@/lib/logger', () => SILENT_LOGGER);
  const mod = await import('@/app/api/admin/review-asset/route');
  return { POST: mod.POST, pageUpdate, coverUpdate };
}

describe('review-asset — approval binds to the current version (#43)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GENERATION_SECRET = 'sek';
  });

  it('approving a page sets approvedImageVersion to the page current imageVersion', async () => {
    const { POST, pageUpdate } = await loadReview({ page: { id: 'pg1', imageVersion: 3 } });
    const res = await POST(req({ secret: 'sek', orderId: 'o1', target: 'page', pageNumber: 1, decision: 'approved', reviewedBy: 'rev' }));
    expect(res.status).toBe(200);
    expect(pageUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pg1' },
      data: expect.objectContaining({ reviewStatus: 'approved', approvedImageVersion: 3, reviewedBy: 'rev' }),
    }));
  });

  it('rejecting a page clears approvedImageVersion', async () => {
    const { POST, pageUpdate } = await loadReview({ page: { id: 'pg1', imageVersion: 3 } });
    const res = await POST(req({ secret: 'sek', orderId: 'o1', target: 'page', pageNumber: 1, decision: 'rejected' }));
    expect(res.status).toBe(200);
    expect(pageUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewStatus: 'rejected', approvedImageVersion: null }),
    }));
  });

  it('approving the cover binds approvedCoverImageVersion to the current cover version', async () => {
    const { POST, coverUpdate } = await loadReview({ coverVersion: 2 });
    const res = await POST(req({ secret: 'sek', orderId: 'o1', target: 'cover', decision: 'approved' }));
    expect(res.status).toBe(200);
    expect(coverUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coverReviewStatus: 'approved', approvedCoverImageVersion: 2 }),
    }));
  });

  it('rejects a bad secret (401)', async () => {
    const { POST, pageUpdate } = await loadReview({ page: { id: 'pg1', imageVersion: 3 } });
    const res = await POST(req({ secret: 'nope', orderId: 'o1', target: 'page', pageNumber: 1, decision: 'approved' }));
    expect(res.status).toBe(401);
    expect(pageUpdate).not.toHaveBeenCalled();
  });
});
