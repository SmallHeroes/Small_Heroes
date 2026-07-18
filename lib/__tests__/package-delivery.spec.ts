import { describe, expect, it, vi } from 'vitest';
import { finalizePackageDelivery, resolveSafetyDeliveryGate } from '@/lib/generation-pipeline/package-delivery';

const order = {
  id: 'o1',
  customerEmail: 'parent@example.com',
  customerName: 'Parent',
  childName: 'Kid',
};

const allowGate = {
  held: false,
  orderStatus: 'ready' as const,
  reason: null,
  sendBookReadyEmail: true,
};

function db() {
  const client = {
    order: { update: vi.fn(async () => ({})), findUnique: vi.fn(async () => ({ childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0 })) },
    generationJob: { update: vi.fn(async () => ({})) },
    // (Fix 5) the safety pre-gate parks in a tx and resolves any active recovery case (findUnique → null = no-op).
    exceptionCase: { findUnique: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 0 })) },
    // (Human-QA Slice 1) no-op stubs for the ADDITIVE review-case writes (safety park + legacy anchor park). No
    // active case, first revision, raw ON CONFLICT insert returns a row. Decision assertions on order.update are
    // unchanged — these only let the additive path run.
    humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    // (delivery fence round-5) $queryRaw serves the receipt INSERT…RETURNING id AND writeOrderHoldFenced's SELECT;
    // $executeRaw serves the ship CAS + the hold CAS (1 = applied/shipped by default). Real semantics: PG harness.
    $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(client));
  return client;
}

describe('finalizePackageDelivery — flag boundary', () => {
  it('flag-on delegates to readiness commit and never writes legacy state or sends directly', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn(async () => ({
      manifestStatus: 'passed' as const,
      enqueued: true,
      orderStatus: 'ready',
      reason: null,
      revision: 2,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );

    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: false });
    expect(commit).toHaveBeenCalledWith(prisma, {
      orderId: 'o1',
      anchorAllowsDelivery: true,
      anchorOrderStatus: 'ready',
      anchorReason: null,
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-on preserves an anchor hold through the readiness commit and still never direct-sends', async () => {
    const prisma = db();
    const send = vi.fn();
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:soft_band',
      sendBookReadyEmail: false,
    };
    const commit = vi.fn(async () => ({
      manifestStatus: 'passed' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: heldGate.reason,
      revision: 3,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: heldGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: true });
    expect(commit).toHaveBeenCalledWith(prisma, expect.objectContaining({
      anchorAllowsDelivery: false,
      anchorOrderStatus: 'needs_human_qa',
      anchorReason: heldGate.reason,
    }));
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-on integrity block is reported held and cannot fall through to the legacy sender', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn(async () => ({
      manifestStatus: 'blocked' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'base_book_integrity:page_2_not_decodable',
      revision: 4,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({
      mode: 'manifest',
      deliveryHeld: true,
      manifest: { manifestStatus: 'blocked', enqueued: false },
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-off preserves legacy ready/job updates and direct email payload', async () => {
    const prisma = db();
    const send = vi.fn(async () => ({}));
    const now = new Date('2026-06-30T12:00:00Z');
    const result = await finalizePackageDelivery(
      prisma as never,
      {
        order,
        deliveryGate: allowGate,
        safetyGate: { held: false, reason: null },
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: 'https://assets/book.pdf',
        firstAudioUrl: 'https://assets/page-1.mp3',
      },
      { readinessEnabled: () => false, send, now: () => now },
    );

    expect(result).toEqual({ mode: 'legacy', deliveryHeld: false, manifest: null });
    // (delivery fence round-5 P0-2) the legacy `ready` transition is now the guarded ship CAS ($executeRaw), not a
    // bare order.update; the email is gated on it winning (1 row). Real CAS WHERE proven in the PG harness.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { status: 'done', currentStage: 'done', completedAt: now, packaged: true },
    });
    expect(send).toHaveBeenCalledWith({
      to: order.customerEmail,
      customerName: order.customerName,
      childName: order.childName,
      readUrl: 'https://app/ready?orderId=o1',
      audioUrl: 'https://assets/page-1.mp3',
      pdfUrl: 'https://assets/book.pdf',
    });
  });

  it('flag-off held path keeps the legacy hold and sends no email', async () => {
    const prisma = db();
    const send = vi.fn();
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:hard_band',
      sendBookReadyEmail: false,
    };
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: heldGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    // (delivery fence round-5) the legacy park is now writeOrderHoldFenced ($executeRaw + precedence), not order.update.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('finalizePackageDelivery — readiness-independent safety pre-gate (Fix 1)', () => {
  const heldSafety = { held: true, reason: 'safety_hold:hazard:page:2:child_on_railing' };

  it('safety held + readiness OFF (prod) → needs_human_qa + safety_hold marker, no email, no legacy ready', async () => {
    const prisma = db();
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'safety_hold', deliveryHeld: true });
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: heldSafety.reason }),
    }));
    expect(send).not.toHaveBeenCalled();
  });

  it('safety held + readiness ON → the pre-gate wins; the readiness commit is NEVER reached', async () => {
    const prisma = db();
    const commit = vi.fn();
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result.mode).toBe('safety_hold');
    expect(commit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('resolveSafetyDeliveryGate (Fix 1) — the readiness-independent gate from the persisted per-asset signal', () => {
  const mkPrisma = (book: unknown) => ({ generatedBook: { findUnique: vi.fn(async () => book) } });

  it('all verified + no hazards → NOT held', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 1, imageAsset: { safetyVerified: true, safetyHazards: [] } }] });
    expect(await resolveSafetyDeliveryGate(p as never, 'o1')).toEqual({ held: false, reason: null });
  });

  it('a confirmed page hazard → held with safety_hold:hazard', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 5, imageAsset: { safetyVerified: true, safetyHazards: ['child_on_railing'] } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.held).toBe(true);
    expect(g.reason).toContain('safety_hold:hazard:page:5:child_on_railing');
  });

  it('an UNVERIFIED page (fail-closed) → held with safety_hold:unverified', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 3, imageAsset: { safetyVerified: false, safetyHazards: [] } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.held).toBe(true);
    expect(g.reason).toContain('safety_hold:unverified:page:3');
  });

  it('an unverified COVER → held (the cover is checked too)', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: false, coverSafetyHazards: [], pages: [] });
    expect((await resolveSafetyDeliveryGate(p as never, 'o1')).held).toBe(true);
  });

  it('a hazard is reported OVER a merely-unverified artifact', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: false, coverSafetyHazards: [], pages: [{ pageNumber: 2, imageAsset: { safetyVerified: true, safetyHazards: ['unsafe_pose'] } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.reason).toContain('hazard:');
    expect(g.reason).not.toContain('unverified:');
  });
});
