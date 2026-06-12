/**
 * Export order + pipeline cache for offline Phase A calibration (--fixture).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/export-phase-a-fixture.ts [orderId] [out.json]
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { parsePipelineCache } from '../lib/generation-pipeline/helpers';

const orderId = process.argv[2]?.trim() || 'cmq8gafgs00004wq0b4nbb4x9';
const outPath =
  process.argv[3]?.trim() ||
  path.join(process.cwd(), 'outputs', 'phase-a-calibration', 'bunny-anchor-fixture.json');

async function main(): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order ${orderId} not found`);
  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!job) throw new Error(`GenerationJob missing for ${orderId}`);

  const cache = parsePipelineCache(job.pipelineCache);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        order: {
          id: order.id,
          childName: order.childName,
          childAge: order.childAge,
          childGender: order.childGender,
          childImageUrl: order.childImageUrl,
          illustrationStyle: order.illustrationStyle,
          characterAnchors: order.characterAnchors,
          topic: order.topic,
          storyDirection: order.storyDirection,
        },
        pipelineCache: cache,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`[export-phase-a-fixture] wrote ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
