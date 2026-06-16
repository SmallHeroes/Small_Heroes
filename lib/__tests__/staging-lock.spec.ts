import { describe, expect, it } from 'vitest';
import path from 'path';

import { resolveBookShotPlan } from '../book-shot-plan';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../story-location-bible/zone-sheets';
import {
  buildStagingLockBlock,
  inferStagingSurface,
  promptContainsStagingLock,
} from '../story-location-bible/staging-lock';
import { resolveSceneMemoryPlan } from '../scene-memory';
import { seedSceneAppearanceMemory } from '../set-appearance';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

function lionContext() {
  const raw = loadStoryLocationPlanOverride(LION_STORY)!;
  const locationBundle = enrichStoryLocationPlanWithReferenceSheets(raw, LION_STORY);
  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: LION_STORY, pages: beats });
  const memory = resolveSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan })!.memory;
  const appearance = seedSceneAppearanceMemory({
    sceneMemory: memory,
    locationBible: locationBundle.bible,
  });
  return { locationBundle, bookShotPlan, memory, appearance };
}

describe('STAGING LOCK', () => {
  it('infers floor for lion p6/p8 scattered cave beats', () => {
    const { locationBundle } = lionContext();
    const p6 = locationBundle.pagePlans.find((p) => p.page === 6)!;
    const p8 = locationBundle.pagePlans.find((p) => p.page === 8)!;
    expect(inferStagingSurface(p6)).toBe('floor');
    expect(inferStagingSurface(p8)).toBe('floor');
    expect(buildStagingLockBlock(p6)).toMatch(/on the FLOOR near the scattered pillow cave/i);
    expect(buildStagingLockBlock(p6)).toMatch(/do NOT place them on the bed/i);
  });

  it('respects explicit staging override', () => {
    const { locationBundle } = lionContext();
    const p2 = locationBundle.pagePlans.find((p) => p.page === 2)!;
    const overridden = {
      ...p2,
      staging: { surface: 'bed' as const, anchorHint: 'the bed' },
    };
    expect(inferStagingSurface(overridden)).toBe('bed');
    expect(buildStagingLockBlock(overridden)).toMatch(/on the BED/i);
  });

  it('emits STAGING LOCK in lion p6 prompt assembly', () => {
    const { locationBundle, bookShotPlan, memory, appearance } = lionContext();
    const pageShot = bookShotPlan.pages.find((p) => p.page === 6)!;
    const pagePlan = locationBundle.pagePlans.find((p) => p.page === 6)!;
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 6,
      pagePrompt: 'Thunder corner beat.',
      bookPageText: 'טקסט.',
      childFirstName: 'Test',
      childAge: 5,
      childGender: 'boy',
      companion: { id: 'lion_shaket', name: 'Companion' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
      pageShot,
      pageLocationPlan: pagePlan,
      locationBible: locationBundle.bible,
      sceneMemory: memory,
      sceneAppearance: appearance,
    });
    expect(promptContainsStagingLock(prompt)).toBe(true);
    expect(prompt).toMatch(/STAGING LOCK:.*FLOOR.*scattered pillow cave/i);
  });
});
