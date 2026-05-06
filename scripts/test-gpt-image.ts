/**
 * GPT Image API — Proof of Concept
 *
 * Tests OpenAI's gpt-image-1 model for storybook page generation.
 * Two modes:
 *   1. Text-only generation (no reference photo)
 *   2. Photo-to-illustration (reference photo → storybook style)
 *
 * The goal: watercolor dissolution portraits that match what ChatGPT produces.
 *
 * Usage:
 *   npx tsx scripts/test-gpt-image.ts                    # text-only mode
 *   npx tsx scripts/test-gpt-image.ts --photo path.jpg   # photo-to-illustration
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, basename } from 'path';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('Missing OPENAI_API_KEY in .env'); process.exit(1); }

const openai = new OpenAI({ apiKey });
const OUT_DIR = 'test-outputs/gpt-image';

// ── Style prompt — matches exactly what worked in ChatGPT ──
const STYLE_PROMPT = `Children's storybook illustration style:
- Warm, magical, cartoon-realistic illustrated style for a children's book
- Character rendered in sharp painterly detail with expressive features
- Background dissolves into soft cream/warm amber watercolor washes
- Only isolated environmental details near the character (a plant, a small object)
- The rest of the background is cream-colored with light warm watercolor stains
- Top area of the image is open cream/warm space for text overlay
- Portrait orientation 2:3
- Character should not exceed 60% of the image height, positioned in lower half
- Soft warm lighting, magical atmosphere
- No hard borders, no picture frame, no fully detailed backgrounds
- No text, no letters, no UI elements`;

// ── Scene descriptions for text-only mode ──
const SCENES = [
  {
    id: 'bedroom_fox',
    prompt: `${STYLE_PROMPT}

Scene: A 5-year-old girl with long brown wavy hair sits on her bed in her cozy bedroom at night. She wears soft pajamas. A small friendly fox peeks through the window, its front paws on the windowsill. The girl turns toward the fox with a surprised, delighted smile. Warm lamplight inside, cool moonlight from window. Only the bed edge, lamp, and window frame are visible — the rest dissolves into warm cream watercolor washes.`,
  },
  {
    id: 'forest_meeting',
    prompt: `${STYLE_PROMPT}

Scene: A 5-year-old boy with curly brown hair walks on a forest path in golden afternoon light. He discovers a small fox sitting on a mossy rock, looking up at him with bright curious eyes. The boy kneels down with wonder. A few trees and ferns near them, but the background dissolves into warm cream and amber watercolor washes. Dappled sunlight.`,
  },
];

// ── Photo-to-illustration prompt ──
const PHOTO_STYLE_PROMPT = `Transform this photo into a children's storybook illustration:
- Magical cartoon-realistic illustrated style, warm and expressive
- Keep the child's face, hair, and clothing recognizable but illustrated
- Background dissolves into soft cream watercolor washes with light warm stains
- Only a few isolated environmental details remain near the character
- Most of the background is cream/warm amber with soft watercolor texture
- Top 40% of image should be open cream space (for text overlay)
- Character positioned in lower portion, not exceeding 60% of image height
- Soft warm lighting, magical children's book atmosphere
- Portrait 2:3 format
- No hard borders, no picture frame
- No text, no letters, no UI`;

async function generateTextOnly(scene: { id: string; prompt: string }) {
  console.log(`\n══════ Text-Only: ${scene.id} ══════`);
  console.log(`[prompt] ${scene.prompt.slice(0, 150)}...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: scene.prompt,
    size: '1024x1536',
    quality: 'high',
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned');

  // gpt-image-1 returns b64_json by default
  const b64 = imageData.b64_json;
  if (!b64) throw new Error('No base64 data in response');

  const buffer = Buffer.from(b64, 'base64');
  const outPath = join(OUT_DIR, `textonly_${scene.id}.png`);
  await writeFile(outPath, buffer);
  console.log(`[saved] ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return outPath;
}

async function generateFromPhoto(photoPath: string) {
  console.log(`\n══════ Photo-to-Illustration ══════`);
  console.log(`[photo] ${photoPath}`);
  console.log(`[prompt] ${PHOTO_STYLE_PROMPT.slice(0, 150)}...`);

  // Read the photo file
  const photoBuffer = await readFile(photoPath);
  const photoFile = new File([photoBuffer], basename(photoPath), { type: 'image/jpeg' });

  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: photoFile,
    prompt: PHOTO_STYLE_PROMPT,
    size: '1024x1536',
    quality: 'high',
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned');

  const b64 = imageData.b64_json;
  if (!b64) throw new Error('No base64 data in response');

  const buffer = Buffer.from(b64, 'base64');
  const name = basename(photoPath, '.jpg').replace(/\.[^.]+$/, '');
  const outPath = join(OUT_DIR, `photo_styled_${name}.png`);
  await writeFile(outPath, buffer);
  console.log(`[saved] ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return outPath;
}

async function generateSceneWithReference(photoPath: string) {
  console.log(`\n══════ Photo Reference + New Scene ══════`);
  console.log(`[photo] ${photoPath}`);

  const photoBuffer = await readFile(photoPath);
  const photoFile = new File([photoBuffer], basename(photoPath), { type: 'image/jpeg' });

  const scenePrompt = `Using the child from this reference photo, create a children's storybook illustration:

The child (keep their exact face, hair color, and general appearance) is sitting on their bed in a cozy bedroom at night, wearing soft pajamas. A small friendly fox peeks through the window, its front paws on the windowsill. The child turns toward the fox with a surprised, delighted smile.

Style:
- Warm magical cartoon-realistic illustration for a children's book
- Background dissolves into soft cream watercolor washes
- Only the bed edge, a warm lamp glow, and window frame are visible details
- Rest of background is cream/warm amber with soft watercolor texture
- Top 40% is open cream space for text
- Character in lower portion, not exceeding 60% of image height
- Warm lamplight inside, cool moonlight from window
- No hard borders, no picture frame, no fully detailed room
- No text, no letters, no UI`;

  console.log(`[prompt] ${scenePrompt.slice(0, 150)}...`);

  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: photoFile,
    prompt: scenePrompt,
    size: '1024x1536',
    quality: 'high',
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned');

  const b64 = imageData.b64_json;
  if (!b64) throw new Error('No base64 data in response');

  const buffer = Buffer.from(b64, 'base64');
  const outPath = join(OUT_DIR, `scene_with_ref.png`);
  await writeFile(outPath, buffer);
  console.log(`[saved] ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return outPath;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  GPT Image API — Storybook POC               ║');
  console.log('║  Testing watercolor dissolution style         ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  await mkdir(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const photoIdx = args.indexOf('--photo');
  const photoPath = photoIdx >= 0 ? args[photoIdx + 1] : null;

  if (photoPath) {
    // Mode 1: Transform photo to illustration (same scene)
    console.log('=== Mode: Photo-to-Illustration ===');
    await generateFromPhoto(photoPath);

    // Mode 2: Use photo as reference for NEW scene
    console.log('\n[wait] 3s...');
    await new Promise((r) => setTimeout(r, 3000));
    console.log('=== Mode: Photo Reference + New Scene ===');
    await generateSceneWithReference(photoPath);
  } else {
    // Mode 3: Text-only generation
    console.log('=== Mode: Text-Only (no reference photo) ===');
    console.log('Tip: Use --photo <path> to test with a reference photo\n');

    for (let i = 0; i < SCENES.length; i++) {
      if (i > 0) {
        console.log('\n[wait] 3s...');
        await new Promise((r) => setTimeout(r, 3000));
      }
      await generateTextOnly(SCENES[i]);
    }
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  DONE — Check test-outputs/gpt-image/         ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
