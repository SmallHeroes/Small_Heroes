-- Persist the exact immutable Visual Package selected at Order creation.
-- Additive + nullable for legacy story-bank Orders; application guards require it
-- for accepted-revision/package-backed Orders and never derive it from a mutable locator.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "visualPackageAuthority" JSONB;
