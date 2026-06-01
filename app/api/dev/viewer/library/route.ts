import { NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { devViewerUrlForEntry, listDevViewerLibrary } from '@/lib/dev-viewer-library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const entries = await listDevViewerLibrary();
  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      viewerUrl: devViewerUrlForEntry(e),
    })),
  });
}
