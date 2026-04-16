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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
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
      stripeMetadata: session as any,
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
      raw: session as any,
    },
  });

  console.log(`[Webhook] Order ${orderId} marked as PAID — triggering generation`);

  // Trigger generation pipeline (async — don't await)
  triggerGeneration(orderId).catch(err =>
    console.error(`[Webhook] Generation trigger failed for ${orderId}:`, err)
  );
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
