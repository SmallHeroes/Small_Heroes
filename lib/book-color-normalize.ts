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

/** Max per-page luminance catch vs book mean (conservative — skin/hair/fur safe). */
export const BOOK_TONE_LUMINANCE_CATCH_MAX = 0.08;
/** Max warmth shift per channel in tone catch. */
export const BOOK_TONE_WARMTH_CATCH_MAX = 0.06;

export type BookImageToneStats = {
  luminance: number;
  warmth: number;
};

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

export async function measureImageToneStats(input: Buffer): Promise<BookImageToneStats> {
  const stats = await sharp(input).stats();
  const r = stats.channels[0].mean / 255;
  const g = stats.channels[1].mean / 255;
  const b = Math.max(stats.channels[2].mean / 255, 0.01);
  return {
    luminance: (r + g + b) / 3,
    warmth: r / b,
  };
}

export async function computeBookAverageToneStats(buffers: Buffer[]): Promise<BookImageToneStats> {
  if (buffers.length === 0) {
    return { luminance: 0.5, warmth: 1 };
  }
  const stats = await Promise.all(buffers.map(measureImageToneStats));
  return {
    luminance: stats.reduce((sum, s) => sum + s.luminance, 0) / stats.length,
    warmth: stats.reduce((sum, s) => sum + s.warmth, 0) / stats.length,
  };
}

/** Mild luminance/warmth catch toward book average — after prompt lighting-lock + color normalize. */
export async function applyBookToneCatch(
  input: Buffer,
  bookAverage: BookImageToneStats
): Promise<Buffer> {
  const page = await measureImageToneStats(input);
  const lumDelta = bookAverage.luminance - page.luminance;
  const warmDelta = bookAverage.warmth - page.warmth;
  const lumFactor =
    1 + Math.max(-BOOK_TONE_LUMINANCE_CATCH_MAX, Math.min(BOOK_TONE_LUMINANCE_CATCH_MAX, lumDelta * 0.35));
  const warmShift = Math.max(
    -BOOK_TONE_WARMTH_CATCH_MAX,
    Math.min(BOOK_TONE_WARMTH_CATCH_MAX, (warmDelta - 1) * 0.25)
  );
  const warmR = 1 + warmShift;
  const warmB = 1 - warmShift * 0.6;
  return sharp(input)
    .modulate({ brightness: lumFactor })
    .recomb([
      [warmR, 0, 0],
      [0, 1, 0],
      [0, 0, warmB],
    ])
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
  const rawBuffers = files.map((file) => fs.readFileSync(path.join(rawDir, file)));
  const bookToneTarget = await computeBookAverageToneStats(rawBuffers);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const colorNormalized = await applyBookColorNormalize(rawBuffers[i]);
    const output = await applyBookToneCatch(colorNormalized, bookToneTarget);
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
