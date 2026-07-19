import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  classifyPayment, blockingCases, parkOneOrderAtomic, verifyParked, type ActiveCaseRow,
} from '@/lib/cutover/quarantine-park';

describe('classifyPayment (P1-6 — never infer paid from Order.status)', () => {
  const base = { stripePaymentId: null, paymeTransactionId: null };
  it('status="paid" with NO PaymentRecord and no real id → status_paid_only (the dangerous class)', () => {
    expect(classifyPayment({ ...base, status: 'paid' }, null)).toBe('status_paid_only');
  });
  it('PaymentRecord.paid + provider "fake" → record_paid_fake (even if Order.status="paid")', () => {
    expect(classifyPayment({ ...base, status: 'paid' }, { provider: 'fake', paid: true })).toBe('record_paid_fake');
    expect(classifyPayment({ ...base, status: 'generating' }, { provider: 'fake', paid: true })).toBe('record_paid_fake');
  });
  it('PaymentRecord.paid + real provider → record_paid_external', () => {
    expect(classifyPayment({ ...base, status: 'generating' }, { provider: 'payme', paid: true })).toBe('record_paid_external');
    expect(classifyPayment({ ...base, status: 'paid' }, { provider: 'stripe', paid: true })).toBe('record_paid_external');
  });
  it('a real external payment id with a MISSING record → record_paid_external (manual review, not unpaid)', () => {
    expect(classifyPayment({ status: 'generating', stripePaymentId: 'pi_1', paymeTransactionId: null }, null)).toBe('record_paid_external');
  });
  it('no record, no real id, status not paid → unpaid; an unpaid PaymentRecord is not "paid"', () => {
    expect(classifyPayment({ ...base, status: 'generating' }, null)).toBe('unpaid');
    expect(classifyPayment({ ...base, status: 'generating' }, { provider: 'payme', paid: false })).toBe('unpaid');
  });
});

describe('blockingCases (P0-2)', () => {
  const rows: ActiveCaseRow[] = [
    { id: 'a', orderId: 'o1', scope: 'base_book', kind: 'infra_transient', status: 'open' },
    { id: 'b', orderId: 'o2', scope: 'payment', kind: 'safety_failed', status: 'refund_pending' },
    { id: 'c', orderId: 'o3', scope: 'base_book', kind: 'unusable_photo', status: 'customer_action' },
    { id: 'd', orderId: 'o4', scope: 'base_book', kind: 'infra_transient', status: 'retry_scheduled' },
  ];
  it('returns only refund_pending/customer_action', () => {
    expect(blockingCases(rows).map((c) => c.id)).toEqual(['b', 'c']);
  });
});

// ── Atomicity (P0-1): a forced failure at ANY of the three steps aborts the whole tx (→ Prisma rolls back) ─────────
function fakePrisma(txOverrides: Record<string, unknown> = {}) {
  const jobUpdateMany = vi.fn(async () => ({ count: 1 }));
  const tx = { generationJob: { updateMany: jobUpdateMany }, ...txOverrides };
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));
  return { prisma: { $transaction } as unknown as PrismaClient, $transaction, tx, jobUpdateMany };
}
const ARGS = (cases: ActiveCaseRow[] = []) => ({ orderId: 'o1', prior: 'generating', cases, now: new Date(0) });
const CASE: ActiveCaseRow = { id: 'c1', orderId: 'o1', scope: 'base_book', kind: 'infra_transient', status: 'open' };

describe('parkOneOrderAtomic (P0-1 — one atomic tx; any failure aborts)', () => {
  it('happy path: all three writes run inside ONE $transaction', async () => {
    const f = fakePrisma();
    const writeHold = vi.fn(async () => 'applied' as const);
    const resolveCase = vi.fn(async () => true);
    await parkOneOrderAtomic(f.prisma, ARGS([CASE]), { writeHold, resolveCase });
    expect(f.$transaction).toHaveBeenCalledTimes(1); // single transaction ⇒ atomic
    expect(f.jobUpdateMany).toHaveBeenCalledTimes(1);
    expect(resolveCase).toHaveBeenCalledTimes(1);
    expect(writeHold).toHaveBeenCalledTimes(1);
  });

  it('step 1 (job park) throws → the tx callback rejects (rollback)', async () => {
    const f = fakePrisma({ generationJob: { updateMany: vi.fn(async () => { throw new Error('db down'); }) } });
    await expect(parkOneOrderAtomic(f.prisma, ARGS([CASE]), { writeHold: vi.fn(async () => 'applied' as const), resolveCase: vi.fn(async () => true) })).rejects.toThrow(/db down/);
  });

  it('step 2 (case neutralize) returns false → abort', async () => {
    const f = fakePrisma();
    const writeHold = vi.fn(async () => 'applied' as const);
    await expect(parkOneOrderAtomic(f.prisma, ARGS([CASE]), { writeHold, resolveCase: vi.fn(async () => false) })).rejects.toThrow(/could not be safely neutralized/);
    expect(writeHold).not.toHaveBeenCalled(); // never reached the hold write
  });

  it('step 3 (order hold) not "applied" → abort', async () => {
    const f = fakePrisma();
    await expect(parkOneOrderAtomic(f.prisma, ARGS([]), { writeHold: vi.fn(async () => 'superseded' as const), resolveCase: vi.fn(async () => true) })).rejects.toThrow(/returned 'superseded'/);
  });
});

describe('verifyParked (P0-7)', () => {
  function verifyPrisma(orders: unknown[]) {
    return { order: { findMany: vi.fn(async () => orders) } } as unknown as PrismaClient;
  }
  it('all parked exactly → no mismatches', async () => {
    const p = verifyPrisma([{ id: 'o1', status: 'needs_human_qa', deliveryHoldReason: 'quarantine_cutover:generating', generationJob: { status: 'failed', currentStage: 'failed' } }]);
    expect(await verifyParked(p, ['o1'])).toEqual([]);
  });
  it('detects an unparked order (wrong status), a missing marker, a live job, and a vanished row', async () => {
    const p = verifyPrisma([
      { id: 'o1', status: 'generating', deliveryHoldReason: null, generationJob: { status: 'running', currentStage: 'page_images' } },
      { id: 'o2', status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:x', generationJob: { status: 'failed', currentStage: 'failed' } },
    ]);
    const m = await verifyParked(p, ['o1', 'o2', 'o3']);
    const ids = m.map((x) => x.orderId);
    expect(ids).toContain('o1'); // wrong status + live job
    expect(ids).toContain('o2'); // marker is not quarantine_cutover:
    expect(ids).toContain('o3'); // vanished
  });
});
