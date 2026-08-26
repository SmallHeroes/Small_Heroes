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
import {
  assertFrozenOrderStorySourceFile,
  resolveCachedStoryFilePath,
  resolveFrozenOrderStorySelection,
  storyRefClaimsAcceptedRevisionNamespace,
  toRepoRelativeStoryPath,
} from './story-path';
import { resolveCompanionForOrder } from './anchor-registry';
import { beatsFromStoryPages, resolveBookShotPlan } from '@/lib/book-shot-plan';
import { buildFrozenStoryProductTruth } from './frozen-product-truth';
import { withDeliveryInputMutation } from './readiness-manifest';
import { requireOrderVisualPackageAuthority } from './order-visual-package-authority';

async function persistStoryFinalizationFailure(
  orderId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.order.update({
    where: { id: orderId },
    data: { textStatus: 'failed', lastError: message },
  });
  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'failed',
      currentStage: 'failed',
      retryable: true,
      lastError: message,
    },
  });
}

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

  let storyFilePath: string | undefined;
  try {
    const frozenOrderStory = resolveFrozenOrderStorySelection(
      order.selectionFilename,
    );
    if (frozenOrderStory) {
      const visualPackageAuthority = requireOrderVisualPackageAuthority(order);
      if (
        frozenOrderStory.storySourceAuthorityKind ===
          'product_accepted_revision' &&
        (!resolvedCompanion?.id ||
          frozenOrderStory.storyKey !==
            `${resolvedCompanion.id}_${directionForV3}`)
      ) {
        throw new StoryBankPersonalizationError(
          'Product-accepted Story Source identity does not match the Wizard product',
        );
      }
      storyFilePath = frozenOrderStory.storyFilePath;
      assertFrozenOrderStorySourceFile(frozenOrderStory);
      if (
        !order.expectedPageCount ||
        !order.storySourceHash ||
        !order.frozenProductVersion
      ) {
        throw new StoryBankPersonalizationError(
          'Frozen Order Story Source authority is incomplete',
        );
      }
      const sourceTruth = buildFrozenStoryProductTruth({
        storyFilePath,
        expectedPageCount: order.expectedPageCount,
        storyDirection: directionForV3,
      });
      if (
        sourceTruth.selectionFilename !== order.selectionFilename ||
        sourceTruth.storySourceHash !== order.storySourceHash ||
        sourceTruth.frozenProductVersion !== order.frozenProductVersion ||
        sourceTruth.expectedPageCount !== order.expectedPageCount
      ) {
        throw new StoryBankPersonalizationError(
          'Frozen Order Story Source authority does not match repository bytes',
        );
      }
      const {
        storyDir: _staleStoryDir,
        visualPackageAuthority: _staleVisualPackageAuthority,
        ...cacheWithoutStoryDir
      } = cache;
      cache = {
        ...cacheWithoutStoryDir,
        storyFilePath: frozenOrderStory.storyFileRef,
        ...(frozenOrderStory.storyDir
          ? { storyDir: frozenOrderStory.storyDir }
          : {}),
        storyKey: frozenOrderStory.storyKey,
        storySourceAuthorityKind:
          frozenOrderStory.storySourceAuthorityKind,
        // Story Markdown stays on the v3 loader contract; the v4 authority is
        // carried separately by the exact repo-relative storyFilePath and the
        // frozen Visual Package authority.
        storyBankVersion: 'v3',
        selectionFilename: frozenOrderStory.selectionFilename,
        directionForV3,
        challengeCategory,
        ...(visualPackageAuthority ? { visualPackageAuthority } : {}),
      };
    } else if (
      storyRefClaimsAcceptedRevisionNamespace(order.selectionFilename)
    ) {
      // Any aliased spelling of the accepted namespace (./, //, \\, case,
      // whitespace) fails closed here — it must never degrade to the legacy
      // companion selector below.
      throw new StoryBankPersonalizationError(
        'Product-accepted Story Source reference is invalid',
      );
    } else {
      if (
        cache.storySourceAuthorityKind === 'product_accepted_revision'
      ) {
        throw new StoryBankPersonalizationError(
          'Accepted-revision cache source lacks exact frozen Order authority',
        );
      }
      const cachedAcceptedRevisionRef = [
        cache.devStoryBankFile,
        cache.storyFilePath,
      ].find((value) => storyRefClaimsAcceptedRevisionNamespace(value));
      if (cachedAcceptedRevisionRef) {
        throw new StoryBankPersonalizationError(
          'Accepted-revision cache source lacks exact frozen Order authority',
        );
      }
      storyFilePath = resolveCachedStoryFilePath(cache);
    }
    if (!storyFilePath) {
      const selection = selectCompanionStory(
        resolvedCompanion?.id,
        directionForV3,
      );
      if (!selection) {
        throw new StoryBankPersonalizationError(
          `No companion story file for companion=${resolvedCompanion?.id ?? '(none)'} direction=${directionForV3} — ` +
            'v1 category/raw fallback removed; bind a v3-approved golden for this product.',
        );
      }
      const storyDir = selection.dirName ?? STORY_BANK_V3_DIR_NAME;
      storyFilePath = path.join(
        process.cwd(),
        'story-bank',
        storyDir,
        selection.filename,
      );
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
  } catch (error) {
    await persistStoryFinalizationFailure(order.id, error);
    throw error;
  }

  let story;
  try {
    story = await loadStoryFromBank(
      storyFilePath,
      order.childName || '',
      resolvedCompanion?.name ?? 'צפרדע',
      order.childGender || undefined,
      {
        // Load the FULL authored story — dev and prod alike — so the finalized page count is
        // deterministic and equals expectedPageCount. The route and worker must never re-derive
        // DIFFERENT page counts (the "Story page count N !== expected M" failure class): the route
        // used to truncate to a request maxPages while this loader capped by storyLength. Audition
        // renders fewer IMAGES via cache.renderImagePageLimit; the narrative is never truncated.
        maxPages: undefined,
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
    if (
      order.expectedPageCount != null &&
      story.pages.length !== order.expectedPageCount
    ) {
      throw new StoryBankPersonalizationError(
        `Frozen Story Source page count ${story.pages.length} does not match Order expectation ${order.expectedPageCount}`,
      );
    }
  } catch (err) {
    await persistStoryFinalizationFailure(order.id, err);
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

  // ── Retry determinism (Fork B) ──────────────────────────────────────────────────────────────────────
  // Fork B makes gender/name personalization deterministic, but a story with a companion-letter page still has
  // one LLM-generated page. If a PRIOR finalization already committed this order's book (an ambiguous-commit
  // redrive, or a crash between the receipt commit and cache.textFinalized persisting), reuse that EXACT
  // persisted text so THIS attempt rebuilds an IDENTICAL delivery-input payload → the receipt fence replays
  // exactly-once instead of failing closed (ReceiptPayloadMismatchError) on a benign re-derivation drift. The
  // reuse touches text/narration only (deterministic page structure is unchanged); it is a no-op on the first
  // finalization and whenever the persisted page count doesn't match (a genuinely different derivation).
  const persistedBook = await prisma.generatedBook.findUnique({
    where: { orderId: order.id },
    select: {
      pages: {
        orderBy: { pageNumber: 'asc' },
        select: { pageNumber: true, text: true, narrationText: true },
      },
    },
  });
  if (persistedBook && persistedBook.pages.length === story.pages.length) {
    const priorByNumber = new Map(persistedBook.pages.map((p) => [p.pageNumber, p]));
    let reused = 0;
    for (const page of story.pages) {
      const prior = priorByNumber.get(page.pageNumber);
      if (prior) {
        page.text = prior.text;
        page.narrationText = prior.narrationText ?? prior.text;
        reused++;
      }
    }
    if (reused === story.pages.length) {
      console.log(
        `[text-finalization] Reused ${reused} persisted page(s) for deterministic retry (order=${order.id}).`
      );
    }
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
    {
      orderId: order.id,
      reason: 'story_text_finalized',
      frozenTruth,
      // Durable write-attempt id: the frozen story-source hash addresses the finalized text; re-finalizing the
      // same story is idempotent, so an ambiguous-commit replay is fenced without a second inputVersion++.
      operationKey: `delivery_input:${order.id}:story:${frozenTruth.storySourceHash}`,
      // REAL persisted content: the personalized page text/narration + assigned templates.
      mutationPayload: {
        ...frozenTruth,
        title: order.bookName || story.title,
        coverText: story.coverText,
        pages: story.pages.map((p) => [p.pageNumber, p.text, p.narrationText, templateByPage.get(p.pageNumber) ?? null]),
      },
    },
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
