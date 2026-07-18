import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const sweepStaleGenerationJobs = vi.fn(async () => undefined);

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique } },
}));
vi.mock('@/lib/generation-chunked/sweeper', () => ({
  sweepStaleGenerationJobs,
}));

const VALID_CUID = 'cmo8qpmdg00004w9k7d1zrf50';
const MISSING_CUID = 'clzzzzzzzzzzzzzzzzzzzzzzz';
const VALID_KEY = 'pay_valid_access_key_123';

function statusRequest(orderId?: string | null, accessKey?: string): NextRequest {
  if (orderId === undefined) {
    return new NextRequest('https://example.com/api/generate/status');
  }
  let url = `https://example.com/api/generate/status?orderId=${encodeURIComponent(orderId ?? '')}`;
  if (accessKey !== undefined) {
    url += `&accessKey=${encodeURIComponent(accessKey)}`;
  }
  return new NextRequest(url);
}

const mockOrder = {
  id: VALID_CUID,
  status: 'generating',
  childName: 'דנה',
  audioEnabled: false,
  storyLength: 'medium',
  storyDirection: 'adventure',
  coverImageUrl: null,
  textStatus: 'done',
  imageStatus: 'running',
  audioStatus: 'pending',
  packageStatus: 'pending',
  lastError: null,
  paymentId: VALID_KEY,
  paymeTransactionId: null,
  stripeSessionId: null,
  generationJob: {
    currentStage: 'page_images',
    status: 'running',
    textDone: true,
    imagesDone: false,
    audioDone: false,
    packaged: false,
    retryable: true,
  },
  book: {
    readUrl: null,
    coverImageUrl: null,
    pages: [{ pageNumber: 0, audioUrl: null, imageAsset: { id: 'img1' } }],
  },
};

describe('GET /api/generate/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it('returns 400 invalid_order_id when orderId is missing', async () => {
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_order_id' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_order_id for malformed orderId', async () => {
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest('not-a-cuid'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_order_id' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 order_not_found for valid-format but missing order', async () => {
    findUnique.mockResolvedValueOnce(null);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(MISSING_CUID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'order_not_found' });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: MISSING_CUID } }));
  });

  it('returns 200 for an existing order with a valid accessKey', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, VALID_KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('generating');
    expect(body.childName).toBe('דנה');
    expect(body.currentStage).toBe('page_images');
    expect(body.progress).toBeTypeOf('number');
    expect('error' in body).toBe(false); // lastError is never surfaced
  });

  it('returns 404 order_not_found when accessKey is missing', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'order_not_found' });
  });

  it('returns 404 order_not_found when accessKey is invalid', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, 'wrong-key'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'order_not_found' });
  });

  it('needs_human_qa returns exactly { status: under_review, childName } and leaks nothing', async () => {
    findUnique.mockResolvedValueOnce({
      ...mockOrder,
      status: 'needs_human_qa',
      lastError: 'internal: laterality mismatch on p4',
      book: { readUrl: '/book/secret/read-v2', coverImageUrl: null, pages: [] },
    });
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, VALID_KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Allowlisted body ONLY — this is the no-leak proof.
    expect(body).toEqual({ status: 'under_review', childName: 'דנה' });
    expect('error' in body).toBe(false);
    expect('readUrl' in body).toBe(false);
    expect('deliveryHoldReason' in body).toBe(false);
    expect('hazard' in body).toBe(false);
    expect('progress' in body).toBe(false);
    expect('failedStage' in body).toBe(false);
    expect('currentStage' in body).toBe(false);
  });

  it('returns readUrl for a ready order with a valid accessKey (and never leaks lastError)', async () => {
    findUnique.mockResolvedValueOnce({
      ...mockOrder,
      status: 'ready',
      lastError: 'stale error text that must not surface',
      book: { readUrl: '/book/abc/read-v2?v=1', coverImageUrl: null, pages: [] },
    });
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, VALID_KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.readUrl).toBe('/book/abc/read-v2?v=1');
    expect('error' in body).toBe(false);
  });
});
