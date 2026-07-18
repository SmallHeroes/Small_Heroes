import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutboxReconciliationError } from '@/lib/generation-chunked/delivery-outbox';

/**
 * (Human-QA Slice 1, re-gate forward fix) Anchor break-glass release = flag-independent AUTHORIZATION +
 * flag-dispatched DELIVERY.
 *   - AUTHORIZATION (both flag states, identical): lock FOR UPDATE + require the exact unchanged anchor marker +
 *     reject any active non-anchor base / any payment review case (409). Round-3's P0-A guard, unchanged.
 *   - DELIVERY, dispatched AFTER authorization: flag-ON → Manifest/Outbox (commitBaseBookReadiness), NEVER a direct
 *     email, OutboxReconciliationError → 409; flag-OFF → the existing atomic status CAS + direct send, exactly once.
 * The authorization matrix is parameterized over BOTH flags (identical assertions); delivery is asserted per flag.
 */

const SILENT = { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
const req = (body: unknown) => ({ json: async () => body }) as never;
const heldOrder = (reason: string, over: Record<string, unknown> = {}) => ({
  id: 'o1', status: 'needs_human_qa', deliveryHoldReason: reason,
  customerEmail: 'c@e.com', customerName: 'C', childName: 'K', paymentId: 'p', paymeTransactionId: null, stripeSessionId: null,
  book: { readUrl: 'https://app/book/o1/read', pdfUrl: null, audioAsset: null, pages: [] },
  ...over,
});

async function loadRoute(opts: {
  flagOn: boolean;
  order: unknown;
  email?: ReturnType<typeof vi.fn>;
  orderUpdateMany?: ReturnType<typeof vi.fn>;
  commit?: ReturnType<typeof vi.fn>;
  baseCase?: unknown;
  paymentCase?: unknown;
  /** Overrides the row tx.$queryRaw returns under lock (defaults to echoing opts.order) — for marker-drift tests. */
  lockedRow?: { status: string; deliveryHoldReason: string | null };
}) {
  const email = opts.email ?? vi.fn(async () => ({}));
  const orderUpdateMany = opts.orderUpdateMany ?? vi.fn(async () => ({ count: 1 }));
  const postCommit = vi.fn(async () => {});
  const commit = opts.commit ?? vi.fn(async () => ({ enqueued: true, manifestStatus: 'passed', orderStatus: 'ready', reason: null, revision: 1 }));
  const lockedRow = opts.lockedRow ?? (opts.order as { status: string; deliveryHoldReason: string | null });
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
  vi.doMock('@/lib/human-qa/sync-hold-case', () => ({ syncHumanQaHoldCasePostCommit: postCommit }));
  vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({
    isReadinessManifestEnabled: () => opts.flagOn,
    commitBaseBookReadiness: commit,
  }));
  const mod = await import('@/app/api/admin/anchor-hold-release/route');
  return { POST: mod.POST, email, orderUpdateMany, postCommit, commit, caseUpdate: humanQaReviewCase.update };
}

