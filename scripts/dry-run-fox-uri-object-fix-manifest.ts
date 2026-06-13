/**
 * Dry-run location + isolated object ref manifest — fox_uri_adventure.
 * Proves: no set.png on pages, spoiler-aware refs, pageAction in prompts.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import fs from 'fs';
import path from 'path';

import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { getCompanionById } from '../lib/companions';
import {
  beatsFromStoryPages,
  formatBookShotPlanTable,
  formatPageShotFramingSummary,
  isBookShotPlanValid,
  resolveBookShotPlan,
} from '../lib/book-shot-plan';
import { childPresenceAllowsReferencePhoto } from '../lib/image-entity-presence';
import {
  formatLocationPlanTable,
  formatPageLocationManifestLine,
  isStoryLocationPlanValid,
  resolvePageLocationPlan,
  resolveStoryLocationPlan,
} from '../lib/story-location-bible';
import { WINDOW_LEDGE_DRIP_LOCK } from '../lib/story-location-bible/compose';
import {
  assembleStyle01BookReferencesWithZoneSheets,
  buildPageActionPromptBlock,
  buildVisualSpoilerPromptBlock,
} from '../lib/story-location-bible/zone-sheets';
import {
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '../lib/style01-gptimage';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';

const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');
const OUT_DIR = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-object-fix-dry-run');
const SIMULATED_CHILD_ANCHOR = '(child canonical anchor at render)';
const REROLL_PAGES = [1, 2, 3, 4, 6, 8, 10, 11];
const LEDGE_REROLL_PAGES = [6, 8, 10, 11];

function basenameRef(p: string): string {
  return path.basename(p.replace(/\\/g, '/'));
}

function refHasSet(finalRefs: string[]): boolean {
  return finalRefs.some((r) => /set\.png/i.test(r));
}

function refHasBucketObject(finalRefs: string[]): boolean {
  return finalRefs.some((r) => /bucket-object\.png/i.test(r));
}

async function main(): Promise<void> {
  if (!fs.existsSync(BANK_FILE)) throw new Error(`Missing ${BANK_FILE}`);

  const companion = getCompanionById('fox_uri');
  if (!companion) throw new Error('fox_uri companion missing');

  const story = await loadStoryFromBank(BANK_FILE, 'נועה', 'אורי', 'girl', {
    skipLlmPersonalization: true,
    maxPages: 20,
  });
  const beats = beatsFromStoryPages(story.pages);
  const shotPlan = resolveBookShotPlan({ storyFilePath: BANK_FILE, pages: beats });
  const locationPlan = resolveStoryLocationPlan({
    storyFilePath: BANK_FILE,
    challengeCategory: 'NIGHT_FEAR',
    direction: 'adventure',
    pages: beats,
  });
  const refConfig = resolveStyle01RefBudgetConfig();

  const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
  const check = (id: string, pass: boolean, detail: string) => checks.push({ id, pass, detail });

  const zoneSheetDir = path.join(
    process.cwd(),
    'story-bank',
    'v3-approved',
    'fox_uri_adventure.zone-sheets',
    'balcony_drip_area'
  );

  check('SP1', isBookShotPlanValid(shotPlan), `shot source=${shotPlan.source}`);
  check('LB1', isStoryLocationPlanValid(locationPlan), `location source=${locationPlan.bible.source}`);
  check('OBJ1', fs.existsSync(path.join(zoneSheetDir, 'bucket-object.png')), 'published bucket-object.png');

  type RefRow = {
    page: number | 'cover';
    zoneId: string;
    pageAction: string;
    spoilerPolicy: string;
    bucketVisibility: string;
    setAttached: boolean;
    bucketObjectAttached: boolean;
    finalOrderLabels: string[];
  };
  const refRows: RefRow[] = [];

  const targets: Array<{ page: number | 'cover'; pageNumber: number; assetType?: 'cover' }> = [
    { page: 'cover', pageNumber: 0, assetType: 'cover' },
    ...Array.from({ length: 12 }, (_, i) => ({ page: i + 1, pageNumber: i + 1 })),
  ];

  for (const t of targets) {
    const loc = resolvePageLocationPlan(locationPlan, t.pageNumber);
    if (!loc) continue;
    const shot = shotPlan.pages.find((p) => p.page === t.pageNumber) ?? null;
    const storyPage = story.pages.find((p) => p.pageNumber === t.pageNumber);

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: t.pageNumber,
      totalPages: story.pages.length,
      pagePrompt: t.pageNumber === 0 ? story.coverSceneHint ?? '' : storyPage?.imagePrompt ?? '',
      rawScenePrompt: t.pageNumber === 0 ? story.coverSceneHint : storyPage?.rawScenePrompt,
      bookPageText: t.pageNumber === 0 ? story.title : storyPage?.text,
      challengeCategory: 'NIGHT_FEAR',
      pageShot: shot,
      locationBible: locationPlan.bible,
      pageLocationPlan: loc,
      companion: { id: companion.id, name: companion.name, image: companion.image },
      assetType: t.assetType,
    });

    const companionRefPaths =
      assembled.entityPresence.companionPresence === 'absent'
        ? []
        : resolveStyle01CompanionReferencePaths({
            companionId: companion.id,
            companionImage: companion.image,
            companionPresence: assembled.entityPresence.companionPresence,
            pageNumber: t.pageNumber,
            imagePrompt: storyPage?.imagePrompt,
            bookPageText: storyPage?.text,
            rawScenePrompt: storyPage?.rawScenePrompt,
          });
    const useMultiCompanionSheets = companionRefPaths.length >= 3;
    const styleRefCount = useMultiCompanionSheets ? 1 : refConfig === 'A' ? 2 : 3;
    const styleRefPaths = resolveStyle01StyleReferencePaths(assembled.sceneClass, styleRefCount);

    const { paths: finalRefs, breakdown } = assembleStyle01BookReferencesWithZoneSheets({
      styleRefPaths,
      childPhotoPath: refConfig === 'C' ? undefined : SIMULATED_CHILD_ANCHOR,
      companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
      config: refConfig,
      includeChildPhoto: childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence),
      useMultiCompanionSheets,
      isolatedObjectRefPaths: loc.referenceSheets?.isolatedObjectPaths,
    });

    const setAttached = refHasSet(finalRefs);
    const bucketObjectAttached = refHasBucketObject(finalRefs);

    const finalOrderLabels: string[] = [];
    for (const p of breakdown.child) finalOrderLabels.push(`1.child:${basenameRef(p)}`);
    for (const p of breakdown.companion) finalOrderLabels.push(`2.companion:${basenameRef(p)}`);
    for (const p of breakdown.objectAnchors ?? [])
      finalOrderLabels.push(`3.bucket-object:${basenameRef(p)}`);
    for (const p of breakdown.style) finalOrderLabels.push(`4.style:${basenameRef(p)}`);

    refRows.push({
      page: t.page,
      zoneId: loc.zoneId,
      pageAction: loc.pageAction ?? '(none)',
      spoilerPolicy: buildVisualSpoilerPromptBlock(loc) ?? '(none)',
      bucketVisibility: loc.expectedBucketVisibility ?? '(unset)',
      setAttached,
      bucketObjectAttached,
      finalOrderLabels,
    });

    check(`NO-set-p${t.page}`, !setAttached, `p${t.page} must NOT attach set.png`);

    if (typeof t.page === 'number' && t.page >= 1 && t.page <= 4) {
      check(`NO-bucket-ref-p${t.page}`, !bucketObjectAttached, `p${t.page} no bucket-object ref`);
      check(`SPOILER-p${t.page}`, loc.expectedBucketVisibility === 'hidden', `p${t.page} bucket hidden`);
      check(
        `PA-p${t.page}`,
        /PAGE ACTION — MANDATORY/.test(assembled.prompt),
        `p${t.page} pageAction in prompt`
      );
    }

    if (t.page === 'cover') {
      check('NO-bucket-ref-cover', !bucketObjectAttached, 'cover no bucket-object ref');
      check('SPOILER-cover', loc.expectedBucketVisibility === 'hidden', 'cover bucket hidden');
      check(
        'COVER-MYSTERY',
        /NO bucket/i.test(assembled.prompt),
        'cover mystery lock in prompt'
      );
    }

    if (typeof t.page === 'number' && t.page >= 5 && t.page <= 12) {
      check(`HAS-bucket-ref-p${t.page}`, bucketObjectAttached, `p${t.page} bucket-object ref attached`);
      check(
        `LEDGE-p${t.page}`,
        assembled.prompt.includes(WINDOW_LEDGE_DRIP_LOCK),
        `p${t.page} window-ledge drip lock in prompt`
      );
    }

    if (typeof t.page === 'number' && REROLL_PAGES.includes(t.page)) {
      check(
        `PA-reroll-p${t.page}`,
        Boolean(loc.pageAction?.trim()) && /PAGE ACTION — MANDATORY/.test(assembled.prompt),
        `reroll p${t.page} pageAction present`
      );
    }
  }

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);
  push('# Fox Uri — Object-fix dry-run manifest (no scene-lock)');
  push();
  push(`Generated: ${new Date().toISOString()}`);
  push();
  push('## Checks');
  for (const c of checks) push(`- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail}`);
  push();
  push('## Per-page proof (cover + p1–p12)');
  push();
  for (const row of refRows) {
    push(`### ${row.page === 'cover' ? 'cover' : `p${row.page}`}`);
    push(`- zoneId: \`${row.zoneId}\``);
    push(`- expectedBucketVisibility: **${row.bucketVisibility}**`);
    push(`- set.png attached: **${row.setAttached ? 'YES ✗' : 'NO ✓'}**`);
    push(`- bucket-object.png attached: **${row.bucketObjectAttached ? 'YES' : 'NO'}**`);
    push(`- pageAction: ${row.pageAction}`);
    push(`- spoiler: ${row.spoilerPolicy.split('\n')[0]}`);
    push(`- FINAL ORDER:`);
    for (const label of row.finalOrderLabels) push(`  - ${label}`);
    push();
  }
  push('## Location plans');
  push('```');
  push(formatLocationPlanTable(locationPlan));
  push('```');

  const failed = checks.filter((c) => !c.pass);
  push(
    failed.length === 0
      ? '**ALL CHECKS PASS — cleared for selective reroll (p1-4,6,8,10,11).**'
      : `**${failed.length} FAILED — do NOT reroll.**`
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'OBJECT_FIX_MANIFEST.md');
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`[dry-run] → ${outFile}`);
  console.log(`[dry-run] ${checks.filter((c) => c.pass).length}/${checks.length} pass`);
  if (failed.length) {
    console.error('[dry-run] FAILED:', failed.map((f) => f.id).join(', '));
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
