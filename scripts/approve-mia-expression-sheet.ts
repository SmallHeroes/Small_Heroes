/**
 * Approve Mia's generated expression mini-sheet for per-page ref selection.
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const {
    getChildExpressionSheet,
    CHILD_EXPRESSION_KINDS,
  } = await import('@/lib/generation-pipeline/child-expression-sheet');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!job) throw new Error('Job not found');

  const cache = (job.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) throw new Error('No childExpressionSheet in pipeline cache — generate first');

  for (const kind of CHILD_EXPRESSION_KINDS) {
    const entry = sheet.anchors[kind];
    if (!entry?.url || entry.qaStatus !== 'passed') {
      throw new Error(`Missing or failed expression anchor: ${kind}`);
    }
  }

  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: {
      pipelineCache: {
        ...cache,
        childExpressionSheet: { ...sheet, approved: true },
      },
    },
  });

  console.log(
    JSON.stringify(
      { orderId: ORDER_ID, childExpressionSheetApproved: true, kinds: CHILD_EXPRESSION_KINDS },
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
