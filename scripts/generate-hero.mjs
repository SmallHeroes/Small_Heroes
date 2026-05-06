/**
 * Generate an illustrated hero image for the landing page.
 *
 * Usage: node scripts/generate-hero.mjs
 *
 * Requires: REPLICATE_API_TOKEN in .env
 * Saves to: public/Images/HeroIllustrated.png
 */

import Replicate from 'replicate';
import { writeFile } from 'fs/promises';
import { config } from 'dotenv';

// Load token from .env
config();

const replicate = new Replicate();

const PROMPT = [
  "Soft watercolor children's book illustration, hand-drawn pencil texture,",
  "warm gentle lighting, delicate pastel colors,",
  "a cheerful illustrated boy about 6 years old with messy brown hair,",
  "wearing a small bright yellow superhero cape fluttering in the wind,",
  "standing confidently with one hand on his hip and the other pointing forward,",
  "looking at the viewer with a big warm brave smile,",
  "golden sparkles and small stars swirling around him,",
  "simple warm cream background that fades to pure white at the edges,",
  "full body character portrait, centered composition,",
  "children's book hero character, emotional and empowering"
].join(' ');

async function main() {
  console.log('Generating hero image...');
  console.log(`Prompt: ${PROMPT.substring(0, 100)}...`);

  const model = 'black-forest-labs/flux-dev';

  const output = await replicate.run(model, {
    input: {
      prompt: PROMPT,
      aspect_ratio: '3:4',
      output_format: 'png',
      output_quality: 95,
      num_outputs: 1,
    },
  });

  const url = Array.isArray(output) ? output[0] : output;

  let buffer;

  // Handle ReadableStream (newer Replicate SDK)
  if (url && typeof url[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of url) chunks.push(chunk);
    buffer = Buffer.concat(chunks);
  } else if (typeof url === 'string') {
    const response = await fetch(url);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error(`Unexpected output type: ${typeof url}`);
  }

  const outPath = 'public/Images/HeroIllustrated.png';
  await writeFile(outPath, buffer);
  console.log(`\n✓ Saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log('\nNow update index.html to use HeroIllustrated.png instead of HeroBar.png');
}

main().catch(console.error);
