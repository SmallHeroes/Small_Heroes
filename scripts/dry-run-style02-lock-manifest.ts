/**
 * Dry-run Style 02 lock manifest — proves BookImageLockContext flows to reference assembly.
 * NO image generation.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/dry-run-style02-lock-manifest.ts
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { getCompanionById } from '../lib/companions';
import { beatsFromStoryPages, formatBookShotPlanTable, resolveBookShotPlan } from '../lib/book-shot-plan';
import {
  assembleStyle02BookReferencesWithLocks,
  buildBookImageLockContext,
  formatStyle02LockManifestLine,
  resolvePageImageLockSlice,
  validateStyle02ReferenceOrder,
} from '../lib/book-image-lock-context';
import {
  enrichStoryLocationPlanWithReferenceSheets,
  formatLocationPlanTable,
  formatPageLocationManifestLine,
  resolveStoryLocationPlan,
} from '../lib/story-location-bible';
import {
  classifyStyle02SceneClass,
  resolveStyle02RefBudgetConfig,
  resolveStyle02StyleReferencePaths,
  resolveStyle02SubsetKey,
  resolveCompanionReferencePath,
} from '../lib/style02-gptimage';

const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');
const OUT_DIR = path.join(process.cwd(), 'outputs', 'style02-lock-dry-run');
const SIMULATED_CHILD_ANCHOR = '(child canonical anchor — Style02 Stage0 in Step 2)';

function basenameRef(p: string): string {
  return path.basename(p.replace(/\\/g, '/'));
}

function refLabel(p: string, kind: string): string {
  const base = basenameRef(p);
  if (kind === 'child') return `1.child:${base}`;
  if (kind === 'companion') return `2.companion:${base}`;
  if (kind === 'isolatedObjects') return `3.object:${base}`;
  if (kind === 'otherCharacters') return `4.other:${base}`;
  return `5.style:${base}`;
}

async function main(): Promise<void> {
  if (!fs.existsSync(BANK_FILE)) {
    throw new Error(`Missing ${BANK_FILE} — import v3-approved story first`);
  }

  const companion = getCompanionById('fox_uri');
  if (!companion) throw new Error('fox_uri companion missing');

  const story = await loadStoryFromBank(BANK_FILE, 'נועה', 'אורי', 'girl', {
    skipLlmPersonalization: true,
    maxPages: 20,
  });
  const beats = beatsFromStoryPages(story.pages);
  const shotPlan = resolveBookShotPlan({ storyFilePath: BANK_FILE, pages: beats });
  const locationPlan = enrichStoryLocationPlanWithReferenceSheets(
    resolveStoryLocationPlan({
      storyFilePath: BANK_FILE,
      challengeCategory: 'NIGHT_FEAR',
      direction: 'adventure',
      pages: beats,
    }),
    BANK_FILE
  );

  const ctx = buildBookImageLockContext({
    bookShotPlan: shotPlan,
    storyLocationPlan: locationPlan,
    storyTimeOfDay: story.storyTimeOfDay ?? 'night',
    pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
    totalPages: 20,
  });

  const refConfig = resolveStyle02RefBudgetConfig();
  const companionRef = resolveCompanionReferencePath(companion.image);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);
  let failCount = 0;

  push('# Style 02 — BookImageLockContext dry-run manifest');
  push('');
  push(`Story: fox_uri_adventure@v3-approved`);
  push(`Ref config: ${refConfig}`);
  push(`Companion ref: ${companionRef ?? '(missing)'}`);
  push(`Child anchor: ${SIMULATED_CHILD_ANCHOR}`);
  push('');
  push('## BookShotPlan');
  push(formatBookShotPlanTable(shotPlan));
  push('');
  push('## Location plan');
  push(formatLocationPlanTable(locationPlan));
  push('');
  push('## Per-page Style 02 lock + reference order');
  push('');

  for (let pageNum = 1; pageNum <= 20; pageNum++) {
    const page = story.pages[pageNum - 1];
    const slice = resolvePageImageLockSlice(ctx, pageNum, {
      imageDirection: page?.imagePrompt,
      bookPageText: page?.text,
    });

    const sceneClass = classifyStyle02SceneClass({
      imagePrompt: page?.imagePrompt,
      bookPageText: page?.text,
      environment: page?.imagePrompt,
    });
    const subsetKey = resolveStyle02SubsetKey(sceneClass);
    const styleRefCount = refConfig === 'A' ? 2 : 3;
    const styleRefs = resolveStyle02StyleReferencePaths(subsetKey, styleRefCount);

    const { paths, breakdown } = assembleStyle02BookReferencesWithLocks({
      styleRefPaths: styleRefs,
      childAnchorPath: SIMULATED_CHILD_ANCHOR,
      companionRefPath: companionRef,
      isolatedObjectRefPaths: slice.isolatedObjectRefPaths,
      config: refConfig,
    });

    const validation = validateStyle02ReferenceOrder(breakdown);
    if (!validation.ok) failCount += 1;

    push(`### Page ${pageNum}`);
    push(formatStyle02LockManifestLine({ pageNumber: pageNum, slice, breakdown, paths }));
    if (slice.pageLocationPlan) {
      push(
        formatPageLocationManifestLine({
          page: pageNum,
          shot: slice.pageShot?.shot,
          angle: slice.pageShot?.angle,
          pagePlan: slice.pageLocationPlan,
          source: slice.locationBible?.source ?? 'derived',
        })
      );
    } else {
      push('location: (no page plan)');
    }
    push(`sceneClass=${sceneClass} subset=${subsetKey} orderOk=${validation.ok}`);
    if (!validation.ok) {
      push(`ORDER VIOLATIONS: ${validation.violations.join('; ')}`);
    }
    push('Reference order:');
    for (const kind of ['child', 'companion', 'isolatedObjects', 'otherCharacters', 'style'] as const) {
      for (const p of breakdown[kind] ?? []) {
        push(`  ${refLabel(p, kind)}`);
      }
    }
    push('');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'style02-lock-manifest.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Pages checked: 20 | order violations: ${failCount}`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
