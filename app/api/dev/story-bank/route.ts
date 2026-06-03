import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { IllustrationStyle, Prisma } from '@prisma/client';
import { generateStoryBankCharacterDNA, loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { generateAllPageImages, generateBookCover } from '@/backend/providers/image';
import { getCompanionById, type Companion } from '@/lib/companions';
import { mergeGptImageReferenceSources } from '@/lib/image-reference-utils';
import { prisma } from '@/lib/prisma';
import { buildPersistedCharacterAnchorsJson } from '@/lib/orderMeta';
import { GOLDEN_SHELF_PAGE_OPTIONS, type GoldenShelfPageOption } from '@/lib/power-cards/golden-shelf-catalog';
import { V3_COMPANION_BANK_CATEGORY } from '@/backend/providers/story-bank-index';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '@/lib/illustrationPresentation';
import { storePresentationBuffer } from '@/lib/image-storage';
import { ROUTES } from '@/lib/routes';
import { generatePageAudio } from '@/backend/providers/audio';
import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

function useChunkedGeneration(): boolean {
  return process.env.GENERATION_MONOLITH !== 'true';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORY_BANK_RAW = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const ALLOWED_PAGE_COUNTS = new Set<number>(GOLDEN_SHELF_PAGE_OPTIONS);

function normalizeMaxPages(value: unknown): GoldenShelfPageOption {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (ALLOWED_PAGE_COUNTS.has(n)) return n as GoldenShelfPageOption;
  if (n === 15 || n === 20) return n as GoldenShelfPageOption;
  return 3;
}

function inferStoryDirectionFromFile(
  storyFile: string
): 'bedtime' | 'adventure' | 'fantasy' | null {
  const base = storyFile.toLowerCase();
  if (base.includes('_bedtime')) return 'bedtime';
  if (base.includes('_fantasy')) return 'fantasy';
  if (base.includes('_adventure')) return 'adventure';
  return null;
}

function storyLengthForDirection(direction: 'bedtime' | 'adventure' | 'fantasy' | null): 'short' | 'medium' | 'long' {
  if (direction === 'bedtime') return 'short';
  if (direction === 'fantasy') return 'long';
  return 'medium';
}

function normalizeIllustrationStyle(value: string | undefined): IllustrationStyle {
  if (value === 'pencil_watercolor') return IllustrationStyle.pencil_watercolor;
  if (value === 'whimsical_comic_fantasy') return IllustrationStyle.whimsical_comic_fantasy;
  if (value === 'realistic_illustrated') return IllustrationStyle.realistic_illustrated;
  if (value === 'detailed_whimsical_world') return IllustrationStyle.detailed_whimsical_world;
  if (value === 'soft_hand_drawn_storybook') return IllustrationStyle.pencil_watercolor; // maps to Style 01
  if (value === 'expressive_painterly_storybook') return IllustrationStyle.detailed_whimsical_world;
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
    'full-frame illustration filling the entire image edge-to-edge — do NOT fade, blank, vignette, or empty any area into paper; paint the bottom fully',
    'keep the main face/focal subject clear of the very bottom caption strip (mobile overlays text there); on desktop the illustration is shown full and standalone',
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
    skipCover?: boolean;
    generateAudio?: boolean;
    voiceId?: string | null;
    childPhotoBase64?: string | null;
    /** Validate story + personalization only — no DB, no images, no audio. */
    packageDryRun?: boolean;
    /** Skip LLM gender/name personalization (dev generalization tests with fixed hero). */
    skipPersonalization?: boolean;
    /** Do not HTTP-chain worker from route (CLI driver owns worker loop). */
    skipWorkerChain?: boolean;
  };

  const {
    storyFile,
    childName = 'נועה',
    childGender = 'girl',
    childAge = 5,
    companionName = 'צפרדע',
    illustrationStyle: illustrationStyleRaw = 'soft_hand_drawn_storybook',
    childImageUrl: childImageUrlRaw = null,
    maxPages: maxPagesRaw = 3,
    skipCover = false,
    generateAudio = false,
    voiceId: voiceIdRaw = 'mom',
    childPhotoBase64 = null,
    packageDryRun = false,
    skipPersonalization = false,
    skipWorkerChain = false,
  } = body;

  const childImageUrl =
    childImageUrlRaw?.trim() ||
    (childPhotoBase64?.trim()
      ? childPhotoBase64.trim().startsWith('data:')
        ? childPhotoBase64.trim()
        : `data:image/jpeg;base64,${childPhotoBase64.trim()}`
      : null);
  const voiceId = voiceIdRaw?.trim() || 'mom';

  const maxPages = normalizeMaxPages(maxPagesRaw);

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
    // Resolve canonical companion name from the story file's YAML frontmatter.
    // Previously route.ts trusted the request body's companionName, which often
    // mismatched the story (e.g. request="צפרדע" but story=fox_uri_adventure).
    // The image pipeline then wrote "NO companion in this scene" AND mustInclude=[fox]
    // — two contradictory instructions that killed the companion in every page.
    let effectiveCompanionName = companionName;
    let resolvedCompanion: Companion | null = null;
    try {
      const rawStory = await fs.readFile(filePath, 'utf-8');
      const idMatch = rawStory.match(/companionId\s*:\s*([a-z0-9_-]+)/i);
      if (idMatch?.[1]) {
        const c = getCompanionById(idMatch[1]);
        if (c?.name) {
          resolvedCompanion = c;
          if (c.name !== companionName) {
            console.log(`[StoryBank] companion resolved from YAML — id="${idMatch[1]}" name="${c.name}" (override request="${companionName}")`);
          }
          effectiveCompanionName = c.name;
        } else {
          console.warn(`[StoryBank] companionId "${idMatch[1]}" not in companions registry — keeping request value "${companionName}"`);
        }
      }
    } catch (companionErr) {
      console.warn('[StoryBank] companion YAML extraction failed:', (companionErr as Error).message);
    }

    const storyDirection = inferStoryDirectionFromFile(storyFile);
    const storyLength = storyLengthForDirection(storyDirection);
    const companionId = resolvedCompanion?.id ?? null;
    const challengeCategory =
      (companionId && V3_COMPANION_BANK_CATEGORY[companionId]) || 'GENERAL_FEARS';

    const storyFull = await loadStoryFromBank(
      filePath,
      childName,
      effectiveCompanionName,
      childGender,
      {
        maxPages: packageDryRun ? 20 : maxPages,
        skipLlmPersonalization: skipPersonalization || packageDryRun,
      }
    );
    console.log(`[StoryBank] Loaded "${storyFull.title}" — ${storyFull.pages.length} pages (maxPages=${packageDryRun ? 20 : maxPages})`);

    if (packageDryRun) {
      const markdown = await fs.readFile(filePath, 'utf-8');
      const { parseAndValidateStoryPowerCard, extractYamlFrontmatterBlock, parsePowerCardFromFrontmatterYaml, resolvePowerCard } =
        await import('@/lib/power-cards');
      const slug = storyFile.replace(/\.md$/, '');
      const powerResult = parseAndValidateStoryPowerCard(markdown, slug);
      const powerErrors = powerResult.issues.filter((i) => i.severity === 'error');
      if (powerErrors.length > 0 || !powerResult.spec) {
        return NextResponse.json(
          { error: 'powerCard validation failed', issues: powerErrors },
          { status: 400 }
        );
      }
      const yamlBlock = extractYamlFrontmatterBlock(markdown);
      if (yamlBlock) {
        resolvePowerCard({ powerCard: parsePowerCardFromFrontmatterYaml(yamlBlock) });
      }
      if (!/WORD_COUNT:\s*\[/.test(markdown)) {
        return NextResponse.json({ error: 'Missing WORD_COUNT line' }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        mode: 'packageDryRun',
        storyFile,
        pages: storyFull.pages.length,
        title: storyFull.title,
        powerCard: true,
        wordCountLine: true,
        personalizationSample: storyFull.pages[0]?.text?.slice(0, 120),
      });
    }

    if (storyFull.pages.length === 0) {
      return NextResponse.json({ error: 'No pages found in story file' }, { status: 400 });
    }

    const story = storyFull;

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

    const chunkedGen = useChunkedGeneration();

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
        storyLength,
        storyDirection: storyDirection ?? undefined,
        illustrationStyle,
        childImageUrl: childImageUrl || null,
        characterAnchors: buildPersistedCharacterAnchorsJson({}, {
          companionCharacterId: companionId ?? undefined,
          challengeCategory,
        }) as Prisma.InputJsonValue,
        paymentId: accessKey,
        paymentProvider: 'story_bank_dev',
        basePrice: 0,
        addonsPrice: 0,
        totalPrice: 0,
        textStatus: chunkedGen ? 'pending' : 'done',
        imageStatus: chunkedGen ? 'pending' : 'running',
        audioEnabled: generateAudio,
        selectedVoice: generateAudio ? voiceId : null,
        audioStatus: generateAudio ? 'pending' : 'done',
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

    const pipelineCache: PipelineCache = {
      devStoryBankFile: filePath,
      devSkipCover: skipCover,
      skipLlmPersonalization: skipPersonalization || packageDryRun,
      challengeCategory,
      directionForV3: storyDirection ?? undefined,
      expectedPageCount: story.pages.length,
      ...(skipPersonalization || packageDryRun ? { textFinalized: true } : {}),
    };

    if (chunkedGen) {
      await startChunkedGeneration(order.id, 'creator_story_bank', {
        pipelineCache,
        skipWorkerChain:
          skipWorkerChain || process.env.STORY_BANK_SKIP_WORKER_CHAIN === 'true',
      });

      const bookUrl = ROUTES.readerV2(order.id, accessKey);
      const viewerUrl = `/dev/viewer?orderId=${encodeURIComponent(order.id)}&accessKey=${encodeURIComponent(accessKey)}`;

      return NextResponse.json({
        success: true,
        orderId: order.id,
        bookId: book.id,
        accessKey,
        bookUrl,
        viewerUrl,
        maxPages,
        mode: 'chunked',
        polling: true,
        statusUrl: `/api/generate/status?orderId=${encodeURIComponent(order.id)}`,
        hint: 'Full book uses chunked /api/generate/worker — poll statusUrl until ready.',
      });
    }

    // Legacy synchronous path (GENERATION_MONOLITH=true only)
    const allText = story.pages.map((p) => p.text).join('\n');
    const dna = await generateStoryBankCharacterDNA({
      childName,
      childGender,
      childAge,
      companionName: effectiveCompanionName,
      storyText: allText,
      illustrationStyle,
    });
    const childDesc = dna.childDNA;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const referenceImages =
      mergeGptImageReferenceSources(childImageUrl, resolvedCompanion, appBaseUrl) ?? [];

    if (!skipCover) {
      const coverImage = await generateBookCover({
        childName,
        topicLabel: 'Story Bank',
        storyTitle: story.title,
        coverText: story.coverText,
        illustrationStyle,
        childDescription: childDesc,
        characterSheet: story.characterSheet,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        orderId: order.id,
        directionStoryPremise: story.coverSceneHint,
        childStructured: dna.childStructured,
        companionStructured: dna.companionStructured,
        companion: {
          name: effectiveCompanionName,
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
    } else {
      console.log('[StoryBank] Skipping cover generation (skipCover=true)');
    }

    // Map per-page composition (pageIntent, cameraDistance, etc.) from the story
    // file. This enables the narrative-beat-aware Storyboard to pick correct shots
    // (wide for action_page, close_up for emotional_closeup, etc.).
    const compositionByPage = new Map(
      (story.pageCompositionPlan ?? []).map((c) => [c.pageNumber, c])
    );

    const imageOutcome = await generateAllPageImages(
      story.pages.map((p) => {
        const template = templateByPageNumber.get(p.pageNumber) ?? 'art_top_text_bottom';
        const comp = compositionByPage.get(p.pageNumber);
        return {
          pageNumber: p.pageNumber,
          imagePrompt: p.imagePrompt,
          rawScenePrompt: p.rawScenePrompt,
          visualDirection: p.visualDirection,
          bookPageText: p.text,
          pageTemplate: template,
          imageSubject: p.imageSubject,
          pageIntent: comp?.pageIntent,
          composition: comp
            ? {
                cameraDistance: comp.cameraDistance,
                cameraAngle: comp.cameraAngle,
                compositionType: comp.compositionType,
                heroPlacement: comp.heroPlacement,
                entityPlacement: comp.entityPlacement,
                topTextAreaPlan: comp.topTextAreaPlan,
                mainIllustrationZone: comp.mainIllustrationZone,
              }
            : undefined,
          compositionRules: compositionRulesForTemplate(template, comp),
          environmentContinuity: comp?.consistencyNotes ?? dna.worldDNA,
        };
      }),
      {
        illustrationStyle,
        childName,
        childAge,
        childGender,
        childDescription: childDesc,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        orderId: order.id,
        characterSheet: story.characterSheet,
        concept: story.concept,
        extraNegativeRules: dna.negativeRules,
        propDNA: dna.propDNA,
        childStructured: dna.childStructured,
        companionStructured: dna.companionStructured,
        challengeCategory,
        directionArchetype: storyDirection ?? undefined,
        companion: resolvedCompanion
          ? {
              id: resolvedCompanion.id,
              name: resolvedCompanion.name,
              tagline: resolvedCompanion.tagline ?? '',
              narrativeHook: resolvedCompanion.narrativeHook ?? '',
              image: resolvedCompanion.image,
              visualDescription: dna.companionDNA || resolvedCompanion.visualDescription,
            }
          : {
              id: 'story-bank',
              name: effectiveCompanionName,
              tagline: '',
              narrativeHook: '',
              image: '',
              visualDescription: dna.companionDNA,
            },
        storyRecurringEntityDeclarations: story.storyRecurringEntities,
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

    if (generateAudio && story.pages.length > 0) {
      await prisma.order.update({ where: { id: order.id }, data: { audioStatus: 'running' } });
      for (const page of story.pages) {
        const narration = page.narrationText?.trim();
        if (!narration) continue;
        try {
          const result = await generatePageAudio({
            narrationText: narration,
            voiceId,
            sleepMode: false,
            orderId: order.id,
            pageNumber: page.pageNumber,
          });
          await prisma.bookPage.updateMany({
            where: { bookId: book.id, pageNumber: page.pageNumber },
            data: { audioUrl: result.url },
          });
        } catch (err) {
          console.warn(`[StoryBank] Audio failed for page ${page.pageNumber}:`, err);
        }
      }
      await prisma.order.update({ where: { id: order.id }, data: { audioStatus: 'done' } });
    }

    const failedCount = imageOutcome.failedPages.length;
    const orderStatus = failedCount > 0 ? 'partial' : 'ready';
    const allImagesFailed = failedCount >= story.pages.length && story.pages.length > 0;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: orderStatus,
        imageStatus: allImagesFailed ? 'failed' : 'done',
        packageStatus: orderStatus === 'ready' ? 'done' : 'pending',
      },
    });

    const bookUrl = ROUTES.readerV2(order.id, accessKey);
    const viewerUrl = `/dev/viewer?orderId=${encodeURIComponent(order.id)}&accessKey=${encodeURIComponent(accessKey)}`;

    return NextResponse.json({
      success: true,
      orderId: order.id,
      bookId: book.id,
      accessKey,
      bookUrl,
      viewerUrl,
      pagesRendered: imageOutcome.results.size,
      pagesFailed: imageOutcome.failedPages,
      maxPages,
      orderStatus,
      storyDirection,
      challengeCategory,
      style02Active: process.env.PHASE2_STYLE02_BOOK_PIPELINE === 'true',
      hint:
        'Style 02 blockers (classifier, bedtime-medical, temporal collapse, guarded-v1) require PHASE2_STYLE02_BOOK_PIPELINE=true, IMAGE_PROVIDER=gpt-image, PHASE2_STYLE02_REF_CONFIG=A, PHASE2_STEP5_PROFILE=guarded-v1 in .env.local',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[StoryBank] Generation failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
