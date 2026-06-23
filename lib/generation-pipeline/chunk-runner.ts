/**
 * Chunked generation worker — one bounded unit of work per invocation.
 */
import { Prisma, type Order } from '@prisma/client';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import {
  assertOrderStyleSellable,
  assertShippedBookStyleEngineActive,
  resolveOrderStyleBranch,
} from '@/lib/image-engine-guard';
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
  assertCacheHasNoLocalArtifactPaths,
  isServerlessRuntime,
} from './runtime-artifact-store';
import { resolveCachedStoryFilePath } from './story-path';
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '@/lib/illustrationPresentation';
import { storePresentationBuffer, storeImageFromDataUrl, uploadOrderSubpathAsset } from '@/lib/image-storage';
import { mergeGptImageReferenceSources } from '@/lib/image-reference-utils';
import {
  buildPersistedCharacterAnchorsJson,
  companionAnchorKey,
  getWizardMeta,
} from '@/lib/orderMeta';
import { buildLetterContextFromOrder, buildPatchContextFromOrder } from '@/backend/providers/personalization';
import { ROUTES } from '@/lib/routes';
import {
  mergeOriginalChildPhotoUrlIntoAnchors,
  tryDeleteOriginalChildPhotoAfterGeneration,
} from '@/lib/child-photo-deletion';
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
import {
  evaluatePhotoGate,
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
  scoreResemblanceAgainstReference,
} from '@/lib/resemblance-core';
import { generateGPTImage } from '@/lib/generate-image';
import {
  applyDevHairOverrideToPhotoDescription,
  resolveDevChildHairOverride,
} from '@/lib/child-photo-hair';
import { STYLE_01_AVOIDANCE_NEGATIVE, assertCompanionSheetRenderable } from '@/lib/style01-gptimage';
import {
  buildStage0MethodBPrompt,
  generateStage0MethodBAnchor,
} from '@/lib/generation-pipeline/stage0-method-b';
import {
  buildStage0Style02Prompt,
  generateStage0Style02Anchor,
} from '@/lib/generation-pipeline/stage0-method-style02';
import { resolveStyle02BookWardrobeLock } from '@/lib/style02-gptimage';
import { resolveStyle01StoryWardrobeLock } from '@/lib/style01-story-wardrobe';
import {
  ensureFamilyCoherenceBundle,
  getFamilyCoherenceFromAnchors,
  persistFamilyCoherenceOnOrder,
} from '@/lib/family-coherence';
import { evaluateAnchorStyleFromVision } from '@/lib/anchor-style-qa';
import {
  evaluateAnchorEmbeddingScore,
  evaluateAnchorSemanticQa,
  isChildAnchorReviewApproved,
  resolveAnchorGateConfig,
} from '@/lib/anchor-resemblance-gate';
import {
  getApprovedChildCanonicalAnchor,
  getChildCanonicalAnchor,
  getCharacterAnchorStore,
  isChildExpressionSheetActive,
  resolveApprovedExpressionAnchorUrl,
  upsertCharacterAnchor,
} from './character-anchor-store';
import { resolveChildExpressionKindForPage } from './child-expression-page-map';
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
  // Cross-chunk invariant: in the cloud the cache must carry only durable URLs/descriptors — a local
  // artifact path would not exist in the next invocation. Fail loud rather than render against a
  // phantom path. Local dev is unaffected (the guard only fires on a serverless runtime).
  if (isServerlessRuntime()) assertCacheHasNoLocalArtifactPaths(cache);
  await prisma.generationJob.update({
    where: { orderId },
    data: { pipelineCache: cache as Prisma.InputJsonValue },
  });
}

function persistChildAnchorOnOrder(
  order: Order,
  childPatch: Record<string, unknown>
): Prisma.OrderUpdateInput['characterAnchors'] {
  const existingAnchors =
    order.characterAnchors && typeof order.characterAnchors === 'object'
      ? (order.characterAnchors as Record<string, unknown>)
      : {};
  return {
    ...existingAnchors,
    child: {
      ...(existingAnchors.child as Record<string, unknown> | undefined),
      ...childPatch,
    },
  } as Prisma.InputJsonValue;
}

