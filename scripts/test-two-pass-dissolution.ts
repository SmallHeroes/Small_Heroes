/**
 * Two-Pass Image Pipeline Test — Style 01 (Realistic) Only
 *
 * Pass 1: Generate scene with LoRA (characters + scene)
 * Pass 2: Gradient mask → inpaint edges/top with watercolor dissolution
 *
 * The gradient mask protects the center/bottom (where characters are)
 * and dissolves the edges + top (where text goes).
 * No segmentation needed — no risk of deleting characters.
 *
 * Output files:
 *   - dissolved_raw.jpg    = Pass 1 output (what we have today)
 *   - dissolved_mask.png   = Gradient mask (white = areas to dissolve)
 *   - dissolved_final.jpg  = Final with dissolved edges + open top
 *
 * Usage: npx tsx scripts/test-two-pass-dissolution.ts
 */

import 'dotenv/config';
import Replicate from 'replicate';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

const token = process.env.REPLICATE_API_TOKEN;
if (!token) { console.error('Missing REPLICATE_API_TOKEN'); process.exit(1); }

const replicate = new Replicate({ auth: token });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STYLE_01_MODEL = process.env.LORA_MODEL_STYLE_01 || 'smallheroes/sh-realistic-artistic';
const OUT_DIR = 'test-outputs';

// ── Scene ──
const SCENE = `A 5-year-old girl with long brown wavy hair sits on her bed in her cozy bedroom at night. She wears soft pajamas. A small bedside lamp glows softly. Through the window beside the bed, a small friendly fox peeks in from outside, its front paws on the windowsill, looking at the girl. The girl turns toward the fox with a surprised, delighted smile. Warm interior lamplight, cool moonlight from window. No text, no letters, no UI.`;

// ─────────────────────────────────────────────
// PASS 1: Generate with LoRA
// ─────────────────────────────────────────────
async function pass1_generate(): Promise<{ url: string; buffer: Buffer }> {
  console.log('\n══════ PASS 1: Generate with LoRA ══════');

  let model = STYLE_01_MODEL;
  const parts = model.split('/');
  if (parts.length === 2 && !model.includes(':')) {
    try {
      const info = await replicate.models.get(parts[0], parts[1]);
      if (info.latest_version?.id) {
        model = `${model}:${info.latest_version.id}`;
        console.log(`[version] ${STYLE_01_MODEL} → ${model}`);
      }
    } catch { /* use as-is */ }
  }

  const prompt = `REALISTART01 style, realistic artistic portrait, cinematic golden-hour lighting, painterly realism, warm watercolor treatment, ${SCENE}`;

  console.log(`[model] ${model}`);
  console.log(`[prompt] ${prompt.slice(0, 200)}...`);

  const output = await replicate.run(model as `${string}/${string}` | `${string}/${string}:${string}`, {
    input: {
      prompt,
      aspect_ratio: '2:3',
      output_format: 'jpg',
      num_outputs: 1,
    },
  });

  const url = Array.isArray(output) ? String(output[0]) : String(output);
  console.log(`[url] ${url.slice(0, 80)}...`);

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const rawPath = join(OUT_DIR, 'dissolved_raw.jpg');
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(rawPath, buffer);
  console.log(`[saved] ${rawPath} (${Math.round(buffer.length / 1024)} KB)`);

  return { url, buffer };
}

