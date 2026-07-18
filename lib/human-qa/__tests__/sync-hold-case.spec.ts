import { describe, it, expect, vi } from 'vitest';
import { syncHumanQaHoldCase, syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';

/**
 * (Human-QA Slice 1, re-gate P0-1) The case lifecycle lives OUTSIDE every hold/money tx. These tests pin the two
 * properties the whole re-gate rests on:
 *  1. syncHumanQaHoldCasePostCommit NEVER throws into its caller (the seam) — a case-write failure is swallowed and
 *     left for the reconciler, so the already-committed money/hold can never be rolled back by case logic.
 *  2. syncHumanQaHoldCase opens a case ONLY for a terminal manual hold and never runs a write tx for a recoverable /
 *     recovery-owned / unknown park (the reconciler-repair path + the "no spurious case" guarantee).
 */

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

describe('syncHumanQaHoldCasePostCommit — never throws into the seam', () => {
  it('swallows an error thrown while reconciling the case (money/hold already committed)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => { throw new Error('db down mid-reconcile'); }) },
    } as unknown as Parameters<typeof syncHumanQaHoldCasePostCommit>[0];
    await expect(syncHumanQaHoldCasePostCommit(prisma, 'o1')).resolves.toBeUndefined();
  });

  it('swallows an error thrown by the write transaction (the create path)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'safety_hold:hazard' })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async () => { throw new Error('case insert exploded'); }),
    } as unknown as Parameters<typeof syncHumanQaHoldCasePostCommit>[0];
    await expect(syncHumanQaHoldCasePostCommit(prisma, 'o1')).resolves.toBeUndefined();
  });
});

describe('syncHumanQaHoldCase — opens a case only for a terminal manual hold', () => {
  it('a missing order → skipped:no_order (no writes)', async () => {
    const $transaction = vi.fn();
    const prisma = {
      order: { findUnique: vi.fn(async () => null) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'no_order' });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('a recoverable base_book_integrity park → skipped:recoverable, NEVER runs a write tx', async () => {
    const $transaction = vi.fn();
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'base_book_integrity:missing_page' })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'recoverable', scope: undefined });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('an order owned by an active recovery ExceptionCase → skipped:exception_case, no write tx', async () => {
    const $transaction = vi.fn();
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: null })) },
      exceptionCase: { findFirst: vi.fn(async () => ({ id: 'ec1' })) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'skipped', reason: 'exception_case', scope: undefined });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('an unknown marker → skipped:unknown by default; opens legacy_unknown only with includeUnknown', async () => {
    const mk = () => ({
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'weird_future_hold:x' })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async () => ({ action: 'create', caseId: 'c1', revision: 1 })),
    });
    const off = mk();
    expect(await syncHumanQaHoldCase(off as never, 'o1')).toEqual({ action: 'skipped', reason: 'unknown', scope: undefined });
    expect(off.$transaction).not.toHaveBeenCalled();

    const on = mk();
    expect(await syncHumanQaHoldCase(on as never, 'o1', { includeUnknown: true })).toEqual({
      action: 'created', kind: 'legacy_unknown', scope: 'base_book', caseId: 'c1',
    });
    expect(on.$transaction).toHaveBeenCalledTimes(1);
  });

  it('a terminal safety hold with NO case → creates one (the reconciler-repair path)', async () => {
    const $transaction = vi.fn(async () => ({ action: 'create', caseId: 'c_safety', revision: 1 }));
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'safety_hold:hazard' })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({
      action: 'created', kind: 'safety', scope: 'base_book', caseId: 'c_safety',
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('the payment fence (manualReviewRequired) → creates a payment-scope case', async () => {
    const $transaction = vi.fn(async () => ({ action: 'create', caseId: 'c_pay', revision: 1 }));
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'coupon_over_cap', manualReviewRequired: true })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({
      action: 'created', kind: 'payment_integrity', scope: 'payment', caseId: 'c_pay',
    });
  });

  it('a delivered (ready) order resolves a lingering anchor case (no create)', async () => {
    const $transaction = vi.fn(async () => ({ resolvedCaseId: 'c_anchor' }));
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ status: 'ready', deliveryHoldReason: null })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1')).toEqual({ action: 'resolved' });
  });

  it('dry-run reports would_create but runs no write tx', async () => {
    const $transaction = vi.fn();
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow({ deliveryHoldReason: 'anchor_low_confidence:soft_band' })) },
      exceptionCase: { findFirst: vi.fn(async () => null) },
      $transaction,
    } as unknown as Parameters<typeof syncHumanQaHoldCase>[0];
    expect(await syncHumanQaHoldCase(prisma, 'o1', { dryRun: true })).toEqual({
      action: 'would_create', kind: 'anchor', scope: 'base_book',
    });
    expect($transaction).not.toHaveBeenCalled();
  });
});
