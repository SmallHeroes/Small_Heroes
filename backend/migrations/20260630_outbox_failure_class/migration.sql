-- P1-e4-2: durable failure classification on the delivery Outbox. Distinguishes a terminal `failed` row that
-- never attempted a provider send (recheck_exhausted → safe to roll to a fresh fulfillment) from one whose send
-- result is unknown (send_ambiguous → must NOT auto-roll: a new fulfillmentVersion mints a new idempotency key
-- and bypasses Resend's 24h dedup → duplicate email). Additive + idempotent.

ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "failureClass" TEXT;
