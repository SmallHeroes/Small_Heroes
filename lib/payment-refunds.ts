import 'server-only';

import Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';
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

// (#6-FIX-3) Durable exactly-once fence for provider refunds. A record is created (status 'requested') BEFORE the
// provider refund call, keyed on the stable refundKey, so a response-loss + restart never issues a second refund.
export type RefundFenceStatus = 'requested' | 'pending' | 'confirmed';
export interface RefundFenceRecord {
  status: RefundFenceStatus;
  providerActionId: string | null;
}
export interface RefundFence {
  lookup(refundKey: string): Promise<RefundFenceRecord | null>;
  /** Atomic create-if-absent. heldFresh=true → no prior attempt → safe to call the provider refund exactly once. */
  begin(args: { refundKey: string; provider: string; providerSaleId: string }): Promise<{ heldFresh: boolean; record: RefundFenceRecord | null }>;
  settle(args: { refundKey: string; status: 'pending' | 'confirmed'; providerActionId: string | null }): Promise<void>;
}

/** Prisma-backed RefundFence (production). */
export function prismaRefundFence(prisma: PrismaClient): RefundFence {
  const toRecord = (r: { status: string; providerActionId: string | null } | null): RefundFenceRecord | null =>
    r ? { status: r.status as RefundFenceStatus, providerActionId: r.providerActionId } : null;
  return {
    async lookup(refundKey) {
      return toRecord(await prisma.refundAttempt.findUnique({ where: { refundKey }, select: { status: true, providerActionId: true } }));
    },
    async begin({ refundKey, provider, providerSaleId }) {
      try {
        await prisma.refundAttempt.create({ data: { refundKey, provider, providerSaleId, status: 'requested' } });
        return { heldFresh: true, record: null };
      } catch (e) {
        // Unique violation → a concurrent attempt created it first. Never double-issue: report the prior record.
        if ((e as { code?: string }).code === 'P2002') {
          return { heldFresh: false, record: toRecord(await prisma.refundAttempt.findUnique({ where: { refundKey }, select: { status: true, providerActionId: true } })) };
        }
        throw e;
      }
    },
    async settle({ refundKey, status, providerActionId }) {
      await prisma.refundAttempt.update({ where: { refundKey }, data: { status, providerActionId } });
    },
  };
}

export interface RefundProviderDeps {
  stripeClient?: Stripe;
  queryPaymeSale?: typeof queryPaymeSale;
  refundPaymeSale?: typeof refundPaymeSale;
  /** Required for the PayMe path — the durable exactly-once fence (#6-FIX-3). */
  refundFence?: RefundFence;
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
    const fence = overrides.refundFence;
    // (#6-FIX-3) The fence is the effect-once guarantee — required for PayMe. Fail closed without it rather than
    // fall back to the reservation-marker-only path (which a response-loss + restart could double-call).
    if (!fence) throw new Error('payme_refund_fence_required');
    const saleId = (order.paymeTransactionId || order.paymentId || '').trim();
    if (!saleId) throw new Error('PayMe sale id missing for refund');

    // We hold the fence → call refund-sale, settle the durable record from its result, return.
    const issue = async (prevActionId: string | null): Promise<RefundResult> => {
      const requested = await refundSale(saleId);
      const status: 'pending' | 'confirmed' = requested.state === 'refunded' ? 'confirmed' : 'pending';
      const actionId = requested.providerActionId ?? prevActionId ?? saleId;
      await fence.settle({ refundKey, status, providerActionId: actionId });
      return { state: status, provider, providerActionId: actionId };
    };

    // (#6 FIX-4a) Reconcile a prior attempt (record 'requested' or 'pending') in BOTH directions — ALWAYS re-query
    // the sale first, never just trust the stored status:
    //   - refunded                  → settle 'confirmed' (idempotent success).
    //   - paid / partial_refund     → the prior attempt did NOT execute → RE-ATTEMPT refund-sale. Closes the
    //                                 at-most-once gap (a crash between fence-write and refund-sale would otherwise
    //                                 miss the refund forever). Safe: the query proves the sale is un-refunded and
    //                                 PayMe serializes the balance, so this never double-refunds.
    //   - in-flight / ambiguous     → stay 'pending' but RECONCILABLE — re-queried every tick, never terminal-stuck.
    const reconcile = async (prevActionId: string | null): Promise<RefundResult> => {
      const cur = await querySale(saleId);
      if (cur.state === 'refunded') {
        await fence.settle({ refundKey, status: 'confirmed', providerActionId: prevActionId ?? saleId });
        return { state: 'confirmed', provider, providerActionId: prevActionId ?? saleId };
      }
      if (cur.state === 'paid' || cur.state === 'partial_refund') {
        return issue(prevActionId);
      }
      return { state: 'pending', provider, providerActionId: prevActionId ?? saleId };
    };

    // A prior fence record means refund-sale was ALREADY persisted for this refundKey → never blindly re-call.
    // 'confirmed' is terminal; 'requested'/'pending' both reconcile (re-query → confirm / re-attempt / stay pending).
    const prior = await fence.lookup(refundKey);
    if (prior) {
      if (prior.status === 'confirmed') return { state: 'confirmed', provider, providerActionId: prior.providerActionId ?? saleId };
      return reconcile(prior.providerActionId);
    }

    // No prior attempt. Already-refunded short-circuit needs no fence (nothing to issue).
    const before = await querySale(saleId);
    if (before.state === 'refunded') {
      return { state: 'confirmed', provider, providerActionId: previousProviderActionId ?? saleId };
    }
    if (before.state !== 'paid' && before.state !== 'partial_refund') {
      throw new Error(`PayMe sale is not safely refundable:${before.state}`);
    }

    // Persist the fence (status 'requested') BEFORE the call. If a concurrent attempt won the create, reconcile
    // (re-query → confirm / re-attempt / pending) instead of double-issuing.
    const begun = await fence.begin({ refundKey, provider, providerSaleId: saleId });
    if (!begun.heldFresh) return reconcile(begun.record?.providerActionId ?? null);

    return issue(previousProviderActionId ?? null);
  }

  if (provider === 'fake' && !isVercelProductionRuntime()) {
    return { state: 'confirmed', provider, providerActionId: `fake-refund/${order.id}` };
  }

  throw new Error(`Unsupported payment provider for refund:${provider || 'missing'}`);
}
