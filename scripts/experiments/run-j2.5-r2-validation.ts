/**
 * J2.5-R2 validation: LOW p1/p2/p4/p6/p8 with approved fixed set board.
 * Usage:
 *   $env:SET_APPEARANCE_BOARD_HUMAN_APPROVED='true'
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/run-j2.5-r2-validation.ts
 */
import { readFileSync } from 'fs';
import path from 'path';

import '../shims/register-server-only.cjs';
import { runQaConsoleRender } from '../../lib/qa-console-run';

const BAR_PHOTO = path.join(process.cwd(), 'public', 'Images', 'Bar.png');

async function main(): Promise<void> {
  const buf = readFileSync(BAR_PHOTO);
  const result = await runQaConsoleRender({
    storyKey: 'lion_shaket_bedtime',
    pages: [1, 2, 4, 6, 8],
    child: {
      name: '×‘×¨',
      gender: 'boy',
      age: 5,
      photoDataUrl: `data:image/png;base64,${buf.toString('base64')}`,
    },
    quality: 'low',
    generateAudio: false,
    runLabelPrefix: 'qa-console-lion_shaket-bedtime-low-j2.5-r2',
    approveAnchorCacheKey: 'lion_shaket_bedtime__1da5fff624f87944__9383550a',
  });
  console.log(`J2.5-R2 â†’ ${result.manifestDir}`);
  console.log(`  rendered=${result.renderedPageNumbers.join(',')}`);
  console.log(`  failed=${result.failedPages.join(',') || 'none'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
