import { describe, expect, it, vi } from 'vitest';
import type { DeliveryOutbox, ExceptionCase, PrismaClient } from '@prisma/client';

vi.mock('@/lib/generation-chunked/start', () => ({
  startChunkedGeneration: vi.fn(),
}));

import {
  EXCEPTION_MAX_RECOVERY_ATTEMPTS,
  REISSUE_BUDGET,
} from '@/lib/generation-chunked/exception-case';
import {
  processExceptionCase,
  syncTerminalExceptionCases,
  type ExceptionProcessorDeps,
} from '@/lib/generation-chunked/exception-processor';
import { hashPayload, type BookReadyPayload } from '@/lib/generation-chunked/delivery-outbox';

const NOW = new Date('2026-06-30T12:00:00.000Z');

function exceptionCase(overrides: Partial<ExceptionCase> = {}): ExceptionCase {
  return {
    id: 'case_1',
    activeKey: 'order_1:base_book',
    orderId: 'order_1',
    scope: 'base_book',
    kind: 'send_ambiguous',
    status: 'open',
    reason: 'test',
    attempts: 1,
    nextActionAt: NOW,
    resolution: null,
    sourceRef: 'outbox_1',
    claimVersion: 4,
    leaseExpiresAt: new Date(NOW.getTime() + 240_000),
    lastError: null,
    refundKey: null,
    providerActionId: null,
    actionAttemptedAt: null,
    notificationAttemptedAt: null,
    notificationMessageId: null,
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: NOW,
    ...overrides,
  };
}

function outbox(overrides: Partial<DeliveryOutbox> = {}): DeliveryOutbox {
  const payload: BookReadyPayload = {
    to: 'parent@example.com',
    customerName: 'Parent',
    childName: 'Child',
    readUrl: 'https://smallheroes.example/read/order_1',
    audioUrl: '',
    pdfUrl: '',
  };
  return {
    id: 'outbox_1',
    orderId: 'order_1',
    scope: 'base_book',
    manifestId: 'manifest_1',
    inputVersion: 1,
    fulfillmentVersion: 1,
    dedupeKey: 'book-ready/order_1/base_book/1',
    payload,
    payloadHash: hashPayload(payload),
    status: 'failed',
    failureClass: 'send_ambiguous',
    attempts: 1,
    sendAttempts: 1,
    sendAttempted: true,
    firstSendAttemptAt: new Date(NOW.getTime() - 60_000),
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastError: 'response_lost',
    providerMessageId: 'email_1',
    sentAt: null,
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: NOW,
    ...overrides,
  } as DeliveryOutbox;
}

