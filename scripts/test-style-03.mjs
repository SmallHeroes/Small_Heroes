/**
 * Generate a single test image using Style 03 (Detailed Whimsical World).
 * Uses the EXACT renderingDescription + imageNudge from lib/styles.ts.
 *
 * Usage: OPENAI_API_KEY=sk-... node scripts/test-style-03.mjs
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- From ChatGPT reference prompt (v3 — organic warmth) ---
const RENDERING_DESCRIPTION = `Highly detailed whimsical storybook illustration in a rich "Where's Waldo meets modern animated indie comic" style. Hand-drawn ink outlines with slightly imperfect sketchy lines, expressive characters, warm cinematic lighting, and dense environmental storytelling. Every part of the image filled with charming tiny details, layered objects, toys, decorations, textures, books, stickers, plants, lights, and hidden visual moments. Style balance: halfway between realistic and cartoon — believable proportions but stylized faces and environments. Soft painterly watercolor/gouache shading combined with crisp line-art detail. Cozy, emotional, nostalgic atmosphere. Rich color harmony with warm amber lights and cool blue shadows. Slightly exaggerated perspective for charm. The scene should feel alive and deeply immersive, like a premium illustrated children's book spread. Tons of micro-details visible on second glance. Composition readable from far away but rewarding when zooming in. Rendering references: detailed European children's books, cozy animated indie comics, gentle Studio Ghibli warmth, hand-painted watercolor textures. Important: organic imperfect lines, textured brushwork, layered depth, cozy clutter, expressive lighting, emotionally warm mood, cinematic framing, highly detailed background storytelling. NOT AI-glossy plastic, NOT hyperrealism, NOT flat cartoon, NOT clean vector, NOT flat modern minimalism.`;

// --- From styles.ts: imageNudge (v3 — organic warmth) ---
const IMAGE_NUDGE = `Dense whimsical storybook illustration: hand-drawn ink outlines with slightly imperfect sketchy lines, soft painterly watercolor/gouache shading with crisp line-art detail. Warm cinematic lighting with amber lights and cool blue shadows. Fill every part with charming micro-details — toys, books, stickers, plants, lights, hidden creatures, textures, cozy clutter. Organic imperfect lines, textured brushwork, layered depth, expressive lighting. Scene feels alive and immersive like a premium European children's book spread. Top 20-30% gradually fades to softer detail for text overlay. NOT AI-glossy, NOT hyperreal, NOT flat vector, NOT clean minimalism.`;

// --- Not used in test but kept for reference ---
const VISUAL_DIRECTOR_SENTENCE = `Highly detailed whimsical storybook illustration: hand-drawn ink outlines with slightly imperfect sketchy lines, soft painterly watercolor/gouache shading combined with crisp line-art detail. Dense environmental storytelling with charming micro-details everywhere — toys, books, stickers, plants, lights, hidden creatures, cozy clutter. Warm cinematic lighting with amber lights and cool blue shadows. Organic imperfect lines, textured brushwork, layered depth, expressive lighting. Halfway between realistic and cartoon. Character is 30-50% of image, integrated into a rich fully-detailed world. Scene feels alive and immersive like a premium European children's book spread. Top area gradually fades to simpler warm tones for text. No AI-glossy plastic, no hyperrealism, no flat vector, no clean minimalism, no sparse backgrounds.`;

// --- Test scene ---
const SCENE = `A 5-year-old girl with curly brown hair and big hazel eyes sits cross-legged on the floor of her magical bedroom. She is building a tower out of colorful wooden blocks while a small orange fox sits beside her watching curiously. The bedroom is DENSELY filled with details: overflowing bookshelves, fairy lights strung across the ceiling, a window showing a twilight sky with stars appearing, potted plants on the windowsill, a handmade mobile of paper birds above, stickers on the furniture, a half-open toy chest spilling toys, crayon drawings pinned to the wall, a sleeping cat on a cushion in the corner, tiny mushroom figurines on a shelf, and a cozy reading nook with pillows.`;

const CHARACTER_DNA = `PROTAGONIST IDENTITY LOCK:
- Face: round face, big hazel eyes, small nose, rosy cheeks — stylized but proportional
- Hair: curly brown hair, shoulder-length, slightly messy with a small clip
- Skin: light olive skin tone
- Build: small, age-appropriate proportions for 5-year-old
- Clothing: cozy yellow sweater with a small star patch, dark blue leggings
- Expression: focused and happy, building her tower`;

const COMPOSITION = `Camera: medium-wide shot showing full room environment. Character occupies 30-40% of image, centered in the lower portion.
Text zone: top 20-25% gradually fades to simpler warm tones — fewer details, lighter colors, soft amber wash for text overlay.
The bottom 75% is DENSE with narrative micro-details everywhere.`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: Set OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  // Build prompt exactly as buildGPTImagePrompt would: renderingDescription + scene + character + composition + imageNudge
  const prompt = [
    RENDERING_DESCRIPTION,
    '',
    SCENE,
    '',
    CHARACTER_DNA,
    '',
    COMPOSITION,
    '',
    'STYLE REINFORCEMENT:',
    IMAGE_NUDGE,
  ].join('\n');

  console.log('=== STYLE 03 TEST — Detailed Whimsical World ===');
  console.log(`Prompt length: ${prompt.length} chars`);
  console.log('Generating...\n');

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1536',
    quality: 'high',
  });

  const imageData = response.data[0];
  if (!imageData?.b64_json) {
    console.error('No image data returned.');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `style-03-test-${timestamp}.png`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, Buffer.from(imageData.b64_json, 'base64'));

  console.log(`Done! Saved to: ${filepath}`);
  console.log(`\nOpen it: start "" "${filepath}"`);
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
