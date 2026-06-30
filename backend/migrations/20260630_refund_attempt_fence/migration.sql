-- #6-FIX-3: durable exactly-once refund fence (PayMe). Created (status 'requested') BEFORE refund-sale is called,
-- keyed on the stable refundKey, so a response-loss + restart never issues a second provider refund.
CREATE TABLE "RefundAttempt" (
  "id"               TEXT NOT NULL,
  "refundKey"        TEXT NOT NULL,
  "provider"         TEXT NOT NULL,
  "providerSaleId"   TEXT NOT NULL,
  "status"           TEXT NOT NULL,
  "providerActionId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefundAttempt_refundKey_key" ON "RefundAttempt" ("refundKey");

-- (#6 FIX-4c) Internal server-side table. No anon/authenticated policy is created (service-role only) — mirrors
-- ExceptionCase. Supabase requires RLS on exposed public tables; without it the table is open to client CRUD.
ALTER TABLE "RefundAttempt" ENABLE ROW LEVEL SECURITY;
