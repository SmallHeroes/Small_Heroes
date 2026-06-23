-- Cover title-narration audio (fairy voice reads the book title) on the generated book.
ALTER TABLE "GeneratedBook" ADD COLUMN IF NOT EXISTS "coverAudioUrl" TEXT;
