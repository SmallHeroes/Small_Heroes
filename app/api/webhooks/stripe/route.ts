/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * IMPORTANT: reads raw body for Stripe signature verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { triggerGeneration } from '../../generate/route';
import { logServerEvent } from '../../events/route';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});
const logger = createLogger({ subsystem: 'stripe-webhook', route: '/api/webhooks/stripe' });

export async function POST(req: NextRequest) {
  if (env.PAYMENT_PROVIDER !== 'stripe') {
    logger.info('Stripe webhook ignored because Stripe is not the active provider', {
      activePaymentProvider: env.PAYMENT_PROVIDER,
    });
    return NextResponse.json({ received: true, ignored: true, reason: 'stripe_inactive' });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Stripe signature verification failed', err, { reason: msg });
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  logger.info('Stripe event received', { eventType: event.type, eventId: event.id });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session, event.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailed(pi);
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleSessionExpired(session);
      break;
    }
    default:
      logger.info('Unhandled Stripe event type', { eventType: event.type, eventId: event.id });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session, eventId: string) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logger.warn('Checkout completed webhook missing orderId metadata', { eventId });
    return;
  }
  try {
    const shouldTriggerGeneration = await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({
        data: {
          stripeEventId: eventId,
          eventType: 'checkout.session.completed',
          orderId,
        },
      });

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        logger.warn('Order not found while processing checkout completion', { orderId, eventId });
        return false;
      }

      const paidUpdate = await tx.order.updateMany({
        where: {
          id: orderId,
          stripePaid: false,
        },
        data: {
          status: 'paid',
          stripePaid: true,
          stripePaymentId: session.payment_intent as string,
          stripeMetadata: JSON.parse(JSON.stringify(session)),
        },
      });
      if (paidUpdate.count === 0) {
        return false;
      }

      await tx.paymentRecord.upsert({
        where: { orderId },
        update: { paid: true, paidAt: new Date(), stripeEventId: eventId },
        create: {
          orderId,
          provider: 'stripe',
          stripeSessionId: session.id,
          stripeEventId: eventId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'ils',
          paid: true,
          paidAt: new Date(),
          raw: JSON.parse(JSON.stringify(session)),
        },
      });
      return true;
    });

    if (!shouldTriggerGeneration) {
      logger.info('Order already processed; skipping side effects', { orderId, eventId });
      return;
    }

    const directionSet = await prisma.storyDirectionSet.findUnique({
      where: { orderId },
      include: { selectedDirection: { select: { archetype: true } } },
    });

    logger.info('Order marked paid; triggering generation', {
      orderId,
      eventId,
      reason: 'stripe_webhook_checkout_completed',
    });
    logServerEvent('payment_completed', {
      orderId,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'ils',
      archetype: directionSet?.selectedDirection?.archetype ?? null,
    });

    triggerGeneration(orderId, 'stripe_webhook_checkout_completed').catch((err) =>
      logger.error('Generation trigger failed after webhook', err, { orderId, eventId })
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.info('Duplicate Stripe event ignored', { eventId, orderId });
      return;
    }
    throw error;
  }
}

async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logger.warn('Checkout expired webhook missing orderId metadata');
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    logger.warn('Order not found while processing checkout expiration', { orderId });
    return;
  }

  if (order.stripePaid) {
    logger.info('Checkout expired event ignored for already paid order', { orderId });
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'failed',
      lastError: 'Checkout session expired — payment was not completed',
      errorAt: new Date(),
    },
  });

  logger.info('Checkout session expired handled', { orderId });
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'failed',
      lastError: pi.last_payment_error?.message || 'Payment failed',
      errorAt: new Date(),
    },
  });

  logger.info('Payment failure handled', { orderId });
}
