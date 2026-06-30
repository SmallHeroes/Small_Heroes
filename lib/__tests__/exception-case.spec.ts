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

// Typed accessors for mock-call args (the inferred arg tuple is empty for argless vi.fn()).
const upsertUpdate = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  ((fn.mock.calls[0] as unknown[])[0] as { update: Record<string, unknown> }).update;
const auditReason = (fn: ReturnType<typeof vi.fn>): string =>
  ((fn.mock.calls[0] as unknown[])[0] as { data: Array<{ reason: string }> }).data[0].reason;

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
        claimVersion: { increment: 1 },
        leaseExpiresAt: null,
      }),
    }));
    // (#6-FIX-1) the fence update must NOT rewrite kind/status/sourceRef — clobbering them could bypass
    // reconciliation. Only the claim fence (+ lastError reset) is applied.
    const update = upsertUpdate(upsert);
    expect(update).not.toHaveProperty('kind');
    expect(update).not.toHaveProperty('status');
    expect(update).not.toHaveProperty('sourceRef');
  });

  it('#6-FIX-1: a later generation/readiness failure does NOT clobber a send_ambiguous case (reconciliation preserved, no refund-before-reconciliation)', async () => {
    const existing = caseRow({ kind: 'send_ambiguous', status: 'open', reason: 'idempotency_window_expired' });
    const upsert = vi.fn(async () => existing); // the upsert update clause never rewrites kind/status (FIX-1)
    const updateMany = vi.fn(async () => ({ count: 1 })); // the upgrade path — must NOT be taken for a protected case
    const createMany = vi.fn(async () => ({ count: 1 }));
    const db = {
      exceptionCase: { upsert, updateMany, findUnique: vi.fn(async () => existing) },
      exceptionCaseAudit: { createMany },
    };
    const result = await openExceptionCase(db as never, {
      orderId: 'o1',
      kind: 'quality_failed', // a generation/readiness failure that would normally route straight to refund_pending
      reason: 'integrity_blocked_after_send',
      now: NOW,
    });
    // kind + status are PRESERVED → the processor still reconciles the ambiguous send; no premature refund.
    expect(result.kind).toBe('send_ambiguous');
    expect(result.status).toBe('open');
    expect(updateMany).not.toHaveBeenCalled(); // send_ambiguous is protected → never upgraded/clobbered
    expect(upsertUpdate(upsert)).not.toHaveProperty('kind');
    expect(auditReason(createMany)).toMatch(/^producer_recorded:/);
  });

  it('#6-FIX-1: a pre-external retry case IS upgraded to a strictly higher-priority kind (infra_transient → safety_failed)', async () => {
    const existing = caseRow({ kind: 'infra_transient', status: 'retry_scheduled', claimVersion: 2, actionAttemptedAt: null });
    const upgraded = caseRow({ kind: 'safety_failed', status: 'refund_pending', claimVersion: 2 });
    const upsert = vi.fn(async () => existing);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const findUnique = vi.fn(async () => upgraded);
    const createMany = vi.fn(async () => ({ count: 1 }));
    const db = { exceptionCase: { upsert, updateMany, findUnique }, exceptionCaseAudit: { createMany } };
    const result = await openExceptionCase(db as never, { orderId: 'o1', kind: 'safety_failed', reason: 'budget_exhausted', now: NOW });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ kind: 'infra_transient', claimVersion: 2, actionAttemptedAt: null }),
      data: expect.objectContaining({ kind: 'safety_failed', status: 'refund_pending' }),
    }));
    expect(result.kind).toBe('safety_failed');
    expect(auditReason(createMany)).toMatch(/^producer_upgraded:/);
  });

  it('#6-FIX-1: a lower-priority signal never downgrades a pre-external case (recorded only)', async () => {
    const existing = caseRow({ kind: 'integrity_blocked', status: 'retry_scheduled' });
    const upsert = vi.fn(async () => existing);
    const updateMany = vi.fn();
    const createMany = vi.fn(async () => ({ count: 1 }));
    const db = { exceptionCase: { upsert, updateMany, findUnique: vi.fn(async () => existing) }, exceptionCaseAudit: { createMany } };
    const result = await openExceptionCase(db as never, { orderId: 'o1', kind: 'infra_transient', reason: 'transient', now: NOW });
    expect(updateMany).not.toHaveBeenCalled();
    expect(result.kind).toBe('integrity_blocked');
    expect(auditReason(createMany)).toMatch(/^producer_recorded:/);
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
    const previousPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    // isCanonicalReadUrl reads NEXT_PUBLIC_APP_URL || APP_URL — set BOTH so the test holds regardless of a
    // loaded .env.local (which pins NEXT_PUBLIC_APP_URL=localhost:3000 and would win the ||).
    process.env.APP_URL = 'https://app.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    const oldOutbox = {
      id: 'ob1',
      status: 'failed',
      failureClass: 'send_ambiguous',
      firstSendAttemptAt: new Date('2026-06-30T11:00:00.000Z'), // 1h ago → within the 48h reissue window
    };
    const create = vi.fn(async ({ data }) => ({ id: 'ob2', ...data }));
    const outboxUpdate = vi.fn(async () => ({ count: 1 }));
    const reissueBudgetCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'rb1', ...data }));
    const tx = {
      exceptionCase: { updateMany: vi.fn(async () => ({ count: 1 })) },
      exceptionCaseAudit: { create: vi.fn(async () => ({})) },
      // (#6-FIX-2) the reissue now consumes the durable budget atomically — no prior row → first reissue allowed.
      reissueBudget: { findUnique: vi.fn(async () => null), create: reissueBudgetCreate, updateMany: vi.fn(async () => ({ count: 1 })) },
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
      if (previousPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousPublicAppUrl;
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
