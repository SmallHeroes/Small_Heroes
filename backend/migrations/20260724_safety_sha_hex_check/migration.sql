-- (Human-QA release, mechanism c-ii — Unit 0 / P0) Constrain the safety SHA columns at the DATABASE layer.
-- 20260723 added them as unconstrained nullable TEXT. These are the last line of defense before an unsafe image
-- ships; a column that can hold '' / uppercase / wrong-length / non-hex garbage is its own defect, so the predicate
-- (isSafetyHazardOverridden) validating the shape is not enough. Each column must be NULL or a lowercase 64-hex
-- SHA-256 — exactly what createHash('sha256').digest('hex') emits, and what the predicate's regex accepts.
--
-- Corrective + additive only: the applied 20260723 migration is NOT edited. Idempotent via the duplicate_object
-- guard (Postgres has no ADD CONSTRAINT IF NOT EXISTS). NOT VALID is deliberately NOT used — the columns are inert
-- (no rows carry a value yet), so the constraint validates instantly and protects every future write.

DO $$
BEGIN
  ALTER TABLE "ImageAsset"
    ADD CONSTRAINT "ImageAsset_safetyContentSha256_hex_chk"
    CHECK ("safetyContentSha256" IS NULL OR "safetyContentSha256" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ImageAsset"
    ADD CONSTRAINT "ImageAsset_safetyOverrideSha256_hex_chk"
    CHECK ("safetyOverrideSha256" IS NULL OR "safetyOverrideSha256" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "GeneratedBook"
    ADD CONSTRAINT "GeneratedBook_coverSafetyContentSha256_hex_chk"
    CHECK ("coverSafetyContentSha256" IS NULL OR "coverSafetyContentSha256" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "GeneratedBook"
    ADD CONSTRAINT "GeneratedBook_coverSafetyOverrideSha256_hex_chk"
    CHECK ("coverSafetyOverrideSha256" IS NULL OR "coverSafetyOverrideSha256" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "QualityEvidence"
    ADD CONSTRAINT "QualityEvidence_safetyOverrideSha256_hex_chk"
    CHECK ("safetyOverrideSha256" IS NULL OR "safetyOverrideSha256" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
