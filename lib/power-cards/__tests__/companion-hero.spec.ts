import { describe, expect, it } from 'vitest';
import { resolveCompanionHeroUrl } from '../index';
import {
  BOLLY_ARMADILLO,
  COMPANIONS_BY_CATEGORY,
  type Companion,
} from '@/lib/companions';

// Every rostered companion, flattened across categories.
const ALL_COMPANIONS: Companion[] = Object.values(COMPANIONS_BY_CATEGORY).flat();

// The exact URL that the old resolver hard-coded as a shared fallback — the "everyone gets bolly" bug.
const SHARED_BOLLY_DEFAULT_URL = BOLLY_ARMADILLO.image;

describe("resolveCompanionHeroUrl — the power-card hero is the companion's OWN art, never a shared default", () => {
  it('prefers the hi-res card sheet (cardImage) when authored', () => {
    const withCard: Companion = {
      id: 'x',
      name: 'X',
      tagline: '',
      narrativeHook: '',
      image: '/companions/x/reference.jpg',
      cardImage: '/companions/x/style01-sheets/front.png',
      visualDescription: '',
    };
    expect(resolveCompanionHeroUrl(withCard)).toBe('/companions/x/style01-sheets/front.png');
  });

  it('falls back to the full-body reference (image) when there is no card sheet', () => {
    const noCard: Companion = {
      id: 'y',
      name: 'Y',
      tagline: '',
      narrativeHook: '',
      image: '/companions/y/reference.jpg',
      visualDescription: '',
    };
    expect(resolveCompanionHeroUrl(noCard)).toBe('/companions/y/reference.jpg');
  });

  it('resolves every rostered companion to its own non-empty art', () => {
    for (const c of ALL_COMPANIONS) {
      const url = resolveCompanionHeroUrl(c);
      expect(url, `companion ${c.id}`).toBe(c.cardImage ?? c.image);
      expect(url.trim().length, `companion ${c.id} must have art`).toBeGreaterThan(0);
    }
  });

  it('NEVER resolves a non-bolly companion to the shared bolly default (regression: the old cross-companion fallback)', () => {
    for (const c of ALL_COMPANIONS) {
      if (c.id === 'bolly_armadillo') continue; // bolly legitimately points at the bolly art
      expect(
        resolveCompanionHeroUrl(c),
        `companion ${c.id} must not fall back to the shared bolly default`,
      ).not.toBe(SHARED_BOLLY_DEFAULT_URL);
    }
  });
});
