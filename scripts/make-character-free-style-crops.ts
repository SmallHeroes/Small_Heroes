/**
 * Task 5 (bunny forensics brief): build CHARACTER-FREE style reference candidates
 * by cropping environment/texture regions out of the existing Style 01 refs.
 * No image generation — zero spend. Originals are archived unmodified.
 *
 * Output: style-references/01/_candidates/  (Guy must eyeball-approve before
 * these are moved into style-references/01/ and the subset map is flipped).
 *
 * Usage: npx tsx scripts/make-character-free-style-crops.ts
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const REF_DIR = path.join(process.cwd(), 'style-references', '01');
const ARCHIVE_DIR = path.join(REF_DIR, '_archive');
const CANDIDATES_DIR = path.join(REF_DIR, '_candidates');

const ORIGINALS = [
  'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
  'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
  'ChatGPT Image May 18, 2026, 11_59_17 AM.png',
  'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
  'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
  'ChatGPT Image May 18, 2026, 12_12_02 PM.png',
  'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
];

/** Crops chosen to contain watercolor technique/palette/paper texture ONLY — no children, no creatures. */
const CROPS: Array<{
  source: string;
  out: string;
  // fractions of width/height
  left: number;
  top: number;
  width: number;
  height: number;
  note: string;
}> = [
  {
    source: 'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
    out: 'style01-texture-night-window.png',
    left: 0.58,
    top: 0.0,
    width: 0.42,
    height: 0.3,
    note: 'curtain + night sky + moon + rooftops (owl excluded)',
  },
  {
    source: 'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
    out: 'style01-texture-stream-rocks.png',
    left: 0.0,
    top: 0.66,
    width: 1.0,
    height: 0.34,
    note: 'bridge underside + stream + rocks + greenery',
  },
  {
    source: 'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
    out: 'style01-texture-porch-lavender.png',
    left: 0.0,
    top: 0.0,
    width: 0.34,
    height: 0.4,
    note: 'window + ivy + lavender pot + stone wall',
  },
  {
    source: 'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
    out: 'style01-texture-night-mountains.png',
    left: 0.04,
    top: 0.02,
    width: 0.5,
    height: 0.42,
    note: 'moon + clouds + mountain peaks (girl + bat excluded)',
  },
];

async function main() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

  for (const name of ORIGINALS) {
    const src = path.join(REF_DIR, name);
    const dst = path.join(ARCHIVE_DIR, name);
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }
  console.log(`[style-crops] archived ${ORIGINALS.length} originals → ${ARCHIVE_DIR}`);

  for (const crop of CROPS) {
    const srcPath = path.join(REF_DIR, crop.source);
    const meta = await sharp(srcPath).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    const region = {
      left: Math.round(W * crop.left),
      top: Math.round(H * crop.top),
      width: Math.round(W * crop.width),
      height: Math.round(H * crop.height),
    };
    const outPath = path.join(CANDIDATES_DIR, crop.out);
    await sharp(srcPath).extract(region).png().toFile(outPath);
    console.log(`[style-crops] ${crop.out} ← ${crop.source} ${JSON.stringify(region)} (${crop.note})`);
  }
  console.log('[style-crops] done — Guy must eyeball _candidates/ before adoption.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
