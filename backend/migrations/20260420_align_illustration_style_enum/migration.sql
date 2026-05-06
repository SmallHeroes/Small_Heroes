-- Align legacy DB enum labels with current runtime style IDs.
-- Safe to run multiple times (guards each rename with existence checks).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'classic'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'illustrative_classic'
  ) THEN
    ALTER TYPE "IllustrationStyle" RENAME VALUE 'classic' TO 'illustrative_classic';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'soft'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'clean_cartoon_2d'
  ) THEN
    ALTER TYPE "IllustrationStyle" RENAME VALUE 'soft' TO 'clean_cartoon_2d';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'disney'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'soft_3d_animation'
  ) THEN
    ALTER TYPE "IllustrationStyle" RENAME VALUE 'disney' TO 'soft_3d_animation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'watercolor'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IllustrationStyle' AND e.enumlabel = 'realistic_cartoon'
  ) THEN
    ALTER TYPE "IllustrationStyle" RENAME VALUE 'watercolor' TO 'realistic_cartoon';
  END IF;
END $$;
