/**
 * Generation Orchestrator
 * POST /api/generate — Manual trigger (webhook fallback)
 * Also exports triggerGeneration() for use by the webhook handler.
 */

import { Prisma, type OrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateStory, StoryInput, FamilyContext } from '../../../backend/providers/story';
import { generateAllPageImages, generateBookCover } from '../../../backend/providers/image';
import { generateAudio, buildNarrationScript } from '../../../backend/providers/audio';
import { TOPICS } from '../../../backend/config/wizard';
import { sendBookReadyEmail } from '../../../backend/lib/email';
import { logServerEvent } from '../events/route';
import { assignTemplatesForBook, type BookPageTemplate } from '../../../lib/bookPageLayout';
import { generateStoryBankCharacterDNA } from '../../../backend/providers/story-bank-loader';
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '../../../lib/illustrationPresentation';
import { storePresentationBuffer } from '../../../lib/image-storage';
import { prisma } from '../../../lib/prisma';
import { createLogger } from '../../../lib/logger';
import { getCompanionById, getCompanionByIdAndCategory, getCompanionReferencePublicUrl } from '../../../lib/companions';
import { buildPersistedCharacterAnchorsJson, companionAnchorKey, getWizardMeta } from '../../../lib/orderMeta';
import { ROUTES } from '../../../lib/routes';
import { evaluatePhotoGate, resolveResemblanceThresholdConfig } from '../../../lib/resemblance-core';

const activeOrderLocks = new Set<string>();
const GENERATION_ELIGIBLE_STATUS = 'paid';
const RETRYABLE_STATUSES = [GENERATION_ELIGIBLE_STATUS, 'failed'] as const;
const RETRYABLE_STATUS_VALUES: OrderStatus[] = [...RETRYABLE_STATUSES];
const generationLogger = createLogger({ subsystem: 'generation', route: '/api/generate' });
const generateApiLogger = createLogger({ subsystem: 'generation-api', route: '/api/generate' });

