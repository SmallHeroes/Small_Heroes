-- Launch promo code: one shared code, whole-percent discount, hard-capped redemptions.
-- RESERVE-AT-CHECKOUT (lease) model: a redemption is RESERVED (slot held with a TTL via
-- expiresAt) when the discounted sale is created, and CONFIRMED inside the exactly-once
-- payment-success transaction. Expired 'reserved' rows are free capacity, so abandoned
-- carts never burn the cap. The cap invariant is enforced under a Coupon-row FOR UPDATE
-- lock at reserve time, so confirmedCount can never exceed maxRedemptions.

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('reserved', 'confirmed', 'released');

-- AlterTable — Order coupon snapshot columns (nullable; most orders carry none)
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponDiscountPercent" INTEGER,
ADD COLUMN     "couponDiscountAgorot" INTEGER;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "maxRedemptions" INTEGER NOT NULL,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'reserved',
    "discountPercent" INTEGER NOT NULL,
    "discountAgorot" INTEGER NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_expiresAt_idx" ON "CouponRedemption"("couponId", "status", "expiresAt");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Repo conventions (not emitted by `prisma migrate`; appended by hand) ─────────────────

-- Internal, service-role-only tables (mirror RefundAttempt / ExceptionCase): enable RLS with
-- NO anon/authenticated policy, so Supabase does not expose them to client CRUD. All coupon
-- reads/writes go through the server (service role), never the browser.
ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CouponRedemption" ENABLE ROW LEVEL SECURITY;

-- Seed the launch code, INACTIVE. The owner flips `active` = true (and can adjust
-- discountPercent / maxRedemptions) to enable it live. ON CONFLICT keeps re-application safe.
INSERT INTO "Coupon" ("id", "code", "discountPercent", "maxRedemptions", "confirmedCount", "active", "updatedAt")
VALUES ('coupon_first100', 'FIRST100', 25, 100, 0, false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
