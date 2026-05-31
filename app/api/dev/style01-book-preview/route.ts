import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  auditionAssetUrl,
  listStyle01DiniAuditions,
  loadStyle01AuditionManifest,
  resolveAuditionPageImagePath,
} from '@/lib/style01-audition-preview';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { getCompanionById } from '@/lib/companions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORY_FILE = 'dragon_dini_fantasy.md';
const COMPANION_ID = 'dragon_dini';
const TOTAL_PAGES = 20;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev preview only' }, { status: 404 });
  }

  const dir = req.nextUrl.searchParams.get('dir')?.trim();
  const root = req.nextUrl.searchParams.get('root')?.trim() as
    | 'phase2-logs'
    | 'outputs'
    | undefined;

  if (!dir) {
    const auditions = await listStyle01DiniAuditions();
    return NextResponse.json({ auditions });
  }

  try {
    const { dirPath, manifest } = await loadStyle01AuditionManifest(dir, root);
    const companion = getCompanionById(COMPANION_ID);
    const childName = process.env.CHILD_NAME?.trim() || 'נועם';
    const childGender = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';

    const story = await loadStoryFromBank(
      pathJoinStory(STORY_FILE),
      childName,
      companion?.name ?? 'דיני',
      childGender,
      { maxPages: TOTAL_PAGES }
    );

    const renderedByPage = new Map(
      (manifest.pages ?? [])
        .filter((p) => !p.failed)
        .map((p) => [p.pageNumber, p] as const)
    );

    const pages = story.pages
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((storyPage) => {
        const rendered = renderedByPage.get(storyPage.pageNumber);
        const remote =
          rendered && typeof rendered.imageUrl === 'string' && rendered.imageUrl.trim()
            ? rendered.imageUrl.trim()
            : null;
        const hasLocal = rendered ? Boolean(resolveAuditionPageImagePath(dirPath, rendered)) : false;
        const imageUrl =
          remote ?? (hasLocal ? auditionAssetUrl(dir, storyPage.pageNumber) : null);
        const isRendered = Boolean(imageUrl);

        return {
          pageNumber: storyPage.pageNumber,
          text: storyPage.text,
          imageUrl: isRendered ? imageUrl : null,
          renderStatus: isRendered
            ? ('rendered' as const)
            : ('not rendered in this audition' as const),
        };
      });

    return NextResponse.json({
      id: manifest.orderId ?? dir,
      childName,
      storyDirection: 'fantasy',
      storyLength: 'long',
      book: {
        title: 'דיני — ביצת הגבול (Style 01 preview)',
        pages,
      },
      manifestMeta: {
        dir,
        root: root ?? 'auto',
        audition: manifest.audition,
        quality: manifest.quality,
        model: manifest.model,
        renderedPageNumbers: manifest.renderedPageNumbers ?? pages.filter((p) => p.renderStatus === 'rendered').map((p) => p.pageNumber),
        totalStoryPages: manifest.totalStoryPages ?? TOTAL_PAGES,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load manifest';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

function pathJoinStory(file: string): string {
  return path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', file);
}