function normalizePageTemplate(value: string | null | undefined): BookPageTemplate | null {
  if (value === 'full_bleed_overlay' || value === 'art_top_text_bottom' || value === 'character_vignette_text') {
    return value;
  }
  return null;
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
  const camera = composition?.cameraDistance && composition?.cameraAngle
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

interface CharacterAnchorRecord {
  name: string;
  description: string;
  relationship?: string;
  anchorImageUrl?: string;
  aliases?: string[];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function inferCharacterId(
  name: string,
  relationship: string | undefined,
  fallbackPrefix: string,
  fallbackIndex: number
): string {
  const lowered = `${relationship ?? ''} ${name}`.toLowerCase();
  if (/(^|\s)(father|dad|abba|אבא)(\s|$)/i.test(lowered)) return 'father';
  if (/(^|\s)(mother|mom|ima|אמא)(\s|$)/i.test(lowered)) return 'mother';
  if (/(^|\s)(sister|brother|sibling|אחות|אח)(\s|$)/i.test(lowered)) return `sibling_${fallbackIndex + 1}`;
  return `${fallbackPrefix}_${fallbackIndex + 1}`;
}

function parseStoredCharacterAnchors(raw: unknown): Record<string, CharacterAnchorRecord> {
  if (!raw || typeof raw !== 'object') return {};
  const parsed: Record<string, CharacterAnchorRecord> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === '_wizard') continue;
    if (key.startsWith('companion:') && typeof value === 'string') {
      const compId = key.slice('companion:'.length);
      const comp = getCompanionById(compId);
      if (comp) {
        parsed[key] = {
          name: comp.name,
          description: comp.visualDescription,
          relationship: 'companion',
          anchorImageUrl: value,
          aliases: [comp.name, comp.id],
        };
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name : key;
    const description = typeof candidate.description === 'string' ? candidate.description : `${name} recurring character`;
    const relationship = typeof candidate.relationship === 'string' ? candidate.relationship : undefined;
    const anchorImageUrl = typeof candidate.anchorImageUrl === 'string' ? candidate.anchorImageUrl : undefined;
    const aliases = Array.isArray(candidate.aliases) ? candidate.aliases.filter((item): item is string => typeof item === 'string') : [];
    parsed[key] = {
      name,
      description,
      relationship,
      anchorImageUrl,
      aliases,
    };
  }
  return parsed;
}

function buildHaystack(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function detectExpectedCharactersForPage(
  page: { text: string; imagePrompt: string; imageSubject: string },
  registry: Record<string, CharacterAnchorRecord>
): string[] {
  const haystack = buildHaystack([page.text, page.imagePrompt, page.imageSubject]);
  const expected = new Set<string>();
  const supportingSubject = page.imageSubject.toLowerCase().startsWith('supporting:')
    ? page.imageSubject.slice('supporting:'.length).trim().toLowerCase()
    : '';

  if (!page.imageSubject.toLowerCase().startsWith('environment') && !page.imageSubject.toLowerCase().startsWith('object:')) {
    expected.add('child');
  }

  for (const [characterId, character] of Object.entries(registry)) {
    const aliases = [character.name, ...(character.aliases ?? [])]
      .map(normalizeToken)
      .filter(Boolean);
    if (aliases.some((alias) => haystack.includes(alias))) {
      expected.add(characterId);
      continue;
    }
    if (supportingSubject && aliases.some((alias) => alias.includes(supportingSubject) || supportingSubject.includes(alias))) {
      expected.add(characterId);
    }
  }

  if (expected.size === 0) expected.add('child');
  return [...expected];
}

function collectExistingImagePageNumbers(
  pages: Array<{ pageNumber: number; imageAsset?: unknown }>
): number[] {
  return pages
    .filter((page) => Boolean(page.imageAsset))
    .map((page) => page.pageNumber);
}

function ageBandFromAge(age: number | null | undefined): '3-5' | '5-7' | '7-9' {
  if (!age || age <= 5) return '3-5';
  if (age <= 7) return '5-7';
  return '7-9';
}

// ─── Main Orchestrator ────────────────────────────────
export async function triggerGeneration(orderId: string, reason = 'unspecified'): Promise<void> {
  if (!orderId || typeof orderId !== 'string') {
    generationLogger.warn('Trigger skipped due to invalid orderId');
    return;
  }
  // Advisory lock only (single-instance optimization). Correctness relies on DB claim checks below.
  const acquiredLocalLock = !activeOrderLocks.has(orderId);
  if (acquiredLocalLock) {
    activeOrderLocks.add(orderId);
  } else {
    generationLogger.info('Local lock already active; DB lock remains source of truth', {
      orderId,
      reason,
    });
  }
  generationLogger.info('Trigger accepted', { orderId, reason });

  try {
    await prisma.generationJob.create({
      data: { orderId, status: 'pending', attempts: 0 },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    // Another instance/request already created the row. DB lock below is authoritative.
  }
  const lockResult = await prisma.generationJob.updateMany({
    where: {
      orderId,
      status: { not: 'running' },
    },
    data: {
      status: 'running',
      startedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
      failedAt: null,
      completedAt: null,
    },
  });
  if (lockResult.count === 0) {
    generationLogger.warn('Skipped because DB lock already active', { orderId, reason });
    if (acquiredLocalLock) activeOrderLocks.delete(orderId);
    return;
  }

  try {
    const generationStartedAtMs = Date.now();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        storyDirectionSet: {
          include: {
            selectedDirection: true,
          },
        },
      },
    });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'ready' || order.status === 'partial') {
      generationLogger.info('Skipped because order already completed', { orderId, status: order.status });
      await prisma.generationJob.update({
        where: { orderId },
        data: { status: 'done', completedAt: new Date() },
      });
      return;
    }
    if (!RETRYABLE_STATUS_VALUES.includes(order.status)) {
      generationLogger.warn('Blocked because order status is not eligible', {
        orderId,
        status: order.status,
        expectedStatuses: RETRYABLE_STATUSES,
        reason,
      });
      await prisma.generationJob.update({
        where: { orderId },
        data: { status: 'pending', lastError: `Blocked: order status ${order.status}` },
      });
      return;
    }
    const directionSet = order.storyDirectionSet;
    const selectedDirection = directionSet?.selectedDirection ?? null;
    // New flow: a direction set exists → must have a selection before full generation.
    // Legacy orders: no row → proceed without direction injection.
    if (directionSet && !selectedDirection) {
      generationLogger.warn('Skipped while awaiting story direction selection', { orderId });
      await prisma.generationJob.update({
        where: { orderId },
        data: {
          status: 'pending',
          lastError: 'Awaiting story direction selection',
        },
      });
      return;
    }

    const claimedOrder = await prisma.order.updateMany({
      where: { id: orderId, status: { in: RETRYABLE_STATUS_VALUES } },
      data: { status: 'generating' },
    });
    if (claimedOrder.count === 0) {
      generationLogger.warn('Skipped because order could not be claimed', { orderId, reason });
      await prisma.generationJob.update({
        where: { orderId },
        data: { status: 'pending', lastError: 'Blocked: order no longer eligible for generation' },
      });
      return;
    }
    // Reset job status for retry
    await prisma.generationJob.updateMany({
      where: { orderId, status: 'failed' },
      data: {
        status: 'running',
        startedAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
        failedAt: null,
      },
    });

    logServerEvent('full_generation_started', {
      orderId,
      selected_archetype: selectedDirection?.archetype ?? 'legacy',
      child_age_band: ageBandFromAge(order.childAge),
      style: order.illustrationStyle,
    });

    const topicLabel = TOPICS.find(t => t.id === order.topic)?.label ?? order.topic;
    const wizardMeta = getWizardMeta(order.characterAnchors);
    const resolvedCompanion = getCompanionByIdAndCategory(
      wizardMeta.companionCharacterId ?? null,
      wizardMeta.challengeCategory ?? null
    );
    console.info('[api/generate] resolved companion', orderId, resolvedCompanion?.id ?? 'none', resolvedCompanion?.name ?? '');

    // ── Stage 1: Story Text ───────────────────────────
    generationLogger.info('Stage started', { orderId, stage: 'text' });
    await prisma.order.update({ where: { id: orderId }, data: { textStatus: 'running' } });

    const storyInput: StoryInput = {
      childName:        order.childName,
      childAge:         order.childAge,
      childGender:      order.childGender,
      childTraits:      order.childTraits,
      childSuperpower:  (order as Record<string, unknown>).childSuperpower as string ?? undefined,
      familyContext:    (order as Record<string, unknown>).familyContext as FamilyContext ?? undefined,
      topic:            order.topic,
      topicLabel,
      challengeItems:   order.challengeItems,
      challengeFree:    order.challengeFree ?? undefined,
      outcomeItems:     order.outcomeItems,
      outcomeFree:      order.outcomeFree ?? undefined,
      helperItems:      order.helperItems,
      helperFree:       order.helperFree ?? undefined,
      avoidItems:       order.avoidItems,
      avoidFree:        order.avoidFree ?? undefined,
      storyLength:      order.storyLength as 'short' | 'medium' | 'long',
      illustrationStyle: order.illustrationStyle,
      childImageUrl: order.childImageUrl ?? undefined,
      companionForStory: resolvedCompanion ?? undefined,
      challengeCategory: wizardMeta.challengeCategory ?? null,
      categoryAnswers: Array.isArray(wizardMeta.categoryAnswers) ? wizardMeta.categoryAnswers : [],
      ...(selectedDirection
        ? {
            directionArchetype: selectedDirection.archetype,
            directionTitle: selectedDirection.title,
            directionEmotionalLabel: selectedDirection.emotionalLabel,
            directionStoryPremise: selectedDirection.storyPremise,
            directionOpeningScenePrompt: selectedDirection.openingScenePrompt,
          }
        : {}),
    };

    const story = await generateStory(storyInput);
    const compositionByPage = new Map(
      (story.pageCompositionPlan ?? []).map((composition) => [composition.pageNumber, composition])
    );
    const assignedTemplates = assignTemplatesForBook(
      story.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        imageSubject: page.imageSubject,
        pageIntent: compositionByPage.get(page.pageNumber)?.pageIntent,
      }))
    );
    const templateByPageNumber = new Map<number, BookPageTemplate>(
      story.pages.map((page, index) => [page.pageNumber, assignedTemplates[index] ?? 'art_top_text_bottom'])
    );

    const existingBook = await prisma.generatedBook.findUnique({
      where: { orderId },
    });
    const book = existingBook
      ? existingBook
      : await prisma.generatedBook.create({
          data: {
            orderId,
            title: order.bookName || story.title,
            coverText: story.coverText,
          },
        });

    if (!existingBook) {
      await prisma.bookPage.createMany({
        data: story.pages.map(p => ({
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
    } else {
      generationLogger.info('Reusing existing generated book', { orderId, bookId: book.id });
      const existingPages = await prisma.bookPage.findMany({
        where: { bookId: book.id },
        select: { id: true, pageNumber: true, pageTemplate: true, textZone: true, lighting: true, textColorScheme: true },
      });
      for (const page of existingPages) {
        const resolvedTemplate = templateByPageNumber.get(page.pageNumber);
        if (
          !resolvedTemplate ||
          (page.pageTemplate === resolvedTemplate &&
            page.textZone !== null &&
            page.lighting !== null &&
            page.textColorScheme !== null)
        ) {
          continue;
        }
        await prisma.bookPage.update({
          where: { id: page.id },
          data: { pageTemplate: resolvedTemplate, textZone: null, lighting: null, textColorScheme: null },
        });
      }
    }

    await prisma.order.update({ where: { id: orderId }, data: { textStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId }, data: { textDone: true } });
    generationLogger.info('Stage completed', {
      orderId,
      stage: 'text',
      pageCount: story.pages.length,
    });

    // ── Stage 2: Cover + Images ───────────────────────
    generationLogger.info('Stage started', { orderId, stage: 'images' });
    await prisma.order.update({ where: { id: orderId }, data: { imageStatus: 'running' } });

    const clothingLock = story.heroVisualLock?.clothing?.trim();
    const childDescBase = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;
    const childDesc = clothingLock ? `${childDescBase}; wearing ${clothingLock}` : childDescBase;
    const storedAnchors = parseStoredCharacterAnchors((order as Record<string, unknown>).characterAnchors);
    const anchorRegistry: Record<string, CharacterAnchorRecord> = {
      ...storedAnchors,
      child: {
        name: order.childName,
        description: childDesc,
        relationship: 'child',
        anchorImageUrl: storedAnchors.child?.anchorImageUrl ?? order.childImageUrl ?? undefined,
        aliases: [
          order.childName,
          'child',
          ...(storedAnchors.child?.aliases ?? []),
        ],
      },
    };

    const familyContext = (order as Record<string, unknown>).familyContext as FamilyContext | undefined;
    const additionalCharacterIds = new Set<string>();
    const familyMembers: Array<{
      name: string;
      description?: string;
      relationship?: string;
      fallbackPrefix: string;
      anchorImageUrl?: string;
    }> = [];
    const normalizedAdditional = Array.isArray((familyContext as Record<string, unknown>)?.additionalCharacters)
      ? (((familyContext as Record<string, unknown>).additionalCharacters as Array<Record<string, unknown>>).slice(0, 2))
      : [];

    if (normalizedAdditional.length > 0) {
      normalizedAdditional.forEach((entry) => {
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!name) return;
        const photoQuality =
          entry.photoQuality && typeof entry.photoQuality === 'object' && !Array.isArray(entry.photoQuality)
            ? (entry.photoQuality as Record<string, unknown>)
            : null;
        const photoQualityStatus =
          photoQuality && typeof photoQuality.status === 'string'
            ? photoQuality.status
            : null;
        const relation = typeof entry.relation === 'string' ? entry.relation : 'other';
        const fallbackPrefix = relation === 'sibling' ? 'sibling' : 'supporting';
        familyMembers.push({
          name,
          description: typeof entry.description === 'string' ? entry.description : undefined,
          relationship: relation,
          fallbackPrefix,
          anchorImageUrl:
            photoQualityStatus === 'blocked'
              ? undefined
              : (typeof entry.imageUrl === 'string' ? entry.imageUrl : undefined),
        });
      });
    } else {
      if (familyContext?.parent1?.name) {
        familyMembers.push({
          name: familyContext.parent1.name,
          description: familyContext.parent1.description,
          relationship: 'parent',
          fallbackPrefix: 'parent',
        });
      }
      if (familyContext?.parent2?.name) {
        familyMembers.push({
          name: familyContext.parent2.name,
          description: familyContext.parent2.description,
          relationship: 'parent',
          fallbackPrefix: 'parent',
        });
      }
      if (familyContext?.sibling?.name) {
        familyMembers.push({
          name: familyContext.sibling.name,
          description: familyContext.sibling.description,
          relationship: 'sibling',
          fallbackPrefix: 'sibling',
        });
      }
    }
    familyMembers.forEach((member, index) => {
      const characterId = inferCharacterId(member.name, member.relationship, member.fallbackPrefix, index);
      additionalCharacterIds.add(characterId);
      if (!anchorRegistry[characterId]) {
        anchorRegistry[characterId] = {
          name: member.name,
          description: member.description ?? `${member.name} recurring family member`,
          relationship: member.relationship,
          anchorImageUrl: member.anchorImageUrl,
          aliases: [member.name, member.relationship ?? characterId],
        };
      }
    });

    story.characterSheet.supportingCharacters.forEach((character, index) => {
      const characterId = inferCharacterId(character.name, character.relationship, 'supporting', index);
      const existing = anchorRegistry[characterId];
      anchorRegistry[characterId] = {
        name: existing?.name ?? character.name,
        description: existing?.description ?? character.visualDescription,
        relationship: existing?.relationship ?? character.relationship,
        anchorImageUrl: existing?.anchorImageUrl,
        aliases: [
          ...(existing?.aliases ?? []),
          character.name,
          character.relationship,
        ],
      };
    });

    if (resolvedCompanion) {
      const ck = companionAnchorKey(resolvedCompanion.id);
      if (!anchorRegistry[ck]) {
        anchorRegistry[ck] = {
          name: resolvedCompanion.name,
          description: resolvedCompanion.visualDescription,
          relationship: 'companion',
          aliases: [resolvedCompanion.name, resolvedCompanion.id],
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const ref = getCompanionReferencePublicUrl(resolvedCompanion, baseUrl);
      if (ref && !anchorRegistry[ck].anchorImageUrl) {
        anchorRegistry[ck].anchorImageUrl = ref;
      }
    }

    const pagesWithDetectedCharacters = story.pages.map((page) => {
      const subj = (page.imageSubject ?? '').toLowerCase();
      const baseIds = detectExpectedCharactersForPage(page, anchorRegistry);
      if (resolvedCompanion && !subj.startsWith('environment') && !subj.startsWith('object:')) {
        return {
          ...page,
          expectedCharacterIds: [
            ...new Set([...baseIds, companionAnchorKey(resolvedCompanion.id)]),
          ],
        };
      }
      return { ...page, expectedCharacterIds: baseIds };
    });

    const companionKey = resolvedCompanion ? companionAnchorKey(resolvedCompanion.id) : null;
    const boundedPagesWithCharacters = pagesWithDetectedCharacters.map((page) => {
      const filtered = page.expectedCharacterIds.filter((characterId) => characterId !== 'child');
      let nonChild: string | undefined;
      if (companionKey && filtered.includes(companionKey)) {
        nonChild = companionKey;
      } else {
        const prioritized = filtered.sort((a, b) => {
          const aIsAdditional = additionalCharacterIds.has(a) ? 0 : 1;
          const bIsAdditional = additionalCharacterIds.has(b) ? 0 : 1;
          if (aIsAdditional !== bIsAdditional) return aIsAdditional - bIsAdditional;
          return a.localeCompare(b);
        });
        nonChild = prioritized[0];
      }
      return {
        ...page,
        expectedCharacterIds: nonChild ? ['child', nonChild] : ['child'],
      };
    });
    if (additionalCharacterIds.size > 0) {
      const hasAdditionalAppearance = boundedPagesWithCharacters.some((page) =>
        page.expectedCharacterIds.some((characterId) => additionalCharacterIds.has(characterId))
      );
      if (!hasAdditionalAppearance) {
        const firstAdditionalId = [...additionalCharacterIds][0];
        const targetPageIndex = boundedPagesWithCharacters.findIndex((page) =>
          page.expectedCharacterIds.includes('child')
        );
        const fallbackIndex = targetPageIndex >= 0 ? targetPageIndex : 0;
        const fallbackPage = boundedPagesWithCharacters[fallbackIndex];
        if (fallbackPage) {
          fallbackPage.expectedCharacterIds = ['child', firstAdditionalId];
        }
      }
    }
    const appearances = boundedPagesWithCharacters.reduce<Record<string, number>>((acc, page) => {
      for (const characterId of page.expectedCharacterIds) {
        acc[characterId] = (acc[characterId] ?? 0) + 1;
      }
      return acc;
    }, {});
    const recurringCharacterIds = new Set(
      Object.entries(appearances)
        .filter(([characterId, count]) => characterId === 'child' || count > 1)
        .map(([characterId]) => characterId)
    );
    const pagesForGeneration = boundedPagesWithCharacters.map((page) => {
      const comp = compositionByPage.get(page.pageNumber);
      return {
        pageTemplate: templateByPageNumber.get(page.pageNumber) ?? 'art_top_text_bottom',
        pageNumber: page.pageNumber,
        imagePrompt: page.imagePrompt,
        rawScenePrompt: page.rawScenePrompt,
        visualDirection: page.visualDirection,
        bookPageText: page.text,
        imageSubject: page.imageSubject,
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
        compositionRules: compositionRulesForTemplate(
          templateByPageNumber.get(page.pageNumber) ?? 'art_top_text_bottom',
          comp
        ),
        environmentContinuity: comp?.consistencyNotes ?? undefined,
        expectedCharacterIds: page.expectedCharacterIds.filter((characterId) => recurringCharacterIds.has(characterId)),
      };
    });
    const anchorState: Record<string, string> = {};
    for (const [characterId, character] of Object.entries(anchorRegistry)) {
      if (character.anchorImageUrl) anchorState[characterId] = character.anchorImageUrl;
    }
    const inputPhotoStrength = order.childImageUrl
      ? await (async () => {
          try {
            return (await evaluatePhotoGate(order.childImageUrl!)).inputStrength;
          } catch {
            return 'adequate' as const;
          }
        })()
      : 'adequate';
    const resemblanceThresholdConfig = resolveResemblanceThresholdConfig();
    const allStoryText = story.pages.map((page) => page.text).join('\n');
    const companionName = resolvedCompanion?.name || '';
    const companionDescription = resolvedCompanion?.visualDescription || '';
    const dna = await generateStoryBankCharacterDNA({
      childName: order.childName || '',
      childGender: order.childGender || 'girl',
      childAge: order.childAge || 4,
      companionName,
      storyText: allStoryText,
      illustrationStyle: order.illustrationStyle,
    });
    const lockedChildDescription = dna.childDNA || childDesc;
    if (anchorRegistry.child) {
      anchorRegistry.child.description = lockedChildDescription;
    }

    if (book.coverImageUrl) {
      generationLogger.info('Cover already exists; reusing', { orderId });
    } else {
      const coverImage = await generateBookCover({
        childName: order.childName,
        topicLabel,
        storyTitle: story.title,
        coverText: story.coverText,
        illustrationStyle: order.illustrationStyle,
        childDescription: lockedChildDescription,
        characterSheet: story.characterSheet,
        referenceImages: order.childImageUrl ? [order.childImageUrl] : undefined,
        orderId,
        directionArchetype: selectedDirection?.archetype,
        directionEmotionalLabel: selectedDirection?.emotionalLabel,
        directionStoryPremise: selectedDirection?.storyPremise,
        heroVisualLock: story.heroVisualLock,
        styleLock: story.styleLock,
        entityVisualLock: story.entityVisualLock,
        companion: resolvedCompanion
          ? { name: resolvedCompanion.name, visualDescription: companionDescription || resolvedCompanion.visualDescription }
          : undefined,
        childStructured: dna.childStructured,
        companionStructured: dna.companionStructured,
      });
      await prisma.generatedBook.update({
        where: { id: book.id },
        data: { coverImageUrl: coverImage.url },
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { coverImageUrl: coverImage.url },
      });
      generationLogger.info('Cover image generated', { orderId });
    }

    const imageOutcome = await generateAllPageImages(
      pagesForGeneration.map((page) => {
        const supportingCharacters = (page.expectedCharacterIds || [])
          .filter((id) => id !== 'child' && !id.startsWith('companion:'))
          .map((id) => ({ id, character: anchorRegistry[id] }))
          .filter(
            (entry): entry is { id: string; character: CharacterAnchorRecord } =>
              Boolean(entry.character)
          )
          .map(({ id, character }) => ({
            name: character.name,
            description: character.description,
            relationship: character.relationship || (id.startsWith('sibling_') ? 'sibling' : 'supporting'),
          }));
        return {
          ...page,
          supportingCharacters,
        };
      }),
      {
        illustrationStyle: order.illustrationStyle,
        childName: order.childName ?? null,
        childAge: order.childAge ?? null,
        childGender: order.childGender ?? null,
        childDescription: lockedChildDescription,
        referenceImages: order.childImageUrl ? [order.childImageUrl] : undefined,
        characterRegistry: Object.fromEntries(
          Object.entries(anchorRegistry).map(([characterId, character]) => [
            characterId,
            {
              id: characterId,
              name: character.name,
              description: character.description,
            },
          ])
        ),
        initialCharacterAnchors: anchorState,
        existingPageNumbers: collectExistingImagePageNumbers(
          await prisma.bookPage.findMany({
            where: { bookId: book.id },
            select: {
              pageNumber: true,
              imageAsset: {
                select: { id: true },
              },
            },
          })
        ),
        orderId,
        characterSheet:    story.characterSheet,  // ← locked character visuals
        concept:           story.concept,          // ← central entity for scene injection
        childStructured: dna.childStructured,
        companionStructured: dna.companionStructured,
        propDNA: dna.propDNA,
        extraNegativeRules: dna.negativeRules,
        onAnchorsResolved: async (resolvedAnchors) => {
          for (const [characterId, url] of Object.entries(resolvedAnchors)) {
            if (!anchorRegistry[characterId]) continue;
            anchorRegistry[characterId].anchorImageUrl = url;
          }
          const characterAnchorsPayload = buildPersistedCharacterAnchorsJson(anchorRegistry, wizardMeta);
          const childAnchor = resolvedAnchors.child;
          await prisma.order.update({
            where: { id: orderId },
            data: {
              characterAnchors: characterAnchorsPayload as Prisma.InputJsonValue,
              ...(childAnchor ? { childImageUrl: childAnchor } : {}),
            },
          });
        },
        onResemblanceAudit: async (entry) => {
          try {
            await prisma.$executeRaw`
              INSERT INTO "ResemblanceAudit" (
                "id", "orderId", "pageNumber", "candidateIndex", "selected", "seed", "model", "styleId",
                "resemblanceScore", "threshold", "minAcceptableScore", "softFailBand",
                "extremeMargin", "selectionGap", "resemblanceStatus", "resemblanceConfidence", "inputStrength",
                "sanityDisagreement", "lowDiversity", "extremeMismatch", "reason",
                "faceDetectConfidence", "faceAreaRatio", "source", "metadata", "updatedAt"
              ) VALUES (
                ${randomUUID()}, ${orderId}, ${entry.pageNumber},
                ${entry.candidateIndex ?? null}, ${entry.selected}, ${entry.seed ?? null}, ${entry.model ?? null},
                ${entry.styleId ?? null}, ${entry.resemblanceScore ?? null},
                ${entry.threshold ?? null}, ${entry.minAcceptableScore ?? null},
                ${entry.softFailBand ?? null}, ${entry.extremeMargin ?? null},
                ${entry.selectionGap ?? null}, ${entry.resemblanceStatus ?? null}, ${entry.resemblanceConfidence ?? null},
                ${inputPhotoStrength}, ${entry.sanityDisagreement ?? null}, ${entry.lowDiversity ?? null},
                ${entry.extremeMismatch ?? null}, ${entry.reason ?? null},
                ${entry.faceDetectConfidence ?? null}, ${entry.faceAreaRatio ?? null}, ${entry.source},
                ${JSON.stringify({
                  allCandidateScores: entry.allCandidateScores ?? [],
                  reasonCodes: entry.reasonCodes ?? [],
                  ...(entry.metadata ?? {}),
                })}::jsonb,
                NOW()
              )
            `;
          } catch (auditErr) {
            const message = auditErr instanceof Error ? auditErr.message : String(auditErr);
            const missingTable =
              message.includes('relation "ResemblanceAudit" does not exist') ||
              message.includes("relation 'ResemblanceAudit' does not exist") ||
              message.includes('42P01');
            if (missingTable && process.env.NODE_ENV !== 'production') {
              generationLogger.warn('Resemblance audit table missing; skipping local audit write', {
                orderId,
                pageNumber: entry.pageNumber,
              });
              return;
            }
            throw auditErr;
          }
        },
        inputPhotoStrength,
        photoQuality: wizardMeta.photoQuality,
        resemblanceThresholdConfig,
        companion: resolvedCompanion,
        directionArchetype: selectedDirection?.archetype,
        directionEmotionalLabel: selectedDirection?.emotionalLabel,
        directionStoryPremise: selectedDirection?.storyPremise,
      }
    );
    const imageMap = imageOutcome.results;
    const textZoneMap = imageOutcome.textZones;
    const lightingMap = imageOutcome.lightingModes;

    const pages = await prisma.bookPage.findMany({
      where: { bookId: book.id },
      orderBy: { pageNumber: 'asc' },
      select: { id: true, pageNumber: true, pageTemplate: true, textZone: true, lighting: true, textColorScheme: true },
    });
    const presentationPostprocessEnabled =
      process.env.ENABLE_PRESENTATION_POSTPROCESS !== 'false' &&
      process.env.SKIP_ILLUSTRATION_PRESENTATION !== 'true';

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const image = imageMap.get(page.pageNumber);
      const storyboardTextZone = textZoneMap.get(page.pageNumber) ?? null;
      const storyboardLighting = lightingMap.get(page.pageNumber) ?? null;
      if (page.textZone !== storyboardTextZone || page.lighting !== storyboardLighting || page.textColorScheme == null) {
        await prisma.bookPage.update({
          where: { id: page.id },
          data: { textZone: storyboardTextZone, lighting: storyboardLighting },
        });
      }
      if (image) {
        const existingImageAsset = await prisma.imageAsset.findUnique({
          where: { pageId: page.id },
          select: { id: true },
        });
        if (existingImageAsset) {
          generationLogger.info('Skipping image asset save because page already has one', {
            orderId,
            pageNumber: page.pageNumber,
          });
          continue;
        }

        let presentationUrl: string | null = null;
        generationLogger.info(
          `[presentation_postprocess] enabled=${presentationPostprocessEnabled} page=${page.pageNumber}`
        );
        if (presentationPostprocessEnabled) {
          try {
            const mode =
              normalizePageTemplate(page.pageTemplate) ??
              templateByPageNumber.get(page.pageNumber) ??
              'art_top_text_bottom';
            const sourceBuffer = await fetchImageBuffer(image.url);
            const sourceSignal = await evaluateImageSignal(sourceBuffer);
            if (!sourceSignal.usable) {
              generationLogger.warn('Presentation skipped due to weak source signal', {
                orderId,
                pageNumber: page.pageNumber,
                reasons: sourceSignal.reasons.join(', '),
              });
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
                  orderId,
                  pageNumber: page.pageNumber,
                });
                generationLogger.info('Presentation image generated', {
                  orderId,
                  pageNumber: page.pageNumber,
                  mode,
                });
              } else {
                generationLogger.warn('Presentation rejected; using raw image fallback', {
                  orderId,
                  pageNumber: page.pageNumber,
                  reasons: presentationSignal.reasons.join(', '),
                });
              }
            }
          } catch (presErr) {
            generationLogger.error('Presentation generation failed; using raw fallback', presErr, {
              orderId,
              pageNumber: page.pageNumber,
            });
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
            style: order.illustrationStyle,
          },
        });

        // Analyze actual image luminance for text color.
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
          console.warn('[text_color_analysis] failed, keeping default', analysisErr);
        }
      }
    }

    await prisma.order.update({ where: { id: orderId }, data: { imageStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId }, data: { imagesDone: true } });
    generationLogger.info('Stage completed', {
      orderId,
      stage: 'images',
      generatedImages: imageMap.size,
      expectedImages: story.pages.length,
      failedImages: imageOutcome.failedPages.length,
    });

    // ── Stage 3: Audio (optional) ─────────────────────
    if (order.audioEnabled && order.selectedVoice) {
      generationLogger.info('Stage started', {
        orderId,
        stage: 'audio',
        voice: order.selectedVoice,
      });
      await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'running' } });

      try {
        const narrationScript = buildNarrationScript(
          story.pages.map(p => ({ pageNumber: p.pageNumber, narrationText: p.narrationText })),
          order.sleepMode
        );

        const audio = await generateAudio({
          narrationScript,
          voiceId: order.selectedVoice,
          sleepMode: order.sleepMode,
          orderId,
        });

        await prisma.audioAsset.create({
          data: {
            bookId: book.id,
            provider: audio.provider,
            voiceId: audio.voiceId,
            sleepMode: order.sleepMode,
            url: audio.url,
          },
        });

        await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'done' } });
        await prisma.generationJob.update({ where: { orderId }, data: { audioDone: true } });
        generationLogger.info('Stage completed', { orderId, stage: 'audio' });

      } catch (audioErr) {
        generationLogger.error('Audio stage failed (non-fatal)', audioErr, {
          orderId,
          stage: 'audio',
        });
        await prisma.order.update({
          where: { id: orderId },
          data: {
            audioStatus: 'failed',
            lastError: String(audioErr),
          },
        });
      }
    } else {
      await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'done' } });
    }

    // ── Stage 4: Package & Mark Ready ─────────────────
    generationLogger.info('Stage started', { orderId, stage: 'package' });
    await prisma.order.update({ where: { id: orderId }, data: { packageStatus: 'running' } });

    let pdfUrl: string | null = null;
    if (order.pdfEnabled) {
      try {
        generationLogger.info('PDF generation started', { orderId, stage: 'package' });
        const [{ generateBookPdf }, { uploadPdfToStorage }] = await Promise.all([
          import('../../../backend/lib/pdf-generator'),
          import('../../../backend/lib/pdf-storage'),
        ]);
        const dbPagesForPdf = await prisma.bookPage.findMany({
          where: { bookId: book.id },
          orderBy: { pageNumber: 'asc' },
          select: {
            pageNumber: true,
            text: true,
            imageAsset: {
              select: {
                url: true,
                presentationUrl: true,
              },
            },
          },
        });
        const pagesForPdf = [
          ...(book.coverImageUrl
            ? [{
                pageNumber: 0,
                text: '',
                imageUrl: book.coverImageUrl,
                isCover: true,
              }]
            : []),
          ...dbPagesForPdf.map((page) => ({
            pageNumber: page.pageNumber + (book.coverImageUrl ? 1 : 0),
            text: page.text,
            imageUrl: page.imageAsset?.presentationUrl ?? page.imageAsset?.url ?? null,
            isCover: false,
          })),
        ];
        const pdfBuffer = await generateBookPdf({
          title: book.title || order.childName || 'הספר שלי',
          pages: pagesForPdf,
        });
        pdfUrl = await uploadPdfToStorage(orderId, pdfBuffer);
        await prisma.generatedBook.update({
          where: { id: book.id },
          data: { pdfUrl },
        });
        generationLogger.info('PDF generation completed', { orderId, pdfUrl });
      } catch (pdfErr) {
        generationLogger.error('PDF generation failed (non-fatal)', pdfErr, { orderId });
      }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const accessKey = order.paymentId ?? order.paymeTransactionId ?? order.stripeSessionId;
    const readUrl = accessKey
      ? `${appUrl}${ROUTES.ready}?orderId=${orderId}&accessKey=${encodeURIComponent(accessKey)}`
      : `${appUrl}${ROUTES.ready}?orderId=${orderId}`;
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { readUrl },
    });

    const hasImageFailures = imageOutcome.failedPages.length > 0;
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: hasImageFailures ? 'partial' : 'ready',
        packageStatus: 'done',
        ...(hasImageFailures
          ? { lastError: `Image generation skipped pages: ${imageOutcome.failedPages.join(', ')}` }
          : {}),
      },
    });

    await prisma.generationJob.update({
      where: { orderId },
      data: { status: 'done', completedAt: new Date(), packaged: true },
    });

    logServerEvent('full_generation_completed', {
      orderId,
      selected_archetype: selectedDirection?.archetype ?? 'legacy',
      child_age_band: ageBandFromAge(order.childAge),
      style: order.illustrationStyle,
      generation_time: Math.max(1, Math.round((Date.now() - generationStartedAtMs) / 1000)),
    });

    generationLogger.info('Generation completed', { orderId });

    try {
      const finishedBook = await prisma.generatedBook.findUnique({
        where: { id: book.id },
        include: { audioAsset: true },
      });
      await sendBookReadyEmail({
        to:           order.customerEmail,
        customerName: order.customerName ?? order.childName,
        childName:    order.childName,
        readUrl,
        audioUrl:     finishedBook?.audioAsset?.url ?? undefined,
        pdfUrl:       finishedBook?.pdfUrl            ?? undefined,
      });
      generationLogger.info('Ready email sent', { orderId, customerEmail: order.customerEmail });
    } catch (emailErr) {
      generationLogger.error('Ready email failed (non-fatal)', emailErr, { orderId });
    }

  } catch (error) {
    generationLogger.error('Generation failed', error, { orderId });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'failed', lastError: String(error), errorAt: new Date() },
    });

    await prisma.generationJob.update({
      where: { orderId },
      data: { status: 'failed', failedAt: new Date(), lastError: String(error) },
    }).catch(() => {});

    throw error;
  } finally {
    if (acquiredLocalLock) activeOrderLocks.delete(orderId);
  }
}