function fakePrisma(
  initialCase: ExceptionCase,
  initialOutbox?: DeliveryOutbox,
  initialBudget?: { count: number; windowStartAt: Date } | null,
) {
  let row = { ...initialCase };
  let delivery = initialOutbox ? { ...initialOutbox } : null;
  let budget: { orderId: string; scope: string; count: number; windowStartAt: Date } | null =
    initialBudget ? { orderId: initialCase.orderId, scope: initialCase.scope, ...initialBudget } : null;
  const audits: unknown[] = [];
  const createdDeliveries: any[] = [];

  const exceptionCaseModel = {
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (
        (where.id && where.id !== row.id) ||
        (where.status && where.status !== row.status) ||
        (where.claimVersion !== undefined && where.claimVersion !== row.claimVersion) ||
        (where.actionAttemptedAt === null && row.actionAttemptedAt !== null) ||
        (where.notificationAttemptedAt === null && row.notificationAttemptedAt !== null)
      ) {
        return { count: 0 };
      }
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'increment' in value) {
          (row as any)[key] += Number((value as { increment: number }).increment);
        } else if (value !== undefined) {
          (row as any)[key] = value;
        }
      }
      return { count: 1 };
    }),
    findUnique: vi.fn(async () => ({ ...row })),
  };
  const deliveryOutbox = {
    findUnique: vi.fn(async ({ where }: any) =>
      where.id && delivery?.id === where.id ? { ...delivery } : null,
    ),
    create: vi.fn(async ({ data }: any) => {
      const created = { id: `created_${createdDeliveries.length + 1}`, ...data };
      createdDeliveries.push(created);
      return created;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (
        !delivery ||
        (where.id && where.id !== delivery.id) ||
        (where.status && where.status !== delivery.status) ||
        (where.failureClass && where.failureClass !== delivery.failureClass)
      ) {
        return { count: 0 };
      }
      delivery = { ...delivery, ...data };
      return { count: 1 };
    }),
  };
  const reissueBudget = {
    findUnique: vi.fn(async () => (budget ? { ...budget } : null)),
    create: vi.fn(async ({ data }: any) => {
      budget = { count: 0, ...data };
      return { ...budget };
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (!budget) return { count: 0 };
      if (where.count?.lt !== undefined && !(budget.count < where.count.lt)) return { count: 0 };
      if (data.count?.increment) budget.count += Number(data.count.increment);
      return { count: 1 };
    }),
  };
  const prisma = {
    exceptionCase: exceptionCaseModel,
    exceptionCaseAudit: {
      create: vi.fn(async ({ data }: any) => {
        audits.push(data);
        return data;
      }),
    },
    deliveryOutbox,
    reissueBudget,
    order: {
      findUnique: vi.fn(async () => ({
        id: 'order_1',
        paymentProvider: 'fake',
        paymentId: 'payment_1',
        paymeTransactionId: null,
        stripePaymentId: null,
        customerEmail: 'parent@example.com',
        customerName: 'Parent',
        childName: 'Child',
        payment: null,
        status: 'ready',
        fulfillmentVersion: 1,
        inputVersion: 3,
        book: {
          readUrl: 'https://app.example.com/ready?orderId=order_1',
          pdfUrl: null,
          pages: [],
        },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    bookReadiness: {
      findUnique: vi.fn(async () => ({
        status: 'passed',
        currentManifestId: 'manifest_1',
      })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  } as unknown as PrismaClient;

  return {
    prisma,
    currentCase: () => row,
    currentOutbox: () => delivery,
    currentBudget: () => budget,
    createdDeliveries,
    audits,
    exceptionCaseModel,
  };
}

function deps(overrides: Partial<ExceptionProcessorDeps> = {}): Partial<ExceptionProcessorDeps> {
  return {
    now: () => NOW,
    replayEmail: vi.fn(async () => ({ providerMessageId: 'email_recovered' })),
    emailState: vi.fn(async () => ({
      state: 'delivered' as const,
      event: 'delivered',
    })),
    refund: vi.fn(async () => ({
      state: 'confirmed' as const,
      provider: 'fake',
      providerActionId: 'refund_1',
    })),
    refundNotice: vi.fn(async () => ({ providerMessageId: 'notice_1' })),
    repairInvalidPayload: vi.fn(async () => 'repaired' as const),
    redriveGeneration: vi.fn(async () => ({ started: true })),
    recommitReadiness: vi.fn(async () => ({
      manifestId: 'manifest_2',
      revision: 2,
      manifestStatus: 'passed' as const,
      orderStatus: 'ready',
      deliveryHoldReason: null,
      enqueued: true,
      reason: null,
    })),
    ...overrides,
  };
}

describe('ExceptionCase autonomous processor', () => {
  it('reconciles a provider-confirmed delivery and never replays the email', async () => {
    const state = exceptionCase();
    const db = fakePrisma(state, outbox());
    const replayEmail = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({ replayEmail })))
      .resolves.toBe('resolved');

    expect(replayEmail).not.toHaveBeenCalled();
    expect(db.currentOutbox()?.status).toBe('sent');
    expect(db.currentCase().status).toBe('resolved');
  });

  it('resolves rather than refunds after a crash left the Outbox already sent', async () => {
    const state = exceptionCase();
    const db = fakePrisma(state, outbox({
      status: 'sent',
      failureClass: null,
      sentAt: NOW,
    }));
    const refund = vi.fn();
    const emailState = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({ refund, emailState })))
      .resolves.toBe('resolved');

    expect(refund).not.toHaveBeenCalled();
    expect(emailState).not.toHaveBeenCalled();
    expect(db.currentCase().status).toBe('resolved');
  });

  it('replays only the exact payload and key inside the provider idempotency window to recover an id', async () => {
    const state = exceptionCase();
    const delivery = outbox({ providerMessageId: null });
    const db = fakePrisma(state, delivery);
    const replayEmail = vi.fn(async () => ({ providerMessageId: 'email_recovered' }));

    await expect(processExceptionCase(db.prisma, state, deps({ replayEmail })))
      .resolves.toBe('resolved');

    expect(replayEmail).toHaveBeenCalledWith(delivery.payload, delivery.dedupeKey);
    expect(db.currentOutbox()?.providerMessageId).toBe('email_recovered');
  });

  it('creates a new fulfillment only after the provider proves the prior email failed', async () => {
    const previousAppUrl = process.env.APP_URL;
    const previousPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    // isCanonicalReadUrl reads NEXT_PUBLIC_APP_URL || APP_URL — set BOTH so the test holds regardless of a
    // loaded .env.local (which pins NEXT_PUBLIC_APP_URL=localhost:3000 and would win the ||).
    process.env.APP_URL = 'https://app.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    const state = exceptionCase();
    const db = fakePrisma(state, outbox());
    try {
      await expect(processExceptionCase(db.prisma, state, deps({
        emailState: vi.fn(async () => ({
          state: 'failed' as const,
          event: 'bounced',
        })),
      }))).resolves.toBe('resolved');
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
      if (previousPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousPublicAppUrl;
    }

    expect(db.createdDeliveries).toHaveLength(1);
    expect(db.createdDeliveries[0].dedupeKey)
      .toBe('book-ready/order_1/base-book/2');
    expect(db.currentOutbox()?.failureClass).toBe('provider_confirmed_failed');
    // (#6-FIX-2) the first reissue consumes one unit of the durable order:scope budget.
    expect(db.currentBudget()?.count).toBe(1);
  });

  it('#6-FIX-2: a confirmed-failed delivery with the reissue budget already exhausted → refund, not a 2nd reissue', async () => {
    const state = exceptionCase();
    const previousAppUrl = process.env.APP_URL;
    const previousPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.APP_URL = 'https://app.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    // Budget already consumed by a prior reissue (a different case + fulfillmentVersion), window still open.
    const db = fakePrisma(state, outbox(), { count: REISSUE_BUDGET, windowStartAt: new Date(NOW.getTime() - 60_000) });
    try {
      await expect(processExceptionCase(db.prisma, state, deps({
        emailState: vi.fn(async () => ({ state: 'failed' as const, event: 'bounced' })),
      }))).resolves.toBe('refund_pending');
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
      if (previousPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousPublicAppUrl;
    }
    expect(db.createdDeliveries).toHaveLength(0); // NO second reissue
    expect(db.currentCase().status).toBe('refund_pending');
  });

  it('#6-FIX-2: a confirmed-failed delivery past the GLOBAL 48h window (from the first send) → refund, never reissue', async () => {
    const state = exceptionCase();
    const db = fakePrisma(
      state,
      outbox({ firstSendAttemptAt: new Date(NOW.getTime() - 49 * 60 * 60 * 1000) }),
    );
    await expect(processExceptionCase(db.prisma, state, deps({
      emailState: vi.fn(async () => ({ state: 'failed' as const, event: 'bounced' })),
    }))).resolves.toBe('refund_pending');
    expect(db.createdDeliveries).toHaveLength(0);
    expect(db.currentBudget()).toBeNull(); // window check fails before any consume — no budget row created
  });

  it('never blind-resends after the idempotency window and moves to refund', async () => {
    const state = exceptionCase();
    const db = fakePrisma(state, outbox({
      providerMessageId: null,
      firstSendAttemptAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    }));
    const replayEmail = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({ replayEmail })))
      .resolves.toBe('refund_pending');

    expect(replayEmail).not.toHaveBeenCalled();
    expect(db.currentCase().status).toBe('refund_pending');
  });

  it('turns a bounded recovery into a durable refund liability', async () => {
    const state = exceptionCase({
      kind: 'infra_transient',
      status: 'retry_scheduled',
      sourceRef: 'generation:order_1',
      attempts: EXCEPTION_MAX_RECOVERY_ATTEMPTS + 1,
    });
    const db = fakePrisma(state);
    const redriveGeneration = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({ redriveGeneration })))
      .resolves.toBe('refund_pending');
    expect(redriveGeneration).not.toHaveBeenCalled();
    expect(db.currentCase().refundKey).toBe('refund/case_1');
  });

  it('moves an expired customer-action SLA to refund instead of waiting forever', async () => {
    const state = exceptionCase({
      kind: 'unusable_photo',
      status: 'customer_action',
      sourceRef: null,
    });
    const db = fakePrisma(state);

    await expect(processExceptionCase(db.prisma, state, deps()))
      .resolves.toBe('refund_pending');
    expect(db.currentCase().reason).toBe('test');
    expect(db.currentCase().status).toBe('refund_pending');
  });

  it('repairs invalid payload only through the explicit same-intent repair path', async () => {
    const state = exceptionCase({ kind: 'invalid_payload' });
    const db = fakePrisma(state, outbox({ status: 'invalid_payload', failureClass: null }));
    const repairInvalidPayload = vi.fn(async () => 'repaired' as const);

    await expect(processExceptionCase(db.prisma, state, deps({ repairInvalidPayload })))
      .resolves.toBe('resolved');
    expect(repairInvalidPayload).toHaveBeenCalledWith(db.prisma, 'outbox_1', NOW);
  });

  it('resolves an invalid-payload case when a prior repair committed before a crash', async () => {
    const state = exceptionCase({ kind: 'invalid_payload' });
    const db = fakePrisma(state, outbox({ status: 'scheduled', failureClass: null }));
    const refund = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({
      repairInvalidPayload: vi.fn(async () => 'already_repaired' as const),
      refund,
    }))).resolves.toBe('resolved');
    expect(refund).not.toHaveBeenCalled();
  });

  it('reserves refund and notice intent before effects, then resolves once both are confirmed', async () => {
    const state = exceptionCase({
      kind: 'quality_failed',
      status: 'refund_pending',
      sourceRef: null,
    });
    const db = fakePrisma(state);
    const refund = vi.fn(async () => ({
      state: 'confirmed' as const,
      provider: 'fake',
      providerActionId: 'refund_1',
    }));
    const refundNotice = vi.fn(async () => ({ providerMessageId: 'notice_1' }));

    await expect(processExceptionCase(db.prisma, state, deps({ refund, refundNotice })))
      .resolves.toBe('resolved');

    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order_1' }),
      'refund/case_1',
      null,
      expect.objectContaining({ refundFence: expect.anything() }), // (#6-FIX-3) durable exactly-once fence is wired in
    );
    expect(db.currentCase().actionAttemptedAt).toEqual(NOW);
    expect(db.currentCase().notificationAttemptedAt).toEqual(NOW);
    expect(db.currentCase().providerActionId).toBe('refund_1');
    expect(db.currentCase().notificationMessageId).toBe('notice_1');
  });

  it('keeps provider outages in refund_pending instead of pretending resolution', async () => {
    const state = exceptionCase({
      kind: 'quality_failed',
      status: 'refund_pending',
      sourceRef: null,
    });
    const db = fakePrisma(state);

    await expect(processExceptionCase(db.prisma, state, deps({
      refund: vi.fn(async () => {
        throw new Error('provider_down');
      }),
    }))).resolves.toBe('refund_pending');

    expect(db.currentCase().status).toBe('refund_pending');
    expect(db.currentCase().lastError).toBe('provider_down');
    expect(db.currentCase().activeKey).toBe('order_1:base_book');
  });

  it('performs no external effect after losing its claim fence', async () => {
    const state = exceptionCase({
      kind: 'quality_failed',
      status: 'refund_pending',
      sourceRef: null,
    });
    const db = fakePrisma(state);
    db.exceptionCaseModel.findUnique.mockResolvedValueOnce({
      ...state,
      claimVersion: state.claimVersion + 1,
    });
    const refund = vi.fn();

    await expect(processExceptionCase(db.prisma, state, deps({ refund })))
      .resolves.toBe('lost_lease');
    expect(refund).not.toHaveBeenCalled();
  });

  it('does not reopen a terminal source after its historical case was resolved', async () => {
    const upsert = vi.fn();
    const prisma = {
      deliveryOutbox: {
        findMany: vi.fn(async () => [outbox()]),
      },
      generationJob: {
        findMany: vi.fn(async () => []),
      },
      exceptionCase: {
        findMany: vi.fn(async () => [{ sourceRef: 'outbox_1' }]),
        upsert,
      },
      exceptionCaseAudit: { createMany: vi.fn() },
    };

    await expect(syncTerminalExceptionCases(prisma as never, NOW)).resolves.toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
