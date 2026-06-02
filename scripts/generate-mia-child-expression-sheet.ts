/**
 * Generate per-order mini child expression sheet for Mia (from approved B anchor).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-mia-child-expression-sheet.ts
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
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { prisma } = await import('@/lib/prisma');
  const { getApprovedChildCanonicalAnchor } = await import(
    '@/lib/generation-pipeline/character-anchor-store'
  );
  const {
    generateFullChildExpressionSheet,
    mergeChildExpressionSheetIntoCache,
    CHILD_EXPRESSION_KINDS,
  } = await import('@/lib/generation-pipeline/child-expression-sheet');
  const { resolveStyle01StoryWardrobeLock } = await import('@/lib/style01-story-wardrobe');
  const { resolveCompanionForOrder } = await import('@/lib/generation-pipeline/anchor-registry');

  const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!order || !job) throw new Error('Order/job not found');

  const cache = (job.pipelineCache ?? {}) as import('@/lib/generation-pipeline/types').PipelineCache;
  const canonical = getApprovedChildCanonicalAnchor(cache);
  if (!canonical?.url) {
    throw new Error('No approved canonical anchor — run approve-mia-experiment-b-anchor.ts first');
  }

  const companion = resolveCompanionForOrder(order);
  const wardrobeLock = resolveStyle01StoryWardrobeLock(companion?.id) ?? '';
  const lockedChildDescription = cache.lockedChildDescription ?? cache.dna?.childDNA ?? '';

  console.log(`[expression-sheet] base=${canonical.url}`);
  const sheet = await generateFullChildExpressionSheet({
    order,
    baseAnchorUrl: canonical.url,
    lockedChildDescription,
    wardrobeLock,
  });

  const nextCache = mergeChildExpressionSheetIntoCache(cache, sheet);
  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: { pipelineCache: nextCache as object },
  });

  const report: Record<string, unknown> = {
    orderId: ORDER_ID,
    baseAnchorUrl: canonical.url,
    approved: false,
    anchors: {},
  };

  for (const kind of CHILD_EXPRESSION_KINDS) {
    const entry = sheet.anchors[kind];
    if (!entry?.url) continue;
    const dest = path.join(OUT_DIR, `${kind}.png`);
    await download(entry.url, dest);
    (report.anchors as Record<string, unknown>)[kind] = {
      url: entry.url,
      localPath: dest,
      resemblanceToBase: entry.resemblanceToBase,
      qaStatus: entry.qaStatus,
    };
  }

  const bLocal = path.join(process.cwd(), 'outputs', 'stage0-experiment', ORDER_ID, 'B.png');
  if (fs.existsSync(bLocal)) {
    fs.copyFileSync(bLocal, path.join(OUT_DIR, 'canonical-B.png'));
  } else {
    await download(canonical.url, path.join(OUT_DIR, 'canonical-B.png'));
  }

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'README.md'),
    [
      '# Mia expression mini-sheet',
      '',
      'Generated from approved Candidate B anchor (not raw photo).',
      '',
      'Review each PNG. If OK:',
      '`npx tsx --require ./scripts/shims/register-server-only.cjs scripts/approve-mia-expression-sheet.ts`',
      '',
      'Then rerun page 8 only, then full 5-page gate.',
    ].join('\n')
  );

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
