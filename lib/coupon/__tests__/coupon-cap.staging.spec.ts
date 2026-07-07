import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * MANDATORY LIVE PROOF — the coupon cap under REAL Postgres concurrency (FOR UPDATE), NO renders.
 * Proves the money-critical guarantees the unit tests cannot (they have no DB):
 *   A. N concurrent reserves + confirms NEVER exceed maxRedemptions.
 *   B. An abandoned (unpaid) reserve does NOT burn the cap: confirmedCount stays put, and once
 *      the hold expires the slot frees for someone else.
 *   C. A maxed-out coupon fails CLEANLY at reserve (typed reason, no throw, no discount).
 *   D. Re-checkout for the same order is idempotent (one slot, reused).
 *   E. A payment that lands AFTER the lease expired (slot already reused) can NEVER push
 *      confirmedCount past maxRedemptions — it is released + reported 'paid_late_over_cap'.
 *   F. An expired hold whose slot is still free is re-acquired and confirmed ('reacquired').
 *
 * Skipped by default (and always in prod) so `npm run check` stays green without a DB. Run it
 * against a staging/preview DB:
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_COUPON_CAP_PROOF=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
 *     DIRECT_URL='postgresql://...:5432/postgres' \
 *     npx vitest run lib/coupon/__tests__/coupon-cap.staging.spec.ts
 *
 * Tune scale with COUPON_CAP_MAX (default 10) and COUPON_CAP_ATTEMPTS (default 30).
 */
const RUN = process.env.RUN_COUPON_CAP_PROOF === 'true' && canAccessStagingQa();
const MAX = Number(process.env.COUPON_CAP_MAX ?? 10);
const ATTEMPTS = Number(process.env.COUPON_CAP_ATTEMPTS ?? 30);

async function makeOrder(prisma: PrismaClient, tag: string): Promise<string> {
  const o = await prisma.order.create({
    data: {
      customerEmail: `coupon-test-${tag}@example.com`,
      customerName: 'Coupon Test',
      childName: 'Test',
      topic: 'selfconfidence',
      basePrice: 5900,
      addonsPrice: 0,
      totalPrice: 5900,
    },
    select: { id: true },
  });
  return o.id;
}

