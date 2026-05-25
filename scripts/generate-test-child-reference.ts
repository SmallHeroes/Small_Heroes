/**
 * Generate the fixed test-child reference photo for image consistency experiments.
 * Synthetic portrait — reused unchanged across experiment runs for comparability.
 *
 * Usage: npx tsx scripts/generate-test-child-reference.ts
 * Saves: public/experiments/image-consistency-1/test-child-reference.jpg
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { generateGPTImage } from '../lib/generate-image';

const OUT_PATH = path.join(
  process.cwd(),
  'public',
  'experiments',
  'image-consistency-1',
  'test-child-reference.jpg'
);

const TEST_CHILD_PROMPT = [
  'Portrait photo of a real 5-year-old girl with warm olive skin, dark brown shoulder-length wavy hair, and soft brown eyes.',
  'Neutral gentle expression, plain soft cream background, even natural lighting, head and shoulders framing.',
  'Looks like a real child photo for personalization testing — NOT illustrated, NOT cartoon.',
  'No text, no watermark, no props.',
].join(' ');

async function main() {
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  console.log('Generating fixed test-child reference photo...');

  const result = await generateGPTImage({
    finalPrompt: TEST_CHILD_PROMPT,
    negativePrompt: 'text, letters, cartoon, illustration, anime, watermark, multiple people',
    size: '1024x1024',
    quality: 'high',
  });

  await writeFile(OUT_PATH, result.buffer);
  console.log(`✓ Saved ${OUT_PATH} (${Math.round(result.buffer.length / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
