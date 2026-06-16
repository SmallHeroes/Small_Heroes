/**
 * Regenerate + QA a set appearance board (no page render).
 * Usage:
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/regen-set-appearance-board.ts fixed_interior_bedroom_window_unspecified
 */
import path from 'path';

import '../shims/register-server-only.cjs';
import { resolveBookShotPlan } from '../../lib/book-shot-plan';
import { loadStoryLocationPlanOverride } from '../../lib/story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../../lib/story-location-bible/zone-sheets';
import { resolveSceneMemoryPlan } from '../../lib/scene-memory';
import { generateSetAppearanceBoard, seedSceneAppearanceMemory } from '../../lib/set-appearance';
import { resolveStyle01StyleReferencePaths } from '../../lib/style01-gptimage';

const sceneId = process.argv[2] ?? 'fixed_interior_bedroom_window_unspecified';
const storyPath = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

async function main(): Promise<void> {
  const raw = loadStoryLocationPlanOverride(storyPath)!;
  const bundle = enrichStoryLocationPlanWithReferenceSheets(raw, storyPath);
  const beats = bundle.pagePlans.map((p) => ({ page: p.page, imageDirection: '', bookPageText: '' }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: storyPath, pages: beats });
  const memory = resolveSceneMemoryPlan({ storyLocationPlan: bundle, bookShotPlan })?.memory ?? null;
  const appearance = seedSceneAppearanceMemory({ sceneMemory: memory, locationBible: bundle.bible });
  if (!appearance || appearance.sceneId !== sceneId) {
    throw new Error(`scene mismatch: expected ${sceneId}, got ${appearance?.sceneId}`);
  }
  const win = appearance.signatures.find((s) => /window/i.test(s.factId));
  console.log('window signature:', win);
  const manifest = await generateSetAppearanceBoard({
    appearance,
    styleRefPaths: resolveStyle01StyleReferencePaths('fantasy-cave-night', 1),
    quality: 'low',
  });
  console.log(JSON.stringify({ qaPassed: manifest.qaPassed, qaFlags: manifest.qaFlags, boardPath: manifest.boardPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
