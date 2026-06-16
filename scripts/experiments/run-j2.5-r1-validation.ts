/**
 * J2.5-R1: regenerate quarantined board + LOW validation p1/p2/p4/p6/p8.
 *
 * Step 1 (board only):
 *   SET_APPEARANCE_BOARD_FORCE_REGENERATE=true npx tsx ... scripts/experiments/run-j2.5-r1-validation.ts --board-only
 *
 * Step 2 (after Guy eyeballs board PNG + QA pass):
 *   SET_APPEARANCE_BOARD_HUMAN_APPROVED=true npx tsx ... scripts/experiments/run-j2.5-r1-validation.ts
 */
import { readFileSync } from 'fs';
import path from 'path';

import '../shims/register-server-only.cjs';

import {
  approveSetAppearanceBoardManifest,
  ensureSetAppearanceBoard,
  isSetAppearanceBoardUsable,
  loadSetAppearanceBoardManifest,
  seedSceneAppearanceMemory,
} from '../../lib/set-appearance';
import { resolveBookShotPlan } from '../../lib/book-shot-plan';
import { resolveSceneMemoryPlan } from '../../lib/scene-memory';
import { loadStoryLocationPlanOverride } from '../../lib/story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../../lib/story-location-bible/zone-sheets';
import { resolveStyle01StyleReferencePaths } from '../../lib/style01-gptimage';
import { runQaConsoleRender } from '../../lib/qa-console-run';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');
const STORY = path.join(process.cwd(), 'story-bank/v5-fixed-v2/lion_shaket_bedtime.md');
const PAGES = [1, 2, 4, 6, 8];

async function ensureBoard(): Promise<void> {
  const raw = loadStoryLocationPlanOverride(STORY)!;
  const locationBundle = enrichStoryLocationPlanWithReferenceSheets(raw, STORY);
  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: STORY, pages: beats });
  const memory = resolveSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan })!.memory;
  const appearance = seedSceneAppearanceMemory({
    sceneMemory: memory,
    locationBible: locationBundle.bible,
  });
  if (!appearance) throw new Error('no appearance memory');

  process.env.SET_APPEARANCE_BOARD_FORCE_REGENERATE = 'true';
  const styleRefs = resolveStyle01StyleReferencePaths('fantasy-cave-night', 1);
  const manifest = await ensureSetAppearanceBoard({
    appearance,
    styleRefPaths: styleRefs,
    existing: null,
    quality: 'low',
    forceRegenerate: true,
  });
  console.log(`Board â†’ ${manifest.boardPath}`);
  console.log(`  qaPassed=${manifest.qaPassed} flags=${JSON.stringify(manifest.qaFlags ?? [])}`);
  console.log(`  approved=${manifest.approved} (human required)`);
}

async function runPages(): Promise<void> {
  const buf = readFileSync(BAR_PHOTO);
  const result = await runQaConsoleRender({
    storyKey: 'lion_shaket_bedtime',
    pages: PAGES,
    child: {
      name: '×‘×¨',
      gender: 'boy',
      age: 5,
      photoDataUrl: `data:image/png;base64,${buf.toString('base64')}`,
    },
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'qa-console-lion_shaket-bedtime-low-j2.5-r1',
    approveAnchorCacheKey: 'lion_shaket_bedtime__1da5fff624f87944__9383550a',
  });
  console.log(`J2.5-R1 â†’ ${result.manifestDir}`);
  console.log(`  rendered=${result.renderedPageNumbers.join(',')}`);
  console.log(`  failed=${result.failedPages.join(',') || 'none'}`);
}

async function main(): Promise<void> {
  const boardOnly = process.argv.includes('--board-only');
  if (boardOnly) {
    await ensureBoard();
    return;
  }

  const sceneId = 'fixed_interior_night_bedroom_night';
  let manifest = loadSetAppearanceBoardManifest(sceneId);
  if (!manifest?.qaPassed) {
    console.log('Regenerating board (missing or failed QA)...');
    await ensureBoard();
    manifest = loadSetAppearanceBoardManifest(sceneId);
  }
  if (!manifest?.qaPassed) {
    throw new Error(`Board QA failed: ${JSON.stringify(manifest?.qaFlags)}`);
  }
  if (!isSetAppearanceBoardUsable(manifest)) {
    if (process.env.SET_APPEARANCE_BOARD_HUMAN_APPROVED === 'true') {
      approveSetAppearanceBoardManifest(sceneId);
      manifest = loadSetAppearanceBoardManifest(sceneId);
    } else {
      throw new Error(
        'Board QA passed but not human-approved. Eyeball PNG then re-run with SET_APPEARANCE_BOARD_HUMAN_APPROVED=true'
      );
    }
  }
  await runPages();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
