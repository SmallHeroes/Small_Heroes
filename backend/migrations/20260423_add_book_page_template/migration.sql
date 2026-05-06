-- Store deterministic book page template assignment for reader/presentation rendering.
ALTER TABLE "BookPage"
ADD COLUMN "pageTemplate" TEXT;
