/**
 * Pure coupon math + code normalization — NO database / env imports, so it is unit-testable in
 * CI without a DB. The stateful reserve/confirm/release logic lives in ./coupon-service.
 */

export type CouponFailureReason = 'not_found' | 'inactive' | 'maxed_out';

export interface CouponPricing {
  discountPercent: number;
  originalAgorot: number;
  discountAgorot: number;
  discountedAgorot: number;
}

/** Normalize user input to the canonical stored form (codes are stored upper-case). */
export function normalizeCouponCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

/**
 * Apply a whole-percent discount to an agorot total, rounding to the nearest agora. Never returns
 * a negative total or a discount larger than the original; percent is clamped to [0, 100].
 */
export function computeCouponDiscount(originalAgorot: number, discountPercent: number): CouponPricing {
  const pct = Math.max(0, Math.min(100, Math.round(discountPercent)));
  const original = Math.max(0, Math.round(originalAgorot));
  const discountedAgorot = Math.round((original * (100 - pct)) / 100);
  const discountAgorot = original - discountedAgorot;
  return { discountPercent: pct, originalAgorot: original, discountAgorot, discountedAgorot };
}
