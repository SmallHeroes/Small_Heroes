import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { triggerGeneration } from '../../generate/trigger';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import {
  extractWebhookClientIp,
  isPaymeStatusPaid,
  parsePaymeWebhookPayload,
  resolvePaymeConfig,
  verifyPaymeSignature,
  verifyPaymePayment,
} from '@/lib/payme';
import { isEngineSiteOrder } from '@/lib/engine-site/offer';
import { ENGINE_QA_SESSION_ID, engineQaRequired, engineQaScope, isEngineQaOrder } from '@/lib/engine-site/qa-order-policy';
import { recordEngineUnexpectedCapture } from '@/lib/engine-site/extra-payment';
import { recordEnginePaymentProofRefusal,clearEnginePaymentProofRefusal } from '@/lib/engine-site/payment-proof-alert';
import { env } from '@/lib/env';
import { confirmCouponForOrder, couponConfirmFenceReason } from '@/lib/coupon/coupon-service';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import { writeOrderHoldFenced } from '@/lib/generation-pipeline/order-authority';

const logger = createLogger({ subsystem: 'payme-webhook', route: '/api/webhooks/payme' });

export async function POST(req: NextRequest) {
  const qa = engineQaScope();
  if (engineQaRequired() && (!qa || req.nextUrl.origin !== qa.origin))
    return NextResponse.json({ error: 'engine_qa_webhook_unavailable' }, { status: 503 });
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
    if (qa) {
      const nativeFields = ['notify_type', 'transaction_id', 'payme_sale_id', 'sale_status'];
      if (nativeFields.some(field => params.getAll(field).length !== 1 || !params.get(field)))
        return NextResponse.json({ error: 'Invalid Sandbox callback' }, { status: 400 });
      if (params.get('notify_type') !== 'sale-complete')
        return NextResponse.json({ received: true, ignored: true });
    }
    parsedBody = Object.fromEntries(params.entries());
  } else {
    if (qa) return NextResponse.json({ error: 'Sandbox callback must be form data' }, { status: 415 });
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
  if (qa) parsed.eventType = 'sale-complete';

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

  // For a Sandbox seller, the callback is a signal to verify the stored sale with PayMe.
  if (!qa && cfg.webhookSecret) {
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
  } else if (!qa) {
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

  logger.info('[PayMeWebhook] Payment notification received', {
    orderId: parsed.orderId,
    transactionId: parsed.transactionId,
    paymentStatus: parsed.paymentStatus,
    verification: qa ? 'sandbox_sale_lookup_required' : hasVerifiedSignature ? 'signature' : 'ip_allowlist',
    usedFallbackFields: parsed.usedFallbackFields,
  });
  if (parsed.usedFallbackFields) {
    logger.warn('[PayMeWebhook] Payload accepted via compatibility fallback fields', {
      orderId: parsed.orderId,
      transactionId: parsed.transactionId,
    });
  }

  try {
    let paymentEvidence = parsed.raw as object;
    const observed = await prisma.order.findUnique({ where: { id: parsed.orderId! },
      select: { id: true, totalPrice: true, frozenProductVersion: true, paymentProvider: true, paymentId: true,
        userId: true, selectedVoice: true, wizardSessionId: true, wizardSession: { select: { sessionId: true } } } });
    if (qa) {
      if (!observed || !isEngineSiteOrder(observed) || !isEngineQaOrder(qa, observed, observed.wizardSession?.sessionId) ||
          observed.paymentProvider !== 'payme' || observed.paymentId !== parsed.transactionId)
        return NextResponse.json({ received: false, reason: 'engine_qa_sale_not_bound' }, { status: 409 });
    } else if (observed?.wizardSession?.sessionId === ENGINE_QA_SESSION_ID) {
      return NextResponse.json({ received: false, reason: 'engine_qa_order_scope_required' }, { status: 403 });
    }
    if (observed && isEngineSiteOrder(observed)) {
      const verified = await verifyPaymePayment({ orderId: observed.id, paymentId: parsed.transactionId!, amountAgorot: observed.totalPrice, currency: 'ILS' });
      if (!verified.verified || verified.status !== 'paid') {
        logger.warn('[PayMeWebhook] Payment notification could not be independently verified',{orderId:observed.id,signed:hasVerifiedSignature});
        if (qa && verified.proofRefused === true)
          await recordEnginePaymentProofRefusal(prisma, observed.id, parsed.transactionId!, 'stored_sale_query', verified.paidMismatch);
        else if (hasVerifiedSignature && verified.proofRefused === true)
          await recordEnginePaymentProofRefusal(prisma, observed.id, parsed.transactionId!, 'signed_callback', verified.paidMismatch);
        return NextResponse.json({ received: false, reason: 'payment_proof_unavailable' }, { status: 503 });
      }
      if (qa) paymentEvidence = verified.raw as object;
    }
    const shouldTriggerGeneration = await prisma.$transaction(async (tx) => {
      // The same Order lock serializes primary adoption, extra captures and checkout persistence.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${parsed.orderId!} FOR UPDATE`;
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
          paymentProvider: true,
          paymentId: true,
          userId: true,
          selectedVoice: true,
          wizardSessionId: true,
          totalPrice: true,
          frozenProductVersion: true,
        },
      });
      if (!order) {
        logger.error('[PayMeWebhook] Order missing for paid event', {
          orderId: parsed.orderId,
          transactionId: parsed.transactionId,
        });
        return false;
      }

      if (qa && (!observed || !isEngineSiteOrder(order) || order.paymentId !== observed.paymentId ||
          order.wizardSessionId !== observed.wizardSessionId || order.userId !== observed.userId ||
          order.selectedVoice !== observed.selectedVoice || order.paymentProvider !== 'payme'))
        throw Error('engine_payment_order_changed');

      if (isEngineSiteOrder(order)) {
        // Recheck the frozen amount/version after the outside HTTP proof and under the Order lock.
        if (!observed || order.totalPrice !== observed.totalPrice || order.frozenProductVersion !== observed.frozenProductVersion)
          throw Error('engine_payment_order_changed');
        const primary = order.paymeTransactionId || order.paymentId;
        if (order.status === 'failed' || primary && primary !== parsed.transactionId) {
          await recordEngineUnexpectedCapture(tx, order, parsed.transactionId!, order.status === 'failed' && primary === parsed.transactionId);
          return false;
        }
      }
      if (order.status === 'failed') return false;
      if (order.status === 'generating' || order.status === 'ready' || order.status === 'partial' || order.status === 'needs_human_qa') {
        return false;
      }

      // Paid transition — CONDITIONAL so an overlapping payment-success path (e.g. the redirect
      // return) that has already advanced or FENCED (needs_human_qa) this order is NEVER demoted
      // back to 'paid'. The WHERE is re-checked atomically at write time (Postgres READ COMMITTED
      // re-evaluates it after a concurrent commit), so only a pre-paid order transitions.
      const paidTransition = await tx.order.updateMany({
        where: { id: order.id, status: { in: ['draft', 'pending_payment'] } },
        data: {
          status: 'paid',
          paymentProvider: 'payme',
          paymentId: parsed.transactionId,
          paymeTransactionId: parsed.transactionId,
          paymeMetadata: paymentEvidence,
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
          raw: paymentEvidence,
        },
        create: {
          orderId: order.id,
          provider: 'payme',
          amount: order.totalPrice,
          currency: 'ils',
          paid: true,
          paidAt: new Date(),
          raw: paymentEvidence,
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
        // (Codex round-5 Unit 2) payment fence through the shared funnel: bind + bump + precedence. Sets
        // manualReviewRequired; the fence marker is rank 1, so it yields to an already-committed safety/contract hold
        // (which already stops delivery) rather than clobbering it.
        await writeOrderHoldFenced(tx, {
          orderId: order.id,
          newStatus: 'needs_human_qa',
          newHoldReason: couponFence,
          manualReviewRequired: true,
        });
        // (Human-QA Slice 1, re-gate P0-1) The payment_integrity review case is NOT written here — a case-write
        // rejection must never roll back this money transaction. The case is opened POST-COMMIT below.
        logger.error('[PayMeWebhook] coupon confirm did not grant a slot for a paid order — held for refund/charge-full', {
          orderId: order.id,
          transactionId: parsed.transactionId,
          outcome: couponOutcome,
          reason: couponFence,
        });
      }

      return true;
    });

    // (Human-QA Slice 1, re-gate P0-1) POST-COMMIT: the money tx is durably committed. Open the payment_integrity
    // review case in its OWN tx, best-effort — a failure here can never affect the payment, and the reconciler is
    // the guaranteed repair. A no-op unless the fence actually parked the order (syncHumanQaHoldCase re-reads it).
    await clearEnginePaymentProofRefusal(prisma,parsed.orderId!,parsed.transactionId!).catch(()=>logger.warn('Payment notice reconciliation pending',{orderId:parsed.orderId}));
    await syncHumanQaHoldCasePostCommit(prisma, parsed.orderId);

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
