/**
 * Slot #1 location smoke reroll — cover + p5 + p10 @ LOW.
 * Verifies LocationBible constrains worst drift pages before full rerender.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-slot01-location-smoke-rerender.ts --orderId <existing>
 */
import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'child_process';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

const DEFAULT_ORDER = 'fee7e6a7-c069-4b74-b006-5a2395ea95b6';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');
const OUTPUT_DIR = path.join(
  process.cwd(),
  'outputs',
  'sprint-11-runs',
  'slot01-location-smoke',
  'raw'
);

function parseOrderId(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--orderId' || argv[i] === '--order') && argv[i + 1]) {
      return argv[++i];
    }
  }
  return DEFAULT_ORDER;
}

function main(): void {
  const orderId = parseOrderId(process.argv.slice(2));
  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    orderId,
    '--pages',
    'cover,5,10',
    '--quality',
    'low',
    '--outputDir',
    OUTPUT_DIR,
    '--bankFile',
    BANK_FILE,
    '--rerender',
  ];

  process.env.GPT_IMAGE_QUALITY = 'low';
  console.log(`[location-smoke] order=${orderId} pages=cover,p5,p10 quality=LOW`);
  console.log(`[location-smoke] output → ${OUTPUT_DIR}/`);

  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);

  console.log('');
  console.log('=== LOCATION SMOKE REROLL COMPLETE (cover + p5 + p10) ===');
  console.log('STOP for Guy + Claude eyeball on location continuity.');
  console.log('If PASS → full LOW rerender via run-slot01-fox-full-render.ts');
}

main();
