-- #43 launch manual-review release gate: a durable, launch-wide hold plus per-page / per-cover human
-- review state bound to the rendered asset VERSION. The release endpoint + distribution surfaces fail
-- CLOSED until the cover and every CURRENT page are approved. See lib/generation-pipeline/chunk-runner.ts
-- (package stage), app/api/admin/anchor-hold-release, and lib/manual-review-gate.ts.
-- Additive + idempotent. No data loss.

-- Per-item review state.
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Durable, launch-wide manual-review hold (independent of the experimental identity-vision flag), set at render.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- Per-page review state, bound to the rendered image VERSION (imageVersion bumps on every page-image write).
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "imageVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "approvedImageVersion" INTEGER;
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "BookPage" ADD COLUMN IF NOT EXISTS "reviewDecisionReason" TEXT;

-- Per-cover review state on the book (cover is a plain URL; bind to a cover image VERSION).
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverImageVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "approvedCoverImageVersion" INTEGER;
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverReviewedBy" TEXT;
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverReviewedAt" TIMESTAMP(3);
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverReviewDecisionReason" TEXT;

-- Backfill: existing held orders require manual review (pages/cover default to 'pending' via the column
-- defaults above, so the release endpoint will fail closed until a human approves them).
UPDATE "Order" SET "manualReviewRequired" = true WHERE "status" = 'needs_human_qa';
