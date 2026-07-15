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
 *   G. An expired hold canNOT steal a NEWER active (in-lease) holder's slot when it pays late —
 *      the lease guarantee holds (the active holder keeps its slot).
 *   H. Overlapping payment-success paths canNOT demote a paid_late_over_cap fence (needs_human_qa)
 *      back to 'paid' — the conditional paid-transition matches 0 rows once the order is fenced.
 *   I. (LB#1b) SAME-ORDER concurrent checkout: exactly ONE attempt claims the order (the CAS), and a losing
 *      attempt's release can NEVER free the winner's hold (token-bound) — so the winner's payment still
 *      confirms and the counter matches REALITY, not just its own bound.
 *   J. (LB#1b) A couponed PAID order whose confirm no-ops is FENCED (needs_human_qa) — a discounted paid
 *      order may never proceed while occupying no slot. An uncouponed order still no-ops cleanly.
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

  it('G. an expired hold cannot steal a newer active holder\'s slot when it pays late (Codex re-gate)', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder } = await import('@/lib/coupon/coupon-service');

    const code = `CAPG_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const oA = await makeOrder(prisma, `g-a-${code}`); // old holder
    const oB = await makeOrder(prisma, `g-b-${code}`); // newer, in-lease holder
    try {
      // A reserves the single slot, then A's lease EXPIRES (its slot is freed).
      expect((await reserveCoupon({ rawCode: code, orderId: oA, originalAgorot: 5900 })).ok).toBe(true);
      await prisma.couponRedemption.update({ where: { orderId: oA }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      // B reserves the freed slot and is ACTIVE (unexpired, in-lease).
      expect((await reserveCoupon({ rawCode: code, orderId: oB, originalAgorot: 5900 })).ok).toBe(true);

      // A pays LATE. Its expired hold must NOT steal B's active slot → paid_late_over_cap.
      const aOutcome = await prisma.$transaction((tx) => confirmCouponForOrder(tx, oA));
      expect(aOutcome).toBe('paid_late_over_cap');
      expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: oA } })).status).toBe('released');
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(0);

      // B pays in-window → B KEEPS its slot and is confirmed (the lease guarantee held).
      const bOutcome = await prisma.$transaction((tx) => confirmCouponForOrder(tx, oB));
      expect(bOutcome).toBe('confirmed');
      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(after.confirmedCount).toBe(1);
      expect(after.confirmedCount).toBeLessThanOrEqual(1);
      expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: oB } })).status).toBe('confirmed');
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [oA, oB] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  it('H. overlapping success paths cannot demote a paid_late_over_cap fence back to paid (Codex re-gate)', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, confirmCouponForOrder } = await import('@/lib/coupon/coupon-service');

    const PRE_PAID = ['draft', 'pending_payment', 'failed'] as const;
    const code = `CAPH_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 25, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const oA = await makeOrder(prisma, `h-a-${code}`); // late-paying expired holder
    const oB = await makeOrder(prisma, `h-b-${code}`); // in-window holder that fills the single slot
    try {
      // A reserves + expires; B reserves + confirms → cap is FULL. A's late payment is paid_late_over_cap.
      expect((await reserveCoupon({ rawCode: code, orderId: oA, originalAgorot: 5900 })).ok).toBe(true);
      await prisma.couponRedemption.update({ where: { orderId: oA }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      expect((await reserveCoupon({ rawCode: code, orderId: oB, originalAgorot: 5900 })).ok).toBe(true);
      expect(await prisma.$transaction((tx) => confirmCouponForOrder(tx, oB))).toBe('confirmed');
      await prisma.order.update({ where: { id: oA }, data: { status: 'pending_payment' } }); // awaiting late payment

      // Two OVERLAPPING payment-success paths for A's late payment, concurrently. Each mimics a route
      // handler: CONDITIONAL paid-transition → confirm → (paid_late_over_cap ⇒ fence needs_human_qa).
      // The Order row lock serializes them; whichever wins fences A, and the other's conditional matches
      // 0 rows (READ COMMITTED re-checks the WHERE). The fence MUST survive either interleaving.
      const successPath = () =>
        prisma.$transaction(async (tx) => {
          const t = await tx.order.updateMany({
            where: { id: oA, status: { in: [...PRE_PAID] } },
            data: { status: 'paid', paymentProvider: 'payme', paymentId: 'late', stripePaid: false },
          });
          if (t.count === 0) return 'skipped';
          const outcome = await confirmCouponForOrder(tx, oA);
          if (outcome === 'paid_late_over_cap') {
            await tx.order.update({
              where: { id: oA },
              data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: 'coupon_paid_late_over_cap' },
            });
          }
          return outcome;
        });

      const results = (await Promise.all([successPath(), successPath()])).sort();
      // Exactly one path claimed + fenced; the other's conditional matched 0 rows (no demotion).
      expect(results).toEqual(['paid_late_over_cap', 'skipped']);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: oA } })).status).toBe('needs_human_qa'); // never demoted
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).confirmedCount).toBe(1); // B only
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: { in: [oA, oB] } } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  /**
   * I. (LB#1b) THE SAME-ORDER CHECKOUT RACE — the Codex NO-GO on 02074a23.
   *
   * Two concurrent /api/checkout on ONE order both read draft/pending_payment before either claimed it, so
   * both proceeded: the second REUSED the first's order-keyed hold (one slot, but TWO discounted PayMe sales),
   * and when either attempt failed it released that SHARED hold by orderId — so the other's payment-success
   * confirm saw 'released' → 'noop' and a genuinely PAID discounted order never incremented confirmedCount.
   * The global guarantee is "≤ N discounted PAID sales", which is NOT the same statement as
   * "confirmedCount ≤ N" — the old code could satisfy the second while violating the first.
   *
   * Only real Postgres can prove the fix: the CAS relies on row-level locking + READ COMMITTED re-evaluation
   * (the loser re-reads the winner's committed row and matches 0). A mock cannot prove that.
   */
  it('I. same-order concurrent checkout: exactly ONE attempt claims; a loser can never release the winner’s hold', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { reserveCoupon, releaseCouponForOrder, confirmCouponForOrder, couponConfirmGranted } =
      await import('@/lib/coupon/coupon-service');

    const code = `CAPI_${Date.now()}`.toUpperCase();
    const coupon = await prisma.coupon.create({
      data: { code, discountPercent: 50, maxRedemptions: 1, active: true },
      select: { id: true },
    });
    const orderId = await makeOrder(prisma, `i-${code}`);
    const TTL_MS = 2 * 60_000; // must mirror CHECKOUT_ATTEMPT_TTL_MS in /api/checkout

    /** The checkout-attempt CAS, exactly as /api/checkout runs it. */
    const claim = (token: string) =>
      prisma.order.updateMany({
        where: {
          id: orderId,
          status: { in: ['draft', 'pending_payment'] },
          OR: [
            { checkoutAttemptToken: null },
            { checkoutAttemptAt: null },
            { checkoutAttemptAt: { lt: new Date(Date.now() - TTL_MS) } },
          ],
        },
        data: { checkoutAttemptToken: token, checkoutAttemptAt: new Date() },
      });

    try {
      // ── 1. TWO CONCURRENT ATTEMPTS ON ONE ORDER → exactly one may proceed ──────────────────────
      const [a, b] = await Promise.all([claim('attempt-A'), claim('attempt-B')]);
      const winners = [a, b].filter((r) => r.count === 1);
      const losers = [a, b].filter((r) => r.count === 0);
      expect(winners).toHaveLength(1); // ← the fix: the second attempt CANNOT proceed to reserve/charge
      expect(losers).toHaveLength(1);

      const owner = (await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { checkoutAttemptToken: true },
      })).checkoutAttemptToken!;
      const loserToken = owner === 'attempt-A' ? 'attempt-B' : 'attempt-A';

      // ── 2. Only the WINNER reserves (the loser was rejected before reserving) ─────────────────
      const reservation = await reserveCoupon({
        rawCode: code,
        orderId,
        originalAgorot: 5900,
        attemptToken: owner,
      });
      expect(reservation.ok).toBe(true);
      if (reservation.ok) expect(reservation.discountedAgorot).toBe(2950); // 50% of ₪59

      // ── 3. TOKEN-BOUND RELEASE: the loser's failure path must NOT free the winner's hold ──────
      await releaseCouponForOrder(prisma, orderId, loserToken);
      const afterLoserRelease = await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId } });
      expect(afterLoserRelease.status).toBe('reserved'); // ← the old orderId-wide release freed this
      expect(afterLoserRelease.attemptToken).toBe(owner);

      // ── 4. The winner pays → the confirm GRANTS (it would have no-op'd if the loser had freed it) ──
      const outcome = await prisma.$transaction((tx) => confirmCouponForOrder(tx, orderId));
      expect(couponConfirmGranted(outcome)).toBe(true);
      expect(outcome).toBe('confirmed');

      const fresh = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(fresh.confirmedCount).toBe(1);
      expect(fresh.confirmedCount).toBeLessThanOrEqual(1);

      // ── 5. THE REAL INVARIANT: every PAID + couponed order either holds a confirmed slot or is FENCED.
      // "≤ N discounted PAID sales" — not merely "confirmedCount ≤ N".
      const confirmedSlots = await prisma.couponRedemption.count({ where: { code, status: 'confirmed' } });
      expect(confirmedSlots).toBeLessThanOrEqual(1);
      expect(confirmedSlots).toBe(fresh.confirmedCount); // the counter matches reality, not just its own bound

      // ── 6. And the winner's own release still works (it owns the hold) — but only pre-confirm.
      await releaseCouponForOrder(prisma, orderId, owner);
      expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId } })).status).toBe('confirmed');
    } finally {
      await prisma.couponRedemption.deleteMany({ where: { code } });
      await prisma.order.deleteMany({ where: { id: orderId } });
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {});
    }
  });

  /**
   * J. (LB#1b) FAIL-CLOSED: a PAID order carrying a coupon SNAPSHOT whose confirm returns 'noop' was charged a
   * discounted amount while occupying NO slot — exactly the state the race used to produce. It must be fenced,
   * never allowed to continue silently. An order with no snapshot legitimately no-ops.
   */
  it('J. a couponed PAID order whose confirm no-ops is FENCED (needs_human_qa); an uncouponed one is not', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { confirmCouponForOrder, couponConfirmFenceReason } = await import('@/lib/coupon/coupon-service');

    const code = `CAPJ_${Date.now()}`.toUpperCase();
    const couponed = await makeOrder(prisma, `j-couponed-${code}`);
    const plain = await makeOrder(prisma, `j-plain-${code}`);

    try {
      // A discounted PAID order with NO live reservation (its hold was released out from under it).
      await prisma.order.update({
        where: { id: couponed },
        data: { status: 'paid', couponCode: code, couponDiscountPercent: 50, couponDiscountAgorot: 2950, totalPrice: 2950 },
      });
      const couponedResult = await prisma.$transaction(async (tx) => {
        const outcome = await confirmCouponForOrder(tx, couponed);
        return { outcome, reason: await couponConfirmFenceReason(tx, couponed, outcome) };
      });
      expect(couponedResult.outcome).toBe('noop');
      expect(couponedResult.reason).toBe('coupon_confirm_noop_uncounted'); // ← fenced, not silently continued

      // A normal full-price order legitimately no-ops — nothing was discounted, so nothing to count.
      await prisma.order.update({ where: { id: plain }, data: { status: 'paid' } });
      const plainResult = await prisma.$transaction(async (tx) => {
        const outcome = await confirmCouponForOrder(tx, plain);
        return { outcome, reason: await couponConfirmFenceReason(tx, plain, outcome) };
      });
      expect(plainResult.outcome).toBe('noop');
      expect(plainResult.reason).toBeNull(); // ← no false fence on the ordinary path
    } finally {
      await prisma.order.deleteMany({ where: { id: { in: [couponed, plain] } } });
    }
  });
});
