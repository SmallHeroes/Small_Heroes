#!/usr/bin/env node
/**
 * generate-style-cream-v2.mjs
 *
 * Round 2: 20 more cream storybook images.
 * Focus: fantasy, humor, parents+children, emotional depth, wild imagination.
 * One hero image: boy and gentle giant on pure white background.
 *
 * Usage:
 *   node scripts/generate-style-cream-v2.mjs          # Generate all 20
 *   node scripts/generate-style-cream-v2.mjs 5         # Start from image 6
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── STYLE PREFIX ──
const STYLE_PREFIX = [
  'Traditional children\'s book illustration, hand-drawn on cream-colored paper,',
  'visible colored pencil outlines with natural hand pressure variation,',
  'soft transparent watercolor washes for color fills, paint slightly bleeding outside the pencil lines,',
  'subtle visible pencil hatching and cross-hatching for shading,',
  'warm cream off-white paper background covering the entire image,',
  'NO sky gradients, NO photographic backgrounds, the background IS the paper,',
  'characters and elements placed in lower 60% of frame, upper area is plain cream paper,',
  'minimal ground — only a simple soft earth-tone ground area with sparse grass tufts or pebbles,',
  'no complex environments, no detailed landscapes, keep it minimal and airy,',
  'small cute chibi-proportioned characters about 3 heads tall,',
  'round oversized heads, simple dot eyes, tiny nose, rosy pink cheeks,',
  'simple clothing with flat watercolor fills and pencil-drawn folds,',
  'limited warm muted palette: cream, soft peach, dusty rose, muted sage green, warm brown, faded terracotta, soft golden yellow,',
  'absolutely no bright saturated colors, no neon, no pure black outlines,',
  'pencil lines are warm brown or dark sepia, never black,',
  'visible paper grain texture throughout the entire image,',
  'organic imperfect hand-drawn quality, slightly wobbly natural lines,',
  'the look of a real physical illustration scanned from paper,',
  'NOT digital art, NOT 3D render, NOT vector art, NOT photorealistic,',
  'looks like it was drawn by hand with real pencils and painted with real watercolors on real paper,',
  'quiet gentle nostalgic atmosphere, the feeling of a treasured handmade children\'s picture book,',
].join(' ');

// Special prefix for the hero image — pure white background, no ground
const HERO_PREFIX = [
  'Traditional children\'s book illustration, hand-drawn on pure white paper,',
  'visible colored pencil outlines with natural hand pressure variation,',
  'soft transparent watercolor washes for color fills, paint slightly bleeding outside the pencil lines,',
  'pure white clean background, NO ground, NO earth, NO grass, NO environment,',
  'just the characters standing on nothing, floating on white paper,',
  'small cute chibi-proportioned characters about 3 heads tall,',
  'round oversized heads, simple dot eyes, tiny nose, rosy pink cheeks,',
  'limited warm muted palette: cream, soft peach, dusty rose, muted sage green, warm brown, faded terracotta,',
  'pencil lines are warm brown or dark sepia, never black,',
  'visible paper grain texture, organic hand-drawn quality,',
  'NOT digital art, NOT 3D render,',
  'emotionally touching, heartwarming, the feeling of a treasured children\'s picture book,',
].join(' ');

// ── 20 SCENES — Fantasy, Humor, Parents, Emotion ──
const SCENES = [
  // ★ HERO IMAGE — boy and gentle giant
  {
    prompt: 'a tiny boy standing next to an enormous friendly giant, the giant is kneeling down gently and smiling, the boy is looking up without fear and reaching his small hand toward the giant\'s huge finger, both have rosy cheeks and warm expressions, deeply emotional and heartwarming moment, the giant has kind soft eyes',
    prefix: 'hero',
    filename: 'hero_boy_and_giant',
  },

  // Parents + Children (emotional)
  {
    prompt: 'a father carrying his small daughter on his shoulders, she is holding a tiny paper airplane, both laughing, her hair blowing in imaginary wind, warm loving moment',
  },
  {
    prompt: 'a mother sitting cross-legged on the ground reading a big picture book to her toddler who is sitting in her lap, both completely absorbed in the story, a stuffed bunny beside them',
  },
  {
    prompt: 'a grandfather holding hands with a tiny grandchild, walking together, the grandfather has a walking stick, the child is looking up at him with adoration, gentle quiet love',
  },
  {
    prompt: 'a mother and her small son lying on their bellies on the ground, chin on hands, both watching a tiny caterpillar on a leaf, shared wonder and curiosity',
  },

  // Fantasy & Wild Imagination
  {
    prompt: 'a small friendly dragon with tiny wings sitting next to a child, both eating ice cream cones, the dragon accidentally breathing a tiny flame that melts his ice cream, funny surprised expression',
  },
  {
    prompt: 'a baby elephant with oversized floppy ears flying through the air like dumbo, a small child riding on its back waving happily, both looking joyful',
  },
  {
    prompt: 'a dog wearing aviator goggles and a scarf, sitting in a tiny red biplane, a child standing below waving goodbye, the dog looks very proud and serious',
  },
  {
    prompt: 'a small yellow chick standing on a tree stump singing with its beak wide open, musical notes floating around it, a child sitting nearby covering their ears and laughing',
  },
  {
    prompt: 'a child riding a giant friendly snail through a tiny mushroom forest, the snail leaving a sparkly trail behind, the child reading a book while riding, completely relaxed',
  },

  // Humor
  {
    prompt: 'a small cat trying to fit inside a tiny cardboard box that is way too small, only its face and paws visible, a child sitting next to it laughing, the cat looks determined',
  },
  {
    prompt: 'a child trying to walk a stubborn puppy on a leash, the puppy sitting firmly and refusing to move, the child leaning forward pulling with all their might, funny tug of war',
  },
  {
    prompt: 'a row of five baby ducklings following a confused kitten instead of their mother duck, the kitten looking back bewildered, the ducklings looking happy and oblivious',
  },
  {
    prompt: 'a small child wearing grown-up oversized shoes and a big hat that covers their eyes, carrying a briefcase, pretending to go to work, wobbling adorably',
  },
  {
    prompt: 'a frog wearing a tiny crown sitting on a lily pad, a small girl offering it a kiss, the frog looking nervous and leaning away, fairy tale humor',
  },

  // More Fantasy + Emotion
  {
    prompt: 'a child sleeping peacefully in a crescent moon like a hammock, surrounded by tiny floating stars, a small owl perched on the tip of the moon watching over them',
  },
  {
    prompt: 'a tiny child planting a seed in the ground, and a magical giant flower already growing instantly behind them without them noticing, a ladybug watching from the flower',
  },
  {
    prompt: 'two children building a sandcastle together, but the sandcastle has turned into a real tiny magical castle with a tiny flag on top, both children staring at it in amazement',
  },
  {
    prompt: 'a child blowing bubbles, but inside each bubble there is a tiny world — a tree, a house, a fish, a star — magical dreamy feeling',
  },
  {
    prompt: 'a small bear cub and a small child sitting back to back against each other, both asleep, leaning on each other for support, a single autumn leaf falling between them, peaceful and tender',
  },
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
  const outputDir = path.join(PROJECT_ROOT, 'lora-training-data', 'style_cream_v2');
  fs.mkdirSync(outputDir, { recursive: true });

  const startIdx = parseInt(process.argv[2] || '0', 10);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  GENERATING Cream Storybook V2 — Fantasy & Humor`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Images: ${SCENES.length} (starting from ${startIdx + 1})`);
  console.log(`${'═'.repeat(60)}`);

  let success = 0;
  let failed = 0;

  for (let i = startIdx; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const scenePrompt = typeof scene === 'string' ? scene : scene.prompt;
    const useHeroPrefix = (typeof scene !== 'string' && scene.prefix === 'hero');
    const customFilename = (typeof scene !== 'string' && scene.filename) ? scene.filename : null;

    const prefix = useHeroPrefix ? HERO_PREFIX : STYLE_PREFIX;
    const fullPrompt = `${prefix} ${scenePrompt}`;

    console.log(`\n  [${i + 1}/${SCENES.length}] ${scenePrompt.substring(0, 70)}...`);
    if (useHeroPrefix) console.log(`  ★ HERO IMAGE — pure white background`);

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
      const filename = customFilename
        ? `${customFilename}.png`
        : `cream_v2_${padded}.png`;
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
