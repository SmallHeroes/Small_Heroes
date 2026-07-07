/**
 * Coupon service — server-side launch promo code.
 *
 * RESERVE-AT-CHECKOUT (lease) model. PayMe locks the charge amount when the sale is
 * created, so we hold a redemption slot at that moment and confirm it on payment success:
 *
 *   validateCoupon()  — read-only preview for the "Apply" step (no slot held).
 *   reserveCoupon()   — at checkout, under a Coupon-row FOR UPDATE lock: check capacity
 *                       and RESERVE a slot (idempotent per order, TTL-bounded).
 *   confirmCoupon…()  — inside the exactly-once payment-success tx: RESERVED → CONFIRMED,
 *                       and bump the monotonic confirmedCount.
 *   releaseCoupon…()  — best-effort RESERVED → RELEASED on an explicit checkout/payment
 *                       failure (expiry is the backstop).
 *
 * Cap invariant (holds because reserve runs under the Coupon FOR UPDATE lock):
 *   confirmedCount + (# reserved & not expired) <= maxRedemptions
 * so confirmedCount never exceeds maxRedemptions, even under concurrent redemptions, and
 * expired/abandoned holds free their slot automatically.
 *
 * The price is ALWAYS computed server-side. The client sends only the coupon CODE — never a
 * price or amount.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeCouponDiscount, normalizeCouponCode } from './coupon-math';
import type { CouponFailureReason, CouponPricing } from './coupon-math';

// Re-export the pure helpers + types so existing importers of coupon-service keep working.
export { computeCouponDiscount, normalizeCouponCode };
export type { CouponFailureReason, CouponPricing };

/** How long a checkout hold is valid before it self-expires and frees the slot. */
export const COUPON_HOLD_TTL_MS = 45 * 60_000; // 45 minutes

export type CouponValidation =
  | ({ ok: true; code: string; available: boolean } & CouponPricing)
  | { ok: false; reason: CouponFailureReason };

export type CouponReservation =
  | ({ ok: true; code: string; reused: boolean } & CouponPricing)
  | { ok: false; reason: CouponFailureReason };

/**
 * Read-only validation for the pre-payment "Apply" step. Returns the server-computed
 * discounted total for DISPLAY. Availability here is informational — the authoritative
 * capacity gate is reserveCoupon() at checkout (a slot is not held here).
 */
export async function validateCoupon(
  rawCode: string,
  originalAgorot: number,
  now: Date = new Date()
): Promise<CouponValidation> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, reason: 'not_found' };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, reason: 'not_found' };
  if (!coupon.active) return { ok: false, reason: 'inactive' };

  const activeReserved = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, status: 'reserved', expiresAt: { gt: now } },
  });
  if (coupon.confirmedCount + activeReserved >= coupon.maxRedemptions) {
    return { ok: false, reason: 'maxed_out' };
  }

  const pricing = computeCouponDiscount(originalAgorot, coupon.discountPercent);
  return { ok: true, code, available: true, ...pricing };
}

/**
 * Reserve a redemption slot for an order at checkout. Runs in its own transaction and takes a
 * Coupon-row FOR UPDATE lock so the capacity check + reservation is atomic (reserves for one
 * coupon serialize — fine for a low-volume launch code). Idempotent per order: a still-valid
 * hold for the same order reuses its slot rather than taking a second.
 *
 * On success the caller must charge `discountedAgorot` (server truth). On failure the caller
 * must NOT apply any discount (fail the coupon cleanly and charge/show full price).
 */
