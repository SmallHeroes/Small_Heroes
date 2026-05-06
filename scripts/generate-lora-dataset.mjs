#!/usr/bin/env node
/**
 * generate-lora-dataset.mjs
 *
 * Generates 30 training images per style for LoRA fine-tuning.
 * Each image gets a consistent style prefix + diverse scene content.
 *
 * Usage:
 *   node scripts/generate-lora-dataset.mjs --style 01
 *   node scripts/generate-lora-dataset.mjs --style 02
 *   node scripts/generate-lora-dataset.mjs --style both
 *   node scripts/generate-lora-dataset.mjs --style 01 --start 15   (resume from image 15)
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────
// STYLE DEFINITIONS — extremely precise visual descriptions
// ─────────────────────────────────────────────────────────────

const STYLE_PREFIX = {
  '01': [
    // Core technique
    'Soft children\'s book illustration,',
    'delicate thin ink outlines with light watercolor washes,',
    'hand-drawn quality with visible pen strokes,',
    // Palette
    'muted warm color palette of cream, beige, soft brown, dusty orange, olive green, and faded blue,',
    // Background
    'plain warm cream off-white background with large empty negative space,',
    'minimal environment — only sparse grass tufts and a simple ground line,',
    // Character style
    'chibi-like proportions with oversized round heads and small bodies (3-4 heads tall),',
    'simple dot eyes, tiny nose, minimal facial features,',
    'round soft body shapes,',
    // Composition
    'characters placed in the bottom third of the frame,',
    'vast open space above for text,',
    // Texture
    'subtle paper grain texture, organic watercolor bleeds,',
    'no harsh digital edges,',
    // Mood
    'gentle, quiet, nostalgic storybook atmosphere,',
  ].join(' '),

  '02': [
    // Anti-digital anchor — force traditional media
    'Traditional hand-drawn illustration made entirely with Prismacolor colored pencils and soft pastels on cream textured paper,',
    'NOT digital art, NOT vector, NOT 3D rendering, NOT cartoon,',
    // Core technique
    'heavy visible colored pencil grain and individual crayon strokes on every surface,',
    'soft blended edges where colors meet, hatching and cross-hatching visible up close,',
    'no clean digital outlines — all edges are soft pencil strokes,',
    // Palette — the key: warm dusty rose base, NOT bright blue skies
    'warm dusty muted palette: soft rose pink, dusty peach, sage green, muted red, warm ochre, lavender,',
    'backgrounds have a warm pink-peach-cream tint even in outdoor scenes,',
    'NO bright saturated neon colors, NO pure blue sky — skies are soft pink or pale grey-blue,',
    // Character style
    'elegant simplified characters with slightly elongated proportions,',
    'small simple dot eyes, pointed small nose, prominent round rosy pink cheeks,',
    'hair rendered with individual pencil strokes showing texture,',
    'clothing with visible fabric texture and pencil shading,',
    // Composition
    'full-page scene with characters in a richly textured environment,',
    'soft rolling hills, textured foliage, detailed interiors with pencil-rendered objects,',
    // Texture — repeat for emphasis
    'the entire image looks like it was scanned from a physical drawing on paper,',
    'visible paper tooth texture underneath the pigment,',
    'soft grainy quality throughout, like looking at an original illustration in a printed French picture book,',
    // Mood
    'dreamy, romantic, nostalgic, warm European picture book atmosphere,',
  ].join(' '),
};

// ─────────────────────────────────────────────────────────────
// 30 DIVERSE SCENES — varied characters, settings, angles, lighting
// ─────────────────────────────────────────────────────────────

const SCENES = [
  // ── Children alone ──
  'a 5-year-old boy with messy brown hair and a blue t-shirt standing on a dirt path, looking up at the sky, morning light',
  'a 4-year-old girl with red curly hair and a yellow dress sitting cross-legged on grass, holding a dandelion, afternoon sun',
  'a 6-year-old boy with black straight hair and a green jacket crouching down to look at a ladybug on a leaf',
  'a small girl with blonde pigtails and a purple coat walking through puddles in rain boots, grey rainy day',
  'a boy with brown skin and short curly hair wearing overalls, reaching up to pick an apple from a low branch',

  // ── Children with animals ──
  'a little girl with braids sitting next to a large friendly orange cat on a wooden bench in a garden',
  'a boy in a striped shirt walking alongside a big gentle golden retriever on a country road, sunset light',
  'a child in a red raincoat kneeling down to pet a small brown rabbit in tall grass, soft morning fog',
  'a girl with short black hair riding on the back of a giant friendly turtle through a meadow',
  'a boy hugging a fluffy white sheep in a green field, wind blowing through his hair, blue sky with clouds',

  // ── Fantasy creatures ──
  'a small child holding hands with a tiny friendly dragon with small wings, standing on a hill at sunset',
  'a girl discovering a glowing fairy sitting on a mushroom in a mossy forest clearing, magical sparkles',
  'a boy meeting a round fluffy forest spirit creature with big eyes among ferns and wildflowers',
  'a child riding a large friendly owl flying over a moonlit village with tiny houses below',
  'two children looking at a sleeping baby phoenix in a nest made of golden leaves, warm glow',

  // ── Indoor scenes ──
  'a child sitting by a window reading a big picture book, rain outside, warm lamp light inside, cozy bedroom',
  'a boy and a girl building a tall tower from colorful wooden blocks on a rug, toys scattered around',
  'a child in pajamas sitting on a bed hugging a teddy bear, nightlight casting soft shadows, bedtime',
  'a little girl standing on a stool helping in the kitchen, mixing bowl and flour on the counter, warm light',
  'a boy drawing with crayons at a wooden table, papers everywhere, concentrated expression, afternoon light from window',

  // ── Outdoor environments ──
  'a child walking through a path lined with tall sunflowers taller than them, bright summer day, blue sky',
  'a girl sitting on a wooden dock dangling her feet over a calm lake, mountains in the background, peaceful',
  'a boy climbing a big old oak tree, looking out from a low branch, green leaves all around, dappled light',
  'two children running through a field of tall grass chasing butterflies, golden hour light, joyful movement',
  'a child standing at the edge of a beach looking at the ocean, waves lapping at bare feet, cloudy sky',

  // ── Night / magical lighting ──
  'a child sitting on a crescent moon above clouds, holding a glowing lantern, stars in a dark blue sky',
  'a boy and a small fox sitting around a tiny campfire in the woods, warm firelight on their faces, dark trees behind',
  'a girl catching fireflies in a glass jar in a garden at dusk, soft purple and blue twilight sky',

  // ── Action / dynamic ──
  'a child jumping from rock to rock across a small stream in a forest, splashing water, determined face',
  'a girl with a cape running fast down a grassy hill, arms spread wide like flying, wind in her hair, bright day',
];

// ─────────────────────────────────────────────────────────────
// Caption file generation — captions for LoRA training
// ─────────────────────────────────────────────────────────────

function buildCaption(styleKey, sceneDescription) {
  // Caption describes WHAT is in the image (for training).
  // The trigger word is prepended so the model learns to associate it.
  const trigger = styleKey === '01' ? 'SOFTSTYLE01' : 'EXPRSTYLE02';
  return `${trigger}, ${sceneDescription}`;
}

// ─────────────────────────────────────────────────────────────
// Infrastructure
// ─────────────────────────────────────────────────────────────

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(PROJECT_ROOT, envFile);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
        }
      }
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { style: null, start: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--style' && args[i + 1]) result.style = args[++i];
    if (args[i] === '--start' && args[i + 1]) result.start = parseInt(args[++i], 10);
  }
  return result;
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
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

// ─────────────────────────────────────────────────────────────
// Main generation
// ─────────────────────────────────────────────────────────────

async function generateImage(replicate, styleKey, sceneIdx, outputDir) {
  const scene = SCENES[sceneIdx];
  const fullPrompt = `${STYLE_PREFIX[styleKey]} ${scene}`;

  console.log(`\n  [${sceneIdx + 1}/${SCENES.length}] ${scene.substring(0, 80)}...`);
  console.log(`  Prompt length: ${fullPrompt.length} chars`);

  const output = await replicate.run('black-forest-labs/flux-dev', {
    input: {
      prompt: fullPrompt,
      aspect_ratio: '3:4',        // Portrait — book page ratio
      output_format: 'png',
      num_outputs: 1,
      guidance: 3.5,              // Default for flux-dev, good balance
      num_inference_steps: 28,    // High quality for training data
    },
  });

  // Extract URL from output
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (Array.isArray(output) && output.length > 0) {
    const item = output[0];
    if (typeof item === 'string') imageUrl = item;
    else if (item?.url) imageUrl = typeof item.url === 'function' ? await item.url() : item.url;
  } else if (output?.url) {
    imageUrl = typeof output.url === 'function' ? await output.url() : output.url;
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    console.error(`  ✗ Failed to extract URL:`, JSON.stringify(output).slice(0, 200));
    return null;
  }

  // Save image
  const paddedIdx = String(sceneIdx + 1).padStart(2, '0');
  const filename = `style${styleKey}_${paddedIdx}.png`;
  const filepath = path.join(outputDir, filename);
  await downloadImage(imageUrl, filepath);

  // Save caption file (same name, .txt extension)
  const captionPath = filepath.replace('.png', '.txt');
  fs.writeFileSync(captionPath, buildCaption(styleKey, scene), 'utf-8');

  console.log(`  ✓ Saved: ${filename}`);
  return filepath;
}

async function generateForStyle(replicate, styleKey, startIdx) {
  const outputDir = path.join(PROJECT_ROOT, 'lora-training-data', `style_${styleKey}_dataset`);
  fs.mkdirSync(outputDir, { recursive: true });

  const trigger = styleKey === '01' ? 'SOFTSTYLE01' : 'EXPRSTYLE02';
  const styleName = styleKey === '01' ? 'Soft Ink + Watercolor' : 'Colored Pencil + Pastel';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  GENERATING STYLE ${styleKey}: ${styleName}`);
  console.log(`  Trigger word: ${trigger}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Images: ${SCENES.length} (starting from ${startIdx + 1})`);
  console.log(`${'═'.repeat(60)}`);

  let success = 0;
  let failed = 0;

  for (let i = startIdx; i < SCENES.length; i++) {
    try {
      const result = await generateImage(replicate, styleKey, i, outputDir);
      if (result) success++;
      else failed++;
    } catch (err) {
      console.error(`  ✗ Error on scene ${i + 1}: ${err.message}`);
      failed++;
      // Wait a bit on error (rate limit etc.)
      await sleep(5000);
    }

    // Small delay between generations to be nice to the API
    if (i < SCENES.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n  Style ${styleKey} done: ${success} success, ${failed} failed`);
  console.log(`  Output directory: ${outputDir}`);
  return { success, failed };
}

async function main() {
  loadEnv();
  const args = parseArgs();

  if (!args.style) {
    console.log('Usage:');
    console.log('  node scripts/generate-lora-dataset.mjs --style 01');
    console.log('  node scripts/generate-lora-dataset.mjs --style 02');
    console.log('  node scripts/generate-lora-dataset.mjs --style both');
    console.log('  node scripts/generate-lora-dataset.mjs --style 01 --start 15');
    console.log('');
    console.log('Generates 30 training images per style for LoRA fine-tuning.');
    console.log('Each image is saved with a matching .txt caption file.');
    console.log('');
    console.log('Requires REPLICATE_API_TOKEN in .env.local');
    process.exit(0);
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('ERROR: REPLICATE_API_TOKEN not found in environment or .env.local');
    process.exit(1);
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const stylesToGenerate = args.style === 'both' ? ['01', '02'] : [args.style];
  const results = {};

  for (const styleKey of stylesToGenerate) {
    if (!STYLE_PREFIX[styleKey]) {
      console.error(`Unknown style: ${styleKey}. Use 01, 02, or both.`);
      process.exit(1);
    }
    results[styleKey] = await generateForStyle(replicate, styleKey, args.start);
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  for (const [key, r] of Object.entries(results)) {
    console.log(`  Style ${key}: ${r.success}/${SCENES.length} images generated`);
  }

  const cost = Object.values(results).reduce((sum, r) => sum + r.success, 0) * 0.04;
  console.log(`\n  Estimated cost: ~$${cost.toFixed(2)} (at ~$0.04/image)`);
  console.log(`\n  Next step: Review images, remove any bad ones, then run training:`);
  console.log(`    node scripts/train-lora.mjs --style 01`);
  console.log(`    node scripts/train-lora.mjs --style 02`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
