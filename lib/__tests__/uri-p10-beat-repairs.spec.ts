import { describe, expect, it } from 'vitest';

import { applyUriP10StructureGateBeatRepairs } from '../story-gen-v3/uri-p10-beat-repairs';
import type { PageBeatV3 } from '../story-gen-v3/types';

const base = (page: number): PageBeatV3 => ({
  page,
  event: 'e',
  childDoes: 'c',
  whatChanges: 'w',
  whatGetsFunnierOrHarder: 'f',
  pageTurnReason: 'r',
  visualAnchor: 'v',
});

describe('uri_premise_10 structure gate beat repairs', () => {
  it('p4 removes water splash before bucket discovery', () => {
    const beats = applyUriP10StructureGateBeatRepairs([
      {
        ...base(4),
        whatGetsFunnierOrHarder: 'המים משפריצים החוצה',
        visualAnchor: 'splash of water',
      },
    ]);
    expect(beats[0].whatGetsFunnierOrHarder).not.toMatch(/מים משפריצים/);
    expect(beats[0].visualAnchor).toMatch(/no water/i);
  });

  it('p8 frames pretend play not real belief', () => {
    const beats = applyUriP10StructureGateBeatRepairs([
      {
        ...base(8),
        event: 'שניהם בטוחים שמישהו עונה להם',
      },
    ]);
    expect(beats[0].event).toMatch(/כאילו/);
    expect(beats[0].whatChanges).toMatch(/העמדת-פנים/);
  });
});
