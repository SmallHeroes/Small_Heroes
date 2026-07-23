import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  selectCalibrationPages,
  type BookVisualContract,
  type PageVisualContract,
} from '@/lib/visual-contract-compiler';

function page(pageNumber: number, overrides: Partial<PageVisualContract> = {}): PageVisualContract {
  return {
    pageNumber,
    locationId: pageNumber < 3 ? 'loc_launchpad' : 'loc_orbit',
    zoneId: pageNumber < 3 ? 'zone_pad' : 'zone_capsule',
    sameLocationAs: pageNumber > 1 ? pageNumber - 1 : null,
    mustShow: [],
    mustNotShow: [],
    characterPresence: { child: true, companion: pageNumber >= 2 },
    castIds: ['child:hero'],
    propState: [],
    camera: pageNumber === 2 ? 'wide view with a compass point painted on the floor' : 'wide view',
    transition: { kind: 'steady' },
    ...overrides,
  };
}

function syntheticContract(pageCount: number): BookVisualContract {
  return {
    version: 1,
    storyKey: 'space_rescue_fixture',
    worldType: 'grounded space-training adventure',
    locations: [
      { id: 'loc_launchpad', name: 'Launch pad', description: 'training launch pad' },
      { id: 'loc_orbit', name: 'Orbital capsule', description: 'small training capsule' },
    ],
    zones: [
      { id: 'zone_pad', locationId: 'loc_launchpad', name: 'Pad', description: 'launch pad' },
      { id: 'zone_capsule', locationId: 'loc_orbit', name: 'Capsule', description: 'capsule' },
    ],
    cast: {
      child: { id: 'child:hero', role: 'child', wardrobe: { description: 'orange flight suit' } },
    },
    recurringProps: [{
      id: 'prop_signal_lamp',
      name: 'signal lamp',
      description: 'small amber signal lamp',
      firstRevealPage: Math.min(3, pageCount),
    }],
    forbiddenGlobalElements: ['magic castles'],
    coverContract: {
      worldType: 'grounded space-training adventure',
      locationId: 'loc_launchpad',
      mustShow: ['training rocket'],
      mustNotShow: ['magic castles'],
    },
    pageContracts: Array.from({ length: pageCount }, (_, index) => page(index + 1)),
  };
}

describe('structured five-risk calibration selector', () => {
  it('returns exactly five distinct frames and deterministically backfills category collisions', () => {
    const contract = syntheticContract(8);
    const selection = selectCalibrationPages(contract, {
      primaryWorldPage: 3,
      revealPropContinuityPage: 3,
      meaningfulInteractionPage: 3,
      emotionalClosePage: 8,
    });
    expect(selection.pageNumbers).toHaveLength(5);
    expect(new Set(selection.pageNumbers).size).toBe(5);
    expect(selection.pageNumbers[0]).toBe(0);
    expect(selection.riskAssignments.find((candidate) => candidate.pageNumber === 3)?.risks).toEqual([
      'primary_world',
      'reveal_prop_continuity',
      'meaningful_interaction',
    ]);
  });

  it('returns every distinct frame for a shorter book and never treats the noun "point" as action authority', () => {
    const contract = syntheticContract(3);
    const selection = selectCalibrationPages(contract);
    expect(selection.pageNumbers).toHaveLength(4);
    expect(new Set(selection.pageNumbers).size).toBe(4);
    expect(selection.companionAction).toBe(2);
    expect(selection.riskAssignments.flatMap((candidate) => candidate.risks)).not.toContain('camera_verb');
  });

  it('selects the approved Fox LOW plan through general structured risk evidence, without shared-code literals', () => {
    const template = JSON.parse(fs.readFileSync(
      path.join(
        process.cwd(),
        'story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json',
      ),
      'utf8',
    )) as BookVisualContract;
    const selection = selectCalibrationPages(template, {
      primaryWorldPage: 3,
      revealPropContinuityPage: 5,
      meaningfulInteractionPage: 9,
      emotionalClosePage: 12,
    });
    expect(selection.pageNumbers).toEqual([0, 3, 5, 9, 12]);
  });
});
