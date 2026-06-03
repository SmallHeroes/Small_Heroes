import type { Order, Prisma } from '@prisma/client';
import type { FamilyContext } from '@/backend/providers/story';
import { deriveFamilyCoherenceProfile } from './derive';
import { buildFamilyMemberVisualLocks } from './member-locks';
import { getFamilyCoherenceFromAnchors, mergeFamilyCoherenceIntoAnchors } from './persist';
import type { FamilyCoherenceBundle } from './types';

export type EnsureFamilyCoherenceInput = {
  childPhotoDescription?: string | null;
  childStructured?: {
    face?: string;
    hair?: string;
    body?: string;
    clothing?: string;
    signature?: string;
  } | null;
  familyContext?: FamilyContext | null;
};

export function ensureFamilyCoherenceBundle(
  order: Pick<Order, 'characterAnchors' | 'familyContext'>,
  input: EnsureFamilyCoherenceInput
): FamilyCoherenceBundle {
  const existing = getFamilyCoherenceFromAnchors(order.characterAnchors);
  if (existing?.profile?.derivedAt) return existing;

  const familyContext = (order.familyContext ?? input.familyContext) as FamilyContext | null;
  const profile = deriveFamilyCoherenceProfile({
    childPhotoDescription: input.childPhotoDescription,
    childStructured: input.childStructured,
    familyContext,
  });
  const memberLocks = buildFamilyMemberVisualLocks(profile, familyContext);
  return { profile, memberLocks };
}

export function persistFamilyCoherenceOnOrder(
  characterAnchors: Prisma.JsonValue | null | undefined,
  bundle: FamilyCoherenceBundle
): Prisma.JsonValue {
  return mergeFamilyCoherenceIntoAnchors(characterAnchors, bundle);
}
