-- WS0 BookVisualContract vNext foundation (enforcement OFF). Additive + idempotent columns only.
-- Ordered AFTER the existing migrations (atomic-operation-receipt / quality-evidence). No backfill: existing
-- `needs_human_qa` rows are NOT marked manual-review (that would mask recovery/infra holds). Existing RLS is
-- untouched — no new tables, no policy changes.

-- Order: the frozen contract hash + the FALLBACK manual-review flag (auto-repair stays the primary path).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "visualContractHash"   TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- QualityEvidence: bind each row to the contract it was produced under, plus the manual-review decision fields.
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "contractHash"         TEXT;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewStatus"         TEXT;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewedAssetSha256"  TEXT;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewedContractHash" TEXT;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewedBy"           TEXT;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewedAt"           TIMESTAMP(3);
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "reviewReason"         TEXT;
