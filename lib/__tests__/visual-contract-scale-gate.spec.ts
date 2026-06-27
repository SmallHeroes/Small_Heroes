import { describe, expect, it } from 'vitest';

import {
  evaluatePageContractQa,
  interpretVisionJson,
  buildContractRerollSuppression,
  type BookVisualContract,
  type PageVisionObservation,
  type CompanionScaleContract,
} from '@/lib/visual-contract-compiler';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';

const scaleContract: CompanionScaleContract = {
  ratioToChild: 0.6,
  ratioBand: [0.5, 0.72],
  humanLandmark: "a small panda cub at the child's chest",
  prohibitions: ['never as tall as the child', 'never a tiny toy'],
};

const contract = {
  cast: { companion: { name: 'Panda', scaleContract } },
  locations: [{ id: 'home_bedroom', name: 'Bedroom', description: 'a bedroom' }],
  coverContract: { worldType: 'home', timeOfDay: 'night' },
} as unknown as BookVisualContract;

const companionPage = {
  locationId: 'home_bedroom',
  characterPresence: { child: true, companion: true },
  companionWardrobeLock: 'red scarf',
} as unknown as ResolvedPageContract;

/** Clean base observation (everything passes except whatever the test overrides). */
function obs(over: Partial<PageVisionObservation>): PageVisionObservation {
  return {
    locationMatchesContract: true,
    forbiddenEntitiesPresent: [],
    missingMajorProps: [],
    companionWardrobeMatches: true,
    coverWorldMatches: null,
    ...over,
  };
}

/** A measurable observation with a given companion/child height ratio. */
function measured(childH: number, compH: number, over: Partial<PageVisionObservation> = {}): PageVisionObservation {
  return obs({
    bothFullBody: true,
    sameGroundPlane: true,
    scaleConfidence: 0.85,
    childHeightFraction: childH,
    companionHeightFraction: compH,
    ...over,
  });
}

describe('companion_scale gate — code computes the ratio, vision only measures', () => {
  it('measurable + ratio inside band → no scale failure', () => {
    const v = evaluatePageContractQa({ page: companionPage, observation: measured(0.5, 0.3), scaleContract }); // 0.6
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
    expect(v.pass).toBe(true);
  });

  it('measurable + companion too BIG (child-sized) → companion_scale failure', () => {
    const v = evaluatePageContractQa({ page: companionPage, observation: measured(0.5, 0.48), scaleContract }); // 0.96
    const f = v.failures.find((x) => x.check === 'companion_scale');
    expect(f).toBeTruthy();
    expect(f!.detail).toMatch(/96% of child height/);
    expect(f!.detail).toMatch(/allowed 50–72%/);
  });

  it('measurable + companion too SMALL → companion_scale failure', () => {
    const v = evaluatePageContractQa({ page: companionPage, observation: measured(0.5, 0.15), scaleContract }); // 0.3
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(true);
  });

  it('NOT measurable (not full-body) → never a failure (conservative)', () => {
    const v = evaluatePageContractQa({
      page: companionPage,
      observation: measured(0.5, 0.48, { bothFullBody: false }),
      scaleContract,
    });
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
  });

  it('low confidence → not measurable → no failure', () => {
    const v = evaluatePageContractQa({
      page: companionPage,
      observation: measured(0.5, 0.48, { scaleConfidence: 0.3 }),
      scaleContract,
    });
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
  });

  it('different depth (not same ground plane) → no failure', () => {
    const v = evaluatePageContractQa({
      page: companionPage,
      observation: measured(0.5, 0.48, { sameGroundPlane: false }),
      scaleContract,
    });
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
  });

  it('no scaleContract → scale check is inert', () => {
    const v = evaluatePageContractQa({ page: companionPage, observation: measured(0.5, 0.48) });
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
  });

  it('companion not on the page → no scale check even with a gross measurement', () => {
    const childOnly = { ...companionPage, characterPresence: { child: true, companion: false } } as ResolvedPageContract;
    const v = evaluatePageContractQa({ page: childOnly, observation: measured(0.5, 0.48), scaleContract });
    expect(v.failures.some((f) => f.check === 'companion_scale')).toBe(false);
  });
});

describe('interpretVisionJson — parses the scale measurements', () => {
  it('reads the numeric fractions, full-body, depth, and confidence', () => {
    const o = interpretVisionJson(
      JSON.stringify({
        locationMatchesContract: true,
        forbiddenEntitiesPresent: [],
        childHeightFraction: 0.55,
        companionHeightFraction: 0.33,
        bothFullBody: true,
        sameGroundPlane: true,
        scaleConfidence: 0.9,
      })
    );
    expect(o.childHeightFraction).toBe(0.55);
    expect(o.companionHeightFraction).toBe(0.33);
    expect(o.bothFullBody).toBe(true);
    expect(o.sameGroundPlane).toBe(true);
    expect(o.scaleConfidence).toBe(0.9);
  });
  it('defaults missing measurements to null (not_measurable)', () => {
    const o = interpretVisionJson(JSON.stringify({ locationMatchesContract: true }));
    expect(o.childHeightFraction).toBeNull();
    expect(o.bothFullBody).toBeNull();
  });
});

describe('feedback reroll — gross scale violation', () => {
  it('feeds the canonical band + landmark back into the next attempt', () => {
    const verdict = evaluatePageContractQa({ page: companionPage, observation: measured(0.5, 0.48), scaleContract });
    const s = buildContractRerollSuppression({
      observation: measured(0.5, 0.48),
      verdict,
      page: companionPage,
      contract,
      attempt: 0,
    });
    expect(s).toMatch(/WRONG SIZE/i);
    expect(s).toContain('panda cub');
    expect(s).toContain('60%');
    expect(s).toMatch(/never as tall as the child/);
  });
});
