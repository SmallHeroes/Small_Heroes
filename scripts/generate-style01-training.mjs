#!/usr/bin/env node
/**
 * generate-style01-training.mjs
 *
 * Generates 15 training images for Style 01 (Soft Minimal Storybook)
 * based on precise visual analysis of reference images.
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── STYLE PREFIX — extracted from reference image analysis ──────────
const STYLE_PREFIX = [
  // Medium & technique
  'Minimal children\'s book illustration,',
  'delicate thin ink outlines in warm brown (not black),',
  'flat soft color fills with subtle watercolor wash edges,',
  // Background
  'plain warm cream off-white background with moderate negative space (40-50% of frame),',
  'characters placed in the lower half of the frame, not too small,',
  // Environment
  'minimal ground — only a simple earth-tone ground line with sparse dry grass tufts,',
  'no sky, no clouds, no detailed backgrounds,',
  // Character proportions
  'tiny chibi characters about 3 heads tall with oversized round heads,',
  'simple dot eyes, tiny dot nose, soft round pink cheeks,',
  'small rounded body, simple clothing with flat color,',
  // Palette
  'extremely limited warm palette: cream, beige, soft brown, dusty olive green, muted orange, faded terracotta,',
  'no bright saturated colors, no neon, no pure black,',
  // Texture
  'subtle paper grain texture throughout,',
  'organic hand-drawn quality, slightly wobbly lines,',
  // Mood
  'quiet, gentle, nostalgic picture book atmosphere,',
  'the feeling of a treasured handmade children\'s book,',
].join(' ');

// ── 15 DIVERSE SCENES ───────────────────────────────────────────────
const SCENES = [
  // Children with backgrounds
  'a small boy with brown messy hair and a blue shirt walking alone on a dirt path through sparse dry grass, looking ahead, warm afternoon light',
  'a little girl with short black hair and a red dress sitting on a small grassy hill, hugging her knees, watching the horizon',
  'a boy with a green hoodie standing at the edge of a shallow pond, looking at his reflection, reeds growing nearby',
  'a girl with braids and a yellow raincoat splashing in a puddle on a muddy path, small birds nearby',
  'two small children walking hand in hand through a field with scattered wildflowers, seen from behind',

  // Children with animals
  'a tiny girl kneeling down to pet a small brown rabbit in sparse grass, both facing each other',
  'a boy sitting cross-legged on the ground with a fat orange cat sleeping in his lap, peaceful expression',
  'a child walking alongside a small brown dog on a country path, both seen from the side',
  'a girl standing face to face with a baby deer in a clearing, reaching out her hand gently',

  // Animals alone
  'a small round hedgehog walking through dry autumn leaves on bare ground',
  'a fluffy baby owl perched on a thin bare branch, tilting its head curiously',
  'a tiny fox cub sitting in grass, looking up with big round eyes, bushy tail curled around its body',

  // Fantasy / magical elements
  'a small child with fairy wings standing on a mushroom, surrounded by floating sparkles, dreamy atmosphere',
  'a boy riding on the back of a giant friendly turtle walking slowly through grass',
  'a girl holding a glowing lantern walking through a misty path, a small spirit creature floating beside her',
];

// ── Infrastructure ──────────────────────────────────────────────────

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(PROJECT_ROOT, envFile);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
        }
      }
    }
  }
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(filepath); });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('ERROR: REPLICATE_API_TOKEN not set');
    process.exit(1);
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const outputDir = path.join(PROJECT_ROOT, 'lora-training-data', 'style_01_extra');
  fs.mkdirSync(outputDir, { recursive: true });

  const startIdx = parseInt(process.argv[2] || '0', 10);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  GENERATING Style 01 Training Images`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Images: ${SCENES.length} (starting from ${startIdx + 1})`);
  console.log(`${'═'.repeat(60)}`);

  let success = 0;
  let failed = 0;

  for (let i = startIdx; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const fullPrompt = `${STYLE_PREFIX} ${scene}`;

    console.log(`\n  [${i + 1}/${SCENES.length}] ${scene.substring(0, 70)}...`);
    console.log(`  Prompt: ${fullPrompt.length} chars`);

    try {
      const output = await replicate.run('black-forest-labs/flux-dev', {
        input: {
          prompt: fullPrompt,
          aspect_ratio: '3:4',
          output_format: 'png',
          num_outputs: 1,
          guidance: 3.5,
          num_inference_steps: 28,
        },
      });

      // Extract URL from FileOutput
      let imageUrl;
      if (typeof output === 'string') imageUrl = output;
      else if (Array.isArray(output) && output.length > 0) {
        const item = output[0];
        if (typeof item === 'string') imageUrl = item;
        else if (typeof item?.url === 'function') imageUrl = await item.url();
        else imageUrl = String(item);
      } else {
        imageUrl = String(output);
      }
      if (imageUrl && typeof imageUrl !== 'string') imageUrl = String(imageUrl);

      if (!imageUrl || !imageUrl.startsWith('http')) {
        console.error(`  ✗ Bad URL: ${String(imageUrl).slice(0, 100)}`);
        failed++;
        continue;
      }

      const padded = String(i + 1).padStart(2, '0');
      const filename = `s01_extra_${padded}.png`;
      const filepath = path.join(outputDir, filename);
      await downloadImage(imageUrl, filepath);

      // Caption
      const caption = `SOFTSTYLE01, ${scene}`;
      fs.writeFileSync(filepath.replace('.png', '.txt'), caption, 'utf-8');

      console.log(`  ✓ ${filename}`);
      success++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      failed++;
      await sleep(5000);
    }

    if (i < SCENES.length - 1) await sleep(2000);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Done: ${success} success, ${failed} failed`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Cost: ~$${(success * 0.04).toFixed(2)}`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
