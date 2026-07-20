import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  assertNoAccessKeys,
  parsePageNumbersFromReason,
  artifactKeyToPageNumber,
  kindLabelHe,
  notesFromEvidenceJson,
} from '@/lib/admin/human-qa-review-helpers';
import { DEMO_CASE_DETAIL, DEMO_OPEN_CASES } from '@/lib/admin/human-qa-review-fixtures';

describe('human-qa-review-helpers', () => {
  it('parses page numbers from hold markers', () => {
    expect(parsePageNumbersFromReason('safety_hold:page:4:unsupported_at_height|unsafe_pose')).toEqual([4]);
    expect(parsePageNumbersFromReason('safety_hold:hazard:page:4:foo')).toEqual([4]);
    expect(parsePageNumbersFromReason('contract_world_hold:page:2,page:5')).toEqual([2, 5]);
    expect(parsePageNumbersFromReason('anchor_low_confidence:soft_band')).toEqual([]);
  });

  it('maps artifact keys to page numbers', () => {
    expect(artifactKeyToPageNumber('cover')).toBeNull();
    expect(artifactKeyToPageNumber('page:4')).toBe(4);
    expect(artifactKeyToPageNumber('page:x')).toBeNull();
  });

  it('returns Hebrew kind labels', () => {
    expect(kindLabelHe('safety')).toBe('בטיחות');
    expect(kindLabelHe('anchor')).toBe('דמיון לדמות');
  });

  it('extracts safe notes from evidence JSON without access keys', () => {
    const parsed = notesFromEvidenceJson({
      presentationApplied: true,
      safetyHazards: ['unsafe_pose'],
      resemblanceScore: 0.77,
      paymentId: 'SHOULD_NOT_SURFACE_AS_NOTE',
      contractObservability: { diffSummary: 'wrong_zone' },
    });
    expect(parsed.safetyHazards).toContain('unsafe_pose');
    expect(parsed.anchorConfidence).toBe(0.77);
    expect(parsed.notes.some((n) => n.includes('wrong_zone'))).toBe(true);
    expect(parsed.notes.join(' ')).not.toContain('SHOULD_NOT');
  });

  it('assertNoAccessKeys flags forbidden fields anywhere in a payload', () => {
    const hits = assertNoAccessKeys({
      cases: [{ orderId: 'o1', paymentId: 'secret-pay' }],
      nested: { stripeSessionId: 'cs_x', ok: true },
    });
    expect(hits.some((h) => h.includes('paymentId'))).toBe(true);
    expect(hits.some((h) => h.includes('stripeSessionId'))).toBe(true);
  });

  it('demo fixtures never contain customer access keys', () => {
    expect(assertNoAccessKeys(DEMO_OPEN_CASES)).toEqual([]);
    expect(assertNoAccessKeys(DEMO_CASE_DETAIL)).toEqual([]);
  });
});

