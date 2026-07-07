/**
 * Coupon Apply API
 * POST /api/coupon/apply — validate a coupon code at the pre-payment step and return the
 * SERVER-COMPUTED discounted total for display. The client sends only { code, product } where
 * `product` is the same selector set it will send to POST /api/orders — NEVER a price.
 *
 * This is a preview only (no order exists yet, no slot is reserved). The authoritative capacity
 * gate + reservation + discount happen server-side at /api/checkout. Because the preview prices
 * via the SAME computePricing() on the SAME selectors that checkout will use, the previewed total
 * equals the amount that will actually be charged (preview == charge).
 */
import { NextRequest, NextResponse } from 'next/server';
import { computePricing } from '../../../../backend/config/wizard';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { createLogger } from '@/lib/logger';
import { validateCoupon, normalizeCouponCode } from '@/lib/coupon/coupon-service';

const logger = createLogger({ subsystem: 'coupon', route: '/api/coupon/apply' });

/** Server-side order total (agorot) from the wizard product selectors — never a client price. */
function originalAgorotFromProduct(product: unknown): number {
  const p = (product ?? {}) as Record<string, unknown>;
  const pricing = computePricing({
    length: typeof p.length === 'string' ? p.length : 'medium',
    direction: typeof p.direction === 'string' ? p.direction : undefined,
    audioEnabled: Boolean(p.audioEnabled),
    pdfEnabled: Boolean(p.pdfEnabled),
    bundleEnabled: Boolean(p.bundleEnabled),
    videoEnabled: Boolean(p.videoEnabled),
  });
  return Math.round(pricing.totalPrice * 100);
}

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
  const rawCode = typeof body?.code === 'string' ? body.code : '';
  const originalAgorot = originalAgorotFromProduct(body?.product);

  const code = normalizeCouponCode(rawCode);
  if (!code) return NextResponse.json({ ok: false, reason: 'not_found' });

  const validation = await validateCoupon(code, originalAgorot);
  if (!validation.ok) {
    logger.info('Coupon apply rejected', { reason: validation.reason });
    return NextResponse.json({ ok: false, reason: validation.reason });
  }

  logger.info('Coupon apply preview', { code: validation.code, discountPercent: validation.discountPercent });
  return NextResponse.json({
    ok: true,
    code: validation.code,
    discountPercent: validation.discountPercent,
    originalAgorot: validation.originalAgorot,
    discountAgorot: validation.discountAgorot,
    discountedAgorot: validation.discountedAgorot,
  });
}
