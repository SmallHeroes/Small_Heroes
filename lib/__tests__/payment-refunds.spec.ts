import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { refundOrderPayment, type RefundableOrder, type RefundFence, type RefundFenceRecord } from '@/lib/payment-refunds';

// In-memory RefundFence for the PayMe exactly-once tests (#6-FIX-3).
function fakeFence(seed: Record<string, RefundFenceRecord> = {}) {
  const records = new Map<string, RefundFenceRecord>(Object.entries(seed));
  const lookup = vi.fn(async (refundKey: string) => records.get(refundKey) ?? null);
  const begin = vi.fn(async ({ refundKey }: { refundKey: string; provider: string; providerSaleId: string }) => {
    const existing = records.get(refundKey);
    if (existing) return { heldFresh: false, record: existing };
    records.set(refundKey, { status: 'requested', providerActionId: null });
    return { heldFresh: true, record: null };
  });
  const dispatch = vi.fn(async (refundKey: string) => {
    const r = records.get(refundKey);
    if (r?.status === 'requested') { records.set(refundKey, { ...r, status: 'dispatched' }); return true; }
    return false; // single-flight: only the 'requested'→'dispatched' winner may call refund-sale
  });
  const settle = vi.fn(async ({ refundKey, status, providerActionId }: { refundKey: string; status: 'pending' | 'confirmed'; providerActionId: string | null }) => {
    records.set(refundKey, { status, providerActionId });
  });
  const fence: RefundFence = { lookup, begin, dispatch, settle };
  return { fence, records, lookup, begin, dispatch, settle };
}

function order(overrides: Partial<RefundableOrder> = {}): RefundableOrder {
  return {
    id: 'order_1',
    paymentProvider: 'stripe',
    paymentId: null,
    paymeTransactionId: null,
    stripePaymentId: 'pi_1',
    payment: null,
    ...overrides,
  };
}

function stripeRefund(
  overrides: Partial<Stripe.Refund> = {},
): Stripe.Refund {
  return {
    id: 're_1',
    metadata: {},
    status: 'succeeded',
    ...overrides,
  } as unknown as Stripe.Refund;
}

