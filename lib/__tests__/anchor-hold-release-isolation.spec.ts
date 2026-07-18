import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * (Human-QA Slice 1, re-gate P0-A) The anchor break-glass release now runs ONE flag-INDEPENDENT authorization
 * routine — lock the Order (FOR UPDATE) + require the exact unchanged anchor marker + reject any active
 * non-anchor base / any payment review case + release via a status+marker CAS + close the anchor case + post-commit
 * sync — whether READINESS_MANIFEST_ENABLED is on or off. Round 2 had hardened ONLY the readiness-OFF path; with the
 * flag ON the handler called commitBaseBookReadiness and returned, skipping every guard. These tests MIRROR the full
 * adversarial matrix across BOTH flag states with IDENTICAL assertions — that is the proof no path depends on the
 * flag for its safety.
 */

const SILENT = { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
const req = (body: unknown) => ({ json: async () => body }) as never;
const heldOrder = (reason: string) => ({
  id: 'o1', status: 'needs_human_qa', deliveryHoldReason: reason,
  customerEmail: 'c@e.com', customerName: 'C', childName: 'K', paymentId: 'p', paymeTransactionId: null, stripeSessionId: null,
  book: { readUrl: 'https://app/book/o1/read', pdfUrl: null, audioAsset: null, pages: [] },
});

async function loadRoute(opts: {
  order: unknown;
  email?: ReturnType<typeof vi.fn>;
  orderUpdateMany?: ReturnType<typeof vi.fn>;
  baseCase?: unknown;
  paymentCase?: unknown;
  /** Overrides the row tx.$queryRaw returns under lock (defaults to echoing opts.order) — for marker-drift tests. */
  lockedRow?: { status: string; deliveryHoldReason: string | null };
}) {
  const email = opts.email ?? vi.fn(async () => ({}));
  const orderUpdateMany = opts.orderUpdateMany ?? vi.fn(async () => ({ count: 1 }));
  const postCommit = vi.fn(async () => {});
  const lockedRow = opts.lockedRow ?? (opts.order as { status: string; deliveryHoldReason: string | null });
  // The release LOCKS + re-reads the Order (tx.$queryRaw FOR UPDATE), guards on the active base/payment review
  // cases, and releases via a status+marker CAS (tx.order.updateMany). $queryRaw echoes the committed row;
  // findUnique for both scopes' activeKeys resolves the case guards AND the in-tx anchor-case close.
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
  const mod = await import('@/app/api/admin/anchor-hold-release/route');
  return { POST: mod.POST, email, orderUpdateMany, postCommit, caseUpdate: humanQaReviewCase.update };
}

// The route no longer READS the flag — so setting it must NOT change behavior. Running the whole matrix under both
// values is the flag-independence proof.
describe.each([
  { label: 'READINESS_MANIFEST_ENABLED=true', flag: 'true' as string | undefined },
  { label: 'READINESS_MANIFEST_ENABLED unset', flag: undefined as string | undefined },
])('anchor-hold-release — flag-independent authorization ($label)', ({ flag }) => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GENERATION_SECRET = 'sek';
    if (flag === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
    else process.env.READINESS_MANIFEST_ENABLED = flag;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.READINESS_MANIFEST_ENABLED;
  });

  it('legitimate anchor release → 200 released, email sent, anchor case CLOSED, post-commit sync run', async () => {
    const { POST, email, orderUpdateMany, postCommit, caseUpdate } = await loadRoute({
      order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_anchor', status: 'open', kind: 'anchor' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    // Released via the status+marker CAS (not a bare update).
    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }),
        data: expect.objectContaining({ status: 'ready', deliveryHoldReason: null }),
      }),
    );
    // Case CLOSED in the same tx (resolveHumanQaCaseOnReleaseInTx → update status:resolved).
    expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'resolved' }) }));
    expect(email).toHaveBeenCalledTimes(1);
    expect(postCommit).toHaveBeenCalledTimes(1); // belt-and-suspenders case sync
  });

  it('stronger hold mid-flight (marker drifted to safety under lock) → 409, no release, no email', async () => {
    const { POST, email, orderUpdateMany, postCommit } = await loadRoute({
      order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:2' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
    expect(postCommit).not.toHaveBeenCalled();
  });

  it('safety case active while the marker reads anchor (skip_weaker) → 409, no release', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({
      order: heldOrder('anchor_low_confidence:soft_band'),
      baseCase: { id: 'c_safety', status: 'open', kind: 'safety' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('active PAYMENT_INTEGRITY case → 409, no release', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({
      order: heldOrder('anchor_low_confidence:soft_band'),
      paymentCase: { id: 'c_pay', status: 'open', kind: 'payment_integrity' },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('a safety_hold marker → 409 (break-glass is an anchor-only allowlist)', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({ order: heldOrder('safety_hold:hazard:page:2:child_on_railing') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('a contract_world_hold marker → 409 (anchor-only allowlist)', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({ order: heldOrder('contract_world_hold:quality_failed:page:3') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('a base_book_integrity marker → 409 (not releasable via the anchor endpoint)', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({ order: heldOrder('base_book_integrity:cover_invalid') });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('idempotent — a concurrent release seen under lock (status=ready) → no-op, no re-send', async () => {
    const { POST, email, orderUpdateMany } = await loadRoute({
      order: heldOrder('anchor_low_confidence:soft_band'),
      lockedRow: { status: 'ready', deliveryHoldReason: null },
    });
    const res = await POST(req({ secret: 'sek', orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('rejects a bad secret (401)', async () => {
    const { POST, orderUpdateMany } = await loadRoute({ order: heldOrder('anchor_low_confidence:soft_band') });
    const res = await POST(req({ secret: 'nope', orderId: 'o1' }));
    expect(res.status).toBe(401);
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });
});
