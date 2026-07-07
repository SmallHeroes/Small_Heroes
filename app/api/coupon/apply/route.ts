/**
 * Coupon Apply API
 * POST /api/coupon/apply — validate a coupon code at the pre-payment step and return the
 * SERVER-COMPUTED discounted total for display. The client sends only { orderId, code } — never
 * a price. This does NOT reserve a slot (the authoritative capacity gate + reservation happen at
 * checkout); it is a preview + persists which code to apply so checkout knows to reserve it.
 *
 * Sending an empty code removes any previously-applied coupon from the order.
 */
import { NextRequest, NextResponse } from 'next/server';
import { computePricing } from '../../../../backend/config/wizard';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupon/coupon-service';

const logger = createLogger({ subsystem: 'coupon', route: '/api/coupon/apply' });

export async function POST(req: NextRequest) {
  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-coupon-apply-post',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  const rawCode = typeof body?.code === 'string' ? body.code : '';
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!['draft', 'pending_payment'].includes(order.status)) {
    return NextResponse.json({ error: 'Order already has payment' }, { status: 409 });
  }

  // Server-computed original total (agorot) — identical derivation to /api/checkout.
  const pricing = computePricing({
    length: order.storyLength,
    direction: order.storyDirection ?? undefined,
    audioEnabled: order.audioEnabled,
    pdfEnabled: order.pdfEnabled,
    bundleEnabled: order.bundleEnabled,
    videoEnabled: order.videoEnabled,
  });
  const originalAgorot = Math.round(pricing.totalPrice * 100);

  // Empty code → clear any applied coupon and return the full price.
  const code = normalizeCouponCode(rawCode);
  if (!code) {
    if (order.couponCode) {
      await prisma.order.update({ where: { id: order.id }, data: { couponCode: null } });
    }
    return NextResponse.json({ ok: true, cleared: true, originalAgorot });
  }

  const validation = await validateCoupon(code, originalAgorot);
  if (!validation.ok) {
    // Do not leave a stale/invalid code persisted on the order.
    if (order.couponCode) {
      await prisma.order.update({ where: { id: order.id }, data: { couponCode: null } });
    }
    logger.info('Coupon apply rejected', { orderId, reason: validation.reason });
    return NextResponse.json({ ok: false, reason: validation.reason });
  }

  await prisma.order.update({ where: { id: order.id }, data: { couponCode: validation.code } });
  logger.info('Coupon applied (reserved at checkout)', {
    orderId,
    code: validation.code,
    discountPercent: validation.discountPercent,
  });
  return NextResponse.json({
    ok: true,
    code: validation.code,
    discountPercent: validation.discountPercent,
    originalAgorot: validation.originalAgorot,
    discountAgorot: validation.discountAgorot,
    discountedAgorot: validation.discountedAgorot,
  });
}