export async function reserveCoupon(params: {
  rawCode: string;
  orderId: string;
  originalAgorot: number;
  now?: Date;
}): Promise<CouponReservation> {
  const code = normalizeCouponCode(params.rawCode);
  const now = params.now ?? new Date();
  if (!code) return { ok: false, reason: 'not_found' };

  return prisma.$transaction(async (tx) => {
    // Serialize all reservations for this coupon: the capacity check below and the reservation
    // insert are then atomic w.r.t. other reserves and confirms of the same coupon.
    const locked = await tx.$queryRaw<Array<{ id: string; discountPercent: number; maxRedemptions: number; confirmedCount: number; active: boolean }>>(
      Prisma.sql`SELECT "id", "discountPercent", "maxRedemptions", "confirmedCount", "active" FROM "Coupon" WHERE "code" = ${code} FOR UPDATE`
    );
    const coupon = locked[0];
    if (!coupon) return { ok: false, reason: 'not_found' as const };
    if (!coupon.active) return { ok: false, reason: 'inactive' as const };

    // Idempotent re-checkout: a still-valid hold (or an already-confirmed redemption) for THIS
    // order keeps its slot and its snapshotted discount — no second slot, no counter change.
    const existing = await tx.couponRedemption.findUnique({ where: { orderId: params.orderId } });
    if (existing && existing.status === 'confirmed') {
      const pricing = computeCouponDiscount(params.originalAgorot, existing.discountPercent);
      return { ok: true as const, code, reused: true, ...pricing };
    }
    if (existing && existing.status === 'reserved' && existing.expiresAt > now) {
      const pricing = computeCouponDiscount(params.originalAgorot, existing.discountPercent);
      return { ok: true as const, code, reused: true, ...pricing };
    }

    // Live usage = confirmed + OTHER orders' unexpired reservations. This order's own
    // stale/expired/released row is excluded, so re-reserving after expiry is allowed.
    const activeReserved = await tx.couponRedemption.count({
      where: {
        couponId: coupon.id,
        status: 'reserved',
        expiresAt: { gt: now },
        orderId: { not: params.orderId },
      },
    });
    if (coupon.confirmedCount + activeReserved >= coupon.maxRedemptions) {
      return { ok: false as const, reason: 'maxed_out' as const };
    }

    const pricing = computeCouponDiscount(params.originalAgorot, coupon.discountPercent);
    const expiresAt = new Date(now.getTime() + COUPON_HOLD_TTL_MS);
    await tx.couponRedemption.upsert({
      where: { orderId: params.orderId },
      create: {
        couponId: coupon.id,
        code,
        orderId: params.orderId,
        status: 'reserved',
        discountPercent: coupon.discountPercent,
        discountAgorot: pricing.discountAgorot,
        reservedAt: now,
        expiresAt,
      },
      update: {
        // re-reserve a previously expired/released hold for this same order
        couponId: coupon.id,
        code,
        status: 'reserved',
        discountPercent: coupon.discountPercent,
        discountAgorot: pricing.discountAgorot,
        reservedAt: now,
        expiresAt,
        confirmedAt: null,
        releasedAt: null,
      },
    });
    return { ok: true as const, code, reused: false, ...pricing };
  });
}

/**
 * Outcome of a payment-success confirm:
 *   'confirmed'          — an in-window hold was granted; confirmedCount incremented.
 *   'reacquired'         — an EXPIRED hold whose freed slot was still available was re-acquired and
 *                          granted; confirmedCount incremented.
 *   'noop'               — nothing to do (already confirmed/released/absent). Idempotent.
 *   'paid_late_over_cap' — the hold had EXPIRED and the cap was already FULL, so granting it would
 *                          exceed maxRedemptions. The discount is NOT granted (cap-safe); the hold
 *                          is released and the caller MUST route the paid order to the paid-late
 *                          exception (hold + refund / charge-full).
 */
export type CouponConfirmOutcome = 'confirmed' | 'reacquired' | 'noop' | 'paid_late_over_cap';

/** True iff the confirm granted a redemption (incremented confirmedCount). */
export function couponConfirmGranted(outcome: CouponConfirmOutcome): boolean {
  return outcome === 'confirmed' || outcome === 'reacquired';
}

/**
 * Confirm an order's reserved redemption on payment success. MUST be called inside the exactly-once
 * payment-success transaction (the caller's `tx`). Safe to call for every paid order — 'noop' when
 * there is no reserved redemption. Idempotent: a replay matches zero rows and does not double-count.
 *
 * CAP-SAFE: under the Coupon FOR UPDATE lock it re-checks the hold's expiry AND the SAME invariant
 * reserveCoupon enforces — confirmedCount + (active, unexpired reservations of OTHER orders) <
 * maxRedemptions — BEFORE incrementing. So confirmedCount can NEVER exceed maxRedemptions, and an
 * EXPIRED hold paying late can NEVER steal a slot that a confirmed redemption or a legit active
 * (in-lease) reservation of another order already occupies. An expired hold whose freed slot is
 * genuinely free is re-acquired ('reacquired'); otherwise the hold is released and reported as
 * 'paid_late_over_cap'.
 */
