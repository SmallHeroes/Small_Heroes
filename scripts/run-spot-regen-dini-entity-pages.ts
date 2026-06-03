/**
 * Spot-regenerate egg (6–15) + hatch/baby-dragon (16–19) pages. Skips frozen p20.
 *
 *   npx tsx scripts/run-spot-regen-dini-entity-pages.ts
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const EGG_PAGES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const BABY_PAGES = [16, 17, 18, 19];
const DEFAULT_PAGES = [...EGG_PAGES, ...BABY_PAGES];

type PageReport = {
  pageNumber: number;
  entityFocus: 'egg' | 'baby_dragon' | 'egg_and_baby';
  localPath: string;
  imageUrl: string;
  refManifest: Record<string, unknown> | null;
  entityLocksApplied: string[];
  childExpressionKind?: string;
};

function entityFocusForPage(pageNumber: number): PageReport['entityFocus'] {
  if (BABY_PAGES.includes(pageNumber)) return pageNumber === 16 ? 'egg_and_baby' : 'baby_dragon';
  return 'egg';
}

function locksForPage(pageNumber: number, storyEntities: string[]): string[] {
  const locks: string[] = [];
  if (EGG_PAGES.includes(pageNumber) || pageNumber === 16) {
    locks.push('green_speckled_egg (story-bank + DRAGON_DINI_RECURRING_OBJECT_LOCKS)');
  }
  if (BABY_PAGES.includes(pageNumber)) {
    locks.push('baby_dragon (story-bank + DRAGON_DINI_RECURRING_ENTITY_LOCKS)');
    if (process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim()) {
      locks.push('baby_dragon:dini_hatchling anchor ref when expected on page');
    }
  }
  if (storyEntities.length) locks.push(`storyRecurringEntities: ${storyEntities.join(', ')}`);
  locks.push('global structured-object composition (egg scale on object pages)');
  return locks;
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function buildReport(
  pages: number[],
  outDir: string,
  manifestDir: string,
  storyEntityIds: string[]
): Promise<PageReport[]> {
  const { resolveChildExpressionKindForPage } = await import(
    '@/lib/generation-pipeline/child-expression-page-map'
  );
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { prisma } = await import('@/lib/prisma');

  const order = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    select: { childName: true, childGender: true },
  });
  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const storyPath =
    cache.devStoryBankFile ?? cache.storyFilePath ?? 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md';
  const story = await loadStoryFromBank(
    storyPath,
    order?.childName ?? 'Mia',
    'דיני',
    order?.childGender ?? undefined,
    { skipLlmPersonalization: true }
  );

  const report: PageReport[] = [];
  for (const pageNumber of pages.sort((a, b) => a - b)) {
    const storyPage = story.pages.find((p) => p.pageNumber === pageNumber);
    const manifestPath = path.join(manifestDir, `page-${pageNumber}.json`);
    const refManifest = fs.existsSync(manifestPath)
      ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>)
      : null;
    const row = await prisma.bookPage.findFirst({
      where: { book: { orderId: ORDER_ID }, pageNumber },
      select: { imageAsset: { select: { url: true } } },
    });
    report.push({
      pageNumber,
      entityFocus: entityFocusForPage(pageNumber),
      localPath: path.join(outDir, `page-${pageNumber}.png`),
      imageUrl: row?.imageAsset?.url ?? '',
      refManifest,
      entityLocksApplied: locksForPage(pageNumber, storyEntityIds),
      childExpressionKind: resolveChildExpressionKindForPage({
        pageNumber,
        imagePrompt: storyPage?.imagePrompt,
        bookPageText: storyPage?.text,
      }),
    });
  }
  return report;
}

async function main() {
  if (process.argv[2] === '--report-only') {
    const pages = (process.argv[3]?.trim() ? process.argv[3].split(',') : DEFAULT_PAGES.map(String))
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'pages');
    const manifestDir = path.join(outDir, 'ref-manifests');
    const storyRaw = fs.readFileSync('story-bank/v5-fixed-v2/dragon_dini_fantasy.md', 'utf8');
    const { parseRecurringEntitiesFromStoryMarkdown } = await import('@/lib/story-bank/recurring-entities');
    const storyEntityIds = parseRecurringEntitiesFromStoryMarkdown(storyRaw).map((e) => e.entityId);
    const pageReports = await buildReport(pages, outDir, manifestDir, storyEntityIds);
    const summary = {
      orderId: ORDER_ID,
      generatedAt: new Date().toISOString(),
      pages: pageReports,
      eggPageRange: EGG_PAGES,
      babyPageRange: BABY_PAGES,
      p20Frozen: fs.existsSync(path.join(outDir, 'page-20-frozen.json')),
      babyDragonAnchorConfigured: Boolean(process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim()),
    };
    fs.writeFileSync(path.join(outDir, 'entity-spot-report.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const pages = (process.argv[2]?.trim() ? process.argv[2].split(',') : DEFAULT_PAGES.map(String))
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n !== 20);

  const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'pages');
  const manifestDir = path.join(outDir, 'ref-manifests');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });

  const frozenPath = path.join(outDir, 'page-20-frozen.json');
  if (!fs.existsSync(frozenPath)) {
    console.warn('[spot-regen] page-20-frozen.json missing — p20 not marked frozen');
  }

  if (!process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim()) {
    console.warn(
      '[spot-regen] DINI_BABY_DRAGON_ANCHOR_URL unset — run configure-baby-dragon-anchor.ts for pages 16–19'
    );
  }

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = pages.join(',');
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;
  process.env.PAGE_VISUAL_QA_ENABLED = 'true';

  const { prisma } = await import('@/lib/prisma');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { parseRecurringEntitiesFromStoryMarkdown } = await import('@/lib/story-bank/recurring-entities');

  const storyRaw = fs.readFileSync('story-bank/v5-fixed-v2/dragon_dini_fantasy.md', 'utf8');
  const storyEntityIds = parseRecurringEntitiesFromStoryMarkdown(storyRaw).map((e) => e.entityId);

  const cleared = await clearOrderPageImages(prisma, ORDER_ID, pages);
  console.log(`[spot-regen] cleared ${cleared} assets for pages ${pages.join(',')}`);

  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: {
      status: 'pending',
      currentStage: 'page_images',
      lastError: null,
      retryable: true,
      imagesDone: false,
    },
  });

  const done = new Set<number>();
  for (let attempt = 1; attempt <= 180; attempt += 1) {
    await runGenerationWorkerInvocation(ORDER_ID);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId: ORDER_ID }, pageNumber: { in: pages } },
      select: { pageNumber: true, imageAsset: { select: { url: true } } },
    });
    for (const row of rows) {
      if (!row.imageAsset?.url || done.has(row.pageNumber)) continue;
      const dest = path.join(outDir, `page-${row.pageNumber}.png`);
      await download(row.imageAsset.url, dest);
      done.add(row.pageNumber);
      console.log(`[spot-regen] saved page-${row.pageNumber}.png`);
    }
    if (pages.every((p) => done.has(p))) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const missing = pages.filter((p) => !done.has(p));
  if (missing.length) {
    throw new Error(`Spot regen incomplete — missing pages: ${missing.join(',')}`);
  }

  const pageReports = await buildReport(pages, outDir, manifestDir, storyEntityIds);
  const summary = {
    orderId: ORDER_ID,
    generatedAt: new Date().toISOString(),
    pages: pageReports,
    eggPageRange: EGG_PAGES,
    babyPageRange: BABY_PAGES,
    p20Frozen: fs.existsSync(frozenPath),
    babyDragonAnchorConfigured: Boolean(process.env.DINI_BABY_DRAGON_ANCHOR_URL?.trim()),
    validationNotes: [
      'green_speckled_egg: ball/pillow scale, same object — eyeball pages 6–15',
      'baby_dragon: newborn, much smaller than Dini, moss-green not copper-orange — eyeball 16–19',
      '0.70 resemblance gate unchanged',
    ],
  };
  const reportPath = path.join(outDir, 'entity-spot-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`[spot-regen] report → ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
