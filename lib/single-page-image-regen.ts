import 'server-only';

import path from 'path';
import { generateAllPageImages } from '@/backend/providers/image';
import {
  buildEnrichedScenePrompt,
  deriveLayout,
  type PageLayout,
} from '@/backend/providers/image-prompt-enricher';
import { FamilyContext } from '@/backend/providers/story';
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
import {
  buildPresentationWebpFromBuffer,
  evaluateImageSignal,
  fetchImageBuffer,
  placementModeFromPageTemplate,
} from '@/lib/illustrationPresentation';
import { storePresentationBuffer } from '@/lib/image-storage';
import { assignTemplatesForBook, type BookPageTemplate } from '@/lib/bookPageLayout';
import {
  getCompanionById,
  getCompanionByIdAndCategory,
  getCompanionReferencePublicUrl,
} from '@/lib/companions';
import { createLogger } from '@/lib/logger';
import { companionAnchorKey, getWizardMeta } from '@/lib/orderMeta';
import { buildLetterContextFromOrder, buildPatchContextFromOrder } from '@/backend/providers/personalization';
import { prisma } from '@/lib/prisma';
import { evaluatePhotoGate, resolveResemblanceThresholdConfig } from '@/lib/resemblance-core';

const regenLogger = createLogger({ subsystem: 'regen-page', route: '/api/debug/regen-page' });

type CharacterAnchorRecord = {
  name: string;
  description: string;
  relationship?: string;
  anchorImageUrl?: string;
  aliases?: string[];
  supportingVisualDNA?: {
    physicalDescription: string;
    clothingDefault: string;
    signatureDetail: string;
    ageRange: string;
  };
};

export type RegenPageResult = {
  ok: true;
  orderId: string;
  pageNumber: number;
  newImageUrl: string;
  oldImageUrl: string | null;
  promptLength: number;
  promptPreview: string;
};

