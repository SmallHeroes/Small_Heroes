import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutboxReconciliationError } from '@/lib/generation-chunked/delivery-outbox';

/** B6: under the readiness flag, the anchor break-glass releases ONLY anchor holds and routes through the
 * Outbox (never a direct send / Manifest bypass). Flag-off behavior is unchanged. */

const SILENT = { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
const req = (body: unknown) => ({ json: async () => body }) as never;
const heldOrder = (reason: string) => ({
  id: 'o1', status: 'needs_human_qa', deliveryHoldReason: reason,
  customerEmail: 'c@e.com', customerName: 'C', childName: 'K', paymentId: 'p', paymeTransactionId: null, stripeSessionId: null,
  book: { readUrl: 'https://app/book/o1/read', pdfUrl: null, audioAsset: null, pages: [] },
});

async function loadRoute(opts: {
  flagOn: boolean;
  order: unknown;
  commit?: ReturnType<typeof vi.fn>;
  email?: ReturnType<typeof vi.fn>;
  orderUpdateMany?: ReturnType<typeof vi.fn>;
  baseCase?: unknown;
  paymentCase?: unknown;
  /** Overrides the row tx.$queryRaw returns under lock (defaults to echoing opts.order) — for marker-drift tests. */
  lockedRow?: { status: string; deliveryHoldReason: string | null };
}) {
  const commit = opts.commit ?? vi.fn(async () => ({ enqueued: true, manifestStatus: 'passed', orderStatus: 'ready', reason: null, revision: 1 }));
  const email = opts.email ?? vi.fn(async () => ({}));
  const orderUpdateMany = opts.orderUpdateMany ?? vi.fn(async () => ({ count: 1 }));
  const lockedRow = opts.lockedRow ?? (opts.order as { status: string; deliveryHoldReason: string | null });
  // (Human-QA Slice 1, re-gate P0-2) the flag-off release now LOCKS + re-reads the Order (tx.$queryRaw FOR UPDATE),
  // guards on the active base/payment review cases, and releases via a status+marker CAS (tx.order.updateMany).
  // $queryRaw echoes the fixture's committed row; findUnique for both scopes' activeKeys resolves the case guards.
  const humanQaReviewCase = {
    findUnique: vi.fn(async ({ where }: { where: { activeKey: string } }) =>
      where.activeKey.endsWith(':payment') ? (opts.paymentCase ?? null) : (opts.baseCase ?? null),
    ),
    update: vi.fn(),
  };
  const txClient = {
    $queryRaw: vi.fn(async () => [{ status: lockedRow.status, deliveryHoldReason: lockedRow.deliveryHoldReason }]),
    order: { updateMany: orderUpdateMany },
    humanQaReviewCase,
    operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn() },
  };
  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      order: { findUnique: vi.fn(async () => opts.order) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(txClient)),
    },
  }));
  vi.doMock('@/backend/lib/email', () => ({ sendBookReadyEmail: email }));
  vi.doMock('@/lib/logger', () => SILENT);
  vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({ isReadinessManifestEnabled: () => opts.flagOn, commitBaseBookReadiness: commit }));
  const mod = await import('@/app/api/admin/anchor-hold-release/route');
  return { POST: mod.POST, commit, email, orderUpdateMany };
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

  it('flag-on: refuses to release ANY non-anchor hold (409) — break-glass is an anchor-only allowlist', async () => {
    // (#3h #6) `base_book_readiness_stale` is no longer produced (the recheck/suppress path was removed); use a
    // generic non-anchor reason to pin the real contract: only `anchor_*` holds are releasable here.
    const { POST, commit } = await loadRoute({ flagOn: true, order: heldOrder('manual_finance_hold') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(commit).not.toHaveBeenCalled();
  });

  it('#3h-D: flag-on, an anchor hold whose delivery needs reconciliation (commit throws OutboxReconciliationError) → typed 409, not a 500', async () => {
    const commit = vi.fn(async () => { throw new OutboxReconciliationError('book-ready/o1/base-book/1', 'existing_status:sent'); });
    const { POST, email } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'), commit });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
  });

  it('#3h-D: flag-on, a NON-reconciliation error from commit still propagates (not swallowed as 409)', async () => {
    const commit = vi.fn(async () => { throw new Error('readiness_inputs_missing'); });
    const { POST } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'), commit });
    await expect(POST(req({ secret: 'sek', orderId: 'o1' }))).rejects.toThrow(/readiness_inputs_missing/);
  });

  it('flag-on: an anchor hold routes through readiness/Outbox (no direct send)', async () => {
    const { POST, commit, email } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 'o1', anchorAllowsDelivery: true }));
    expect(email).not.toHaveBeenCalled(); // routed through the Outbox, not a direct send
  });

  it('flag-off: unchanged direct-send behavior', async () => {
    const { POST, commit, email, orderUpdateMany } = await loadRoute({ flagOn: false, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(commit).not.toHaveBeenCalled();
    // Released via the status+marker CAS (updateMany), not a bare update.
    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }),
        data: expect.objectContaining({ status: 'ready', deliveryHoldReason: null }),
      }),
    );
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('(re-gate P0-2) flag-off: REFUSES to release when an active SAFETY case is present though the marker says anchor (409, no CAS, no email)', async () => {
    // skip_weaker leaves a safety case open while the marker was rewritten to anchor — the case guard must catch it.
    const { POST, email, orderUpdateMany } = await loadRoute({
      flagOn: false,
      order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_safety', status: 'open', kind: 'safety' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('(re-gate P0-2) flag-off: REFUSES when an active PAYMENT_INTEGRITY case is present (409, no release)', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({
      flagOn: false,
      order: heldOrder('anchor_low_confidence:soft_band'),
      paymentCase: { id: 'c_pay', status: 'open', kind: 'payment_integrity' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('(re-gate P0-2) flag-off: REFUSES when the marker changed under lock to a stronger hold (409, no release)', async () => {
    // The pre-tx read saw an anchor marker; under FOR UPDATE the committed marker is now a safety hold — the
    // marker CAS must catch the drift and refuse (never release / send).
    const { POST, email, orderUpdateMany } = await loadRoute({
      flagOn: false,
      order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:2' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('(re-gate P0-2) flag-off: idempotent — a concurrent release seen under lock (status=ready) is a no-op, no re-send', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({
      flagOn: false,
      order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'ready', deliveryHoldReason: null },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('(Stage 1 safety FIX) flag-OFF (prod): REFUSES to release a safety_hold order — never force-ships unsafe assets', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({ flagOn: false, order: heldOrder('safety_hold:hazard:page:2:child_on_railing') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled(); // never flips a safety-parked book to ready
    expect(email).not.toHaveBeenCalled();
  });

  it('(Stage 1 safety FIX) flag-OFF: REFUSES a contract_world_hold order too (anchor-only allowlist on both paths)', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({ flagOn: false, order: heldOrder('contract_world_hold:quality_failed:page:3') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('rejects a bad secret (401)', async () => {
    const { POST, commit } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'nope', orderId: 'o1' }));
    expect(res.status).toBe(401);
    expect(commit).not.toHaveBeenCalled();
  });
});
