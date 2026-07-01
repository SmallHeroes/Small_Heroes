-- #7-a Quality gate fail-closed: durable per-artifact visual-QA evidence.
-- Additive only. One row per REQUIRED delivered artifact (cover + every page). The readiness commit reads
-- these fail-closed; a `failed`/`evidence_unknown`/missing/stale row blocks delivery (no Outbox).
CREATE TABLE "QualityEvidence" (
  "id"                       TEXT NOT NULL,
  "orderId"                  TEXT NOT NULL,
  "artifactKey"              TEXT NOT NULL,
  "assetSha256"              TEXT NOT NULL,
  "verdict"                  TEXT NOT NULL,
  "evaluatorContractVersion" TEXT NOT NULL,
  "reason"                   TEXT,
  "regenCount"               INTEGER NOT NULL DEFAULT 0,
  "providerModel"            TEXT,
  "evidence"                 JSONB,
  "evaluatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QualityEvidence_pkey" PRIMARY KEY ("id"),
  -- Anti-bypass: an unknown verdict string is inadmissible; the code treats non-'passed' as BLOCK regardless.
  CONSTRAINT "QualityEvidence_verdict_check" CHECK ("verdict" IN ('passed', 'failed', 'evidence_unknown'))
);

-- One authoritative row per (order, artifact); the render/persist seam upserts on this key.
CREATE UNIQUE INDEX "QualityEvidence_orderId_artifactKey_key" ON "QualityEvidence" ("orderId", "artifactKey");
CREATE INDEX "QualityEvidence_orderId_idx" ON "QualityEvidence" ("orderId");

-- Cascade with the order (mirrors ExceptionCase).
ALTER TABLE "QualityEvidence"
  ADD CONSTRAINT "QualityEvidence_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Internal server-side table. No anon/authenticated policy is created (service-role only) — mirrors
-- ExceptionCase/ReissueBudget. Supabase requires RLS on exposed public tables; without it the table is open
-- to client CRUD (which for a delivery gate would be an anti-bypass hole).
ALTER TABLE "QualityEvidence" ENABLE ROW LEVEL SECURITY;