function effectiveStoryDirectionForV3(
  storyDirection: string | null | undefined,
  storyLength: 'short' | 'medium' | 'long'
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

function stripNikud(text: string): string {
  return text.replace(/[֑-ׇ]/g, '');
}

function normalizeToken(value: string): string {
  return stripNikud(value.trim().toLowerCase());
}

const HEBREW_ALIAS_STOPWORDS = new Set([
  'של', 'את', 'עם', 'על', 'זה', 'זאת', 'הוא', 'היא', 'מה', 'או', 'כי', 'אם', 'לא', 'כל', 'גם', 'כבר',
  'יותר', 'אולי', 'אז', 'יש', 'עוד', 'רק', 'כמו', 'אבל',
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

function buildFamilyMemberAliases(member: { name: string; relationship?: string }): string[] {
  const aliases = new Set<string>();
  aliases.add(member.name);
  const rel = member.relationship;
  if (rel) aliases.add(rel);
  roleRelationshipAliases(rel).forEach((a) => aliases.add(a));
  for (const w of member.name.split(/\s+/).filter(Boolean)) {
    const t = w.trim();
    if (t.length > 1 && !HEBREW_ALIAS_STOPWORDS.has(normalizeToken(t))) aliases.add(t);
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
    const description =
      typeof candidate.description === 'string' ? candidate.description : `${name} recurring character`;
    const relationship = typeof candidate.relationship === 'string' ? candidate.relationship : undefined;
    const anchorImageUrl = typeof candidate.anchorImageUrl === 'string' ? candidate.anchorImageUrl : undefined;
    const aliases = Array.isArray(candidate.aliases)
      ? candidate.aliases.filter((item): item is string => typeof item === 'string')
      : [];
    parsed[key] = { name, description, relationship, anchorImageUrl, aliases };
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

  if (
    !page.imageSubject.toLowerCase().startsWith('environment') &&
    !page.imageSubject.toLowerCase().startsWith('object:')
  ) {
    expected.add('child');
  }

  for (const [characterId, character] of Object.entries(registry)) {
    const aliases = [character.name, ...(character.aliases ?? [])].map(normalizeToken).filter(Boolean);
    if (aliases.some((alias) => haystack.includes(alias))) {
      expected.add(characterId);
      continue;
    }
    if (
      supportingSubject &&
      aliases.some((alias) => alias.includes(supportingSubject) || supportingSubject.includes(alias))
    ) {
      expected.add(characterId);
    }
  }

  if (expected.size === 0) expected.add('child');
  return [...expected];
}

function normalizePageTemplate(value: string | null | undefined): BookPageTemplate | null {
  if (value === 'full_bleed_overlay' || value === 'art_top_text_bottom' || value === 'character_vignette_text') {
    return value;
  }
  return null;
}

function promptPreview(prompt: string, maxLen = 400): string {
  if (prompt.length <= maxLen) return prompt;
  return `${prompt.slice(0, maxLen)}…`;
}

export async function regenerateSinglePageImage(orderId: string, pageNumber: number): Promise<RegenPageResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      book: {
        include: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            include: { imageAsset: true },
          },
        },
      },
      storyDirectionSet: { include: { selectedDirection: true } },
    },
  });

  if (!order?.book) {
    throw new Error('Order or book not found');
  }

  const dbPage = order.book.pages.find((p) => p.pageNumber === pageNumber);
  if (!dbPage) {
    throw new Error(`Page ${pageNumber} not found on book`);
  }

  const oldImageUrl = dbPage.imageAsset?.url ?? null;
  const wizardMeta = getWizardMeta(order.characterAnchors);
  const resolvedCompanion = getCompanionByIdAndCategory(
    wizardMeta.companionCharacterId ?? null,
    wizardMeta.challengeCategory ?? null
  );
  const storyLength = (order.storyLength as 'short' | 'medium' | 'long') ?? 'medium';
  const directionForV3 = effectiveStoryDirectionForV3(order.storyDirection, storyLength);
  const challengeCategory = wizardMeta.challengeCategory ?? order.topic ?? 'GENERAL_FEARS';

  let selection = selectCompanionStory(resolvedCompanion?.id, directionForV3);
  let storyBankVersion: 'v3' | 'v1' = 'v3';
  if (!selection) {
    selection = selectStoryFromBank(challengeCategory, storyLength);
    storyBankVersion = 'v1';
  }
  if (!selection) {
    throw new Error(`No story-bank story found for category=${challengeCategory}`);
  }

  let storyDir = storyBankVersion === 'v3' ? STORY_BANK_V3_DIR_NAME : 'raw';
  let storyFilePath = path.join(process.cwd(), 'story-bank', storyDir, selection.filename);

  // ── Legacy-order fallback ──
  // Older orders point at v1 'raw/' filenames which no longer exist on disk
  // (raw/ was deleted in favor of v5-fixed-v2). If the file is missing, try:
  //  1) The order's resolved companion across all 3 directions
  //  2) ANY companion in v5-fixed-v2 across all 3 directions
  // The story will not match the original 1:1 but it will let us regen images.
  const { existsSync, readdirSync } = await import('fs');
  if (!existsSync(storyFilePath)) {
    regenLogger.warn('Story file missing; attempting v3 fallback', {
      orderId,
      pageNumber,
      missingPath: storyFilePath,
      companionId: resolvedCompanion?.id ?? null,
    });
    const tryCompanions: string[] = [];
    if (resolvedCompanion?.id) tryCompanions.push(resolvedCompanion.id);
    const v3Dir = path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME);
    if (existsSync(v3Dir)) {
      try {
        const files = readdirSync(v3Dir).filter((f) => f.endsWith('.md'));
        const seen = new Set<string>(tryCompanions);
        for (const file of files) {
          const base = file.replace(/_(?:adventure|bedtime|fantasy)\.md$/, '');
          if (!seen.has(base)) {
            seen.add(base);
            tryCompanions.push(base);
          }
        }
      } catch {}
    }
    outer: for (const compId of tryCompanions) {
      const directions = [directionForV3, 'adventure', 'bedtime', 'fantasy'] as const;
      for (const dir of directions) {
        const candidate = selectCompanionStory(compId, dir);
        if (candidate) {
          const candidatePath = path.join(process.cwd(), 'story-bank', STORY_BANK_V3_DIR_NAME, candidate.filename);
          if (existsSync(candidatePath)) {
            selection = candidate;
            storyBankVersion = 'v3';
            storyDir = STORY_BANK_V3_DIR_NAME;
            storyFilePath = candidatePath;
            regenLogger.info('Story file recovered via v3 fallback', {
              orderId,
              pageNumber,
              recoveredPath: storyFilePath,
              originalDirection: directionForV3,
              recoveredCompanion: compId,
              recoveredDirection: dir,
            });
            break outer;
          }
        }
      }
    }
  }

  if (!existsSync(storyFilePath)) {
    throw new Error(`Story file not found and no v3 fallback exists: ${storyFilePath}`);
  }
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

  const storyPage = story.pages.find((p) => p.pageNumber === pageNumber);
  if (!storyPage) {
    throw new Error(`Story bank has no page ${pageNumber}`);
  }

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

  const clothingLock = story.heroVisualLock?.clothing?.trim();
  const childDescBase = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;
  const childDesc = clothingLock ? `${childDescBase}; wearing ${clothingLock}` : childDescBase;
  const storedAnchors = parseStoredCharacterAnchors(order.characterAnchors);
  const anchorRegistry: Record<string, CharacterAnchorRecord> = {
    ...storedAnchors,
    child: {
      name: order.childName,
      description: childDesc,
      relationship: 'child',
      anchorImageUrl: storedAnchors.child?.anchorImageUrl ?? order.childImageUrl ?? undefined,
      aliases: [order.childName, 'child', ...(storedAnchors.child?.aliases ?? [])],
    },
  };

  const familyContext = order.familyContext as FamilyContext | undefined;
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
      aliases: [...(existing?.aliases ?? []), character.name, character.relationship],
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
        expectedCharacterIds: [...new Set([...baseIds, companionAnchorKey(resolvedCompanion.id)])],
      };
    }
    return { ...page, expectedCharacterIds: baseIds };
  });

  const companionKey = resolvedCompanion ? companionAnchorKey(resolvedCompanion.id) : null;
  const maxNonChild = familyMembers.length > 0 ? 2 : 1;
  const boundedPagesWithCharacters = pagesWithDetectedCharacters.map((page) => {
    const filtered = page.expectedCharacterIds.filter((characterId) => characterId !== 'child');
    const chosen: string[] = [];
    if (companionKey && filtered.includes(companionKey)) chosen.push(companionKey);
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

  const targetBounded = boundedPagesWithCharacters.find((p) => p.pageNumber === pageNumber);
  if (!targetBounded) {
    throw new Error(`Bounded page ${pageNumber} missing`);
  }

  const totalStoryPages = story.pages.length;
  const comp = compositionByPage.get(pageNumber);
  const pageTemplate = templateByPageNumber.get(pageNumber) ?? 'art_top_text_bottom';
  const pageLayout: PageLayout = deriveLayout({
    pageNumber,
    totalPages: totalStoryPages,
    text: storyPage.text,
    isLetter: Boolean(storyPage.isLetter),
  });
  const enrichedPrompts = buildEnrichedScenePrompt({
    rawScenePrompt: storyPage.rawScenePrompt,
    imagePrompt: storyPage.imagePrompt,
    layout: pageLayout,
    text: storyPage.text,
    textZone: dbPage.textZone,
    isLetter: storyPage.isLetter,
    pageNumber,
    totalPages: totalStoryPages,
  });

  const pageForGeneration = {
    pageTemplate,
    pageNumber,
    imagePrompt: enrichedPrompts.imagePrompt,
    rawScenePrompt: enrichedPrompts.rawScenePrompt,
    pageLayout,
    visualDirection: storyPage.visualDirection,
    bookPageText: storyPage.text,
    imageSubject: storyPage.imageSubject,
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
    compositionRules: compositionRulesForTemplate(pageTemplate, comp),
    environmentContinuity: comp?.consistencyNotes ?? undefined,
    expectedCharacterIds: targetBounded.expectedCharacterIds.filter((characterId) =>
      recurringCharacterIds.has(characterId)
    ),
  };

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

  const allStoryText = story.pages.map((page) => page.text).join('\n');
  const companionName = resolvedCompanion?.name || '';
  const companionDescription = resolvedCompanion?.visualDescription || '';

  let childPhotoDescription: string | null = null;
  if (order.childImageUrl) {
    try {
      childPhotoDescription = await describeChildFromPhoto(order.childImageUrl);
    } catch (err) {
      regenLogger.warn('Photo description extraction failed', { orderId, err: String(err) });
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

  const supportingCharacters = (pageForGeneration.expectedCharacterIds || [])
    .filter((id) => id !== 'child' && !id.startsWith('companion:'))
    .map((id) => ({ id, character: anchorRegistry[id] }))
    .filter((entry): entry is { id: string; character: CharacterAnchorRecord } => Boolean(entry.character))
    .map(({ id, character }) => {
      const base = {
        name: character.name,
        description: character.description,
        relationship: character.relationship || (id.startsWith('sibling_') ? 'sibling' : 'supporting'),
      };
      const d = character.supportingVisualDNA;
      if (d?.physicalDescription && d?.clothingDefault && d?.signatureDetail && d?.ageRange) {
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

  const selectedDirection = order.storyDirectionSet?.selectedDirection ?? null;
  const existingPageNumbers = order.book.pages
    .filter((p) => p.pageNumber !== pageNumber && p.imageAsset?.id)
    .map((p) => p.pageNumber);

  regenLogger.info('Regenerating single page image', {
    orderId,
    pageNumber,
    storyFile: selection.filename,
    existingPageNumbers,
    hasChildPhoto: Boolean(order.childImageUrl),
  });

  const imageOutcome = await generateAllPageImages(
    [{ ...pageForGeneration, supportingCharacters }],
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
          { id: characterId, name: character.name, description: character.description },
        ])
      ),
      initialCharacterAnchors: anchorState,
      existingPageNumbers,
      orderId,
      characterSheet: story.characterSheet,
      concept: story.concept,
      heroVisualLock: story.heroVisualLock,
      styleLock: story.styleLock,
      entityVisualLock: story.entityVisualLock,
      childStructured: dna.childStructured,
      companionStructured: dna.companionStructured,
      propDNA: dna.propDNA,
      extraNegativeRules: dna.negativeRules,
      inputPhotoStrength,
      photoQuality: wizardMeta.photoQuality,
      resemblanceThresholdConfig: resolveResemblanceThresholdConfig(),
      companion: resolvedCompanion,
      directionArchetype: selectedDirection?.archetype,
      directionEmotionalLabel: selectedDirection?.emotionalLabel,
      directionStoryPremise: selectedDirection?.storyPremise,
      pdfEnabled: order.pdfEnabled,
    }
  );

  const image = imageOutcome.results.get(pageNumber);
  if (!image) {
    throw new Error(
      imageOutcome.failedPages.includes(pageNumber)
        ? `Image generation failed for page ${pageNumber}`
        : `No image returned for page ${pageNumber}`
    );
  }

  regenLogger.info('Single page image generated', {
    orderId,
    pageNumber,
    provider: image.provider,
    promptLength: image.prompt.length,
    url: image.url,
    oldImageUrl,
  });

  const storyboardTextZone = imageOutcome.textZones.get(pageNumber) ?? null;
  const storyboardLighting = imageOutcome.lightingModes.get(pageNumber) ?? null;
  if (
    dbPage.textZone !== storyboardTextZone ||
    dbPage.lighting !== storyboardLighting ||
    dbPage.textColorScheme == null
  ) {
    await prisma.bookPage.update({
      where: { id: dbPage.id },
      data: { textZone: storyboardTextZone, lighting: storyboardLighting },
    });
  }

  const presentationPostprocessEnabled =
    process.env.ENABLE_PRESENTATION_POSTPROCESS !== 'false' &&
    process.env.SKIP_ILLUSTRATION_PRESENTATION !== 'true';

  let presentationUrl: string | null = dbPage.imageAsset?.presentationUrl ?? null;
  if (presentationPostprocessEnabled) {
    try {
      const mode =
        normalizePageTemplate(dbPage.pageTemplate) ??
        templateByPageNumber.get(pageNumber) ??
        'art_top_text_bottom';
      const sourceBuffer = await fetchImageBuffer(image.url);
      const sourceSignal = await evaluateImageSignal(sourceBuffer);
      if (sourceSignal.usable) {
        const webp = await buildPresentationWebpFromBuffer(
          sourceBuffer,
          placementModeFromPageTemplate(mode),
          pageNumber
        );
        const presentationSignal = await evaluateImageSignal(webp, { baseline: sourceSignal });
        if (presentationSignal.usable) {
          presentationUrl = await storePresentationBuffer({
            buffer: webp,
            orderId,
            pageNumber,
          });
        }
      }
    } catch (presErr) {
      regenLogger.warn('Presentation postprocess failed; keeping previous presentation if any', {
        orderId,
        pageNumber,
        err: String(presErr),
      });
    }
  }

  if (dbPage.imageAsset) {
    await prisma.imageAsset.update({
      where: { id: dbPage.imageAsset.id },
      data: {
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
      },
    });
  }

  try {
    const imageUrlForAnalysis = presentationUrl || image.url;
    const textZoneForPage = imageOutcome.textZones.get(pageNumber) ?? 'bottom_clear';
    const { analyzeTextZoneLuminance } = await import('@/backend/providers/image-analysis');
    const textColorScheme = await analyzeTextZoneLuminance(imageUrlForAnalysis, textZoneForPage);
    await prisma.bookPage.update({
      where: { id: dbPage.id },
      data: { textColorScheme },
    });
  } catch (analysisErr) {
    regenLogger.warn('Text color analysis failed', { orderId, pageNumber, err: String(analysisErr) });
  }

  return {
    ok: true,
    orderId,
    pageNumber,
    newImageUrl: image.url,
    oldImageUrl,
    promptLength: image.prompt.length,
    promptPreview: promptPreview(image.prompt),
  };
}
