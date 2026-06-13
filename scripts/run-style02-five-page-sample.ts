/**
 * Style 02 — 5-page LOW sample (mixed day/dusk story, real child photo).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-style02-five-page-sample.ts --label child-a --photo path/to/photo.jpg
 *
 * Second child (tone-fair proof):
 *   ... --label child-b --photo path/to/other-photo.jpg
 *
 * Requires Next dev server at NEXT_PUBLIC_APP_URL (default http://localhost:3000).
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

process.env.PHASE2_STYLE02_BOOK_PIPELINE = 'true';
process.env.PHASE2_STYLE02_REF_CONFIG = 'A';
process.env.GPT_IMAGE_QUALITY = process.env.GPT_IMAGE_QUALITY?.trim() || 'low';
process.env.STORY_BANK_SKIP_WORKER_CHAIN = 'true';
process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
/** Dev worker path only — NOT a production sellability flip. */
process.env.STYLE02_SELLABLE = 'true';
delete process.env.PHASE2_STEP5_PROFILE;

import './shims/register-server-only.cjs';

const STORY_FILE = 'dragon_dini_fantasy.md';
const COMPANION_ID = 'dragon_dini';
const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'מיה';
/** Day + dusk mix — bedroom day beats + dragon-world dusk beats + closing bedroom. */
const SELECTED_PAGES = [1, 3, 8, 15, 16] as const;

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function resolveChildPhoto(): Promise<string> {
  const explicit = flag('--photo');
  if (explicit && fs.existsSync(explicit)) {
    const buf = fs.readFileSync(explicit);
    const ext = path.extname(explicit).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  const miaOrderId = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
  const { prisma } = await import('@/lib/prisma');
  const mia = await prisma.order.findUnique({
    where: { id: miaOrderId },
    select: { childImageUrl: true },
  });
  if (mia?.childImageUrl) {
    console.log(`[photo] Mia order ${miaOrderId}`);
    return mia.childImageUrl;
  }
  const envPath = process.env.CHILD_PHOTO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) {
    const buf = fs.readFileSync(envPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  throw new Error('Pass --photo path/to/photo.jpg or set CHILD_PHOTO_PATH');
}

async function meanLuminance(imagePath: string): Promise<number> {
  const sharp = (await import('sharp')).default;
  const stats = await sharp(imagePath).stats();
  return Math.round(stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length);
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const label = flag('--label') ?? 'child-a';
  const outRoot = path.join(process.cwd(), 'outputs', 'style02-five-page-sample', label);
  const pagesDir = path.join(outRoot, 'pages');
  const manifestDir = path.join(pagesDir, 'ref-manifests');
  const promptsDir = path.join(pagesDir, 'prompts');

  console.log(`\n=== STYLE 02 five-page sample (${label}) ===\n`);
  console.log(`Story: ${STORY_FILE} | pages: ${SELECTED_PAGES.join(', ')}`);
  console.log(`Quality: ${process.env.GPT_IMAGE_QUALITY} | PHASE2_STYLE02_BOOK_PIPELINE=true\n`);
  console.warn(
    '[style02-sample] STYLE02_SELLABLE=true for this dev run only — stop for Guy eyeball before any production flip.\n'
  );

  if (hasFlag('--selection-only')) {
    console.log('[stop] --selection-only');
    return;
  }

  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(promptsDir, { recursive: true });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const childPhoto = await resolveChildPhoto();

  const createRes = await fetch(`${baseUrl}/api/dev/story-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyFile: STORY_FILE,
      childName: CHILD_NAME,
      childGender: 'girl',
      childAge: 5,
      illustrationStyle: 'detailed_whimsical_world',
      maxPages: 16,
      skipCover: true,
      skipPersonalization: true,
      skipWorkerChain: true,
      childPhotoBase64: childPhoto.startsWith('data:') ? childPhoto : undefined,
      childImageUrl: childPhoto.startsWith('http') ? childPhoto : undefined,
    }),
  });
  const created = (await createRes.json()) as { orderId?: string; error?: string };
  if (!createRes.ok || !created.orderId) {
    throw new Error(`Create order failed: ${JSON.stringify(created)}`);
  }
  const orderId = created.orderId;
  console.log(`[order] ${orderId}`);

  const { prisma } = await import('@/lib/prisma');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
  const { getApprovedChildCanonicalAnchor } = await import('@/lib/generation-pipeline/character-anchor-store');

  process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = orderId;
  process.env.CHUNKED_IMAGE_PAGE_FILTER = SELECTED_PAGES.join(',');
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;

  async function ensureJobLeaseable() {
    const j = await prisma.generationJob.findUnique({ where: { orderId } });
    if (!j) return;
    const leaseStale = !j.lockedBy || !j.leaseExpiresAt || j.leaseExpiresAt < new Date();
    const needsReset = j.status === 'failed' || j.currentStage === 'failed';
    if (!needsReset && !leaseStale) return;
    await prisma.generationJob.updateMany({
      where: { orderId },
      data: {
        lockedBy: null,
        leaseExpiresAt: new Date(0),
        ...(needsReset
          ? {
              status: 'pending',
              currentStage: 'pending',
              lastError: null,
              failedAt: null,
              retryable: true,
            }
          : {}),
      },
    });
  }

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'pending',
      lastError: null,
      failedAt: null,
      retryable: true,
      textDone: true,
      lockedBy: null,
      leaseExpiresAt: new Date(0),
    },
  });

  for (let i = 0; i < 120; i++) {
    await ensureJobLeaseable();
    await runGenerationWorkerInvocation(orderId);
    const job = await prisma.generationJob.findUnique({ where: { orderId } });
    const cache = parsePipelineCache(job?.pipelineCache);
    const approved = getApprovedChildCanonicalAnchor(cache);
    if (approved?.url) {
      console.log(`[stage0] anchor ok score=${approved.resemblanceScore?.toFixed(3)} url=${approved.url.slice(0, 80)}…`);
      break;
    }
    if (job?.status === 'failed') {
      throw new Error(`Generation failed: ${job.lastError}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const cleared = await clearOrderPageImages(prisma, orderId, [...SELECTED_PAGES]);
  console.log(`[pages] cleared ${cleared} assets; generating ${SELECTED_PAGES.join(',')}`);

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'page_images',
      lastError: null,
      failedAt: null,
      retryable: true,
      imagesDone: false,
    },
  });

  const done = new Set<number>();
  for (let attempt = 1; attempt <= 120; attempt++) {
    await ensureJobLeaseable();
    await runGenerationWorkerInvocation(orderId);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId }, pageNumber: { in: [...SELECTED_PAGES] } },
      select: { pageNumber: true, imageAsset: { select: { url: true } } },
    });
    for (const row of rows) {
      if (!row.imageAsset?.url || done.has(row.pageNumber)) continue;
      await download(row.imageAsset.url, path.join(pagesDir, `page-${row.pageNumber}.png`));
      done.add(row.pageNumber);
      console.log(`[pages] saved page-${row.pageNumber}.png`);
    }
    if (SELECTED_PAGES.every((p) => done.has(p))) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  if (!SELECTED_PAGES.every((p) => done.has(p))) {
    throw new Error(`Incomplete pages: missing ${SELECTED_PAGES.filter((p) => !done.has(p)).join(',')}`);
  }

  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { resolveEffectivePageTimeOfDay } = await import('@/lib/story-time-of-day');
  const { isStyle02DayEffectiveTime } = await import('@/lib/style02-gptimage');
  const storyPath = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', STORY_FILE);
  const story = await loadStoryFromBank(storyPath, CHILD_NAME, 'דִּינִי', 'girl', {
    skipLlmPersonalization: true,
  });

  const pageReports: Array<Record<string, unknown>> = [];

  for (const pageNumber of SELECTED_PAGES) {
    const page = story.pages.find((p) => p.pageNumber === pageNumber);
    const effectiveTime = resolveEffectivePageTimeOfDay({
      storyTimeOfDay: story.storyTimeOfDay ?? 'mixed',
      pageNumber,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
      imageDirection: page?.imagePrompt,
      bookPageText: page?.text,
    });
    const manifestPath = path.join(manifestDir, `page-${pageNumber}.json`);
    const manifest = fs.existsSync(manifestPath)
      ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>)
      : null;
    const bookPage = await prisma.bookPage.findFirst({
      where: { book: { orderId }, pageNumber },
      select: { imageAsset: { select: { url: true } }, imagePrompt: true },
    });
    const imageUrl = bookPage?.imageAsset?.url;
    const promptFromDb = bookPage?.imagePrompt ?? '';
    const promptPath = path.join(promptsDir, `page-${pageNumber}-prompt.txt`);
    const prompt = fs.existsSync(promptPath)
      ? fs.readFileSync(promptPath, 'utf8')
      : promptFromDb;
    const localPath = path.join(pagesDir, `page-${pageNumber}.png`);
    if (imageUrl) {
      await download(imageUrl, localPath);
    }

    const luminance = fs.existsSync(localPath) ? await meanLuminance(localPath) : null;
    const isDay = isStyle02DayEffectiveTime(effectiveTime);
    const dayLockInPrompt = prompt.includes('SCENE TIME-OF-DAY LOCK — DAY');
    const nightLockInPrompt = prompt.includes('SCENE TIME-OF-DAY LOCK — NIGHT');

    pageReports.push({
      pageNumber,
      effectivePageTimeOfDay: effectiveTime,
      sceneClass: manifest?.sceneClass ?? null,
      styleSubset: manifest?.styleSubset ?? null,
      meanLuminance: luminance,
      brightnessExpectation: isDay ? 'bright' : 'dark-or-dusk',
      dayLockInPrompt,
      nightLockInPrompt,
      antiGlobalDarkInPrompt: prompt.includes('NOT globally dark'),
      wardrobeInPrompt: prompt.includes('BOOK WARDROBE LOCK'),
      localImage: localPath,
      imageUrl,
    });
  }

  const dayPages = pageReports.filter((p) => p.brightnessExpectation === 'bright');
  const nightPages = pageReports.filter((p) => p.brightnessExpectation !== 'bright');
  const dayLums = dayPages.map((p) => p.meanLuminance).filter((v) => typeof v === 'number') as number[];
  const nightLums = nightPages.map((p) => p.meanLuminance).filter((v) => typeof v === 'number') as number[];
  const avgDay = dayLums.length ? dayLums.reduce((a, b) => a + b, 0) / dayLums.length : null;
  const avgNight = nightLums.length ? nightLums.reduce((a, b) => a + b, 0) / nightLums.length : null;

  const report = {
    test: 'style02_five_page_sample',
    label,
    orderId,
    storyFile: STORY_FILE,
    companionId: COMPANION_ID,
    childName: CHILD_NAME,
    quality: process.env.GPT_IMAGE_QUALITY,
    selectedPages: SELECTED_PAGES,
    pages: pageReports,
    brightnessSummary: {
      avgDayLuminance: avgDay,
      avgNightLuminance: avgNight,
      dayBrighterThanNight: avgDay != null && avgNight != null ? avgDay > avgNight : null,
    },
    stopNote: 'STOP for Guy eyeball before STYLE02_SELLABLE flip.',
    outputsDir: outRoot,
  };

  fs.writeFileSync(path.join(outRoot, 'sample-report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Style 02 five-page sample — ${label}`,
    '',
    `Order: \`${orderId}\``,
    `Story: ${STORY_FILE} | quality: ${process.env.GPT_IMAGE_QUALITY}`,
    '',
    '## Brightness summary',
    `- Avg day luminance: ${avgDay?.toFixed(1) ?? 'n/a'}`,
    `- Avg dusk/night luminance: ${avgNight?.toFixed(1) ?? 'n/a'}`,
    `- Day brighter than dusk/night: **${report.brightnessSummary.dayBrighterThanNight ?? 'n/a'}**`,
    '',
    '## Pages',
    ...pageReports.map(
      (p) =>
        `- **p${p.pageNumber}** time=${p.effectivePageTimeOfDay} lum=${p.meanLuminance ?? '?'} subset=${p.styleSubset} — [\`page-${p.pageNumber}.png\`](pages/page-${p.pageNumber}.png)`
    ),
    '',
    '## Human review (Guy)',
    'Eyeball: personalized child, consistent bird pajama wardrobe, day pages bright, dusk pages appropriately darker, fantasy density preserved.',
    '',
    '**Do NOT set STYLE02_SELLABLE=true until approved.**',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outRoot, 'sample-report.md'), md);

  console.log('\n=== SAMPLE REPORT ===\n');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${path.join(outRoot, 'sample-report.md')}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
