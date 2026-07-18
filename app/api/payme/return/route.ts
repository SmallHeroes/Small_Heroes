import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { triggerGeneration } from '../../generate/route';
import { verifyPaymePayment } from '@/lib/payme';
import { confirmCouponForOrder, couponConfirmFenceReason } from '@/lib/coupon/coupon-service';
import { recordHumanQaHoldInTx } from '@/lib/human-qa/record-hold';
import { humanReasonForHoldKind, loadHoldEvidence } from '@/lib/human-qa/hold-kind';

const logger = createLogger({ subsystem: 'payme-return', route: '/api/payme/return' });

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim() || '';
  const paymentIdFromQuery =
    req.nextUrl.searchParams.get('paymentId')?.trim() ||
    req.nextUrl.searchParams.get('transactionId')?.trim() ||
    '';
  const transactionIdFromQuery = req.nextUrl.searchParams.get('transactionId')?.trim() || '';
  const statusRaw = (req.nextUrl.searchParams.get('status') || req.nextUrl.searchParams.get('paymentStatus') || '').trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowUnsafeRedirectTrust = env.PAYME_REDIRECT_TRUST_MODE && !isProduction;

  if (!orderId || env.PAYMENT_PROVIDER !== 'payme') {
    return NextResponse.redirect(new URL(ROUTES.wizard, req.nextUrl.origin));
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, paymentProvider: true, paymentId: true, totalPrice: true },
    });
    if (!order || (order.paymentProvider && order.paymentProvider !== 'payme')) {
      const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(orderId)}`, req.nextUrl.origin);
      const accessKey = paymentIdFromQuery || transactionIdFromQuery;
      if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
      redirectUrl.searchParams.set('payment', 'checking');
      return NextResponse.redirect(redirectUrl);
    }

    if (order.status === 'paid' || order.status === 'generating' || order.status === 'ready' || order.status === 'partial' || order.status === 'needs_human_qa') {
      if (order.status === 'paid') {
        // AWAIT durable job-creation before the redirect; the local catch isolates a generation-start
        // failure so it never breaks the redirect (start errors must not surface as a payment failure).
        try {
          await triggerGeneration(order.id, 'payme_redirect_seen_paid_state');
        } catch (error) {
          logger.error('Generation trigger failed for paid order on redirect', error, { orderId: order.id });
        }
      }
      const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}`, req.nextUrl.origin);
      const accessKey = order.paymentId || paymentIdFromQuery || transactionIdFromQuery;
      if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
      return NextResponse.redirect(redirectUrl);
    }

    const hasIdentifiers = Boolean(paymentIdFromQuery || transactionIdFromQuery || order.paymentId);
    let verification: Awaited<ReturnType<typeof verifyPaymePayment>> = { verified: false, status: 'unknown', raw: null };
    if (hasIdentifiers) {
      verification = await verifyPaymePayment({
        orderId: order.id,
        paymentId: paymentIdFromQuery || order.paymentId || undefined,
        transactionId: transactionIdFromQuery || undefined,
      });
      logger.info('PayMe redirect verification attempted', {
        orderId: order.id,
        verified: verification.verified,
        status: verification.status,
      });
    }

    const allowUnsafePaidMark =
      allowUnsafeRedirectTrust &&
      !verification.verified &&
      ['paid', 'success', 'succeeded', 'completed', 'approved'].includes(statusRaw);

    if (verification.verified && verification.status === 'paid') {
      const resolvedPaymentId = transactionIdFromQuery || paymentIdFromQuery || order.paymentId || `payme_verified_${order.id}`;
      const claimed = await prisma.$transaction(async (tx) => {
        // Paid transition — CONDITIONAL so an overlapping success path (e.g. the webhook) that has
        // already advanced or FENCED (needs_human_qa) this order is NEVER demoted back to 'paid'.
        const paidTransition = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['draft', 'pending_payment', 'failed'] } },
          data: {
            status: 'paid',
            paymentProvider: 'payme',
            paymentId: resolvedPaymentId,
            paymeTransactionId: resolvedPaymentId,
            paymeMetadata: verification.raw as object,
            stripePaid: false,
          },
        });
        if (paidTransition.count === 0) return false; // another path already advanced/fenced this order
        await tx.paymentRecord.upsert({
          where: { orderId: order.id },
          update: {
            provider: 'payme',
            paid: true,
            paidAt: new Date(),
            amount: order.totalPrice,
            currency: 'ils',
            raw: verification.raw as object,
          },
          create: {
            orderId: order.id,
            provider: 'payme',
            amount: order.totalPrice,
            currency: 'ils',
            paid: true,
            paidAt: new Date(),
            raw: verification.raw as object,
          },
        });
        // Confirm any reserved coupon redemption in the same tx that marks the order paid.
        const couponOutcome = await confirmCouponForOrder(tx, order.id);
        // FAIL-CLOSED (LB#1b): fence when the discount was not granted (cap-safe paid-late) OR when a
        // COUPONED order confirmed to 'noop' — i.e. it was charged a discounted amount but occupies no
        // slot, which is precisely how "≤ N discounted PAID sales" breaks while confirmedCount looks fine.
        const couponFence = await couponConfirmFenceReason(tx, order.id, couponOutcome);
        if (couponFence) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: couponFence },
          });
          // (Human-QA Slice 1) ADDITIVE: payment_integrity review case in the SAME tx, ALONGSIDE the money writes.
          // Non-aborting ON CONFLICT DO NOTHING → can never roll back the paid transition / coupon confirm above.
          const ev = await loadHoldEvidence(tx, order.id);
          await recordHumanQaHoldInTx(tx, {
            orderId: order.id,
            scope: 'payment',
            kind: 'payment_integrity',
            rawReason: couponFence,
            humanReason: humanReasonForHoldKind('payment_integrity', couponFence),
            childName: ev.childName,
            inputVersion: ev.inputVersion,
            contractHash: ev.visualContractHash,
            sourceManifestId: null,
            artifactRefs: null,
          });
          logger.error('coupon confirm did not grant a slot for a paid order — held for refund/charge-full', {
            orderId: order.id,
            outcome: couponOutcome,
            reason: couponFence,
          });
        }
        return true;
      });
      // CONCURRENCY FENCE (coupon re-gate 3): ONLY the request that actually CLAIMED the paid
      // transition may trigger generation — `claimed` is false when an overlapping success path (the
      // webhook) already advanced or FENCED this order, and that path must never double-trigger.
      // Inside the fence, feat's durability is preserved: AWAIT job-creation before the redirect, with
      // a local catch so a start failure can never break the ack.
      if (claimed) {
        try {
          await triggerGeneration(order.id, 'payme_redirect_verified_paid');
        } catch (error) {
          logger.error('Generation trigger failed after verified redirect', error, { orderId: order.id });
        }
      }
    } else if (allowUnsafePaidMark) {
      logger.warn('UNSAFE redirect trust mode accepted paid state (dev only)', {
        orderId: order.id,
        paymentIdFromQuery,
        transactionIdFromQuery,
      });
      const fallbackPaymentId = transactionIdFromQuery || paymentIdFromQuery || order.paymentId || `payme_unsafe_${order.id}`;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paymentProvider: 'payme',
          paymentId: fallbackPaymentId,
          paymeTransactionId: fallbackPaymentId,
          paymeMetadata: {
            source: 'unsafe_redirect_trust_mode',
            query: Object.fromEntries(req.nextUrl.searchParams.entries()),
          },
          stripePaid: false,
        },
      });
      // AWAIT durable job-creation before the redirect; local catch isolates start errors from the ack.
      try {
        await triggerGeneration(order.id, 'payme_redirect_unverified_trust_mode');
      } catch (error) {
        logger.error('Generation trigger failed after unsafe redirect trust', error, { orderId: order.id });
      }
    }
  } catch (error) {
    logger.error('PayMe redirect processing failed', error, { orderId });
  }

  const redirectUrl = new URL(`${ROUTES.generating}?orderId=${encodeURIComponent(orderId)}`, req.nextUrl.origin);
  const accessKey = paymentIdFromQuery || transactionIdFromQuery;
  if (accessKey) redirectUrl.searchParams.set('accessKey', accessKey);
  redirectUrl.searchParams.set('payment', 'checking');
  return NextResponse.redirect(redirectUrl);
}

