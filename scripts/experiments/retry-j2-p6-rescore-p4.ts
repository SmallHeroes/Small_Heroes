/**
 * Packaging validation: retry p6 LOW + re-score p4 drift on clean HEAD.
 * Usage: npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/retry-j2-p6-rescore-p4.ts
 */
import { readFileSync } from 'fs';
import path from 'path';

import '../shims/register-server-only.cjs';

import { runQaConsoleRender } from '../../lib/qa-console-run';
import {
  analyzeSceneMemoryImage,
  buildSceneMemoryDriftReport,
  resolveSceneMemoryPlan,
  writeSceneMemoryDriftReportFile,
} from '../../lib/scene-memory';
import { resolveBookShotPlan } from '../../lib/book-shot-plan';
import { loadStoryLocationPlanOverride } from '../../lib/story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../../lib/story-location-bible/zone-sheets';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');
const J2_DIR = 'qa-console-lion_shaket-bedtime-low-j2-20260615-183145';
const STORY = path.join(process.cwd(), 'story-bank/v5-fixed-v2/lion_shaket_bedtime.md');

async function rescoreP4(): Promise<void> {
  const outDir = path.join(process.cwd(), 'outputs/style01-auditions', J2_DIR);
  let locationBundle = loadStoryLocationPlanOverride(STORY)!;
  locationBundle = enrichStoryLocationPlanWithReferenceSheets(locationBundle, STORY);
  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: STORY, pages: beats });
  const memory = resolveSceneMemoryPlan({ storyLocationPlan: locationBundle, bookShotPlan })!.memory;
  const pngPath = path.join(outDir, 'page-04.png');
  const observed = await analyzeSceneMemoryImage(pngPath, memory);
  const pageShot = bookShotPlan.pages.find((p) => p.page === 4) ?? null;
  const report = buildSceneMemoryDriftReport({
    page: 4,
    memory,
    observed,
    sceneMemoryLockPresent: true,
    pageShot,
  });
  const written = await writeSceneMemoryDriftReportFile(outDir, report);
  const cave = report.perFact.find((r) => r.factId === 'Pillow-cave');
  console.log(`p4 re-score â†’ ${written}`);
  console.log(`  Pillow-cave: ${cave?.status} (${cave?.observed ?? 'â€”'})`);
  console.log(`  driftFlags: ${report.driftFlags.length}`);
}

async function retryP6(): Promise<string> {
  const buf = readFileSync(BAR_PHOTO);
  const result = await runQaConsoleRender({
    storyKey: 'lion_shaket_bedtime',
    pages: [6],
    child: {
      name: '×‘×¨',
      gender: 'boy',
      age: 5,
      photoDataUrl: `data:image/png;base64,${buf.toString('base64')}`,
    },
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'qa-console-lion_shaket-bedtime-low-j2-p6-packaging',
    approveAnchorCacheKey: 'lion_shaket_bedtime__1da5fff624f87944__9383550a',
  });
  console.log(`p6 retry â†’ ${result.manifestDir} rendered=${result.renderedPageNumbers} failed=${result.failedPages}`);
  return result.manifestDir;
}

async function main(): Promise<void> {
  process.env.SET_APPEARANCE_BOARD_ENABLED = 'false';
  await rescoreP4();
  const p6Dir = await retryP6();
  console.log(`\nDone. p6 output: ${p6Dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
