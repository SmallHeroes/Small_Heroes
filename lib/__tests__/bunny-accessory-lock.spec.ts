import { describe, expect, it } from 'vitest';

import {
  buildCompanionAccessoryLockBlock,
  COMPANION_ACCESSORY_PROFILES,
} from '../companion-accessory';
import { getCompanionById } from '../companions';

const BUNNY_ID = 'bunny_ometz';

/**
 * bunny_ometz was the only MVP companion missing from COMPANION_ACCESSORY_PROFILES, so
 * buildCompanionAccessoryLockBlock returned undefined → no canonical/forbidden accessory clause →
 * the heart chest badge drifted (to a star, scarf, etc.). This locks the canonical heart badge and
 * the forbidden alternatives, worded to match bunny's visualDescription in lib/companions.ts.
 */
describe('Bunny (bunny_ometz) accessory lock', () => {
  it('has an accessory profile with a canonical heart chest badge (not forbidden-only)', () => {
    const profile = COMPANION_ACCESSORY_PROFILES[BUNNY_ID];
    expect(profile, 'bunny_ometz must be in COMPANION_ACCESSORY_PROFILES').toBeDefined();
    expect(profile?.accessoryForbiddenOnly).not.toBe(true);
    expect(profile?.canonicalAccessory).toMatch(/heart-shaped badge/i);
    expect(profile?.canonicalAccessory).toMatch(/chest/i);
    expect(profile?.accessoryRequiredWhenVisible).toBe(true);
  });

  it('canonical accessory stays consistent with the registry visualDescription (no invented canon)', () => {
    const desc = getCompanionById(BUNNY_ID)?.visualDescription ?? '';
    expect(desc).toMatch(/heart-shaped badge/i);
    expect(desc).toMatch(/chest/i);
    // The lock wording must echo the registry canon, not introduce a new accessory.
    expect(COMPANION_ACCESSORY_PROFILES[BUNNY_ID]?.canonicalAccessory).toMatch(/heart-shaped badge/i);
  });

  it('forbids the common drift alternatives (scarf/cape/bow/hat/necklace/glasses/backpack/held toys/star)', () => {
    const profile = COMPANION_ACCESSORY_PROFILES[BUNNY_ID];
    expect(profile?.forbiddenAlternatives).toEqual(
      expect.arrayContaining([
        'scarf',
        'cape',
        'bow',
        'hat',
        'necklace',
        'glasses',
        'backpack',
        'held toy',
        'chest star',
      ])
    );
  });

  it('builds a present-companion lock block with the heart badge ALWAYS clause and NEVER forbids', () => {
    const lock = buildCompanionAccessoryLockBlock({
      companionId: BUNNY_ID,
      companionName: 'הארנבון בּוּנִי',
      companionPresence: 'present',
      context: 'story_page',
    });
    expect(lock, 'lock block must no longer be undefined for bunny').toBeDefined();
    expect(lock).toMatch(/COMPANION ACCESSORY LOCK/);
    expect(lock).toMatch(/ALWAYS tiny heart-shaped badge/i);
    expect(lock).toMatch(/NEVER scarf/i);
    expect(lock).toMatch(/NEVER chest star/i);
  });

  it('emits a non-contradiction clause on partial/offscreen presence', () => {
    const lock = buildCompanionAccessoryLockBlock({
      companionId: BUNNY_ID,
      companionName: 'הארנבון בּוּנִי',
      companionPresence: 'partial',
      context: 'story_page',
    });
    expect(lock).toBeDefined();
    expect(lock).toMatch(/Canonical accessory is tiny heart-shaped badge/i);
    expect(lock).toMatch(/NEVER scarf/i);
  });
});
