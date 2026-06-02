/**
 * Approve neutral, happy, worried, and action (action = strong locomotion only at runtime).
 * Shouting stays pending until select-mia-shouting-anchor.ts.
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const APPROVE_KINDS = ['neutral', 'happy', 'worried', 'action'] as const;

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const { getChildExpressionSheet } = await import('@/lib/generation-pipeline/child-expression-sheet');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!job) throw new Error('Job not found');

  const cache = (job.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) throw new Error('No expression sheet — generate first');

  for (const kind of APPROVE_KINDS) {
    const entry = sheet.anchors[kind];
    if (!entry?.url || entry.qaStatus !== 'passed') {
      throw new Error(`Missing passed anchor: ${kind}`);
    }
  }

  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: {
      pipelineCache: {
        ...cache,
        childExpressionSheet: {
          ...sheet,
          approved: false,
          approvedKinds: [...APPROVE_KINDS],
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        orderId: ORDER_ID,
        approvedKinds: APPROVE_KINDS,
        shouting: 'pending — pick v1/v2/v3 then run select-mia-shouting-anchor.ts',
        actionNote: 'action anchor approved but only used for strong locomotion beats',
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
