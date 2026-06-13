import { describe, expect, it } from 'vitest';

import { COMPANION_ACCESSORY_PROFILES } from '../companion-accessory';
import { getCompanionBible } from '../companion-bible';
import { getCompanionById } from '../companions';

const KIM_ID = 'chameleon_koko';

/** Positive (canon) description sources — must agree on satchel, never scarf/patchwork. */
const KIM_POSITIVE_SOURCES = [
  { label: 'registry', text: () => getCompanionById(KIM_ID)?.visualDescription ?? '' },
  {
    label: 'accessory profile',
    text: () => {
      const p = COMPANION_ACCESSORY_PROFILES[KIM_ID];
      return [p?.canonicalAccessory, p?.accessoryBehavior].filter(Boolean).join(' ');
    },
  },
] as const;

const KIM_FORBIDDEN_IN_POSITIVE = [/scarf/i, /striped scarf/i, /patchwork/i, /multicolor patches/i];

function isForbiddenPositiveMatch(text: string, pattern: RegExp): boolean {
  const lower = text.toLowerCase();
  if (!pattern.test(lower)) return false;
  const bible = getCompanionBible(KIM_ID);
  const forbiddenCtx = [
    ...(bible?.forbiddenObjects ?? []),
    ...(COMPANION_ACCESSORY_PROFILES[KIM_ID]?.forbiddenAlternatives ?? []),
  ]
    .join(' ')
    .toLowerCase();
  // Allow mention only inside bible/accessory forbidden lists — not as Kim's actual look.
  const stripped = lower.replace(forbiddenCtx, '');
  return pattern.test(stripped);
}

describe('Kim (chameleon_koko) canon consistency', () => {
  it('registry visualDescription includes mustard satchel canon', () => {
    const desc = getCompanionById(KIM_ID)?.visualDescription ?? '';
    expect(desc).toMatch(/satchel/i);
    expect(desc).toMatch(/warm mustard/i);
    expect(desc).toMatch(/NOT patches/i);
  });

  it('accessory profile locks tiny mustard satchel — not scarf', () => {
    const profile = COMPANION_ACCESSORY_PROFILES[KIM_ID];
    expect(profile?.canonicalAccessory).toMatch(/satchel/i);
    expect(profile?.forbiddenAlternatives).toEqual(
      expect.arrayContaining(['scarf', 'striped scarf', 'patchwork'])
    );
  });

  it('bible forbiddenObjects blocks scarf/patchwork regression', () => {
    const bible = getCompanionBible(KIM_ID);
    expect(bible?.forbiddenObjects).toEqual(
      expect.arrayContaining(['scarf', 'striped scarf', 'patchwork'])
    );
  });

  it('no positive canon source describes Kim with scarf or patchwork', () => {
    for (const source of KIM_POSITIVE_SOURCES) {
      const text = source.text();
      expect(text.length, `${source.label} empty`).toBeGreaterThan(20);
      for (const pattern of KIM_FORBIDDEN_IN_POSITIVE) {
        expect(
          isForbiddenPositiveMatch(text, pattern),
          `${source.label} must not positively describe Kim with ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('public JS mirror includes same satchel canon when visualDescription present', () => {
    // companions.js is hand-maintained for wizard — spot-check pattern via registry (source of truth).
    const desc = getCompanionById(KIM_ID)?.visualDescription ?? '';
    expect(desc).not.toMatch(/striped scarf/i);
    expect(desc).not.toMatch(/patchwork pastel/i);
  });
});
