import type { Order } from '@prisma/client';
import type { CharacterSheet } from '@/backend/providers/pipeline';
import {
  getCompanionById,
  getCompanionByIdAndCategory,
  getCompanionReferencePublicUrl,
  type Companion,
} from '@/lib/companions';
import { companionAnchorKey, getWizardMeta } from '@/lib/orderMeta';

export type CharacterAnchorRecord = {
  name: string;
  description: string;
  relationship?: string;
  anchorImageUrl?: string;
  aliases?: string[];
};

function stripNikud(text: string): string {
  return text.replace(/[֑-ׇ]/g, '');
}

function normalizeToken(value: string): string {
  return stripNikud(value.trim().toLowerCase());
}

function buildHaystack(parts: Array<string | undefined>): string {
  return stripNikud(parts.filter(Boolean).join(' ').toLowerCase());
}

export function detectExpectedCharactersForPage(
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
    parsed[key] = {
      name: typeof candidate.name === 'string' ? candidate.name : key,
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : `${key} recurring character`,
      relationship: typeof candidate.relationship === 'string' ? candidate.relationship : undefined,
      anchorImageUrl:
        typeof candidate.anchorImageUrl === 'string' ? candidate.anchorImageUrl : undefined,
      aliases: Array.isArray(candidate.aliases)
        ? candidate.aliases.filter((a): a is string => typeof a === 'string')
        : [],
    };
  }
  return parsed;
}

export function buildImagePipelineAnchors(input: {
  order: Order;
  lockedChildDescription: string;
  resolvedCompanion: Companion | null;
  characterSheet?: CharacterSheet;
  appBaseUrl: string;
}): {
  anchorRegistry: Record<string, CharacterAnchorRecord>;
  initialCharacterAnchors: Record<string, string>;
  characterRegistry: Record<string, { id: string; name: string; description: string }>;
} {
  const storedAnchors = parseStoredCharacterAnchors(input.order.characterAnchors);
  const anchorRegistry: Record<string, CharacterAnchorRecord> = {
    ...storedAnchors,
    child: {
      name: input.order.childName,
      description: input.lockedChildDescription,
      relationship: 'child',
      anchorImageUrl: storedAnchors.child?.anchorImageUrl ?? input.order.childImageUrl ?? undefined,
      aliases: [input.order.childName, 'child', ...(storedAnchors.child?.aliases ?? [])],
    },
  };

  if (input.resolvedCompanion) {
    const ck = companionAnchorKey(input.resolvedCompanion.id);
    if (!anchorRegistry[ck]) {
      anchorRegistry[ck] = {
        name: input.resolvedCompanion.name,
        description: input.resolvedCompanion.visualDescription,
        relationship: 'companion',
        aliases: [input.resolvedCompanion.name, input.resolvedCompanion.id],
      };
    }
    const ref = getCompanionReferencePublicUrl(input.resolvedCompanion, input.appBaseUrl);
    if (ref && !anchorRegistry[ck].anchorImageUrl) {
      anchorRegistry[ck].anchorImageUrl = ref;
    }
  }

  input.characterSheet?.supportingCharacters?.forEach((character, index) => {
    const characterId = `supporting_${index + 1}`;
    const existing = anchorRegistry[characterId];
    anchorRegistry[characterId] = {
      name: existing?.name ?? character.name,
      description: existing?.description ?? character.visualDescription,
      relationship: existing?.relationship ?? character.relationship,
      anchorImageUrl: existing?.anchorImageUrl,
      aliases: [...(existing?.aliases ?? []), character.name, character.relationship],
    };
  });

  const initialCharacterAnchors: Record<string, string> = {};
  for (const [characterId, character] of Object.entries(anchorRegistry)) {
    if (character.anchorImageUrl) {
      initialCharacterAnchors[characterId] = character.anchorImageUrl;
    }
  }

  const characterRegistry = Object.fromEntries(
    Object.entries(anchorRegistry).map(([characterId, character]) => [
      characterId,
      { id: characterId, name: character.name, description: character.description },
    ])
  );

  return { anchorRegistry, initialCharacterAnchors, characterRegistry };
}

export function resolveCompanionForOrder(order: Order): Companion | null {
  const wizardMeta = getWizardMeta(order.characterAnchors);
  return getCompanionByIdAndCategory(
    wizardMeta.companionCharacterId ?? null,
    wizardMeta.challengeCategory ?? null
  );
}
