-- Anchor delivery hold: low-confidence child anchors render for internal QA but are
-- held from customer delivery (no book-ready email, not customer-deliverable) until a
-- human releases them. See lib/anchor-resemblance-gate.ts + chunk-runner Stage 0.

-- New terminal-ish order status for held-but-rendered books.
-- ALTER TYPE ... ADD VALUE cannot run inside a txn on older PG; Supabase (PG15+) is fine.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'needs_human_qa';

-- Why the order was held (e.g. "anchor_low_confidence:hard_band"). Nullable/additive.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryHoldReason" TEXT;
