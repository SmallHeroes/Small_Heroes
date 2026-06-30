import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { refundOrderPayment, type RefundableOrder } from '@/lib/payment-refunds';

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

  it('queries PayMe before refund and never issues a second refund once refunded', async () => {
    const refundSale = vi.fn();
    const result = await refundOrderPayment(
      order({
        paymentProvider: 'payme',
        stripePaymentId: null,
        paymeTransactionId: 'sale_1',
      }),
      'refund/case_1',
      null,
      {
        queryPaymeSale: vi.fn(async () => ({
          state: 'refunded' as const,
          rawStatus: 'refunded',
        })),
        refundPaymeSale: refundSale,
      },
    );

    expect(result.state).toBe('confirmed');
    expect(refundSale).not.toHaveBeenCalled();
  });

  it('fails closed when PayMe sale state cannot prove it is refundable', async () => {
    const refundSale = vi.fn();
    await expect(refundOrderPayment(
      order({
        paymentProvider: 'payme',
        stripePaymentId: null,
        paymeTransactionId: 'sale_1',
      }),
      'refund/case_1',
      null,
      {
        queryPaymeSale: vi.fn(async () => ({
          state: 'unknown' as const,
          rawStatus: null,
        })),
        refundPaymeSale: refundSale,
      },
    )).rejects.toThrow('not safely refundable');
    expect(refundSale).not.toHaveBeenCalled();
  });
});
