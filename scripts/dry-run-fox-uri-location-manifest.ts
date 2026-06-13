/**

 * Dry-run location + zone/object ref manifest — fox_uri_adventure v3-approved.

 * Prints per-page shot, location zone, prompt blocks, and FINAL reference order WITHOUT rendering.

 *

 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \

 *     scripts/dry-run-fox-uri-location-manifest.ts

 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

loadEnv();



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

  buildZoneObjectReferencePromptBlock,

} from '../lib/story-location-bible';

import { assembleStyle01BookReferencesWithZoneSheets } from '../lib/story-location-bible/zone-sheets';

import {

  resolveStyle01CompanionReferencePaths,

  resolveStyle01RefBudgetConfig,

  resolveStyle01StyleReferencePaths,

} from '../lib/style01-gptimage';

import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';



const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

const OUT_DIR = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-location-dry-run');

const SIMULATED_CHILD_ANCHOR = '(child canonical anchor at render)';



function basenameRef(p: string): string {

  return path.basename(p.replace(/\\/g, '/'));

}



function refLabel(p: string, kind: string): string {

  const base = basenameRef(p);

  if (kind === 'child') return `1.child:${base}`;

  if (kind === 'companion') return `2.companion:${base}`;

  if (kind === 'zoneSet') return `3.zoneSet:${base}`;

  if (kind === 'objectAnchor') return `4.object:${base}`;

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

  const locationPlan = resolveStoryLocationPlan({

    storyFilePath: BANK_FILE,

    challengeCategory: 'NIGHT_FEAR',

    direction: 'adventure',

    pages: beats,

  });

  const refConfig = resolveStyle01RefBudgetConfig();



  const checks: Array<{ id: string; pass: boolean; detail: string }> = [];

  const check = (id: string, pass: boolean, detail: string) => checks.push({ id, pass, detail });



  check('SP1', isBookShotPlanValid(shotPlan), `shot source=${shotPlan.source}`);

  check('LB1', isStoryLocationPlanValid(locationPlan), `location source=${locationPlan.bible.source}`);

  check('LB2', locationPlan.pagePlans.length === 13, `pagePlans=${locationPlan.pagePlans.length} (incl cover p0)`);



  const zoneSheetDir = path.join(

    process.cwd(),

    'story-bank',

    'v3-approved',

    'fox_uri_adventure.zone-sheets',

    'balcony_drip_area'

  );

  check('ZS1', fs.existsSync(path.join(zoneSheetDir, 'set.png')), 'published set.png');

  check('ZS2', fs.existsSync(path.join(zoneSheetDir, 'bucket.png')), 'published bucket.png');

  check('ZS3', fs.existsSync(path.join(zoneSheetDir, 'manifest.json')), 'published manifest.json');



  for (const n of [5, 6, 7, 8, 9, 10, 11]) {

    const plan = resolvePageLocationPlan(locationPlan, n);

    check(

      `LB-bucket-p${n}`,

      plan?.zoneId === 'bucket_close_area' || (n === 5 && plan?.zoneId === 'balcony_drip_area'),

      `p${n} zone=${plan?.zoneId ?? 'MISSING'}`

    );

    check(

      `ZS-bucket-ref-p${n}`,

      Boolean(plan?.referenceSheets?.objectAnchorPaths?.length),

      `p${n} object anchor attached`

    );

  }



  const p4 = resolvePageLocationPlan(locationPlan, 4)!;

  check('ZS-zone-p4', Boolean(p4.referenceSheets?.zoneSetPath), 'p4 zone set attached');

  check('ZS-no-object-p4', (p4.referenceSheets?.objectAnchorPaths?.length ?? 0) === 0, 'p4 no object anchor');



  const sampleP10 = resolvePageLocationPlan(locationPlan, 10)!;

  const sampleShot = shotPlan.pages.find((p) => p.page === 10)!;

  const { prompt: p10Prompt } = assembleStyle01Phase2Prompt({

    pageNumber: 10,

    rawScenePrompt: story.pages.find((p) => p.pageNumber === 10)?.imagePrompt,

    bookPageText: story.pages.find((p) => p.pageNumber === 10)?.text,

    challengeCategory: 'NIGHT_FEAR',

    pageShot: sampleShot,

    locationBible: locationPlan.bible,

    pageLocationPlan: sampleP10,

    companion: { id: 'fox_uri', name: 'אורי' },

  });

  check('LB3', !/SCENARIO SETTING LOCK/.test(p10Prompt), 'single location truth on p10');

  check('LB4', /BOOK LOCATION CONTINUITY/.test(p10Prompt), 'location block on p10');

  check('LB5', /same metal bucket/i.test(p10Prompt), 'p10 mentions same metal bucket');

  check('ZS-prompt-p10', /Do NOT copy the reference composition/i.test(p10Prompt), 'zone/object guard on p10');



  type RefRow = {

    page: number | 'cover';

    zoneId: string;

    locationBlocks: string[];

    finalOrderLabels: string[];

    breakdown: Record<string, string[]>;

  };

  const refRows: RefRow[] = [];



  const targets: Array<{

    page: number | 'cover';

    pageNumber: number;

    assetType?: 'cover';

  }> = [{ page: 'cover', pageNumber: 0, assetType: 'cover' }, ...Array.from({ length: 12 }, (_, i) => ({ page: i + 1, pageNumber: i + 1 }))];



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

      storyTitle: t.pageNumber === 0 ? story.title : undefined,

      coverText: t.pageNumber === 0 ? story.coverText : undefined,

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

      otherCharacterRefPaths: [],

      config: refConfig,

      includeChildPhoto: childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence),

      useMultiCompanionSheets,

      zoneSetRefPath: loc.referenceSheets?.zoneSetPath,

      objectAnchorRefPaths: loc.referenceSheets?.objectAnchorPaths,

    });



    const locationBlocks: string[] = [];

    if (/BOOK LOCATION CONTINUITY/.test(assembled.prompt)) locationBlocks.push('BOOK LOCATION CONTINUITY');

    if (/PAGE LOCATION:/.test(assembled.prompt)) locationBlocks.push('PAGE LOCATION');

    if (buildZoneObjectReferencePromptBlock(loc)) locationBlocks.push('ZONE/OBJECT REF GUARD');



    const finalOrderLabels: string[] = [];

    for (const p of breakdown.child) finalOrderLabels.push(refLabel(p, 'child'));

    for (const p of breakdown.companion) finalOrderLabels.push(refLabel(p, 'companion'));

    for (const p of breakdown.zoneSet ?? []) finalOrderLabels.push(refLabel(p, 'zoneSet'));

    for (const p of breakdown.objectAnchors ?? []) finalOrderLabels.push(refLabel(p, 'objectAnchor'));

    for (const p of breakdown.style) finalOrderLabels.push(refLabel(p, 'style'));



    refRows.push({

      page: t.page,

      zoneId: loc.zoneId,

      locationBlocks,

      finalOrderLabels,

      breakdown,

    });



    if (typeof t.page === 'number' && t.page >= 4 && t.page <= 11) {

      check(

        `ZS-final-p${t.page}`,

        (breakdown.zoneSet ?? []).length >= 1,

        `p${t.page} final order includes zone set`

      );

    }

    if (typeof t.page === 'number' && t.page >= 5 && t.page <= 11) {

      check(

        `ZS-object-p${t.page}`,

        (breakdown.objectAnchors ?? []).length >= 1,

        `p${t.page} final order includes object anchor`

      );

    }



    if (breakdown.child.length > 0) {
      const childIdx = finalRefs.findIndex((r) => breakdown.child.includes(r));
      const companionIdx = breakdown.companion.length
        ? finalRefs.findIndex((r) => breakdown.companion.includes(r))
        : -1;
      const zoneIdx = (breakdown.zoneSet ?? []).length
        ? finalRefs.findIndex((r) => (breakdown.zoneSet ?? []).includes(r))
        : -1;
      check(
        `ZS-order-p${t.page}`,
        childIdx === 0 &&
          (companionIdx < 0 || companionIdx > childIdx) &&
          (zoneIdx < 0 || zoneIdx > Math.max(childIdx, companionIdx)),
        `p${t.page} priority child→companion→zone`
      );
    }
  }



  const lines: string[] = [];

  const push = (s = '') => lines.push(s);

  push('# Fox Uri Adventure — Location + Zone/Object ref dry-run manifest');

  push();

  push(`Generated: ${new Date().toISOString()}`);

  push(`Bank: \`${path.relative(process.cwd(), BANK_FILE)}\``);

  push(`Published sheets: \`${path.relative(process.cwd(), zoneSheetDir)}\``);

  push();

  push('## Checks');

  push();

  for (const c of checks) {

    push(`- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail}`);

  }

  push();

  push('## BookShotPlan');

  push();

  push('```');

  push(formatBookShotPlanTable(shotPlan));

  push('```');

  push();

  push('## LocationBible page plans');

  push();

  push('```');

  push(formatLocationPlanTable(locationPlan));

  push('```');

  push();

  push('## Per-page manifest (shot + location)');

  push();

  for (let n = 1; n <= 12; n++) {

    const shot = shotPlan.pages.find((p) => p.page === n);

    const loc = resolvePageLocationPlan(locationPlan, n)!;

    push(formatPageLocationManifestLine({

      page: n,

      shot: shot?.shot,

      angle: shot?.angle ?? 'eye',

      pagePlan: loc,

      source: locationPlan.bible.source,

    }));

  }

  push();

  push('## Final reference order per page (cover + p1–p12)');

  push();

  push('Priority: child → companion → zone set → object anchor → style (style dropped first if budget exceeded).');

  push();

  for (const row of refRows) {

    push(`### ${row.page === 'cover' ? 'cover (p0)' : `p${row.page}`}`);

    push(`- **zoneId:** \`${row.zoneId}\``);

    push(`- **location blocks:** ${row.locationBlocks.join(', ') || '(none)'}`);

    push(`- **zone set:** ${(row.breakdown.zoneSet ?? []).map((r) => basenameRef(r)).join(', ') || '—'}`);

    push(`- **object anchor:** ${(row.breakdown.objectAnchors ?? []).map((r) => basenameRef(r)).join(', ') || '—'}`);

    push(`- **FINAL ORDER:**`);

    for (const label of row.finalOrderLabels) {

      push(`  - ${label}`);

    }

    push();

  }

  push('## Framing summaries (B1)');

  push();

  for (const shot of shotPlan.pages) {

    push(`### p${shot.page}`);

    push('```');

    push(formatPageShotFramingSummary(shot));

    push('```');

    push();

  }



  const failed = checks.filter((c) => !c.pass);

  push(

    failed.length === 0

      ? '**ALL CHECKS PASS — cleared for full LOW rerender (cover + p1–p12).**'

      : `**${failed.length} CHECK(S) FAILED — do NOT full rerender.**`

  );



  fs.mkdirSync(OUT_DIR, { recursive: true });

  const outFile = path.join(OUT_DIR, 'LOCATION_MANIFEST.md');

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

  console.log(`[dry-run] manifest → ${outFile}`);

  console.log(`[dry-run] checks: ${checks.filter((c) => c.pass).length}/${checks.length} pass`);

  if (failed.length) {

    console.error('[dry-run] FAILED:', failed.map((f) => f.id).join(', '));

    process.exit(2);

  }

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


