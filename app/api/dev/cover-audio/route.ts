import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCoverTitleAudio } from '@/backend/providers/audio';
import { isDevEnvironment } from '@/lib/dev-only-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dev-only: backfill the cover title-narration audio for an existing book.
 * POST { orderId, title, voiceId? }  (title passed explicitly so this works without a DB read)
 * Generates the fairy-voice MP3 (eleven_v3) via the page-audio path, persists to Supabase,
 * sets GeneratedBook.coverAudioUrl, and returns the URL.
 */
export async function POST(req: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { orderId?: string; title?: string; voiceId?: string };
  const orderId = body.orderId?.trim();
  const title = body.title?.trim();
  const voiceId = body.voiceId?.trim() || 'fairy';
  if (!orderId || !title) {
    return NextResponse.json({ error: 'orderId and title are required' }, { status: 400 });
  }

  let coverAudioUrl: string;
  try {
    ({ url: coverAudioUrl } = await generateCoverTitleAudio({ title, voiceId, orderId }));
  } catch (err) {
    return NextResponse.json({ error: `cover audio generation failed: ${(err as Error).message}` }, { status: 502 });
  }

  // Best-effort DB update (this runtime may not be on the book's DB; caller can also persist).
  let persisted = false;
  try {
    const book = await prisma.generatedBook.findUnique({ where: { orderId }, select: { id: true } });
    if (book) {
      await prisma.generatedBook.update({ where: { id: book.id }, data: { coverAudioUrl } });
      persisted = true;
    }
  } catch {
    /* DB not reachable from this runtime — caller persists coverAudioUrl */
  }

  return NextResponse.json({ ok: true, orderId, coverAudioUrl, persisted });
}
