-- P1-e2 B4 (simplification B): monotonic optimistic-concurrency token for delivery readiness.
-- Order.inputVersion is bumped by any writer of delivery inputs; the readiness manifest records the
-- value it evaluated, and the Order→ready commit + the pre-send recheck are conditional on it being
-- unchanged. Both default 0 (writer-side bumps wired in P1-f; the guard is inert until then).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "inputVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookReadinessManifest" ADD COLUMN "inputVersion" INTEGER NOT NULL DEFAULT 0;
