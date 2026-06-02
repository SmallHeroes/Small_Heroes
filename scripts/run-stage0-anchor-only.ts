import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-stage0-anchor-only.ts <orderId>'
    );
    process.exit(1);
  }

  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.GENERATION_ANCHOR_ONLY = 'true';

  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
  const { prisma } = await import('@/lib/prisma');

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const worker = await runGenerationWorkerInvocation(orderId);
    const job = await prisma.generationJob.findUnique({
      where: { orderId },
      select: { pipelineCache: true },
    });
    const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
    const childAnchor = (cache.characterAnchorStore as Record<string, unknown> | undefined)?.child as
      | Record<string, unknown>
      | undefined;

    const pageOne = await prisma.bookPage.findFirst({
      where: { book: { orderId }, pageNumber: 1 },
      select: { imageAsset: { select: { id: true } } },
    });

    const status = {
      attempt,
      worker,
      childAnchorExists: Boolean(childAnchor?.url),
      childAnchorQaStatus: childAnchor?.qaStatus ?? null,
      childAnchorQuality: childAnchor?.anchorQuality ?? null,
      pageOneImageExists: Boolean(pageOne?.imageAsset?.id),
    };
    console.log(JSON.stringify(status, null, 2));

    const qaStatus = childAnchor?.qaStatus ?? null;
    if (childAnchor?.url && (qaStatus === 'passed' || qaStatus === 'pending_review')) {
      await prisma.generationJob.update({
        where: { orderId },
        data: {
          status: 'failed',
          currentStage: 'failed',
          retryable: false,
          lastError:
            qaStatus === 'pending_review'
              ? 'anchor-only: pending human review (use approve-child-anchor or CHILD_ANCHOR_REVIEW_OK_ORDER_IDS)'
              : 'anchor-only run complete (intentional stop before page generation)',
          lockedBy: null,
          leaseExpiresAt: null,
        },
      });
      break;
    }
    if (worker.stage === 'failed') process.exit(1);
    await new Promise((r) => setTimeout(r, 500));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

