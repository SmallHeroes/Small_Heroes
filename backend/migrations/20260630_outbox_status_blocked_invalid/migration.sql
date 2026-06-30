-- P1-f #3h-D: recovery taxonomy. A CAS mismatch is never a business revocation — the worker may only write the
-- two RECOVERABLE terminals: delivery_blocked (order not-yet-deliverable; rebind-eligible on re-commit) and
-- superseded_by_manifest (already present). invalid_payload is a separate corrupt-row state (not a revocation).
-- delivery_revoked stays RESERVED for a future explicit cancellation/refund domain action (the CAS never writes it).
-- Additive + idempotent. ALTER TYPE ADD VALUE cannot run inside a txn block; each is its own statement.
ALTER TYPE "DeliveryOutboxStatus" ADD VALUE IF NOT EXISTS 'delivery_blocked';
ALTER TYPE "DeliveryOutboxStatus" ADD VALUE IF NOT EXISTS 'invalid_payload';
