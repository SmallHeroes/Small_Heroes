-- (delivery fence — Codex round-5 P1) Carry the shared Order.deliveryFenceVersion explicitly into the delivery
-- Outbox row, so the send-time CAS can re-verify it (Order.deliveryFenceVersion === DeliveryOutbox.deliveryFenceVersion)
-- rather than relying only on the enqueue + `ready` flip having committed in the same transaction. Additive,
-- NOT NULL DEFAULT 0; existing rows backfill to 0. Sorts after 20260719_delivery_fence_version.

ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "deliveryFenceVersion" INTEGER NOT NULL DEFAULT 0;
