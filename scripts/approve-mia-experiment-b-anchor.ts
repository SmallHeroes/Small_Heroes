/**
 * Approve experiment B PNG as Mia's canonical anchor (order 345ecd64).
 * Uses local B.png or Supabase experiment-B URL from report.json.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const B_URL =
  'https://ozxjmnzybzetqudivlbw.supabase.co/storage/v1/object/public/book-images/orders/345ecd64-c9c2-4e0a-8f9d-a35de8d09883/character-anchors/experiment-B-1780426395576-png';
const RESEMBLANCE = 0.400852736962488;

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const { upsertCharacterAnchor } = await import('@/lib/generation-pipeline/character-anchor-store');

  const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!order || !job) throw new Error('Order/job not found');

  type PC = import('@/lib/generation-pipeline/types').PipelineCache;
  let cache = (job.pipelineCache ?? {}) as PC;

  cache = upsertCharacterAnchor(cache, {
    orderId: ORDER_ID,
    styleId: order.illustrationStyle,
    characterId: 'child',
    role: 'child',
    anchorType: 'canonical_portrait',
    source: 'uploaded_photo',
    url: B_URL,
    provider: 'openai',
    model: 'gpt-image-2',
    qaStatus: 'passed',
    anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    resemblanceScore: RESEMBLANCE,
    thresholdUsed: 0.7,
    promptUsed: 'experiment-B-approved-per-order',
    inputDescriptionUsed: cache.lockedChildDescription ?? '',
    qaNotes: 'Human-approved experiment B — per-order Mia anchor only, NOT system template',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const nextCache: PC = {
    ...cache,
    childAnchorApproved: true,
    stage0SelectedAttempt: 2,
  };

  const existingAnchors =
    order.characterAnchors && typeof order.characterAnchors === 'object'
      ? (order.characterAnchors as Record<string, unknown>)
      : {};

  await prisma.$transaction([
    prisma.generationJob.update({
      where: { orderId: ORDER_ID },
      data: {
        pipelineCache: nextCache as object,
        status: 'pending',
        currentStage: 'cover',
        lastError: null,
        retryable: true,
        failedAt: null,
      },
    }),
    prisma.order.update({
      where: { id: ORDER_ID },
      data: {
        status: 'generating',
        lastError: null,
        characterAnchors: {
          ...existingAnchors,
          child: {
            anchorImageUrl: B_URL,
            anchorApproved: true,
            qaStatus: 'passed',
            resemblanceScore: RESEMBLANCE,
            anchorMethod: 'experiment_B',
          },
        },
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        orderId: ORDER_ID,
        anchorUrl: B_URL,
        childAnchorApproved: true,
        qaStatus: 'passed',
        note: 'Ready for 5-page gate — run scripts/run-five-page-gate-maia.ts',
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
