/**
 * Focused 5-page gate for Mia order — pages 1,4,8,13,20.
 * Requires approved B anchor. Saves pages + ref manifests locally.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const PAGES = [1, 4, 8, 13, 20];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'pages');
  const manifestDir = path.join(outDir, 'ref-manifests');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = PAGES.join(',');
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;

  const { prisma } = await import('@/lib/prisma');
  const { getApprovedChildCanonicalAnchor } = await import(
    '@/lib/generation-pipeline/character-anchor-store'
  );
  const { isChildExpressionSheetApproved } = await import(
    '@/lib/generation-pipeline/child-expression-sheet'
  );
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
  const anchor = getApprovedChildCanonicalAnchor(cache as never);
  if (!anchor?.url) {
    throw new Error('No approved child anchor — run scripts/approve-mia-experiment-b-anchor.ts first');
  }
  if (!isChildExpressionSheetApproved(cache as never)) {
    throw new Error(
      'Expression sheet not ready — approve kinds, select shouting (select-mia-shouting-anchor.ts), then rerun'
    );
  }

  const cleared = await clearOrderPageImages(prisma, ORDER_ID, PAGES);
  console.log(`[five-page-gate] cleared ${cleared} image asset(s) for pages ${PAGES.join(',')}`);

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

  const report: Record<string, unknown> = {
    orderId: ORDER_ID,
    anchorUrl: anchor.url,
    pages: {} as Record<string, unknown>,
  };

  for (let attempt = 1; attempt <= 80; attempt += 1) {
    await runGenerationWorkerInvocation(ORDER_ID);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId: ORDER_ID }, pageNumber: { in: PAGES } },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, imageAsset: { select: { url: true, provider: true } } },
    });
    for (const row of rows) {
      const pn = row.pageNumber;
      if (!row.imageAsset?.url) continue;
      const pageReport = (report.pages as Record<string, unknown>)[String(pn)] ?? {};
      if ((pageReport as { imageUrl?: string }).imageUrl) continue;

      const dest = path.join(outDir, `page-${pn}.png`);
      await download(row.imageAsset.url, dest);
      const manifestPath = path.join(manifestDir, `page-${pn}.json`);
      const manifest = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        : null;
      (report.pages as Record<string, unknown>)[String(pn)] = {
        imageUrl: row.imageAsset.url,
        localPath: dest,
        provider: row.imageAsset.provider,
        refManifest: manifest,
      };
    }
    const done = PAGES.every((p) => (report.pages as Record<string, unknown>)[String(p)]);
    if (done) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  fs.writeFileSync(path.join(outDir, 'five-page-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
