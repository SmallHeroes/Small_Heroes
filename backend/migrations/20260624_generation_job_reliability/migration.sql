-- Chunked generation reliability diagnostics (additive, idempotent). See chain-worker.ts +
-- sweeper.ts: make a silent self-chain failure DB-visible and bound infinite re-spend on a
-- stuck stage. All columns are nullable / defaulted, safe to apply before the code is live.

ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "staleReclaimCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "lastReclaimStage" TEXT;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "lastChainStatus" INTEGER;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "lastChainError" TEXT;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "lastWorkerKickAt" TIMESTAMP(3);
