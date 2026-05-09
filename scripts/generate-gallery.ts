/**
 * Generate gallery showcase images for the landing page.
 * Generates BOTH styles — Style 01 (illustrated) and Style 02 (realistic watercolor).
 *
 * Same 6 scenes rendered in each style:
 *   Style 01 → gallery-1.jpg ... gallery-6.jpg
 *   Style 02 → gallery-r-1.jpg ... gallery-r-6.jpg
 *
 * Usage:
 *   npx tsx scripts/generate-gallery.ts             # both styles (12 images)
 *   npx tsx scripts/generate-gallery.ts --style01    # Style 01 only (6 images)
 *   npx tsx scripts/generate-gallery.ts --style02    # Style 02 only (6 images)
 *
 * Generates to public/Images/gallery/. Uses 1024x1536 portrait format.
 */

import 'dotenv/config';
import { generateGPTImage } from '../lib/generate-image';
import { getStyleContract, STYLE_IDS } from '../lib/styles';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUT_DIR = 'public/Images/gallery';
const NEGATIVE = 'text, letters, words, numbers, watermark, signature, frame, border, sad expression, crying, tears';

const onlyStyle01 = process.argv.includes('--style01');
const onlyStyle02 = process.argv.includes('--style02');
const doStyle01 = !onlyStyle02;
const doStyle02 = !onlyStyle01;

/**
 * Each scene is a standalone children's book moment — diverse kids,
 * diverse settings, emotionally warm.
 *
 * IMPORTANT: These prompts use TIGHT PORTRAIT FRAMING matching our
 * production framingDirective. Character fills 60-70% of image.
 * Backgrounds dissolve into soft watercolor washes.
 */
const SCENES = [
  {
    scene: 'Close-up portrait of a 5-year-old boy with short brown hair and olive skin, hugging a soft teddy bear to his chest. His eyes are half-closed, content and safe. Warm golden nightlight glow on his face. Background dissolves into soft cream and amber watercolor washes. Character fills 65% of the frame.',
  },
  {
    scene: 'Close-up portrait of a 4-year-old girl with curly dark hair and brown skin, face lit by golden light from below, looking up with wide-eyed wonder and a delighted smile. A single golden butterfly rests on her outstretched finger. Background dissolves into soft green and gold watercolor washes with hints of forest. Character fills 60% of the frame.',
  },
  {
    scene: 'Close-up portrait of a 5-year-old boy with red hair and freckles, peeking out from a blanket fort. Small fairy lights create warm bokeh dots around him. His face shows a playful mischievous grin. Background dissolves into soft purple and blue watercolor washes. Character fills 65% of the frame.',
  },
  {
    scene: 'Close-up portrait of a 6-year-old girl with black braids and dark skin, kneeling in a garden, gently cupping a small ladybug in her hands. She looks down at it with tender curiosity. Warm afternoon light on her face. Background dissolves into soft green and golden watercolor washes. Character fills 60% of the frame.',
  },
  {
    scene: 'Close-up portrait of a 5-year-old girl with straight black hair and light skin, a ginger cat nuzzled against her cheek. Raindrops on a window behind create soft bokeh. She has a peaceful, calm expression. Background dissolves into soft blue-grey and warm amber watercolor washes. Character fills 65% of the frame.',
  },
  {
    scene: 'Close-up portrait of a 6-year-old boy with dark curly hair wearing a homemade red cape, chin lifted, looking brave and confident. Golden hour light catches his hair and cape. Wind-swept. Background dissolves into warm sunset orange and pink watercolor washes. Character fills 60% of the frame.',
  },
];

interface StyleConfig {
  id: string;
  label: string;
  filePrefix: string; // '' for Style 01, 'r-' for Style 02
}

const STYLES: StyleConfig[] = [];
if (doStyle01) {
  STYLES.push({ id: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK, label: 'Style 01 — Illustrated', filePrefix: '' });
}
if (doStyle02) {
  STYLES.push({ id: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK, label: 'Style 02 — Realistic Watercolor', filePrefix: 'r-' });
}

async function generateScene(
  sceneText: string,
  sceneIndex: number,
  style: StyleConfig,
  totalScenes: number,
) {
  const contract = getStyleContract(style.id);
  const styleDesc = contract.renderingDescription;
  const styleNudge = contract.imageNudge?.lines?.[0] ?? '';

  const filename = `gallery-${style.filePrefix}${sceneIndex + 1}.jpg`;
  console.log(`\n[${style.label}] ${filename}`);
  console.log(`  Scene: ${sceneText.slice(0, 80)}...`);

  const prompt = [
    // Framing FIRST — models weight prompt start most heavily
    'COMPOSITION & FRAMING: Medium-close portrait framing — the character fills 60-70% of the image area. Do NOT show the full room, full landscape, or wide establishing shot. Show the character and only the immediately relevant details. Background dissolves into soft abstract watercolor washes — NOT a fully rendered environment. Like a warm portrait with story context, not a landscape with a person in it.',
    sceneText,
    'Top 20-25% should be a calmer, lighter area — soft cream or warm light wash — suitable for text overlay.',
    `${styleDesc}. ${styleNudge}`,
    'No text, no letters, no words, no numbers, no UI elements. No sad expression, no crying, no tears.',
  ].join('\n\n');

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: NEGATIVE,
    size: '1024x1536',
    quality: 'medium', // medium to save cost — still good for gallery thumbnails
  });

  const outPath = join(OU