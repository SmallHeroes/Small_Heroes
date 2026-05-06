-- Add dedicated cover URL storage on both order and generated book.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
