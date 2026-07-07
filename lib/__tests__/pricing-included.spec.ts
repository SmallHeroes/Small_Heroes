import { describe, it, expect } from 'vitest';
import { computePricing } from '../../backend/config/wizard';
import { computeCouponDiscount } from '@/lib/coupon/coupon-math';

/**
 * OQ-PA4 — everything (narration, PDF, video) is INCLUDED in the flat launch price. The
 * audio/pdf/video/bundle feature flags must NOT change the price: the charged/stored total always
 * equals the displayed base (₪59/79/99), and the launch coupon then composes to 25% off that base.
 *
 * Before the fix: buildWizardPayload hardcodes audio+pdf on (every order +₪38) and video auto-on
 * for fantasy (+₪29 more → ₪166 charged vs ₪99 shown). These tests pin that to zero.
 */
const PRODUCTS = [
  { direction: 'bedtime', length: 'short', base: 59 },
  { direction: 'adventure', length: 'medium', base: 79 },
  { direction: 'fantasy', length: 'long', base: 99 },
] as const;

describe('computePricing — everything included, no add-on charges (OQ-PA4)', () => {
  for (const { direction, length, base } of PRODUCTS) {
    it(`${direction}: total == base ₪${base} even with audio+pdf+video all enabled`, () => {
      const p = computePricing({
        length,
        direction,
        audioEnabled: true,
        pdfEnabled: true,
        bundleEnabled: false,
        videoEnabled: true,
      });
      expect(p.basePrice).toBe(base);
      expect(p.addonsPrice).toBe(0); // no +₪38 (audio+pdf), no +₪29 (video)
      expect(p.totalPrice).toBe(base);
    });
  }

  it('bundle enabled also adds nothing', () => {
    const p = computePricing({
      length: 'long',
      direction: 'fantasy',
      audioEnabled: true,
      pdfEnabled: true,
      bundleEnabled: true,
      videoEnabled: true,
    });
    expect(p.totalPrice).toBe(99);
  });

  it('the real wizard fantasy payload (audio+pdf+video on) is ₪99, not the old ₪166', () => {
    const p = computePricing({
      length: 'long',
      direction: 'fantasy',
      audioEnabled: true,
      pdfEnabled: true,
      bundleEnabled: false,
      videoEnabled: true,
    });
    expect(p.totalPrice).toBe(99);
  });
});

describe('coupon composes with the flat price — 25% off the shown base', () => {
  for (const { direction, length, base } of PRODUCTS) {
    it(`${direction}: coupon → 25% off ₪${base} (== shown price)`, () => {
      const totalAgorot =
        computePricing({
          length,
          direction,
          audioEnabled: true,
          pdfEnabled: true,
          bundleEnabled: false,
          videoEnabled: true,
        }).totalPrice * 100;
      const discounted = computeCouponDiscount(totalAgorot, 25).discountedAgorot;
      expect(discounted).toBe(Math.round(base * 100 * 0.75));
    });
  }
});
