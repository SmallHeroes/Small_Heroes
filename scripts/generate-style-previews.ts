/**
 * Generate style preview images for the wizard style picker.
 * Same child+fox scene rendered in each active style so users can compare.
 *
 * Style 01: GPT Image — cute Pixar-watercolor (soft_hand_drawn_storybook)
 * Style 02: GPT Image — realistic fine-art painting (expressive_painterly_storybook)
 *           ↑ only generates when --style02 flag is passed (wait until realism verified)
 *
 * Usage:
 *   npx tsx scripts/generate-style-previews.ts          # Style 01 only
 *   npx tsx scripts/generate-style-previews.ts --style02 # Both styles
 *   npx tsx scripts/generate-style-previews.ts --all     # Both styles
 */

import 'dotenv/config';
import { generateGPTImage } from '../lib/generate-image';
import { getStyleContract, STYLE_IDS } from '../lib/styles';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

// Same scene for both — a child with a small fox, warm and inviting
const SCENE = `A 5-year-old girl with curly dark brown shoulder-length hair, olive skin, and big brown eyes sits on a grassy hillside. She wears a soft yellow dress. A small friendly orange fox sits beside her, looking up. Gentle golden-hour light, blue sky with soft clouds. The girl has a calm happy expression. NOT sad.`;

const NEGATIVE = 'text, letters, words, numbers, watermark, signature, frame, border, sad expression, crying, tears';

interface StyleTarget {
  id: string;
  file: string;
  label: string;
  skip?: boolean;
  skipReason?: string;
}

const includeStyle02 = process.argv.includes('--style02') || process.argv.includes('--all');

const TARGETS: StyleTarget[] = [
  {
    id: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    file: 'public/art-styles/simple.jpg',
    label: 'Style 01 — Cute Pixar-watercolor',
  },
  {
    id: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
    file: 'public/art-styles/classic.jpg',
    label: 'Style 02 — Realistic Fine-Art Painting',
    skip: !includeStyle02,
    skipReason: 'Style 02 realism not yet verified. Pass --style02 to generate.',
  },
];

async function generatePreview(target: StyleTarget) {
  if (target.skip) {
    console.log(`\n[skip] ${target.label}`);
    console.log(`  Reason: ${target.skipReason}`);
    return;
  }

  console.log(`\n═══ ${target.label} ═══`);

  const contract = getStyleContract(target.id);
  const styleDesc = contract.renderingDescription;
  const styleNudge = contract.imageNudge?.lines?.[0] ?? '';

  const prompt = [
    SCENE,
    'Wide shot, character in the scene with environment visible.',
    'Top 25-30% must be a calmer, lighter area for text overlay.',
    `${styleDesc}. ${styleNudge}`,
    'No text, no letters, no words, no UI elements.',
  ].join('\n\n');

  console.log(`[style] ${contract.id}`);
  console.log(`[rendering] ${styleDesc.slice(0, 120)}...`);
  console.log(`[prompt] len=${prompt.length}`);

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: NEGATIVE,
    size: '1024x1024', // square for style picker cards
    quality: 'high',   // high quality for the preview — users see this first
  });

  const outPath = join(process.cwd(), target.file);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, result.buffer);
  console.log(`[saved] ${target.file} (${Math.round(result.buffer.length / 1024)} KB, ${result.durationMs}ms)`);
}

async function main() {
  console.log('═══ Style Preview Generation — GPT Image ═══');
  console.log(`Generating: ${TARGETS.filter(t => !t.skip).map(t => t.label).join(', ')}`);
  if (TARGETS.some(t => t.skip)) {
    console.log(`Skipping: ${TARGETS.filter(t => t.skip).map(t => t.label).join(', ')}`);
  }

  for (const target of TARGETS) {
    try {
      await generatePreview(target);
    } catch (err) {
      console.error(`  ✗ Failed ${target.label}: ${(err as Error).message}`);
    }
  }

  console.log('\n═══ Done ═══');
}

main().catch((e) => { console.error(e); process.exit(1); });
