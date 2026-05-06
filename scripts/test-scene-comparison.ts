/**
 * Test a real storybook scene in both styles side-by-side.
 * Portrait 2:3 aspect ratio like the actual book pages.
 *
 * Usage: npx tsx scripts/test-scene-comparison.ts
 */

import 'dotenv/config';
import Replicate from 'replicate';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const token = process.env.REPLICATE_API_TOKEN;
if (!token) { console.error('Missing REPLICATE_API_TOKEN'); process.exit(1); }

const replicate = new Replicate({ auth: token });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Scene Description ──
// A real storybook moment: girl sitting on her bed at night, fox peeks through window
const SCENE = `A 5-year-old girl with long brown wavy hair sits on her bed in her cozy bedroom at night. She wears soft pajamas. The room has warm colors — a small bedside lamp glows softly, there are stuffed animals on the bed, children's drawings on the wall, a bookshelf in the corner. Through the window beside the bed, a small friendly fox peeks in from outside, its front paws on the windowsill, looking at the girl with bright curious eyes. The girl turns toward the window with a surprised, delighted expression — she just noticed the fox. Camera angle: medium shot from slightly above, showing the girl on the bed in the foreground and the window with the fox to the right. Nighttime blue-purple sky visible through the window. Warm interior light contrasts with cool moonlight from outside. No text, no letters, no UI, no captions.`;

const STYLE_01_MODEL = process.env.LORA_MODEL_STYLE_01 || 'smallheroes/sh-realistic-artistic';
const STYLE_02_MODEL = process.env.LORA_MODEL_STYLE_02 || 'smallheroes/sh-pencil-storybook';

interface StyleConfig {
  id: string;
  file: string;
  model: string;
  loraTriggerWord: string;
  loraStylePrefix: string;
  prompt: string;
}

const STYLES: StyleConfig[] = [
  {
    id: 'style01_realistic',
    file: 'test-outputs/scene_style01_bedroom.jpg',
    model: STYLE_01_MODEL,
    loraTriggerWord: 'REALISTART01',
    loraStylePrefix: 'realistic artistic portrait, warm watercolor background dissolution, characters in sharp detail with surroundings fading to warm washes, cinematic lighting,',
    prompt: `Realistic artistic portrait — girl rendered in sharp painterly detail, background dissolving into soft warm watercolor washes. Only partial room elements visible near her (bed edge, lamp glow, window frame) — the rest fades to abstract warm amber and cream tones. Top 20-30% of image is open warm space. Cinematic warm lamp light on the girl, cool moonlight from window. Painterly realism like a fine art oil painting. The fox on the windowsill looks directly at the girl with bright curious eyes — emotional connection between them. The girl turns toward the fox with wonder and delight. ${SCENE} No hard rectangular borders, no picture frame. No fully detailed room edge-to-edge. No cartoon, no flat illustration, no anime, no Pixar.`,
  },
  {
    id: 'style02_pencil',
    file: 'test-outputs/scene_style02_bedroom.jpg',
    model: STYLE_02_MODEL,
    loraTriggerWord: 'PENCILSTYLE02',
    loraStylePrefix: 'pencil illustration on cream paper, soft watercolor touches, hand-drawn storybook, clear character focus,',
    prompt: `Charming pencil illustration on warm cream paper with soft watercolor touches. Cute expressive girl character drawn prominently — filling at least 50% of the image height. Soft pencil lines, gentle muted watercolor washes. Top area is cream paper space for text. The fox on the windowsill looks at the girl with bright eyes — they share a moment of wonder. ${SCENE} The girl and the fox are clearly separate characters — the girl has no tail or animal features, the fox has 4 legs and its own body. No picture frame borders. No full-color painting, no busy over-detailed backgrounds, no digital look, no CGI, no Pixar, no anime, no tiny figures.`,
  },
];

async function resolveVersionPinned(slug: string): Promise<string> {
  if (slug.includes(':')) return slug;
  const parts = slug.split('/');
  if (parts.length !== 2) return slug;
  const [owner, modelName] = parts;
  try {
    const modelInfo = await replicate.models.get(owner, modelName);
    const version = modelInfo.latest_version?.id;
    if (version) {
      const pinned = `${owner}/${modelName}:${version}`;
      console.log(`[version] ${slug} → ${pinned}`);
      return pinned;
    }
  } catch (e) {
    console.warn(`[version] Could not resolve ${slug}, using as-is`);
  }
  return slug;
}

async function generate(style: StyleConfig) {
  const model = await resolveVersionPinned(style.model);
  const prompt = `${style.loraTriggerWord} style, ${style.loraStylePrefix} ${style.prompt}`;

  console.log(`\n[gen] ${style.id}`);
  console.log(`[model] ${model}`);
  console.log(`[prompt] ${prompt.slice(0, 250)}...`);

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

  const outPath = join(process.cwd(), style.file);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`[saved] ${style.file} (${Math.round(buffer.length / 1024)} KB)`);
}

async function main() {
  console.log('=== Scene Comparison Test ===');
  console.log('Scene: Girl on bed at night, fox peeks through window');
  console.log(`Style 01: ${STYLE_01_MODEL}`);
  console.log(`Style 02: ${STYLE_02_MODEL}`);
  console.log('Aspect ratio: 2:3 (portrait, like actual book pages)\n');

  await generate(STYLES[0]);
  console.log('\n[wait] 12s cooldown...');
  await sleep(12_000);
  await generate(STYLES[1]);

  console.log('\n=== Done — check test-outputs/ ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
