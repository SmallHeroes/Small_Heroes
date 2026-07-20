-- (Human-QA Slices 3+4) Durable operator-ACTION / audit record — ONE row per operator decision (re-render / release
-- / park) against a held book. Idempotent under the Idempotency-Key header (idempotencyKey UNIQUE; a same-key retry
-- replays the recorded outcome, a same-key/different-requestHash retry fails closed). Append-only audit: it snapshots
-- the observed hold marker / delivery fence / inputVersion at action time, the operator note (VERBATIM — additive
-- prompt guidance only, never a safety/contract input), and, for a safety RELEASE, the overridden hazards + written
-- reason + the exact delivered-bytes SHA the override binds to (readiness READS this record; nothing direct-sets
-- `ready`). Mirrors HumanQaReviewCase / OperatorNotificationOutbox: FK on caseId (Cascade), RLS-enabled, no client
-- policy. Sorts AFTER 20260718_human_qa_review_case (creates HumanQaReviewCase, the caseId FK target).

DO $$ BEGIN
  CREATE TYPE "OperatorActionKind" AS ENUM (
    'rerender',
    'release',
    'park'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OperatorActionStatus" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'aborted'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "HumanQaOperatorAction" (
  "id"                   TEXT NOT NULL,
  "idempotencyKey"       TEXT NOT NULL,
  "requestHash"          TEXT NOT NULL,
  "orderId"              TEXT NOT NULL,
  "caseId"               TEXT NOT NULL,
  "caseRevision"         INTEGER NOT NULL,
  "kind"                 "OperatorActionKind" NOT NULL,
  "status"               "OperatorActionStatus" NOT NULL DEFAULT 'pending',
  "actor"                TEXT NOT NULL,
  "note"                 TEXT,
  "targetArtifacts"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "observedMarker"       TEXT NOT NULL,
  "observedFence"        INTEGER NOT NULL,
  "observedInputVersion" INTEGER NOT NULL,
  "overriddenHazards"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "overrideReason"       TEXT,
  "assetSha256"          TEXT,
  "outcome"              JSONB,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanQaOperatorAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HumanQaOperatorAction_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "HumanQaReviewCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "HumanQaOperatorAction_idempotencyKey_key"
  ON "HumanQaOperatorAction" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "HumanQaOperatorAction_orderId_kind_idx"
  ON "HumanQaOperatorAction" ("orderId", "kind");
CREATE INDEX IF NOT EXISTS "HumanQaOperatorAction_caseId_createdAt_idx"
  ON "HumanQaOperatorAction" ("caseId", "createdAt");

-- Internal server-side table. No anon/authenticated policy is created (service-role only).
ALTER TABLE "HumanQaOperatorAction" ENABLE ROW LEVEL SECURITY;
