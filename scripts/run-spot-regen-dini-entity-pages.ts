/**
 * Spot-regenerate egg + baby-dragon pages after locks (NOT full book).
 * Default pages: egg 6–15, hatch/baby 16–19 (skip 20 — run page20 gate separately).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-spot-regen-dini-entity-pages.ts
 *   npx tsx ... scripts/run-spot-regen-dini-entity-pages.ts 16,17,18,19
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const DEFAULT_PAGES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const pages = (process.argv[2]?.trim() ? process.argv[2].split(',') : DEFAULT_PAGES.map(String))
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));

  const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'pages');
  const manifestDir = path.join(outDir, 'ref-manifests');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = pages.join(',');
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;

  const { prisma } = await import('@/lib/prisma');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

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
  for (let attempt = 1; attempt <= 120; attempt += 1) {
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

  console.log(JSON.stringify({ orderId: ORDER_ID, pages: [...done].sort((a, b) => a - b) }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
