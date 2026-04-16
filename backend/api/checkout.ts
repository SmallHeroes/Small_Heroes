/**
 * Stripe Checkout API
 * POST /api/checkout — Create Stripe Checkout Session
 *
 * File: app/api/checkout/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
const prisma = new PrismaClient();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'draft') {
      return NextResponse.json({ error: 'Order already has payment' }, { status: 409 });
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'ils',
          product_data: {
            name: `ספר אישי לילדים — ${order.childName}`,
            description: `סיפור ${order.storyLength === 'short' ? 'קצר' : order.storyLength === 'medium' ? 'בינוני' : 'ארוך'} | גיבורים קטנים`,
            images: [`${APP_URL}/og-product.png`], // optional
          },
          unit_amount: order.basePrice, // already in agorot (smallest ILS unit)
        },
        quantity: 1,
      },
    ];

    if (order.bundleEnabled) {
      lineItems.push({
        price_data: {
          currency: 'ils',
          product_data: { name: 'קריינות + PDF (חבילה)' },
          unit_amount: order.addonsPrice,
        },
        quantity: 1,
      });
    } else {
      if (order.audioEnabled) {
        lineItems.push({
          price_data: {
            currency: 'ils',
            product_data: { name: 'קריינות בעברית' },
            unit_amount: 1900, // ₪19 in agorot
          },
          quantity: 1,
        });
      }
      if (order.pdfEnabled) {
        lineItems.push({
          price_data: {
            currency: 'ils',
            product_data: { name: 'ספר PDF להדפסה' },
            unit_amount: 1200, // ₪12 in agorot
          },
          quantity: 1,
        });
      }
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'ils',
      line_items: lineItems,
      customer_email: order.customerEmail,
      metadata: {
        orderId: order.id,
        childName: order.childName,
        env: process.env.NODE_ENV || 'development',
      },
      success_url: `${APP_URL}/order/${order.id}/generating?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/order/${order.id}/cancel`,
      payment_method_types: ['card'],
      locale: 'auto',
    });

    // Update order with Stripe session
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'pending_payment',
        stripeSessionId: session.id,
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });

  } catch (error) {
    console.error('[POST /api/checkout]', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
