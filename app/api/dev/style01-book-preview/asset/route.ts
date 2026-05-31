import { readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import {
  loadStyle01AuditionManifest,
  resolveAuditionPageImagePath,
} from '@/lib/style01-audition-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  const dir = req.nextUrl.searchParams.get('dir')?.trim();
  const root = req.nextUrl.searchParams.get('root')?.trim() as
    | 'phase2-logs'
    | 'outputs'
    | undefined;
  const pageRaw = req.nextUrl.searchParams.get('page');
  const pageNumber = pageRaw ? Number.parseInt(pageRaw, 10) : NaN;

  if (!dir || !Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: 'dir and page required' }, { status: 400 });
  }

  try {
    const { dirPath, manifest } = await loadStyle01AuditionManifest(dir, root);
    const page = manifest.pages?.find((p) => p.pageNumber === pageNumber);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const filePath = resolveAuditionPageImagePath(dirPath, page);
    if (!filePath) {
      return NextResponse.json({ error: 'Image file missing' }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Asset read failed';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
