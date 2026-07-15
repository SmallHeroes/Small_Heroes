-- (Stage 1 safety FIX) Readiness-INDEPENDENT physical-safety signal, persisted ATOMICALLY with the asset so the
-- package/email delivery boundary enforces "an unsafe or unconfirmed-safe image never delivers" even when the
-- readiness manifest (READINESS_MANIFEST_ENABLED) is OFF. Fail-closed default: not-verified => blocked at delivery.
ALTER TABLE "ImageAsset" ADD COLUMN "safetyVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ImageAsset" ADD COLUMN "safetyHazards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- The cover is stored on GeneratedBook (not an ImageAsset), so it carries its own parallel safety signal.
ALTER TABLE "GeneratedBook" ADD COLUMN "coverSafetyVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GeneratedBook" ADD COLUMN "coverSafetyHazards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