describe('GET /api/admin/review/cases', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GENERATION_SECRET = 'test-admin-secret';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadRoute(opts: {
    cases?: unknown[];
    findMany?: ReturnType<typeof vi.fn>;
  } = {}) {
    const findMany =
      opts.findMany ??
      vi.fn(async () => opts.cases ?? []);
    vi.doMock('@/lib/prisma', () => ({
      prisma: { humanQaReviewCase: { findMany } },
    }));
    const mod = await import('@/app/api/admin/review/cases/route');
    return { GET: mod.GET, findMany };
  }

  function req(headers: Record<string, string> = {}, url = 'http://localhost/api/admin/review/cases') {
    return new Request(url, { headers }) as never;
  }

  it('returns 401 without secret — no data', async () => {
    const { GET, findMany } = await loadRoute({ cases: [{ id: 'should-not-load' }] });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    const body = await res.json();
    expect(assertNoAccessKeys(body)).toEqual([]);
  });

  it('returns empty list when authenticated and no open cases', async () => {
    const { GET } = await loadRoute({ cases: [] });
    const res = await GET(req({ 'x-generation-secret': 'test-admin-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cases).toEqual([]);
    expect(assertNoAccessKeys(body)).toEqual([]);
  });

  it('returns open cases without access keys', async () => {
    const heldAt = new Date('2026-07-18T12:00:00.000Z');
    const { GET } = await loadRoute({
      cases: [
        {
          id: 'c1',
          orderId: 'o1',
          kind: 'safety',
          humanReason: 'Child-safety hold — safety_hold:page:4:unsafe_pose',
          rawReason: 'safety_hold:page:4:unsafe_pose',
          heldAt,
          order: {
            id: 'o1',
            childName: 'אוּרי',
            status: 'needs_human_qa',
            storyDirection: 'adventure',
            deliveryHoldReason: 'safety_hold:page:4:unsafe_pose',
            inputVersion: 1,
            visualContractHash: null,
          },
        },
      ],
    });
    const res = await GET(req({ 'x-generation-secret': 'test-admin-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0].childName).toBe('אוּרי');
    expect(body.cases[0].pageNumbers).toEqual([4]);
    expect(JSON.stringify(body)).not.toMatch(/paymentId|paymeTransactionId|stripeSessionId/);
    expect(assertNoAccessKeys(body)).toEqual([]);
  });

  it('demo mode (non-prod) returns fixtures without DB', async () => {
    const { GET, findMany } = await loadRoute({ cases: [] });
    const res = await GET(
      req({ 'x-generation-secret': 'test-admin-secret' }, 'http://localhost/api/admin/review/cases?demo=1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.cases.length).toBeGreaterThan(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(assertNoAccessKeys(body)).toEqual([]);
  });
});

describe('GET /api/admin/review/cases/[orderId]', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GENERATION_SECRET = 'test-admin-secret';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadRoute(detail: unknown | null) {
    const findFirst = vi.fn(async () => detail);
    vi.doMock('@/lib/prisma', () => ({
      prisma: { humanQaReviewCase: { findFirst } },
    }));
    const mod = await import('@/app/api/admin/review/cases/[orderId]/route');
    return { GET: mod.GET, findFirst };
  }

  function req(orderId: string, headers: Record<string, string> = {}, demo = false) {
    const url = `http://localhost/api/admin/review/cases/${orderId}${demo ? '?demo=1' : ''}`;
    return {
      request: new Request(url, { headers }) as never,
      context: { params: Promise.resolve({ orderId }) },
    };
  }

  it('returns 401 without secret', async () => {
    const { GET, findFirst } = await loadRoute({ id: 'x' });
    const { request, context } = req('o1');
    const res = await GET(request, context);
    expect(res.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns flagged page + evidence for a held order', async () => {
    const heldAt = new Date('2026-07-18T12:00:00.000Z');
    const { GET } = await loadRoute({
      id: 'c1',
      orderId: 'o1',
      kind: 'safety',
      status: 'open',
      humanReason: 'Child-safety hold — safety_hold:page:4:unsafe_pose',
      rawReason: 'safety_hold:page:4:unsafe_pose',
      holdFingerprint: 'fp1',
      inputVersion: 2,
      contractHash: 'ch1',
      heldAt,
      order: {
        id: 'o1',
        childName: 'אוּרי',
        status: 'needs_human_qa',
        storyDirection: 'adventure',
        deliveryHoldReason: 'safety_hold:page:4:unsafe_pose',
        inputVersion: 2,
        visualContractHash: 'ch1',
        book: {
          coverImageUrl: null,
          coverSafetyHazards: [],
          pages: [
            {
              pageNumber: 3,
              text: 'עמוד נקי',
              imageAsset: {
                url: 'https://cdn.example/p3.png',
                presentationUrl: null,
                safetyVerified: true,
                safetyHazards: [],
              },
            },
            {
              pageNumber: 4,
              text: 'עמוד מסומן',
              imageAsset: {
                url: 'https://cdn.example/p4.png',
                presentationUrl: 'https://cdn.example/p4-pres.png',
                safetyVerified: false,
                safetyHazards: ['unsafe_pose'],
              },
            },
          ],
        },
        qualityEvidence: [
          {
            artifactKey: 'page:4',
            verdict: 'failed',
            reason: 'safety:unsafe_pose',
            contractHash: 'ch1',
            evidence: { presentationApplied: true, resemblanceScore: 0.8 },
          },
        ],
      },
    });

    const { request, context } = req('o1', { 'x-generation-secret': 'test-admin-secret' });
    const res = await GET(request, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.flaggedPageNumbers).toContain(4);
    const flagged = body.case.pages.find((p: { pageNumber: number }) => p.pageNumber === 4);
    expect(flagged.flagged).toBe(true);
    expect(flagged.safetyHazards).toContain('unsafe_pose');
    expect(flagged.evidence.verdict).toBe('failed');
    expect(JSON.stringify(body)).not.toMatch(/paymentId|paymeTransactionId|stripeSessionId/);
    expect(assertNoAccessKeys(body)).toEqual([]);
  });

  it('demo detail returns fixture without access keys', async () => {
    const { GET, findFirst } = await loadRoute(null);
    const { request, context } = req('demo-order-fox-001', { 'x-generation-secret': 'test-admin-secret' }, true);
    const res = await GET(request, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.case.flaggedPageNumbers).toContain(4);
    expect(findFirst).not.toHaveBeenCalled();
    expect(assertNoAccessKeys(body)).toEqual([]);
  });
});
