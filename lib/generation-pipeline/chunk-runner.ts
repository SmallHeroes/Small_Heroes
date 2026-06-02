/**
 * Chunked generation worker — one bounded unit of work per invocation.
 */
import { Prisma, type Order } from '@prisma/client';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { assertShippedBookStyleEngineActive } from '@/lib/image-engine-guard';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import { TOPICS } from '@/backend/config/wizard';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { logServerEvent } from '@/lib/server-events';
import {
  describeChildFromPhoto,
  generateStoryBankCharacterDNA,
  loadStoryFromBank,
} from '@/backend/providers/story-bank-loader';
import {
  selectCompanionStory,
  selectStoryFromBank,
  STORY_BANK_V3_DIR_NAME,
} from '@/backend/providers/story-bank-index';
import { generateAllPageImages, generateBookCover } from '@/backend/providers/image';
import { generatePageAudio } from '@/backend/providers/audio';
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '@/lib/illustrationPresentation';
import { storePresentationBuffer } from '@/lib/image-storage';
import { mergeGptImageReferenceSources } from '@/lib/image-reference-utils';
import {
  buildPersistedCharacterAnchorsJson,
  companionAnchorKey,
  getWizardMeta,
} from '@/lib/orderMeta';
import { buildLetterContextFromOrder, buildPatchContextFromOrder } from '@/backend/providers/personalization';
import { ROUTES } from '@/lib/routes';
import { getCompanionByIdAndCategory } from '@/lib/companions';
import { buildEnrichedScenePrompt, deriveLayout } from '@/backend/providers/image-prompt-enricher';
import {
  AUDIO_PAGES_PER_CHUNK,
  GENERATION_VERSION,
  getWorkerBudgetMs,
  MAX_PAGE_GENERATION_ATTEMPTS,
  PAGE_IMAGES_PER_CHUNK,
  type ChunkStage,
} from '@/lib/generation-chunked/constants';
import { buildArtifactIdempotencyKey, isValidImageAssetUrl } from '@/lib/generation-chunked/artifact-keys';
import {
  findExistingPageImageAsset,
  shouldSkipPaidPageImageRegen,
} from '@/lib/generation-chunked/paid-artifact-guard';
import { heartbeatLease } from '@/lib/generation-chunked/lease';
import { finalizeAndPersistStoryText } from './text-finalization';
import {
  buildImagePipelineAnchors,
  detectExpectedCharactersForPage,
  resolveCompanionForOrder,
} from './anchor-registry';
import { evaluatePhotoGate, resolveResemblanceThresholdConfig } from '@/lib/resemblance-core';
import {
  collectExistingImagePageNumbers,
  compositionRulesForTemplate,
  normalizePageTemplate,
  parsePipelineCache,
} from './helpers';
import type { ChunkProcessResult, PipelineCache } from './types';

const log = createLogger({ subsystem: 'chunk-runner' });

