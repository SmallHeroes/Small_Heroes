-- P1-f #3h: (a) firstSendAttemptAt — the 24h idempotency window is measured from the FIRST send attempt, not
-- createdAt (an order that sat 25h in the queue still gets its first attempt). (b) split the CAS-mismatch
-- terminal into superseded_by_manifest (a newer valid manifest owns the order — recoverable via rebind while
-- sendAttempted=false) vs delivery_revoked (held/cancelled/inputs_stale — explicit reconciliation only).
-- Additive + idempotent. ALTER TYPE ADD VALUE cannot run inside a txn block; each is its own statement.

ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "firstSendAttemptAt" TIMESTAMP(3);

ALTER TYPE "DeliveryOutboxStatus" ADD VALUE IF NOT EXISTS 'superseded_by_manifest';
ALTER TYPE "DeliveryOutboxStatus" ADD VALUE IF NOT EXISTS 'delivery_revoked';
