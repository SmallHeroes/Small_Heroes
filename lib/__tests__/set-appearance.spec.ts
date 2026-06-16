import { describe, expect, it } from 'vitest';
import path from 'path';

import { resolveBookShotPlan } from '../book-shot-plan';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../story-location-bible/zone-sheets';
import { resolveSceneMemoryPlan } from '../scene-memory';
import {
  buildAppearanceDriftReport,
  buildFixedBoardAppearanceMemory,
  buildSetAppearanceBoardPrompt,
  buildSetAppearanceLockBlock,
  filterSignaturesForFixedBoard,
  isFixedBoardFactId,
  pageAllowsSetAppearanceBoardRef,
  pageNeedsStateObjectRef,
  promptContainsSetAppearanceLock,
  seedSceneAppearanceMemory,
} from '../set-appearance';

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

describe('Set Appearance J2.5', () => {
  it('seeds appearance memory from scene memory without story literals', () => {
    const { appearance } = lionContext();
    expect(appearance).not.toBeNull();
    expect(appearance!.sceneId).toBeTruthy();
    expect(appearance!.signatures.length).toBeGreaterThan(3);
    expect(appearance!.lightingLockNote).toMatch(/night|warm|lamp/i);
    expect(JSON.stringify(appearance)).not.toMatch(/lion|shaket/i);
  });

  it('emits SET APPEARANCE LOCK after scene memory in prompt assembly', () => {
    const { locationBundle, bookShotPlan, memory, appearance } = lionContext();
    const pageShot = bookShotPlan.pages.find((p) => p.page === 2)!;
    const lock = buildSetAppearanceLockBlock(appearance, { pageShot, pageNumber: 2 });
    expect(lock).toMatch(/SET APPEARANCE LOCK/i);
    expect(lock).toMatch(/LIGHTING TARGET/i);
    expect(lock).toMatch(/VISUAL SET BOARD/i);

    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 2,
      pagePrompt: 'Wide bedroom beat.',
      bookPageText: 'טקסט.',
      childFirstName: 'Test',
      childAge: 5,
      childGender: 'boy',
      companion: { id: 'lion_shaket', name: 'Companion' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
      pageShot,
      pageLocationPlan: locationBundle.pagePlans.find((p) => p.page === 2)!,
      locationBible: locationBundle.bible,
      sceneMemory: memory,
      sceneAppearance: appearance,
    });
    expect(promptContainsSetAppearanceLock(prompt)).toBe(true);
    const sceneIdx = prompt.indexOf('SCENE MEMORY LOCK');
    const appearanceIdx = prompt.indexOf('SET APPEARANCE LOCK');
    expect(sceneIdx).toBeGreaterThan(-1);
    expect(appearanceIdx).toBeGreaterThan(sceneIdx);
  });

  it('board prompt is character-free fixed-objects sheet (quarantined)', () => {
    const { appearance } = lionContext();
    const boardPrompt = buildSetAppearanceBoardPrompt(appearance!);
    expect(boardPrompt).toMatch(/CHARACTER-FREE/i);
    expect(boardPrompt).toMatch(/FIXED OBJECTS ONLY/i);
    expect(boardPrompt).toMatch(/NO pillow-cave/i);
    expect(boardPrompt).toMatch(/NO blanket/i);
    expect(boardPrompt).toMatch(/NO arch/i);
    const fixed = filterSignaturesForFixedBoard(appearance!.signatures);
    expect(fixed.some((s) => /pillow-cave/i.test(s.factId))).toBe(false);
    expect(fixed.some((s) => /blanket/i.test(s.factId))).toBe(false);
    expect(fixed.some((s) => isFixedBoardFactId('Bed'))).toBe(true);
    expect(buildFixedBoardAppearanceMemory(appearance!).signatures.length).toBeGreaterThan(4);
  });

  it('state pages prefer isolated ref over board (p1 vs p2)', () => {
    const { locationBundle, memory } = lionContext();
    const p1Plan = locationBundle.pagePlans.find((p) => p.page === 1)!;
    const p2Plan = locationBundle.pagePlans.find((p) => p.page === 2)!;
    expect(
      pageNeedsStateObjectRef({
        pageNumber: 1,
        pageLocationPlan: p1Plan,
        sceneMemory: memory,
        isolatedObjectPaths: p1Plan.referenceSheets?.isolatedObjectPaths,
      })
    ).toBe(true);
    expect(
      pageNeedsStateObjectRef({
        pageNumber: 2,
        pageLocationPlan: p2Plan,
        sceneMemory: memory,
        isolatedObjectPaths: p2Plan.referenceSheets?.isolatedObjectPaths,
      })
    ).toBe(false);
  });

  it('skips board ref on close_up pages', () => {
    expect(
      pageAllowsSetAppearanceBoardRef({ page: 6, shot: 'close_up', angle: 'eye', rationale: 'tight' })
    ).toBe(false);
    expect(
      pageAllowsSetAppearanceBoardRef({ page: 6, shot: 'intimate', angle: 'eye', rationale: 'medium' })
    ).toBe(true);
  });

  it('classifies appearance drift severity tiers', () => {
    const report = buildAppearanceDriftReport({
      sceneMemoryDrift: {
        page: 4,
        sceneId: 'bedroom',
        expected: {},
        observed: {
          sceneId: 'bedroom',
          facts: [],
          unauthorizedProps: [],
          unknowns: [],
          visionSkipped: false,
        },
        perFact: [
          {
            factId: 'Pillow-cave',
            status: 'drift',
            note: 'standing canopy tent rebuilt',
            expected: 'collapsed',
            observed: 'standing canopy',
          },
          {
            factId: 'Bed',
            status: 'drift',
            note: 'different headboard design',
            expected: 'wood',
            observed: 'metal frame',
          },
          {
            factId: 'Shelf',
            status: 'consistent',
            note: 'ok',
            expected: 'visible',
            observed: 'visible',
          },
        ],
        driftFlags: [],
        sceneMemoryLockPresent: true,
      },
      pageLuminanceDelta: 0.2,
    });
    expect(report.hardCount).toBe(1);
    expect(report.reviewCount).toBeGreaterThanOrEqual(1);
    expect(report.findings.some((f) => f.factId === 'Pillow-cave' && f.severity === 'hard')).toBe(
      true
    );
  });
});