// ─────────────────────────────────────────────
// PASS 2a: Create gradient dissolution mask
// ─────────────────────────────────────────────
async function pass2a_createGradientMask(imageBuffer: Buffer): Promise<Buffer> {
  console.log('\n══════ PASS 2a: Create gradient mask ══════');

  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width!;
  const h = metadata.height!;
  console.log(`[dimensions] ${w}x${h}`);

  // Create the mask pixel by pixel using raw buffer
  // WHITE = dissolve (inpaint), BLACK = keep
  //
  // Strategy:
  //   - Protected zone: ellipse centered at (50%, 65%) — where characters live
  //   - The ellipse is ~60% wide and ~55% tall
  //   - Outside the ellipse: gradient from black to white
  //   - Top 25%: stronger white (text zone)
  //   - Edges: gentle white fade
  //
  // This means the scene's core (characters, key objects) stays intact
  // while edges and top dissolve into watercolor.

  const cx = w * 0.50;  // center X
  const cy = h * 0.62;  // center Y — biased toward bottom where characters sit
  const rx = w * 0.38;  // horizontal radius of protected zone
  const ry = h * 0.35;  // vertical radius of protected zone

  const pixels = Buffer.alloc(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Distance from center of protected ellipse (normalized 0-1 inside, >1 outside)
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Inside ellipse: fully protected (black)
      // Transition zone (1.0 to 1.8): gradual fade to white
      // Outside: fully dissolve (white)
      let mask: number;
      if (dist <= 1.0) {
        mask = 0; // fully protected
      } else if (dist <= 1.8) {
        // Smooth ease-in-out from 0 to 255
        const t = (dist - 1.0) / 0.8;
        const eased = t * t * (3 - 2 * t); // smoothstep
        mask = Math.round(eased * 255);
      } else {
        mask = 255; // fully dissolve
      }

      // Extra boost for top 20% (text zone) — ensure it's white
      const topFade = y / h;
      if (topFade < 0.20) {
        const topBoost = 1 - (topFade / 0.20); // 1 at top, 0 at 20%
        mask = Math.max(mask, Math.round(topBoost * 255));
      }

      pixels[y * w + x] = mask;
    }
  }

  // Create grayscale PNG from raw pixels
  const maskBuffer = await sharp(pixels, {
    raw: { width: w, height: h, channels: 1 },
  })
    .toFormat('png')
    .toBuffer();

  // Also create a soft version with blur for natural blending
  const softMaskBuffer = await sharp(maskBuffer)
    .blur(25) // large blur for natural transition
    .toFormat('png')
    .toBuffer();

  const maskPath = join(OUT_DIR, 'dissolved_mask.png');
  await writeFile(maskPath, maskBuffer);
  console.log(`[saved] ${maskPath} — gradient mask (sharp)`);

  const softPath = join(OUT_DIR, 'dissolved_mask_soft.png');
  await writeFile(softPath, softMaskBuffer);
  console.log(`[saved] ${softPath} — gradient mask (blurred for natural blend)`);

  return softMaskBuffer;
}

// ─────────────────────────────────────────────
// PASS 2b: Inpaint dissolved areas
// ─────────────────────────────────────────────
async function pass2b_inpaint(imageBuffer: Buffer, maskBuffer: Buffer): Promise<void> {
  console.log('\n══════ PASS 2b: Inpaint with watercolor dissolution ══════');

  const imageDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const maskDataUri = `data:image/png;base64,${maskBuffer.toString('base64')}`;

  const inpaintPrompt = 'Soft warm watercolor washes, abstract warm amber and cream tones, gentle painterly dissolution, warm golden light fading into off-white cream paper. Artistic watercolor texture with visible brushstrokes. No details, no objects, no patterns — just soft warm abstract watercolor tones blending naturally.';

  console.log(`[prompt] ${inpaintPrompt.slice(0, 120)}...`);
  console.log('[step] Running flux-fill-pro inpainting...');

  const output = await replicate.run('black-forest-labs/flux-fill-pro', {
    input: {
      image: imageDataUri,
      mask: maskDataUri,
      prompt: inpaintPrompt,
    },
  });

  const resultUrl = String(output);
  console.log(`[result url] ${resultUrl.slice(0, 80)}...`);

  const resultRes = await fetch(resultUrl, { signal: AbortSignal.timeout(30_000) });
  if (!resultRes.ok) throw new Error(`Result download failed: ${resultRes.status}`);
  const resultBuffer = Buffer.from(await resultRes.arrayBuffer());

  const dissolvedPath = join(OUT_DIR, 'dissolved_final.jpg');
  await writeFile(dissolvedPath, resultBuffer);
  console.log(`[saved] ${dissolvedPath} (${Math.round(resultBuffer.length / 1024)} KB)`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Two-Pass Dissolution Pipeline Test v2       ║');
  console.log('║  Gradient mask — no segmentation needed      ║');
  console.log('║  Style 01 (Realistic) — Bedroom Scene        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Pass 1: Generate with LoRA
  const { url: rawUrl, buffer: rawBuffer } = await pass1_generate();

  // Pass 2a: Create gradient mask (local, no API call)
  const maskBuffer = await pass2a_createGradientMask(rawBuffer);

  console.log('\n[wait] 5s cooldown...');
  await sleep(5_000);

  // Pass 2b: Inpaint background with dissolution
  await pass2b_inpaint(rawBuffer, maskBuffer);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  DONE — Compare these files:                 ║');
  console.log('║                                              ║');
  console.log('║  test-outputs/dissolved_raw.jpg               ║');
  console.log('║    → Original LoRA generation                ║');
  console.log('║                                              ║');
  console.log('║  test-outputs/dissolved_mask_soft.png         ║');
  console.log('║    → Gradient mask (white = dissolve areas)  ║');
  console.log('║                                              ║');
  console.log('║  test-outputs/dissolved_final.jpg             ║');
  console.log('║    → FINAL with dissolved edges + open top   ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main().catch((e) => { console.error(e); process.exit(1); });
