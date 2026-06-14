/**
 * Slot #2 — lion_shaket bedtime ANGER dry-run manifest (Style 01, NO render).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/dry-run-lion-bedtime-manifest.ts
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

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
  isStoryLocationPlanValid,
  resolvePageLocationPlan,
  resolveStoryLocationPlan,
} from '../lib/story-location-bible';
import { assembleStyle01BookReferencesWithZoneSheets } from '../lib/story-location-bible/zone-sheets';
import {
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '../lib/style01-gptimage';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';

const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'lion_shaket_bedtime.md');
const OUT_DIR = path.join(process.cwd(), 'outputs', 'slot02-lion-bedtime-dry-run');
const SIMULATED_CHILD_ANCHOR = '(child canonical anchor at render)';
const CHILD_NAME = 'עומר';
const CHILD_GENDER = 'boy';

function basenameRef(p: string): string {
  return path.basename(p.replace(/\\/g, '/'));
}

function refLabel(p: string, kind: string): string {
  const base = basenameRef(p);
  if (kind === 'child') return `1.child:${base}`;
  if (kind === 'companion') return `2.companion:${base}`;
  if (kind === 'object') return `3.object:${base}`;
  return `4.style:${base}`;
}

function fence(s: string): string {
  return '```\n' + s + '\n```';
}

async function main(): Promise<void> {
  if (!fs.existsSync(BANK_FILE)) {
    throw new Error(`Missing ${BANK_FILE}`);
  }

  const companion = getCompanionById('lion_shaket');
  if (!companion) throw new Error('lion_shaket companion missing');

  const story = await loadStoryFromBank(BANK_FILE, CHILD_NAME, 'ליאו', CHILD_GENDER, {
    skipLlmPersonalization: true,
    maxPages: 20,
  });
  if (story.pages.length !== 8) {
    throw new Error(`expected 8 beats, got ${story.pages.length}`);
  }
  const mdHead = fs.readFileSync(BANK_FILE, 'utf8').slice(0, 800);
  if (!/category:\s*ANGER_FRUSTRATION/.test(mdHead)) {
    throw new Error('expected ANGER_FRUSTRATION category in story frontmatter');
  }

  const beats = beatsFromStoryPages(story.pages);
  const shotPlan = resolveBookShotPlan({ storyFilePath: BANK_FILE, pages: beats });
  const locationPlan = resolveStoryLocationPlan({
    storyFilePath: BANK_FILE,
    challengeCategory: 'ANGER_FRUSTRATION',
    direction: 'bedtime',
    pages: beats,
  });
  const refConfig = resolveStyle01RefBudgetConfig();

  const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
  const check = (id: string, pass: boolean, detail: string) => checks.push({ id, pass, detail });

  check('SP1', isBookShotPlanValid(shotPlan), `shot source=${shotPlan.source}`);
  check(
    'SP2',
    !shotPlan.pages.some((p) => p.angle === 'low' || p.shot === 'dynamic_angle'),
    'gentle bedtime — no low-angle or dynamic_angle shots'
  );
  check('LB1', isStoryLocationPlanValid(locationPlan), `location source=${locationPlan.bible.source}`);
  check('LB2', locationPlan.pagePlans.length === 9, `pagePlans=${locationPlan.pagePlans.length} (cover+p1-8)`);

  const zoneDir = path.join(
    path.dirname(BANK_FILE),
    'lion_shaket_bedtime.zone-sheets',
    'night_bedroom'
  );
  const hasPillowObj = fs.existsSync(path.join(zoneDir, 'pillow-cave-object.png'));
  const hasFoldObj = fs.existsSync(path.join(zoneDir, 'blanket-fold-object.png'));
  check('ZS1', fs.existsSync(path.join(zoneDir, 'manifest.json')), 'zone manifest present');
  if (!hasPillowObj || !hasFoldObj) {
    check(
      'ZS2',
      false,
      `required object PNGs pending — pillow=${hasPillowObj}, blanket-fold=${hasFoldObj}`
    );
  } else {
    check('ZS2', true, 'pillow-cave + blanket-fold object PNGs published');
  }

  const expectedObjectsByPage: Record<string, string[]> = {
    cover: ['pillow-cave-object.png'],
    p1: ['pillow-cave-object.png'],
    p2: [],
    p3: [],
    p4: [],
    p5: [],
    p6: ['pillow-cave-object.png', 'blanket-fold-object.png'],
    p7: ['blanket-fold-object.png'],
    p8: ['pillow-cave-object.png', 'blanket-fold-object.png'],
  };

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push('# Slot #2 — Lion bedtime (ANGER) · Style 01 dry-run manifest');
  push();
  push(`Generated: ${new Date().toISOString()}`);
  push(`Bank: \`${path.relative(process.cwd(), BANK_FILE)}\``);
  push(`Test child (audition): **${CHILD_NAME}** (${CHILD_GENDER}) — NOT Slot #1 Mia/נועה`);
  push(`Companion: lion_shaket · category: ANGER_FRUSTRATION · beats: 8`);
  push();

  push('## BookShotPlan (gentle bedtime override)');
  push();
  push(formatBookShotPlanTable(shotPlan));
  push();

  push('## LocationBible');
  push();
  push('```');
  push(formatLocationPlanTable(locationPlan));
  push('```');
  push();

  const targets: Array<{ page: number | 'cover'; pageNumber: number; assetType?: 'cover' }> = [
    { page: 'cover', pageNumber: 0, assetType: 'cover' },
    ...Array.from({ length: 8 }, (_, i) => ({ page: i + 1, pageNumber: i + 1 })),
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
      challengeCategory: 'ANGER_FRUSTRATION',
      pageShot: shot,
      locationBible: locationPlan.bible,
      pageLocationPlan: loc,
      companion: { id: companion.id, name: companion.name, image: companion.image },
      assetType: t.assetType,
      storyTitle: t.pageNumber === 0 ? story.title : undefined,
      coverText: t.pageNumber === 0 ? story.coverText : undefined,
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
      childFirstName: CHILD_NAME,
      childGender: CHILD_GENDER,
      childAge: 6,
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

    const { breakdown } = assembleStyle01BookReferencesWithZoneSheets({
      styleRefPaths,
      childPhotoPath: refConfig === 'C' ? undefined : SIMULATED_CHILD_ANCHOR,
      companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
      otherCharacterRefPaths: [],
      config: refConfig,
      includeChildPhoto: childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence),
      useMultiCompanionSheets,
      isolatedObjectRefPaths: loc.referenceSheets?.isolatedObjectPaths,
    });

    const label = t.page === 'cover' ? 'cover' : `p${t.page}`;
    const prompt = assembled.prompt;

    const pageActionOk = /PAGE ACTION — MANDATORY/.test(prompt);
    const childOk =
      assembled.entityPresence.childPresence !== 'present' || breakdown.child.length > 0;
    const companionOk =
      assembled.entityPresence.companionPresence !== 'present' ||
      breakdown.companion.length >= 1;
    const noSceneSet = (breakdown.zoneSet ?? []).length === 0;
    const nightOk = /STORY TIME OF DAY|timeOfDay|night/i.test(prompt);
    const noScenarioLock = !/SCENARIO SETTING LOCK/.test(prompt);

    check(`PA-${label}`, pageActionOk, pageActionOk ? 'PAGE ACTION block present' : 'MISSING PAGE ACTION');
    check(`CH-${label}`, childOk, `child bound=${breakdown.child.length > 0}`);
    check(
      `CO-${label}`,
      companionOk,
      `companion sheets=${breakdown.companion.length} presence=${assembled.entityPresence.companionPresence}`
    );
    check(`NS-${label}`, noSceneSet, 'no composed bedroom scene ref');
    check(`NT-${label}`, nightOk, 'night/time lock in prompt');
    check(`SL-${label}`, noScenarioLock, 'no scenario setting lock (single bedroom truth)');

    if (label === 'p7') {
      check(
        'P7-guard',
        loc.forbiddenDrift.some((d) => /speech bubble|meditation|magical beam/i.test(d)),
        'p7 forbiddenDrift includes therapy/comic guards'
      );
      check(
        'P7-intimate',
        /close|intimate|small/i.test(prompt) || shot?.shot === 'close_up',
        'p7 intimate framing'
      );
    }

    const finalOrderLabels: string[] = [];
    for (const p of breakdown.child) finalOrderLabels.push(refLabel(p, 'child'));
    for (const p of breakdown.companion) finalOrderLabels.push(refLabel(p, 'companion'));
    for (const p of breakdown.objectAnchors ?? []) finalOrderLabels.push(refLabel(p, 'object'));
    for (const p of breakdown.style) finalOrderLabels.push(refLabel(p, 'style'));

    push(`## ${label === 'cover' ? 'Cover' : `Page ${t.page}`}`);
    push();
    push(`- zone: \`${loc.zoneId}\``);
    push(`- pageAction: ${loc.pageAction?.slice(0, 120).replace(/\|/g, '/')}…`);
    if (shot) {
      push(`- bookShot: \`${shot.shot}\` (${shot.angle ?? 'eye'})`);
      push(fence(formatPageShotFramingSummary(shot)));
    }
    push(`- entityPresence: child=\`${assembled.entityPresence.childPresence}\` companion=\`${assembled.entityPresence.companionPresence}\``);
    push(`- refs: ${finalOrderLabels.join(' → ') || '(none)'}`);
    push(`- object anchors: ${(breakdown.objectAnchors ?? []).map(basenameRef).join(', ') || '(none — generate zone sheets)'}`);

    const expected = expectedObjectsByPage[label] ?? [];
    if (hasPillowObj && hasFoldObj && expected.length > 0) {
      const attached = (breakdown.objectAnchors ?? []).map(basenameRef);
      const match =
        expected.length === attached.length &&
        expected.every((e) => attached.includes(e));
      check(`OBJ-${label}`, match, `expected [${expected.join(', ')}] got [${attached.join(', ')}]`);
    } else if (expected.length === 0) {
      check(
        `OBJ-${label}`,
        (breakdown.objectAnchors ?? []).length === 0,
        'no object refs expected on this page'
      );
    }
    push();
    push('<details><summary>Assembled prompt</summary>');
    push();
    push(fence(prompt));
    push();
    push('</details>');
    push();
  }

  const failed = checks.filter((c) => !c.pass);
  push('## Gate checklist');
  push();
  push('| check | result | detail |');
  push('|---|---|---|');
  for (const c of checks) {
    push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '/')} |`);
  }
  push();
  if (failed.some((c) => c.id.startsWith('ZS2'))) {
    push(
      '**Object PNGs missing — prompt assembly OK; run zone-sheet generation before LOW render.**'
    );
    push();
  }
  push(
    failed.filter((c) => !c.id.startsWith('ZS2')).length === 0
      ? '**Prompt gate PASS — object PNGs may still be pending (ZS2).**'
      : `**${failed.filter((c) => !c.id.startsWith('ZS2')).length} blocking check(s) failed.**`
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'LOCATION_MANIFEST.md');
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`[dry-run] wrote ${outFile}`);
  for (const c of checks) {
    console.log(`[dry-run] ${c.pass ? 'PASS' : 'FAIL'} ${c.id} :: ${c.detail.slice(0, 120)}`);
  }

  const blocking = failed.filter((c) => !c.id.startsWith('ZS2'));
  if (blocking.length > 0) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