describe.skipIf(!RUN)('coupon cap — real-Postgres concurrency + exactly-once proof', () => {
  it('A. N concurrent reserves + confirms never exceed maxRedemptions', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder, couponConfirmGranted } = await import('@/lib/coupon/coupon-service');

    const code = `CAPA_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: MAX, active: true },
      select: { id: true },
    });
    const orderIds: string[] = [];
    for (let i = 0; i < ATTEMPTS; i++) orderIds.push(await makeOrder(prisma, `a-${i}-${code}`));

    try {
      // All reserve at once — the FOR UPDATE lock must serialize the capacity check.
      const results = await Promise.all(
        orderIds.map((orderId) => reserveCoupon({ rawCode: code, orderId, originalAgorot: 5900 }))
      );
      const okCount = results.filter((r) => r.ok).length;
      expect(okCount).toBe(MAX); // exactly the cap reserved; the rest got maxed_out
      expect(results.filter((r) => !r.ok).every((r) => r.ok === false && r.reason === 'maxed_out')).toBe(true);

      // Everyone who reserved now "pays" — confirm each in its own tx (mirrors independent webhooks).
      let confirmed = 0;
      for (const orderId of orderIds) {
        const outcome = await prisma.$transaction((tx) => confirmCouponForOrder(tx, orderId));
        if (couponConfirmGranted(outcome)) confirmed++;
      }
      const fresh = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(confirmed).toBe(MAX);
      expect(fresh.confirmedCount).toBe(MAX);
      expect(fresh.confirmedCount).toBeLessThanOrEqual(MAX); // the invariant: NEVER exceeds the cap
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('B. an abandoned hold does not burn the cap; expiry frees the slot', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');

    const code = `CAPB_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 2, active: true },
      select: { id: true },
    });
    const o1 = await makeOrder(prisma, `b1-${code}`);
    const o2 = await makeOrder(prisma, `b2-${code}`);
    const o3 = await makeOrder(prisma, `b3-${code}`);
    try {
      expect((await reserveCoupon({ rawCode: code, orderId: o1, originalAgorot: 5900 })).ok).toBe(true);
      expect((await reserveCoupon({ rawCode: code, orderId: o2, originalAgorot: 5900 })).ok).toBe(true);
      // Cap is full by HOLDS (nobody paid) → third reserve is refused...
      const blocked = await reserveCoupon({ rawCode: code, orderId: o3, originalAgorot: 5900 });
      expect(blocked.ok).toBe(false);
      // ...yet confirmedCount never moved (holds are not redemptions).
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(0);

      // o1 abandons: expire its hold. The slot must free up for o3.
      await prisma.couponRedemption.update({ where: { orderId: o1 }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      const retried = await reserveCoupon({ rawCode: code, orderId: o3, originalAgorot: 5900 });
      expect(retried.ok).toBe(true);
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(0);
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [o1, o2, o3] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('C. a maxed-out coupon fails cleanly (typed reason, no throw)', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder } = await import('@/lib/coupon/coupon-service');

    const code = `CAPC_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const o1 = await makeOrder(prisma, `c1-${code}`);
    const o2 = await makeOrder(prisma, `c2-${code}`);
    try {
      expect((await reserveCoupon({ rawCode: code, orderId: o1, originalAgorot: 5900 })).ok).toBe(true);
      await prisma.$transaction((tx) => confirmCouponForOrder(tx, o1));
      const maxed = await reserveCoupon({ rawCode: code, orderId: o2, originalAgorot: 5900 });
      expect(maxed).toEqual({ ok: false, reason: 'maxed_out' });
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(1);
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [o1, o2] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('D. re-checkout for the same order is idempotent (one slot, reused)', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');

    const code = `CAPD_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const o1 = await makeOrder(prisma, `d1-${code}`);
    const o2 = await makeOrder(prisma, `d2-${code}`);
    try {
      const first = await reserveCoupon({ rawCode: code, orderId: o1, originalAgorot: 5900 });
      const again = await reserveCoupon({ rawCode: code, orderId: o1, originalAgorot: 5900 });
      expect(first.ok).toBe(true);
      expect(again).toMatchObject({ ok: true, reused: true });
      // Only one slot consumed → a different order still can't reserve (cap is 1).
      expect((await reserveCoupon({ rawCode: code, orderId: o2, originalAgorot: 5900 })).ok).toBe(false);
      expect(await prisma.couponRedemption.count({ where: { code } })).toBe(1);
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [o1, o2] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('E. paid-after-expiry never pushes confirmedCount past the cap (Codex re-gate)', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder } = await import('@/lib/coupon/coupon-service');

    const code = `CAPE_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const oA = await makeOrder(prisma, `e-a-${code}`);
    const oB = await makeOrder(prisma, `e-b-${code}`);
    try {
      // Reserve A (holds the single slot), then A's lease expires → its slot is freed for reuse.
      expect((await reserveCoupon({ rawCode: code, orderId: oA, originalAgorot: 5900 })).ok).toBe(true);
      await prisma.couponRedemption.update({ where: { orderId: oA }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      // B reserves the freed slot and pays → the cap is now FULL.
      expect((await reserveCoupon({ rawCode: code, orderId: oB, originalAgorot: 5900 })).ok).toBe(true);
      expect(await prisma.$transaction((tx) => confirmCouponForOrder(tx, oB))).toBe('confirmed');
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(1);

      // LATE payment success for the EXPIRED hold A → confirm MUST NOT exceed the cap.
      const lateOutcome = await prisma.$transaction((tx) => confirmCouponForOrder(tx, oA));
      expect(lateOutcome).toBe('paid_late_over_cap');
      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(after.confirmedCount).toBe(1);                 // NEVER 2 — the cap holds under paid-after-expiry
      expect(after.confirmedCount).toBeLessThanOrEqual(1);
      // A's hold was released — the over-cap discount was NOT granted (explicit paid-late handling).
      expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: oA } })).status).toBe('released');

      // Idempotent: a replayed late confirm for A stays a no-op and never bumps the counter.
      expect(await prisma.$transaction((tx) => confirmCouponForOrder(tx, oA))).toBe('noop');
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(1);
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [oA, oB] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('F. an expired hold is re-acquired and confirmed while its slot is still free', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder } = await import('@/lib/coupon/coupon-service');

    const code = `CAPF_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const oA = await makeOrder(prisma, `f-a-${code}`);
    try {
      expect((await reserveCoupon({ rawCode: code, orderId: oA, originalAgorot: 5900 })).ok).toBe(true);
      // A's lease expires but NO ONE reused the freed slot → capacity is still available.
      await prisma.couponRedemption.update({ where: { orderId: oA }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      // A pays late → confirm re-acquires the still-free slot and grants it.
      expect(await prisma.$transaction((tx) => confirmCouponForOrder(tx, oA))).toBe('reacquired');
      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(after.confirmedCount).toBe(1);
      expect(after.confirmedCount).toBeLessThanOrEqual(1);
      expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: oA } })).status).toBe('confirmed');
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [oA] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });
});
