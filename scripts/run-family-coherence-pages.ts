/**
 * Spot-render family-validation pages (Dini: p2 + p20) with #18 family coherence locks.
 *
 *   npx tsx scripts/run-family-coherence-pages.ts
 *   npx tsx scripts/run-family-coherence-pages.ts 345ecd64-c9c2-4e0a-8f9d-a35de8d09883 2,20
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const DEFAULT_ORDER = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const DEFAULT_PAGES = [2, 20];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const orderId = process.argv[2]?.trim() || DEFAULT_ORDER;
  const pageArg = process.argv[3]?.trim();
  const pages = pageArg
    ? pageArg.split(/[,\s]+/).map((n) => Number.parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_PAGES;

  const outDir = path.join(process.cwd(), 'outputs', 'family-coherence', orderId, 'pages');
  fs.mkdirSync(outDir, { recursive: true });

  const { prisma } = await import('@/lib/prisma');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
  const {
    ensureFamilyCoherenceBundle,
    getFamilyCoherenceFromAnchors,
    persistFamilyCoherenceOnOrder,
  } = await import('@/lib/family-coherence');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  const cache = parsePipelineCache(job?.pipelineCache);
  let bundle =
    getFamilyCoherenceFromAnchors(order.characterAnchors) ?? cache.familyCoherence ?? null;
  if (!bundle) {
    bundle = ensureFamilyCoherenceBundle(order, {
      childPhotoDescription: cache.childPhotoDescription,
      childStructured: cache.dna?.childStructured,
    });
    await prisma.order.update({
      where: { id: orderId },
      data: {
        characterAnchors: persistFamilyCoherenceOnOrder(
          order.characterAnchors,
          bundle
        ) as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`[family-coherence] profile band=${bundle.profile.skinToneBand}`);

  if (job) {
    await prisma.generationJob.update({
      where: { orderId },
      data: {
        pipelineCache: { ...cache, familyCoherence: bundle },
      },
    });
  }

  const cleared = await clearOrderPageImages(prisma, orderId, pages);
  console.log(`[family-coherence] cleared ${cleared} assets for pages ${pages.join(',')}`);

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = pages.join(',');

  await prisma.generationJob.update({
    where: { orderId },
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
    await runGenerationWorkerInvocation(orderId);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId }, pageNumber: { in: pages } },
      select: { pageNumber: true, imageAsset: { select: { url: true } } },
    });
    for (const row of rows) {
      if (!row.imageAsset?.url || done.has(row.pageNumber)) continue;
      const dest = path.join(outDir, `page-${row.pageNumber}.png`);
      await download(row.imageAsset.url, dest);
      done.add(row.pageNumber);
      console.log(`[family-coherence] saved page-${row.pageNumber}.png`);
    }
    if (pages.every((p) => done.has(p))) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const report = {
    orderId,
    pages: pages.map((pageNumber) => ({
      pageNumber,
      localPath: path.join(outDir, `page-${pageNumber}.png`),
      done: done.has(pageNumber),
    })),
    profile: bundle.profile,
    memberLockRoles: Object.keys(bundle.memberLocks),
    note: 'Eyeball: same mother on p2+p20; newborn in family skin band; 0.70 gate unchanged.',
  };
  fs.writeFileSync(
    path.join(outDir, '..', 'family-coherence-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  if (!pages.every((p) => done.has(p))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
