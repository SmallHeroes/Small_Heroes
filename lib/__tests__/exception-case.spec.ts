import { describe, expect, it, vi } from 'vitest';
import {
  claimDueExceptionCases,
  exceptionActiveKey,
  openExceptionCase,
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
});
