/**
 * Generate an illustrated hero image for the landing page.
 *
 * Uses GPT Image (gpt-image-1) with the same tight-framing
 * composition philosophy as our book illustrations.
 *
 * Usage:
 *   npx tsx scripts/generate-hero.ts
 *
 * Requires: OPENAI_API_KEY in .env
 * Saves to: public/Images/HeroIllustrated.png
 */

import 'dotenv/config';
import { generateGPTImage } from '../lib/generate-image';
import { writeFile } from 'fs/promises';

const PROMPT = [
  // Framing directive first — matches our production pipeline
  'COMPOSITION & FRAMING: Medium-close portrait framing — the character fills 65% of the image area.',
  'Do NOT show full room or wide establishing shot. Background dissolves into soft abstract watercolor washes.',

  // Scene
  'A cheerful illustrated boy about 5-6 years old with warm brown skin and messy curly dark hair.',
  'He wears a small bright golden-yellow cape that flutters behind him.',
  'He looks at the viewer with a big warm brave smile, one hand reaching forward as if inviting the viewer into his story.',
  'Golden sparkles and tiny stars swirl around his hand.',
  'His eyes are bright, confident, and kind.',

  // Style
  "Soft Pixar-watercolor children's book illustration — rounded features, cute expressive face, gentle warm lighting.",
  'Background: simple warm cream dissolving to pure white at the edges. Dreamy and inviting.',
  'No text, no letters, no words, no UI elements.',
].join('\n');

async function main() {
  console.log('Generating hero image with GPT Image...');
  console.log(`Prompt (first 120 chars): ${PROMPT.slice(0, 120)}...`);

  const result = await generateGPTImage({
    finalPrompt: PROMPT,
    negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border, sad expression, crying',
    size: '1024x1536',  // portrait 2:3
    quality: 'high',
  });

  const outPath = 'public/Images/HeroIllustrated.png';
  await writeFile(outPath, result.buffer);
  console.log(`\n✓ Saved: ${outPath} (${Math.round(result.buffer.length / 1024)} KB, ${result.durationMs}ms)`);
}

main().catch(console.error);
