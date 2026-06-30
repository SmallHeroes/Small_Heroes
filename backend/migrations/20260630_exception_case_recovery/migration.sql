-- P1-f #6: durable autonomous recovery for terminal base-book delivery failures.
-- Additive and inert while READINESS_MANIFEST_ENABLED=false.

DO $$ BEGIN
  CREATE TYPE "ExceptionCaseKind" AS ENUM (
    'infra_transient',
    'unusable_photo',
    'text_personalization',
    'safety_failed',
    'quality_failed',
    'send_ambiguous',
    'delivery_revoked',
    'invalid_payload',
    'integrity_blocked'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ExceptionCaseStatus" AS ENUM (
    'open',
    'retry_scheduled',
    'customer_action',
    'refund_pending',
    'resolved',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ExceptionCase" (
  "id"                    TEXT NOT NULL,
  "activeKey"             TEXT,
  "orderId"               TEXT NOT NULL,
  "scope"                 TEXT NOT NULL,
  "kind"                  "ExceptionCaseKind" NOT NULL,
  "status"                "ExceptionCaseStatus" NOT NULL DEFAULT 'open',
  "reason"                TEXT NOT NULL,
  "attempts"              INTEGER NOT NULL DEFAULT 0,
  "nextActionAt"          TIMESTAMP(3),
  "resolution"            JSONB,
  "sourceRef"             TEXT,
  "claimVersion"          INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt"        TIMESTAMP(3),
  "lastError"             TEXT,
  "refundKey"             TEXT,
  "providerActionId"      TEXT,
  "actionAttemptedAt"     TIMESTAMP(3),
  "notificationMessageId" TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExceptionCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExceptionCase_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExceptionCase_activeKey_key"
  ON "ExceptionCase" ("activeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ExceptionCase_refundKey_key"
  ON "ExceptionCase" ("refundKey");
CREATE INDEX IF NOT EXISTS "ExceptionCase_status_nextActionAt_idx"
  ON "ExceptionCase" ("status", "nextActionAt");
CREATE INDEX IF NOT EXISTS "ExceptionCase_orderId_scope_idx"
  ON "ExceptionCase" ("orderId", "scope");

DO $$ BEGIN
  ALTER TABLE "ExceptionCase"
    ADD CONSTRAINT "ExceptionCase_active_key_lifecycle_check"
    CHECK (
      (
        "status" IN ('open', 'retry_scheduled', 'customer_action', 'refund_pending')
        AND "activeKey" = "orderId" || ':' || "scope"
      )
      OR
      (
        "status" IN ('resolved', 'cancelled')
        AND "activeKey" IS NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ExceptionCaseAudit" (
  "id"         TEXT NOT NULL,
  "eventKey"   TEXT NOT NULL,
  "caseId"     TEXT NOT NULL,
  "fromStatus" "ExceptionCaseStatus",
  "toStatus"   "ExceptionCaseStatus" NOT NULL,
  "actor"      TEXT NOT NULL DEFAULT 'system',
  "reason"     TEXT NOT NULL,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExceptionCaseAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExceptionCaseAudit_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "ExceptionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExceptionCaseAudit_eventKey_key"
  ON "ExceptionCaseAudit" ("eventKey");
CREATE INDEX IF NOT EXISTS "ExceptionCaseAudit_caseId_createdAt_idx"
  ON "ExceptionCaseAudit" ("caseId", "createdAt");

-- Internal server-side tables. No anon/authenticated policy is created.
ALTER TABLE "ExceptionCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExceptionCaseAudit" ENABLE ROW LEVEL SECURITY;
