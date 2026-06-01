import path from 'path';
import {
  assignTemplatesForBook,
  textPlacementForTemplate,
  type BookPageTemplate,
} from '@/lib/bookPageLayout';
import { deriveLayout, countHebrewWords } from '@/backend/providers/image-prompt-enricher';
import { prisma } from '@/lib/prisma';
import {
  auditionAssetUrl,
  loadStyle01AuditionManifest,
  resolveAuditionPageAudioPath,
  resolveAuditionPageImagePath,
} from '@/lib/style01-audition-preview';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { getCompanionById } from '@/lib/companions';
import { storyBankRoot } from '@/lib/qa-console-stories';

export type DevViewerPage = {
  pageNumber: number;
  text: string;
  narrationText?: string | null;
  imageUrl: string | null;
  audioUrl?: string | null;
  renderStatus?: 'rendered' | 'not rendered in this audition';
  pageTemplate?: string | null;
  pageLayout?: string | null;
  textZone?: string | null;
  lighting?: string | null;
  textColorScheme?: string | null;
  isCover?: boolean;
  isDedication?: boolean;
  isLetter?: boolean;
  isQuietPage?: boolean;
};

export type DevViewerBookPayload = {
  id: string;
  childName?: string;
  storyDirection?: string;
  storyLength?: string | null;
  book: {
    title?: string;
    pages: DevViewerPage[];
  };
  manifestMeta?: Record<string, unknown>;
};

function normalizePageTemplate(value: string | null | undefined): BookPageTemplate | null {
  if (value === 'full_bleed_overlay' || value === 'art_top_text_bottom' || value === 'character_vignette_text') {
    return value;
  }
  return null;
}

export async function loadDevViewerAuditionBook(
  dir: string,
  root?: 'phase2-logs' | 'outputs'
): Promise<DevViewerBookPayload> {
  const { dirPath, manifest } = await loadStyle01AuditionManifest(dir, root);

  const storyFile =
    manifest.storyFile?.trim() ||
    (manifest.companionId && manifest.direction
      ? `${manifest.companionId}_${manifest.direction}.md`
      : 'dragon_dini_fantasy.md');

  const companionId =
    manifest.companionId?.trim() || storyFile.replace(/_(bedtime|adventure|fantasy)\.md$/i, '');
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
    (manifest.pages ?? []).filter((p) => !p.failed).map((p) => [p.pageNumber, p] as const)
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

  const pages: DevViewerPage[] = sourcePages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((storyPage) => {
      const rendered = renderedByPage.get(storyPage.pageNumber);
      const remote =
        rendered && typeof rendered.imageUrl === 'string' && rendered.imageUrl.trim()
          ? rendered.imageUrl.trim()
          : null;
      const hasLocal = rendered ? Boolean(resolveAuditionPageImagePath(dirPath, rendered)) : false;
      const imageUrl = remote ?? (hasLocal ? auditionAssetUrl(dir, storyPage.pageNumber, 'image') : null);
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
        renderStatus: isRendered ? 'rendered' : 'not rendered in this audition',
        pageLayout: 'standard',
      };
    });

  const title =
    manifest.qaConsole && manifest.storyKey
      ? `${manifest.storyKey} (${childName})`
      : story.title;

  return {
    id: manifest.orderId ?? dir,
    childName,
    storyDirection: direction,
    storyLength: 'long',
    book: { title, pages },
    manifestMeta: {
      dir,
      root: root ?? 'auto',
      storyKey: manifest.storyKey,
      model: manifest.model,
      quality: manifest.quality,
      renderedPageNumbers:
        manifest.renderedPageNumbers ??
        pages.filter((p) => p.renderStatus === 'rendered').map((p) => p.pageNumber),
      totalStoryPages: manifest.totalStoryPages ?? story.pages.length,
    },
  };
}

export async function loadDevViewerOrderBook(orderId: string): Promise<DevViewerBookPayload> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      childName: true,
      storyLength: true,
      storyDirection: true,
      dedication: true,
      coverImageUrl: true,
      book: {
        select: {
          title: true,
          coverImageUrl: true,
          pages: {
            orderBy: { pageNumber: 'asc' },
            select: {
              pageNumber: true,
              text: true,
              narrationText: true,
              audioUrl: true,
              pageTemplate: true,
              textZone: true,
              lighting: true,
              textColorScheme: true,
              imageAsset: {
                select: { url: true, presentationUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order?.book) {
    throw new Error('Order or book not found');
  }

  const pageRows = order.book.pages;
  const templateInputs = pageRows.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
    imageSubject: undefined,
    imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
  }));
  const fallbackTemplates = assignTemplatesForBook(templateInputs);
  const interiorCount = pageRows.length;

  const contentPages: DevViewerPage[] = pageRows.map((p, i) => {
    const resolvedTemplate = normalizePageTemplate(p.pageTemplate) ?? fallbackTemplates[i];
    const wordCount = countHebrewWords(p.text);
    return {
      pageNumber: p.pageNumber,
      text: p.text,
      narrationText: p.narrationText ?? null,
      audioUrl: p.audioUrl ?? null,
      imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
      pageTemplate: resolvedTemplate,
      textZone: p.textZone ?? null,
      lighting: p.lighting ?? null,
      textColorScheme: p.textColorScheme ?? null,
      pageLayout: deriveLayout({
        pageNumber: p.pageNumber,
        totalPages: interiorCount,
        text: p.text,
      }),
      isLetter: false,
      isQuietPage: wordCount < 20,
    };
  });

  const dedicationText = typeof order.dedication === 'string' ? order.dedication.trim() : '';
  const pagesWithDedication =
    dedicationText.length > 0
      ? [
          ...contentPages,
          {
            pageNumber: (contentPages[contentPages.length - 1]?.pageNumber ?? interiorCount) + 1,
            text: dedicationText,
            narrationText: null,
            audioUrl: null,
            imageUrl: null,
            pageTemplate: 'character_vignette_text',
            textZone: null,
            lighting: null,
            textColorScheme: null,
            pageLayout: 'vignette_breath',
            isLetter: false,
            isQuietPage: true,
            isDedication: true,
          } satisfies DevViewerPage,
        ]
      : contentPages;

  const coverUrl = order.book.coverImageUrl ?? order.coverImageUrl ?? null;
  const pages: DevViewerPage[] = coverUrl
    ? [
        {
          pageNumber: 0,
          text: '',
          narrationText: null,
          audioUrl: null,
          imageUrl: coverUrl,
          pageTemplate: 'full_bleed_overlay',
          isCover: true,
          pageLayout: 'cover',
          isLetter: false,
          isQuietPage: false,
        },
        ...pagesWithDedication,
      ]
    : pagesWithDedication;

  return {
    id: order.id,
    childName: order.childName ?? undefined,
    storyDirection: order.storyDirection ?? undefined,
    storyLength: order.storyLength,
    book: {
      title: order.book.title ?? undefined,
      pages,
    },
    manifestMeta: { orderId: order.id, status: order.status },
  };
}
