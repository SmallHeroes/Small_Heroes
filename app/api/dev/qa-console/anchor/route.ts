import { readFileSync, existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { loadQaAnchorCache, qaAnchorLocalPngPath } from '@/lib/qa-console-anchor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const key = req.nextUrl.searchParams.get('key')?.trim();
  if (!key || !/^[a-z0-9_]+$/i.test(key)) {
    return NextResponse.json({ error: 'Invalid anchor key' }, { status: 400 });
  }

  const entry = loadQaAnchorCache(key);
  const pngPath = entry?.localPath ?? qaAnchorLocalPngPath(key);
  if (!existsSync(pngPath)) {
    return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });
  }

  const buf = readFileSync(pngPath);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
