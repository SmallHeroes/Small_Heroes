-- (render-loop Phase 1, 3c) PageUploadCandidate — a DISCOVERABLE record of a page's WINNER image bytes uploaded to
-- storage BEFORE QA runs, so a mid-QA crash leaves recoverable spend instead of an orphaned object the DB cannot find.
-- Carries NO safety signal (no detector fields, no content SHA) — the fail-closed safety signal + the delivered-bytes
-- binding stay owned by the post-QA ImageAsset write + the phase-2 SHA writer. Internal server-side table: RLS-enabled,
-- no client policy (service-role only), mirroring the other new backend tables. FK on orderId -> Order(id) Cascade.
-- Sorts AFTER 20260724 (latest in the canonical chain).

CREATE TABLE IF NOT EXISTS "PageUploadCandidate" (
  "id"         TEXT NOT NULL,
  "orderId"    TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "url"        TEXT NOT NULL,
  "rawUrl"     TEXT,
  "provider"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageUploadCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PageUploadCandidate_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PageUploadCandidate_orderId_pageNumber_key"
  ON "PageUploadCandidate" ("orderId", "pageNumber");
CREATE INDEX IF NOT EXISTS "PageUploadCandidate_orderId_idx"
  ON "PageUploadCandidate" ("orderId");

-- Internal server-side table. No anon/authenticated policy is created (service-role only).
ALTER TABLE "PageUploadCandidate" ENABLE ROW LEVEL SECURITY;
