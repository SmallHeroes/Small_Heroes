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
 */
const SCENES = [
  {
    scene: 'A 5-year-old boy with short brown hair and olive skin sits on his bed at night, hugging a soft teddy bear close to his chest. A warm nightlight casts golden light across cozy blankets. He looks content and safe — NOT sad.',
  },
  {
    scene: 'A 4-year-old girl with curly dark hair and brown skin stands in a magical forest clearing. Golden butterflies float around her. Dappled sunlight through tall trees. She has a wide-eyed expression of wonder and delight.',
  },
  {
    scene: 'A 5-year-old boy with red hair and freckles peeks out from inside a colorful blanket fort made of pillows and sheets. Small fairy lights glow inside. He has a playful mischievous grin — full of imagination and adventure.',
  },
  {
    scene: 'Two children — a boy and a girl, both around 6 years old — walk hand in hand through a field of bright sunflowers taller than them. Blue sky with soft clouds. Seen from behind. A moment of friendship and courage.',
  },
  {
    scene: 'A 5-year-old girl with straight black hair and light skin sits by a rainy window. A ginger cat is curled on her lap. Warm indoor golden light, raindrops on glass. She looks peaceful and calm — cozy contemplative mood.',
  },
  {
    scene: 'A 6-year-old boy with dark curly hair wearing a homemade red cape stands on a hilltop at golden hour. Arms spread wide, wind in his hair. He looks brave and confident — dreamy sunset sky behind him.',
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
    sceneText,
    'Wide shot, character in the scene with environment visible.',
    'Top 25-30% must be a calmer, lighter area — soft cream or light wash — for text overlay.',
    `${styleDesc}. ${styleNudge}`,
    'No text, no letters, no words, no UI elements.',
  ].join('\n\n');

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: NEGATIVE,
    size: '1024x1536',
    quality: 'medium', // medium to save cost — still good for gallery thumbnails
  });

  const outPath = join(OUT_DIR, filename);
  await writeFile(outPath, result.buffer);
  console.log(`  ✓ ${filename} (${Math.round(result.buffer.length / 1024)} KB, ${result.durationMs}ms)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const totalImages = STYLES.length * SCENES.length;
  console.log('═══ Gallery Generation — GPT Image ═══');
  console.log(`Styles: ${STYLES.map(s => s.label).join(', ')}`);
  console.log(`Scenes: ${SCENES.length} per style`);
  console.log(`Total images: ${totalImages}\n`);

  for (const style of STYLES) {
    console.log(`\n────── ${style.label} ──────`);
    for (const [i, scene] of SCENES.entries()) {
      try {
        await generateScene(scene.scene, i, style, SCENES.length);
      } catch (err) {
        const filename = `gallery-${style.filePrefix}${i + 1}.jpg`;
        console.error(`  ✗ Failed ${filename}: ${(err as Error).message}`);
      }
    }
  }

  console.log('\n═══ Done! Gallery images saved to public/Images/gallery/ ═══');
  if (doStyle01) console.log('  Style 01: gallery-1.jpg ... gallery-6.jpg');
  if (doStyle02) console.log('  Style 02: gallery-r-1.jpg ... gallery-r-6.jpg');
}

main().catch(console.error);
