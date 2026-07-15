import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { triggerGeneration } from '../../generate/route';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import {
  extractWebhookClientIp,
  isPaymeStatusPaid,
  parsePaymeWebhookPayload,
  resolvePaymeConfig,
  verifyPaymeSignature,
} from '@/lib/payme';
import { env } from '@/lib/env';
import { confirmCouponForOrder, couponConfirmFenceReason } from '@/lib/coupon/coupon-service';

const logger = createLogger({ subsystem: 'payme-webhook', route: '/api/webhooks/payme' });

export async function POST(req: NextRequest) {
  if (env.PAYMENT_PROVIDER !== 'payme') {
    logger.error('[PayMeWebhook] Rejected: PAYMENT_PROVIDER is not payme');
    return NextResponse.json({ error: 'Payment provider misconfigured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-payme-signature') || req.headers.get('payme-signature');
  const clientIp = extractWebhookClientIp(req.headers);
  const cfg = resolvePaymeConfig();

  logger.info('[PayMeWebhook] Received', {
    clientIp: clientIp ?? 'unknown',
    hasSignature: Boolean(signature),
  });

  let parsedBody: Record<string, unknown>;
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawBody);
    parsedBody = Object.fromEntries(params.entries());
  } else {
    try {
      parsedBody = JSON.parse(rawBody || '{}') as Record<string, unknown>;
      if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
        parsedBody = {};
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn('[PayMeWebhook] Invalid body', { reason, contentType });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
  }

  const parsed = parsePaymeWebhookPayload(parsedBody);

  if (!parsed.orderId || !parsed.transactionId || !parsed.paymentStatus) {
    logger.warn('[PayMeWebhook] Invalid payload shape', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
      paymentStatus: parsed.paymentStatus,
    });
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  const hasVerifiedSignature = cfg.webhookSecret
    ? verifyPaymeSignature(rawBody, signature, cfg.webhookSecret)
    : false;
  const isProduction = process.env.NODE_ENV === 'production';
  const allowIpFallback = process.env.PAYME_WEBHOOK_ALLOW_IP_FALLBACK === 'true';
  const isAllowedIp = cfg.allowedWebhookIps.length === 0
    ? true
    : (clientIp ? cfg.allowedWebhookIps.includes(clientIp) : false);

  if (cfg.webhookSecret) {
    // Signature is primary verification path.
    if (!hasVerifiedSignature) {
      const canUseIpFallback = isAllowedIp && (!isProduction || allowIpFallback);
      if (!canUseIpFallback) {
        logger.warn('[PayMeWebhook] Rejected: signature verification failed', {
          transactionId: parsed.transactionId,
          clientIp: clientIp ?? 'unknown',
          ipFallbackAllowed: canUseIpFallback,
          environment: process.env.NODE_ENV || 'development',
        });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
      }
      logger.warn('[PayMeWebhook] Signature failed; accepted via IP fallback', {
        transactionId: parsed.transactionId,
        clientIp: clientIp ?? 'unknown',
        environment: process.env.NODE_ENV || 'development',
      });
    }
  } else {
    // No secret configured: only allow trusted IP path.
    if (!isAllowedIp) {
      logger.warn('[PayMeWebhook] Rejected by IP allowlist (no signature secret configured)', {
        transactionId: parsed.transactionId,
        clientIp: clientIp ?? 'unknown',
      });
      return NextResponse.json({ error: 'Webhook origin not allowed' }, { status: 403 });
    }
    logger.warn('[PayMeWebhook] Accepted via IP allowlist only (no webhook secret configured)', {
      transactionId: parsed.transactionId,
      clientIp: clientIp ?? 'unknown',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  if (!isPaymeStatusPaid(parsed.paymentStatus)) {
    logger.info('[PayMeWebhook] Payment not successful; ignoring', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
      paymentStatus: parsed.paymentStatus,
    });
    return NextResponse.json({ received: true, ignored: true, reason: 'payment_not_successful' });
  }

  logger.info('[PayMeWebhook] Payment verified', {
    orderId: parsed.orderId,
    transactionId: parsed.transactionId,
    paymentStatus: parsed.paymentStatus,
    verifiedBy: hasVerifiedSignature ? 'signature' : 'ip_allowlist',
    usedFallbackFields: parsed.usedFallbackFields,
  });
  if (parsed.usedFallbackFields) {
    logger.warn('[PayMeWebhook] Payload accepted via compatibility fallback fields', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
    });
  }

  try {
    const shouldTriggerGeneration = await prisma.$transaction(async (tx) => {
      await tx.paymeWebhookEvent.create({
        data: {
          paymeTransactionId: parsed.transactionId as string,
          eventType: parsed.eventType,
          orderId: parsed.orderId,
        },
      });

      const order = await tx.order.findUnique({
        where: { id: parsed.orderId as string },
        select: {
          id: true,
          status: true,
          paymeTransactionId: true,
          paymentId: true,
          totalPrice: true,
        },
      });
      if (!order) {
        logger.error('[PayMeWebhook] Order missing for paid event', {
          orderId: parsed.orderId,
          transactionId: parsed.transactionId,
        });
        return false;
      }

      if (order.status === 'generating' || order.status === 'ready' || order.status === 'partial' || order.status === 'needs_human_qa') {
        return false;
      }

      // Paid transition — CONDITIONAL so an overlapping payment-success path (e.g. the redirect
      // return) that has already advanced or FENCED (needs_human_qa) this order is NEVER demoted
      // back to 'paid'. The WHERE is re-checked atomically at write time (Postgres READ COMMITTED
      // re-evaluates it after a concurrent commit), so only a pre-paid order transitions.
      const paidTransition = await tx.order.updateMany({
        where: { id: order.id, status: { in: ['draft', 'pending_payment', 'failed'] } },
        data: {
          status: 'paid',
          paymentProvider: 'payme',
          paymentId: parsed.transactionId,
          paymeTransactionId: parsed.transactionId,
          paymeMetadata: parsed.raw as object,
          stripePaid: false,
        },
      });
      if (paidTransition.count === 0) {
        // Another success path already advanced/fenced this order → do NOT re-process or demote it.
        // Recovery: if it is merely 'paid' (not fenced/generating/ready/partial), STILL (re)trigger
        // generation. The durable, retried webhook is the recovery path if that other path's
        // fire-and-forget triggerGeneration rejected before a generationJob row existed (the sweeper
        // only recovers orders that already have a job). Re-triggering is idempotent — start.ts
        // no-ops generating/ready/partial/needs_human_qa and claims a plain 'paid' order.
        const current = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
        return current?.status === 'paid';
      }

      await tx.paymentRecord.upsert({
        where: { orderId: order.id },
        update: {
          provider: 'payme',
          paid: true,
          paidAt: new Date(),
          amount: order.totalPrice,
          currency: 'ils',
          raw: parsed.raw as object,
        },
        create: {
          orderId: order.id,
          provider: 'payme',
          amount: order.totalPrice,
          currency: 'ils',
          paid: true,
          paidAt: new Date(),
          raw: parsed.raw as object,
        },
      });

      // Confirm any reserved coupon redemption inside this same exactly-once transaction, so the
      // cap advances atomically with the paid transition (and a webhook replay never double-counts).
      const couponOutcome = await confirmCouponForOrder(tx, order.id);
      // FAIL-CLOSED (LB#1b): fence when the discount was not granted (cap-safe paid-late) OR when a
      // COUPONED order confirmed to 'noop' — charged a discounted amount yet occupying no slot, which is
      // exactly how "≤ N discounted PAID sales" breaks while confirmedCount still reads ≤ max. The fence is
      // a REAL hold: needs_human_qa stops generation/ready/outbox/email (start.ts treats it as terminal).
      const couponFence = await couponConfirmFenceReason(tx, order.id, couponOutcome);
      if (couponFence) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: couponFence },
        });
        logger.error('[PayMeWebhook] coupon confirm did not grant a slot for a paid order — held for refund/charge-full', {
          orderId: order.id,
          transactionId: parsed.transactionId,
          outcome: couponOutcome,
          reason: couponFence,
        });
      }

      return true;
    });

    if (!shouldTriggerGeneration) {
      logger.info('[PayMeWebhook] No generation trigger needed', {
        orderId: parsed.orderId,
        transactionId: parsed.transactionId,
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    logger.info('[PayMeWebhook] Order marked paid', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
    });
    logger.info('[PayMeWebhook] Generation triggered', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
    });

    // AWAIT the start so job-creation + the durable after() dispatch registration complete BEFORE the
    // webhook returns — an unawaited trigger can be dropped by a post-response serverless freeze (the
    // same stranding class chainGenerationWorker just fixed one layer down). The try/catch keeps a
    // generation-start failure from failing the payment ack: a non-2xx would trigger a PayMe retry
    // (double-processing/charge risk); the job row is durably created on success so the sweeper can
    // recover a stranded start. (Same swallow as the prior fire-and-forget .catch, but now awaited.)
    try {
      await triggerGeneration(parsed.orderId as string, 'payme_webhook_payment_paid');
    } catch (error) {
      logger.error('[PayMeWebhook] Generation trigger failed', error, {
        orderId: parsed.orderId as string,
        transactionId: parsed.transactionId as string,
      });
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('[PayMeWebhook] Duplicate transaction replay ignored', {
        orderId: parsed.orderId,
        transactionId: parsed.transactionId,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
    logger.error('[PayMeWebhook] Failed to process webhook', error, {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
