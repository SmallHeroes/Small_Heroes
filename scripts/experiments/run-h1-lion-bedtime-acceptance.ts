/**
 * H1 acceptance â€” lion_shaket bedtime LOW, Bar photo, pages 1/2/4/6/7.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/experiments/run-h1-lion-bedtime-acceptance.ts
 */
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import '../shims/register-server-only.cjs';

import { runQaConsoleRender } from '../../lib/qa-console-run';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');
const PAGES = [1, 2, 4, 6, 7];

async function main(): Promise<void> {
  const buf = readFileSync(BAR_PHOTO);
  // Pass raw PNG â€” qa-console-run normalizes once (matches approved anchor fingerprint).
  const photoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;

  const result = await runQaConsoleRender({
    storyKey: 'lion_shaket_bedtime',
    pages: PAGES,
    child: {
      name: '×‘×¨',
      gender: 'boy',
      age: 5,
      photoDataUrl,
    },
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'qa-console-lion_shaket-bedtime-low-h1',
  });

  console.log('\n=== H1 acceptance render complete ===');
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Rendered: ${result.renderedPageNumbers.join(', ')}`);
  console.log(`Failed: ${result.failedPages.length ? result.failedPages.join(', ') : 'none'}`);
  console.log(`Cost est: $${result.estimatedCostUsd.toFixed(3)}`);
  console.log(`Preview: http://localhost:3000${result.previewUrl}`);

  if (result.failedPages.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
