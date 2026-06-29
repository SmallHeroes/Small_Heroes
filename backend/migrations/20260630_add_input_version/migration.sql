-- P1-e2 B4 (simplification B): monotonic optimistic-concurrency token for delivery readiness.
-- Order.inputVersion is bumped by any writer of delivery inputs; the readiness manifest records the
-- value it evaluated, and the Order→ready commit + the pre-send recheck are conditional on it being
-- unchanged. Both default 0 (writer-side bumps wired in P1-f; the guard is inert until then).

-- AlterTable (idempotent + additive, matching 20260629_base_book_integrity — safe on a db-push'd staging)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inputVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookReadinessManifest" ADD COLUMN IF NOT EXISTS "inputVersion" INTEGER NOT NULL DEFAULT 0;
