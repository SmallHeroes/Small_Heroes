/**
 * One-off: re-run SceneMemory drift analysis on saved QA render images (no re-render).
 * Usage: npx tsx --require ./scripts/shims/register-server-only.cjs --env-file=.env.local scripts/rerun-scene-memory-drift.ts <manifestDir>
 */
import { readFileSync } from 'fs';
import path from 'path';

import { resolveBookShotPlan } from '../lib/book-shot-plan';
import {
  analyzeSceneMemoryImage,
  buildSceneMemoryDriftReport,
  resolveSceneMemoryPlan,
  writeSceneMemoryDriftReportFile,
} from '../lib/scene-memory';
import { loadStoryLocationPlanOverride } from '../lib/story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../lib/story-location-bible/zone-sheets';

const manifestDirName =
  process.argv[2] ?? 'qa-console-lion_shaket-bedtime-low-20260615-141017';
const outDir = path.join(process.cwd(), 'outputs/style01-auditions', manifestDirName);
const manifestPath = path.join(outDir, 'manifest.json');

async function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    storyFile: string;
    renderedPageNumbers: number[];
    pages: Array<{ pageNumber: number; imageDirection?: string }>;
  };

  const storyPath = path.join(process.cwd(), 'story-bank/v5-fixed-v2', manifest.storyFile);
  let locationBundle = loadStoryLocationPlanOverride(storyPath);
  if (!locationBundle) throw new Error(`No location plan for ${storyPath}`);
  locationBundle = enrichStoryLocationPlanWithReferenceSheets(locationBundle, storyPath);

  const beats = locationBundle.pagePlans.map((p) => ({
    page: p.page,
    imageDirection: '',
    bookPageText: '',
  }));
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: storyPath, pages: beats });
  const sceneMemoryPlan = resolveSceneMemoryPlan({
    storyLocationPlan: locationBundle,
    bookShotPlan,
  });
  if (!sceneMemoryPlan?.memory) throw new Error('No scene memory plan');

  const memory = sceneMemoryPlan.memory;
  const pageMeta = new Map(manifest.pages.map((p) => [p.pageNumber, p]));

  for (const pageNum of manifest.renderedPageNumbers) {
    const pngPath = path.join(outDir, `page-${String(pageNum).padStart(2, '0')}.png`);
    const meta = pageMeta.get(pageNum);
    console.log(`Analyzing page ${pageNum}…`);
    const observed = await analyzeSceneMemoryImage(pngPath, memory);
    const pageShot = bookShotPlan.pages.find((p) => p.page === pageNum) ?? null;
    const report = buildSceneMemoryDriftReport({
      page: pageNum,
      memory,
      observed,
      sceneMemoryLockPresent: true,
      pageAction: meta?.imageDirection,
      pageShot,
    });
    const written = await writeSceneMemoryDriftReportFile(outDir, report);
    const statuses = report.perFact.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(
      `  → ${written} | visionSkipped=${observed.visionSkipped ?? false} | ${JSON.stringify(statuses)}`
    );
    if (observed.visionError) console.log(`  visionError: ${observed.visionError}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
