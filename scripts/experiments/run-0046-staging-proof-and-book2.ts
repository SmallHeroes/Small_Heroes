/**
 * 0046: lion p6/p8 staging proof + fox_uri book #2 generalization sample.
 * Usage:
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/run-0046-staging-proof-and-book2.ts
 *   npx tsx ... scripts/experiments/run-0046-staging-proof-and-book2.ts --lion-only
 *   npx tsx ... scripts/experiments/run-0046-staging-proof-and-book2.ts --fox-only
 */
import { readFileSync } from 'fs';
import path from 'path';

import '../shims/register-server-only.cjs';
import { resolveBookShotPlan } from '../../lib/book-shot-plan';
import { inferStagingSurface } from '../../lib/story-location-bible/staging-lock';
import { loadStoryLocationPlanOverride } from '../../lib/story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../../lib/story-location-bible/zone-sheets';
import { resolveSceneMemoryPlan } from '../../lib/scene-memory';
import { seedSceneAppearanceMemory } from '../../lib/set-appearance';
import { runQaConsoleRender } from '../../lib/qa-console-run';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');

function stagingReport(storyPath: string, pages: number[]): { sceneId: string | null; rows: string[] } {
  const raw = loadStoryLocationPlanOverride(storyPath)!;
  const bundle = enrichStoryLocationPlanWithReferenceSheets(raw, storyPath);
  const beats = bundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: storyPath, pages: beats });
  const memory = resolveSceneMemoryPlan({ storyLocationPlan: bundle, bookShotPlan })?.memory ?? null;
  const appearance = seedSceneAppearanceMemory({
    sceneMemory: memory,
    locationBible: bundle.bible,
  });
  const rows = pages.map((n) => {
    const plan = bundle.pagePlans.find((p) => p.page === n)!;
    return `p${n} zone=${plan.zoneId} stagingSurface=${inferStagingSurface(plan)}`;
  });
  return { sceneId: appearance?.sceneId ?? null, rows };
}

async function main(): Promise<void> {
  const lionOnly = process.argv.includes('--lion-only');
  const foxOnly = process.argv.includes('--fox-only');
  const buf = readFileSync(BAR_PHOTO);
  const child = {
    name: '×‘×¨',
    gender: 'boy' as const,
    age: 5,
    photoDataUrl: `data:image/png;base64,${buf.toString('base64')}`,
  };

  if (!foxOnly) {
    const lionPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'lion_shaket_bedtime.md');
    const lionStaging = stagingReport(lionPath, [1, 2, 4, 6, 7, 8]);
    console.log('\n=== LION stagingSurface (inference) ===');
    console.log(`sceneId=${lionStaging.sceneId}`);
    for (const row of lionStaging.rows) console.log(row);

    const lion = await runQaConsoleRender({
      storyKey: 'lion_shaket_bedtime',
      pages: [6, 8],
      child,
      quality: 'low',
      generateAudio: false,
      runLabelPrefix: 'qa-console-lion_staging-proof',
      approveAnchorCacheKey: 'lion_shaket_bedtime__1da5fff624f87944__9383550a',
      approveSetAppearanceBoardSceneId: lionStaging.sceneId ?? 'fixed_interior_night_bedroom_night',
    });
    console.log('\n=== LION p6/p8 render ===');
    console.log(`dir=${lion.manifestDir}`);
    console.log(`rendered=${lion.renderedPageNumbers.join(',')}`);
    console.log(`failed=${lion.failedPages.join(',') || 'none'}`);
  }

  if (!lionOnly) {
    const foxPath = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');
    const foxStaging = stagingReport(foxPath, [1, 5, 6, 8]);
    console.log('\n=== FOX book#2 stagingSurface ===');
    console.log(`sceneId=${foxStaging.sceneId}`);
    for (const row of foxStaging.rows) console.log(row);

    const fox = await runQaConsoleRender({
      storyKey: 'fox_uri_adventure@v3-approved',
      pages: [1, 5, 6, 8],
      child: { name: '×ž×™×”', gender: 'girl', age: 8 },
      quality: 'low',
      generateAudio: false,
      runLabelPrefix: 'qa-console-fox_uri-book2',
      skipLlmPersonalization: true,
      skipPromptAudit: true,
      approveSetAppearanceBoardSceneId: foxStaging.sceneId ?? undefined,
    });
    console.log('\n=== FOX book#2 render ===');
    console.log(`dir=${fox.manifestDir}`);
    console.log(`rendered=${fox.renderedPageNumbers.join(',')}`);
    console.log(`failed=${fox.failedPages.join(',') || 'none'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
