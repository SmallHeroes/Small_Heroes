/**
 * Select shouting anchor for page generation: v1 | v2 | v3
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';

async function main() {
  const pick = (process.argv[2] ?? '').trim().toLowerCase() as 'v1' | 'v2' | 'v3';
  if (!['v1', 'v2', 'v3'].includes(pick)) {
    throw new Error('Usage: select-mia-shouting-anchor.ts v1|v2|v3');
  }

  const { prisma } = await import('@/lib/prisma');
  const { getChildExpressionSheet, resolveSelectedShoutingUrl } = await import(
    '@/lib/generation-pipeline/child-expression-sheet'
  );

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!job) throw new Error('Job not found');

  const cache = (job.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const sheet = getChildExpressionSheet(cache);
  if (!sheet) throw new Error('No expression sheet');

  if (pick === 'v2' && !sheet.shoutingVariants?.v2?.url) {
    throw new Error('shouting-v2 missing — run generate-shouting-variants-maia.ts');
  }
  if (pick === 'v3' && !sheet.shoutingVariants?.v3?.url) {
    throw new Error('shouting-v3 missing — run generate-shouting-variants-maia.ts');
  }
  if (pick === 'v1' && !sheet.anchors.shouting?.url) {
    throw new Error('shouting v1 missing');
  }

  const approvedKinds = new Set(sheet.approvedKinds ?? []);
  approvedKinds.add('shouting');

  const nextSheet = {
    ...sheet,
    selectedShouting: pick,
    approvedKinds: [...approvedKinds],
  };

  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: { pipelineCache: { ...cache, childExpressionSheet: nextSheet } },
  });

  console.log(
    JSON.stringify(
      {
        orderId: ORDER_ID,
        selectedShouting: pick,
        url: resolveSelectedShoutingUrl(nextSheet),
        next: 'scripts/run-page8-gate-maia.ts',
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
