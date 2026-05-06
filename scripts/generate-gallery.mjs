/**
 * Generate gallery showcase images for the landing page.
 *
 * Usage: node scripts/generate-gallery.mjs
 *
 * Generates 6 diverse, beautiful children's book illustrations
 * via Replicate (Flux) and saves them to public/Images/gallery/.
 */

import Replicate from 'replicate';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const replicate = new Replicate();

const OUTPUT_DIR = path.resolve('public/Images/gallery');

const STYLE_PREFIX = 'Soft watercolor children\'s book illustration, hand-drawn pencil texture, warm gentle lighting, delicate pastel colors, storybook page feel, emotional and tender,';

const PROMPTS = [
  {
    file: 'gallery-1.jpg',
    prompt: `${STYLE_PREFIX} a young boy sitting on his bed at night, hugging a stuffed teddy bear close, soft warm bedroom glow from a nightlight, cozy blankets, feeling safe and protected`,
  },
  {
    file: 'gallery-2.jpg',
    prompt: `${STYLE_PREFIX} a little girl with curly hair standing in a magical forest, glowing golden butterflies floating around her, dappled sunlight through trees, sense of wonder and discovery`,
  },
  {
    file: 'gallery-3.jpg',
    prompt: `${STYLE_PREFIX} a child peeking out from inside a colorful blanket fort made of pillows and sheets, fairy lights inside, curious playful expression, imagination and adventure`,
  },
  {
    file: 'gallery-4.jpg',
    prompt: `${STYLE_PREFIX} two children walking hand in hand through a field of bright sunflowers taller than them, blue sky with soft clouds, friendship and courage, seen from behind`,
  },
  {
    file: 'gallery-5.jpg',
    prompt: `${STYLE_PREFIX} a child sitting by a rainy window with a ginger cat curled on their lap, warm indoor light, rain drops on glass, peaceful contemplative mood, cozy room`,
  },
  {
    file: 'gallery-6.jpg',
    prompt: `${STYLE_PREFIX} a boy wearing a homemade cape standing on a hilltop at golden hour sunset, arms spread wide, wind in hair, feeling brave and powerful, dreamy sky colors`,
  },
];

async function generateImage(prompt) {
  const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-dev';
  console.log(`  Model: ${model}`);

  const output = await replicate.run(model, {
    input: {
      prompt,
      aspect_ratio: '3:4',       // portrait, like a book page
      output_format: 'jpg',
      output_quality: 90,
      num_outputs: 1,
    },
  });

  // Output is either a URL string or an array of URLs
  const url = Array.isArray(output) ? output[0] : output;

  // Handle ReadableStream (newer Replicate SDK returns streams)
  if (url && typeof url === 'object' && typeof url.url === 'function') {
    const response = await fetch(url.url());
    return Buffer.from(await response.arrayBuffer());
  }

  if (typeof url === 'string') {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }

  // If it's a ReadableStream directly
  if (url && typeof url[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of url) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  throw new Error(`Unexpected output type: ${typeof url}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Generating ${PROMPTS.length} gallery images...\n`);

  for (const { file, prompt } of PROMPTS) {
    const outPath = path.join(OUTPUT_DIR, file);
    console.log(`\n[${file}]`);
    console.log(`  Prompt: ${prompt.substring(0, 80)}...`);

    try {
      const buffer = await generateImage(prompt);
      await writeFile(outPath, buffer);
      console.log(`  ✓ Saved (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  console.log('\nDone! Gallery images saved to public/Images/gallery/');
}

main().catch(console.error);
