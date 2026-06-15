import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  buildSceneMemoryDriftReport,
  getExpectedStateForPage,
  positionsCompatible,
  resolveSceneMemoryPlan,
  seedSceneMemoryPlan,
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

describe('SceneMemory J1B — detector hardening', () => {
  it('inventory excludes visibleAnchor garbage — only stableFacts/setTopology ids', () => {
    const memory = lionMemory();
    expect(memory.inventory).toContain('Pillow-cave');
    expect(memory.inventory).toContain('Bed');
    expect(memory.inventory).not.toContain('same-child-bed');
    expect(memory.inventory).not.toContain('leo-gentle-beside-child');
    expect(memory.inventory.every((id) => id in memory.stableFacts)).toBe(true);
  });

  it('expected collapsed + observed standing_canopy => drift', () => {
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
            state: 'standing_canopy',
            confidence: 0.9,
            visibility: 'visible',
          },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    const cave = report.perFact.find((r) => r.factId === 'Pillow-cave');
    expect(cave?.status).toBe('drift');
    expect(cave?.note).toMatch(/standing canopy/i);
  });

  it('expected collapsed + observed collapsed/scattered => pass', () => {
    const memory = lionMemory();
    for (const state of ['collapsed', 'scattered'] as const) {
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
              state,
              confidence: 0.9,
              visibility: 'visible',
            },
          ],
          unauthorizedProps: [],
          unknowns: [],
          visionSkipped: false,
        },
      });
      const cave = report.perFact.find((r) => r.factId === 'Pillow-cave');
      expect(['consistent', 'story_authorized_change']).toContain(cave?.status);
    }
  });

  it('walls/floor observed background => NOT drift', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 1,
      memory,
      sceneMemoryLockPresent: true,
      observed: {
        sceneId: memory.sceneId,
        facts: [
          { factId: 'walls', position: 'background', confidence: 0.9, visibility: 'visible' },
          { factId: 'floor', position: 'foreground', confidence: 0.9, visibility: 'visible' },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    expect(report.perFact.find((r) => r.factId === 'walls')?.status).not.toBe('drift');
    expect(report.perFact.find((r) => r.factId === 'floor')?.status).not.toBe('drift');
  });

  it('close-up low-confidence position => unknown not drift', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 6,
      memory,
      sceneMemoryLockPresent: true,
      observed: {
        sceneId: memory.sceneId,
        facts: [
          { factId: 'Bed', position: 'center', confidence: 0.4, visibility: 'uncertain' },
          { factId: 'Rug', position: 'bottom', confidence: 0.3, visibility: 'uncertain' },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    expect(report.perFact.find((r) => r.factId === 'Bed')?.status).toBe('unknown');
    expect(report.perFact.find((r) => r.factId === 'Rug')?.status).toBe('unknown');
    expect(report.driftFlags.some((f) => /^Bed:.*drift/i.test(f))).toBe(false);
  });

  it('tolerant position: lamp right vs expected bedside-between = consistent', () => {
    const memory = lionMemory();
    const report = buildSceneMemoryDriftReport({
      page: 1,
      memory,
      sceneMemoryLockPresent: true,
      observed: {
        sceneId: memory.sceneId,
        facts: [
          {
            factId: 'Lamp+table',
            position: 'right',
            confidence: 0.9,
            visibility: 'visible',
          },
        ],
        unauthorizedProps: [],
        unknowns: [],
        visionSkipped: false,
      },
    });
    expect(report.perFact.find((r) => r.factId === 'Lamp+table')?.status).toBe('consistent');
    expect(positionsCompatible(
      memory.stableFacts['Lamp+table'].position,
      'right'
    )).toBe(true);
  });

  it('page 1 expects collapsed pillow-cave from story text', () => {
    const memory = lionMemory();
    expect(getExpectedStateForPage(memory, 'Pillow-cave', 1)).toBe('collapsed');
    expect(statesCompatible('collapsed', 'scattered')).toBe(true);
    expect(statesCompatible('collapsed', 'loose_pile')).toBe(true);
    expect(statesCompatible('collapsed', 'standing_canopy')).toBe(false);
  });
});
