import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  auditionAssetUrl,
  listStyle01DiniAuditions,
  loadStyle01AuditionManifest,
  resolveAuditionPageAudioPath,
  resolveAuditionPageImagePath,
} from '@/lib/style01-audition-preview';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { getCompanionById } from '@/lib/companions';
import { storyBankRoot } from '@/lib/qa-console-stories';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

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

    const storyFile =
      manifest.storyFile?.trim() ||
      (manifest.companionId && manifest.direction
        ? `${manifest.companionId}_${manifest.direction}.md`
        : 'dragon_dini_fantasy.md');

    const companionId =
      manifest.companionId?.trim() ||
      storyFile.replace(/_(bedtime|adventure|fantasy)\.md$/i, '');
    const companion = getCompanionById(companionId);

    const childName = manifest.childProfile?.name?.trim() || 'נועם';
    const childGender = (manifest.childProfile?.gender?.trim() || 'boy') as 'boy' | 'girl';
    const direction =
      manifest.direction?.trim() ||
      (storyFile.match(/_(bedtime|adventure|fantasy)\.md$/i)?.[1] ?? 'fantasy');

    const maxPages = manifest.totalStoryPages ?? 20;
    const story = await loadStoryFromBank(
      path.join(storyBankRoot(), storyFile),
      childName,
      companion?.name ?? companionId,
      childGender,
      { maxPages }
    );

    const renderedByPage = new Map(
      (manifest.pages ?? [])
        .filter((p) => !p.failed)
        .map((p) => [p.pageNumber, p] as const)
    );

    const allStoryPages = manifest.allStoryPages;
    const sourcePages =
      allStoryPages && allStoryPages.length > 0
        ? allStoryPages.map((ap) => {
            const storyPage = story.pages.find((s) => s.pageNumber === ap.pageNumber);
            return {
              pageNumber: ap.pageNumber,
              text: ap.hebrewText ?? storyPage?.text ?? '',
              narrationText: ap.narrationText ?? storyPage?.narrationText,
            };
          })
        : story.pages;

    const pages = sourcePages
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((storyPage) => {
        const rendered = renderedByPage.get(storyPage.pageNumber);
        const remote =
          rendered && typeof rendered.imageUrl === 'string' && rendered.imageUrl.trim()
            ? rendered.imageUrl.trim()
            : null;
        const hasLocal = rendered ? Boolean(resolveAuditionPageImagePath(dirPath, rendered)) : false;
        const imageUrl =
          remote ?? (hasLocal ? auditionAssetUrl(dir, storyPage.pageNumber, 'image') : null);
        const isRendered = Boolean(imageUrl);

        const hasAudio = rendered ? Boolean(resolveAuditionPageAudioPath(dirPath, rendered)) : false;
        const audioUrl = hasAudio
          ? rendered?.audioUrl ?? auditionAssetUrl(dir, storyPage.pageNumber, 'audio')
          : null;

        return {
          pageNumber: storyPage.pageNumber,
          text: storyPage.text,
          narrationText: storyPage.narrationText,
          imageUrl: isRendered ? imageUrl : null,
          audioUrl,
          renderStatus: isRendered
            ? ('rendered' as const)
            : ('not rendered in this audition' as const),
        };
      });

    const title =
      manifest.qaConsole && manifest.storyKey
        ? `QA — ${manifest.storyKey} (${childName})`
        : 'Style 01 book preview';

    return NextResponse.json({
      id: manifest.orderId ?? dir,
      childName,
      storyDirection: direction,
      storyLength: 'long',
      book: {
        title,
        pages,
      },
      manifestMeta: {
        dir,
        root: root ?? 'auto',
        audition: manifest.audition,
        qaConsole: manifest.qaConsole,
        storyKey: manifest.storyKey,
        storyFile: manifest.storyFile,
        companionId,
        direction,
        voiceId: manifest.voiceId,
        quality: manifest.quality,
        model: manifest.model,
        childProfile: manifest.childProfile,
        renderedPageNumbers:
          manifest.renderedPageNumbers ??
          pages.filter((p) => p.renderStatus === 'rendered').map((p) => p.pageNumber),
        totalStoryPages: manifest.totalStoryPages ?? story.pages.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load manifest';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
