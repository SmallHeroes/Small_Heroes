/**
 * Regenerate page 20 — closed-crib standing composition.
 * Saves page-20-round-N.png each round. Vision QA is advisory unless P20_AUTO_ACCEPT_VISION=true.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const PAGE = 20;
const MAX_OUTER_ROUNDS = Number.parseInt(process.env.P20_MAX_ROUNDS ?? '4', 10) || 4;

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
  process.env.PAGE_VISUAL_QA_ENABLED = 'true';
  process.env.PAGE_VISUAL_QA_MAX_REGENS = '3';

  const { prisma } = await import('@/lib/prisma');
  const { getChildExpressionSheet, resolveApprovedExpressionAnchorUrl } = await import(
    '@/lib/generation-pipeline/child-expression-sheet'
  );
  const { resolveChildExpressionKindForPage } = await import(
    '@/lib/generation-pipeline/child-expression-page-map'
  );
  const { evaluatePageVisualQa } = await import('@/lib/generation-pipeline/page-visual-qa');
  const { sceneHasStructuredObjects, sceneHasRailedBedOrCrib, isEmotionalClosingBeat } =
    await import('@/lib/structured-object-composition');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const sheet = getChildExpressionSheet(cache);
  const childExpressionKind = resolveChildExpressionKindForPage({ pageNumber: PAGE });
  const exprUrl = sheet ? resolveApprovedExpressionAnchorUrl(cache, childExpressionKind) : null;
  if (!exprUrl) throw new Error(`No approved expression anchor for page ${PAGE}`);

  const bookPage = await prisma.bookPage.findFirst({
    where: { book: { orderId: ORDER_ID }, pageNumber: PAGE },
    select: { text: true },
  });
  const order = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    select: { childName: true, childGender: true },
  });
  const storyPath =
    cache.devStoryBankFile ?? cache.storyFilePath ?? 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md';
  const story = await loadStoryFromBank(
    storyPath,
    order?.childName ?? 'Mia',
    'דיני',
    order?.childGender ?? undefined,
    { skipLlmPersonalization: true, maxPages: PAGE }
  );
  const storyPage = story.pages.find((p) => p.pageNumber === PAGE);
  const pageImagePrompt = storyPage?.imagePrompt ?? '';
  const pageBookText = bookPage?.text ?? storyPage?.text ?? '';

  const candidates: Array<{ round: number; path: string; qa: unknown; imageUrl: string }> = [];

  for (let round = 1; round <= MAX_OUTER_ROUNDS; round += 1) {
    console.log(`[page20-gate] round ${round}/${MAX_OUTER_ROUNDS}`);
    await clearOrderPageImages(prisma, ORDER_ID, [PAGE]);
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

    let imageUrl: string | null = null;
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      await runGenerationWorkerInvocation(ORDER_ID);
      const row = await prisma.bookPage.findFirst({
        where: { book: { orderId: ORDER_ID }, pageNumber: PAGE },
        select: { imageAsset: { select: { url: true } } },
      });
      if (row?.imageAsset?.url) {
        imageUrl = row.imageAsset.url;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!imageUrl) throw new Error(`Page ${PAGE} generation timed out on round ${round}`);

    const qa = await evaluatePageVisualQa({
      imageUrl,
      expectsChild: true,
      isEmotionalClosing: isEmotionalClosingBeat({
        pageNumber: PAGE,
        totalPages: 20,
        imagePrompt: pageImagePrompt,
        bookPageText: pageBookText,
      }),
      hasStructuredObjects: sceneHasStructuredObjects({
        imagePrompt: pageImagePrompt,
        bookPageText: pageBookText,
      }),
      hasRailedBedOrCrib: sceneHasRailedBedOrCrib({
        imagePrompt: pageImagePrompt,
        bookPageText: pageBookText,
      }),
    });

    const roundDest = path.join(outDir, `page-20-round-${round}.png`);
    await download(imageUrl, roundDest);
    candidates.push({ round, path: roundDest, qa, imageUrl });
    console.log(
      `[page20-gate] round=${round} vision passed=${qa.passed} reason=${qa.reason} details=${qa.details} file=${roundDest}`
    );

    if (qa.passed && process.env.P20_AUTO_ACCEPT_VISION === 'true') {
      fs.copyFileSync(roundDest, path.join(outDir, `page-${PAGE}.png`));
      fs.writeFileSync(
        path.join(outDir, 'page-20-report.json'),
        JSON.stringify({ orderId: ORDER_ID, page: PAGE, round, qa, imageUrl, exprUrl }, null, 2)
      );
      console.log('[page20-gate] accepted on vision (P20_AUTO_ACCEPT_VISION=true)');
      await prisma.$disconnect();
      return;
    }
  }

  const last = candidates[candidates.length - 1];
  if (last) fs.copyFileSync(last.path, path.join(outDir, `page-${PAGE}.png`));
  fs.writeFileSync(
    path.join(outDir, 'page-20-candidates.json'),
    JSON.stringify({ orderId: ORDER_ID, candidates }, null, 2)
  );
  await prisma.$disconnect();
  console.log(
    `[page20-gate] ${MAX_OUTER_ROUNDS} candidates saved. Review page-20-round-*.png BY EYE. ` +
      'When one passes, copy it to page-20.png or rerun with P20_AUTO_ACCEPT_VISION=true.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
