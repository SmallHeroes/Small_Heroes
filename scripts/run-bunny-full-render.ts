/**
 * Diagnostic FULL 8-page LOW render — cover kept from smoke #2, all interior pages re-rendered.
 * Parks before audio/package (CHUNKED_IMAGE_PAGE_FILTER). STOP for eyeball.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-bunny-full-render.ts --orderId cmq8gafgs00004wq0b4nbb4x9
 */
import { spawnSync } from 'child_process';
import path from 'path';

const DEFAULT_ORDER = 'cmq8gafgs00004wq0b4nbb4x9';
const ALL_PAGES = '1,2,3,4,5,6,7,8';
const OUTPUT_DIR = 'outputs/bunny-full-render-images/raw';

function parseOrderId(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--orderId' || argv[i] === '--order') && argv[i + 1]) {
      return argv[++i];
    }
    if (!argv[i].startsWith('--')) return argv[i];
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
    `cover,${ALL_PAGES}`,
    '--quality',
    'low',
    '--outputDir',
    OUTPUT_DIR,
    '--keep-cover',
    '--rerender',
  ];

  console.log(`[full-render] order=${orderId} pages=${ALL_PAGES} cover=keep quality=LOW`);
  console.log(`[full-render] output → ${OUTPUT_DIR}/`);
  console.log(`[full-render] invoking smoke driver…`);

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
  console.log('=== FULL DIAGNOSTIC RENDER COMPLETE ===');
  console.log(`RAW originals → ${OUTPUT_DIR}/ (cover + p1–p8)`);
  console.log('Job parked before audio/package. STOP for eyeball.');
}

main();
