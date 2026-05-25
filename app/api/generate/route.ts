/**
 * Generation Orchestrator
 * POST /api/generate — Manual trigger (webhook fallback)
 * Also exports triggerGeneration() for use by the webhook handler.
 */

import { Prisma, type OrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import path from 'path';
import { FamilyContext } from '../../../backend/providers/story';
import { generateAllPageImages, generateBookCover } from '../../../backend/providers/image';
import { generatePageAudio } from '../../../backend/providers/audio';
import { TOPICS } from '../../../backend/config/wizard';
import { sendBookReadyEmail } from '../../../backend/lib/email';
import { logServerEvent } from '../../../lib/server-events';
import { assignTemplatesForBook, type BookPageTemplate } from '../../../lib/bookPageLayout';
import { describeChildFromPhoto, generateStoryBankCharacterDNA, loadStoryFromBank } from '../../../backend/providers/story-bank-loader';
import { selectCompanionStory, selectStoryFromBank, STORY_BANK_V3_DIR_NAME } from '../../../backend/providers/story-bank-index';
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
import { mergeGptImageReferenceSources } from '../../../lib/image-reference-utils';
import { buildPersistedCharacterAnchorsJson, companionAnchorKey, getWizardMeta } from '../../../lib/orderMeta';
import { buildLetterContextFromOrder, buildPatchContextFromOrder } from '../../../backend/providers/personalization';
import { ROUTES } from '../../../lib/routes';
import { evaluatePhotoGate, resolveResemblanceThresholdConfig } from '../../../lib/resemblance-core';
import {
  buildEnrichedScenePrompt,
  deriveLayout,
  type PageLayout,
} from '../../../backend/providers/image-prompt-enricher';

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

/** Align wizard package / DB `storyDirection` with v3 filenames when `order.storyDirection` is unset (legacy). */
function effectiveStoryDirectionForV3(
  storyDirection: string | null | undefined,
  storyLength: 'short' | 'medium' | 'long',
): 'bedtime' | 'adventure' | 'fantasy' {
  const d = (storyDirection || '').trim().toLowerCase();
  if (d === 'bedtime' || d === 'adventure' || d === 'fantasy') return d;
  if (storyLength === 'short') return 'bedtime';
  if (storyLength === 'long') return 'fantasy';
  return 'adventure';
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
  /** Structured supporting DNA for image prompts (additional / family characters). */
  supportingVisualDNA?: {
    physicalDescription: string;
    clothingDefault: string;
    signatureDetail: string;
    ageRange: string;
  };
}

/** Strip Hebrew nikud (vowel marks U+0591–U+05C7) so nikud-adorned text matches plain aliases. */
function stripNikud(text: string): string {
  return text.replace(/[֑-ׇ]/g, '');
}

function normalizeToken(value: string): string {
  return stripNikud(value.trim().toLowerCase());
}

const HEBREW_ALIAS_STOPWORDS = new Set([
  'של',
  'את',
  'עם',
  'על',
  'זה',
  'זאת',
  'הוא',
  'היא',
  'מה',
  'או',
  'כי',
  'אם',
  'לא',
  'כל',
  'גם',
  'כבר',
  'יותר',
  'אולי',
  'אז',
  'יש',
  'עוד',
  'רק',
  'כמו',
  'אבל',
]);

function roleRelationshipAliases(relationship: string | undefined): string[] {
  if (!relationship) return [];
  const r = relationship.toLowerCase();
  const map: Record<string, string[]> = {
    mother: ['אמא', 'אימא'],
    father: ['אבא', 'אַבָּא'],
    grandmother: ['סבתא'],
    grandfather: ['סבא'],
    sister: ['אחות'],
    brother: ['אח'],
    sibling: ['אחות', 'אח'],
    parent: ['אמא', 'אימא', 'אבא', 'הורה', 'הורים'],
  };
  if (map[r]) return map[r]!;
  if (r.includes('mother') || r === 'mom' || r === 'ima') return map.mother;
  if (r.includes('father') || r === 'dad' || r === 'abba') return map.father;
  if (r.includes('grandmother') || r === 'grandma') return map.grandmother;
  if (r.includes('grandfather') || r === 'grandpa') return map.grandfather;
  if (r.includes('sister')) return map.sister;
  if (r.includes('brother')) return map.brother;
  if (r.includes('sibling')) return map.sibling;
  if (r.includes('parent')) return map.parent;
  return [];
}

function buildFamilyMemberAliases(member: {
  name: string;
  relationship?: string;
}): string[] {
  const aliases = new Set<string>();
  aliases.add(member.name);
  const rel = member.relationship;
  if (rel) aliases.add(rel);
  roleRelationshipAliases(rel).forEach((a) => aliases.add(a));

  const nameWords = member.name.split(/\s+/).filter(Boolean);
  for (const w of nameWords) {
    const t = w.trim();
    if (t.length > 1 && !HEBREW_ALIAS_STOPWORDS.has(normalizeToken(t))) {
      aliases.add(t);
    }
  }

  return [...aliases];
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
  return stripNikud(parts.filter(Boolean).join(' ').toLowerCase());
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

    // ── Stage 1: Story Text (story bank) ─────────────────
    generationLogger.info('Stage started', { orderId, stage: 'text' });
    await prisma.order.update({ where: { id: orderId }, data: { textStatus: 'running' } });

    const challengeCategory = wizardMeta.challengeCategory ?? order.topic ?? 'GENERAL_FEARS';
    const storyLength = (order.storyLength as 'short' | 'medium' | 'long') ?? 'medium';
    const directionForV3 = effectiveStoryDirectionForV3(order.storyDirection, storyLength);

    let selection = selectCompanionStory(resolvedCompanion?.id, directionForV3);
    let storyBankVersion: 'v3' | 'v1' = 'v3';
    if (!selection) {
      selection = selectStoryFromBank(challengeCategory, storyLength);
      storyBankVersion = 'v1';
    }

    if (!selection) {
      throw new Error(`No story-bank story found for category=${challengeCategory}`);
    }

    generationLogger.info('Story bank selection', {
      orderId,
      filename: selection.filename,
      storyBankVersion,
      base: selection.base,
      title: selection.title,
      bankCategory: selection.bankCategory,
      challengeCategory,
      storyLength,
      companionId: resolvedCompanion?.id ?? null,
      directionForV3,
    });

    const storyDir = storyBankVersion === 'v3' ? STORY_BANK_V3_DIR_NAME : 'raw';
    const storyFilePath = path.join(process.cwd(), 'story-bank', storyDir, selection.filename);
    generationLogger.info('Story file path resolved', { orderId, storyDir, storyFilePath, storyBankVersion });
    const patchContext = buildPatchContextFromOrder(order, wizardMeta);
    const letterContext =
      resolvedCompanion?.id && resolvedCompanion?.name
        ? buildLetterContextFromOrder(order, wizardMeta, {
            id: resolvedCompanion.id,
            name: resolvedCompanion.name,
          })
        : null;

    const story = await loadStoryFromBank(
      storyFilePath,
      order.childName || '',
      resolvedCompanion?.name ?? 'צפרדע',
      order.childGender || undefined,
      { patchContext, letterContext }
    );
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
    const familyMembers: Array<{
      name: string;
      description?: string;
      relationship?: string;
      fallbackPrefix: string;
      anchorImageUrl?: string;
    }> = [];
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
    familyMembers.forEach((member, index) => {
      const characterId = inferCharacterId(member.name, member.relationship, member.fallbackPrefix, index);
      if (!anchorRegistry[characterId]) {
        anchorRegistry[characterId] = {
          name: member.name,
          description: member.description ?? `${member.name} recurring family member`,
          relationship: member.relationship,
          anchorImageUrl: member.anchorImageUrl,
          aliases: [...buildFamilyMemberAliases(member), characterId],
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
    const maxNonChild = familyMembers.length > 0 ? 2 : 1;
    const boundedPagesWithCharacters = pagesWithDetectedCharacters.map((page) => {
      const filtered = page.expectedCharacterIds.filter((characterId) => characterId !== 'child');
      const chosen: string[] = [];
      if (companionKey && filtered.includes(companionKey)) {
        chosen.push(companionKey);
      }
      const rest = filtered.filter((id) => id !== companionKey);
      const prioritized = [...rest].sort((a, b) => a.localeCompare(b));
      while (chosen.length < maxNonChild && prioritized.length > 0) {
        chosen.push(prioritized.shift()!);
      }
      return {
        ...page,
        expectedCharacterIds: chosen.length > 0 ? ['child', ...chosen] : ['child'],
      };
    });
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
    const totalStoryPages = story.pages.length;
    const pagesForGeneration = boundedPagesWithCharacters.map((page) => {
      const comp = compositionByPage.get(page.pageNumber);
      const pageLayout: PageLayout = deriveLayout({
        pageNumber: page.pageNumber,
        totalPages: totalStoryPages,
        text: page.text,
        isLetter: Boolean(page.isLetter),
      });
      const enrichedPrompts = buildEnrichedScenePrompt({
        rawScenePrompt: page.rawScenePrompt,
        imagePrompt: page.imagePrompt,
        layout: pageLayout,
        text: page.text,
        textZone: null,
        isLetter: page.isLetter,
        pageNumber: page.pageNumber,
        totalPages: totalStoryPages,
      });
      return {
        pageTemplate: templateByPageNumber.get(page.pageNumber) ?? 'art_top_text_bottom',
        pageNumber: page.pageNumber,
        imagePrompt: enrichedPrompts.imagePrompt,
        rawScenePrompt: enrichedPrompts.rawScenePrompt,
        pageLayout,
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
    // Photo → face description (Claude Vision). Anchors the generated child
    // to the real child's actual features. Returns null if no photo / failure;
    // DNA generation falls back to story-derived description in that case.
    let childPhotoDescription: string | null = null;
    if (order.childImageUrl) {
      try {
        childPhotoDescription = await describeChildFromPhoto(order.childImageUrl);
        generationLogger.info('Photo description extracted', {
          orderId,
          hasDescription: Boolean(childPhotoDescription),
          length: childPhotoDescription?.length ?? 0,
        });
      } catch (err) {
        generationLogger.warn('Photo description extraction failed — using story-only DNA', { orderId, err: String(err) });
      }
    }
    const dna = await generateStoryBankCharacterDNA({
      childName: order.childName || '',
      childGender: order.childGender || 'girl',
      childAge: order.childAge || 4,
      companionName,
      storyText: allStoryText,
      illustrationStyle: order.illustrationStyle,
      childPhotoDescription,
    });
    const lockedChildDescription = dna.childDNA || childDesc;
    if (anchorRegistry.child) {
      anchorRegistry.child.description = lockedChildDescription;
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const gptReferenceImages = mergeGptImageReferenceSources(
      order.childImageUrl,
      resolvedCompanion,
      appBaseUrl
    );

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
        referenceImages: gptReferenceImages,
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
          .map(({ id, character }) => {
            const base = {
              name: character.name,
              description: character.description,
              relationship: character.relationship || (id.startsWith('sibling_') ? 'sibling' : 'supporting'),
            };
            const d = character.supportingVisualDNA;
            if (
              d?.physicalDescription &&
              d?.clothingDefault &&
              d?.signatureDetail &&
              d?.ageRange
            ) {
              return {
                ...base,
                physicalDescription: d.physicalDescription,
                clothingDefault: d.clothingDefault,
                signatureDetail: d.signatureDetail,
                ageRange: d.ageRange,
              };
            }
            return base;
          });
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
        referenceImages: gptReferenceImages,
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

    // ── Stage 3: Audio (optional, per-page ElevenLabs) ──
    // Standalone audio addon OR video/bundle (narration is embedded in the slideshow).
    if ((order.audioEnabled || order.videoEnabled || order.bundleEnabled) && order.selectedVoice) {
      generationLogger.info('Stage started', {
        orderId,
        stage: 'audio',
        voice: order.selectedVoice,
      });
      await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'running' } });

      try {
        const pageChunks = chunkArray(story.pages, 3);
        for (const chunk of pageChunks) {
          await Promise.all(
            chunk.map(async (page) => {
              const narration = page.narrationText?.trim();
              if (!narration) return;
              try {
                const result = await generatePageAudio({
                  narrationText: narration,
                  voiceId: order.selectedVoice!,
                  sleepMode: order.sleepMode,
                  orderId,
                  pageNumber: page.pageNumber,
                });
                await prisma.bookPage.updateMany({
                  where: { bookId: book.id, pageNumber: page.pageNumber },
                  data: { audioUrl: result.url },
                });
              } catch (err) {
                generationLogger.warn(`Audio failed for page ${page.pageNumber}`, {
                  orderId,
                  pageNumber: page.pageNumber,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            })
          );
        }

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

    // ── Stage 3b: Video (optional, after audio so per-page audioUrl is available when narrated)
    if (order.videoEnabled) {
      try {
        const bookPages = await prisma.bookPage.findMany({
          where: { bookId: book.id },
          orderBy: { pageNumber: 'asc' },
          select: {
            pageNumber: true,
            text: true,
            audioUrl: true,
            imageAsset: { select: { url: true, presentationUrl: true } },
          },
        });

        const { generateBookVideo, storeVideo } = await import('../../../backend/providers/video');
        const cover = book.coverImageUrl?.trim() || '';
        const videoPages = [
          ...(cover ? [{ pageNumber: 0, text: '', imageUrl: cover, audioUrl: null }] : []),
          ...bookPages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            imageUrl:
              typeof p.imageAsset?.presentationUrl === 'string'
                ? p.imageAsset.presentationUrl.trim()
                : (p.imageAsset?.url ?? '').trim(),
            audioUrl: p.audioUrl?.trim() ?? null,
          })),
        ].filter((p) => p.imageUrl.length > 0);

        if (videoPages.length === 0) {
          generationLogger.warn('Video stage skipped: no usable page images', { orderId });
        } else {
          const videoBuffer = await generateBookVideo({
            orderId,
            title: book.title,
            pages: videoPages,
          });
          const videoUrl = await storeVideo(videoBuffer, `${orderId}-book.mp4`);
          await prisma.generatedBook.update({
            where: { id: book.id },
            data: { videoUrl },
          });
          generationLogger.info('Stage completed', { orderId, stage: 'video' });
        }
      } catch (videoErr) {
        console.error('[Generate] Video stage failed (non-fatal):', videoErr);
      }
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
        // Pull dedication from the order so it shows in the printable PDF too.
        const orderDedication = await prisma.order.findUnique({
          where: { id: orderId },
          select: { dedication: true },
        });
        const dedicationText = typeof orderDedication?.dedication === 'string'
          ? orderDedication.dedication.trim()
          : '';
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
          ...(dedicationText.length > 0
            ? [{
                pageNumber: 9999,
                text: dedicationText,
                imageUrl: null,
                isCover: false,
                isDedication: true,
              }]
            : []),
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
      const firstPageAudio = await prisma.bookPage.findFirst({
        where: { bookId: book.id, audioUrl: { not: null } },
        orderBy: { pageNumber: 'asc' },
        select: { audioUrl: true },
      });
      await sendBookReadyEmail({
        to:           order.customerEmail,
        customerName: order.customerName ?? order.childName,
        childName:    order.childName,
        readUrl,
        audioUrl:
          firstPageAudio?.audioUrl?.trim() || finishedBook?.audioAsset?.url || undefined,
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

    console.error('[generate] Unhandled error:', error);
    return Response.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