function parseImagePageFilter(): Set<number> | null {
  const raw = process.env.CHUNKED_IMAGE_PAGE_FILTER?.trim();
  if (!raw) return null;
  const values = raw
    .split(/[,\s]+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return null;
  return new Set(values);
}

function deadlineMs(startedAt: number, budgetMs: number): number {
  return startedAt + budgetMs;
}

function overBudget(startedAt: number, budgetMs: number): boolean {
  return Date.now() >= deadlineMs(startedAt, budgetMs);
}

async function updateStage(orderId: string, stage: ChunkStage, extra?: Prisma.GenerationJobUpdateInput) {
  await prisma.generationJob.update({
    where: { orderId },
    data: { currentStage: stage, ...extra },
  });
}

async function saveCache(orderId: string, cache: PipelineCache) {
  await prisma.generationJob.update({
    where: { orderId },
    data: { pipelineCache: cache as Prisma.InputJsonValue },
  });
}

async function runTextStage(order: Order, cache: PipelineCache): Promise<PipelineCache> {
  if (cache.textFinalized) {
    await prisma.order.update({ where: { id: order.id }, data: { textStatus: 'done' } });
    await prisma.generationJob.update({
      where: { orderId: order.id },
      data: { textDone: true },
    });
    return cache;
  }
  const result = await finalizeAndPersistStoryText(order, cache);
  await saveCache(order.id, result.cache);
  return result.cache;
}

async function runDnaStage(order: Order, cache: PipelineCache): Promise<PipelineCache> {
  if (cache.dna?.childDNA) return cache;

  const book = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
  });
  if (!book) throw new Error('Book missing after text stage');

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = getCompanionByIdAndCategory(
    wizardMeta.companionCharacterId ?? null,
    wizardMeta.challengeCategory ?? null
  );

  let childPhotoDescription: string | null = null;
  if (order.childImageUrl) {
    try {
      childPhotoDescription = await describeChildFromPhoto(order.childImageUrl);
    } catch {
      childPhotoDescription = null;
    }
  }

  const allStoryText = book.pages.map((p) => p.text).join('\n');
  const dna = await generateStoryBankCharacterDNA({
    childName: order.childName || '',
    childGender: order.childGender || 'girl',
    childAge: order.childAge || 4,
    companionName: resolvedCompanion?.name || '',
    storyText: allStoryText,
    illustrationStyle: order.illustrationStyle,
    childPhotoDescription,
  });

  const clothingLock = '';
  const childDescBase = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old`;
  const lockedChildDescription = dna.childDNA || childDescBase;

  const nextCache: PipelineCache = {
    ...cache,
    lockedChildDescription,
    childPhotoDescription,
    dna: {
      childDNA: dna.childDNA,
      companionDNA: dna.companionDNA,
      childStructured: dna.childStructured,
      companionStructured: dna.companionStructured,
      propDNA: dna.propDNA,
      negativeRules: dna.negativeRules,
      worldDNA: dna.worldDNA,
    },
  };

  await saveCache(order.id, nextCache);
  return nextCache;
}

async function runCoverStage(order: Order, cache: PipelineCache): Promise<void> {
  if (cache.devSkipCover) return;

  const book = await prisma.generatedBook.findUnique({ where: { orderId: order.id } });
  if (!book) throw new Error('Book missing');
  if (book.coverImageUrl && isValidImageAssetUrl(book.coverImageUrl)) return;

  assertShippedBookStyleEngineActive(order.illustrationStyle);

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = resolveCompanionForOrder(order);
  const topicLabel = TOPICS.find((t) => t.id === order.topic)?.label ?? order.topic;
  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const gptReferenceImages = mergeGptImageReferenceSources(
    order.childImageUrl,
    resolvedCompanion,
    appBaseUrl
  );

  const storyFilePath = cache.devStoryBankFile ?? cache.storyFilePath;
  if (!storyFilePath) throw new Error('storyFilePath missing in pipeline cache');

  const story = await loadStoryFromBank(
    storyFilePath,
    order.childName || '',
    resolvedCompanion?.name ?? 'צפרדע',
    order.childGender || undefined,
    { skipLlmPersonalization: true }
  );

  const coverImage = await generateBookCover({
    childName: order.childName,
    topicLabel,
    storyTitle: story.title,
    coverText: story.coverText,
    illustrationStyle: order.illustrationStyle,
    childDescription: lockedChildDescription,
    characterSheet: story.characterSheet,
    referenceImages: gptReferenceImages,
    orderId: order.id,
    heroVisualLock: story.heroVisualLock,
    styleLock: story.styleLock,
    entityVisualLock: story.entityVisualLock,
    companion: resolvedCompanion
      ? {
          name: resolvedCompanion.name,
          visualDescription: cache.dna?.companionDNA || resolvedCompanion.visualDescription,
        }
      : undefined,
    childStructured: cache.dna?.childStructured,
    companionStructured: cache.dna?.companionStructured,
  });

  await prisma.generatedBook.update({
    where: { id: book.id },
    data: { coverImageUrl: coverImage.url },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { coverImageUrl: coverImage.url },
  });
}

async function runPageImagesChunk(
  order: Order,
  cache: PipelineCache,
  startedAt: number,
  budgetMs: number
): Promise<{ cache: PipelineCache; stopChunk: boolean; failed: boolean }> {
  assertShippedBookStyleEngineActive(order.illustrationStyle);
  await prisma.order.update({ where: { id: order.id }, data: { imageStatus: 'running' } });

  const book = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    include: {
      pages: {
        orderBy: { pageNumber: 'asc' },
        include: { imageAsset: { select: { id: true, url: true, idempotencyKey: true } } },
      },
    },
  });
  if (!book) throw new Error('Book missing');

  const existingPageNumbers = collectExistingImagePageNumbers(book.pages);
  const pendingPagesAll = book.pages.filter((p) => !shouldSkipPaidPageImageRegen(p.imageAsset));
  const imagePageFilter = parseImagePageFilter();
  const pendingPages = imagePageFilter
    ? pendingPagesAll.filter((p) => imagePageFilter.has(p.pageNumber))
    : pendingPagesAll;
  if (imagePageFilter) {
    log.info('Image page filter active', {
      orderId: order.id,
      pages: [...imagePageFilter].sort((a, b) => a - b),
      pendingFiltered: pendingPages.length,
      pendingAll: pendingPagesAll.length,
    });
  }
  if (pendingPages.length === 0) {
    if (!imagePageFilter) {
      await prisma.order.update({ where: { id: order.id }, data: { imageStatus: 'done' } });
      await prisma.generationJob.update({ where: { orderId: order.id }, data: { imagesDone: true } });
    }
    return { cache, stopChunk: false, failed: false };
  }

  const storyFilePath = cache.devStoryBankFile ?? cache.storyFilePath;
  if (!storyFilePath) throw new Error('storyFilePath missing');

  if (!cache.textFinalized) {
    throw new Error('PRE-SPEND GATE: text not finalized — abort before paid images');
  }

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = resolveCompanionForOrder(order);

  const story = await loadStoryFromBank(
    storyFilePath,
    order.childName || '',
    resolvedCompanion?.name ?? 'צפרדע',
    order.childGender || undefined,
    { skipLlmPersonalization: true }
  );

  const compositionByPage = new Map(
    (story.pageCompositionPlan ?? []).map((c) => [c.pageNumber, c])
  );
  const assignedTemplates = assignTemplatesForBook(
    story.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imageSubject: p.imageSubject,
    }))
  );
  const templateByPage = new Map(
    story.pages.map((p, i) => [p.pageNumber, assignedTemplates[i] ?? 'art_top_text_bottom'])
  );

  const pagesToRender = pendingPages.slice(0, PAGE_IMAGES_PER_CHUNK);
  const pageNumbersThisChunk = new Set(pagesToRender.map((p) => p.pageNumber));
  const dbTextByPage = new Map(book.pages.map((p) => [p.pageNumber, p.text]));

  const { anchorRegistry, initialCharacterAnchors, characterRegistry } = buildImagePipelineAnchors({
    order,
    lockedChildDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
    resolvedCompanion,
    characterSheet: story.characterSheet,
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });
  const pagesWithDetectedCharacters = story.pages.map((p) => {
    const baseIds = detectExpectedCharactersForPage(
      { text: p.text, imagePrompt: p.imagePrompt, imageSubject: p.imageSubject ?? '' },
      anchorRegistry
    );
    const subj = (p.imageSubject ?? '').toLowerCase();
    if (resolvedCompanion && !subj.startsWith('environment') && !subj.startsWith('object:')) {
      return {
        ...p,
        expectedCharacterIds: [...new Set([...baseIds, companionAnchorKey(resolvedCompanion.id)])],
      };
    }
    return { ...p, expectedCharacterIds: baseIds };
  });
  const appearances = pagesWithDetectedCharacters.reduce<Record<string, number>>((acc, page) => {
    for (const id of page.expectedCharacterIds ?? []) acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const recurringCharacterIds = new Set(
    Object.entries(appearances)
      .filter(([characterId, count]) => characterId === 'child' || count > 1)
      .map(([characterId]) => characterId)
  );

  const pagesForGen = pagesWithDetectedCharacters
    .filter((p) => pageNumbersThisChunk.has(p.pageNumber))
    .map((p) => {
      const template = templateByPage.get(p.pageNumber) ?? 'art_top_text_bottom';
      const comp = compositionByPage.get(p.pageNumber);
      const pageLayout = deriveLayout({
        pageNumber: p.pageNumber,
        totalPages: story.pages.length,
        text: p.text,
        isLetter: Boolean(p.isLetter),
      });
      const enriched = buildEnrichedScenePrompt({
        rawScenePrompt: p.rawScenePrompt,
        imagePrompt: p.imagePrompt,
        layout: pageLayout,
        text: p.text,
        textZone: null,
        isLetter: p.isLetter,
        pageNumber: p.pageNumber,
        totalPages: story.pages.length,
      });
      return {
        pageNumber: p.pageNumber,
        imagePrompt: enriched.imagePrompt,
        rawScenePrompt: enriched.rawScenePrompt,
        bookPageText: dbTextByPage.get(p.pageNumber) ?? p.text,
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
        environmentContinuity: comp?.consistencyNotes,
        expectedCharacterIds: (p.expectedCharacterIds ?? ['child']).filter((id) =>
          recurringCharacterIds.has(id)
        ),
      };
    });

  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const gptReferenceImages = mergeGptImageReferenceSources(
    order.childImageUrl,
    resolvedCompanion,
    appBaseUrl
  );
  const inputPhotoStrength = order.childImageUrl
    ? await evaluatePhotoGate(order.childImageUrl).then((g) => g.inputStrength).catch(() => 'adequate' as const)
    : 'adequate';
  const resemblanceThresholdConfig = resolveResemblanceThresholdConfig();

  const workerDeadline = deadlineMs(startedAt, budgetMs);
  const imageOutcome = await generateAllPageImages(pagesForGen, {
    illustrationStyle: order.illustrationStyle,
    childName: order.childName,
    childAge: order.childAge,
    childGender: order.childGender,
    childDescription: lockedChildDescription,
    referenceImages: gptReferenceImages,
    characterRegistry,
    initialCharacterAnchors,
    existingPageNumbers: existingPageNumbers,
    maxNewPages: PAGE_IMAGES_PER_CHUNK,
    workerDeadlineMs: workerDeadline,
    orderId: order.id,
    characterSheet: story.characterSheet,
    concept: story.concept,
    heroVisualLock: story.heroVisualLock,
    styleLock: story.styleLock,
    entityVisualLock: story.entityVisualLock,
    childStructured: cache.dna?.childStructured,
    companionStructured: cache.dna?.companionStructured,
    propDNA: cache.dna?.propDNA,
    extraNegativeRules: cache.dna?.negativeRules,
    companion: resolvedCompanion,
    challengeCategory: cache.challengeCategory,
    inputPhotoStrength,
    resemblanceThresholdConfig,
    onAnchorsResolved: async (resolvedAnchors) => {
      for (const [characterId, url] of Object.entries(resolvedAnchors)) {
        if (!anchorRegistry[characterId]) continue;
        anchorRegistry[characterId].anchorImageUrl = url;
      }
      await prisma.order.update({
        where: { id: order.id },
        data: {
          characterAnchors: buildPersistedCharacterAnchorsJson(anchorRegistry, wizardMeta) as Prisma.InputJsonValue,
          ...(resolvedAnchors.child ? { childImageUrl: resolvedAnchors.child } : {}),
        },
      });
    },
  });

  const presentationEnabled =
    process.env.ENABLE_PRESENTATION_POSTPROCESS !== 'false' &&
    process.env.SKIP_ILLUSTRATION_PRESENTATION !== 'true';

  const model = process.env.STYLE_01_GPT_MODEL?.trim() || 'gpt-image-2';
  const quality = process.env.GPT_IMAGE_QUALITY?.trim() || 'low';

  for (const dbPage of pagesToRender) {
    const image = imageOutcome.results.get(dbPage.pageNumber);
    if (!image) continue;

    const idempotencyKey = buildArtifactIdempotencyKey({
      orderId: order.id,
      kind: 'page_image',
      pageNumber: dbPage.pageNumber,
      model,
      quality,
      generationVersion: GENERATION_VERSION,
    });

    const existing = await findExistingPageImageAsset(prisma, {
      pageId: dbPage.id,
      idempotencyKey,
    });
    if (shouldSkipPaidPageImageRegen(existing)) {
      log.info('Skip paid regen — image asset exists', { orderId: order.id, page: dbPage.pageNumber });
      continue;
    }

    let presentationUrl: string | null = null;
    if (presentationEnabled) {
      try {
        const mode =
          normalizePageTemplate(dbPage.pageTemplate) ??
          templateByPage.get(dbPage.pageNumber) ??
          'art_top_text_bottom';
        const sourceBuffer = await fetchImageBuffer(image.url);
        const sourceSignal = await evaluateImageSignal(sourceBuffer);
        if (sourceSignal.usable) {
          const webp = await buildPresentationWebpFromBuffer(
            sourceBuffer,
            placementModeFromPageTemplate(mode),
            dbPage.pageNumber
          );
          const presSignal = await evaluateImageSignal(webp, { baseline: sourceSignal });
          if (presSignal.usable) {
            presentationUrl = await storePresentationBuffer({
              buffer: webp,
              orderId: order.id,
              pageNumber: dbPage.pageNumber,
            });
          }
        }
      } catch (e) {
        log.warn('Presentation failed', { page: dbPage.pageNumber, err: String(e) });
      }
    }

    if (existing) {
      await prisma.imageAsset.update({
        where: { id: existing.id },
        data: {
          provider: image.provider,
          prompt: image.prompt,
          url: image.url,
          presentationUrl,
          rawUrl: image.rawUrl ?? null,
          width: image.width,
          height: image.height,
          style: order.illustrationStyle,
          idempotencyKey,
        },
      });
    } else {
      await prisma.imageAsset.create({
        data: {
          pageId: dbPage.id,
          provider: image.provider,
          prompt: image.prompt,
          url: image.url,
          presentationUrl,
          rawUrl: image.rawUrl ?? null,
          width: image.width,
          height: image.height,
          style: order.illustrationStyle,
          idempotencyKey,
        },
      });
    }

    const textZone = imageOutcome.textZones.get(dbPage.pageNumber) ?? 'bottom_clear';
    try {
      const { analyzeTextZoneLuminance } = await import('@/backend/providers/image-analysis');
      const textColorScheme = await analyzeTextZoneLuminance(
        presentationUrl || image.url,
        textZone
      );
      await prisma.bookPage.update({
        where: { id: dbPage.id },
        data: {
          textZone,
          lighting: imageOutcome.lightingModes.get(dbPage.pageNumber) ?? null,
          textColorScheme,
        },
      });
    } catch {
      /* non-fatal */
    }
  }

  const job = await prisma.generationJob.findUnique({ where: { orderId: order.id } });
  const pageAttempts = (job?.pageAttempts as Record<string, number> | null) ?? {};
  for (const pn of imageOutcome.failedPages) {
    const key = String(pn);
    pageAttempts[key] = (pageAttempts[key] ?? 0) + 1;
    if (pageAttempts[key] >= MAX_PAGE_GENERATION_ATTEMPTS) {
      await prisma.generationJob.update({
        where: { orderId: order.id },
        data: {
          status: 'failed',
          currentStage: 'failed',
          failedAt: new Date(),
          retryable: true,
          lastError: `Page ${pn} failed after ${MAX_PAGE_GENERATION_ATTEMPTS} attempts`,
          pageAttempts: pageAttempts as Prisma.InputJsonValue,
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed', imageStatus: 'failed', lastError: `Page ${pn} image failed` },
      });
      return { cache, stopChunk: true, failed: true };
    }
  }
  await prisma.generationJob.update({
    where: { orderId: order.id },
    data: { pageAttempts: pageAttempts as Prisma.InputJsonValue },
  });

  const stillPending = await prisma.bookPage.count({
    where: { bookId: book.id, imageAsset: null },
  });
  const allDone = stillPending === 0 && imageOutcome.failedPages.length === 0;
  if (allDone) {
    await prisma.order.update({ where: { id: order.id }, data: { imageStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId: order.id }, data: { imagesDone: true } });
  }

  return {
    cache,
    stopChunk: overBudget(startedAt, budgetMs) || !allDone,
    failed: false,
  };
}

async function runAudioChunk(order: Order, startedAt: number, budgetMs: number): Promise<boolean> {
  const needsAudio =
    (order.audioEnabled || order.videoEnabled || order.bundleEnabled) && Boolean(order.selectedVoice);
  if (!needsAudio) {
    await prisma.order.update({ where: { id: order.id }, data: { audioStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId: order.id }, data: { audioDone: true } });
    return false;
  }

  await prisma.order.update({ where: { id: order.id }, data: { audioStatus: 'running' } });
  const book = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
  });
  if (!book) return false;

  const pending = book.pages.filter((p) => p.narrationText?.trim() && !p.audioUrl?.trim());
  const batch = pending.slice(0, AUDIO_PAGES_PER_CHUNK);

  for (const page of batch) {
    if (overBudget(startedAt, budgetMs)) return true;
    const narration = page.narrationText!.trim();
    try {
      const result = await generatePageAudio({
        narrationText: narration,
        voiceId: order.selectedVoice!,
        sleepMode: order.sleepMode,
        orderId: order.id,
        pageNumber: page.pageNumber,
      });
      await prisma.bookPage.update({
        where: { id: page.id },
        data: { audioUrl: result.url },
      });
    } catch (err) {
      log.warn('Audio page failed', { page: page.pageNumber, err: String(err) });
    }
  }

  const remaining = await prisma.bookPage.count({
    where: {
      bookId: book.id,
      narrationText: { not: null },
      OR: [{ audioUrl: null }, { audioUrl: '' }],
    },
  });
  if (remaining === 0) {
    await prisma.order.update({ where: { id: order.id }, data: { audioStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId: order.id }, data: { audioDone: true } });
    return false;
  }
  return true;
}

async function runPackageStage(order: Order): Promise<void> {
  const book = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    include: {
      pages: { include: { imageAsset: true }, orderBy: { pageNumber: 'asc' } },
    },
  });
  if (!book) throw new Error('Book missing for package');

  const expectedPages = book.pages.length;
  const withImages = book.pages.filter((p) => shouldSkipPaidPageImageRegen(p.imageAsset)).length;
  const hasCover = Boolean(book.coverImageUrl?.trim() || order.coverImageUrl?.trim());

  if (!hasCover || withImages < expectedPages) {
    throw new Error(
      `Package blocked: cover=${hasCover} images=${withImages}/${expectedPages}`
    );
  }

  await prisma.order.update({ where: { id: order.id }, data: { packageStatus: 'running' } });

  let pdfUrl: string | null = book.pdfUrl;
  if (order.pdfEnabled && !pdfUrl) {
    try {
      const [{ generateBookPdf }, { uploadPdfToStorage }] = await Promise.all([
        import('@/backend/lib/pdf-generator'),
        import('@/backend/lib/pdf-storage'),
      ]);
      const pagesForPdf = [
        ...(book.coverImageUrl
          ? [{ pageNumber: 0, text: '', imageUrl: book.coverImageUrl, isCover: true }]
          : []),
        ...book.pages.map((p) => ({
          pageNumber: p.pageNumber + (book.coverImageUrl ? 1 : 0),
          text: p.text,
          imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
          isCover: false,
        })),
      ];
      const pdfBuffer = await generateBookPdf({
        title: book.title || order.childName || 'הספר שלי',
        pages: pagesForPdf,
      });
      pdfUrl = await uploadPdfToStorage(order.id, pdfBuffer);
      await prisma.generatedBook.update({ where: { id: book.id }, data: { pdfUrl } });
    } catch (e) {
      log.error('PDF failed (non-fatal)', e, { orderId: order.id });
    }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const accessKey = order.paymentId ?? order.paymeTransactionId ?? order.stripeSessionId;
  const readUrl = accessKey
    ? `${appUrl}${ROUTES.ready}?orderId=${order.id}&accessKey=${encodeURIComponent(accessKey)}`
    : `${appUrl}${ROUTES.ready}?orderId=${order.id}`;

  await prisma.generatedBook.update({ where: { id: book.id }, data: { readUrl } });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'ready', packageStatus: 'done' },
  });
  await prisma.generationJob.update({
    where: { orderId: order.id },
    data: {
      status: 'done',
      currentStage: 'done',
      completedAt: new Date(),
      packaged: true,
    },
  });

  logServerEvent('full_generation_completed', { orderId: order.id, style: order.illustrationStyle });

  try {
    const firstAudio = book.pages.find((p) => p.audioUrl?.trim());
    await sendBookReadyEmail({
      to: order.customerEmail,
      customerName: order.customerName ?? order.childName,
      childName: order.childName,
      readUrl,
      audioUrl: firstAudio?.audioUrl ?? undefined,
      pdfUrl: pdfUrl ?? undefined,
    });
  } catch (e) {
    log.error('Ready email failed (non-fatal)', e, { orderId: order.id });
  }
}

export async function deriveStartingStage(
  orderId: string,
  job: { textDone: boolean; imagesDone: boolean; audioDone: boolean; packaged: boolean },
  cache: PipelineCache
): Promise<ChunkStage> {
  if (!job.textDone || !cache.textFinalized) return 'text';
  if (!cache.dna?.childDNA) return 'dna';
  const book = await prisma.generatedBook.findUnique({
    where: { orderId },
    select: { coverImageUrl: true },
  });
  const hasCover = Boolean(book?.coverImageUrl?.trim() || cache.devSkipCover);
  if (!hasCover) return 'cover';
  if (!job.imagesDone) return 'page_images';
  if (!job.audioDone) return 'audio';
  if (!job.packaged) return 'package';
  return 'done';
}

export async function processGenerationChunk(
  orderId: string,
  workerId: string
): Promise<ChunkProcessResult> {
  const startedAt = Date.now();
  const budgetMs = getWorkerBudgetMs();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { stage: 'failed', done: true, stopChunk: true, error: 'Order not found' };

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!job) return { stage: 'failed', done: true, stopChunk: true, error: 'Job not found' };

  if (job.status === 'done' || job.currentStage === 'done') {
    return { stage: 'done', done: true, stopChunk: true };
  }
  if (job.status === 'failed' && !job.retryable) {
    return { stage: 'failed', done: true, stopChunk: true, error: job.lastError ?? undefined };
  }

  let cache = parsePipelineCache(job.pipelineCache);
  let stage: ChunkStage =
    job.currentStage === 'pending' || job.currentStage === 'failed'
      ? await deriveStartingStage(orderId, job, cache)
      : (job.currentStage as ChunkStage);
  if (stage === 'failed') stage = await deriveStartingStage(orderId, job, cache);

  try {
    while (!overBudget(startedAt, budgetMs)) {
      await heartbeatLease(orderId, workerId);

      if (stage === 'text') {
        await updateStage(orderId, 'text');
        cache = await runTextStage(order, cache);
        await saveCache(orderId, cache);
        stage = 'dna';
        continue;
      }

      if (stage === 'dna') {
        await updateStage(orderId, 'dna');
        cache = await runDnaStage(order, cache);
        stage = 'cover';
        continue;
      }

      if (stage === 'cover') {
        await updateStage(orderId, 'cover');
        await runCoverStage(order, cache);
        stage = 'page_images';
        continue;
      }

      if (stage === 'page_images') {
        await updateStage(orderId, 'page_images');
        const img = await runPageImagesChunk(order, cache, startedAt, budgetMs);
        cache = img.cache;
        if (img.failed) {
          return { stage: 'failed', done: true, stopChunk: true };
        }
        const refreshed = await prisma.generationJob.findUnique({ where: { orderId } });
        if (refreshed?.imagesDone) {
          stage = 'audio';
        } else {
          return { stage: 'page_images', done: false, stopChunk: true };
        }
        continue;
      }

      if (stage === 'audio') {
        await updateStage(orderId, 'audio');
        const stop = await runAudioChunk(order, startedAt, budgetMs);
        if (stop) return { stage: 'audio', done: false, stopChunk: true };
        stage = 'package';
        continue;
      }

      if (stage === 'package') {
        await updateStage(orderId, 'package');
        await runPackageStage(order);
        return { stage: 'done', done: true, stopChunk: false };
      }

      break;
    }

    return { stage, done: false, stopChunk: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Chunk failed', error, { orderId });
    await prisma.generationJob.update({
      where: { orderId },
      data: {
        status: 'failed',
        currentStage: 'failed',
        failedAt: new Date(),
        lastError: msg,
        retryable: true,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'failed', lastError: msg, errorAt: new Date() },
    });
    return { stage: 'failed', done: true, stopChunk: true, error: msg };
  }
}
