import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the record-hold delegates so these tests exercise syncHumanQaHoldCase's OWN logic (pre-read → locked re-read →
// classify → record/resolve) without the full case-insert DB surface. humanReasonForHoldKind + logger stay real.
vi.mock('@/lib/human-qa/record-hold', () => ({
  recordHumanQaHoldInTx: vi.fn(async () => ({ action: 'create', caseId: 'c1', revision: 1 })),
  resolveHumanQaCaseOnReleaseInTx: vi.fn(async () => ({ resolvedCaseId: 'c_anchor' })),
}));

import { syncHumanQaHoldCase, syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import { recordHumanQaHoldInTx, resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';

/**
 * (Human-QA Slice 1, re-gate P0-B + P1) Pins the two properties the re-gate rests on:
 *  - P0-B: syncHumanQaHoldCasePostCommit NEVER throws into its caller (the seam), even when the reconcile fails.
 *  - P1 (TOCTOU): the classify + record happen inside ONE locked (FOR UPDATE) transaction that RE-READS the Order,
 *    so a concurrent release flipping the Order to `ready` can never open a case on an already-released order.
 */

const recordSpy = vi.mocked(recordHumanQaHoldInTx);
const resolveSpy = vi.mocked(resolveHumanQaCaseOnReleaseInTx);

function orderRow(over: Record<string, unknown> = {}) {
  return {
    status: 'needs_human_qa',
    deliveryHoldReason: null as string | null,
    manualReviewRequired: false,
    childName: 'K',
    inputVersion: 1,
    visualContractHash: null as string | null,
    ...over,
  };
}

/**
 * Build a prisma mock. `pre` = the cheap unlocked pre-read row; `locked` = the row the FOR UPDATE re-read returns
 * INSIDE the tx (defaults to `pre` — pass a different one to simulate a concurrent status change under lock).
 */
function mkPrisma(opts: { pre: ReturnType<typeof orderRow> | null; locked?: ReturnType<typeof orderRow> | null; activeRecovery?: unknown }) {
  const lockedRow = opts.locked === undefined ? opts.pre : opts.locked;
  const txClient = {
    $queryRaw: vi.fn(async () => (lockedRow ? [lockedRow] : [])),
    exceptionCase: { findFirst: vi.fn(async () => opts.activeRecovery ?? null) },
  };
  const $transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(txClient));
  const prisma = {
    order: { findUnique: vi.fn(async () => opts.pre) },
    exceptionCase: { findFirst: vi.fn(async () => opts.activeRecovery ?? null) }, // dry-run path (unlocked)
    $transaction,
  };
  return { prisma: prisma as unknown as Parameters<typeof syncHumanQaHoldCase>[0], txClient, $transaction };
}

beforeEach(() => {
  recordSpy.mockClear();
  resolveSpy.mockClear();
  recordSpy.mockResolvedValue({ action: 'create', caseId: 'c1', revision: 1 } as never);
  resolveSpy.mockResolvedValue({ resolvedCaseId: 'c_anchor' } as never);
});

describe('syncHumanQaHoldCasePostCommit — never throws into the seam (P0-B)', () => {
  it('swallows (logs + counts) an error thrown while reconciling the case', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => { throw new Error('db down mid-reconcile'); }) },
    } as unknown as Parameters<typeof syncHumanQaHoldCasePostCommit>[0];
    await expect(syncHumanQaHoldCasePostCommit(prisma, 'o1')).resolves.toBeUndefined();
  });

  it('swallows an error thrown by the write transaction (the create path)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'safety_hold:hazard' })) },
      $transaction: vi.fn(async () => { throw new Error('case insert exploded'); }),
    } as unknown as Parameters<typeof syncHumanQaHoldCasePostCommit>[0];
    await expect(syncHumanQaHoldCasePostCommit(prisma, 'o1')).resolves.toBeUndefined();
  });
});

describe('syncHumanQaHoldCase — opens a case only for a terminal manual hold', () => {
  it('a missing order → skipped:no_order, no tx', async () => {
    const { prisma, $transaction } = mkPrisma({ pre: null });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'no_order' });
    expect($transaction).not.toHaveBeenCalled();
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('a recoverable base_book_integrity park → skipped:recoverable, records NOTHING', async () => {
    const { prisma } = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'base_book_integrity:missing_page' }) });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'recoverable', scope: undefined });
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('an order owned by an active recovery ExceptionCase → skipped:exception_case, records nothing', async () => {
    const { prisma } = mkPrisma({ pre: orderRow({ deliveryHoldReason: null }), activeRecovery: { id: 'ec1' } });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'exception_case', scope: undefined });
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('an unknown marker → skipped:unknown by default; opens legacy_unknown only with includeUnknown', async () => {
    const off = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'weird_future_hold:x' }) });
    expect(await syncHumanQaHoldCase(off.prisma, 'o1')).toEqual({ action: 'skipped', reason: 'unknown', scope: undefined });
    expect(recordSpy).not.toHaveBeenCalled();

    const on = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'weird_future_hold:x' }) });
    expect(await syncHumanQaHoldCase(on.prisma, 'o1', { includeUnknown: true })).toEqual({
      action: 'created', kind: 'legacy_unknown', scope: 'base_book', caseId: 'c1',
    });
    expect(recordSpy).toHaveBeenCalledTimes(1);
  });

  it('a terminal safety hold with NO case → creates one (the reconciler-repair path)', async () => {
    recordSpy.mockResolvedValue({ action: 'create', caseId: 'c_safety', revision: 1 } as never);
    const { prisma } = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'safety_hold:hazard' }) });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({
      action: 'created', kind: 'safety', scope: 'base_book', caseId: 'c_safety',
    });
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0][1]).toMatchObject({ kind: 'safety', scope: 'base_book' });
  });

  it('the payment fence (manualReviewRequired) → creates a payment-scope case', async () => {
    recordSpy.mockResolvedValue({ action: 'create', caseId: 'c_pay', revision: 1 } as never);
    const { prisma } = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'coupon_over_cap', manualReviewRequired: true }) });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({
      action: 'created', kind: 'payment_integrity', scope: 'payment', caseId: 'c_pay',
    });
  });

  it('a delivered (ready) order resolves a lingering anchor case (no create)', async () => {
    const { prisma } = mkPrisma({ pre: orderRow({ status: 'ready', deliveryHoldReason: null }) });
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'resolved' });
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('dry-run reports would_create but runs no write tx', async () => {
    const { prisma, $transaction } = mkPrisma({ pre: orderRow({ deliveryHoldReason: 'anchor_low_confidence:soft_band' }) });
    expect(await syncHumanQaHoldCase(prisma, 'o1', { dryRun: true })).toEqual({
      action: 'would_create', kind: 'anchor', scope: 'base_book',
    });
    expect($transaction).not.toHaveBeenCalled();
    expect(recordSpy).not.toHaveBeenCalled();
  });

  // ── P1 TOCTOU: a concurrent release between the pre-read and the locked re-read must NOT open a case ──────────
  it('(P1) concurrent release — pre-read says held (anchor), but the LOCKED re-read says ready → resolves, never creates', async () => {
    const { prisma } = mkPrisma({
      pre: orderRow({ deliveryHoldReason: 'anchor_low_confidence:soft_band' }), // pre-read: still held
      locked: orderRow({ status: 'ready', deliveryHoldReason: null }), // under lock: a concurrent release won
    });
    const res = await syncHumanQaHoldCase(prisma, 'o1');
    expect(res).toEqual({ action: 'resolved' });
    expect(recordSpy).not.toHaveBeenCalled(); // NO case opened on the already-released order
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });
});
