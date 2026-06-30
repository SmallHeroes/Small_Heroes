import { describe, expect, it, vi } from 'vitest';
import {
  claimDueExceptionCases,
  exceptionActiveKey,
  fencedOutboxTerminalWithException,
  openExceptionCase,
  reissueConfirmedFailedDelivery,
  resolveAmbiguousDelivery,
  transitionExceptionCase,
} from '@/lib/generation-chunked/exception-case';

const NOW = new Date('2026-06-30T12:00:00.000Z');

function caseRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ec1',
    activeKey: 'o1:base_book',
    orderId: 'o1',
    scope: 'base_book',
    kind: 'send_ambiguous',
    status: 'open',
    reason: 'send_failed',
    attempts: 0,
    nextActionAt: NOW,
    resolution: null,
    sourceRef: 'ob1',
    claimVersion: 0,
    leaseExpiresAt: null,
    lastError: null,
    refundKey: null,
    providerActionId: null,
    actionAttemptedAt: null,
    notificationAttemptedAt: null,
    notificationMessageId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe('ExceptionCase producer + lifecycle', () => {
  it('uses one stable active key and idempotent audit event for replayed producers', async () => {
    const upsert = vi.fn(async (args) => caseRow({
      kind: args.create.kind,
      status: args.create.status,
      reason: args.create.reason,
    }));
    const createMany = vi.fn(async (_args: {
      data: Array<{ eventKey: string }>;
      skipDuplicates: boolean;
    }) => ({ count: 1 }));
    const db = {
      exceptionCase: { upsert },
      exceptionCaseAudit: { createMany },
    };

    await openExceptionCase(db as never, {
      orderId: 'o1',
      kind: 'send_ambiguous',
      reason: 'idempotency_window_expired',
      sourceRef: 'ob1',
      now: NOW,
    });
    await openExceptionCase(db as never, {
      orderId: 'o1',
      kind: 'send_ambiguous',
      reason: 'idempotency_window_expired',
      sourceRef: 'ob1',
      now: NOW,
    });

    expect(exceptionActiveKey('o1', 'base_book')).toBe('o1:base_book');
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { activeKey: 'o1:base_book' },
      create: {
        activeKey: 'o1:base_book',
        orderId: 'o1',
        scope: 'base_book',
        kind: 'send_ambiguous',
        status: 'open',
      },
    });
    expect(createMany).toHaveBeenCalledTimes(2);
    const eventA = createMany.mock.calls[0][0].data[0].eventKey;
    const eventB = createMany.mock.calls[1][0].data[0].eventKey;
    expect(eventA).toBe(eventB);
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it('routes deterministic safety failures directly to a durable refund obligation', async () => {
    const upsert = vi.fn(async (args) => caseRow({
      kind: args.create.kind,
      status: args.create.status,
      reason: args.create.reason,
    }));
    const db = {
      exceptionCase: { upsert },
      exceptionCaseAudit: { createMany: vi.fn(async () => ({ count: 1 })) },
    };
    await openExceptionCase(db as never, {
      orderId: 'o1',
      kind: 'safety_failed',
      reason: 'budget_exhausted',
      now: NOW,
    });
    expect(upsert.mock.calls[0][0].create.status).toBe('refund_pending');
  });

  it('co-locates a fenced terminal transition and its audit in one transaction', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn(async () => ({}));
    const tx = {
      exceptionCase: { updateMany },
      exceptionCaseAudit: { create },
    };
    const db = {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => unknown) => fn(tx)),
    };
    const ok = await transitionExceptionCase(db as never, {
      caseId: 'ec1',
      claimVersion: 4,
      fromStatus: 'open',
      toStatus: 'resolved',
      reason: 'provider_confirmed_delivered',
      resolution: { outcome: 'delivered' },
      now: NOW,
    });
    expect(ok).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ec1', status: 'open', claimVersion: 4 },
      data: expect.objectContaining({
        status: 'resolved',
        activeKey: null,
        leaseExpiresAt: null,
        claimVersion: { increment: 1 },
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'ec1',
        fromStatus: 'open',
        toStatus: 'resolved',
      }),
    });
  });

  it('a stale processor that lost its fence writes no transition and no audit', async () => {
    const create = vi.fn();
    const tx = {
      exceptionCase: { updateMany: vi.fn(async () => ({ count: 0 })) },
      exceptionCaseAudit: { create },
    };
    const db = {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => unknown) => fn(tx)),
    };
    const ok = await transitionExceptionCase(db as never, {
      caseId: 'ec1',
      claimVersion: 3,
      fromStatus: 'open',
      toStatus: 'resolved',
      reason: 'stale',
      now: NOW,
    });
    expect(ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('claims with SKIP LOCKED and increments a separate claimVersion fence', async () => {
    const $queryRaw = vi.fn(async () => [caseRow({ claimVersion: 3, attempts: 2 })]);
    const rows = await claimDueExceptionCases({ $queryRaw } as never, NOW, 1);
    expect(rows).toHaveLength(1);
    const sql = (($queryRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/"claimVersion" = "claimVersion" \+ 1/);
    expect(sql).toMatch(/"attempts" = "attempts" \+ 1/);
  });

  it('atomically fences an Outbox terminal and opens its one active case', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const upsert = vi.fn(async () => caseRow({
      kind: 'invalid_payload',
      reason: 'payload_integrity_mismatch',
    }));
    const tx = {
      deliveryOutbox: { updateMany },
      exceptionCase: { upsert },
      exceptionCaseAudit: { createMany: vi.fn(async () => ({ count: 1 })) },
    };
    const db = {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => unknown) => fn(tx)),
    };
    const ok = await fencedOutboxTerminalWithException(db as never, {
      row: { id: 'ob1', orderId: 'o1', scope: 'base_book' },
      token: 7,
      outboxData: { status: 'invalid_payload' },
      kind: 'invalid_payload',
      reason: 'payload_integrity_mismatch',
      now: NOW,
    });
    expect(ok).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ob1', status: 'processing', attempts: 7 },
      data: { status: 'invalid_payload' },
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { activeKey: 'o1:base_book' },
    }));
  });

  it('a stale Outbox worker opens no case', async () => {
    const upsert = vi.fn();
    const tx = {
      deliveryOutbox: { updateMany: vi.fn(async () => ({ count: 0 })) },
      exceptionCase: { upsert },
      exceptionCaseAudit: { createMany: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => unknown) => fn(tx)),
    };
    const ok = await fencedOutboxTerminalWithException(db as never, {
      row: { id: 'ob1', orderId: 'o1', scope: 'base_book' },
      token: 6,
      outboxData: { status: 'failed' },
      kind: 'send_ambiguous',
      reason: 'send_attempts_exhausted',
      now: NOW,
    });
    expect(ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rolls back the Outbox terminal if ExceptionCase creation fails', async () => {
    let outboxStatus = 'processing';
    const tx = {
      deliveryOutbox: {
        updateMany: vi.fn(async () => {
          outboxStatus = 'failed';
          return { count: 1 };
        }),
      },
      exceptionCase: {
        upsert: vi.fn(async () => {
          throw new Error('case_insert_failed');
        }),
      },
      exceptionCaseAudit: { createMany: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (callback: (inner: typeof tx) => unknown) => {
        const before = outboxStatus;
        try {
          return await callback(tx);
        } catch (error) {
          outboxStatus = before;
          throw error;
        }
      }),
    };

    await expect(fencedOutboxTerminalWithException(db as never, {
      row: { id: 'ob1', orderId: 'o1', scope: 'base_book' },
      token: 6,
      outboxData: { status: 'failed' },
      kind: 'send_ambiguous',
      reason: 'send_attempts_exhausted',
      now: NOW,
    })).rejects.toThrow('case_insert_failed');
    expect(outboxStatus).toBe('processing');
  });

  it('a superseding producer signal fences the processor that claimed the old failure class', async () => {
    const updated = caseRow({
      kind: 'send_ambiguous',
      reason: 'send_attempts_exhausted',
      claimVersion: 9,
      leaseExpiresAt: null,
    });
    const upsert = vi.fn(async () => updated);
    const db = {
      exceptionCase: {
        upsert,
      },
      exceptionCaseAudit: { createMany: vi.fn(async () => ({ count: 1 })) },
    };

    const result = await openExceptionCase(db as never, {
      orderId: 'o1',
      kind: 'send_ambiguous',
      reason: 'send_attempts_exhausted',
      sourceRef: 'ob1',
      now: NOW,
      fenceExisting: true,
    });

    expect(result.kind).toBe('send_ambiguous');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { activeKey: 'o1:base_book' },
      update: expect.objectContaining({
        kind: 'send_ambiguous',
        claimVersion: { increment: 1 },
        leaseExpiresAt: null,
      }),
    }));
  });

  it('atomically marks the Outbox sent and resolves its ambiguous case', async () => {
    const caseUpdate = vi.fn(async () => ({ count: 1 }));
    const outboxUpdate = vi.fn(async () => ({ count: 1 }));
    const tx = {
      exceptionCase: { updateMany: caseUpdate },
      exceptionCaseAudit: { create: vi.fn(async () => ({})) },
      deliveryOutbox: { updateMany: outboxUpdate },
    };
    const db = {
      $transaction: vi.fn(async (callback: (inner: typeof tx) => unknown) => callback(tx)),
    };

    await expect(resolveAmbiguousDelivery(db as never, {
      exceptionCase: { id: 'ec1', status: 'open', claimVersion: 4 },
      outboxId: 'ob1',
      providerMessageId: 'email_1',
      providerEvent: 'delivered',
      now: NOW,
    })).resolves.toBe(true);

    expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ec1', status: 'open', claimVersion: 4 },
    }));
    expect(outboxUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'ob1',
        status: 'failed',
        failureClass: 'send_ambiguous',
      },
      data: expect.objectContaining({ status: 'sent', providerMessageId: 'email_1' }),
    }));
  });

  it('rolls back case resolution if the ambiguous Outbox source changed', async () => {
    let caseStatus = 'open';
    const tx = {
      exceptionCase: {
        updateMany: vi.fn(async () => {
          caseStatus = 'resolved';
          return { count: 1 };
        }),
      },
      exceptionCaseAudit: { create: vi.fn(async () => ({})) },
      deliveryOutbox: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
    const db = {
      $transaction: vi.fn(async (callback: (inner: typeof tx) => unknown) => {
        const before = caseStatus;
        try {
          return await callback(tx);
        } catch (error) {
          caseStatus = before;
          throw error;
        }
      }),
    };

    await expect(resolveAmbiguousDelivery(db as never, {
      exceptionCase: { id: 'ec1', status: 'open', claimVersion: 4 },
      outboxId: 'ob1',
      providerMessageId: 'email_1',
      providerEvent: 'delivered',
      now: NOW,
    })).rejects.toThrow('ambiguous_delivery_source_changed');
    expect(caseStatus).toBe('open');
  });

  it('reissues a provider-confirmed failure as one new fulfillment intent', async () => {
    const previousAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://app.example.com';
    const oldOutbox = {
      id: 'ob1',
      status: 'failed',
      failureClass: 'send_ambiguous',
    };
    const create = vi.fn(async ({ data }) => ({ id: 'ob2', ...data }));
    const outboxUpdate = vi.fn(async () => ({ count: 1 }));
    const tx = {
      exceptionCase: { updateMany: vi.fn(async () => ({ count: 1 })) },
      exceptionCaseAudit: { create: vi.fn(async () => ({})) },
      deliveryOutbox: {
        findUnique: vi.fn(async ({ where }) =>
          where.id === 'ob1' ? oldOutbox : null,
        ),
        create,
        updateMany: outboxUpdate,
      },
      order: {
        findUnique: vi.fn(async () => ({
          status: 'ready',
          fulfillmentVersion: 1,
          inputVersion: 3,
          customerEmail: 'parent@example.com',
          customerName: 'Parent',
          childName: 'Child',
          book: {
            readUrl: 'https://app.example.com/ready?orderId=o1',
            pdfUrl: null,
            pages: [],
          },
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      bookReadiness: {
        findUnique: vi.fn(async () => ({
          status: 'passed',
          currentManifestId: 'm1',
        })),
      },
    };
    const db = {
      $transaction: vi.fn(async (callback: (inner: typeof tx) => unknown) => callback(tx)),
    };

    try {
      await expect(reissueConfirmedFailedDelivery(db as never, {
        exceptionCase: {
          id: 'ec1',
          orderId: 'o1',
          status: 'open',
          claimVersion: 4,
        },
        outboxId: 'ob1',
        providerMessageId: 'email_1',
        providerEvent: 'bounced',
        now: NOW,
      })).resolves.toBe('reissued');
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
    }

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'book-ready/o1/base-book/2',
        manifestId: 'm1',
      }),
    });
    expect(outboxUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'ob1',
        status: 'failed',
        failureClass: 'send_ambiguous',
      },
      data: expect.objectContaining({ failureClass: 'provider_confirmed_failed' }),
    }));
  });
});
