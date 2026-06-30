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
  const settle = vi.fn(async ({ refundKey, status, providerActionId }: { refundKey: string; status: 'pending' | 'confirmed'; providerActionId: string | null }) => {
    records.set(refundKey, { status, providerActionId });
  });
  const fence: RefundFence = { lookup, begin, settle };
  return { fence, records, lookup, begin, settle };
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
    expect(f.begin).toHaveBeenCalledTimes(1); // fence created before the call
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

  it('#6-FIX-3: a REQUESTED fence whose sale is still paid → stays pending, never re-issues (residual window)', async () => {
    const refundSale = vi.fn();
    const f = fakeFence({ 'refund/case_1': { status: 'requested', providerActionId: null } });
    const result = await refundOrderPayment(paymeOrder(), 'refund/case_1', null, {
      queryPaymeSale: vi.fn(async () => ({ state: 'paid' as const, rawStatus: 'paid' })),
      refundPaymeSale: refundSale,
      refundFence: f.fence,
    });
    expect(result.state).toBe('pending');
    expect(refundSale).not.toHaveBeenCalled();
  });
});
