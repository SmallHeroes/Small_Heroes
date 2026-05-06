#!/usr/bin/env node
/**
 * generate-style-cream.mjs
 *
 * Generates 20 training/reference images for the Soft Cream Storybook style.
 * Emphasis: hand-drawn pencil outlines, watercolor fills, cream paper background,
 * gentle texture, children's book warmth. NOT digital/CG.
 *
 * Usage:
 *   node scripts/generate-style-cream.mjs          # Generate all 20
 *   node scripts/generate-style-cream.mjs 5         # Start from image 6
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── STYLE PREFIX — refined for hand-drawn pencil + watercolor on cream ──
const STYLE_PREFIX = [
  // Core identity
  'Traditional children\'s book illustration, hand-drawn on cream-colored paper,',
  // Medium & technique — pencil first, watercolor second
  'visible colored pencil outlines with natural hand pressure variation,',
  'soft transparent watercolor washes for color fills, paint slightly bleeding outside the pencil lines,',
  'subtle visible pencil hatching and cross-hatching for shading,',
  // Background — cream page is NON-NEGOTIABLE
  'warm cream off-white paper background covering the entire image,',
  'NO sky gradients, NO photographic backgrounds, the background IS the paper,',
  'characters and elements placed in lower 60% of frame, upper area is plain cream paper,',
  // Ground & environment
  'minimal ground — only a simple soft earth-tone ground area with sparse grass tufts or pebbles,',
  'no complex environments, no detailed landscapes, keep it minimal and airy,',
  // Character style
  'small cute chibi-proportioned characters about 3 heads tall,',
  'round oversized heads, simple dot eyes, tiny nose, rosy pink cheeks,',
  'simple clothing with flat watercolor fills and pencil-drawn folds,',
  // Palette
  'limited warm muted palette: cream, soft peach, dusty rose, muted sage green, warm brown, faded terracotta, soft golden yellow,',
  'absolutely no bright saturated colors, no neon, no pure black outlines,',
  'pencil lines are warm brown or dark sepia, never black,',
  // Texture & feel
  'visible paper grain texture throughout the entire image,',
  'organic imperfect hand-drawn quality, slightly wobbly natural lines,',
  'the look of a real physical illustration scanned from paper,',
  // Anti-digital
  'NOT digital art, NOT 3D render, NOT vector art, NOT photorealistic,',
  'looks like it was drawn by hand with real pencils and painted with real watercolors on real paper,',
  // Mood
  'quiet gentle nostalgic atmosphere, the feeling of a treasured handmade children\'s picture book,',
].join(' ');

// ── 20 DIVERSE SCENES ──────────────────────────────────────────────
const SCENES = [
  // Children solo
  'a small boy with messy brown hair and a blue knit sweater walking on a dirt path, carrying a tiny lantern, looking forward with curiosity',
  'a little girl with short black hair and a coral dress sitting on a low wooden stool, reading a large picture book on her lap',
  'a boy with a green cap and overalls crouching down to pick up a fallen autumn leaf, wind blowing gently',
  'a girl with two braids and a mustard cardigan standing on tiptoe to reach a butterfly perched on a tall flower stem',
  'a small child in pajamas sitting on a round rug, hugging a stuffed bear, sleepy expression, a tiny candle glowing nearby',

  // Children with animals
  'a girl kneeling to offer a dandelion to a small brown bunny, both on soft grass, facing each other',
  'a boy sitting cross-legged on the ground with a fat ginger cat curled in his lap, both eyes closed, peaceful',
  'a child walking beside a small spotted dog on a country path, both seen from the side, the dog wagging its tail',
  'a girl with a wool hat gently holding a baby chick in her cupped hands, looking down at it with wonder',
  'a boy lying on his stomach in the grass, chin on his hands, watching a ladybug on a blade of grass',

  // Animals solo
  'a round fluffy hedgehog walking through a scattering of dry autumn leaves on bare ground',
  'a baby owl perched on a thin bare branch, tilting its head to one side, big round curious eyes',
  'a tiny fox cub sitting upright in short grass, bushy tail wrapped around its paws, looking up',
  'a small tortoise walking slowly across a patch of earth, a tiny flower growing beside it',
  'two baby ducklings following each other in a line across a simple ground with a few pebbles',

  // Fantasy / gentle magic
  'a small child with translucent fairy wings standing on a large mushroom cap, tiny glowing dots floating around',
  'a girl holding a jar filled with golden fireflies, the jar casting a warm soft glow on her face',
  'a boy riding on the back of a giant gentle snail moving through dewy grass, looking happy and relaxed',
  'a child in a paper boat floating on a calm puddle, a tiny fish peeking out of the water beside the boat',
  'a girl planting a small seed in the earth while a friendly little garden spirit watches from behind a leaf',
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
  const outputDir = path.join(PROJECT_ROOT, 'lora-training-data', 'style_cream_20');
  fs.mkdirSync(outputDir, { recursive: true });

  const startIdx = parseInt(process.argv[2] || '0', 10);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  GENERATING Cream Storybook Style — 20 Images`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Starting from: image ${startIdx + 1}`);
  console.log(`${'═'.repeat(60)}`);

  let success = 0;
  let failed = 0;

  for (let i = startIdx; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const fullPrompt = `${STYLE_PREFIX} ${scene}`;

    console.log(`\n  [${i + 1}/${SCENES.length}] ${scene.substring(0, 70)}...`);

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
      const filename = `cream_${padded}.png`;
      const filepath = path.join(outputDir, filename);
      await downloadImage(imageUrl, filepath);

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
  console.log(`  Estimated cost: ~$${(success * 0.04).toFixed(2)}`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
