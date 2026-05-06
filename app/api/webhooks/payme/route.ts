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

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody || '{}');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn('[PayMeWebhook] Invalid JSON body', { reason });
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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

      if (order.status === 'generating' || order.status === 'ready' || order.status === 'partial') {
        return false;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paymentProvider: 'payme',
          paymentId: parsed.transactionId,
          paymeTransactionId: parsed.transactionId,
          paymeMetadata: parsed.raw as object,
          stripePaid: false,
        },
      });

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

    triggerGeneration(parsed.orderId as string, 'payme_webhook_payment_paid').catch((error) => {
      logger.error('[PayMeWebhook] Generation trigger failed', error, {
        orderId: parsed.orderId as string,
        transactionId: parsed.transactionId as string,
      });
    });

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
