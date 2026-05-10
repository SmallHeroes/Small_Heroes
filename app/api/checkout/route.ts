/**
 * PayMe Checkout API
 * POST /api/checkout — Create PayMe checkout request
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkoutProductName, checkoutProductDescription, CHECKOUT_ADDONS } from '@/content';
import { computePricing } from '../../../backend/config/wizard';
import { enforceRateLimit, enforceSameOrigin } from '../../../lib/request-security';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { createPaymeCheckout } from '@/lib/payme';
import { env, isFakePaymentEnabled } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { evaluatePhotoGate } from '@/lib/resemblance-core';

const logger = createLogger({ subsystem: 'checkout', route: '/api/checkout' });

function canUseLocalFakeFallback(): boolean {
  return process.env.NODE_ENV !== 'production' && env.ENABLE_FAKE_PAYMENT;
}

async function createFakeCheckoutResponse(params: {
  orderId: string;
  basePriceAgorot: number;
  addonsPriceAgorot: number;
  totalPriceAgorot: number;
}) {
  const paymentId = `fake_${params.orderId}_${Date.now()}`;
  await prisma.order.update({
    where: { id: params.orderId },
    data: {
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId,
      basePrice: params.basePriceAgorot,
      addonsPrice: params.addonsPriceAgorot,
      totalPrice: params.totalPriceAgorot,
    },
  });
  logger.info('Fake checkout created', { orderId: params.orderId, paymentId });
  return NextResponse.json({
    url: `${ROUTES.fakePayment}?orderId=${encodeURIComponent(params.orderId)}&paymentId=${encodeURIComponent(paymentId)}`,
    paymentProvider: 'fake',
    paymentId,
  });
}

function getMissingPaymeConfigKeys() {
  const missing: string[] = [];
  if (!env.PAYME_API_BASE_URL) missing.push('PAYME_API_BASE_URL');
  if (!env.PAYME_API_KEY) missing.push('PAYME_API_KEY');
  return missing;
}

function resolveAppUrl(req: NextRequest): string {
  // Prefer explicit config; otherwise use the actual request host.
  return (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;
    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-checkout-post',
      limit: 15,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;
    if (env.PAYMENT_PROVIDER === 'fake' && process.env.NODE_ENV === 'production') {
      logger.error('Checkout blocked: fake payment provider is forbidden in production');
      return NextResponse.json({ error: 'Payment provider misconfigured' }, { status: 503 });
    }
    if (env.PAYMENT_PROVIDER !== 'payme' && env.PAYMENT_PROVIDER !== 'fake') {
      logger.error('Checkout blocked: PAYMENT_PROVIDER must be payme', {
        paymentProvider: env.PAYMENT_PROVIDER,
      });
      return NextResponse.json(
        {
          error: 'Payment provider misconfigured',
          reason: 'PAYMENT_PROVIDER must be payme or fake',
          paymentProvider: env.PAYMENT_PROVIDER,
        },
        { status: 503 }
      );
    }
    const missingPaymeKeys = getMissingPaymeConfigKeys();
    if (env.PAYMENT_PROVIDER === 'payme' && missingPaymeKeys.length > 0) {
      logger.error('Checkout blocked: missing PayMe config', { missingPaymeKeys });
      return NextResponse.json(
        {
          error: 'PayMe configuration missing',
          reason: `Missing required PayMe configuration: ${missingPaymeKeys.join(', ')}`,
          missing: missingPaymeKeys,
        },
        { status: 503 }
      );
    }

    const appUrl = resolveAppUrl(req);
    const { orderId, sessionId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    logger.info('Checkout request received', { orderId });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      logger.warn('Checkout request order not found', { orderId });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!['draft', 'pending_payment'].includes(order.status)) {
      logger.warn('Checkout request rejected due to order status', {
        orderId,
        status: order.status,
      });
      return NextResponse.json({ error: 'Order already has payment' }, { status: 409 });
    }
    const pricing = computePricing({
      length: order.storyLength,
      audioEnabled: order.audioEnabled,
      pdfEnabled: order.pdfEnabled,
      bundleEnabled: order.bundleEnabled,
      videoEnabled: order.videoEnabled,
    });
    const basePriceAgorot = Math.round(pricing.basePrice * 100);
    const addonsPriceAgorot = Math.round(pricing.addonsPrice * 100);
    const totalPriceAgorot = Math.round(pricing.totalPrice * 100);

    const addonLabels: string[] = [];
    if (order.bundleEnabled) addonLabels.push(CHECKOUT_ADDONS.bundle);
    if (!order.bundleEnabled && order.audioEnabled) addonLabels.push(CHECKOUT_ADDONS.audio);
    if (!order.bundleEnabled && order.pdfEnabled) addonLabels.push(CHECKOUT_ADDONS.pdf);
    if (!order.bundleEnabled && order.videoEnabled) addonLabels.push(CHECKOUT_ADDONS.video);
    const descriptionParts = [
      checkoutProductName(order.childName),
      checkoutProductDescription(order.storyLength),
      addonLabels.length > 0 ? `תוספות: ${addonLabels.join(', ')}` : null,
    ].filter(Boolean);

    if (order.childImageUrl) {
      const photoGate = await evaluatePhotoGate(order.childImageUrl);
      if (!photoGate.passed) {
        logger.warn('Checkout blocked by PhotoGate', {
          orderId,
          reasons: photoGate.reasons,
          faceCount: photoGate.faceCount,
          faceAreaRatio: photoGate.faceAreaRatio,
          brightness: Math.round(photoGate.brightness),
          sharpness: Math.round(photoGate.sharpness),
        });
        return NextResponse.json(
          {
            error: 'Child photo quality check failed',
            reason: 'photogate_rejected',
            details: photoGate.reasons,
          },
          { status: 422 }
        );
      }
      if (photoGate.inputStrength === 'weak') {
        logger.warn('PhotoGate accepted weak input photo', {
          orderId,
          faceAreaRatio: photoGate.faceAreaRatio,
          brightness: Math.round(photoGate.brightness),
          sharpness: Math.round(photoGate.sharpness),
        });
      }
    }

    if (env.PAYMENT_PROVIDER === 'fake') {
      if (!isFakePaymentEnabled()) {
        logger.error('Fake checkout blocked: fake payment mode not enabled', {
          paymentProvider: env.PAYMENT_PROVIDER,
          enableFakePayment: env.ENABLE_FAKE_PAYMENT,
          nodeEnv: process.env.NODE_ENV || 'development',
        });
        return NextResponse.json({ error: 'Fake payment is not enabled' }, { status: 403 });
      }
      return createFakeCheckoutResponse({
        orderId: order.id,
        basePriceAgorot,
        addonsPriceAgorot,
        totalPriceAgorot,
      });
    }

    let paymeCheckout;
    try {
      paymeCheckout = await createPaymeCheckout({
        orderId: order.id,
        amountAgorot: totalPriceAgorot,
        currency: 'ILS',
        description: descriptionParts.join(' | '),
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        successUrl: `${appUrl}/api/payme/return?orderId=${encodeURIComponent(order.id)}`,
        callbackUrl: `${appUrl}/api/webhooks/payme`,
        cancelUrl: `${appUrl}${ROUTES.wizard}`,
        metadata: {
          orderId: order.id,
          ...(typeof sessionId === 'string' && sessionId.trim() ? { sessionId: sessionId.trim() } : {}),
          env: process.env.NODE_ENV || 'development',
        },
      });
    } catch (error) {
      if (canUseLocalFakeFallback()) {
        logger.warn('PayMe checkout failed; falling back to fake checkout in local/dev', {
          orderId: order.id,
          paymentProvider: env.PAYMENT_PROVIDER,
          enableFakePayment: env.ENABLE_FAKE_PAYMENT,
          error: error instanceof Error ? error.message : String(error),
        });
        return createFakeCheckoutResponse({
          orderId: order.id,
          basePriceAgorot,
          addonsPriceAgorot,
          totalPriceAgorot,
        });
      }
      throw error;
    }

    const checkoutUrl = paymeCheckout.checkoutUrl?.trim() || '';
    try {
      const pay = new URL(checkoutUrl);
      if (pay.protocol !== 'http:' && pay.protocol !== 'https:') {
        throw new Error('bad_protocol');
      }
      const appOrigin = new URL(appUrl);
      if (pay.hostname === appOrigin.hostname) {
        logger.error('Checkout blocked: provider returned same-host URL (would 404 or skip PayMe)', {
          orderId,
          checkoutUrl,
        });
        return NextResponse.json(
          {
            error: 'Payment provider returned an invalid redirect URL',
            reason:
              'checkout_url_same_origin — configure PAYME_CHECKOUT_PAGE_ORIGIN if PayMe returns a path-only URL, or verify PayMe credentials.',
          },
          { status: 502 }
        );
      }
    } catch (e) {
      if (e instanceof TypeError || (e instanceof Error && e.message === 'bad_protocol')) {
        logger.error('Checkout blocked: invalid checkout URL from provider', { orderId, checkoutUrl, err: e });
        return NextResponse.json(
          { error: 'Payment provider returned an invalid redirect URL', reason: 'checkout_url_parse_failed' },
          { status: 502 }
        );
      }
      throw e;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'pending_payment',
        paymentProvider: 'payme',
        paymentId: paymeCheckout.checkoutId ?? null,
        paymeMetadata: paymeCheckout.raw as object,
        basePrice: basePriceAgorot,
        addonsPrice: addonsPriceAgorot,
        totalPrice: totalPriceAgorot,
      },
    });
    logger.info('PayMe checkout created', {
      orderId,
      checkoutId: paymeCheckout.checkoutId ?? null,
      checkoutUrl,
      // Do not log paymeCheckout.raw — it echoes seller_payme_id (API key)
    });

    return NextResponse.json({
      url: checkoutUrl,
      paymentProvider: 'payme',
      paymentId: paymeCheckout.checkoutId,
      checkoutId: paymeCheckout.checkoutId, // legacy compatibility
      provider: 'payme', // legacy compatibility
    });

  } catch (error) {
    logger.error('PayMe checkout creation failed', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
