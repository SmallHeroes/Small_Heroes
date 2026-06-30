-- P1-f: bind every Outbox row to the manifest + inputVersion it was enqueued under, so the send-time CAS can
-- verify (BookReadiness.currentManifestId === manifestId AND Order.inputVersion === inputVersion) atomically and
-- a NEW manifest never adopts an existing row. Nullable for additive migration safety; enqueueDelivery always
-- sets them. Additive + idempotent.

ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "manifestId" TEXT;
ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "inputVersion" INTEGER;
