/**
 * test-layout-pipeline.mjs — Test universal portrait + CSS-crop layout strategy.
 *
 * ONE image is generated per page (portrait 1024x1536 with a soft textZone band).
 * - On MOBILE: the full portrait image is shown; text overlays the soft band.
 * - On DESKTOP / PDF: CSS crops out the soft band; only the 75% main scene shows.
 *
 * This script generates ONE such image so we can visually verify:
 * (a) The main 75% works as a standalone illustration (desktop view)
 * (b) The textZone band is genuinely soft enough for text overlay (mobile view)
 *
 * Usage:
 *   node scripts/test-layout-pipeline.mjs
 *   node scripts/test-layout-pipeline.mjs --scene "owl on books, dim lamp"
 *   node scripts/test-layout-pipeline.mjs --zone top_clear
 *
 * Output:
 *   ./test-output/portrait-full.png     — full image (mobile view)
 *   ./test-output/desktop-crop.png      — CSS-equivalent crop (desktop view), if sharp installed
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

config({ path: join(ROOT, '.env') });

// ─── CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
// Real scene from chameleon_koko_bedtime page 1:
// "קוקו מטפס על המוט של הווילון. הוא משנה צבעים מהר מהר — ירוק, חום, לבן.
//  'חדר חדש! איפה? מה?' קוקו מסתכל לכל הכיוונים. הקרטונים על הרצפה."
let scene = `A small chameleon named Koko with soft pastel green-and-brown scales (mid-shift, showing patches of different colors as he rapidly adapts to surfaces), perched on a wooden curtain rod in a child's bedroom. This is a NEW room — the family just moved in: several brown cardboard moving boxes are scattered on the wooden floor, some open with toys peeking out, a bed against the wall not yet fully made up with folded blue blankets, a few framed pictures leaning against the wall not yet hung. A young child stands below the curtain rod, looking UP at Koko with a slightly uncertain expression, wearing soft pajamas, surrounded by the half-unpacked room. Evening light streams through the window with leafy trees visible outside. The bedroom feels lived-in but unsettled — real wooden floor, real wall color (soft pale blue), real bedding, real boxes — the FULL ENVIRONMENT is present and rendered, just with watercolor softness. Modern children's book watercolor illustration with soft painterly washes, fine hand-drawn line work, warm natural lighting. The character is part of the scene, not isolated.`;
let textZone = 'bottom_clear';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scene' && args[i + 1]) scene = args[++i];
  if (args[i] === '--zone' && args[i + 1]) textZone = args[++i];
}

if (textZone !== 'top_clear' && textZone !== 'bottom_clear') {
  console.error(`❌ --zone must be 'top_clear' or 'bottom_clear', got: ${textZone}`);
  process.exit(1);
}

const OUT_DIR = join(ROOT, 'test-output');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Style block (mirrors lib/styles.ts → SOFT_HAND_DRAWN_STORYBOOK) ──────
const STYLE_BLOCK = [
  "MEDIUM LOCK — SOFT WATERCOLOR CHILDREN'S BOOK ILLUSTRATION WITH FULL SCENE:",
  "Modern children's book watercolor by a master illustrator. Soft painterly washes, gentle warmth, fine hand-drawn line work. Every page is a fully-rendered scene with rich environmental context — but in a soft watercolor style where the background recedes naturally behind the focal character.",
  '',
  'RENDERING: Soft painterly digital watercolor with visible brushwork. Full scene painted — room, garden, sky, furniture, props all visible. Hand-painted quality. NOT vivid digital cartoon. NOT photorealistic. NOT isolated character on blank cream.',
  '',
  'CHARACTER: Adorable expressive face — warm eyes, soft cheeks, friendly features. Slightly stylized storybook proportions. Naturally embedded in the environment.',
  '',
  'COLOR: Soft watercolor palette with REAL local colors — walls in their wallpaper color, floor in wood/tile color, sky in real sky-tone for the time of day. Warm undertones welcome but NOT a sepia flood. NOT vivid digital saturation.',
  '',
  'BACKGROUND: Fully painted scene around the character — never blank cream. Background recedes through softer brushwork — still visible and colored.',
  '',
  'STRICT EXCLUSIONS: No 3D. No CGI. No photorealism. No anime. No flat vector. No vivid saturated cartoon. No sepia flood. No isolated character on blank cream.',
].join('\n');

// ─── Universal layout directive (mirrors backend/providers/image.ts) ──────
const textZoneSide = textZone === 'top_clear' ? 'TOP 33% of the frame' : 'BOTTOM 33% of the frame';

const LAYOUT_DIRECTIVE = [
  'LAYOUT MODE — UNIVERSAL PORTRAIT (single image, dual-platform):',
  '- Aspect portrait (2:3, 1024x1536). This image is used UNCHANGED on both mobile and desktop.',
  '- Render a full atmospheric scene with detail. Show the world of this beat with the character as the emotional focal point.',
  '- Wide cinematic environmental framing — character occupies just 20-30% of frame.',
  '- The ENVIRONMENT dominates: room, garden, sky, props all clearly visible. PULL BACK significantly — show the world the character lives in, NOT a close-up portrait.',
  '- Character is naturally embedded in the scene, not isolated on a blank background.',
  '',
  `🚨 CRITICAL — TEXT ZONE FADE at the ${textZoneSide}:`,
  `- The ${textZoneSide} (about ONE THIRD of the total image height) MUST visually FADE / SOFTEN strongly.`,
  `- This is a STRONG GRADUAL FADE — pixels in this band lose detail, contrast, and saturation rapidly, ending as a calm soft low-detail area at the edge.`,
  `- Think of a watercolor wash that grows lighter and increasingly transparent toward the edge of the page.`,
  `- The fade keeps the scene's atmosphere (sky-soft, ground-soft, atmospheric haze) — NOT cream-colored, just visually very quiet.`,
  `- COMPOSE the scene so the character ENDS (cropped at upper body / hip, or sitting on a visible surface) BEFORE this fading band begins.`,
  `- DO NOT place faces, hands, key props, or sharp details into this fading band.`,
  '',
  '🚨 CRITICAL — STANDALONE 67% RULE:',
  `- The OTHER 67% must work as a COMPLETE standalone illustration. On desktop / PDF, CSS crops OUT the fading band — only the 67% remains.`,
  `- That 67% must contain the character (face clear and expressive), main action, and enough environment.`,
  '',
  'Apart from the textZone fade: NO fade-to-cream elsewhere, NO vignette mask, NO soft borders on the other sides.',
].join('\n');

// ─── Main ────────────────────────────────────────────────────────────────
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

async function generatePortrait() {
  // Order: STYLE first (early tokens shape rendering mode), then SCENE, then LAYOUT (final composition rules)
  const fullPrompt = `${STYLE_BLOCK}\n\n${scene}\n\n${LAYOUT_DIRECTIVE}\n\nNo text or letters in the image.`;

  console.log(`\n🎨 Generating portrait 1024x1536 (textZone=${textZone})...`);
  console.log(`   Prompt length: ${fullPrompt.length} chars`);
  const start = Date.now();

  const res = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    size: '1024x1536',
    quality: 'medium',
    n: 1,
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');
  const buffer = Buffer.from(b64, 'base64');

  const fullPath = join(OUT_DIR, 'portrait-full.png');
  writeFileSync(fullPath, buffer);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`   ✓ Saved ${fullPath} (${Math.round(buffer.length / 1024)}KB, ${elapsed}s)`);

  return { buffer, fullPath };
}

async function tryCropForDesktop(buffer) {
  // Attempt CSS-equivalent crop using sharp. Falls back gracefully if not installed.
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1536;
    const cropHeight = Math.round(height * 0.67); // keep 67% main scene
    const topOffset = textZone === 'top_clear' ? height - cropHeight : 0;

    const cropped = await sharp(buffer)
      .extract({ left: 0, top: topOffset, width, height: cropHeight })
      .toBuffer();

    const cropPath = join(OUT_DIR, 'desktop-crop.png');
    writeFileSync(cropPath, cropped);
    console.log(`   ✓ Saved ${cropPath} (${Math.round(cropped.length / 1024)}KB) — simulated desktop crop`);
    return cropPath;
  } catch (err) {
    console.log(`   ⚠ Skipped desktop crop simulation (sharp not installed). Run \`npm i sharp -D\` to enable.`);
    return null;
  }
}

console.log(`📚 Test: Universal portrait layout`);
console.log(`   Scene: ${scene.slice(0, 80)}...`);
console.log(`   textZone: ${textZone}`);
console.log(`   Output: ${OUT_DIR}\n`);

try {
  const { buffer, fullPath } = await generatePortrait();
  const cropPath = await tryCropForDesktop(buffer);

  console.log(`\n✅ Done.\n`);
  console.log(`Compare:`);
  console.log(`  ${fullPath}`);
  console.log(`    → MOBILE view: full image, text overlays the ${textZone === 'top_clear' ? 'TOP' : 'BOTTOM'} soft band`);
  if (cropPath) {
    console.log(`  ${cropPath}`);
    console.log(`    → DESKTOP view: textZone band is cropped out, only the 75% main scene remains`);
  } else {
    console.log(`\nTo visualize desktop view: in the full image, mentally ignore the ${textZone === 'top_clear' ? 'TOP' : 'BOTTOM'} 25% band.`);
  }
  console.log(`\nVerification checklist:`);
  console.log(`  [ ] The ${textZone === 'top_clear' ? 'TOP' : 'BOTTOM'} 25% is genuinely soft/quiet — text would overlay legibly`);
  console.log(`  [ ] The MAIN 75% works as a complete picture by itself`);
  console.log(`  [ ] Character's face and key action are NOT in the textZone band`);
  console.log(`  [ ] Rich detail throughout — no fade-to-cream, no vignette mask`);
} catch (err) {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
}