async function promotePendingChildAnchorToPassed(
  order: Order,
  cache: PipelineCache
): Promise<PipelineCache> {
  const child = getChildCanonicalAnchor(cache);
  if (!child?.url) return cache;
  const anchorGate = resolveAnchorGateConfig();
  const approved = isChildAnchorReviewApproved(order.id, cache, order);
  if (!approved) return cache;

  const nextCache: PipelineCache = {
    ...cache,
    childAnchorApproved: true,
    characterAnchorStore: upsertCharacterAnchor(cache, {
      ...child,
      qaStatus: 'passed',
      updatedAt: new Date().toISOString(),
    }).characterAnchorStore,
  };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      characterAnchors: persistChildAnchorOnOrder(order, {
        anchorImageUrl: child.url,
        anchorType: 'canonical_portrait',
        source: child.source,
        qaStatus: 'passed',
        anchorApproved: true,
        anchorQuality: child.anchorQuality,
        styleId: child.styleId,
        provider: child.provider,
        model: child.model,
        promptUsed: child.promptUsed,
        inputDescriptionUsed: child.inputDescriptionUsed,
        referenceOrderUsed: child.referenceOrderUsed,
        resemblanceScore: child.resemblanceScore,
        thresholdUsed: child.thresholdUsed,
        qaNotes: child.qaNotes,
      }),
    },
  });

  console.log(
    `[anchor_review] orderId=${order.id} promoted pending anchor to passed ` +
      `score=${(child.resemblanceScore ?? 0).toFixed(3)} pageThreshold=${anchorGate.embeddingStrongAt} (unchanged)`
  );
  return nextCache;
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
  if (getApprovedChildCanonicalAnchor(cache)) {
    await saveCache(order.id, cache);
    return cache;
  }

  let nextCache: PipelineCache = cache;

  if (cache.dna?.childDNA) {
    // DNA already finalized — continue to Stage 0 / pending promotion only.
  } else {
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

  let childReferenceImageUrl = order.childImageUrl ?? '';
  if (childReferenceImageUrl.startsWith('data:image/')) {
    // Canonicalize inline uploads to a stable URL so all gates read identical bytes.
    childReferenceImageUrl = await storeImageFromDataUrl({
      dataUrl: childReferenceImageUrl,
      orderId: order.id,
      assetPath: `references/stage0-child-photo-${Date.now()}`,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        childImageUrl: childReferenceImageUrl,
        characterAnchors: mergeOriginalChildPhotoUrlIntoAnchors(
          order.characterAnchors,
          childReferenceImageUrl
        ) as Prisma.InputJsonValue,
      },
    });
    order.childImageUrl = childReferenceImageUrl;
  }

  let childPhotoDescription: string | null = null;
  if (childReferenceImageUrl) {
    try {
      childPhotoDescription = await describeChildFromPhoto(childReferenceImageUrl);
      const devHairOverride = resolveDevChildHairOverride({
        orderId: order.id,
        childName: order.childName ?? undefined,
      });
      if (devHairOverride) {
        childPhotoDescription = applyDevHairOverrideToPhotoDescription(
          childPhotoDescription,
          devHairOverride
        );
        console.log(
          `[PhotoHair] Applied DEV_CHILD_PHOTO_HAIR_OVERRIDE for orderId=${order.id} childName=${order.childName ?? ''}`
        );
      }
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

  const familyBundle = ensureFamilyCoherenceBundle(order, {
    childPhotoDescription,
    childStructured: dna.childStructured,
  });
  await prisma.order.update({
    where: { id: order.id },
    data: {
      characterAnchors: persistFamilyCoherenceOnOrder(
        order.characterAnchors,
        familyBundle
      ) as Prisma.InputJsonValue,
    },
  });
  order.characterAnchors = persistFamilyCoherenceOnOrder(
    order.characterAnchors,
    familyBundle
  ) as Prisma.JsonValue;

  nextCache = {
    ...cache,
    lockedChildDescription,
    childPhotoDescription,
    familyCoherence: familyBundle,
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
  }

  const lockedChildDescription =
    nextCache.lockedChildDescription?.trim() ||
    nextCache.dna?.childDNA?.trim() ||
    `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old`;
  const childPhotoDescription = nextCache.childPhotoDescription ?? null;

  // Stage 0 (once per order): create canonical child anchor in book style.
  let existingChildAnchor = getChildCanonicalAnchor(nextCache);
  if (!existingChildAnchor && (nextCache.stage0AnchorCandidates?.length ?? 0) > 0) {
    const { attachPendingChildAnchorFromCandidate, pickStage0Candidate } = await import(
      './stage0-candidate-recovery'
    );
    const recovered = pickStage0Candidate(nextCache);
    if (recovered) {
      nextCache = attachPendingChildAnchorFromCandidate(order, nextCache, recovered);
      existingChildAnchor = getChildCanonicalAnchor(nextCache);
      console.log(
        `[anchor_stage0] orderId=${order.id} recovered pending anchor from candidate attempt=${recovered.attempt} score=${(recovered.resemblanceScore ?? 0).toFixed(3)}`
      );
    }
  }

  const existingChildAnchorForGate = existingChildAnchor;
  if (getApprovedChildCanonicalAnchor(nextCache)) {
    await saveCache(order.id, nextCache);
    return nextCache;
  } else if (existingChildAnchorForGate?.qaStatus === 'pending_review') {
    nextCache = await promotePendingChildAnchorToPassed(order, nextCache);
    if (!getApprovedChildCanonicalAnchor(nextCache)) {
      await saveCache(order.id, nextCache);
      throw new Error(
        `ANCHOR_REVIEW_REQUIRED: child anchor awaits human approval (bestScore=${(
          existingChildAnchorForGate.resemblanceScore ?? 0
        ).toFixed(3)}). Set CHILD_ANCHOR_REVIEW_OK=true or CHILD_ANCHOR_REVIEW_OK_ORDER_IDS=${order.id} after eyeball QA.`
      );
    }
    await saveCache(order.id, nextCache);
  } else if (
    !existingChildAnchorForGate &&
    (order.childImageUrl ?? '').trim() &&
    process.env.GENERATION_ANCHOR_EXPERIMENT === 'true'
  ) {
    throw new Error(
      'GENERATION_ANCHOR_EXPERIMENT=true: use scripts/run-stage0-anchor-experiment.ts instead of production Stage 0'
    );
  } else if (!existingChildAnchorForGate && (order.childImageUrl ?? '').trim()) {
    const childReferenceImageUrl = order.childImageUrl ?? '';
    const stage0Companion = resolveCompanionForOrder(order);
    const orderBranch = resolveOrderStyleBranch(order.illustrationStyle);
    const storyFilePath = resolveCachedStoryFilePath(cache);
    const storyFileKey = storyFilePath ? path.basename(storyFilePath, '.md') : undefined;
    const storyWardrobe = resolveStyle01StoryWardrobeLock(stage0Companion?.id, storyFileKey, {
      category: cache.challengeCategory,
    });
    const style02Wardrobe =
      orderBranch === 'style02'
        ? resolveStyle02BookWardrobeLock({
            companionId: stage0Companion?.id,
            childStructured: nextCache.dna?.childStructured,
          })
        : null;
    const wardrobeLock =
      orderBranch === 'style02'
        ? style02Wardrobe!.lock
        : (storyWardrobe ?? '');
    const anchorPrompt =
      orderBranch === 'style02'
        ? buildStage0Style02Prompt({
            order,
            lockedChildDescription,
            wardrobeLock,
            childPhotoDescription,
          })
        : buildStage0MethodBPrompt({
            order,
            lockedChildDescription,
            wardrobeLock,
            childPhotoDescription,
          });
    const thresholdConfig = resolveResemblanceThresholdConfig();
    const effectiveThreshold = resolveEffectiveThreshold(order.illustrationStyle, thresholdConfig);
    const anchorGateConfig = resolveAnchorGateConfig();
    const maxAnchorAttempts = Math.min(
      4,
      Math.max(1, Number.parseInt(process.env.CHILD_ANCHOR_MAX_ATTEMPTS ?? '3', 10) || 3)
    );
    const candidateRows: NonNullable<PipelineCache['stage0AnchorCandidates']> = [];
    let bestResult:
      | Awaited<ReturnType<typeof generateStage0MethodBAnchor>>
      | Awaited<ReturnType<typeof generateStage0Style02Anchor>>
      | null = null;
    let bestAttempt = 0;
    for (let attempt = 1; attempt <= maxAnchorAttempts; attempt += 1) {
      const result =
        orderBranch === 'style02'
          ? await generateStage0Style02Anchor({
              order,
              childPhotoUrl: childReferenceImageUrl,
              lockedChildDescription,
              wardrobeLock,
              childPhotoDescription,
              childStructuredHair: nextCache.dna?.childStructured?.hair,
              attemptSuffix: `a${attempt}`,
            })
          : await generateStage0MethodBAnchor({
              order,
              childPhotoUrl: childReferenceImageUrl,
              lockedChildDescription,
              wardrobeLock,
              childPhotoDescription,
              childStructuredHair: nextCache.dna?.childStructured?.hair,
              attemptSuffix: `a${attempt}`,
            });
      candidateRows.push({
        attempt,
        url: result.anchorUrl,
        model: result.anchorModel,
        resemblanceScore: result.resemblanceScore,
        faceDetectConfidence: 1,
        embeddingVerdict: result.embeddingVerdict as 'hard_fail' | 'soft_ok',
        semanticPass: result.semantic.ok,
        createdAt: new Date().toISOString(),
      });
      if (!bestResult || result.resemblanceScore > bestResult.resemblanceScore) {
        bestResult = result;
        bestAttempt = attempt;
      }
      console.log(
        `[anchor_stage0_attempt] orderId=${order.id} method=B attempt=${attempt}/${maxAnchorAttempts} ` +
          `score=${result.resemblanceScore.toFixed(3)} embeddingVerdict=${result.embeddingVerdict}`
      );
      // Persist candidates incrementally so a transient blip (upload/fetch) on a LATER
      // attempt does not discard anchors already generated this run. The Stage-0 recovery
      // path (pickStage0Candidate / attachPendingChildAnchorFromCandidate) resumes from
      // these on the next retry instead of re-spending GPT image generation from scratch.
      nextCache.stage0AnchorCandidates = [...candidateRows];
      nextCache.stage0AnchorPrompt = anchorPrompt;
      await saveCache(order.id, nextCache);
    }
    if (!bestResult) {
      throw new Error('ANCHOR_QA_BLOCK: no anchor candidates generated');
    }
    const anchorUrl = bestResult.anchorUrl;
    const anchorModel = bestResult.anchorModel;
    const anchorReferenceImages = bestResult.referenceImages;
    const anchorReferenceOrderLabels = bestResult.referenceOrderLabels;
    const similarity = { resemblanceScore: bestResult.resemblanceScore, faceDetectConfidence: 1 };
    const embeddingEval = evaluateAnchorEmbeddingScore(bestResult.resemblanceScore, anchorGateConfig);
    const semantic = bestResult.semantic;
    const anchorPhotoDescription = await describeChildFromPhoto(anchorUrl).catch(() => null);
    for (const row of candidateRows) {
      row.semanticPass = semantic.ok;
      row.passed = row.attempt === bestAttempt && semantic.ok && row.embeddingVerdict !== 'hard_fail';
    }
    nextCache.stage0AnchorCandidates = candidateRows;
    nextCache.stage0AnchorPrompt = anchorPrompt;
    nextCache.stage0AnchorReferenceOrderLabels = anchorReferenceOrderLabels;
    nextCache.stage0SelectedAttempt = bestAttempt;

    if (embeddingEval.hardFail) {
      await saveCache(order.id, nextCache);
      throw new Error(
        `ANCHOR_QA_BLOCK: embedding hard-fail (bestScore=${similarity.resemblanceScore.toFixed(3)} ` +
          `< ${anchorGateConfig.embeddingHardFailBelow}) — clearly wrong identity`
      );
    }
    if (!semantic.ok) {
      await saveCache(order.id, nextCache);
      throw new Error(
        `ANCHOR_QA_BLOCK: semantic checks failed (genderMismatch=${semantic.genderMismatch} ` +
          `missingHairTraits=${semantic.missingHairTraits.join('|') || 'none'} ` +
          `faceDetectOk=${semantic.faceDetectOk} bestScore=${similarity.resemblanceScore.toFixed(3)})`
      );
    }

    const styleQa = bestResult.styleQa;
    if (!styleQa.ok) {
      await saveCache(order.id, nextCache);
      throw new Error(
        orderBranch === 'style02'
          ? `ANCHOR_QA_BLOCK: Style 02 anchor HARD fail — not semi-realistic illustrated storybook (photorealCutout=${'looksPhotorealCutout' in styleQa ? styleQa.looksPhotorealCutout : false} portrait=${styleQa.looksPortrait} notes=${styleQa.notes})`
          : `ANCHOR_QA_BLOCK: style HARD fail — not cute Style 01 watercolor (photoreal=${'looksPhotoreal' in styleQa ? styleQa.looksPhotoreal : false} portrait=${styleQa.looksPortrait} notes=${styleQa.notes})`
      );
    }

    const reviewApproved = isChildAnchorReviewApproved(order.id, nextCache, order);
    const qaStatus = reviewApproved ? 'passed' : 'pending_review';
    nextCache.childAnchorApproved = reviewApproved;

    nextCache.characterAnchorStore = upsertCharacterAnchor(nextCache, {
      orderId: order.id,
      styleId: order.illustrationStyle,
      characterId: 'child',
      role: 'child',
      anchorType: 'canonical_portrait',
      source: 'uploaded_photo',
      url: anchorUrl,
      provider: 'openai',
      model: anchorModel,
      quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
      promptUsed: anchorPrompt,
      inputDescriptionUsed: lockedChildDescription,
      referenceOrderUsed: anchorReferenceImages,
      qaStatus,
      anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
      resemblanceScore: similarity.resemblanceScore,
      thresholdUsed: effectiveThreshold,
      qaNotes: [
        anchorPhotoDescription ?? '',
        `anchorGate: embedding=${embeddingEval.verdict} score=${similarity.resemblanceScore.toFixed(3)}`,
        `pageThreshold=${effectiveThreshold.toFixed(3)} (unchanged)`,
      ]
        .filter(Boolean)
        .join(' | '),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).characterAnchorStore;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        characterAnchors: persistChildAnchorOnOrder(order, {
          anchorImageUrl: anchorUrl,
          anchorType: 'canonical_portrait',
          source: 'uploaded_photo',
          qaStatus,
          anchorApproved: reviewApproved,
          anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
          styleId: order.illustrationStyle,
          provider: 'openai',
          model: anchorModel,
          promptUsed: anchorPrompt,
          inputDescriptionUsed: lockedChildDescription,
          referenceOrderUsed: anchorReferenceImages,
          resemblanceScore: similarity.resemblanceScore,
          thresholdUsed: effectiveThreshold,
          qaNotes: anchorPhotoDescription ?? undefined,
        }),
      },
    });

    if (!reviewApproved) {
      await saveCache(order.id, nextCache);
      throw new Error(
        `ANCHOR_REVIEW_REQUIRED: semantic checks passed; embedding soft-ok (bestScore=${similarity.resemblanceScore.toFixed(
          3
        )}, pageThreshold=${effectiveThreshold.toFixed(3)} unchanged). ` +
          `Eyeball candidate attempt ${bestAttempt} then set CHILD_ANCHOR_REVIEW_OK=true or ` +
          `CHILD_ANCHOR_REVIEW_OK_ORDER_IDS=${order.id} and re-run DNA stage.`
      );
    }
    console.log(
      `[anchor_stage0] orderId=${order.id} approved score=${similarity.resemblanceScore.toFixed(3)} attempt=${bestAttempt}`
    );
  }

  const resolvedCompanionForStore = resolveCompanionForOrder(order);
  if (resolvedCompanionForStore?.image) {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const companionUrl = resolvedCompanionForStore.image.startsWith('http')
      ? resolvedCompanionForStore.image
      : `${appBaseUrl}${resolvedCompanionForStore.image.startsWith('/') ? '' : '/'}${resolvedCompanionForStore.image}`;
    nextCache.characterAnchorStore = upsertCharacterAnchor(nextCache, {
      orderId: order.id,
      styleId: order.illustrationStyle,
      characterId: companionAnchorKey(resolvedCompanionForStore.id),
      role: 'companion',
      anchorType: 'predefined_sheet',
      source: 'companion_sheet',
      url: companionUrl,
      provider: 'static',
      model: 'n/a',
      quality: 'source',
      qaStatus: 'passed',
      anchorQuality: 'source',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).characterAnchorStore;
    const existingAnchors =
      order.characterAnchors && typeof order.characterAnchors === 'object'
        ? (order.characterAnchors as Record<string, unknown>)
        : {};
    await prisma.order.update({
      where: { id: order.id },
      data: {
        characterAnchors: {
          ...existingAnchors,
          [companionAnchorKey(resolvedCompanionForStore.id)]: {
            ...((existingAnchors[companionAnchorKey(resolvedCompanionForStore.id)] as Record<string, unknown>) ?? {}),
            anchorImageUrl: companionUrl,
            anchorType: 'predefined_sheet',
            source: 'companion_sheet',
            qaStatus: 'passed',
            styleId: order.illustrationStyle,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  const babyDragonAnchorUrl = process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim();
  if (babyDragonAnchorUrl && resolvedCompanionForStore?.id === 'dragon_dini') {
    nextCache.characterAnchorStore = upsertCharacterAnchor(nextCache, {
      orderId: order.id,
      styleId: order.illustrationStyle,
      characterId: 'baby_dragon:dini_hatchling',
      role: 'creature',
      anchorType: 'predefined_sheet',
      source: 'static_asset',
      url: babyDragonAnchorUrl,
      provider: 'static',
      model: 'n/a',
      quality: 'source',
      qaStatus: 'passed',
      anchorQuality: 'source',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).characterAnchorStore;
    const existingAnchors =
      order.characterAnchors && typeof order.characterAnchors === 'object'
        ? (order.characterAnchors as Record<string, unknown>)
        : {};
    await prisma.order.update({
      where: { id: order.id },
      data: {
        characterAnchors: {
          ...existingAnchors,
          'baby_dragon:dini_hatchling': {
            ...(existingAnchors['baby_dragon:dini_hatchling'] as Record<string, unknown> | undefined),
            name: 'Baby Dragon Hatchling',
            description:
              'Moss-green baby dragon with copper freckles, peach-coral oversized wings, and soft rounded head bumps.',
            relationship: 'creature',
            aliases: ['baby dragon', 'hatchling', 'dini hatchling', 'דרקון קטן'],
            anchorImageUrl: babyDragonAnchorUrl,
            anchorType: 'predefined_sheet',
            source: 'static_asset',
            qaStatus: 'passed',
            styleId: order.illustrationStyle,
          },
        },
      },
    });
  }

  await saveCache(order.id, nextCache);
  return nextCache;
}

async function ensureStoryLocationPlan(
  order: Order,
  cache: PipelineCache,
  storyFilePath: string,
  story: Awaited<ReturnType<typeof loadStoryFromBank>>,
  challengeCategory: string | null | undefined
): Promise<{ cache: PipelineCache; storyLocationPlan: import('@/lib/story-location-bible').StoryLocationPlanBundle }> {
  const cached = cache.storyLocationPlan as
    | import('@/lib/story-location-bible').StoryLocationPlanBundle
    | undefined;
  if (cached?.bible && cached.pagePlans?.length) {
    const { enrichStoryLocationPlanWithReferenceSheets } = await import('@/lib/story-location-bible/zone-sheets');
    const storyLocationPlan = enrichStoryLocationPlanWithReferenceSheets(cached, storyFilePath);
    const nextCache = { ...cache, storyLocationPlan };
    return { cache: nextCache, storyLocationPlan };
  }
  const { beatsFromStoryPages } = await import('@/lib/book-shot-plan');
  const { resolveStoryLocationPlan } = await import('@/lib/story-location-bible');
  const storyLocationPlan = resolveStoryLocationPlan({
    storyFilePath,
    challengeCategory,
    direction: cache.directionForV3,
    pages: beatsFromStoryPages(story.pages),
  });
  const nextCache = { ...cache, storyLocationPlan };
  await saveCache(order.id, nextCache);
  return { cache: nextCache, storyLocationPlan };
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
  const childCanonicalAnchor = getApprovedChildCanonicalAnchor(cache);
  const pendingChildAnchor = getChildCanonicalAnchor(cache);
  if (!childCanonicalAnchor?.url) {
    if (pendingChildAnchor?.qaStatus === 'pending_review') {
      throw new Error(
        `ANCHOR_REVIEW_REQUIRED: child anchor pending human approval (score=${(pendingChildAnchor.resemblanceScore ?? 0).toFixed(3)}).`
      );
    }
    throw new Error('ANCHOR_GATE_BLOCK: approved child canonical anchor missing before cover generation.');
  }
  const gptReferenceImages = mergeGptImageReferenceSources(
    childCanonicalAnchor.url,
    resolvedCompanion,
    appBaseUrl
  );

  const storyFilePath = resolveCachedStoryFilePath(cache);
  if (!storyFilePath) throw new Error('storyFilePath missing in pipeline cache');

  const story = await loadStoryFromBank(
    storyFilePath,
    order.childName || '',
    resolvedCompanion?.name ?? 'צפרדע',
    order.childGender || undefined,
    // v3-approved bank stories personalize via {{childName}} + gender chips (deterministic).
    // Do NOT run LLM gender/name rewrite on the production path — chips are QA'd at import.
    { skipLlmPersonalization: true }
  );

  // Fail loudly BEFORE paid cover generation when the companion has no published sheet.
  assertCompanionSheetRenderable(resolvedCompanion);

  const { cache: cacheWithLocation, storyLocationPlan } = await ensureStoryLocationPlan(
    order,
    cache,
    storyFilePath,
    story,
    cache.challengeCategory ?? wizardMeta.challengeCategory
  );
  const { resolvePageLocationPlan } = await import('@/lib/story-location-bible');
  const coverLocationPlan = resolvePageLocationPlan(storyLocationPlan, 0);

  const coverImage = await generateBookCover({
    childName: order.childName,
    topicLabel,
    storyTitle: story.title,
    coverText: story.coverText,
    coverSceneHint: story.coverSceneHint,
    illustrationStyle: order.illustrationStyle,
    childDescription: lockedChildDescription,
    characterSheet: story.characterSheet,
    referenceImages: gptReferenceImages,
    orderId: order.id,
    childAge: order.childAge,
    childGender: order.childGender,
    heroVisualLock: story.heroVisualLock,
    styleLock: story.styleLock,
    entityVisualLock: story.entityVisualLock,
    // id+image included so the cover resolves the SAME companion sheet refs as pages.
    companion: resolvedCompanion
      ? {
          id: resolvedCompanion.id,
          name: resolvedCompanion.name,
          // Gap-1 rule: registry companion → registry visualDescription, NEVER LLM dna.companionDNA
          // (proven failure: "stuffed gray rabbit" DNA vs canonical cream-white bunny).
          visualDescription: resolvedCompanion.visualDescription,
          image: resolvedCompanion.image,
        }
      : undefined,
    challengeCategory: cacheWithLocation.challengeCategory ?? wizardMeta.challengeCategory ?? null,
    locationBible: storyLocationPlan.bible,
    pageLocationPlan: coverLocationPlan,
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

  const storyFilePath = resolveCachedStoryFilePath(cache);
  if (!storyFilePath) throw new Error('storyFilePath missing');

  if (!cache.textFinalized) {
    throw new Error('PRE-SPEND GATE: text not finalized — abort before paid images');
  }

  let familyCoherenceForImages =
    cache.familyCoherence ?? getFamilyCoherenceFromAnchors(order.characterAnchors) ?? null;
  if (!familyCoherenceForImages && cache.dna?.childStructured) {
    familyCoherenceForImages = ensureFamilyCoherenceBundle(order, {
      childPhotoDescription: cache.childPhotoDescription,
      childStructured: cache.dna.childStructured,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        characterAnchors: persistFamilyCoherenceOnOrder(
          order.characterAnchors,
          familyCoherenceForImages
        ) as Prisma.InputJsonValue,
      },
    });
    cache = { ...cache, familyCoherence: familyCoherenceForImages };
    await saveCache(order.id, cache);
  }

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = resolveCompanionForOrder(order);

  // Fail loudly BEFORE paid page generation when the companion has no published sheet.
  assertCompanionSheetRenderable(resolvedCompanion);

  const story = await loadStoryFromBank(
    storyFilePath,
    order.childName || '',
    resolvedCompanion?.name ?? 'צפרדע',
    order.childGender || undefined,
    // v3-approved bank stories personalize via {{childName}} + gender chips (deterministic).
    // Do NOT run LLM gender/name rewrite on the production path — chips are QA'd at import.
    { skipLlmPersonalization: true }
  );

  let bookShotPlan = cache.bookShotPlan;
  if (!bookShotPlan) {
    const { beatsFromStoryPages, resolveBookShotPlan } = await import('@/lib/book-shot-plan');
    bookShotPlan = resolveBookShotPlan({
      storyFilePath,
      pages: beatsFromStoryPages(story.pages),
    });
    cache = { ...cache, bookShotPlan };
    await saveCache(order.id, cache);
  }

  const { cache: cacheWithLocation, storyLocationPlan } = await ensureStoryLocationPlan(
    order,
    cache,
    storyFilePath,
    story,
    cache.challengeCategory ?? wizardMeta.challengeCategory
  );
  cache = cacheWithLocation;

  const { resolveSceneMemoryPlan } = await import('@/lib/scene-memory');
  const sceneMemoryPlan = resolveSceneMemoryPlan({
    storyLocationPlan,
    bookShotPlan: bookShotPlan as import('@/lib/book-shot-plan').BookShotPlan,
  });

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
  const babyAnchorUrl =
    process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim() ||
    (getCharacterAnchorStore(cache)['baby_dragon:dini_hatchling'] as { url?: string } | undefined)?.url;
  if (babyAnchorUrl) {
    initialCharacterAnchors['baby_dragon:dini_hatchling'] = babyAnchorUrl;
    anchorRegistry['baby_dragon:dini_hatchling'] = {
      name: 'Baby Dragon Hatchling',
      description:
        'Moss-green newborn hatchling with copper freckles — much smaller than Dini; soft cute proportions.',
      relationship: 'creature',
      anchorImageUrl: babyAnchorUrl,
      aliases: ['baby dragon', 'hatchling', 'דרקון תינוק'],
    };
  }
  const pagesWithDetectedCharacters = story.pages.map((p) => {
    const baseIds = detectExpectedCharactersForPage(
      { text: p.text, imagePrompt: p.imagePrompt, imageSubject: p.imageSubject ?? '' },
      anchorRegistry
    );
    const hasBabyDragon = p.pageNumber >= 16 && p.pageNumber <= 19 && Boolean(babyAnchorUrl);
    if (hasBabyDragon) {
      baseIds.push('baby_dragon:dini_hatchling');
    }
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
      const pageShotRaw = bookShotPlan?.pages.find((slot) => slot.page === p.pageNumber);
      const pageShot = pageShotRaw
        ? ({
            page: pageShotRaw.page,
            shot: pageShotRaw.shot,
            angle: pageShotRaw.angle,
            rationale: pageShotRaw.rationale,
          } as import('@/lib/book-shot-plan').PageShot)
        : null;
      const enriched = buildEnrichedScenePrompt({
        rawScenePrompt: p.rawScenePrompt,
        imagePrompt: p.imagePrompt,
        layout: pageLayout,
        text: p.text,
        textZone: null,
        isLetter: p.isLetter,
        pageNumber: p.pageNumber,
        totalPages: story.pages.length,
        pageShot,
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
  const childCanonicalAnchor = getApprovedChildCanonicalAnchor(cache);
  const pendingChildAnchor = getChildCanonicalAnchor(cache);
  const childExpectedOnAnyPage = pagesForGen.some((p) => (p.expectedCharacterIds ?? []).includes('child'));
  if (childExpectedOnAnyPage && !childCanonicalAnchor?.url) {
    if (pendingChildAnchor?.qaStatus === 'pending_review') {
      throw new Error(
        `ANCHOR_REVIEW_REQUIRED: child anchor pending human approval (score=${(pendingChildAnchor.resemblanceScore ?? 0).toFixed(3)}). Per-page resemblance gate unchanged.`
      );
    }
    throw new Error(
      'ANCHOR_GATE_BLOCK: approved child canonical anchor missing. Retry/fail before paid page generation.'
    );
  }
  const gptReferenceImages = mergeGptImageReferenceSources(
    childCanonicalAnchor!.url,
    resolvedCompanion,
    appBaseUrl
  );
  const inputPhotoStrength = order.childImageUrl
    ? await evaluatePhotoGate(order.childImageUrl).then((g) => g.inputStrength).catch(() => 'adequate' as const)
    : 'adequate';
  const resemblanceThresholdConfig = resolveResemblanceThresholdConfig();

  const workerDeadline = deadlineMs(startedAt, budgetMs);
  const expressionSheetActive = isChildExpressionSheetActive(cache);
  const storyFileKey = storyFilePath ? path.basename(storyFilePath, '.md') : undefined;
  const imageOutcome = await generateAllPageImages(pagesForGen, {
    illustrationStyle: order.illustrationStyle,
    childName: order.childName,
    childAge: order.childAge,
    childGender: order.childGender,
    childDescription: lockedChildDescription,
    referenceImages: gptReferenceImages,
    resolvePageChildExpressionRef: expressionSheetActive
      ? (ctx) => {
          const kind = resolveChildExpressionKindForPage({
            ...ctx,
            companionId: resolvedCompanion?.id ?? null,
          });
          const url =
            resolveApprovedExpressionAnchorUrl(cache, kind) ?? childCanonicalAnchor!.url;
          return { url, kind };
        }
      : undefined,
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
          characterAnchors: buildPersistedCharacterAnchorsJson(
            anchorRegistry,
            wizardMeta,
            order.characterAnchors
          ) as Prisma.InputJsonValue,
          ...(resolvedAnchors.child ? { childImageUrl: resolvedAnchors.child } : {}),
        },
      });
    },
    storyRecurringEntityDeclarations: story.storyRecurringEntities,
    storyTimeOfDay: story.storyTimeOfDay,
    pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
    familyCoherence: familyCoherenceForImages,
    bookShotPlan: bookShotPlan as import('@/lib/book-shot-plan').BookShotPlan,
    storyLocationPlan,
    sceneMemoryPlan,
    storyFile: storyFileKey,
    direction: (cache.directionForV3 as 'bedtime' | 'adventure' | 'fantasy' | undefined) ?? undefined,
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
  if (allDone && !imagePageFilter) {
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

async function runPackageStage(order: Order, cache: PipelineCache): Promise<void> {
  const book = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    include: {
      pages: { include: { imageAsset: true }, orderBy: { pageNumber: 'asc' } },
    },
  });
  if (!book) throw new Error('Book missing for package');

  const expectedPages = book.pages.length;
  const withImages = book.pages.filter((p) => shouldSkipPaidPageImageRegen(p.imageAsset)).length;
  // devSkipCover must be honored here exactly like deriveStartingStage does —
  // otherwise dev-skip orders deadlock on "Package blocked: cover=false"
  // (killed orders 8b43e5e7, e6101da7). PDF/reader already handle cover-less
  // books via the book.coverImageUrl conditional below.
  const hasCover = Boolean(
    book.coverImageUrl?.trim() || order.coverImageUrl?.trim() || cache.devSkipCover
  );

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

  await tryDeleteOriginalChildPhotoAfterGeneration(order.id);
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

  // Gap 2 (bunny forensics): Style 02 orders are blocked server-side until the
  // Style 02 gate chain opens — never render an ungated style for a customer.
  assertOrderStyleSellable(order.illustrationStyle, `generation chunk orderId=${orderId}`);

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!job) return { stage: 'failed', done: true, stopChunk: true, error: 'Job not found' };

  if (job.status === 'done' || job.currentStage === 'done') {
    return { stage: 'done', done: true, stopChunk: true };
  }
  if (job.status === 'failed' && !job.retryable) {
    return { stage: 'failed', done: true, stopChunk: true, error: job.lastError ?? undefined };
  }

  let cache = parsePipelineCache(job.pipelineCache);

  // Resume-path approval hook (covers ALL stages): a pending child anchor that
  // was approved after a failure (CHILD_ANCHOR_REVIEW_OK / _ORDER_IDS / cache
  // flag) must be promoted BEFORE stage dispatch. Promotion used to live only
  // inside the DNA stage, which resume skips once childDNA exists — leaving
  // approved orders permanently deadlocked on ANCHOR_REVIEW_REQUIRED at
  // cover/page stages. Unapproved pending anchors still hit the stage throws.
  const pendingChildAnchorAtEntry = getChildCanonicalAnchor(cache);
  if (
    pendingChildAnchorAtEntry?.qaStatus === 'pending_review' &&
    isChildAnchorReviewApproved(order.id, cache, order)
  ) {
    cache = await promotePendingChildAnchorToPassed(order, cache);
    await saveCache(orderId, cache);
  }

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
        if (process.env.GENERATION_ANCHOR_ONLY === 'true') {
          return { stage: 'dna', done: true, stopChunk: true };
        }
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
        await runPackageStage(order, cache);
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
