import type { Order, Prisma } from '@prisma/client';

/**
 * Privacy: the uploaded child photo is used ONLY to derive the illustrated character,
 * then deleted from storage. It is never shared. Illustrated anchors and book pages remain.
 */

/** Literal timing for trust-band / FAQ copy — must match runtime behavior. */
export const CHILD_PHOTO_DELETION_POLICY = {
  timingEn: 'immediately when book generation completes',
  timingHe: 'מיד עם סיום יצירת הספר',
  /** 0 = delete on the completion hook (no grace period). */
  delayMs: 0,
} as const;

const ORIGINAL_CHILD_PHOTO_KEY_RE =
  /^orders\/[^/]+\/references\/(?:main-child|stage0-child-photo)-/i;
const WIZARD_CHILD_PHOTO_KEY_RE = /^wizard\/char-photos\//i;

export type ChildPhotoPrivacyMeta = {
  originalChildPhotoUrl?: string;
  childPhotoDeletedAt?: string;
  childPhotoDeletionNote?: 'no_photo' | 'completed' | 'storage_partial';
};

/** Parse a Supabase public object URL into a storage key, or null if not our bucket/object. */
export function parseSupabasePublicObjectKey(
  publicUrl: string,
  bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images'
): string | null {
  const trimmed = publicUrl.trim();
  if (!trimmed) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  const key = trimmed.slice(idx + marker.length).split('?')[0]?.split('#')[0]?.trim();
  return key || null;
}

/** True for uploaded reference photos — NOT illustrated anchors, pages, or covers. */
export function isOriginalChildPhotoStorageKey(key: string): boolean {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  return ORIGINAL_CHILD_PHOTO_KEY_RE.test(normalized) || WIZARD_CHILD_PHOTO_KEY_RE.test(normalized);
}

export function getChildPhotoPrivacyMeta(
  characterAnchors: Prisma.JsonValue | null | undefined
): ChildPhotoPrivacyMeta {
  if (!characterAnchors || typeof characterAnchors !== 'object' || Array.isArray(characterAnchors)) {
    return {};
  }
  const privacy = (characterAnchors as Record<string, unknown>)._privacy;
  if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) return {};
  const p = privacy as Record<string, unknown>;
  const note = p.childPhotoDeletionNote;
  return {
    originalChildPhotoUrl:
      typeof p.originalChildPhotoUrl === 'string' ? p.originalChildPhotoUrl : undefined,
    childPhotoDeletedAt:
      typeof p.childPhotoDeletedAt === 'string' ? p.childPhotoDeletedAt : undefined,
    childPhotoDeletionNote:
      note === 'no_photo' || note === 'completed' || note === 'storage_partial'
        ? note
        : undefined,
  };
}

/** Persist the first seen original photo URL for deletion after anchor replaces childImageUrl. */
export function mergeOriginalChildPhotoUrlIntoAnchors(
  characterAnchors: Prisma.JsonValue | null | undefined,
  originalPhotoUrl: string | null | undefined
): Prisma.JsonValue {
  const url = originalPhotoUrl?.trim();
  if (!url) return (characterAnchors ?? {}) as Prisma.JsonValue;

  const base =
    characterAnchors && typeof characterAnchors === 'object' && !Array.isArray(characterAnchors)
      ? { ...(characterAnchors as Record<string, unknown>) }
      : {};
  const privacy =
    base._privacy && typeof base._privacy === 'object' && !Array.isArray(base._privacy)
      ? { ...(base._privacy as Record<string, unknown>) }
      : {};
  if (typeof privacy.originalChildPhotoUrl !== 'string') {
    privacy.originalChildPhotoUrl = url;
  }
  base._privacy = privacy;
  return base as Prisma.JsonValue;
}

function collectCandidatePhotoUrls(order: Pick<Order, 'childImageUrl' | 'characterAnchors'>): string[] {
  const urls = new Set<string>();
  const privacy = getChildPhotoPrivacyMeta(order.characterAnchors);
  if (privacy.originalChildPhotoUrl) urls.add(privacy.originalChildPhotoUrl);

  const childImageUrl = order.childImageUrl?.trim();
  if (childImageUrl) urls.add(childImageUrl);

  if (order.characterAnchors && typeof order.characterAnchors === 'object' && !Array.isArray(order.characterAnchors)) {
    const anchors = order.characterAnchors as Record<string, unknown>;
    const child = anchors.child;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const childRecord = child as Record<string, unknown>;
      const refs = childRecord.referenceOrderUsed;
      if (Array.isArray(refs)) {
        for (const ref of refs) {
          if (typeof ref === 'string' && ref.trim()) urls.add(ref.trim());
        }
      }
      const sourceImageUrl = childRecord.sourceImageUrl;
      if (typeof sourceImageUrl === 'string' && sourceImageUrl.trim()) {
        urls.add(sourceImageUrl.trim());
      }
    }
  }

  return [...urls];
}

export function resolveDeletableStorageKeysFromOrder(
  order: Pick<Order, 'id' | 'childImageUrl' | 'characterAnchors'>,
  bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images'
): string[] {
  const keys = new Set<string>();
  for (const url of collectCandidatePhotoUrls(order)) {
    const key = parseSupabasePublicObjectKey(url, bucket);
    if (key && isOriginalChildPhotoStorageKey(key)) keys.add(key);
  }
  return [...keys];
}

export function buildCharacterAnchorsAfterPhotoDeletion(
  characterAnchors: Prisma.JsonValue | null | undefined,
  note: ChildPhotoPrivacyMeta['childPhotoDeletionNote']
): Prisma.JsonValue {
  const base =
    characterAnchors && typeof characterAnchors === 'object' && !Array.isArray(characterAnchors)
      ? { ...(characterAnchors as Record<string, unknown>) }
      : {};
  const privacy =
    base._privacy && typeof base._privacy === 'object' && !Array.isArray(base._privacy)
      ? { ...(base._privacy as Record<string, unknown>) }
      : {};

  delete privacy.originalChildPhotoUrl;

  const child = base.child;
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    const childRecord = { ...(child as Record<string, unknown>) };
    delete childRecord.sourceImageUrl;
    base.child = childRecord;
  }

  base._privacy = {
    ...privacy,
    childPhotoDeletedAt: new Date().toISOString(),
    childPhotoDeletionNote: note ?? 'completed',
  };
  return base as Prisma.JsonValue;
}

export function orderHasChildPhotoEvidence(
  order: Pick<Order, 'id' | 'childImageUrl' | 'characterAnchors'>
): boolean {
  if (getChildPhotoPrivacyMeta(order.characterAnchors).originalChildPhotoUrl) return true;
  if (order.childImageUrl?.trim()) return true;
  return resolveDeletableStorageKeysFromOrder(order).length > 0;
}