// ─── API Route Handler (manual trigger / webhook fallback) ───
export async function POST(req: Request) {
  try {
    const { orderId, secret, reason } = await req.json();
    const expectedSecret = process.env.GENERATION_SECRET;
    if (!expectedSecret) {
      generateApiLogger.error('GENERATION_SECRET missing; refusing trigger');
      return Response.json({ error: 'Generation trigger is disabled (server misconfigured)' }, { status: 503 });
    }
    if (typeof secret !== 'string' || secret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderId) {
      return Response.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.status === 'ready' || order.status === 'partial') {
      return Response.json({ error: 'Generation already completed for this order' }, { status: 409 });
    }
    if (order.status === 'generating') {
      return Response.json({ error: 'Generation is already in progress' }, { status: 409 });
    }
    if (!RETRYABLE_STATUS_VALUES.includes(order.status)) {
      return Response.json({ error: 'Order is not eligible for generation' }, { status: 409 });
    }
    const activeJob = await prisma.generationJob.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (activeJob?.status === 'running') {
      return Response.json({ error: 'Generation is already in progress' }, { status: 409 });
    }

    const triggerReason = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'manual_api';
    generateApiLogger.info('Manual trigger accepted', { orderId, reason: triggerReason });
    triggerGeneration(orderId, triggerReason).catch((err) => {
      generateApiLogger.error('Async trigger failed after acceptance', err, { orderId });
    });

    return Response.json({ started: true, orderId });

  } catch (error) {

    return Response.json(
      {
        error: 'Internal error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
