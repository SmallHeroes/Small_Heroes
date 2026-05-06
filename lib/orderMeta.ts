import 'server-only';

import type { Prisma } from '@prisma/client';

export type CharacterAnchorPersistence = {
  name: string;
  description: string;
  anchorImageUrl?: string | null;
  aliases?: string[];
};

export type CategoryAnswer = {
  questionId?: string;
  question: string;
  answer: string;
  selectedQuickAnswers?: string[];
};

export type PhotoQualityStatus = 'good' | 'warning' | 'blocked';

export type PhotoQualityMeta = {
  status: PhotoQualityStatus;
  faceCount: number;
  dominantFaceRatio?: number;
  reasonCodes: string[];
};

/**
 * Wizard-only fields stored inside `Order.characterAnchors` under `_wizard`.
 */
export type CharacterAnchorsWizardMeta = {
  companionCharacterId?: string;
  challengeCategory?: string;
  categoryAnswers?: CategoryAnswer[];
  photoQuality?: PhotoQualityMeta;
};

/**
 * Serialize registry + wizard meta for `Order.characterAnchors`.
 * Companion anchor keys store a plain URL string (per pipeline contract).
 */
export function buildPersistedCharacterAnchorsJson(
  anchorRegistry: Record<string, CharacterAnchorPersistence>,
  wizardMeta: CharacterAnchorsWizardMeta
): Prisma.JsonValue {
  const out: Record<string, unknown> = {};
  if (wizardMeta.companionCharacterId || wizardMeta.challengeCategory || (wizardMeta.categoryAnswers && wizardMeta.categoryAnswers.length > 0) || wizardMeta.photoQuality) {
    out._wizard = {
      ...(wizardMeta.companionCharacterId ? { companionCharacterId: wizardMeta.companionCharacterId } : {}),
      ...(wizardMeta.challengeCategory ? { challengeCategory: wizardMeta.challengeCategory } : {}),
      ...(wizardMeta.categoryAnswers && wizardMeta.categoryAnswers.length > 0
        ? { categoryAnswers: wizardMeta.categoryAnswers }
        : {}),
      ...(wizardMeta.photoQuality ? { photoQuality: wizardMeta.photoQuality } : {}),
    };
  }
  for (const [characterId, character] of Object.entries(anchorRegistry)) {
    if (characterId.startsWith('companion:') && character.anchorImageUrl) {
      out[characterId] = character.anchorImageUrl;
      continue;
    }
    out[characterId] = {
      name: character.name,
      description: character.description,
      anchorImageUrl: character.anchorImageUrl ?? null,
      aliases: character.aliases ?? [],
    };
  }
  return out as Prisma.JsonValue;
}

const ANCHOR_KEY_COMPANION_PREFIX = 'companion:' as const;
export { ANCHOR_KEY_COMPANION_PREFIX as COMPANION_ANCHOR_KEY_PREFIX };
export const companionAnchorKey = (companionId: string) => `${ANCHOR_KEY_COMPANION_PREFIX}${companionId}`;

export function getWizardMeta(anchors: Prisma.JsonValue | null | undefined): CharacterAnchorsWizardMeta {
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) return {};
  const a = anchors as Record<string, unknown>;
  if (a._wizard && typeof a._wizard === 'object' && a._wizard !== null) {
    const w = a._wizard as Record<string, unknown>;
    let categoryAnswers: CategoryAnswer[] = [];
    const raw = w.categoryAnswers;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        if (typeof row.question !== 'string' || typeof row.answer !== 'string') continue;
        const selectedQuickAnswers = Array.isArray(row.selectedQuickAnswers)
          ? row.selectedQuickAnswers.filter((value): value is string => typeof value === 'string')
          : [];
        categoryAnswers.push({
          ...(typeof row.questionId === 'string' && row.questionId.trim()
            ? { questionId: row.questionId }
            : {}),
          question: row.question,
          answer: row.answer,
          ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
        });
      }
    }
    let photoQuality: PhotoQualityMeta | undefined;
    const rawPhotoQuality = w.photoQuality;
    if (rawPhotoQuality && typeof rawPhotoQuality === 'object' && !Array.isArray(rawPhotoQuality)) {
      const pq = rawPhotoQuality as Record<string, unknown>;
      const status = pq.status;
      const faceCount = Number(pq.faceCount);
      const reasonCodes = Array.isArray(pq.reasonCodes)
        ? pq.reasonCodes.filter((value): value is string => typeof value === 'string')
        : [];
      if (
        (status === 'good' || status === 'warning' || status === 'blocked') &&
        Number.isFinite(faceCount) &&
        faceCount >= 0
      ) {
        photoQuality = {
          status,
          faceCount,
          ...(Number.isFinite(Number(pq.dominantFaceRatio))
            ? { dominantFaceRatio: Number(pq.dominantFaceRatio) }
            : {}),
          reasonCodes,
        };
      }
    }
    return {
      companionCharacterId: typeof w.companionCharacterId === 'string' ? w.companionCharacterId : undefined,
      challengeCategory: typeof w.challengeCategory === 'string' ? w.challengeCategory : undefined,
      categoryAnswers: categoryAnswers.length > 0 ? categoryAnswers : undefined,
      photoQuality,
    };
  }
  if (typeof a.companionCharacterId === 'string' || typeof a.challengeCategory === 'string') {
    return {
      companionCharacterId: typeof a.companionCharacterId === 'string' ? a.companionCharacterId : undefined,
      challengeCategory: typeof a.challengeCategory === 'string' ? a.challengeCategory : undefined,
    };
  }
  return {};
}

/**
 * Merges new anchor data from image pipeline with existing JSON while preserving
 * `_wizard` and existing `companion:*` string URLs (never overwrite with objects).
 */
export function mergeCharacterAnchorsJson(
  existing: Prisma.JsonValue | null | undefined,
  next: Record<string, unknown>
): Prisma.JsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(next)) {
    if (k === '_wizard') {
      if (!base._wizard) base._wizard = v;
      continue;
    }
    if (k.startsWith('companion:') && typeof base[k] === 'string' && typeof v === 'string') {
      continue;
    }
    base[k] = v;
  }
  return base as Prisma.JsonValue;
}
