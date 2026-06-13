/**
 * Selective LOW reroll — object-fix proof pages only.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-slot01-selective-reroll-object-fix.ts [--orderId fee7e6a7-...]
 */
import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const PAGES = '1,2,3,4,6,8,10,11';
const OUT_ROOT = path.join(process.cwd(), 'outputs', 'sprint-11-runs', 'slot01-object-fix-reroll');
const RAW_DIR = path.join(OUT_ROOT, 'raw');
const ORDER_DEFAULT = 'fee7e6a7-c069-4b74-b006-5a2395ea95b6';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main(): Promise<void> {
  const orderId = flag('--orderId')?.trim() || ORDER_DEFAULT;
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.PAGE_REF_MANIFEST_DIR = path.join(OUT_ROOT, 'ref-manifests');
  fs.mkdirSync(process.env.PAGE_REF_MANIFEST_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const { prisma } = await import('@/lib/prisma');
  const { parsePipelineCache } = await import('@/lib/generation-pipeline/helpers');
  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (job) {
    const cache = parsePipelineCache(job.pipelineCache);
    delete (cache as { storyLocationPlan?: unknown }).storyLocationPlan;
    await prisma.generationJob.update({
      where: { orderId },
      data: { pipelineCache: cache },
    });
    console.log('[object-fix] cleared storyLocationPlan cache for fresh sidecar');
  }
  await prisma.$disconnect();

  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    orderId,
    '--pages',
    PAGES,
    '--quality',
    'low',
    '--outputDir',
    RAW_DIR,
    '--bankFile',
    BANK_FILE,
    '--rerender',
  ];

  console.log(`[object-fix] selective reroll p${PAGES} → ${RAW_DIR}`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  console.log('');
  console.log('=== OBJECT-FIX SELECTIVE REROLL COMPLETE ===');
  console.log(`orderId=${orderId} pages=${PAGES}`);
  console.log(`raw → ${RAW_DIR}`);
  console.log(`manifests → ${process.env.PAGE_REF_MANIFEST_DIR}`);
  console.log('STOP for Guy + Claude eyeball — matrix NOT flipped.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
