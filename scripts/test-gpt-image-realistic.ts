/**
 * GPT Image API — Realistic Artistic Style Test
 *
 * Tests the REALISTIC version of Style 01:
 * Fine art portrait / oil painting feel, NOT cartoon.
 * Characters look like real children painted by a master artist.
 * Background dissolves into warm watercolor washes.
 *
 * Compares with the cartoon-realistic version from test-gpt-image.ts
 *
 * Usage: npx tsx scripts/test-gpt-image-realistic.ts
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('Missing OPENAI_API_KEY in .env'); process.exit(1); }

const openai = new OpenAI({ apiKey });
const OUT_DIR = 'test-outputs/gpt-image';

// ── REALISTIC ARTISTIC style — like the ChatGPT examples Guy showed ──
// This is the "פורטרט אמנותי" style: real child → fine art painting
// v1 = original (too dark), v2 = brighter/warmer
const REALISTIC_STYLE_V1_DARK = `Realistic artistic portrait illustration for a children's storybook page:
- Fine art painting style — like a master oil painter or high-end editorial illustrator
- Characters have REALISTIC human proportions and features — not cartoon, not stylized
- Real skin texture, natural hair, lifelike facial expressions with visible emotion
- Painterly brushstrokes visible — this is art, not a photograph
- Warm cinematic golden-hour lighting on the characters
- Background dissolves into soft warm watercolor washes — abstract warm amber and cream tones
- Only partial environmental details visible near the characters — the rest fades to warm washes
- Top 25-30% of the image is open warm watercolor space for text overlay
- Characters positioned in center/lower area, filling about 50-60% of image height
- The illustration should feel like a real photograph transformed into a fine art painting
- Rich warm palette — deep ambers, warm golds, natural skin tones
- Portrait orientation 2:3
- No cartoon features, no anime eyes, no chibi proportions
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements`;

// v3 = balanced — v1 base but warmer/cheerful without overexposure
const REALISTIC_STYLE_V3 = `Realistic artistic portrait illustration for a children's storybook page:
- Fine art painting style — like a master oil painter or high-end editorial illustrator
- Characters have REALISTIC human proportions and features — not cartoon, not stylized
- Real skin texture, natural hair, lifelike facial expressions with visible emotion
- Painterly brushstrokes visible — this is art, not a photograph
- Warm golden lighting on the characters — cheerful and inviting, not dark or somber
- The mood should feel warm, hopeful, and safe — like a happy memory painted in oils
- Background dissolves into soft warm watercolor washes — warm cream, soft amber, and gentle peach tones
- Only partial environmental details visible near the characters — the rest fades to warm washes
- Top 25-30% of the image is open warm watercolor space for text overlay
- Characters positioned in center/lower area, filling about 50-60% of image height
- The illustration should feel like a real photograph transformed into a fine art painting
- Warm cheerful palette — warm ambers, soft golds, natural skin tones with healthy rosy cheeks
- Shadows should be warm-toned, not cold or heavy
- Portrait orientation 2:3
- No dark somber mood, no cold shadows, no desaturated tones
- No overexposed or washed-out look — maintain rich color depth
- No cartoon features, no anime eyes, no chibi proportions
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements`;

// v6 = LIGHT CREAM backgrounds — not golden/amber/sepia, modern and fresh
const REALISTIC_STYLE = `Children's storybook illustration — cartoon-realistic style:
- Warm, inviting illustrated style for a children's book — like a modern Pixar concept art painting
- Characters have realistic human proportions but with a gentle, approachable softness
- Natural-looking children — real hair, real skin tones, expressive faces — but rendered softly, not photorealistic
- Smooth, clean rendering — NOT heavy oil painting brushstrokes, NOT thick impasto texture
- The look should feel like a high-quality animated film still, painted with warmth
- Soft natural lighting on the characters — cheerful and clear, not dark or somber
- The mood should feel happy, safe, and magical — like a beautiful modern children's book
- Natural color palette with gentle variety — soft greens, warm blues, natural earth tones
- Colors should feel fresh and natural, not oversaturated or golden-tinted
- Background dissolves into very LIGHT watercolor washes — nearly white with just a hint of cream, NOT golden, NOT amber, NOT sepia
- The empty background areas should approach white — like clean watercolor paper with barely-there warm tints
- Only partial environmental details visible near the characters — the rest fades to near-white washes
- TOP 40% of the image MUST be open near-white watercolor space — reserved for text overlay, NO character heads or important details in this zone
- Characters positioned in the LOWER 60% of the image, filling about 40-50% of image height
- Characters should be slightly smaller and pushed toward the bottom — leave generous open space above
- Fresh palette — natural greens, soft blues, warm skin tones with healthy rosy cheeks, colorful clothing
- Shadows should be soft and neutral, not warm-tinted or golden
- The overall image should feel MODERN and LIGHT, not vintage or old-fashioned
- Portrait orientation 2:3
- No golden/amber/sepia color cast on the image
- No dark somber mood, no cold shadows
- No heavy visible brushstrokes, no thick oil paint texture, no impasto
- No anime eyes, no chibi proportions, no flat cartoon style
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements`;

// ── CARTOON-REALISTIC style (same as test-gpt-image.ts for comparison) ──
const CARTOON_STYLE = `Children's storybook illustration style:
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

// Same scene, two styles — direct comparison
const SCENE = `A 5-year-old girl with long brown wavy hair sits on her bed in her cozy bedroom at night. She wears soft pajamas. A small friendly fox peeks through the window, its front paws on the windowsill, looking at the girl with bright curious eyes. The girl turns toward the fox with a surprised, delighted smile. A warm bedside lamp glows softly. Warm interior lamplight, cool moonlight from window.`;

const TESTS = [
  // ── v5 CARTOON-REALISTIC HYBRID + 40% TEXT ZONE ──
  {
    id: 'realistic_v5_bedroom',
    style: 'CARTOON-REALISTIC-v5',
    prompt: `${REALISTIC_STYLE}

Scene: ${SCENE}
Only the bed edge, lamp glow, and window frame are partially visible — the rest dissolves into soft warm watercolor washes. The girl's face shows genuine wonder and delight. The fox and girl share a moment of eye contact. The girl and fox are positioned in the lower portion of the image — the entire top 40% is open warm watercolor wash space.`,
  },
  {
    id: 'realistic_v5_forest',
    style: 'CARTOON-REALISTIC-v5',
    prompt: `${REALISTIC_STYLE}

Scene: A 5-year-old boy with curly brown hair kneels on a forest path in warm golden afternoon light. A small fox sits on a mossy rock in front of him, looking up with bright curious eyes. The boy reaches out gently toward the fox with wonder on his face. Dappled warm sunlight filters through green trees. A few trees and ferns near them — the rest of the forest dissolves into warm watercolor washes. The boy is positioned in the lower portion of the image — the entire top 40% is open warm watercolor wash space.`,
  },
  {
    id: 'realistic_v5_beach',
    style: 'CARTOON-REALISTIC-v5',
    prompt: `${REALISTIC_STYLE}

Scene: A 5-year-old girl with dark curly hair stands barefoot at the edge of the sea at golden hour. She holds a large seashell to her ear, eyes closed, listening with a peaceful smile. Gentle waves lap at her feet. Warm golden light on her face and dress. The ocean and sky behind her dissolve into soft warm watercolor washes — peach and cream tones blending together. The girl is positioned in the lower portion of the image — the entire top 40% is open warm watercolor wash space.`,
  },
];

async function generate(test: { id: string; style: string; prompt: string }) {
  console.log(`\n══════ ${test.style}: ${test.id} ══════`);
  console.log(`[prompt] ${test.prompt.slice(0, 180)}...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: test.prompt,
    size: '1024x1536',
    quality: 'high',
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned');

  const b64 = imageData.b64_json;
  if (!b64) throw new Error('No base64 data in response');

  const buffer = Buffer.from(b64, 'base64');
  const outPath = join(OUT_DIR, `${test.id}.png`);
  await writeFile(outPath, buffer);
  console.log(`[saved] ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return outPath;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  GPT Image — v5 CARTOON-REALISTIC HYBRID                ║');
  console.log('║  Pixar-meets-watercolor, smooth render, no brushstrokes ║');
  console.log('║  Natural colors (not oversaturated), 40% text zone      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await mkdir(OUT_DIR, { recursive: true });

  for (let i = 0; i < TESTS.length; i++) {
    if (i > 0) {
      console.log('\n[wait] 3s...');
      await new Promise((r) => setTimeout(r, 3000));
    }
    await generate(TESTS[i]);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  DONE — Compare in test-outputs/gpt-image/              ║');
  console.log('║                                                          ║');
  console.log('║  realistic_v5_bedroom.png  — cartoon-realistic bedroom  ║');
  console.log('║  realistic_v5_forest.png   — cartoon-realistic forest   ║');
  console.log('║  realistic_v5_beach.png    — cartoon-realistic beach    ║');
  console.log('║                                                          ║');
  console.log('║  Smooth Pixar-like render, natural colors, 40% top zone ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