describe('refundOrderPayment', () => {
  it('reuses an existing tagged Stripe refund instead of creating another', async () => {
    const existing = stripeRefund({
      metadata: { orderId: 'order_1', recovery: 'exception_case' },
    });
    const create = vi.fn(async (_params: unknown, _options?: unknown) => stripeRefund());
    const stripeClient = {
      refunds: {
        list: vi.fn(async () => ({ data: [existing] })),
        create,
        retrieve: vi.fn(),
      },
    } as unknown as Stripe;

    await expect(refundOrderPayment(order(), 'refund/case_1', null, { stripeClient }))
      .resolves.toEqual({
        state: 'confirmed',
        provider: 'stripe',
        providerActionId: 're_1',
      });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates one Stripe refund with a stable provider idempotency key when none exists', async () => {
    const create = vi.fn(async (_params: unknown, _options?: unknown) => stripeRefund());
    const stripeClient = {
      refunds: {
        list: vi.fn(async () => ({ data: [] })),
        create,
        retrieve: vi.fn(),
      },
    } as unknown as Stripe;

    await refundOrderPayment(order(), 'refund/case_1', null, { stripeClient });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'refund/case_1' });
  });

  const paymeOrder = () => order({ paymentProvider: 'payme', stripePaymentId: null, paymeTransactionId: 'sale_1' });

  it('queries PayMe before refund and never issues a second refund once refunded', async () => {
    const refundSale = vi.fn();
    const f = fakeFence();
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'refunded' as const, rawStatus: 'refunded' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result.state).toBe('confirmed');
    expect(refundSale).not.toHaveBeenCalled();
  });

  it('fails closed when PayMe sale state cannot prove it is refundable', async () => {
    const refundSale = vi.fn();
    await expect(refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'unknown' as const, rawStatus: null })),
      refundPaymeSale: refundSale,
      refundFence: fakeFence().fence,
    })).rejects.toThrow('not safely refundable');
    expect(refundSale).not.toHaveBeenCalled();
  });

  it('#6-FIX-3: PayMe fails closed without a fence (the fence is the effect-once guarantee)', async () => {
    await expect(refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'paid' })),
      refundPaymeSale: vi.fn(),
    })).rejects.toThrow('payme_refund_fence_required');
  });

  it('#6-FIX-3: persists the fence BEFORE the call and issues exactly one refund-sale (happy path)', async () => {
    const refundSale = vi.fn(async () => ({ state: 'refunded' as const, providerActionId: 'pa_1' }));
    const f = fakeFence();
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'paid' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result).toMatchObject({ state: 'confirmed', provider: 'payme', providerActionId: 'pa_1' });
    expect(f.begin).toHaveBeenCalledTimes(1); // fence created ('requested') before the call
    expect(f.dispatch).toHaveBeenCalledTimes(1); // (#6 FIX-5) flipped 'requested'→'dispatched' BEFORE refund-sale
    expect(refundSale).toHaveBeenCalledTimes(1); // exactly once
    expect(f.records.get('refund/case_1')).toEqual({ status: 'confirmed', providerActionId: 'pa_1' });
  });

  it('#6-FIX-3: a prior CONFIRMED fence record → returns confirmed, NEVER calls refund-sale again', async () => {
    const refundSale = vi.fn();
    const querySale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'confirmed', providerActionId: 'pa_prev' } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: querySale,
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result).toMatchObject({ state: 'confirmed', providerActionId: 'pa_prev' });
    expect(refundSale).not.toHaveBeenCalled();
    expect(querySale).not.toHaveBeenCalled(); // a confirmed record needs no re-query
  });

  it('#6-FIX-3: a REQUESTED fence (response lost) whose sale is now refunded → confirm without re-issuing', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'requested', providerActionId: null } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'refunded' as const, rawStatus: 'refunded' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result.state).toBe('confirmed');
    expect(refundSale).not.toHaveBeenCalled(); // never re-issue on a prior attempt
    expect(f.records.get('refund/case_1')?.status).toBe('confirmed');
  });

  it('#6 FIX-4a: a REQUESTED fence whose sale is still PAID → RE-ATTEMPTS refund-sale (closes the at-most-once miss)', async () => {
    // Crash between the fence write and refund-sale: the prior attempt never executed (query proves un-refunded),
    // so we MUST re-attempt — otherwise the refund is permanently missed.
    const refundSale = vi.fn(async () => ({ state: 'refunded' as const, providerActionId: 'pa_retry' }));
    const f = fakeFence({ 'refund/case_1': { status: 'requested', providerActionId: null } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'paid' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(refundSale).toHaveBeenCalledTimes(1);
    expect(result.state).toBe('confirmed');
    expect(f.records.get('refund/case_1')).toEqual({ status: 'confirmed', providerActionId: 'pa_retry' });
  });

  it('#6 FIX-4a: a PENDING fence ALWAYS re-queries — refunded → confirmed (never terminal-stuck on pending)', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'pending', providerActionId: 'pa_p' } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'refunded' as const, rawStatus: 'refunded' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result.state).toBe('confirmed');
    expect(refundSale).not.toHaveBeenCalled();
    expect(f.records.get('refund/case_1')?.status).toBe('confirmed');
  });

  it('#6 FIX-4a: a PENDING fence whose refund is still in-flight stays pending — reconcilable, re-queried next tick', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'pending', providerActionId: 'pa_p' } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'unknown' as const, rawStatus: 'processing' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result.state).toBe('pending'); // not terminal-stuck — never double-refunds either
    expect(refundSale).not.toHaveBeenCalled();
  });

  it('#6 FIX-5: a PENDING fence whose sale STILL READS PAID (get-sales lag) → stays pending, NEVER re-issues (the eventual-consistency double-refund window)', async () => {
    // A 'pending' fence means PayMe already ACCEPTED a refund (settling async). A lagging get-sales read of 'paid'
    // must NOT trigger a second refund-sale — this is exactly the double-refund the re-verify proved.
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'pending', providerActionId: 'pa_p' } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'approved' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(refundSale).not.toHaveBeenCalled(); // the whole point of FIX-5
    expect(result.state).toBe('pending');
  });

  it('#6 FIX-5: a DISPATCHED fence (refund-sale was sent, response lost) whose sale reads paid → stays pending, NEVER re-issues (lease-race / restart safe)', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'dispatched', providerActionId: null } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'approved' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(refundSale).not.toHaveBeenCalled();
    expect(result.state).toBe('pending');
  });

  it('#6 FIX-5: a DISPATCHED fence whose sale is now refunded → confirm (the lost response is reconciled)', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'dispatched', providerActionId: 'pa_d' } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'refunded' as const, rawStatus: 'refunded' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(refundSale).not.toHaveBeenCalled();
    expect(result.state).toBe('confirmed');
    expect(f.records.get('refund/case_1')?.status).toBe('confirmed');
  });

  it('#6 FIX-5: a fresh PARTIAL_REFUND sale (a refund already exists) → stays pending, never blind-issues a second FULL refund', async () => {
    const refundSale = vi.fn();
    const f = fakeFence();
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'partial_refund' as const, rawStatus: 'partial-refund' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(refundSale).not.toHaveBeenCalled();
    expect(result.state).toBe('pending');
    expect(f.begin).not.toHaveBeenCalled(); // no fence created — nothing dispatched
  });
});
