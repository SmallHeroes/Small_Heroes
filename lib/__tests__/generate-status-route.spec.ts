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

function statusRequest(orderId?: string | null): NextRequest {
  const url =
    orderId === undefined
      ? 'https://example.com/api/generate/status'
      : `https://example.com/api/generate/status?orderId=${encodeURIComponent(orderId ?? '')}`;
  return new NextRequest(url);
}

const mockOrder = {
  id: VALID_CUID,
  status: 'generating',
  audioEnabled: false,
  storyLength: 'medium',
  storyDirection: 'adventure',
  coverImageUrl: null,
  textStatus: 'done',
  imageStatus: 'running',
  audioStatus: 'pending',
  packageStatus: 'pending',
  lastError: null,
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

  it('returns 200 for an existing order', async () => {
    findUnique.mockResolvedValueOnce(mockOrder);
    const { GET } = await import('../../app/api/generate/status/route');
    const res = await GET(statusRequest(VALID_CUID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('generating');
    expect(body.currentStage).toBe('page_images');
    expect(body.progress).toBeTypeOf('number');
  });
});
