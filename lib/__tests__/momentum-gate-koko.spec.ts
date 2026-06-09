import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  normalizeChildDoesField,
  runMomentumGateBeforeProse,
} from '../story-gen-v3/momentum-gate';
import type { PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from '../story-gen-v3/types';

const STOP2 = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/koko_scenario_2_transition-stop2-2026-06-09T14-35-00-165Z'
);

describe('momentum gate koko stop2 beats', () => {
  it('detects child action on slash-chip childDoes (>=4 pages)', () => {
    const beats = JSON.parse(
      readFileSync(path.join(STOP2, 'page-beats.json'), 'utf8')
    ) as PageBeatV3[];
    const premise = JSON.parse(
      readFileSync(path.join(STOP2, 'hardened-premise.json'), 'utf8')
    ) as StoryPremiseCandidate;
    const spine = JSON.parse(
      readFileSync(path.join(STOP2, 'story-spine.json'), 'utf8')
    ) as StorySpineV3;

    const r = runMomentumGateBeforeProse({ spine, beats, premise });
    expect(r.childActionPages).toBeGreaterThanOrEqual(4);
    expect(r.pass).toBe(true);
  });
});
