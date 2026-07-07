import { describe, it, expect } from 'vitest';
import { computeCouponDiscount, normalizeCouponCode } from '@/lib/coupon/coupon-math';

/**
 * Pure discount math + code normalization. Runs in CI (no DB). The concurrency / cap /
 * exactly-once behavior is proven against a real Postgres in coupon-cap.staging.spec.ts.
 */
describe('computeCouponDiscount', () => {
  it('applies exactly 25% off each launch price (agorot)', () => {
    // 59 / 79 / 99 ILS = 5900 / 7900 / 9900 agorot
    expect(computeCouponDiscount(5900, 25)).toMatchObject({ discountedAgorot: 4425, discountAgorot: 1475, discountPercent: 25 });
    expect(computeCouponDiscount(7900, 25)).toMatchObject({ discountedAgorot: 5925, discountAgorot: 1975 });
    expect(computeCouponDiscount(9900, 25)).toMatchObject({ discountedAgorot: 7425, discountAgorot: 2475 });
  });

  it('discounts the FULL total including add-ons (not just the base)', () => {
    // fantasy 99 + audio 19 = 118 ILS = 11800 agorot → 25% off → 8850
    expect(computeCouponDiscount(11800, 25).discountedAgorot).toBe(8850);
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
