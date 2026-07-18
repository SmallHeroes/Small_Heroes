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
// Run the post-response work synchronously so the sweep call is observable within the request under
// test (the real runAfterResponse defers via next/server after()). The route only imports this symbol.
vi.mock('@/lib/generation-chunked/chain-worker', () => ({
  runAfterResponse: (work: () => Promise<void>) => {
    void work();
  },
}));

const VALID_CUID = 'cmo8qpmdg00004w9k7d1zrf50';
const MISSING_CUID = 'clzzzzzzzzzzzzzzzzzzzzzzz';
const VALID_UUID = '11111111-2222-4333-8444-555555555555';
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

  it('accepts a UUID order id (Story Bank orders) with a valid accessKey — 200 not 400', async () => {
    findUnique.mockResolvedValueOnce({ ...mockOrder, id: VALID_UUID });
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_UUID, VALID_KEY));
    // The UUID clears the shape guard and reaches the DB (no 400 before auth).
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: VALID_UUID } }));
    const body = await res.json();
    expect(body.status).toBe('generating');
  });

  it('does NOT run the stale-job sweep for an unauthenticated request (invalid key)', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, 'wrong-key'));
    expect(res.status).toBe(404);
    // The expensive sweep must be gated BEHIND the access-key auth — never on the unauth path.
    expect(sweepStaleGenerationJobs).not.toHaveBeenCalled();
  });

  it('does NOT run the stale-job sweep when the accessKey is missing', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID));
    expect(res.status).toBe(404);
    expect(sweepStaleGenerationJobs).not.toHaveBeenCalled();
  });

  it('runs the stale-job sweep only AFTER the access-key auth passes (authenticated request)', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID, VALID_KEY));
    expect(res.status).toBe(200);
    // Auth precedes the sweep: it only fires once the request is authenticated.
    expect(sweepStaleGenerationJobs).toHaveBeenCalled();
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
