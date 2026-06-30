-- P1-f #3h-E: count possible provider sends separately from the lease/rebind fencing token.
-- `attempts` remains the monotonically increasing claim version. `sendAttempts` is incremented
-- atomically by the send-time CAS immediately before the provider call and drives retry policy.
ALTER TABLE "DeliveryOutbox"
  ADD COLUMN IF NOT EXISTS "sendAttempts" INTEGER NOT NULL DEFAULT 0;
