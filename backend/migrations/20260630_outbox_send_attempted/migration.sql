-- P1-e4 review C: durable "a provider send was ever attempted on this Outbox row". A row lives across
-- attempts; without this, a recheck-exhaustion AFTER a prior ambiguous send is mis-classified as
-- `recheck_exhausted` (roll-safe) and enqueue would roll into a new idempotency key → duplicate email.
-- Additive + idempotent.

ALTER TABLE "DeliveryOutbox" ADD COLUMN IF NOT EXISTS "sendAttempted" BOOLEAN NOT NULL DEFAULT false;
