import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  buildSceneMemoryDriftReport,
  fortFormStateIsDrift,
  isStandingCanopy,
  resolveSceneMemoryPlan,
  statesCompatible,
} from '../scene-memory';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { resolveBookShotPlan } from '../book-shot-plan';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

function lionMemory() {
  const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: LION_STORY, pages: beats });
  return resolveSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan })!.memory;
}

describe('SceneMemory J1B-R2 — pile/canopy policy + precision', () => {
  it('standing_canopy vs collapsed expected => drift', () => {
    expect(fortFormStateIsDrift('collapsed', 'standing_canopy')).toBe(true);
    expect(statesCompatible('collapsed', 'standing_canopy')).toBe(false);
  });

  it('loose_pile vs collapsed expected => pass', () => {
    expect(fortFormStateIsDrift('collapsed', 'loose_pile')).toBe(false);
    expect(statesCompatible('collapsed', 'loose_pile')).toBe(true);
  });

  it('p6 Bed center on close_up => unknown not drift', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 6,
      memory,
      sceneMemoryLockPresent: true,
      pageShot: { page: 6, shot: 'close_up', angle: 'eye', rationale: 'test' },
      observed: {
        sceneId: memory.sceneId,
        facts: [{ factId: 'Bed', position: 'center', confidence: 0.9, visibility: 'visible' }],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    expect(report.perFact.find((r) => r.factId === 'Bed')?.status).toBe('unknown');
    expect(report.driftFlags.some((f) => f.startsWith('Bed:') && f.includes('drift'))).toBe(false);
  });

  it('does not emit driftFlags for Pillows/Blanket/Lamp fort noise', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 1,
      memory,
      sceneMemoryLockPresent: true,
      observed: {
        sceneId: memory.sceneId,
        facts: [
          {
            factId: 'Pillow-cave',
            position: 'left',
            state: 'loose_pile',
            confidence: 0.9,
            visibility: 'visible',
          },
          {
            factId: 'Pillows',
            position: 'left',
            state: 'standing_canopy',
            confidence: 0.9,
            visibility: 'visible',
          },
          {
            factId: 'Blanket',
            position: 'center',
            state: 'folded',
            confidence: 0.9,
            visibility: 'visible',
          },
          {
            factId: 'Lamp+table',
            position: 'right',
            state: 'dimmed',
            confidence: 0.9,
            visibility: 'visible',
          },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    expect(report.driftFlags.some((f) => f.startsWith('Pillows:'))).toBe(false);
    expect(report.driftFlags.some((f) => f.startsWith('Blanket:'))).toBe(false);
    expect(report.driftFlags.some((f) => f.startsWith('Lamp+table:'))).toBe(false);
    expect(report.perFact.find((r) => r.factId === 'Pillow-cave')?.status).not.toBe('drift');
  });

  it('in-palette pillow colour => low severity note not drift', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 2,
      memory,
      sceneMemoryLockPresent: true,
      observed: {
        sceneId: memory.sceneId,
        facts: [
          {
            factId: 'Pillows',
            position: 'left',
            color: 'purple',
            confidence: 0.9,
            visibility: 'visible',
          },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    const pillows = report.perFact.find((r) => r.factId === 'Pillows');
    expect(pillows?.status).toBe('consistent');
    expect(pillows?.lowSeverityNote).toMatch(/in-palette/i);
    expect(report.driftFlags.some((f) => f.startsWith('Pillows:'))).toBe(false);
  });

  it('isStandingCanopy recognizes canopy aliases', () => {
    expect(isStandingCanopy('standing_canopy')).toBe(true);
    expect(isStandingCanopy('built_or_tent')).toBe(true);
  });
});
