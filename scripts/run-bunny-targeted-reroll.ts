/**
 * Targeted page reroll — bunny book p2/p4/p5/p8 @ LOW. Backs up superseded PNGs first.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-bunny-targeted-reroll.ts
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ORDER_ID = 'cmq8gafgs00004wq0b4nbb4x9';
const PAGES = [2, 4, 5, 8];
const RAW_DIR = path.join(process.cwd(), 'outputs', 'bunny-full-render-images', 'raw');
const SUPERSEDED_DIR = path.join(RAW_DIR, '_superseded');

function backupSuperseded(): void {
  fs.mkdirSync(SUPERSEDED_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const n of PAGES) {
    const name = `p${n}.png`;
    const src = path.join(RAW_DIR, name);
    if (!fs.existsSync(src)) {
      console.warn(`[reroll] skip backup — missing ${name}`);
      continue;
    }
    const dest = path.join(SUPERSEDED_DIR, `${stamp}-${name}`);
    fs.copyFileSync(src, dest);
    console.log(`[reroll] backed up ${name} → _superseded/${path.basename(dest)}`);
  }
}

function main(): void {
  backupSuperseded();

  const smokeScript = path.join(__dirname, 'run-bunny-smoke-render.ts');
  const args = [
    '--env-file=.env.local',
    '--require',
    './scripts/shims/register-server-only.cjs',
    smokeScript,
    '--orderId',
    ORDER_ID,
    '--pages',
    PAGES.join(','),
    '--quality',
    'low',
    '--outputDir',
    RAW_DIR,
    '--keep-cover',
    '--rerender',
  ];

  console.log(`[reroll] order=${ORDER_ID} pages=${PAGES.join(',')} quality=LOW`);
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log('');
  console.log('=== TARGETED REROLL COMPLETE (p2, p4, p5, p8) ===');
  console.log(`Updated → ${RAW_DIR}/`);
  console.log(`Superseded copies → ${SUPERSEDED_DIR}/`);
  console.log('STOP for eyeball of the 4 pages.');
}

main();
