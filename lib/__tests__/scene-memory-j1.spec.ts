import path from 'path';
import { describe, expect, it } from 'vitest';

import { buildBookImageLockContext, resolvePageImageLockSlice } from '../book-image-lock-context';
import {
  buildQaImageGenerationLockFields,
  resolveQaBookLockContext,
} from '../qa-console-book-lock-context';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import {
  analyzeSceneMemoryImage,
  buildSceneMemoryDriftReport,
  buildSceneMemoryLockBlock,
  promptContainsSceneMemoryLock,
  resolveSceneMemoryPlan,
  seedSceneMemoryPlan,
} from '../scene-memory';
import { selectPageSetElementRefs } from '../story-location-bible/set-topology';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../story-location-bible/zone-sheets';
import { resolveBookShotPlan } from '../book-shot-plan';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

describe('SceneMemory J1 — foundation + drift report (no autonomy)', () => {
  it('seeds SceneMemory from authored SetTopology without story-specific code branches', () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const beats = locationBundle.pagePlans.map((p) => ({
      page: p.page,
      imageDirection: '',
      bookPageText: '',
    }));
    const bookShotPlan = resolveBookShotPlan({ storyFilePath: LION_STORY, pages: beats });
    const plan = seedSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan });

    expect(plan?.memory.sceneId).toMatch(/fixed_interior_night_bedroom_night/);
    expect(plan?.memory.seedSource).toBe('authored_seed');
    expect(plan?.memory.stableFacts.Bed?.position).toContain('back-right');
    expect(plan?.memory.inventory).toContain('Bed');
    expect(plan?.memory.stableFacts.Bed?.lockLevel).not.toBe('human_locked');
  });

  it('QA and production lock context both attach sceneMemoryPlan on one path', () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const lockContext = resolveQaBookLockContext({
      storyPath: LION_STORY,
      storyFileKey: 'lion_shaket_bedtime',
      direction: 'bedtime',
      challengeCategory: 'ANGER_FRUSTRATION',
      pages: [{ pageNumber: 1, text: 'x', imagePrompt: 'y' }],
      storyTimeOfDay: 'night',
    });
    const qaFields = buildQaImageGenerationLockFields(lockContext);
    expect(qaFields.sceneMemoryPlan?.memory.sceneId).toBeTruthy();

    const bookCtx = buildBookImageLockContext({
      bookShotPlan: lockContext.bookShotPlan,
      storyLocationPlan: locationBundle,
      sceneMemoryPlan: resolveSceneMemoryPlan({
        storyLocationPlan: locationBundle,
        bookShotPlan: lockContext.bookShotPlan,
      }),
    });
    const slice = resolvePageImageLockSlice(bookCtx, 1);
    expect(slice.sceneMemory?.stableFacts.Bed).toBeTruthy();
  });

  it('emits SCENE MEMORY LOCK with stable facts on wide pages', () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const memory = resolveSceneMemoryPlan({
      storyLocationPlan: locationBundle,
      bookShotPlan: null,
    })!.memory;

    const block = buildSceneMemoryLockBlock(memory, {
      pageShot: { page: 1, shot: 'establishing_wide', angle: 'eye', rationale: 'test' },
      pageNumber: 1,
    });
    expect(block).toMatch(/SCENE MEMORY LOCK/i);
    expect(block).toContain('back-right');
    expect(block).toContain('INVENTORY');

    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      pagePrompt: 'Night bedroom.',
      bookPageText: 'לילה.',
      childFirstName: 'בר',
      childAge: 5,
      childGender: 'boy',
      companion: { id: 'lion_shaket', name: 'ליאו' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
      pageLocationPlan: locationBundle.pagePlans.find((p) => p.page === 1)!,
      locationBible: locationBundle.bible,
      sceneMemory: memory,
      pageShot: { page: 1, shot: 'establishing_wide', angle: 'eye', rationale: 'test' },
    });
    expect(promptContainsSceneMemoryLock(prompt)).toBe(true);
    expect(prompt).toContain('SET TOPOLOGY LOCK');
  });

  it('close_up gets light scene memory lock, not full geography dump', () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const memory = resolveSceneMemoryPlan({
      storyLocationPlan: locationBundle,
      bookShotPlan: null,
    })!.memory;
    const block = buildSceneMemoryLockBlock(memory, {
      pageShot: { page: 7, shot: 'close_up', angle: 'eye', rationale: 'test' },
      pageNumber: 7,
    });
    expect(block).toMatch(/close-up/i);
    expect(block).not.toContain('STABLE FACTS:');
  });

  it('analyzeSceneMemoryImage returns uncertain when vision is skipped', async () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const memory = resolveSceneMemoryPlan({
      storyLocationPlan: locationBundle,
      bookShotPlan: null,
    })!.memory;

    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const observed = await analyzeSceneMemoryImage('/fake/page.png', memory);
    if (prev) process.env.OPENAI_API_KEY = prev;

    expect(observed.visionSkipped).toBe(true);
    expect(observed.facts.every((f) => f.visibility === 'uncertain' || f.confidence <= 0.5)).toBe(
      true
    );
  });

  it('buildSceneMemoryDriftReport classifies all five statuses', () => {
    const locationBundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const memory = resolveSceneMemoryPlan({
      storyLocationPlan: locationBundle,
      bookShotPlan: null,
    })!.memory;

    const report = buildSceneMemoryDriftReport({
      page: 2,
      memory,
      sceneMemoryLockPresent: true,
      pageAction: 'Leo arrives',
      observed: {
        sceneId: memory.sceneId,
        facts: [
          {
            factId: 'Bed',
            position: 'back-right wall',
            confidence: 0.9,
            visibility: 'visible',
          },
          {
            factId: 'Window',
            position: 'back-left wall',
            confidence: 0.85,
            visibility: 'visible',
          },
          {
            factId: 'Rug',
            visibility: 'not_visible',
            confidence: 0,
          },
        ],
        unauthorizedProps: ['plush bunny on shelf'],
        unknowns: ['Rug'],
        visionSkipped: false,
      },
    });

    const statuses = new Set(report.perFact.map((r) => r.status));
    expect(statuses.has('consistent')).toBe(true);
    expect(statuses.has('unknown')).toBe(true);
    expect(statuses.has('drift')).toBe(true);
    expect(report.driftFlags.some((f) => /plush|unauthorized/i.test(f))).toBe(true);
  });

  it('set ref selector never exceeds one isolated slot (J1 budget)', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const enriched = enrichStoryLocationPlanWithReferenceSheets(bundle, LION_STORY);
    const p6 = enriched.pagePlans.find((p) => p.page === 6)!;
    const selection = selectPageSetElementRefs({
      pagePlan: p6,
      pageShot: { page: 6, shot: 'medium_wide', angle: 'eye', rationale: 'test' },
      candidatePaths: p6.referenceSheets?.isolatedObjectPaths ?? [],
      setElementFiles: bundle.bible.setElementFiles,
      maxSlots: 1,
    });
    expect(selection.selected.length).toBeLessThanOrEqual(1);
  });

  it('no auto-reroll path exists in scene-memory module', () => {
    const source = [
      analyzeSceneMemoryImage.toString(),
      buildSceneMemoryDriftReport.toString(),
    ].join('\n');
    expect(source).not.toMatch(/reroll|regen|auto.?correct/i);
  });
});