// ── AUTHORIZATION: identical across both flag states — no path may depend on the flag for its safety ────────────
describe.each([
  { label: 'flag-ON', flagOn: true },
  { label: 'flag-OFF', flagOn: false },
])('anchor-hold-release AUTHORIZATION ($label)', ({ flagOn }) => {
  beforeEach(() => { vi.resetModules(); process.env.GENERATION_SECRET = 'sek'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stronger hold mid-flight (marker drifted to safety under lock) → 409, NO delivery of any kind', async () => {
    const { POST, email, orderUpdateMany, commit } = await loadRoute({
      flagOn, order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:2' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('safety case active while the marker reads anchor (skip_weaker) → 409, no delivery', async () => {
    const { POST, email, orderUpdateMany, commit } = await loadRoute({
      flagOn, order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_safety', status: 'open', kind: 'safety' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('active PAYMENT_INTEGRITY case → 409, no delivery', async () => {
    const { POST, email, commit } = await loadRoute({
      flagOn, order: heldOrder('anchor_low_confidence:soft_band'),
      paymentCase: { id: 'c_pay', status: 'open', kind: 'payment_integrity' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a safety_hold marker → 409 (anchor-only allowlist)', async () => {
    const { POST, email, commit } = await loadRoute({ flagOn, order: heldOrder('safety_hold:hazard:page:2') });
    expect((await POST(req({ secret: 'sek', orderId: 'o1' }))).status).toBe(409);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a contract_world_hold marker → 409 (anchor-only allowlist)', async () => {
    const { POST, commit } = await loadRoute({ flagOn, order: heldOrder('contract_world_hold:quality_failed:page:3') });
    expect((await POST(req({ secret: 'sek', orderId: 'o1' }))).status).toBe(409);
    expect(commit).not.toHaveBeenCalled();
  });

  it('a base_book_integrity marker → 409 (not releasable via the anchor endpoint)', async () => {
    const { POST, commit } = await loadRoute({ flagOn, order: heldOrder('base_book_integrity:cover_invalid') });
    expect((await POST(req({ secret: 'sek', orderId: 'o1' }))).status).toBe(409);
    expect(commit).not.toHaveBeenCalled();
  });

  it('idempotent — order already released (pre-read ready) → 200, no delivery, no re-send', async () => {
    const { POST, email, orderUpdateMany, commit } = await loadRoute({
      flagOn, order: heldOrder('anchor_low_confidence:soft_band', { status: 'ready' }),
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('idempotent — concurrent release seen under lock (status=ready) → 200, no delivery', async () => {
    const { POST, email, commit } = await loadRoute({
      flagOn, order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'ready', deliveryHoldReason: null },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects a bad secret (401), no delivery', async () => {
    const { POST, email, commit } = await loadRoute({ flagOn, order: heldOrder('anchor_low_confidence:soft_band') });
    expect((await POST(req({ secret: 'nope', orderId: 'o1' }))).status).toBe(401);
    expect(email).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});

// ── DELIVERY: flag-OFF → direct send exactly once ──────────────────────────────────────────────────────────────
describe('anchor-hold-release DELIVERY (flag-OFF: direct send)', () => {
  beforeEach(() => { vi.resetModules(); process.env.GENERATION_SECRET = 'sek'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('authorized release → status CAS to ready, anchor case CLOSED in-tx, direct email sent ONCE, no Outbox', async () => {
    const { POST, email, orderUpdateMany, commit, caseUpdate, postCommit } = await loadRoute({
      flagOn: false, order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_anchor', status: 'open', kind: 'anchor' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }),
        data: expect.objectContaining({ status: 'ready', deliveryHoldReason: null }),
      }),
    );
    expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'resolved' }) }));
    expect(email).toHaveBeenCalledTimes(1); // exactly once
    expect(commit).not.toHaveBeenCalled(); // never routes through the Manifest/Outbox on flag-off
    expect(postCommit).toHaveBeenCalledTimes(1);
  });

  it('a concurrent caller that loses the status CAS (count 0) → 409, no send (exactly-once)', async () => {
    const { POST, email } = await loadRoute({
      flagOn: false, order: heldOrder('anchor_low_confidence:soft_band'),
      orderUpdateMany: vi.fn(async () => ({ count: 0 })),
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
  });
});

// ── DELIVERY: flag-ON → Manifest/Outbox, never a direct email ──────────────────────────────────────────────────
describe('anchor-hold-release DELIVERY (flag-ON: Manifest/Outbox)', () => {
  beforeEach(() => { vi.resetModules(); process.env.GENERATION_SECRET = 'sek'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('authorized release → enqueues via commitBaseBookReadiness, NO direct email, NO in-tx status flip, viaOutbox', async () => {
    const { POST, email, orderUpdateMany, commit, postCommit } = await loadRoute({
      flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_anchor', status: 'open', kind: 'anchor' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 'o1', anchorAllowsDelivery: true }));
    expect(email).not.toHaveBeenCalled(); // package-delivery.ts:104 invariant — flag-on never direct-sends
    expect(orderUpdateMany).not.toHaveBeenCalled(); // authorization did NOT flip status; commit owns the transition
    expect(postCommit).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toMatchObject({ released: true, viaOutbox: true });
  });

  it('a delivery already in flight (OutboxReconciliationError) → 409, no send', async () => {
    const commit = vi.fn(async () => { throw new OutboxReconciliationError('book-ready/o1/base-book/1', 'existing_status:sent'); });
    const { POST, email } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'), commit });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(email).not.toHaveBeenCalled();
  });

  it('a NON-reconciliation error from commit still propagates (not swallowed as 409)', async () => {
    const commit = vi.fn(async () => { throw new Error('readiness_inputs_missing'); });
    const { POST } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'), commit });
    await expect(POST(req({ secret: 'sek', orderId: 'o1' }))).rejects.toThrow(/readiness_inputs_missing/);
  });

  it('staleness re-park (commit returns enqueued:false / re-parked) → no direct email, released:false surfaced', async () => {
    const commit = vi.fn(async () => ({ enqueued: false, manifestStatus: 'blocked', orderStatus: 'needs_human_qa', reason: 'base_book_integrity:stale', revision: 2 }));
    const { POST, email } = await loadRoute({ flagOn: true, order: heldOrder('anchor_low_confidence:soft_band'), commit });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(email).not.toHaveBeenCalled(); // a book that went stale is NOT force-shipped
    const body = await res.json();
    expect(body).toMatchObject({ released: false, viaOutbox: true, orderStatus: 'needs_human_qa' });
  });
});
