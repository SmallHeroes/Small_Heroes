/**
 * Compare all 3 styles side by side — same scene, 3 different style prompts.
 * Uses GPT Image (gpt-image-1) via Images API — raw, no postprocessing.
 *
 * Usage: OPENAI_API_KEY=sk-... node scripts/compare-styles.mjs
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── SHARED SCENE (identical for all 3 styles) ──
const SCENE = `A 5-year-old girl sits cross-legged on the floor of her bedroom, building a tall colorful wooden block tower. A small orange fox sits beside her, watching with curious eyes. The room has overflowing bookshelves, toys, drawings pinned to walls, string lights, potted plants, a toy chest, scattered crayons, and a patterned rug.`;

const CHARACTER = `CHARACTER (locked): round face, big hazel eyes, rosy cheeks, small nose, curly shoulder-length brown hair, light olive skin, average build for 5-year-old. Wearing: yellow sweater with small star patch, dark blue leggings. Focused happy expression.`;

const COMPANION = `COMPANION: fox, small knee-height, orange-red fur with white chest, bright curious eyes.`;

// ── STYLE PROMPTS (style FIRST — early tokens shape rendering mode) ──
const styles = {
  'style-01': {
    name: 'מאוייר חמוד (Premium Cute Illustrated)',
    prompt: `MEDIUM LOCK — PREMIUM CHILDREN'S BOOK WATERCOLOR ILLUSTRATION:
Richly detailed, adorable children's book illustration by a master picture-book illustrator. Lush watercolor on textured cream paper. Every page feels like opening a beloved storybook.

Adorable round face — large sparkling eyes with light reflections, rosy cheeks, small button nose. Slightly stylized proportions for maximum cuteness. Sweet expressive features — a face you want to hug.
HIGH detail: bookshelves with colorful spines, fairy lights, potted plants, toys, drawings pinned to walls, patterned rug. Every surface has texture and visual interest.
Rich warm storybook palette — soft cream, warm peach, gentle golden undertones, earthy greens, dusty blues. Luminous layered watercolor pigment on cream paper. Subtle golden warmth is GOOD.
Soft warm glow — cozy, inviting, like lamplight in a child's room. Fine detail: tiny highlights in eyes, individual eyelashes, texture in hair curls, stitching on clothes.
Character fills 55-65% of image. Rich detail near character, edges dissolve into soft warm cream washes. Top 20-30% lighter for text.

${CHARACTER}
${COMPANION}

Scene: ${SCENE}

STRICT: NOT photorealistic, NOT 3D render, NOT anime, NOT vector art, NOT flat minimal. No text, letters, numbers, or symbols anywhere.`,
  },

  'style-02': {
    name: 'אקוורל ריאליסטי (Fine Realistic Watercolor)',
    prompt: `MEDIUM LOCK — FINE REALISTIC WATERCOLOR PORTRAIT ON CREAM PAPER:
Accomplished watercolor portrait of a real child on premium textured cream paper. Refined technique — delicate brushwork, luminous pigment layering, fine detail. Like the work of a master watercolor portrait artist.

Real child proportions — natural features, real anatomy, healthy luminous skin. Fine transparent watercolor — light passes through pigment, paper glows through. HIGH detail: individual eyelashes, hair strands, freckles, fabric texture, skin luminosity.
Refined warm palette — soft cream, warm peach, natural greens and blues. Bright natural light with subtle warmth. Subtle golden warmth is fine — avoid monochrome amber flood.
Character fills 55-65% of frame. Gentle environmental hints near subject, dissolving outward into warm cream washes. Top 20-30% fades to cream for text.
Fine detail everywhere — hair strands catching light, fabric weave, skin pores suggested. Accomplished watercolor technique — refined, master-level.

${CHARACTER}
${COMPANION}

Scene: ${SCENE}

STRICT: NOT a cartoon, NOT anime, NOT Pixar. No big cartoon eyes. No dark moody tones. No oil painting heaviness. No flat simple washes. No text, letters, numbers, or symbols anywhere.`,
  },

  // Style 03 removed — gpt-image-1 cannot produce ink-and-gouache via API
};

async function generateImage(styleName, prompt) {
  console.log(`\n── Generating ${styleName} ──`);
  console.log(`Prompt length: ${prompt.length} chars`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1536',
    quality: 'high',
  });

  const b64 = response.data[0]?.b64_json;
  if (!b64) throw new Error(`No b64_json for ${styleName}`);
  return Buffer.from(b64, 'base64');
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: Set OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  // Optional: --style=style-01 or --style=style-02 to generate only one
  const styleFlag = process.argv.find((a) => a.startsWith('--style='));
  const onlyStyle = styleFlag ? styleFlag.split('=')[1] : null;

  const outDir = path.join(__dirname, '..', 'test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const entries = onlyStyle
    ? Object.entries(styles).filter(([key]) => key === onlyStyle)
    : Object.entries(styles);

  if (entries.length === 0) {
    console.error(`No style found for: ${onlyStyle}. Available: ${Object.keys(styles).join(', ')}`);
    process.exit(1);
  }

  console.log(`=== STYLE COMPARISON (${entries.length} style${entries.length > 1 ? 's' : ''}) ===`);
  console.log('No postprocessing — raw GPT Image output\n');

  for (const [key, style] of entries) {
    try {
      const buffer = await generateImage(style.name, style.prompt);
      const filepath = path.join(outDir, `compare-${key}-${ts}.png`);
      fs.writeFileSync(filepath, buffer);
      console.log(`✓ Saved: ${filepath}`);
    } catch (err) {
      console.error(`✗ ${style.name} failed: ${err.message}`);
    }
  }

  console.log('\n=== DONE ===');
  console.log(`All images in: ${outDir}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
