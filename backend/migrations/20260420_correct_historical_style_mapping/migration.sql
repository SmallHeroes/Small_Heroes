-- Correct historical style meaning for orders created before enum alignment.
-- Scope is intentionally bounded by a cutoff timestamp (first known post-migration order).
-- This avoids touching newly created orders that already use new enum values directly.
UPDATE "Order"
SET "illustrationStyle" = 'illustrative_classic'
WHERE "createdAt" < TIMESTAMPTZ '2026-04-20T13:48:39.829Z'
  AND "illustrationStyle" = 'clean_cartoon_2d';

UPDATE "Order"
SET "illustrationStyle" = 'soft_3d_animation'
WHERE "createdAt" < TIMESTAMPTZ '2026-04-20T13:48:39.829Z'
  AND "illustrationStyle" = 'realistic_cartoon';
