/**
 * Style Comparison — generates the SAME scene with both styles via GPT Image:
 *   Style 01 (soft_hand_drawn_storybook — cute Pixar-watercolor)
 *   Style 02 (expressive_painterly_storybook — realistic artistic watercolor)
 *
 * Both use GPT Image, differentiated by style contract renderingDescription.
 *
 * Usage:
 *   npx tsx scripts/test-style-comparison.ts
 */

import 'dotenv/config';
import { generateGPTImage } from '../lib/generate-image';
import { getStyleContract, STYLE_IDS } from '../lib/styles';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUT_DIR = 'test-outputs/style-comparison';

// ── SCENE — change this to test different compositions ──
const SCENE = `A 5-year-old girl sits on her bed in a dim bedroom at night. She holds a small orange fox plushie against her chest. The bedroom door is half-open, casting a strip of warm hallway light across the wooden floor. A blue blanket is bunched at her feet. She looks toward the door with wide curious eyes — NOT sad, NOT scared.`;

const CHILD_DESC = 'A 5-year-old girl with curly dark brown shoulder-length hair, olive skin, big brown eyes, wearing light blue pajamas with small star patterns';
const COMPANION_DESC = 'A small friendly orange fox with bright eyes and a fluffy tail';

async function generateWithStyle(styleId: string, label: string, filename: string) {
  console.log(`\n══════ ${label} ══════`);

  const contract = getStyleContract(styleId);
  const styleDesc = contract.renderingDescription;
  const nudge = contract.imageNudge?.lines?.[0] ?? '';

  const prompt = [
    SCENE,
    `Main character: ${CHILD_DESC}`,
    `Companion (must appear): ${COMPANION_DESC}`,
    'Wide shot, character in the scene with environment visible.',
    'Top 25-30% must be a calmer, lighter area for text overlay.',
    `${styleDesc}. ${nudge} No text, no letters, no UI.`,
  ].join('\n\n');

  console.log(`[style] ${contract.id}`);
  console.log(`[renderingDescription] ${styleDesc}`);
  console.log(`[prompt] len=${prompt.length}`);
  console.log('---');
  console.log(prompt);
  console.log('---');

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border, sad expression, crying, tears',
    size: '1024x1536',
    quality: 'high',
  });

  const outPath = join(OUT_DIR, filename);
  await writeFile(outPath, result.buffer);
  console.log(`[done] ${label} saved to ${outPath} (${Math.round(result.buffer.length / 1024)}KB, ${result.durationMs}ms)`);
  return outPath;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Generating same scene in both styles via GPT Image...');
  console.log(`Scene: "${SCENE.slice(0, 120)}..."`);
  console.log();

  try {
    // Run sequentially to see output clearly
    const path01 = await generateWithStyle(
      STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      'STYLE 01 — Cute Pixar-watercolor',
      'style01-cute-pixar.png'
    );

    const path02 = await generateWithStyle(
      STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
      'STYLE 02 — Realistic Warm Watercolor',
      'style02-realistic-watercolor.png'
    );

    console.log('\n══════ COMPARISON READY ══════');
    console.log(`Style 01 (Cute Pixar):              ${path01}`);
    console.log(`Style 02 (Realistic Watercolor):    ${path02}`);
    console.log('\nOpen both images side by side to compare.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
