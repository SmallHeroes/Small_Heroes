-- Replace IllustrationStyle enum with three new values (pencil / realistic / whimsical).
-- Maps legacy enum labels to new ones, then swaps the enum type.

CREATE TYPE "IllustrationStyle_new" AS ENUM (
  'pencil_watercolor',
  'realistic_illustrated',
  'whimsical_comic_fantasy'
);

-- Order.illustrationStyle
ALTER TABLE "Order" ALTER COLUMN "illustrationStyle" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "illustrationStyle" TYPE "IllustrationStyle_new"
  USING (
    CASE "illustrationStyle"::text
      WHEN 'illustrative_classic' THEN 'pencil_watercolor'::"IllustrationStyle_new"
      WHEN 'realistic_cartoon' THEN 'realistic_illustrated'::"IllustrationStyle_new"
      WHEN 'clean_cartoon_2d' THEN 'whimsical_comic_fantasy'::"IllustrationStyle_new"
      WHEN 'soft_3d_animation' THEN 'whimsical_comic_fantasy'::"IllustrationStyle_new"
      ELSE 'pencil_watercolor'::"IllustrationStyle_new"
    END
  );

ALTER TABLE "Order"
  ALTER COLUMN "illustrationStyle" SET DEFAULT 'pencil_watercolor'::"IllustrationStyle_new";

-- StoryDirectionSet.selectedStyle
ALTER TABLE "StoryDirectionSet"
  ALTER COLUMN "selectedStyle" TYPE "IllustrationStyle_new"
  USING (
    CASE "selectedStyle"::text
      WHEN 'illustrative_classic' THEN 'pencil_watercolor'::"IllustrationStyle_new"
      WHEN 'realistic_cartoon' THEN 'realistic_illustrated'::"IllustrationStyle_new"
      WHEN 'clean_cartoon_2d' THEN 'whimsical_comic_fantasy'::"IllustrationStyle_new"
      WHEN 'soft_3d_animation' THEN 'whimsical_comic_fantasy'::"IllustrationStyle_new"
      ELSE 'pencil_watercolor'::"IllustrationStyle_new"
    END
  );

DROP TYPE "IllustrationStyle";

ALTER TYPE "IllustrationStyle_new" RENAME TO "IllustrationStyle";
