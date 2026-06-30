import 'server-only';

import Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';
import { queryPaymeSale, refundPaymeSale, PaymeRefundError } from '@/lib/payme';
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

// (#6-FIX-3 / FIX-5) Durable exactly-once fence for provider refunds, keyed on the stable refundKey. The status is
// the pre-dispatch / post-dispatch discriminator that makes exactly-once NOT depend on get-sales consistency:
//   - 'requested'  — fence created, the provider refund-sale was NEVER sent (a crash here is the ONLY re-attemptable
//                    state: no refund can be in flight).
//   - 'dispatched' — refund-sale WAS sent (we are mid-call or the response was lost). NEVER re-issue — a refund may
//                    be in flight; only confirm-on-refunded, else stay reconcilable.
//   - 'pending'    — refund-sale returned an accepted-but-unsettled result. NEVER re-issue (same as dispatched).
//   - 'confirmed'  — terminal success.
export type RefundFenceStatus = 'requested' | 'dispatched' | 'pending' | 'confirmed';
export interface RefundFenceRecord {
  status: RefundFenceStatus;
  providerActionId: string | null;
}
export interface RefundFence {
  lookup(refundKey: string): Promise<RefundFenceRecord | null>;
  /** Atomic create-if-absent ('requested'). heldFresh=true → no prior attempt. */
  begin(args: { refundKey: string; provider: string; providerSaleId: string }): Promise<{ heldFresh: boolean; record: RefundFenceRecord | null }>;
  /** Atomic 'requested' → 'dispatched'. Returns true ONLY for the single winner; the loser must NOT call refund-sale. */
  dispatch(refundKey: string): Promise<boolean>;
  /** (#6 FIX-6) Atomic 'dispatched' → 'requested' — roll back ONLY when the refund-sale DEFINITIVELY did not apply,
   * so a future tick may safely re-attempt. Never called for an ambiguous (maybe-in-flight) failure. */
  undispatch(refundKey: string): Promise<void>;
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
    async dispatch(refundKey) {
      // Single-flight: only the worker that flips 'requested'→'dispatched' may call refund-sale. A concurrent
      // reclaimer (e.g. after a lease expiry) sees 'dispatched' and never issues a second physical refund.
      const moved = await prisma.refundAttempt.updateMany({ where: { refundKey, status: 'requested' }, data: { status: 'dispatched' } });
      return moved.count === 1;
    },
    async undispatch(refundKey) {
      // Only rolls a still-'dispatched' row back to 'requested' (a settled pending/confirmed row is untouched).
      await prisma.refundAttempt.updateMany({ where: { refundKey, status: 'dispatched' }, data: { status: 'requested' } });
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

    const confirmed = (actionId: string | null): RefundResult => ({ state: 'confirmed', provider, providerActionId: actionId ?? saleId });
    const pending = (actionId: string | null): RefundResult => ({ state: 'pending', provider, providerActionId: actionId ?? saleId });

    // (#6 FIX-5) A fence already DISPATCHED (or 'pending') means a refund-sale WAS sent for this key → NEVER
    // re-issue (re-issuing on a lagging 'paid' read is the double-refund window the re-verify found). Re-query:
    // refunded → confirm; anything else (in-flight, a lagging 'paid', or a genuinely-failed dispatch) → stay
    // 'pending', RECONCILABLE — re-queried next tick. The exactly-once guarantee does NOT depend on get-sales
    // consistency. Residual: a dispatched refund-sale that genuinely never reached PayMe stays pending for
    // operator/#7 reconciliation (we choose never-double over auto-closing a possibly-in-flight refund).
    const reconcileDispatched = async (prev: string | null): Promise<RefundResult> => {
      const cur = await querySale(saleId);
      if (cur.state === 'refunded') {
        await fence.settle({ refundKey, status: 'confirmed', providerActionId: prev ?? saleId });
        return confirmed(prev);
      }
      return pending(prev);
    };

    // Single-flight: flip the durable fence 'requested'→'dispatched' BEFORE the call; only the winner calls
    // refund-sale (exactly once). A concurrent/restarted worker that finds 'dispatched' reconciles instead.
    const dispatchAndIssue = async (prev: string | null): Promise<RefundResult> => {
      if (!(await fence.dispatch(refundKey))) return reconcileDispatched(prev);
      let requested: { state: 'refunded' | 'pending'; providerActionId: string | null };
      try {
        requested = await refundSale(saleId);
      } catch (e) {
        // (#6 FIX-6) A DEFINITIVE rejection (PayMe refused the request — refund provably NOT applied) must NOT
        // leave the fence 'dispatched' (which means "maybe in flight, never re-issue"). Roll it back to 'requested'
        // so a future tick re-attempts (restoring FIX-4a recovery for a transient/definitive rejection) — safe,
        // because the refund definitively did not move money. An AMBIGUOUS failure (5xx / network — maybe in
        // flight) stays 'dispatched' and is never re-issued, preserving the never-double-refund guarantee.
        if (e instanceof PaymeRefundError && e.definitive) {
          await fence.undispatch(refundKey);
        }
        throw e;
      }
      const status: 'pending' | 'confirmed' = requested.state === 'refunded' ? 'confirmed' : 'pending';
      const actionId = requested.providerActionId ?? prev ?? saleId;
      await fence.settle({ refundKey, status, providerActionId: actionId });
      return { state: status, provider, providerActionId: actionId };
    };

    // A fence still 'requested' = the refund-sale was provably NEVER sent (crash between begin and dispatch). This
    // is the ONLY re-attemptable state. Re-query: refunded (out-of-band) → confirm; fully paid → safe single
    // dispatch+issue; partial_refund / in-flight → do NOT blind-issue a full refund → stay pending (surface).
    const reconcileRequested = async (prev: string | null): Promise<RefundResult> => {
      const cur = await querySale(saleId);
      if (cur.state === 'refunded') {
        await fence.settle({ refundKey, status: 'confirmed', providerActionId: prev ?? saleId });
        return confirmed(prev);
      }
      if (cur.state === 'paid') return dispatchAndIssue(prev);
      return pending(prev);
    };

    const prior = await fence.lookup(refundKey);
    if (prior) {
      if (prior.status === 'confirmed') return confirmed(prior.providerActionId);
      if (prior.status === 'requested') return reconcileRequested(prior.providerActionId);
      return reconcileDispatched(prior.providerActionId); // 'dispatched' | 'pending' → never re-issue
    }

    // No prior. Already-refunded short-circuit; a full-refund intent proceeds ONLY on a fully-PAID sale. A
    // partially-refunded sale already has a refund against it → never blind a second FULL refund → surface pending.
    const before = await querySale(saleId);
    if (before.state === 'refunded') return confirmed(previousProviderActionId ?? null);
    if (before.state === 'partial_refund') return pending(previousProviderActionId ?? null);
    if (before.state !== 'paid') throw new Error(`PayMe sale is not safely refundable:${before.state}`);

    // Persist the fence ('requested') BEFORE the call. A concurrent attempt won the create → reconcile by its
    // status (dispatch() still single-flights the one physical refund-sale).
    const begun = await fence.begin({ refundKey, provider, providerSaleId: saleId });
    if (!begun.heldFresh) {
      if (begun.record?.status === 'confirmed') return confirmed(begun.record.providerActionId);
      if (begun.record?.status === 'requested') return reconcileRequested(begun.record?.providerActionId ?? null);
      return reconcileDispatched(begun.record?.providerActionId ?? null);
    }
    return dispatchAndIssue(previousProviderActionId ?? null);
  }

  if (provider === 'fake' && !isVercelProductionRuntime()) {
    return { state: 'confirmed', provider, providerActionId: `fake-refund/${order.id}` };
  }

  throw new Error(`Unsupported payment provider for refund:${provider || 'missing'}`);
}
