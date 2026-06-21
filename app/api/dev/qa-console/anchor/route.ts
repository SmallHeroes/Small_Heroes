import { readFileSync, existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { loadQaAnchorCache, qaAnchorLocalPngPath } from '@/lib/qa-console-anchor';
import { isServerlessRuntime } from '@/lib/generation-pipeline/runtime-artifact-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const key = req.nextUrl.searchParams.get('key')?.trim();
  if (!key || !/^[a-z0-9_]+$/i.test(key)) {
    return NextResponse.json({ error: 'Invalid anchor key' }, { status: 400 });
  }

  const entry = await loadQaAnchorCache(key);
  if (!entry) {
    return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });
  }

  // Serverless: the /tmp PNG is gone across invocations — serve the durable Supabase image (0096 M5a).
  if (isServerlessRuntime() && entry.anchorUrl) {
    return NextResponse.redirect(entry.anchorUrl);
  }

  const pngPath = entry.localPath ?? qaAnchorLocalPngPath(key);
  if (existsSync(pngPath)) {
    const buf = readFileSync(pngPath);
    return new NextResponse(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }
  if (entry.anchorUrl) {
    return NextResponse.redirect(entry.anchorUrl);
  }
  return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });
}
