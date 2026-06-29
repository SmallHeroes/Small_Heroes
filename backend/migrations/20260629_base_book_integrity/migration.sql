-- Phase-1 base_book_integrity: an immutable readiness Manifest + a mutable readiness pointer + a
-- transactional delivery Outbox, plus FROZEN product-truth on Order (read-only inputs for the integrity
-- gate). All behind flag READINESS_MANIFEST_ENABLED (default OFF). Additive + idempotent. No data loss.

DO $$ BEGIN
  CREATE TYPE "ReadinessStatus" AS ENUM ('pending', 'passed', 'blocked', 'stale');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryOutboxStatus" AS ENUM ('scheduled', 'processing', 'sent', 'failed', 'suppressed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Frozen product-truth on Order (set at order-creation + text-finalization; never re-resolved at package).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expectedPageCount"    INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storySourceHash"      TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "selectionFilename"    TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "frozenProductVersion" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentVersion"   INTEGER NOT NULL DEFAULT 1;

-- Immutable per-evaluation Manifest (single terminal INSERT; evidence + status never mutated).
CREATE TABLE IF NOT EXISTS "BookReadinessManifest" (
  "id"         TEXT NOT NULL,
  "orderId"    TEXT NOT NULL,
  "scope"      TEXT NOT NULL,
  "revision"   INTEGER NOT NULL,
  "status"     "ReadinessStatus" NOT NULL,
  "inputsHash" TEXT NOT NULL,
  "evidence"   JSONB NOT NULL,
  "reason"     TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookReadinessManifest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookReadinessManifest_orderId_scope_revision_key"
  ON "BookReadinessManifest" ("orderId", "scope", "revision");
CREATE INDEX IF NOT EXISTS "BookReadinessManifest_orderId_scope_idx"
  ON "BookReadinessManifest" ("orderId", "scope");

-- Mutable pointer to the current readiness state per (order, scope).
CREATE TABLE IF NOT EXISTS "BookReadiness" (
  "id"                TEXT NOT NULL,
  "orderId"           TEXT NOT NULL,
  "scope"             TEXT NOT NULL,
  "status"            "ReadinessStatus" NOT NULL DEFAULT 'pending',
  "currentManifestId" TEXT,
  "reason"            TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookReadiness_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookReadiness_orderId_scope_key"
  ON "BookReadiness" ("orderId", "scope");

-- Transactional delivery outbox (effectively-once). enqueue != send; a worker drains it.
CREATE TABLE IF NOT EXISTS "DeliveryOutbox" (
  "id"                TEXT NOT NULL,
  "dedupeKey"         TEXT NOT NULL,
  "orderId"           TEXT NOT NULL,
  "scope"             TEXT NOT NULL,
  "status"            "DeliveryOutboxStatus" NOT NULL DEFAULT 'scheduled',
  "payload"           JSONB NOT NULL,
  "payloadHash"       TEXT NOT NULL,
  "attempts"          INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt"     TIMESTAMP(3),
  "leaseExpiresAt"    TIMESTAMP(3),
  "lastError"         TEXT,
  "providerMessageId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"            TIMESTAMP(3),
  CONSTRAINT "DeliveryOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryOutbox_dedupeKey_key"
  ON "DeliveryOutbox" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "DeliveryOutbox_status_nextAttemptAt_idx"
  ON "DeliveryOutbox" ("status", "nextAttemptAt");