export async function confirmCouponForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date = new Date()
): Promise<CouponConfirmOutcome> {
  const redemption = await tx.couponRedemption.findUnique({
    where: { orderId },
    select: { couponId: true, status: true },
  });
  if (!redemption || redemption.status !== 'reserved') return 'noop';

  // Lock the Coupon row FIRST (same lock order as reserveCoupon: Coupon → redemption) and read the
  // authoritative counters under the lock. Reserves + confirms for this coupon serialize on it, so
  // the capacity check and this hold's status/expiry stay stable for the rest of the transaction.
  const locked = await tx.$queryRaw<Array<{ maxRedemptions: number; confirmedCount: number }>>(
    Prisma.sql`SELECT "maxRedemptions", "confirmedCount" FROM "Coupon" WHERE "id" = ${redemption.couponId} FOR UPDATE`
  );
  const coupon = locked[0];
  if (!coupon) return 'noop';

  // Re-read the hold under the lock (authoritative) and re-check its expiry.
  const held = await tx.couponRedemption.findUnique({
    where: { orderId },
    select: { status: true, expiresAt: true },
  });
  if (!held || held.status !== 'reserved') return 'noop';
  const expired = held.expiresAt <= now;

  // CAP-SAFE GUARD — apply the SAME invariant reserveCoupon enforces:
  //   confirmedCount + (active, unexpired reservations of OTHER orders) < maxRedemptions.
  // A NOT-expired hold always passes (it is itself counted in that invariant). An EXPIRED hold
  // passes ONLY if its freed slot is genuinely free — not already taken by a confirmed redemption
  // or a legit active (unexpired) reservation of another order. This stops an expired hold from
  // STEALING an in-lease holder's slot when it pays late (preserves the lease guarantee).
  const activeReservedExclSelf = await tx.couponRedemption.count({
    where: {
      couponId: redemption.couponId,
      status: 'reserved',
      expiresAt: { gt: now },
      orderId: { not: orderId },
    },
  });
  if (coupon.confirmedCount + activeReservedExclSelf >= coupon.maxRedemptions) {
    // No free slot (cap full, or an active holder occupies the freed slot) → do NOT grant / steal.
    // Release the hold and signal the paid-late exception; the caller fences the order (needs_human_qa).
    await tx.couponRedemption.updateMany({
      where: { orderId, status: 'reserved' },
      data: { status: 'released', releasedAt: now },
    });
    return 'paid_late_over_cap';
  }

  // Capacity is available → grant. Covers an in-window hold and an EXPIRED hold whose freed slot is
  // still free (re-acquire it). The updateMany count===1 keeps confirm idempotent under the lock.
  const moved = await tx.couponRedemption.updateMany({
    where: { orderId, status: 'reserved' },
    data: { status: 'confirmed', confirmedAt: now },
  });
  if (moved.count !== 1) return 'noop'; // lost the race to another confirm — do not double-count

  await tx.coupon.update({
    where: { id: redemption.couponId },
    data: { confirmedCount: { increment: 1 } },
  });
  return expired ? 'reacquired' : 'confirmed';
}

/**
 * Best-effort release of an order's reserved hold on an explicit checkout/payment failure, so
 * the slot frees immediately instead of waiting out the TTL. Never touches confirmedCount (the
 * hold was never confirmed). No-op for confirmed/released/absent redemptions.
 */
export async function releaseCouponForOrder(
  client: Prisma.TransactionClient | typeof prisma,
  orderId: string,
  now: Date = new Date()
): Promise<void> {
  await client.couponRedemption.updateMany({
    where: { orderId, status: 'reserved' },
    data: { status: 'released', releasedAt: now },
  });
}
