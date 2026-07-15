import { describe, it, expect } from 'vitest';
import { computeCouponDiscount, normalizeCouponCode } from '@/lib/coupon/coupon-math';

/**
 * Pure discount math + code normalization. Runs in CI (no DB). The concurrency / cap /
 * exactly-once behavior is proven against a real Postgres in coupon-cap.staging.spec.ts.
 */
describe('computeCouponDiscount', () => {
  it('applies exactly 50% off each launch price (agorot) — the launch discount Guy confirmed 2026-07-15', () => {
    // 59 / 79 / 99 ILS = 5900 / 7900 / 9900 agorot → half
    expect(computeCouponDiscount(5900, 50)).toMatchObject({ discountedAgorot: 2950, discountAgorot: 2950, discountPercent: 50 });
    expect(computeCouponDiscount(7900, 50)).toMatchObject({ discountedAgorot: 3950, discountAgorot: 3950 });
    expect(computeCouponDiscount(9900, 50)).toMatchObject({ discountedAgorot: 4950, discountAgorot: 4950 });
  });

  it('discounts whatever total it is given (the percent is data — the math is generic)', () => {
    // The seeded launch code is 50%, but the owner can retune discountPercent without a deploy.
    expect(computeCouponDiscount(9900, 25).discountedAgorot).toBe(7425);
    expect(computeCouponDiscount(11800, 50).discountedAgorot).toBe(5900);
  });

  it('rounds to the nearest agora', () => {
    // 5901 * 0.75 = 4425.75 → 4426
    expect(computeCouponDiscount(5901, 25).discountedAgorot).toBe(4426);
  });

  it('clamps percent to [0,100] and never returns a negative total', () => {
    expect(computeCouponDiscount(5900, 0).discountedAgorot).toBe(5900);
    expect(computeCouponDiscount(5900, 100).discountedAgorot).toBe(0);
    expect(computeCouponDiscount(5900, 150).discountedAgorot).toBe(0);
    expect(computeCouponDiscount(5900, -10).discountedAgorot).toBe(5900);
    expect(computeCouponDiscount(0, 25).discountedAgorot).toBe(0);
  });

  it('conserves every agora: discountAgorot + discountedAgorot === original', () => {
    for (const original of [5900, 7900, 9900, 11800, 13700, 1, 3]) {
      const r = computeCouponDiscount(original, 25);
      expect(r.discountAgorot + r.discountedAgorot).toBe(original);
    }
  });
});

describe('normalizeCouponCode', () => {
  it('trims surrounding whitespace and upper-cases (so user casing matches the stored code)', () => {
    expect(normalizeCouponCode('  first100 ')).toBe('FIRST100');
    expect(normalizeCouponCode('First100')).toBe('FIRST100');
    expect(normalizeCouponCode('FIRST100')).toBe('FIRST100');
    expect(normalizeCouponCode('')).toBe('');
    expect(normalizeCouponCode('   ')).toBe('');
  });
});
