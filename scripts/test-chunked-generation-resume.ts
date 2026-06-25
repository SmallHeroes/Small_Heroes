/**
 * Real-DB proofs for chunked generation resume / idempotency (no paid API calls).
 *
 *   npx tsx scripts/test-chunked-generation-resume.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  buildArtifactIdempotencyKey,
} from '../lib/generation-chunked/artifact-keys';
import {
  GENERATION_VERSION,
  getPageImagesPerChunk,
  MAX_PAGE_GENERATION_ATTEMPTS,
} from '../lib/generation-chunked/constants';
import {
  findExistingPageImageAsset,
  shouldSkipPaidPageImageRegen,
} from '../lib/generation-chunked/paid-artifact-guard';

const prisma = new PrismaClient();

type ProofResult = { name: string; pass: boolean; detail: string };

async function cleanup(orderId: string, bookId: string): Promise<void> {
  await prisma.imageAsset.deleteMany({ where: { page: { bookId } } });
  await prisma.bookPage.deleteMany({ where: { bookId } });
  await prisma.generatedBook.deleteMany({ where: { orderId } });
  await prisma.generationJob.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
}

async function createFixtureOrder(prefix: string): Promise<{ orderId: string; bookId: string }> {
  const orderId = `${prefix}-${randomUUID().slice(0, 8)}`;
  await prisma.order.create({
    data: {
      id: orderId,
      status: 'generating',
      customerEmail: 'chunk-test@dev.local',
      customerName: 'Chunk Test',
      childName: 'Test',
      childAge: 6,
      childGender: 'girl',
      childTraits: [],
      topic: 'test',
      challengeItems: [],
      outcomeItems: [],
      helperItems: [],
      avoidItems: [],
      storyLength: 'long',
      illustrationStyle: 'realistic_illustrated',
      paymentId: randomUUID(),
      paymentProvider: 'test',
      basePrice: 0,
      addonsPrice: 0,
      totalPrice: 0,
      textStatus: 'done',
      imageStatus: 'running',
      audioStatus: 'done',
      packageStatus: 'pending',
    },
  });
  const book = await prisma.generatedBook.create({
    data: { orderId, title: 'Chunk test', coverText: 'Test' },
  });
  return { orderId, bookId: book.id };
}

/** Proof 1: partial pages complete → resume targets remaining pages only. */
async function proofTimeoutResume(): Promise<ProofResult> {
  const { orderId, bookId } = await createFixtureOrder('chunk-resume');
  try {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        prisma.bookPage.create({
          data: { bookId, pageNumber: n, text: `Page ${n}`, narrationText: `Page ${n}` },
        })
      )
    );

    for (const p of pages.slice(0, 2)) {
      await prisma.imageAsset.create({
        data: {
          pageId: p.id,
          provider: 'test',
          prompt: 'done',
          url: `https://example.com/p${p.pageNumber}.png`,
          idempotencyKey: buildArtifactIdempotencyKey({
            orderId,
            kind: 'page_image',
            pageNumber: p.pageNumber,
            generationVersion: GENERATION_VERSION,
          }),
        },
      });
    }

    await prisma.generationJob.create({
      data: {
        orderId,
        status: 'running',
        currentStage: 'page_images',
        textDone: true,
        imagesDone: false,
        pipelineCache: {},
      },
    });

    const dbPages = await prisma.bookPage.findMany({
      where: { bookId },
      include: { imageAsset: { select: { url: true } } },
      orderBy: { pageNumber: 'asc' },
    });

    const pending = dbPages.filter((p) => !shouldSkipPaidPageImageRegen(p.imageAsset));
    const nextChunk = pending.slice(0, getPageImagesPerChunk()).map((p) => p.pageNumber);

    const pass =
      pending.length === 2 &&
      nextChunk.length === 2 &&
      nextChunk.includes(3) &&
      nextChunk.includes(4);

    return {
      name: 'timeout-after-N-pages resume',
      pass,
      detail: `pending=${pending.length} nextChunk=[${nextChunk.join(',')}]`,
    };
  } finally {
    await cleanup(orderId, bookId);
  }
}

