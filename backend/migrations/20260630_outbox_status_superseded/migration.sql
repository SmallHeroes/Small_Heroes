-- P1-f: add the `superseded` terminal status. The send-time CAS marks a row `superseded` when its binding no
-- longer holds (a newer manifest owns the order, or the order is no longer ready/passed). Distinct from
-- `suppressed` (the removed live-recheck drift path). Additive + idempotent.

ALTER TYPE "DeliveryOutboxStatus" ADD VALUE IF NOT EXISTS 'superseded';
