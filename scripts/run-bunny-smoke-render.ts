/**
 * Parametrized LOW smoke render — cover + selected pages ONLY.
 *
 * Drives the REAL chunked pipeline (text → dna → stage-0 anchor → cover →
 * page_images) using CHUNKED_IMAGE_PAGE_FILTER to limit paid page images.
 * Job intentionally never reaches audio/package when a page filter is active.
 *
 * Usage:
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-bunny-smoke-render.ts \
 *     --orderId cmq8gafgs00004wq0b4nbb4x9 \
 *     --pages cover,1,6 \
 *     --quality low \
 *     --outputDir outputs/bunny-smoke2-images \
 *     --rerender
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { processGenerationChunk } from '../lib/generation-pipeline/chunk-runner';
import {
  acquireGenerationLease,
  releaseGenerationLease,
} from '../lib/generation-chunked/lease';
import { parsePipelineCache } from '../lib/generation-pipeline/helpers';
import { assertCompanionSheetRenderable } from '../lib/style01-gptimage';
import { resolveCompanionForOrder } from '../lib/generation-pipeline/anchor-registry';
import { getWizardMeta } from '../lib/orderMeta';
import type { Prisma } from '@prisma/client';

const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'bunny_ometz_bedtime.md');
const MAX_CHUNKS = 25;

type SmokeArgs = {
  orderId: string;
  includeCover: boolean;
  pageNumbers: number[];
  quality: string;
  outputDir: string;
  rerender: boolean;
  scrubAnchors: boolean;
};

function parsePages(raw: string): { includeCover: boolean; pageNumbers: number[] } {
  const parts = raw.split(/[,\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const includeCover = parts.includes('cover');
  const pageNumbers = parts
    .filter((p) => p !== 'cover')
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { includeCover, pageNumbers };
}

function parseArgs(): SmokeArgs {
  const argv = process.argv.slice(2);
  let orderId = 'cmq8gafgs00004wq0b4nbb4x9';
  let pages = 'cover,1,6';
  let quality = 'low';
  let outputDir = 'outputs/bunny-smoke2-images';
  let rerender = false;
  let scrubAnchors = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--orderId' && argv[i + 1]) {
      orderId = argv[++i];
      continue;
    }
    if (arg === '--pages' && argv[i + 1]) {
      pages = argv[++i];
      continue;
    }
    if (arg === '--quality' && argv[i + 1]) {
      quality = argv[++i];
      continue;
    }
    if (arg === '--outputDir' && argv[i + 1]) {
      outputDir = argv[++i];
      continue;
    }
    if (arg === '--rerender') {
      rerender = true;
      continue;
    }
    if (arg === '--scrub-anchors') {
      scrubAnchors = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      orderId = arg;
    }
  }

  const { includeCover, pageNumbers } = parsePages(pages);
  return { orderId, includeCover, pageNumbers, quality, outputDir, rerender, scrubAnchors };
}

async function clearTargetImages(
  orderId: string,
  includeCover: boolean,
  pageNumbers: number[]
): Promise<void> {
  const book = await prisma.generatedBook.findUnique({
    where: { orderId },
    include: { pages: { include: { imageAsset: true } } },
  });
  if (!book) return;

  if (includeCover) {
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { coverImageUrl: null },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { coverImageUrl: null },
    });
  }

  for (const pageNumber of pageNumbers) {
    const page = book.pages.find((p) => p.pageNumber === pageNumber);
    if (page?.imageAsset) {
      await prisma.imageAsset.delete({ where: { id: page.imageAsset.id } });
    }
  }

  await prisma.generationJob.updateMany({
    where: { orderId },
    data: {
      imagesDone: false,
      currentStage: includeCover ? 'cover' : 'page_images',
      status: 'running',
    },
  });
  console.log(`[smoke] cleared targets for rerender: cover=${includeCover} pages=[${pageNumbers.join(',')}]`);
}

async function downloadImages(
  urls: Record<string, string>,
  outputDir: string
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, url] of Object.entries(urls)) {
    const out = path.join(outputDir, `${name}.png`);
    const proc = await import('child_process');
    await new Promise<void>((resolve, reject) => {
      proc.execFile('curl.exe', ['-s', '-o', out, url], (err) => (err ? reject(err) : resolve()));
    });
    console.log(`[smoke] saved ${out}`);
  }
}

async function main() {
  const args = parseArgs();
  const { orderId, includeCover, pageNumbers, quality, outputDir, rerender, scrubAnchors } = args;

  if (quality !== 'low') {
    throw new Error(`Smoke render requires --quality low (got "${quality}")`);
  }
  process.env.GPT_IMAGE_QUALITY = 'low';
  if (process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim() !== 'true') {
    throw new Error('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }
  if (!fs.existsSync(BANK_FILE)) throw new Error(`bank file missing: ${BANK_FILE}`);

  if (pageNumbers.length > 0) {
    process.env.CHUNKED_IMAGE_PAGE_FILTER = pageNumbers.join(',');
  } else {
    delete process.env.CHUNKED_IMAGE_PAGE_FILTER;
  }

  process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = [
    process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS ?? '',
    orderId,
  ]
    .filter(Boolean)
    .join(',');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.illustrationStyle !== 'pencil_watercolor') {
    throw new Error(`order style must be pencil_watercolor (Style 01), got ${order.illustrationStyle}`);
  }
  if (!order.childImageUrl) throw new Error('order has no childImageUrl');

  const companion = resolveCompanionForOrder(order);
  assertCompanionSheetRenderable(companion);

  if (scrubAnchors) {
    const anchors = order.characterAnchors;
    if (anchors && typeof anchors === 'object' && !Array.isArray(anchors)) {
      const a = anchors as Record<string, unknown>;
      const keysToDrop = Object.keys(a).filter((k) => k !== '_wizard');
      if (keysToDrop.length > 0) {
        console.log(`[smoke] scrubbing cloned characterAnchors keys: ${keysToDrop.join(', ')}`);
        const scrubbed: Record<string, unknown> = a._wizard ? { _wizard: a._wizard } : {};
        await prisma.order.update({
          where: { id: orderId },
          data: { characterAnchors: scrubbed as Prisma.InputJsonValue },
        });
      }
    }
  }

  if (rerender) {
    await clearTargetImages(orderId, includeCover, pageNumbers);
  }

  const wizardMeta = getWizardMeta(
    (await prisma.order.findUnique({ where: { id: orderId } }))!.characterAnchors
  );

  const existingJob = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!existingJob) {
    await prisma.generationJob.create({
      data: {
        orderId,
        status: 'pending',
        currentStage: 'pending',
        triggerReason: 'bunny-smoke-render',
        pipelineCache: {
          storyFilePath: BANK_FILE,
          storyBankVersion: 'v3',
          selectionFilename: path.basename(BANK_FILE),
          directionForV3: 'bedtime',
          challengeCategory: wizardMeta.challengeCategory ?? 'MEDICAL_PROCEDURE',
        } as Prisma.InputJsonValue,
      },
    });
    console.log('[smoke] generation job created (fresh cache, v3 bunny bank file)');
  } else if (rerender) {
    console.log(`[smoke] job reset for rerender: stage=${existingJob.currentStage}`);
  } else {
    console.log(`[smoke] job exists: stage=${existingJob.currentStage} status=${existingJob.status} — resuming`);
  }

  const targetsDone = async () => {
    const book = await prisma.generatedBook.findUnique({
      where: { orderId },
      include: {
        pages: {
          include: { imageAsset: { select: { url: true } } },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });
    if (!book) return { done: false as const };
    const urls: Record<string, string> = {};
    if (includeCover) {
      if (!book.coverImageUrl?.trim()) return { done: false as const };
      urls.cover = book.coverImageUrl;
    }
    for (const n of pageNumbers) {
      const u = book.pages.find((p) => p.pageNumber === n)?.imageAsset?.url;
      if (!u) return { done: false as const };
      urls[`p${n}`] = u;
    }
    return { done: true as const, urls };
  };

  for (let i = 1; i <= MAX_CHUNKS; i++) {
    const already = await targetsDone();
    if (already.done) break;

    const workerId = await acquireGenerationLease(orderId);
    if (!workerId) throw new Error('could not acquire generation lease (job locked or finished?)');
    try {
      const result = await processGenerationChunk(orderId, workerId);
      console.log(
        `[smoke] chunk ${i}: stage=${result.stage} done=${result.done} error=${result.error ?? '-'}`
      );
      if (result.stage === 'failed') {
        throw new Error(`pipeline failed: ${result.error ?? '(see job.lastError)'}`);
      }
    } finally {
      await releaseGenerationLease(orderId, workerId);
    }
  }

  const final = await targetsDone();
  if (!final.done) throw new Error('smoke targets incomplete after chunk budget — inspect job state');

  await downloadImages(final.urls, outputDir);

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  const cache = parsePipelineCache(job?.pipelineCache);
  const childAnchor = cache.characterAnchorStore?.['child'];
  console.log('');
  console.log(`=== SMOKE RENDER COMPLETE (${[includeCover ? 'cover' : null, ...pageNumbers.map((n) => `p${n}`)].filter(Boolean).join(', ')} @ ${quality.toUpperCase()}) ===`);
  if (final.urls.cover) console.log(`COVER: ${final.urls.cover}`);
  for (const n of pageNumbers) console.log(`P${n}:    ${final.urls[`p${n}`]}`);
  console.log('');
  console.log(`images saved → ${outputDir}/`);
  console.log(`child anchor: ${childAnchor?.url ?? '(see cache)'}`);
  console.log(`anchor resemblance: ${childAnchor?.resemblanceScore ?? '-'} qa=${childAnchor?.qaStatus ?? '-'}`);
  console.log(`job stage now: ${job?.currentStage} (intentionally NOT advanced to audio/package when filtered)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
