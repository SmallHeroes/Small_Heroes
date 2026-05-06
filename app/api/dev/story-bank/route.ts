import { randomUUID } from 'crypto';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { IllustrationStyle } from '@prisma/client';
import { generateStoryBankCharacterDNA, loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { generateAllPageImages, generateBookCover } from '@/backend/providers/image';
import { prisma } from '@/lib/prisma';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '@/lib/illustrationPresentation';
import { storePresentationBuffer } from '@/lib/image-storage';
import { ROUTES } from '@/lib/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORY_BANK_RAW = path.join(process.cwd(), 'story-bank', 'raw');

function normalizeIllustrationStyle(value: string | undefined): IllustrationStyle {
  if (value === 'pencil_watercolor') return IllustrationStyle.pencil_watercolor;
  if (value === 'whimsical_comic_fantasy') return IllustrationStyle.whimsical_comic_fantasy;
  if (value === 'realistic_illustrated') return IllustrationStyle.realistic_illustrated;
  // Default: Style 01 (realistic_illustrated routes to soft_hand_drawn_storybook)
  return IllustrationStyle.realistic_illustrated;
}

function compositionRulesForTemplate(
  template: BookPageTemplate,
  composition?: {
    cameraDistance?: string;
    cameraAngle?: string;
    mainFocus?: string;
    topTextAreaPlan?: string;
    mainIllustrationZone?: string;
    backgroundComplexity?: string;
  }
): string {
  const camera =
    composition?.cameraDistance && composition?.cameraAngle
      ? `${composition.cameraDistance}/${composition.cameraAngle}`
      : 'medium/eye-level';
  const focus = composition?.mainFocus ?? 'single story focus';
  const topZone = composition?.topTextAreaPlan ?? 'calm text-safe area';
  const zone = composition?.mainIllustrationZone ?? 'primary scene zone';
  const complexity = composition?.backgroundComplexity ?? 'moderate';
  if (template === 'full_bleed_overlay') {
    return [
      'pageTemplate=full_bleed_overlay',
      `camera=${camera}`,
      `focus=${focus}`,
      `topTextAreaPlan=${topZone}`,
      'immersive full-page composition with protected text-safe band',
      'no key face/hand/object in text-safe overlay region',
      `backgroundComplexity=${complexity}`,
    ].join(' | ');
  }
  if (template === 'character_vignette_text') {
    return [
      'pageTemplate=character_vignette_text',
      `camera=${camera}`,
      `focus=${focus}`,
      'single focused subject, airy surroundings, generous negative space',
      'visual mass center-to-lower frame, soft dissolving edges',
      `mainIllustrationZone=${zone}`,
    ].join(' | ');
  }
  return [
    'pageTemplate=art_top_text_bottom',
    `camera=${camera}`,
    `focus=${focus}`,
    'upper-half visual focus with calmer lower composition density',
    'designed to naturally fade downward into paper for text area',
    `topTextAreaPlan=${topZone}`,
  ].join(' | ');
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as {
    storyFile?: string;
    childName?: string;
    childGender?: string;
    childAge?: number;
    companionName?: string;
    illustrationStyle?: string;
    childImageUrl?: string | null;
    maxPages?: number;
  };

  const {
    storyFile,
    childName = 'נועה',
    childGender = 'girl',
    childAge = 5,
    companionName = 'צפרדע',
    illustrationStyle: illustrationStyleRaw = 'realistic_illustrated',
    childImageUrl = null,
    maxPages = 0,
  } = body;

  if (!storyFile || typeof storyFile !== 'string') {
    return NextResponse.json({ error: 'storyFile is required' }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9._-]+\.md$/.test(storyFile)) {
    return NextResponse.json({ error: 'storyFile must be a simple .md file name' }, { status: 400 });
  }

  const filePath = path.join(STORY_BANK_RAW, storyFile);

  const illustrationStyle = normalizeIllustrationStyle(illustrationStyleRaw);
  const accessKey = randomUUID();
  const orderId = randomUUID();

  try {
    const storyFull = await loadStoryFromBank(filePath, childName, companionName);
    console.log(`[StoryBank] Loaded "${storyFull.title}" — ${storyFull.pages.length} pages`);

    if (storyFull.pages.length === 0) {
      return NextResponse.json({ error: 'No pages found in story file' }, { status: 400 });
    }

    // Limit pages for faster/cheaper dev testing
    const pageLimit = maxPages > 0 ? maxPages : storyFull.pages.length;
    const story = {
      ...storyFull,
      pages: storyFull.pages.slice(0, pageLimit),
    };
    console.log(`[StoryBank] Rendering ${story.pages.length}/${storyFull.pages.length} pages (maxPages=${maxPages})`);

    const assignedTemplates = assignTemplatesForBook(
      story.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        imageSubject: page.imageSubject,
      }))
    );
    const templateByPageNumber = new Map<number, BookPageTemplate>(
      story.pages.map((page, index) => [
        page.pageNumber,
        assignedTemplates[index] ?? 'art_top_text_bottom',
      ])
    );

    const order = await prisma.order.create({
      data: {
        id: orderId,
        status: 'generating',
        customerEmail: 'story-bank@dev.local',
        customerName: 'Story Bank Dev',
        childName,
        childAge,
        childGender,
        childTraits: [],
        topic: 'story_bank',
        challengeItems: [],
        outcomeItems: [],
        helperItems: [],
        avoidItems: [],
        storyLength: 'medium',
        illustrationStyle,
        childImageUrl: childImageUrl || null,
        paymentId: accessKey,
        paymentProvider: 'story_bank_dev',
        basePrice: 0,
        addonsPrice: 0,
        totalPrice: 0,
        textStatus: 'done',
        imageStatus: 'running',
        audioStatus: 'done',
        packageStatus: 'pending',
        bookName: story.title,
      },
    });

    const book = await prisma.generatedBook.create({
      data: {
        orderId: order.id,
        title: story.title,
        coverText: story.coverText,
      },
    });

    await prisma.bookPage.createMany({
      data: story.pages.map((p) => ({
        bookId: book.id,
        pageNumber: p.pageNumber,
        text: p.text,
        narrationText: p.narrationText,
        pageTemplate: templateByPageNumber.get(p.pageNumber),
        textZone: null,
        lighting: null,
        textColorScheme: null,
      })),
    });

    // Use FULL story text for DNA (even if rendering fewer pages) so character is consistent
    const allText = storyFull.pages.map((p) => p.text).join('\n');
    const dna = await generateStoryBankCharacterDNA({
      childName,
      childGender,
      childAge,
      companionName,
      storyText: allText,
      illustrationStyle,
    });
    const childDesc = dna.childDNA;

    const coverImage = await generateBookCover({
      childName,
      topicLabel: 'Story Bank',
      storyTitle: story.title,
      coverText: story.coverText,
      illustrationStyle,
      childDescription: childDesc,
      characterSheet: story.characterSheet,
      referenceImages: childImageUrl ? [childImageUrl] : undefined,
      orderId: order.id,
      directionStoryPremise: storyFull.coverSceneHint,
      companion: {
        name: companionName,
        visualDescription: dna.companionDNA,
      },
    });

    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { coverImageUrl: coverImage.url },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { coverImageUrl: coverImage.url },
    });

    const imageOutcome = await generateAllPageImages(
      story.pages.map((p) => {
        const template = templateByPageNumber.get(p.pageNumber) ?? 'art_top_text_bottom';
        return {
          pageNumber: p.pageNumber,
          imagePrompt: p.imagePrompt,
          rawScenePrompt: p.rawScenePrompt,
          visualDirection: p.visualDirection,
          bookPageText: p.text,
          pageTemplate: template,
          imageSubject: p.imageSubject,
          pageIntent: undefined,
          composition: undefined,
          compositionRules: compositionRulesForTemplate(template),
          environmentContinuity: dna.worldDNA,
        };
      }),
      {
        illustrationStyle,
        childName,
        childAge,
        childGender,
        childDescription: childDesc,
        referenceImages: childImageUrl ? [childImageUrl] : undefined,
        orderId: order.id,
        characterSheet: story.characterSheet,
        concept: story.concept,
        extraNegativeRules: dna.negativeRules,
        propDNA: dna.propDNA,
        companion: {
          name: companionName,
          visualDescription: dna.companionDNA,
        },
      }
    );

    const presentationPostprocessEnabled =
      process.env.ENABLE_PRESENTATION_POSTPROCESS !== 'false' &&
      process.env.SKIP_ILLUSTRATION_PRESENTATION !== 'true';

    const dbPages = await prisma.bookPage.findMany({
      where: { bookId: book.id },
      orderBy: { pageNumber: 'asc' },
      select: { id: true, pageNumber: true, pageTemplate: true, textZone: true, lighting: true, textColorScheme: true },
    });

    const imageMap = imageOutcome.results;
    const textZoneMap = imageOutcome.textZones;
    const lightingMap = imageOutcome.lightingModes;

    for (const page of dbPages) {
      const image = imageMap.get(page.pageNumber);
      const storyboardTextZone = textZoneMap.get(page.pageNumber) ?? null;
      const storyboardLighting = lightingMap.get(page.pageNumber) ?? null;
      if (page.textZone !== storyboardTextZone || page.lighting !== storyboardLighting || page.textColorScheme == null) {
        await prisma.bookPage.update({
          where: { id: page.id },
          data: { textZone: storyboardTextZone, lighting: storyboardLighting },
        });
      }

      if (!image) continue;

      const existingImageAsset = await prisma.imageAsset.findUnique({
        where: { pageId: page.id },
        select: { id: true },
      });
      if (existingImageAsset) continue;

      let presentationUrl: string | null = null;
      if (presentationPostprocessEnabled) {
        try {
          const mode =
            page.pageTemplate === 'full_bleed_overlay' ||
            page.pageTemplate === 'art_top_text_bottom' ||
            page.pageTemplate === 'character_vignette_text'
              ? page.pageTemplate
              : (templateByPageNumber.get(page.pageNumber) ?? 'art_top_text_bottom');
          const sourceBuffer = await fetchImageBuffer(image.url);
          const sourceSignal = await evaluateImageSignal(sourceBuffer);
          if (!sourceSignal.usable) {
            console.warn(`[StoryBank] Presentation skipped weak signal page=${page.pageNumber}`, sourceSignal.reasons);
          } else {
            const webp = await buildPresentationWebpFromBuffer(
              sourceBuffer,
              placementModeFromPageTemplate(mode),
              page.pageNumber
            );
            const presentationSignal = await evaluateImageSignal(webp, { baseline: sourceSignal });
            if (presentationSignal.usable) {
              presentationUrl = await storePresentationBuffer({
                buffer: webp,
                orderId: order.id,
                pageNumber: page.pageNumber,
              });
            } else {
              console.warn(
                `[StoryBank] Presentation rejected page=${page.pageNumber}`,
                presentationSignal.reasons
              );
            }
          }
        } catch (e) {
          console.warn(`[StoryBank] Presentation failed for page ${page.pageNumber}:`, e);
        }
      }

      await prisma.imageAsset.create({
        data: {
          pageId: page.id,
          provider: image.provider,
          prompt: image.prompt,
          url: image.url,
          presentationUrl,
          rawUrl: image.rawUrl ?? null,
          width: image.width,
          height: image.height,
          style: illustrationStyle,
        },
      });

      try {
        const imageUrlForAnalysis = presentationUrl || image.url;
        const textZoneForPage = textZoneMap.get(page.pageNumber) ?? 'bottom_clear';
        const { analyzeTextZoneLuminance } = await import('@/backend/providers/image-analysis');
        const textColorScheme = await analyzeTextZoneLuminance(imageUrlForAnalysis, textZoneForPage);
        await prisma.bookPage.update({
          where: { id: page.id },
          data: { textColorScheme },
        });
      } catch (analysisErr) {
        console.warn('[StoryBank] text_color_analysis failed', analysisErr);
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'ready',
        imageStatus: 'done',
        packageStatus: 'done',
      },
    });

    const bookUrl = ROUTES.readerV2(order.id, accessKey);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      bookId: book.id,
      accessKey,
      bookUrl,
      pagesRendered: imageOutcome.results.size,
      pagesFailed: imageOutcome.failedPages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[StoryBank] Generation failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
