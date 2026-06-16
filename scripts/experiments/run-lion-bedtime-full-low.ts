/**
 * Full lion_shaket bedtime LOW render (8 beats), Bar + approved Stage 0 anchor.
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/experiments/run-lion-bedtime-full-low.ts
 */
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import '../shims/register-server-only.cjs';

import { runQaConsoleRender } from '../../lib/qa-console-run';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');
const PAGES = [1, 2, 3, 4, 5, 6, 7, 8];

async function main(): Promise<void> {
  const buf = readFileSync(BAR_PHOTO);
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
    runLabelPrefix: 'qa-console-lion_shaket-bedtime-low-full',
  });

  console.log('\n=== Full lion bedtime LOW render complete ===');
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
