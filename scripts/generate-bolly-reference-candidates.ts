/**
 * Generate 5 Bolly reference candidates for CTO selection.
 * Saves to public/companions/bolly_armadillo/candidate-{1..5}.jpg
 * Copies candidate-1 to reference.jpg as the default canonical anchor.
 *
 * Usage: npx tsx scripts/generate-bolly-reference-candidates.ts
 */
import 'dotenv/config';
import { mkdir, writeFile, copyFile } from 'fs/promises';
import path from 'path';
import { generateGPTImage } from '../lib/generate-image';

const OUT_DIR = path.join(process.cwd(), 'public', 'companions', 'bolly_armadillo');

const BOLLY_CANDIDATE_PROMPT = [
  'Character reference sheet for BOLLY, a small friendly armadillo companion in a Hebrew children\'s picture book.',
  'Warm tan-brown segmented shell with visible plate edges, one plate slightly open showing soft pink belly.',
  'Round dark gentle eyes, short snout, compact cute body, neutral sitting pose facing slightly toward viewer.',
  'Soft Pixar-watercolor storybook illustration style, plain soft cream background, full body visible.',
  'No text, no letters, no watermark, no frame.',
].join(' ');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const count = Number(process.env.BOLLY_CANDIDATE_COUNT || '5');

  console.log(`Generating ${count} Bolly reference candidates...`);

  for (let i = 1; i <= count; i++) {
    const result = await generateGPTImage({
      finalPrompt: BOLLY_CANDIDATE_PROMPT,
      negativePrompt: 'text, letters, words, watermark, realistic photo, scary, human child, feathers, wings',
      size: '1024x1024',
      quality: 'high',
    });
    const outPath = path.join(OUT_DIR, `candidate-${i}.jpg`);
    await writeFile(outPath, result.buffer);
    console.log(`  ✓ candidate-${i}.jpg (${Math.round(result.buffer.length / 1024)} KB)`);
  }

  const canonical = path.join(OUT_DIR, 'candidate-1.jpg');
  const reference = path.join(OUT_DIR, 'reference.jpg');
  await copyFile(canonical, reference);
  console.log(`\nDefault canonical: public/companions/bolly_armadillo/reference.jpg (from candidate-1)`);
  console.log('CTO: review candidates 1–5 and overwrite reference.jpg if a different one is preferred.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
