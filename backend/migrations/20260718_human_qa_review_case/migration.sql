-- Human-QA hold lifecycle (Slice 1, Unit 1) — durable, superseding review case + operator-notification outbox.
-- Additive + inert; no code path writes these tables until later Slice-1 units wire the seams.
-- Mirrors the ExceptionCase/DeliveryOutbox shapes: `activeKey` = `${orderId}:${scope}` while a case is active
-- and NULL after a terminal transition; the lifecycle CHECK binds that invariant to `status` so the nullable
-- unique key enforces exactly one active case per order/scope even under concurrent producers. The evidence
-- snapshot columns (holdFingerprint/rawReason/inputVersion/contractHash/sourceManifestId/artifactRefs) are
-- immutable once written.

DO $$ BEGIN
  CREATE TYPE "HumanQaHoldKind" AS ENUM (
    'safety',
    'contract_world',
    'anchor',
    'payment_integrity',
    'legacy_unknown'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HumanQaReviewCaseStatus" AS ENUM (
    'open',
    'superseded',
    'resolved',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OperatorNotificationOutboxStatus" AS ENUM (
    'scheduled',
    'processing',
    'sent',
    'failed',
    'suppressed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "HumanQaReviewCase" (
  "id"                 TEXT NOT NULL,
  "activeKey"          TEXT,
  "orderId"            TEXT NOT NULL,
  "scope"              TEXT NOT NULL,
  "revision"           INTEGER NOT NULL,
  "kind"               "HumanQaHoldKind" NOT NULL,
  "status"             "HumanQaReviewCaseStatus" NOT NULL DEFAULT 'open',
  "holdFingerprint"    TEXT NOT NULL,
  "rawReason"          TEXT NOT NULL,
  "humanReason"        TEXT NOT NULL,
  "sourceManifestId"   TEXT,
  "inputVersion"       INTEGER NOT NULL,
  "contractHash"       TEXT,
  "artifactRefs"       JSONB,
  "heldAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededByCaseId" TEXT,
  "resolvedActor"      TEXT,
  "resolvedAt"         TIMESTAMP(3),
  "decisionNote"       TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanQaReviewCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HumanQaReviewCase_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "HumanQaReviewCase_activeKey_key"
  ON "HumanQaReviewCase" ("activeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "HumanQaReviewCase_orderId_scope_revision_key"
  ON "HumanQaReviewCase" ("orderId", "scope", "revision");
CREATE INDEX IF NOT EXISTS "HumanQaReviewCase_status_idx"
  ON "HumanQaReviewCase" ("status");
CREATE INDEX IF NOT EXISTS "HumanQaReviewCase_orderId_scope_idx"
  ON "HumanQaReviewCase" ("orderId", "scope");

DO $$ BEGIN
  ALTER TABLE "HumanQaReviewCase"
    ADD CONSTRAINT "HumanQaReviewCase_active_key_lifecycle_check"
    CHECK (
      ("status" = 'open' AND "activeKey" = "orderId" || ':' || "scope")
      OR ("status" IN ('superseded','resolved','cancelled') AND "activeKey" IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "OperatorNotificationOutbox" (
  "id"                 TEXT NOT NULL,
  "dedupeKey"          TEXT NOT NULL,
  "caseId"             TEXT NOT NULL,
  "orderId"            TEXT NOT NULL,
  "scope"              TEXT NOT NULL,
  "status"             "OperatorNotificationOutboxStatus" NOT NULL DEFAULT 'scheduled',
  "payload"            JSONB NOT NULL,
  "payloadHash"        TEXT NOT NULL,
  "claimVersion"       INTEGER NOT NULL DEFAULT 0,
  "sendAttempts"       INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt"      TIMESTAMP(3),
  "leaseExpiresAt"     TIMESTAMP(3),
  "lastError"          TEXT,
  "failureClass"       TEXT,
  "sendAttempted"      BOOLEAN NOT NULL DEFAULT false,
  "firstSendAttemptAt" TIMESTAMP(3),
  "providerMessageId"  TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"             TIMESTAMP(3),
  CONSTRAINT "OperatorNotificationOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperatorNotificationOutbox_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "HumanQaReviewCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperatorNotificationOutbox_dedupeKey_key"
  ON "OperatorNotificationOutbox" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "OperatorNotificationOutbox_status_nextAttemptAt_idx"
  ON "OperatorNotificationOutbox" ("status", "nextAttemptAt");

-- Internal server-side tables. No anon/authenticated policy is created.
ALTER TABLE "HumanQaReviewCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorNotificationOutbox" ENABLE ROW LEVEL SECURITY;
