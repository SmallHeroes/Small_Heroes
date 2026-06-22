import { NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { devViewerUrlForEntry, listDevViewerLibrary } from '@/lib/dev-viewer-library';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger({ subsystem: 'dev-viewer-library', route: '/api/dev/viewer/library' });

export async function GET() {
  if (!isDevEnvironment()) return devOnlyJsonError();

  try {
    const entries = await listDevViewerLibrary();
    return NextResponse.json({
      entries: entries.map((e) => ({
        ...e,
        viewerUrl: devViewerUrlForEntry(e),
      })),
    });
  } catch (err) {
    // listDevViewerLibrary already isolates each source; this is a last-resort guard so the endpoint
    // logs the real stack instead of returning an opaque 500 (the previous failure mode on staging).
    logger.error('GET /api/dev/viewer/library failed', err);
    return NextResponse.json({ error: 'library_failed', entries: [] }, { status: 500 });
  }
}
