import type { Order } from '@prisma/client';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import { loadStoryFromBank, StoryBankPersonalizationError } from '@/backend/providers/story-bank-loader';
import { selectCompanionStory, STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';
import { buildLetterContextFromOrder, buildPatchContextFromOrder } from '@/backend/providers/personalization';
import { getWizardMeta } from '@/lib/orderMeta';
import {
  assertStoryPersonalizationGate,
  normalizeWizardChildGender,
  StoryPersonalizationGateError,
} from '@/lib/story-bank-personalization';
import {
  compositionRulesForTemplate,
  effectiveStoryDirectionForV3,
} from './helpers';
import type { PipelineCache } from './types';
import { resolveCachedStoryFilePath, toRepoRelativeStoryPath } from './story-path';
import { resolveCompanionForOrder } from './anchor-registry';
import { beatsFromStoryPages, resolveBookShotPlan } from '@/lib/book-shot-plan';
import { buildFrozenStoryProductTruth } from './frozen-product-truth';
import { withDeliveryInputMutation } from './readiness-manifest';

/**
 * PRE-SPEND gate: load, personalize, validate, and persist final story text.
 * Must complete before any paid image/audio generation.
 */
export async function finalizeAndPersistStoryText(
  order: Order,
  cache: PipelineCache
): Promise<{ cache: PipelineCache; expectedPageCount: number }> {
  await prisma.order.update({ where: { id: order.id }, data: { textStatus: 'running' } });

  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = resolveCompanionForOrder(order);
  const challengeCategory = wizardMeta.challengeCategory ?? order.topic ?? 'GENERAL_FEARS';
  const storyLength = (order.storyLength as 'short' | 'medium' | 'long') ?? 'medium';
  const directionForV3 = effectiveStoryDirectionForV3(order.storyDirection, storyLength);

  let storyFilePath = resolveCachedStoryFilePath(cache);
  if (!storyFilePath) {
    const selection = selectCompanionStory(resolvedCompanion?.id, directionForV3);
    if (!selection) {
      throw new StoryBankPersonalizationError(
        `No companion story file for companion=${resolvedCompanion?.id ?? '(none)'} direction=${directionForV3} — ` +
          'v1 category/raw fallback removed; bind a v3-approved golden for this product.'
      );
    }
    const storyDir = selection.dirName ?? STORY_BANK_V3_DIR_NAME;
    storyFilePath = path.join(process.cwd(), 'story-bank', storyDir, selection.filename);
    cache = {
      ...cache,
      // Store the story ref REPO-RELATIVE (0095 P0) — absolute paths must not enter pipelineCache.
      storyFilePath: toRepoRelativeStoryPath(storyFilePath),
      storyDir,
      storyBankVersion: 'v3',
      selectionFilename: selection.filename,
      directionForV3,
      challengeCategory,
    };
  }

  const maxPages =
    storyLength === 'long' ? 20 : storyLength === 'short' ? 10 : 15;

  let story;
  try {
    story = await loadStoryFromBank(
      storyFilePath,
      order.childName || '',
      resolvedCompanion?.name ?? 'צפרדע',
      order.childGender || undefined,
      {
        maxPages: cache.devStoryBankFile ? maxPages : undefined,
        skipLlmPersonalization: cache.skipLlmPersonalization === true,
        patchContext: buildPatchContextFromOrder(order, wizardMeta),
        letterContext:
          resolvedCompanion?.id && resolvedCompanion?.name
            ? buildLetterContextFromOrder(order, wizardMeta, {
                id: resolvedCompanion.id,
                name: resolvedCompanion.name,
              })
            : null,
      }
    );
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        textStatus: 'failed',
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    await prisma.generationJob.update({
      where: { orderId: order.id },
      data: {
        status: 'failed',
        currentStage: 'failed',
        retryable: true,
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  if (story.pages.length === 0) {
    throw new StoryBankPersonalizationError('Story has zero pages after personalization');
  }
  if (cache.expectedPageCount != null && story.pages.length !== cache.expectedPageCount) {
    throw new StoryBankPersonalizationError(
      `Story page count ${story.pages.length} !== expected ${cache.expectedPageCount}`
    );
  }

  try {
    assertStoryPersonalizationGate({
      pages: story.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        imagePrompt: p.imagePrompt,
      })),
      wizard: {
        childName: order.childName || '',
        childGender: normalizeWizardChildGender(order.childGender),
        companionName: resolvedCompanion?.name ?? '',
      },
    });
  } catch (err) {
    const msg =
      err instanceof StoryPersonalizationGateError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    throw new StoryBankPersonalizationError(msg);
  }

  const compositionByPage = new Map(
    (story.pageCompositionPlan ?? []).map((c) => [c.pageNumber, c])
  );
  const assignedTemplates = assignTemplatesForBook(
    story.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imageSubject: p.imageSubject,
      pageIntent: compositionByPage.get(p.pageNumber)?.pageIntent,
    }))
  );
  const templateByPage = new Map<number, BookPageTemplate>(
    story.pages.map((p, i) => [p.pageNumber, assignedTemplates[i] ?? 'art_top_text_bottom'])
  );

  const frozenTruth = buildFrozenStoryProductTruth({
    storyFilePath,
    expectedPageCount: story.pages.length,
    storyDirection: directionForV3,
  });

  await withDeliveryInputMutation(
    prisma,
    { orderId: order.id, reason: 'story_text_finalized', frozenTruth },
    async (tx) => {
      let book = await tx.generatedBook.findUnique({ where: { orderId: order.id } });
      if (!book) {
        book = await tx.generatedBook.create({
          data: {
            orderId: order.id,
            title: order.bookName || story.title,
            coverText: story.coverText,
          },
        });
      }

      const existingPages = await tx.bookPage.findMany({
        where: { bookId: book.id },
        select: { id: true, pageNumber: true },
      });
      const byNumber = new Map(existingPages.map((p) => [p.pageNumber, p.id]));

      for (const page of story.pages) {
        const template = templateByPage.get(page.pageNumber);
        const existingId = byNumber.get(page.pageNumber);
        if (existingId) {
          await tx.bookPage.update({
            where: { id: existingId },
            data: {
              text: page.text,
              narrationText: page.narrationText,
              pageTemplate: template,
            },
          });
        } else {
          await tx.bookPage.create({
            data: {
              bookId: book.id,
              pageNumber: page.pageNumber,
              text: page.text,
              narrationText: page.narrationText,
              pageTemplate: template,
            },
          });
        }
      }
    },
  );

  const bookShotPlan = resolveBookShotPlan({
    storyFilePath,
    pages: beatsFromStoryPages(story.pages),
  });

  const nextCache: PipelineCache = {
    ...cache,
    // Repo-relative — never an absolute path in cache (0095 P0).
    storyFilePath: toRepoRelativeStoryPath(storyFilePath),
    directionForV3,
    challengeCategory,
    textFinalized: true,
    expectedPageCount: story.pages.length,
    bookShotPlan,
  };

  await prisma.order.update({ where: { id: order.id }, data: { textStatus: 'done' } });
  await prisma.generationJob.update({
    where: { orderId: order.id },
    data: { textDone: true },
  });

  return { cache: nextCache, expectedPageCount: story.pages.length };
}
