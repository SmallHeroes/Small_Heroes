import { describe, expect, it } from 'vitest';
import path from 'path';

import { resolveBookShotPlan } from '../book-shot-plan';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../story-location-bible/zone-sheets';
import {
  buildSceneMemoryGenerationConstraints,
  buildSceneMemoryLockBlock,
  promptContainsSceneMemoryGenerationConstraints,
  resolveSceneMemoryPlan,
} from '../scene-memory';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

function lionMemory() {
  const raw = loadStoryLocationPlanOverride(LION_STORY)!;
  const locationBundle = enrichStoryLocationPlanWithReferenceSheets(raw, LION_STORY);
  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: LION_STORY, pages: beats });
  return {
    locationBundle,
    bookShotPlan,
    memory: resolveSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan })!.memory,
  };
}

describe('SceneMemory J2 — proactive generation constraints', () => {
  it('emits anti-canopy constraint when fort expected collapsed', () => {
    const { memory, bookShotPlan } = lionMemory();
    const block = buildSceneMemoryGenerationConstraints(memory, 1);
    expect(block).toMatch(/GENERATION CONSTRAINTS/i);
    expect(block).toMatch(/FORBIDDEN: standing tent/i);
    expect(block).toMatch(/collapsed|COLLAPSED/i);
    expect(buildSceneMemoryLockBlock(memory, {
      pageNumber: 1,
      pageShot: bookShotPlan.pages.find((p) => p.page === 1)!,
    })).toContain('FORBIDDEN: standing tent');
  });

  it('includes fixed-position hard constraints on wide pages', () => {
    const { memory, bookShotPlan } = lionMemory();
    const block = buildSceneMemoryLockBlock(memory, {
      pageNumber: 2,
      pageShot: bookShotPlan.pages.find((p) => p.page === 2)!,
    });
    expect(block).toMatch(/FIXED POSITIONS/i);
    expect(block).toContain('Bed:');
    expect(block).toContain('Window:');
    expect(block).toContain('Rug:');
  });

  it('intimate/close page still carries generation constraints (p6)', () => {
    const { memory, bookShotPlan, locationBundle } = lionMemory();
    const pageShot = bookShotPlan.pages.find((p) => p.page === 6)!;
    const block = buildSceneMemoryLockBlock(memory, { pageNumber: 6, pageShot });
    expect(block).toMatch(/GENERATION CONSTRAINTS/i);
    expect(block).toMatch(/FORBIDDEN: standing tent/i);

    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 6,
      pagePrompt: 'Intimate beat.',
      bookPageText: 'טקסט.',
      childFirstName: 'Test',
      childAge: 5,
      childGender: 'boy',
      companion: { id: 'lion_shaket', name: 'Companion' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
      pageLocationPlan: locationBundle.pagePlans.find((p) => p.page === 6)!,
      locationBible: locationBundle.bible,
      sceneMemory: memory,
      pageShot,
    });
    expect(promptContainsSceneMemoryGenerationConstraints(prompt)).toBe(true);
  });

  it('palette constraints are general fact-driven lines', () => {
    const { memory } = lionMemory();
    const block = buildSceneMemoryGenerationConstraints(memory, 4)!;
    expect(block).toMatch(/PALETTE/i);
    expect(block).toMatch(/walls:/i);
    expect(block).toMatch(/Pillows:/i);
  });
});
