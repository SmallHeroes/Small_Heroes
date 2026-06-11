/**
 * Book color normalization — writes normalized/ alongside raw/ (raw never overwritten).
 *
 *   npx tsx scripts/normalize-book-colors.ts --orderId cmq8gafgs00004wq0b4nbb4x9
 *
 * Default ON (BOOK_COLOR_NORMALIZE=false to skip). Also runs automatically after
 * bunny smoke/full renders when outputDir is .../raw.
 */
import fs from 'fs';
import path from 'path';

import {
  buildRawVsNormalizedContactSheet,
  isBookColorNormalizeEnabled,
  normalizeRawDirToNormalized,
} from '../lib/book-color-normalize';

function parseOrderId(argv: string[]): string {
  let orderId = 'cmq8gafgs00004wq0b4nbb4x9';
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--orderId' || argv[i] === '--order') && argv[i + 1]) {
      orderId = argv[++i];
    }
  }
  return orderId;
}

function imageRootForOrder(orderId: string): string {
  return path.join(process.cwd(), 'outputs', 'bunny-full-render-images');
}

async function main(): Promise<void> {
  if (!isBookColorNormalizeEnabled()) {
    console.error(
      '[normalize-book-colors] BOOK_COLOR_NORMALIZE is OFF. Set BOOK_COLOR_NORMALIZE=true or unset (default ON).'
    );
    process.exit(1);
  }

  const orderId = parseOrderId(process.argv.slice(2));
  const root = imageRootForOrder(orderId);
  const rawDir = path.join(root, 'raw');
  const normalizedDir = path.join(root, 'normalized');

  const files = await normalizeRawDirToNormalized({ rawDir, normalizedDir });

  console.log(`[normalize-book-colors] order=${orderId} files=${files.length}`);
  console.log(`[normalize-book-colors] raw preserved → ${rawDir}`);
  console.log(`[normalize-book-colors] writing normalized → ${normalizedDir}`);

  for (const file of files) {
    console.log(`[normalize-book-colors] ${file}`);
  }

  const contactPath = path.join(root, 'contact-sheet-raw-vs-normalized.png');
  await buildRawVsNormalizedContactSheet({ rawDir, normalizedDir, outPath: contactPath, files });

  const md = [
    '# Book color normalization — contact sheet',
    '',
    `Order: \`${orderId}\``,
    `Generated: ${new Date().toISOString()}`,
    '',
    '**Left column = raw** · **Right column = normalized** (grey-world WB + warm bias + sat 0.92)',
    '',
    `![contact sheet](contact-sheet-raw-vs-normalized.png)`,
    '',
    '| File | raw | normalized |',
    '|------|-----|------------|',
    ...files.map((f) => `| ${f} | [raw](raw/${f}) | [normalized](normalized/${f}) |`),
  ].join('\n');
  fs.writeFileSync(path.join(root, 'CONTACT-SHEET.md'), md, 'utf8');

  console.log(`[normalize-book-colors] contact sheet → ${contactPath}`);
  console.log('[normalize-book-colors] DONE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
