import { describe, expect, it } from 'vitest';

import {
  COMPANION_SCALE_CONTRACTS,
  getCompanionScaleContract,
  buildCompanionScalePromptLine,
} from '@/lib/companion-scale';
import { MVP_STORY_MATRIX } from '@/backend/config/mvp-story-matrix';

const MVP_COMPANION_IDS = Object.values(MVP_STORY_MATRIX).map((s) => s.companionId);

describe('COMPANION_SCALE_CONTRACTS', () => {
  it('covers every MVP companion (6)', () => {
    expect(MVP_COMPANION_IDS).toHaveLength(6);
    for (const id of MVP_COMPANION_IDS) {
      expect(COMPANION_SCALE_CONTRACTS[id], `missing scale for ${id}`).toBeTruthy();
    }
  });

  it('every contract is internally consistent (band brackets the ratio, sane bounds, prohibitions)', () => {
    for (const [id, sc] of Object.entries(COMPANION_SCALE_CONTRACTS)) {
      const [min, max] = sc.ratioBand;
      expect(min, `${id} band min<max`).toBeLessThan(max);
      expect(sc.ratioToChild, `${id} ratio >= band min`).toBeGreaterThanOrEqual(min);
      expect(sc.ratioToChild, `${id} ratio <= band max`).toBeLessThanOrEqual(max);
      // A companion is smaller than the child and never vanishingly tiny.
      expect(sc.ratioToChild, `${id} ratio in (0,1)`).toBeGreaterThan(0);
      expect(sc.ratioToChild, `${id} clearly shorter than child`).toBeLessThan(1);
      expect(sc.humanLandmark.trim().length).toBeGreaterThan(0);
      expect(sc.prohibitions.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('getCompanionScaleContract', () => {
  it('returns the contract for a known MVP companion', () => {
    expect(getCompanionScaleContract('panda_anat')).toBe(COMPANION_SCALE_CONTRACTS.panda_anat);
  });
  it('returns null for unknown / nullish ids (non-MVP or no companion)', () => {
    expect(getCompanionScaleContract('octopus_seara')).toBeNull(); // has sheets but not MVP
    expect(getCompanionScaleContract(null)).toBeNull();
    expect(getCompanionScaleContract(undefined)).toBeNull();
    expect(getCompanionScaleContract('')).toBeNull();
  });
});

describe('buildCompanionScalePromptLine', () => {
  it('states the landmark, the percentage, and the prohibitions', () => {
    const line = buildCompanionScalePromptLine(COMPANION_SCALE_CONTRACTS.panda_anat);
    expect(line).toMatch(/COMPANION SIZE vs CHILD/i);
    expect(line).toContain('panda cub');
    expect(line).toContain('60%'); // ratioToChild 0.6
    expect(line).toMatch(/never/i); // prohibitions present
  });
});
