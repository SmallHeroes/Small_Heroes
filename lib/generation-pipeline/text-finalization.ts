import type { Order } from '@prisma/client';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import { loadStoryFromBank, StoryBankPersonalizationError } from '@/backend/providers/story-bank-loader';
import {
  selectCompanionStory,
  selectStoryFromBank,
  STORY_BANK_V3_DIR_NAME,
} from '@/backend/providers/story-bank-index';
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
import { resolveCompanionForOrder } from './anchor-registry';

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

  let storyFilePath = cache.devStoryBankFile ?? cache.storyFilePath;
  if (!storyFilePath) {
    let selection = selectCompanionStory(resolvedCompanion?.id, directionForV3);
    let storyBankVersion: 'v3' | 'v1' = 'v3';
    if (!selection) {
      selection = selectStoryFromBank(challengeCategory, storyLength);
      storyBankVersion = 'v1';
    }
    if (!selection) {
      throw new StoryBankPersonalizationError(`No story-bank story for category=${challengeCategory}`);
    }
    const storyDir = storyBankVersion === 'v3' ? STORY_BANK_V3_DIR_NAME : 'raw';
    storyFilePath = path.join(process.cwd(), 'story-bank', storyDir, selection.filename);
    cache = {
      ...cache,
      storyFilePath,
      storyBankVersion,
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

  let book = await prisma.generatedBook.findUnique({ where: { orderId: order.id } });
  if (!book) {
    book = await prisma.generatedBook.create({
      data: {
        orderId: order.id,
        title: order.bookName || story.title,
        coverText: story.coverText,
      },
    });
  }

  const existingPages = await prisma.bookPage.findMany({
    where: { bookId: book.id },
    select: { id: true, pageNumber: true },
  });
  const byNumber = new Map(existingPages.map((p) => [p.pageNumber, p.id]));

  for (const page of story.pages) {
    const template = templateByPage.get(page.pageNumber);
    const existingId = byNumber.get(page.pageNumber);
    if (existingId) {
      await prisma.bookPage.update({
        where: { id: existingId },
        data: {
          text: page.text,
          narrationText: page.narrationText,
          pageTemplate: template,
        },
      });
    } else {
      await prisma.bookPage.create({
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

  const nextCache: PipelineCache = {
    ...cache,
    storyFilePath,
    directionForV3,
    challengeCategory,
    textFinalized: true,
    expectedPageCount: story.pages.length,
  };

  await prisma.order.update({ where: { id: order.id }, data: { textStatus: 'done' } });
  await prisma.generationJob.update({
    where: { orderId: order.id },
    data: { textDone: true },
  });

  return { cache: nextCache, expectedPageCount: story.pages.length };
}
