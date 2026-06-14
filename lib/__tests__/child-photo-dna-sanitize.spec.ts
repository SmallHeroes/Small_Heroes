import { describe, expect, it } from 'vitest';

import {
  assertIdentityLockFreeOfClothingWhenWardrobeApplies,
  IdentityClothingLeakError,
  joinChildStructuredDNA,
  SAFE_CHILD_CLOTHING_POINTER,
  sanitizeChildStructuredAgainstPhoto,
  type StructuredChildDNA,
} from '../child-photo-dna-sanitize';
import { LION_SHAKET_BEDTIME_WARDROBE_LOCK } from '../style01-story-wardrobe';

const childWithDayClothes: StructuredChildDNA = {
  face: 'Round face, warm olive skin, bright brown eyes.',
  hair: 'Short dark curly hair.',
  body: 'Build appropriate for a 6-year-old boy.',
  clothing: 'Wearing a light blue t-shirt, dark denim shorts, and red sneakers with white laces.',
  signature: 'Small dimple when smiling.',
};

describe('child-photo-dna-sanitize — identity vs wardrobe', () => {
  it('joinChildStructuredDNA omits clothing — no day-clothes phrase in identity lock', () => {
    const joined = joinChildStructuredDNA(childWithDayClothes);
    expect(joined).not.toMatch(/t-shirt/i);
    expect(joined).not.toMatch(/denim/i);
    expect(joined).not.toMatch(/sneakers/i);
    expect(joined).not.toMatch(/Wearing/i);
    expect(joined).toContain('Round face');
    expect(joined).toContain('Short dark curly hair');
  });

  it('sanitizeChildStructuredAgainstPhoto always returns safe clothing pointer', () => {
    const withoutPhoto = sanitizeChildStructuredAgainstPhoto(childWithDayClothes, null);
    expect(withoutPhoto.clothing).toBe(SAFE_CHILD_CLOTHING_POINTER);

    const withPhoto = sanitizeChildStructuredAgainstPhoto(
      childWithDayClothes,
      'Boy on beach, shirtless, short dark curly hair.'
    );
    expect(withPhoto.clothing).toBe(SAFE_CHILD_CLOTHING_POINTER);
    expect(joinChildStructuredDNA(withPhoto)).not.toMatch(/t-shirt/i);
  });

  it('assertIdentityLockFreeOfClothingWhenWardrobeApplies passes when no wardrobe lock', () => {
    expect(() =>
      assertIdentityLockFreeOfClothingWhenWardrobeApplies({
        identityLockText: childWithDayClothes.clothing,
        wardrobeLock: undefined,
      })
    ).not.toThrow();
  });

  it('assertIdentityLockFreeOfClothingWhenWardrobeApplies passes with wardrobe lock and clean identity', () => {
    expect(() =>
      assertIdentityLockFreeOfClothingWhenWardrobeApplies({
        identityLockText: joinChildStructuredDNA(
          sanitizeChildStructuredAgainstPhoto(childWithDayClothes, 'Beach boy, shirtless.')
        ),
        wardrobeLock: LION_SHAKET_BEDTIME_WARDROBE_LOCK,
        childStructured: sanitizeChildStructuredAgainstPhoto(
          childWithDayClothes,
          'Beach boy, shirtless.'
        ),
      })
    ).not.toThrow();
  });

  it('assertIdentityLockFreeOfClothingWhenWardrobeApplies throws on clothing leak in identity lock', () => {
    expect(() =>
      assertIdentityLockFreeOfClothingWhenWardrobeApplies({
        identityLockText: childWithDayClothes.clothing,
        wardrobeLock: LION_SHAKET_BEDTIME_WARDROBE_LOCK,
      })
    ).toThrow(IdentityClothingLeakError);

    expect(() =>
      assertIdentityLockFreeOfClothingWhenWardrobeApplies({
        identityLockText: 'Clean face description.',
        wardrobeLock: LION_SHAKET_BEDTIME_WARDROBE_LOCK,
        childStructured: {
          face: 'Wearing a light blue t-shirt.',
          hair: 'Curly hair.',
          body: 'Slender build.',
          signature: '',
        },
      })
    ).toThrow(/IDENTITY_CLOTHING_LEAK.*t-shirt/);
  });
});
