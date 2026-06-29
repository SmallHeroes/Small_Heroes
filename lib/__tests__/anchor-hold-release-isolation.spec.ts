import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** B6: under the readiness flag, the anchor break-glass releases ONLY anchor holds and routes through the
 * Outbox (never a direct send / Manifest bypass). Flag-off behavior is unchanged. */

const SILENT = { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
const req = (body: unknown) => ({ json: async () => body }) as never;
const heldOrder = (reason: string) => ({
  id: 'o1', status: 'needs_human_qa', deliveryHoldReason: reason,
  customerEmail: 'c@e.com', customerName: 'C', childName: 'K', paymentId: 'p', paymeTransactionId: null, stripeSessionId: null,
  book: { readUrl: 'https://app/book/o1/read', pdfUrl: null, audioAsset: null, pages: [] },
});

async function loadRoute(opts: { flagOn: boolean; order: unknown; commit?: ReturnType<typeof vi.fn>; email?: ReturnType<typeof vi.fn>; orderUpdate?: ReturnType<typeof vi.fn> }) {
  const commit = opts.commit ?? vi.fn(async () => ({ enqueued: true, manifestStatus: 'passed', orderStatus: 'ready', reason: null, revision: 1 }));
  const email = opts.email ?? vi.fn(async () => ({}));
  const orderUpdate = opts.orderUpdate ?? vi.fn();
  vi.doMock('@/lib/prisma', () => ({ prisma: { order: { findUnique: vi.fn(async () => opts.order), update: orderUpdate } } }));
  vi.doMock('@/backend/lib/email', () => ({ sendBookReadyEmail: email }));
  vi.doMock('@/lib/logger', () => SILENT);
  vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({ isReadinessManifestEnabled: () => opts.flagOn, commitBaseBookReadiness: commit }));
  const mod = await import('@/app/api/admin/anchor-hold-release/route');
  return { POST: mod.POST, commit, email, orderUpdate };
}

describe('anchor-hold-release isolation (B6)', () => {
  beforeEach(() => { vi.resetModules(); process.env.GENERATION_SECRET = 'sek'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('flag-on: refuses to release an integrity hold (409) — no commit, no email', async () => {
    const { POST, commit, email } = await loadRoute({ flagOn: true, order: heldOrder('base_book_integrity:cover_invalid') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(commit).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('flag-on: refuses to release a readiness-stale hold (409)', async () => {
    const { POST, commit } = await loadRoute({ flagOn: true, order: heldOrder('base_book_readiness_stale') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(commit).not.toHaveBeenCalled();
  });

  it('flag-on: an anchor hold routes through readiness/Outbox (no direct send)', async () => {
    const { POST, commit, email } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 'o1', anchorAllowsDelivery: true }));
    expect(email).not.toHaveBeenCalled(); // routed through the Outbox, not a direct send
  });

  it('flag-off: unchanged direct-send behavior', async () => {
    const { POST, commit, email, orderUpdate } = await loadRoute({ flagOn: false, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(commit).not.toHaveBeenCalled();
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready' }) }));
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('rejects a bad secret (401)', async () => {
    const { POST, commit } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'nope', orderId: 'o1' }));
    expect(res.status).toBe(401);
    expect(commit).not.toHaveBeenCalled();
  });
});
