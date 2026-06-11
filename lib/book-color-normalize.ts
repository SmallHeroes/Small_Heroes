/**
 * Book page color normalization — grey-world WB, warm bias, mild desaturation.
 * Default ON; raw/ originals are never overwritten (normalized/ written alongside).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const BOOK_COLOR_NORMALIZE_DEFAULT = true;

/** Warm bias after grey-world WB (Guy-approved +5% warmth). */
export const BOOK_COLOR_WARM_R_SCALE = 1.05;
export const BOOK_COLOR_WARM_B_SCALE = 0.95;
export const BOOK_COLOR_SATURATION = 0.92;

export function isBookColorNormalizeEnabled(): boolean {
  const raw = process.env.BOOK_COLOR_NORMALIZE?.trim().toLowerCase();
  if (!raw) return BOOK_COLOR_NORMALIZE_DEFAULT;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Grey-world WB → warm bias → mild desaturation. */
export async function applyBookColorNormalize(input: Buffer): Promise<Buffer> {
  const stats = await sharp(input).stats();
  const means = stats.channels.map((c) => Math.max(c.mean, 1));
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const scales = means.map((m) => Math.min(1.35, Math.max(0.75, avg / m)));
  return sharp(input)
    .recomb([
      [scales[0] * BOOK_COLOR_WARM_R_SCALE, 0, 0],
      [0, scales[1], 0],
      [0, 0, scales[2] * BOOK_COLOR_WARM_B_SCALE],
    ])
    .modulate({ saturation: BOOK_COLOR_SATURATION })
    .png()
    .toBuffer();
}

export function sortBookPngFiles(files: string[]): string[] {
  return [...files]
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => {
      if (a === 'cover.png') return -1;
      if (b === 'cover.png') return 1;
      const na = Number.parseInt(a.replace(/\D/g, ''), 10);
      const nb = Number.parseInt(b.replace(/\D/g, ''), 10);
      return na - nb;
    });
}

export async function normalizeRawDirToNormalized(args: {
  rawDir: string;
  normalizedDir: string;
}): Promise<string[]> {
  const { rawDir, normalizedDir } = args;
  if (!fs.existsSync(rawDir)) {
    throw new Error(`raw/ missing: ${rawDir}`);
  }
  const files = sortBookPngFiles(fs.readdirSync(rawDir));
  if (files.length === 0) {
    throw new Error(`no PNG files in ${rawDir}`);
  }
  fs.mkdirSync(normalizedDir, { recursive: true });
  for (const file of files) {
    const input = fs.readFileSync(path.join(rawDir, file));
    const output = await applyBookColorNormalize(input);
    fs.writeFileSync(path.join(normalizedDir, file), output);
  }
  return files;
}

export async function buildRawVsNormalizedContactSheet(args: {
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
    const rawTile = await sharp(path.join(args.rawDir, file))
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    const normTile = await sharp(path.join(args.normalizedDir, file))
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
