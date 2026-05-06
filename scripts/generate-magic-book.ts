/**
 * Generate a magical storybook illustration for the wizard welcome screen.
 * Uses GPT Image with transparent background — outputs PNG with alpha.
 *
 * Usage:
 *   npx tsx scripts/generate-magic-book.ts
 *
 * Outputs: public/Images/MagicBook.png (overwrites existing)
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const OUT_PATH = join('public', 'Images', 'MagicBook.png');

const PROMPT = `A single magical children's storybook, slightly open, floating in the air at a gentle angle — as if it just lifted off a table by itself. The book has a warm purple-lavender cover with soft golden corner details and a small glowing star emblem on the front.

Tiny golden sparkles, stars and soft magical swirls of light drift upward from the pages — warm gold, soft purple, and gentle cream-colored light particles. The magic feels GENTLE and WARM, not dramatic or dark.

Style: Soft Pixar-watercolor children's book illustration — rounded shapes, warm colors, cute and inviting. Think modern children's book cover art. Gentle cream and gold tones.

CRITICAL: The background must be COMPLETELY EMPTY — no floor, no surface, no shadow, no environment. The book floats alone with only the sparkles around it. Pure transparent/empty background.

No text, no letters, no words anywhere on the book or in the image.`;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const openai = new OpenAI({ apiKey });

  console.log('Generating magical book illustration...');
  console.log(`Prompt: ${PROMPT.slice(0, 100)}...`);

  const startMs = Date.now();

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: PROMPT,
    size: '1024x1024' as never,
    quality: 'high' as never,
    background: 'transparent' as never,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');

  const buffer = Buffer.from(b64, 'base64');
  const durationMs = Date.now() - startMs;

  await writeFile(OUT_PATH, buffer);
  console.log(`\n✓ Saved to ${OUT_PATH}`);
  console.log(`  Size: ${Math.round(buffer.length / 1024)} KB`);
  console.log(`  Duration: ${durationMs}ms`);
  console.log(`  Format: PNG with transparent background`);
}

main().catch(console.error);
