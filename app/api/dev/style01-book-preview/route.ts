import { NextRequest, NextResponse } from 'next/server';
import {
  auditionAssetUrl,
  listStyle01DiniAuditions,
  loadStyle01AuditionManifest,
  resolveAuditionPageImagePath,
} from '@/lib/style01-audition-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev preview only' }, { status: 404 });
  }

  const dir = req.nextUrl.searchParams.get('dir')?.trim();

  if (!dir) {
    const auditions = await listStyle01DiniAuditions();
    return NextResponse.json({ auditions });
  }

  try {
    const { dirPath, manifest } = await loadStyle01AuditionManifest(dir);
    const pages = (manifest.pages ?? [])
      .filter((p) => !p.failed)
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => {
        const remote = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? p.imageUrl.trim() : null;
        const hasLocal = Boolean(resolveAuditionPageImagePath(dirPath, p));
        const imageUrl =
          remote ?? (hasLocal ? auditionAssetUrl(dir, p.pageNumber) : null);

        return {
          pageNumber: p.pageNumber,
          text: p.hebrewText ?? '',
          imageUrl,
        };
      });

    return NextResponse.json({
      id: manifest.orderId ?? dir,
      childName: 'נועם',
      storyDirection: 'fantasy',
      storyLength: 'long',
      book: {
        title: 'דיני — ספר מלא (Style 01 preview)',
        pages,
      },
      manifestMeta: {
        dir,
        audition: manifest.audition,
        quality: manifest.quality,
        pageCount: pages.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load manifest';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
