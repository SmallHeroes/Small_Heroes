/**
 * Stage 0 anchor-only A/B/C/D experiment (no paid pages).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-stage0-anchor-experiment.ts <orderId>
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-stage0-anchor-experiment.ts <orderId>'
    );
    process.exit(1);
  }

  process.env.GENERATION_ANCHOR_EXPERIMENT = 'true';

  const { prisma } = await import('@/lib/prisma');
  const { listStyle01ChildTemplateStatus } = await import('@/lib/style01-child-template');
  const {
    formatExperimentMarkdownReport,
    runStage0AnchorExperimentGrid,
  } = await import('@/lib/generation-pipeline/stage0-anchor-experiment');
  const { resolveStyle01StoryWardrobeLock } = await import('@/lib/style01-story-wardrobe');
  const { resolveCompanionForOrder } = await import('@/lib/generation-pipeline/anchor-registry');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.childImageUrl) throw new Error(`Order or childImageUrl missing: ${orderId}`);

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
  const dna = cache.dna as Record<string, unknown> | undefined;
  const childStructured = dna?.childStructured as { hair?: string } | undefined;

  const templates = listStyle01ChildTemplateStatus();
  if (!templates.girl && order.childGender !== 'boy') {
    console.warn('[stage0_experiment] girl template missing — run generate-style01-child-template.ts girl');
  }

  const companion = resolveCompanionForOrder(order);
  const wardrobeLock = resolveStyle01StoryWardrobeLock(companion?.id) ?? '';

  const input = {
    order,
    childPhotoUrl: order.childImageUrl,
    lockedChildDescription:
      (cache.lockedChildDescription as string) ?? (dna?.childDNA as string) ?? '',
    childPhotoDescription: (cache.childPhotoDescription as string | null) ?? null,
    childStructuredHair: childStructured?.hair ?? null,
    wardrobeLock,
  };

  if (!input.lockedChildDescription.trim()) {
    throw new Error('Pipeline cache missing lockedChildDescription — run DNA stage first');
  }

  const results = await runStage0AnchorExperimentGrid(input);
  const outDir = path.join(process.cwd(), 'outputs', 'stage0-experiment', orderId);
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'report.json');
  const mdPath = path.join(outDir, 'report.md');
  const summary = results.map((r) => ({
    variant: r.variant,
    label: r.label,
    imageUrl: r.imageUrl,
    referenceOrderLabels: r.referenceOrderLabels,
    referenceMode: r.referenceMode,
    rawPhotoInEdit: r.rawPhotoInEdit,
    apiMode: r.apiMode,
    resemblanceScore: r.resemblanceScore,
    pageThreshold: r.pageThreshold,
    embeddingVerdict: r.embeddingVerdict,
    embeddingNote: r.embeddingNote,
    styleQa: r.styleQa,
    semanticOk: r.semantic.ok,
    judgment: r.judgment,
    prompt: r.prompt,
  }));

  fs.writeFileSync(jsonPath, JSON.stringify({ orderId, templates, summary }, null, 2));
  fs.writeFileSync(mdPath, formatExperimentMarkdownReport(orderId, results));

  console.log(JSON.stringify({ orderId, outDir, jsonPath, mdPath, summary }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
