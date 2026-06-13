/**
 * Final visual fixes — ledge-drip lock + mystery cover, then full assembly.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-slot01-final-visual-fixes.ts [--orderId fee7e6a7-...] [--skip-reroll]
 */
import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import {
  buildRawVsNormalizedContactSheet,
  isBookColorNormalizeEnabled,
  normalizeRawDirToNormalized,
} from '../lib/book-color-normalize';
import {
  formatLocationPlanTable,
  resolvePageLocationPlan,
  resolveStoryLocationPlan,
} from '../lib/story-location-bible';
import { beatsFromStoryPages, formatBookShotPlanTable, isBookShotPlanValid, resolveBookShotPlan } from '../lib/book-shot-plan';
import { loadStoryFromBank } from '../backend/providers/story-bank-loader';

const ORDER_DEFAULT = 'fee7e6a7-c069-4b74-b006-5a2395ea95b6';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

const REROLL_OUT = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-final-fixes-reroll');
const REROLL_RAW = path.join(REROLL_OUT, 'raw');
const OBJECT_FIX_RAW = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-object-fix-reroll', 'raw');
const FULL_RENDER_RAW = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-full-render', 'raw');
const OUT_ROOT = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-final-assembly');
const ASSEMBLY_RAW = path.join(OUT_ROOT, 'raw');
const ASSEMBLY_MANIFESTS = path.join(OUT_ROOT, 'ref-manifests');

/** cover + ledge-drip reroll targets */
const REROLL_PAGES = 'cover,6,8,10,11';

