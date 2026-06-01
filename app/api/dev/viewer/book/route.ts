import { NextRequest, NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import {
  loadDevViewerAuditionBook,
  loadDevViewerOrderBook,
} from '@/lib/dev-viewer-book-load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const orderId = req.nextUrl.searchParams.get('orderId')?.trim();
  const dir = req.nextUrl.searchParams.get('dir')?.trim();
  const root = req.nextUrl.searchParams.get('root')?.trim() as
    | 'phase2-logs'
    | 'outputs'
    | undefined;

  try {
    if (orderId) {
      const payload = await loadDevViewerOrderBook(orderId);
      return NextResponse.json(payload);
    }
    if (dir) {
      const payload = await loadDevViewerAuditionBook(dir, root);
      return NextResponse.json(payload);
    }
    return NextResponse.json({ error: 'orderId or dir is required' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load book';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
