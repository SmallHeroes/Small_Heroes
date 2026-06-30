import 'server-only';

import Stripe from 'stripe';
import { queryPaymeSale, refundPaymeSale } from '@/lib/payme';
import { isVercelProductionRuntime } from '@/lib/runtime-env';

export type RefundResult =
  | { state: 'confirmed'; provider: string; providerActionId: string | null }
  | { state: 'pending'; provider: string; providerActionId: string | null };

export interface RefundableOrder {
  id: string;
  paymentProvider: string | null;
  paymentId: string | null;
  paymeTransactionId: string | null;
  stripePaymentId: string | null;
  payment: { provider: string } | null;
}

export interface RefundProviderDeps {
  stripeClient?: Stripe;
  queryPaymeSale?: typeof queryPaymeSale;
  refundPaymeSale?: typeof refundPaymeSale;
}

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('Stripe refund configuration is missing');
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
  }
  return stripeClient;
}

export async function refundOrderPayment(
  order: RefundableOrder,
  refundKey: string,
  previousProviderActionId?: string | null,
  overrides: RefundProviderDeps = {},
): Promise<RefundResult> {
  const provider = (order.paymentProvider || order.payment?.provider || '').trim().toLowerCase();

  if (provider === 'stripe') {
    const stripeApi = overrides.stripeClient ?? stripe();
    let refund: Stripe.Refund;
    if (previousProviderActionId) {
      refund = await stripeApi.refunds.retrieve(previousProviderActionId);
    } else {
      if (!order.stripePaymentId) throw new Error('Stripe PaymentIntent missing for refund');
      // Stripe idempotency records are not a permanent ledger. Query first so a DB-write loss followed
      // by a retry after the provider window discovers the prior recovery refund instead of creating one.
      const existing = await stripeApi.refunds.list({
        payment_intent: order.stripePaymentId,
        limit: 100,
      });
      refund = existing.data.find((candidate) =>
        candidate.metadata?.orderId === order.id &&
        candidate.metadata?.recovery === 'exception_case',
      ) ?? await stripeApi.refunds.create(
        {
          payment_intent: order.stripePaymentId,
          metadata: { orderId: order.id, recovery: 'exception_case' },
        },
        { idempotencyKey: refundKey },
      );
    }
    if (refund.status === 'succeeded') {
      return { state: 'confirmed', provider, providerActionId: refund.id };
    }
    if (refund.status === 'pending' || refund.status === 'requires_action') {
      return { state: 'pending', provider, providerActionId: refund.id };
    }
    throw new Error(`Stripe refund terminal failure:${refund.status ?? 'unknown'}`);
  }

  if (provider === 'payme') {
    const querySale = overrides.queryPaymeSale ?? queryPaymeSale;
    const refundSale = overrides.refundPaymeSale ?? refundPaymeSale;
    const saleId = (order.paymeTransactionId || order.paymentId || '').trim();
    if (!saleId) throw new Error('PayMe sale id missing for refund');
    // Query-before-call makes a response-lost retry observe an already completed full refund instead of
    // issuing another provider action. PayMe itself prevents refunding beyond the remaining sale balance.
    const before = await querySale(saleId);
    if (before.state === 'refunded') {
      return {
        state: 'confirmed',
        provider,
        providerActionId: previousProviderActionId ?? saleId,
      };
    }
    if (before.state !== 'paid' && before.state !== 'partial_refund') {
      throw new Error(`PayMe sale is not safely refundable:${before.state}`);
    }
    const requested = await refundSale(saleId);
    if (requested.state === 'refunded') {
      return {
        state: 'confirmed',
        provider,
        providerActionId: requested.providerActionId ?? saleId,
      };
    }
    return {
      state: 'pending',
      provider,
      providerActionId: requested.providerActionId ?? previousProviderActionId ?? saleId,
    };
  }

  if (provider === 'fake' && !isVercelProductionRuntime()) {
    return { state: 'confirmed', provider, providerActionId: `fake-refund/${order.id}` };
  }

  throw new Error(`Unsupported payment provider for refund:${provider || 'missing'}`);
}
