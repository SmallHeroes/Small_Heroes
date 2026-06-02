/**
 * Rerun page 8 only (shouting beat) with approved expression sheet.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const PAGE = 8;

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'pages');
  const manifestDir = path.join(outDir, 'ref-manifests');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(manifestDir, { recursive: true });

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.CHUNKED_IMAGE_PAGE_FILTER = String(PAGE);
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;

  const { prisma } = await import('@/lib/prisma');
  const {
    getChildExpressionSheet,
    resolveSelectedShoutingUrl,
  } = await import('@/lib/generation-pipeline/child-expression-sheet');
  const { resolveChildExpressionKindForPage } = await import(
    '@/lib/generation-pipeline/child-expression-page-map'
  );
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const sheet = getChildExpressionSheet(cache);
  const shoutingUrl = sheet ? resolveSelectedShoutingUrl(sheet) : null;
  if (!sheet?.selectedShouting || !shoutingUrl) {
    throw new Error('Select shouting first: scripts/select-mia-shouting-anchor.ts v1|v2|v3');
  }
  const childExpressionKind = resolveChildExpressionKindForPage({ pageNumber: PAGE });
  if (childExpressionKind !== 'shouting') {
    throw new Error(`Page ${PAGE} map expected shouting, got ${childExpressionKind}`);
  }

  const cleared = await clearOrderPageImages(prisma, ORDER_ID, [PAGE]);
  console.log(`[page8-gate] cleared ${cleared} image asset(s) for page ${PAGE}`);

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

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await runGenerationWorkerInvocation(ORDER_ID);
    const row = await prisma.bookPage.findFirst({
      where: { book: { orderId: ORDER_ID }, pageNumber: PAGE },
      select: { imageAsset: { select: { url: true, provider: true } } },
    });
    if (row?.imageAsset?.url) {
      const dest = path.join(outDir, `page-${PAGE}.png`);
      await download(row.imageAsset.url, dest);
      const manifestPath = path.join(manifestDir, `page-${PAGE}.json`);
      const refManifest = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        : null;
      const report = {
        orderId: ORDER_ID,
        page: PAGE,
        childExpressionKind,
        selectedShouting: sheet.selectedShouting,
        shoutingAnchorUrl: shoutingUrl,
        proofRef0IsShoutingAnchor:
          refManifest?.finalOrder?.[0] === shoutingUrl ||
          refManifest?.characterRefs?.[0] === shoutingUrl,
        imageUrl: row.imageAsset.url,
        localPath: dest,
        provider: row.imageAsset.provider,
        refManifest: refManifest
          ? {
              characterRefs: refManifest.characterRefs,
              styleRefs: refManifest.styleRefs,
              finalOrder: refManifest.finalOrder,
              childExpressionKind: refManifest.childExpressionKind,
              canonicalAnchorRef: refManifest.canonicalAnchorRef,
            }
          : null,
      };
      fs.writeFileSync(path.join(outDir, 'page-8-report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