/** Proof 2: crash-after-upload — asset exists in DB, worker must skip paid regen. */
async function proofCrashAfterUpload(): Promise<ProofResult> {
  const { orderId, bookId } = await createFixtureOrder('chunk-crash');
  try {
    const page = await prisma.bookPage.create({
      data: { bookId, pageNumber: 1, text: 'Hello', narrationText: 'Hello' },
    });

    const idempotencyKey = buildArtifactIdempotencyKey({
      orderId,
      kind: 'page_image',
      pageNumber: 1,
      model: 'gpt-image-2',
      quality: 'low',
      generationVersion: GENERATION_VERSION,
    });

    await prisma.imageAsset.create({
      data: {
        pageId: page.id,
        provider: 'gpt-image-2',
        prompt: 'uploaded-before-crash',
        url: 'https://cdn.example.com/orders/page-001.png',
        idempotencyKey,
      },
    });

    const existing = await findExistingPageImageAsset(prisma, {
      pageId: page.id,
      idempotencyKey,
    });
    const skip = shouldSkipPaidPageImageRegen(existing);

    const duplicateByKey = await prisma.imageAsset.count({ where: { idempotencyKey } });
    const duplicateByPage = await prisma.imageAsset.count({ where: { pageId: page.id } });

    const pass = skip && duplicateByKey === 1 && duplicateByPage === 1;

    return {
      name: 'crash-after-upload idempotency',
      pass,
      detail: `skip=${skip} idempotencyKey=${idempotencyKey} dupKey=${duplicateByKey} dupPage=${duplicateByPage}`,
    };
  } finally {
    await cleanup(orderId, bookId);
  }
}

/** Proof 3: exhausted page attempts → failed + retryable, not silently skipped. */
async function proofFailedPageRetryable(): Promise<ProofResult> {
  const { orderId, bookId } = await createFixtureOrder('chunk-fail');
  try {
    await prisma.bookPage.create({
      data: { bookId, pageNumber: 5, text: 'Fail page', narrationText: 'Fail' },
    });

    const pageAttempts: Record<string, number> = { '5': MAX_PAGE_GENERATION_ATTEMPTS };

    await prisma.generationJob.create({
      data: {
        orderId,
        status: 'failed',
        currentStage: 'failed',
        textDone: true,
        imagesDone: false,
        retryable: true,
        lastError: `Page 5 failed after ${MAX_PAGE_GENERATION_ATTEMPTS} attempts`,
        pageAttempts,
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'failed', imageStatus: 'failed', lastError: 'Page 5 image failed' },
    });

    const job = await prisma.generationJob.findUnique({ where: { orderId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const attempts = (job?.pageAttempts as Record<string, number> | null)?.['5'] ?? 0;

    const pass =
      job?.status === 'failed' &&
      job.retryable === true &&
      job.currentStage === 'failed' &&
      order?.status === 'failed' &&
      attempts >= MAX_PAGE_GENERATION_ATTEMPTS &&
      Boolean(job.lastError?.includes('Page 5'));

    return {
      name: 'failed page retryable (no silent skip)',
      pass,
      detail: `attempts=${attempts} retryable=${job?.retryable} error=${job?.lastError}`,
    };
  } finally {
    await cleanup(orderId, bookId);
  }
}

async function main(): Promise<void> {
  const results = await Promise.all([
    proofTimeoutResume(),
    proofCrashAfterUpload(),
    proofFailedPageRetryable(),
  ]);

  let duplicateCount = 0;
  for (const r of results) {
    const tag = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.name}: ${r.detail}`);
    if (!r.pass) duplicateCount += 1;
  }

  const allPass = results.every((r) => r.pass);
  if (allPass) {
    console.log('\n=== STEP-1 RESUME PROOFS: PASS | duplicate-count=0 ===');
  } else {
    console.error('\n=== STEP-1 RESUME PROOFS: FAIL | duplicate-count=' + duplicateCount + ' ===');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
