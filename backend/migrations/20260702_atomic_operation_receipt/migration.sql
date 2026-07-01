-- (pooler-fix / Codex B′) Durable idempotency receipt for the generation worker's post-render interactive
-- transactions (write-barrier, regen-reserve, readiness-commit). Under the Supavisor TRANSACTION pooler (6543)
-- a barrier tx can commit yet the caller still receives P2028 after the ~45-50s render gap. The receipt is
-- written in the SAME tx as the business mutation, keyed by a durable operationKey; a retry re-enters through
-- the fence (unique operationKey conflict → replay the RECORDED result, exactly-once; absent → run the mutation).
-- Additive only.
CREATE TABLE "AtomicOperationReceipt" (
  "id"           TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "orderId"      TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "payloadHash"  TEXT NOT NULL,
  "result"       JSONB NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AtomicOperationReceipt_pkey" PRIMARY KEY ("id")
);

-- The exactly-once fence: one receipt per durable operationKey. INSERT ... ON CONFLICT DO NOTHING keys off this.
CREATE UNIQUE INDEX "AtomicOperationReceipt_operationKey_key" ON "AtomicOperationReceipt" ("operationKey");
CREATE INDEX "AtomicOperationReceipt_orderId_idx" ON "AtomicOperationReceipt" ("orderId");

-- Cascade with the order (mirrors ExceptionCase/QualityEvidence).
ALTER TABLE "AtomicOperationReceipt"
  ADD CONSTRAINT "AtomicOperationReceipt_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Internal server-side table. No anon/authenticated policy is created (service-role only) — mirrors
-- ExceptionCase/QualityEvidence/ReissueBudget. Supabase requires RLS on exposed public tables; without it the
-- table is open to client CRUD, which for an exactly-once delivery fence would be an integrity hole.
ALTER TABLE "AtomicOperationReceipt" ENABLE ROW LEVEL SECURITY;
