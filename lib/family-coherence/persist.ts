import type { Prisma } from '@prisma/client';
import { mergeCharacterAnchorsJson } from '@/lib/orderMeta';
import type { FamilyCoherenceBundle } from './types';
import { FAMILY_COHERENCE_JSON_KEY } from './types';

export function getFamilyCoherenceFromAnchors(
  characterAnchors: Prisma.JsonValue | null | undefined
): FamilyCoherenceBundle | null {
  if (!characterAnchors || typeof characterAnchors !== 'object' || Array.isArray(characterAnchors)) {
    return null;
  }
  const raw = (characterAnchors as Record<string, unknown>)[FAMILY_COHERENCE_JSON_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const bundle = raw as FamilyCoherenceBundle;
  if (!bundle.profile?.skinToneBand || !bundle.memberLocks) return null;
  return bundle;
}

export function mergeFamilyCoherenceIntoAnchors(
  existing: Prisma.JsonValue | null | undefined,
  bundle: FamilyCoherenceBundle
): Prisma.JsonValue {
  return mergeCharacterAnchorsJson(existing, {
    [FAMILY_COHERENCE_JSON_KEY]: bundle,
  });
}
