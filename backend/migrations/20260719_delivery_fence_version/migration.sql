-- (delivery fence — Codex round-4 P0) Monotonic SHARED delivery-authority token on Order.
--
-- The defect it closes: under PostgreSQL READ COMMITTED, a readiness commit reads a clean order, a safety/payment
-- park then writes the hold WITHOUT bumping inputVersion, and readiness's `id + inputVersion` CAS still matches →
-- the hold is overwritten to `ready` and the book ships. Every book on the golden path traverses this.
--
-- The fix: EVERY hold write (safety/contract_world park, payment fence, readiness hard-hold) atomically increments
-- this column in the SAME write as the hold. The readiness commit reads it and binds the `ready` transition (and,
-- transitively via the same tx, the Outbox enqueue) to the observed value; a hold landing at ANY point during the
-- commit moves the fence, so the ready-CAS matches 0 rows and aborts instead of clobbering the hold.
--
-- Kept SEPARATE from inputVersion (which already drives readiness invalidation, receipt identity and the TOCTOU
-- retry loop — bumping THAT on every park would fire all three side effects and widen the blast radius). Additive,
-- NOT NULL DEFAULT 0; existing rows backfill to 0 (a fresh order has never been held).

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryFenceVersion" INTEGER NOT NULL DEFAULT 0;
