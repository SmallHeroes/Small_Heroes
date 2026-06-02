/**
 * Generate shouting-v2 and shouting-v3 for Mia (softer childlike shout).
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const OUT_DIR = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'expression-sheet');

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const { getApprovedChildCanonicalAnchor } = await import(
    '@/lib/generation-pipeline/character-anchor-store'
  );
  const {
    generateShoutingVariantAnchor,
    getChildExpressionSheet,
    mergeChildExpressionSheetIntoCache,
  } = await import('@/lib/generation-pipeline/child-expression-sheet');
  const { resolveStyle01StoryWardrobeLock } = await import('@/lib/style01-story-wardrobe');
  const { resolveCompanionForOrder } = await import('@/lib/generation-pipeline/anchor-registry');
  const { buildExpressionShoutingGrid } = await import('./lib/build-expression-shouting-grid');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!order || !job) throw new Error('Order/job missing');

  const cache = (job.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const canonical = getApprovedChildCanonicalAnchor(cache);
  const sheet = getChildExpressionSheet(cache);
  if (!canonical?.url || !sheet) throw new Error('Canonical or sheet missing');

  const directionUrl = sheet.anchors.shouting?.url;
  const wardrobeLock = resolveStyle01StoryWardrobeLock(resolveCompanionForOrder(order)?.id) ?? '';
  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';

  const variants: Array<'v2' | 'v3'> = ['v2', 'v3'];
  const shoutingVariants = { ...sheet.shoutingVariants };

  for (const variant of variants) {
    console.log(`[shouting-variant] generating ${variant}`);
    const result = await generateShoutingVariantAnchor({
      order,
      variant,
      baseAnchorUrl: canonical.url,
      directionAnchorUrl: directionUrl,
      lockedChildDescription,
      wardrobeLock,
    });
    await download(result.url, path.join(OUT_DIR, `shouting-${variant}.png`));
    shoutingVariants[variant] = {
      url: result.url,
      qaStatus: 'passed',
      resemblanceToBase: result.resemblanceToBase,
      createdAt: new Date().toISOString(),
    };
  }

  const nextSheet = { ...sheet, shoutingVariants };
  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: {
      pipelineCache: mergeChildExpressionSheetIntoCache(cache, nextSheet) as object,
    },
  });

  const gridPath = await buildExpressionShoutingGrid(OUT_DIR);
  console.log(
    JSON.stringify(
      {
        orderId: ORDER_ID,
        shoutingVariants,
        gridPath,
        pick: 'npx tsx --require ./scripts/shims/register-server-only.cjs scripts/select-mia-shouting-anchor.ts v2|v3|v1',
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
