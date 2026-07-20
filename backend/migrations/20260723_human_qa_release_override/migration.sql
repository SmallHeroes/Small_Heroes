-- (Human-QA release, mechanism c-ii) Evidence-preserving safety override — BOTH gates read an override, NEITHER
-- deletes the detector's finding. Additive columns only:
--   • ImageAsset / GeneratedBook (cover): safety{ContentSha256, OverriddenHazards, OverrideSha256} — Gate 2
--     (resolveSafetyDeliveryGate, readiness-INDEPENDENT) binds an override to the exact bytes via
--     safetyOverrideSha256 == safetyContentSha256 (the latter co-written with safetyHazards). safetyHazards is NEVER
--     deleted; the override is a separate signal, reset on every safety-signal write.
--   • QualityEvidence: safetyOverride + safetyOverrideSha256 — Gate 1 (evaluateQualityGate) honors a release ONLY
--     when safetyOverride AND safetyOverrideSha256 (non-null) == the LIVE current-bytes hash; verdict/reason stay
--     IMMUTABLE. Cleared on every fresh evidence write.
-- Additive + inert until the release action writes them; a structural build guard fails if a safety-signal write
-- omits the co-written SHA or the override reset.

ALTER TABLE "ImageAsset"     ADD COLUMN IF NOT EXISTS "safetyContentSha256"     TEXT;
ALTER TABLE "ImageAsset"     ADD COLUMN IF NOT EXISTS "safetyOverriddenHazards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ImageAsset"     ADD COLUMN IF NOT EXISTS "safetyOverrideSha256"    TEXT;

ALTER TABLE "GeneratedBook"  ADD COLUMN IF NOT EXISTS "coverSafetyContentSha256"     TEXT;
ALTER TABLE "GeneratedBook"  ADD COLUMN IF NOT EXISTS "coverSafetyOverriddenHazards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GeneratedBook"  ADD COLUMN IF NOT EXISTS "coverSafetyOverrideSha256"    TEXT;

ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "safetyOverride"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QualityEvidence" ADD COLUMN IF NOT EXISTS "safetyOverrideSha256" TEXT;
