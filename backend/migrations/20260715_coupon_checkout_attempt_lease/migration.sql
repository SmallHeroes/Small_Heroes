-- LB#1b — close the same-order coupon checkout race (Codex NO-GO on 02074a23).
--
-- Two concurrent /api/checkout on ONE order both read draft/pending_payment before either claimed it, so both
-- reserved (the second REUSING the first's order-keyed hold) and both could create a PayMe sale. Worse: when one
-- attempt failed it released the SHARED hold by orderId, so the other's payment-success confirm then saw
-- 'released' → 'noop' → a genuinely PAID discounted order never incremented confirmedCount, breaking the global
-- "≤ 100 discounted PAID sales" guarantee (confirmedCount ≤ 100 is NOT the same statement).
--
-- Both columns are ADDITIVE + NULLABLE, so existing rows are untouched and no backfill is needed:
--   Order.checkoutAttemptToken/At  — the per-order checkout-attempt LEASE (the CAS owner + its TTL clock).
--   CouponRedemption.attemptToken  — the attempt that OWNS a hold, so release can be token-bound.
-- A NULL lease means "unclaimed" (the CAS claims it); a NULL attemptToken on a pre-existing hold simply cannot be
-- token-released early and falls back to its TTL — fail-safe, never fail-open.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "checkoutAttemptToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "checkoutAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CouponRedemption" ADD COLUMN "attemptToken" TEXT;
