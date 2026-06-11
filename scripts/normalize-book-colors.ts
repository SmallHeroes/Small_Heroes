/**
 * EXPERIMENTAL book color / WB normalization — default OFF, never overwrites raw/.
 *
 *   BOOK_COLOR_NORMALIZE=true npx tsx scripts/normalize-book-colors.ts --orderId cmq8gafgs00004wq0b4nbb4x9
 *
 * Writes normalized copies to outputs/bunny-full-render-images/normalized/
 * and a raw-vs-normalized contact sheet for eyeball review.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const BOOK_COLOR_NORMALIZE_DEFAULT = false;

function envNormalizeEnabled(): boolean {
  const raw = process.env.BOOK_COLOR_NORMALIZE?.trim().toLowerCase();
  if (!raw) return BOOK_COLOR_NORMALIZE_DEFAULT;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

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

async function greyWorldRecomb(input: Buffer): Promise<Buffer> {
  const stats = await sharp(input).stats();
  const means = stats.channels.map((c) => Math.max(c.mean, 1));
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const scales = means.map((m) => Math.min(1.35, Math.max(0.75, avg / m)));
  return sharp(input)
    .recomb([
      [scales[0], 0, 0],
      [0, scales[1], 0],
      [0, 0, scales[2]],
    ])
    .modulate({ saturation: 0.92 })
    .png()
    .toBuffer();
}

async function buildContactSheet(args: {
  rawDir: string;
  normalizedDir: string;
  outPath: string;
  files: string[];
}): Promise<void> {
  const tileW = 360;
  const tileH = 450;
  const labelH = 28;
  const rowH = tileH + labelH;
  const cols = 2;
  const rows = args.files.length;
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < args.files.length; i++) {
    const file = args.files[i];
    const y = i * rowH;
    const rawPath = path.join(args.rawDir, file);
    const normPath = path.join(args.normalizedDir, file);
    const rawTile = await sharp(rawPath)
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    const normTile = await sharp(normPath)
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    composites.push({ input: rawTile, left: 0, top: y });
    composites.push({ input: normTile, left: tileW, top: y });
  }

  await sharp({
    create: {
      width: tileW * cols,
      height: rowH * rows,
      channels: 3,
      background: '#f4efe3',
    },
  })
    .composite(composites)
    .png()
    .toFile(args.outPath);
}

async function main(): Promise<void> {
  if (!envNormalizeEnabled()) {
    console.error(
      '[normalize-book-colors] BOOK_COLOR_NORMALIZE is OFF (default). Set BOOK_COLOR_NORMALIZE=true to run this experiment.'
    );
    process.exit(1);
  }

  const orderId = parseOrderId(process.argv.slice(2));
  const root = imageRootForOrder(orderId);
  const rawDir = path.join(root, 'raw');
  const normalizedDir = path.join(root, 'normalized');

  if (!fs.existsSync(rawDir)) {
    throw new Error(`raw/ missing: ${rawDir} — run full render first`);
  }

  const files = fs
    .readdirSync(rawDir)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => {
      if (a === 'cover.png') return -1;
      if (b === 'cover.png') return 1;
      const na = Number.parseInt(a.replace(/\D/g, ''), 10);
      const nb = Number.parseInt(b.replace(/\D/g, ''), 10);
      return na - nb;
    });

  if (files.length === 0) {
    throw new Error(`no PNG files in ${rawDir}`);
  }

  fs.mkdirSync(normalizedDir, { recursive: true });

  console.log(`[normalize-book-colors] order=${orderId} files=${files.length}`);
  console.log(`[normalize-book-colors] raw preserved → ${rawDir}`);
  console.log(`[normalize-book-colors] writing normalized → ${normalizedDir}`);

  for (const file of files) {
    const src = path.join(rawDir, file);
    const dest = path.join(normalizedDir, file);
    const input = fs.readFileSync(src);
    const output = await greyWorldRecomb(input);
    fs.writeFileSync(dest, output);
    console.log(`[normalize-book-colors] ${file}`);
  }

  const contactPath = path.join(root, 'contact-sheet-raw-vs-normalized.png');
  await buildContactSheet({ rawDir, normalizedDir, outPath: contactPath, files });

  const md = [
    '# Book color normalization — contact sheet (EXPERIMENT)',
    '',
    `Order: \`${orderId}\``,
    `Generated: ${new Date().toISOString()}`,
    '',
    '**Left column = raw** · **Right column = normalized** (grey-world WB + mild desaturation)',
    '',
    'BOOK_COLOR_NORMALIZE defaults OFF. Do not adopt without Guy+Claude+ChatGPT eyeball.',
    '',
    `![contact sheet](contact-sheet-raw-vs-normalized.png)`,
    '',
    '| File | raw | normalized |',
    '|------|-----|------------|',
    ...files.map(
      (f) => `| ${f} | [raw](raw/${f}) | [normalized](normalized/${f}) |`
    ),
  ].join('\n');
  fs.writeFileSync(path.join(root, 'CONTACT-SHEET.md'), md, 'utf8');

  console.log(`[normalize-book-colors] contact sheet → ${contactPath}`);
  console.log('[normalize-book-colors] DONE (experiment only — not production default)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
