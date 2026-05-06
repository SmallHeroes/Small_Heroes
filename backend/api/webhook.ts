/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * IMPORTANT: Do not use NextResponse.json() body parsing here.
 * Stripe needs the raw body to verify signatures.
 *
 * File: app/api/webhooks/stripe/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { triggerGeneration } from './generate';
import { logServerEvent } from './events';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});
const prisma = new PrismaClient();

export const config = { api: { bodyParser: false } }; // Next.js pages API compat

export async function POST(req: NextRequest) {
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
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`[Webhook] Event: ${event.type}`);

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
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// ─── Checkout Complete ────────────────────────────────
async function handleCheckoutComplete(session: Stripe.Checkout.Session, eventId: string) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('[Webhook] checkout.session.completed: missing orderId in metadata');
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error(`[Webhook] Order not found: ${orderId}`);
    return;
  }

  // Idempotency check
  if (order.stripePaid) {
    console.log(`[Webhook] Order ${orderId} already paid — skipping`);
    return;
  }

  // Mark as paid
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      stripePaid: true,
      stripePaymentId: session.payment_intent as string,
      stripeMetadata: JSON.parse(JSON.stringify(session)),
    },
  });

  // Record payment
  await prisma.paymentRecord.upsert({
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

  console.log(`[Webhook] Order ${orderId} marked as PAID — triggering generation`);
  logServerEvent('payment_completed', {
    orderId,
    amount:   session.amount_total ?? 0,
    currency: session.currency     ?? 'ils',
  });

  // Trigger generation pipeline (async — don't await)
  triggerGeneration(orderId).catch(err =>
    console.error(`[Webhook] Generation trigger failed for ${orderId}:`, err)
  );
}

// ─── Session Expired ──────────────────────────────────
// Fires when the Stripe Checkout page TTL elapses without the user completing
// payment. orderId is read from session.metadata (set directly at creation —
// no payment_intent_data workaround needed here).
// Guard: skip if the order was already paid (protects against out-of-order
// webhook replay where completed arrives after expired).
async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('[Webhook] checkout.session.expired: missing orderId in metadata');
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error(`[Webhook] checkout.session.expired: order not found: ${orderId}`);
    return;
  }

  // Never downgrade a successfully paid order
  if (order.stripePaid) {
    console.log(`[Webhook] checkout.session.expired: order ${orderId} already paid — skipping`);
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

  console.log(`[Webhook] Checkout session expired for order ${orderId}`);
}

// ─── Payment Failed ───────────────────────────────────
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

  console.log(`[Webhook] Payment failed for order ${orderId}`);
}
