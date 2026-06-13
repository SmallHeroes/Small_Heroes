import { describe, expect, it } from 'vitest';
import {
  buildCharacterAnchorsAfterPhotoDeletion,
  CHILD_PHOTO_DELETION_POLICY,
  getChildPhotoPrivacyMeta,
  isOriginalChildPhotoStorageKey,
  mergeOriginalChildPhotoUrlIntoAnchors,
  parseSupabasePublicObjectKey,
  resolveDeletableStorageKeysFromOrder,
} from '@/lib/child-photo-deletion-policy';

const BUCKET = 'book-images';
const ORDER_ID = 'ord_test_1';

describe('child photo deletion', () => {
  it('documents immediate deletion timing for trust copy', () => {
    expect(CHILD_PHOTO_DELETION_POLICY.delayMs).toBe(0);
    expect(CHILD_PHOTO_DELETION_POLICY.timingEn).toContain('immediately');
    expect(CHILD_PHOTO_DELETION_POLICY.timingHe).toContain('מיד');
  });

  it('parses Supabase public object URLs', () => {
    const url = `https://example.supabase.co/storage/v1/object/public/${BUCKET}/orders/${ORDER_ID}/references/main-child-123.jpg`;
    expect(parseSupabasePublicObjectKey(url, BUCKET)).toBe(
      `orders/${ORDER_ID}/references/main-child-123.jpg`
    );
    expect(parseSupabasePublicObjectKey('https://other.cdn/photo.jpg', BUCKET)).toBeNull();
  });

  it('recognizes original photo keys but not illustrated outputs', () => {
    expect(isOriginalChildPhotoStorageKey(`orders/${ORDER_ID}/references/main-child-1.jpg`)).toBe(
      true
    );
    expect(
      isOriginalChildPhotoStorageKey(`orders/${ORDER_ID}/references/stage0-child-photo-2.png`)
    ).toBe(true);
    expect(isOriginalChildPhotoStorageKey('wizard/char-photos/123-abc.jpg')).toBe(true);
    expect(
      isOriginalChildPhotoStorageKey(`orders/${ORDER_ID}/character-anchors/child-canonical.png`)
    ).toBe(false);
    expect(isOriginalChildPhotoStorageKey(`orders/${ORDER_ID}/pages/page-001.png`)).toBe(false);
  });

  it('stores original photo URL once in privacy meta', () => {
    const first = mergeOriginalChildPhotoUrlIntoAnchors(null, 'https://x/main.jpg');
    const privacy = getChildPhotoPrivacyMeta(first);
    expect(privacy.originalChildPhotoUrl).toBe('https://x/main.jpg');

    const second = mergeOriginalChildPhotoUrlIntoAnchors(first, 'https://x/other.jpg');
    expect(getChildPhotoPrivacyMeta(second).originalChildPhotoUrl).toBe('https://x/main.jpg');
  });

  it('resolves deletable keys from order fields without touching anchors', () => {
    const photoUrl = `https://example.supabase.co/storage/v1/object/public/${BUCKET}/orders/draft-abc/references/main-child-99.jpg`;
    const anchorUrl = `https://example.supabase.co/storage/v1/object/public/${BUCKET}/orders/${ORDER_ID}/character-anchors/child-canonical.png`;

    const keys = resolveDeletableStorageKeysFromOrder(
      {
        id: ORDER_ID,
        childImageUrl: anchorUrl,
        characterAnchors: {
          _privacy: { originalChildPhotoUrl: photoUrl },
          child: {
            anchorImageUrl: anchorUrl,
            referenceOrderUsed: [photoUrl, anchorUrl],
          },
        },
      },
      BUCKET
    );

    expect(keys).toEqual([`orders/draft-abc/references/main-child-99.jpg`]);
  });

  it('marks deletion in anchors and clears original photo URL', () => {
    const next = buildCharacterAnchorsAfterPhotoDeletion(
      {
        _privacy: { originalChildPhotoUrl: 'https://x/photo.jpg' },
        child: { anchorImageUrl: 'https://x/anchor.png', sourceImageUrl: 'https://x/photo.jpg' },
      },
      'completed'
    );
    const meta = getChildPhotoPrivacyMeta(next);
    expect(meta.childPhotoDeletedAt).toBeTruthy();
    expect(meta.childPhotoDeletionNote).toBe('completed');
    expect(meta.originalChildPhotoUrl).toBeUndefined();
    const child = (next as Record<string, unknown>).child as Record<string, unknown>;
    expect(child.anchorImageUrl).toBe('https://x/anchor.png');
    expect(child.sourceImageUrl).toBeUndefined();
  });

  it('handles no-photo orders with a stable skipped marker', () => {
    const next = buildCharacterAnchorsAfterPhotoDeletion(null, 'no_photo');
    expect(getChildPhotoPrivacyMeta(next).childPhotoDeletionNote).toBe('no_photo');
  });
});
