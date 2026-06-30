import { describe, expect, it, vi } from 'vitest';
import { finalizePackageDelivery } from '@/lib/generation-pipeline/package-delivery';

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
  return {
    order: { update: vi.fn(async () => ({})) },
    generationJob: { update: vi.fn(async () => ({})) },
  };
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
      { order, deliveryGate: allowGate, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, deliveryGate: heldGate, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, deliveryGate: allowGate, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: 'https://assets/book.pdf',
        firstAudioUrl: 'https://assets/page-1.mp3',
      },
      { readinessEnabled: () => false, send, now: () => now },
    );

    expect(result).toEqual({ mode: 'legacy', deliveryHeld: false, manifest: null });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'ready', packageStatus: 'done', deliveryHoldReason: null },
    });
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
      { order, deliveryGate: heldGate, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: heldGate.reason }),
    }));
    expect(send).not.toHaveBeenCalled();
  });
});