type PageSource = { file: string; from: string; manifestDir?: string; manifestKey: string };

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function copyFile(src: string, dest: string): void {
  if (!fs.existsSync(src)) throw new Error(`missing source: ${src}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function resolveManifest(srcDir: string | undefined, pageKey: string): string | undefined {
  if (!srcDir) return undefined;
  const mf = path.join(srcDir, `${pageKey}.json`);
  return fs.existsSync(mf) ? mf : undefined;
}

async function clearLocationCache(orderId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');
  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (job) {
    const cache = parsePipelineCache(job.pipelineCache);
    delete (cache as { storyLocationPlan?: unknown }).storyLocationPlan;
    await prisma.generationJob.update({
      where: { orderId },
      data: { pipelineCache: cache },
    });
    console.log('[final-fixes] cleared storyLocationPlan cache');
  }
  await prisma.$disconnect();
}

async function runReroll(orderId: string): Promise<void> {
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.PAGE_REF_MANIFEST_DIR = path.join(REROLL_OUT, 'ref-manifests');
  fs.mkdirSync(process.env.PAGE_REF_MANIFEST_DIR, { recursive: true });
  fs.mkdirSync(REROLL_RAW, { recursive: true });

  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    orderId,
    '--pages',
    REROLL_PAGES,
    '--quality',
    'low',
    '--outputDir',
    REROLL_RAW,
    '--bankFile',
    BANK_FILE,
    '--rerender',
  ];

  console.log(`[final-fixes] reroll ${REROLL_PAGES} → ${REROLL_RAW}`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assembleFinalBook(): PageSource[] {
  const objectFixManifests = path.join(
    process.cwd(),
    'outputs',
    'sprint-11-runs',
    'slot01-object-fix-reroll',
    'ref-manifests'
  );
  const fullRenderManifests = path.join(
    process.cwd(),
    'outputs',
    'sprint-11-runs',
    'slot01-full-render',
    'ref-manifests'
  );
  const rerollManifests = path.join(REROLL_OUT, 'ref-manifests');

  const plan: Array<{
    outName: string;
    srcDir: string;
    manifestDir?: string;
    manifestKey: string;
    label: string;
  }> = [
    { outName: 'cover.png', srcDir: REROLL_RAW, manifestDir: rerollManifests, manifestKey: 'page-0', label: 'cover (mystery reroll)' },
    ...([1, 2, 3, 4] as const).map((n) => ({
      outName: `p${n}.png`,
      srcDir: OBJECT_FIX_RAW,
      manifestDir: objectFixManifests,
      manifestKey: `page-${n}`,
      label: `p${n} (object-fix reroll)`,
    })),
    {
      outName: 'p5.png',
      srcDir: FULL_RENDER_RAW,
      manifestDir: fullRenderManifests,
      manifestKey: 'page-5',
      label: 'p5 (full-render first reveal)',
    },
    {
      outName: 'p6.png',
      srcDir: REROLL_RAW,
      manifestDir: rerollManifests,
      manifestKey: 'page-6',
      label: 'p6 (ledge-drip reroll)',
    },
    {
      outName: 'p7.png',
      srcDir: FULL_RENDER_RAW,
      manifestDir: fullRenderManifests,
      manifestKey: 'page-7',
      label: 'p7 (full-render existing)',
    },
    {
      outName: 'p8.png',
      srcDir: REROLL_RAW,
      manifestDir: rerollManifests,
      manifestKey: 'page-8',
      label: 'p8 (ledge-drip reroll)',
    },
    {
      outName: 'p9.png',
      srcDir: FULL_RENDER_RAW,
      manifestDir: fullRenderManifests,
      manifestKey: 'page-9',
      label: 'p9 (full-render existing)',
    },
    {
      outName: 'p10.png',
      srcDir: REROLL_RAW,
      manifestDir: rerollManifests,
      manifestKey: 'page-10',
      label: 'p10 (ledge-drip reroll)',
    },
    {
      outName: 'p11.png',
      srcDir: REROLL_RAW,
      manifestDir: rerollManifests,
      manifestKey: 'page-11',
      label: 'p11 (ledge-drip reroll)',
    },
    {
      outName: 'p12.png',
      srcDir: FULL_RENDER_RAW,
      manifestDir: fullRenderManifests,
      manifestKey: 'page-12',
      label: 'p12 (full-render existing)',
    },
  ];

  fs.mkdirSync(ASSEMBLY_RAW, { recursive: true });
  fs.mkdirSync(ASSEMBLY_MANIFESTS, { recursive: true });

  const sources: PageSource[] = [];
  for (const item of plan) {
    const src = path.join(item.srcDir, item.outName);
    const dest = path.join(ASSEMBLY_RAW, item.outName);
    copyFile(src, dest);
    console.log(`[assembly] ${item.outName} ← ${item.label}`);

    const mfSrc = resolveManifest(item.manifestDir, item.manifestKey);
    if (mfSrc) {
      const mfDest = path.join(ASSEMBLY_MANIFESTS, `${item.manifestKey}.json`);
      fs.copyFileSync(mfSrc, mfDest);
    }

    sources.push({
      file: item.outName,
      from: item.label,
      manifestDir: item.manifestDir,
      manifestKey: item.manifestKey,
    });
  }
  return sources;
}

async function normalizeAndContactSheet(): Promise<string[]> {
  if (!isBookColorNormalizeEnabled()) {
    console.log('[assembly] BOOK_COLOR_NORMALIZE off — skipping normalized/');
    return fs.readdirSync(ASSEMBLY_RAW).filter((f) => f.endsWith('.png'));
  }
  const normalizedDir = path.join(OUT_ROOT, 'normalized');
  const files = await normalizeRawDirToNormalized({ rawDir: ASSEMBLY_RAW, normalizedDir });
  const contactPath = path.join(OUT_ROOT, 'contact-sheet-raw-vs-normalized.png');
  await buildRawVsNormalizedContactSheet({
    rawDir: ASSEMBLY_RAW,
    normalizedDir,
    outPath: contactPath,
    files,
  });
  console.log(`[assembly] contact sheet → ${contactPath}`);
  return files;
}

async function writeReport(orderId: string, sources: PageSource[]): Promise<void> {
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

  const refRows: string[] = [];
  for (const pageNum of [0, ...Array.from({ length: 12 }, (_, i) => i + 1)]) {
    const mf = path.join(ASSEMBLY_MANIFESTS, `page-${pageNum}.json`);
    if (!fs.existsSync(mf)) continue;
    const manifest = JSON.parse(fs.readFileSync(mf, 'utf8')) as {
      finalOrder?: string[];
      objectAnchorRefs?: string[];
      locationZoneId?: string;
    };
    const loc = resolvePageLocationPlan(locationPlan, pageNum);
    const label = pageNum === 0 ? 'cover' : `p${pageNum}`;
    const src = sources.find((s) =>
      pageNum === 0 ? s.file === 'cover.png' : s.file === `p${pageNum}.png`
    );
    refRows.push(
      `| ${label} | ${src?.from ?? '-'} | ${loc?.zoneId ?? manifest.locationZoneId ?? '-'} | ${(manifest.objectAnchorRefs ?? []).map((r) => path.basename(r)).join(', ') || '—'} | ${(manifest.finalOrder ?? []).length} refs |`
    );
  }

  const lines = [
    '# Sprint 11 Slot #1 — final assembly (ledge-drip + mystery cover)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Order: \`${orderId}\``,
    `Bank: \`story-bank/v3-approved/fox_uri_adventure.md\``,
    '',
    '## Fixes applied',
    '',
    '1. **Drip source** — stone/plaster window ledge only (never pipe/gutter/faucet)',
    '2. **Cover mystery** — inside bedroom near night window; NO bucket/drip/solution',
    '',
    '## Assembly sources',
    '',
    '| File | Source |',
    '| --- | --- |',
    ...sources.map((s) => `| ${s.file} | ${s.from} |`),
    '',
    '## BookShotPlan',
    '',
    `Valid: **${isBookShotPlanValid(shotPlan) ? 'PASS' : 'FAIL'}**`,
    '',
    '```',
    formatBookShotPlanTable(shotPlan),
    '```',
    '',
    '## LocationBible',
    '',
    '```',
    formatLocationPlanTable(locationPlan),
    '```',
    '',
    '## Ref manifests (assembled)',
    '',
    '| Page | Source | zoneId | objectAnchor | ref count |',
    '| --- | --- | --- | --- | --- |',
    ...refRows,
    '',
    '## Artifacts',
    '',
    `- raw: \`${path.relative(process.cwd(), ASSEMBLY_RAW)}/\``,
    `- normalized: \`${path.relative(process.cwd(), path.join(OUT_ROOT, 'normalized'))}/\``,
    `- contact sheet: \`contact-sheet-raw-vs-normalized.png\``,
    `- ref manifests: \`${path.relative(process.cwd(), ASSEMBLY_MANIFESTS)}/\``,
    '',
    '## PASS criteria (Guy + Claude eyeball)',
    '',
    '1. Cover preserves mystery — no bucket/drip/solution object',
    '2. p1–p4 preserve mystery — no bucket/drip; p4 = dry railing/tap beat',
    '3. p5 = first clear reveal of same small galvanized metal bucket',
    '4. Drip source = stone/plaster window ledge only',
    '5. Bucket scale stable — knee-height, never basin-sized',
    '6. Page actions read — p6 listen · p8 duet mid-gesture · p10 slide · p11 drum comedy',
    '7. Identity stable — Noya same child, Uri same fox',
    '',
    '**STOP** — final visual PASS before matrix flip. NIGHT_FEAR.adventure stays **missing**.',
  ];

  const reportPath = path.join(OUT_ROOT, 'FINAL_RENDER_REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`[assembly] report → ${reportPath}`);
}

async function main(): Promise<void> {
  const orderId = flag('--orderId')?.trim() || ORDER_DEFAULT;
  const skipReroll = hasFlag('--skip-reroll');

  await clearLocationCache(orderId);

  if (!skipReroll) {
    await runReroll(orderId);
  } else {
    console.log('[final-fixes] --skip-reroll: using existing reroll outputs');
  }

  const sources = assembleFinalBook();
  await normalizeAndContactSheet();
  await writeReport(orderId, sources);

  console.log('');
  console.log('=== FINAL VISUAL FIXES + ASSEMBLY COMPLETE ===');
  console.log(`orderId=${orderId}`);
  console.log(`assembly → ${OUT_ROOT}`);
  console.log('STOP for Guy + Claude full-book eyeball — matrix NOT flipped.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
