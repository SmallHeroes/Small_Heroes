import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { canUseFakePayments } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { triggerGeneration } from '../../../generate/route';
import {
  confirmCouponForOrder,
  couponConfirmFenceReason,
  releaseCouponForFailedPayment,
} from '@/lib/coupon/coupon-service';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';

const logger = createLogger({ subsystem: 'fake-payment', route: '/api/dev/fake-payment/confirm' });

export async function POST(req: NextRequest) {
  if (!canUseFakePayments()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-dev-fake-payment-confirm',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
  const result = body?.result === 'failed' ? 'failed' : body?.result === 'success' ? 'success' : null;
  if (!orderId || !paymentId || !result) {
    return NextResponse.json({ error: 'orderId, paymentId and result are required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentProvider: true, paymentId: true, totalPrice: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.paymentProvider !== 'fake') return NextResponse.json({ error: 'Order is not in fake payment mode' }, { status: 409 });
  if (order.paymentId !== paymentId) return NextResponse.json({ error: 'Payment id mismatch' }, { status: 409 });

  if (result === 'failed') {
    if (!['draft', 'pending_payment', 'failed'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be failed at this stage' }, { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      await tx.paymentRecord.upsert({
        where: { orderId: order.id },
        update: {
          provider: 'fake',
          paid: false,
          paidAt: null,
          amount: order.totalPrice,
          currency: 'ils',
          raw: { mode: 'fake', result: 'failed', paymentId },
        },
        create: {
          orderId: order.id,
          provider: 'fake',
          amount: order.totalPrice,
          currency: 'ils',
          paid: false,
          raw: { mode: 'fake', result: 'failed', paymentId },
        },
      });
      // Explicit PAYMENT failure → free this order's reserved slot now (don't wait out the TTL). Order-scoped
      // by design: the payment failed for the ORDER, so whichever attempt's hold is live must go. This is not
      // the checkout-attempt release (that one is token-bound so a failed attempt can't free a sibling's hold).
      await releaseCouponForFailedPayment(tx, order.id);
    });
    return NextResponse.json({
      ok: true,
      result: 'failed',
      redirectUrl: `${ROUTES.wizard}?orderId=${encodeURIComponent(order.id)}&payment=failed`,
    });
  }

  const shouldTriggerGeneration = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: order.id },
      select: { id: true, status: true, totalPrice: true },
    });
    if (!fresh) return false;
    if (['generating', 'ready', 'partial', 'needs_human_qa'].includes(fresh.status)) return false;

    // Paid transition — CONDITIONAL so an overlapping success path that has already advanced or
    // FENCED (needs_human_qa) this order is NEVER demoted back to 'paid'.
    const paidTransition = await tx.order.updateMany({
      where: { id: fresh.id, status: { in: ['draft', 'pending_payment', 'failed'] } },
      data: {
        status: 'paid',
        paymentProvider: 'fake',
        paymentId,
        stripePaid: false,
      },
    });
    if (paidTransition.count === 0) return false; // another path already advanced/fenced this order
    await tx.paymentRecord.upsert({
      where: { orderId: fresh.id },
      update: {
        provider: 'fake',
        paid: true,
        paidAt: new Date(),
        amount: fresh.totalPrice,
        currency: 'ils',
        raw: { mode: 'fake', result: 'success', paymentId },
      },
      create: {
        orderId: fresh.id,
        provider: 'fake',
        amount: fresh.totalPrice,
        currency: 'ils',
        paid: true,
        paidAt: new Date(),
        raw: { mode: 'fake', result: 'success', paymentId },
      },
    });
    const couponOutcome = await confirmCouponForOrder(tx, fresh.id);
    // FAIL-CLOSED (LB#1b): fence when the discount was not granted (cap-safe paid-late) OR when a COUPONED
    // order confirmed to 'noop' — charged a discounted amount yet occupying no slot, which is exactly how
    // "≤ N discounted PAID sales" breaks while confirmedCount still reads ≤ max.
    const couponFence = await couponConfirmFenceReason(tx, fresh.id, couponOutcome);
    if (couponFence) {
      await tx.order.update({
        where: { id: fresh.id },
        data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: couponFence },
      });
      // (Human-QA Slice 1, re-gate P0-1) The payment_integrity case is written POST-COMMIT, not here — a
      // case-write rejection must never roll back this money transaction.
      logger.error('coupon confirm did not grant a slot for a paid order — held for refund/charge-full', {
        orderId: fresh.id,
        outcome: couponOutcome,
        reason: couponFence,
      });
    }
    return true; // the conditional above claimed the paid transition exactly once
  });

  // (Human-QA Slice 1, re-gate P0-1) POST-COMMIT: open the payment_integrity review case in its own tx,
  // best-effort — never affects the committed money tx; the reconciler repairs a missed write. No-op unless fenced.
  await syncHumanQaHoldCasePostCommit(prisma, order.id);

  if (shouldTriggerGeneration) {
    // AWAIT durable job-creation + after() dispatch before returning; local catch isolates a
    // generation-start failure from the payment ack (parity with the prod payment routes).
    try {
      await triggerGeneration(order.id, 'fake_payment_confirm_success');
    } catch (error) {
      logger.error('Fake payment generation trigger failed', error, { orderId: order.id, paymentId });
    }
  }

  return NextResponse.json({
    ok: true,
    result: 'success',
    redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}&accessKey=${encodeURIComponent(paymentId)}`,
  });
}

