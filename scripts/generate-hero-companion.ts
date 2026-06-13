/**
 * Native transparent: gpt-image-2 rejects background=transparent (API limitation as of 2026-06).
 * Flow: gpt-image-2 LOW edit → flat white bg in prompt → rembg cutout → hero-child-fox.png
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/generate-hero-companion.ts
 *
 * Optional: HERO_RENDER_HIGH=true (dev only — default LOW for marketing)
 * Optional: HERO_SKIP_REMBG=true (skip rembg fallback)
 * Output: public/Images/hero-child-fox.png (+ copy under outputs/hero-render/)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import { getCompanionById } from '../lib/companions';
import { STYLE_01_NO_TEXT } from '../lib/style01-gptimage';
import { resolveStyle01ChildTemplatePath } from '../lib/style01-child-template';

const MODEL = 'gpt-image-2';
const OUT_PUBLIC = path.join(process.cwd(), 'public', 'Images', 'hero-child-fox.png');
const FOX_SHEET = path.join(process.cwd(), 'public', 'companions', 'fox_uri', 'style01-sheets', 'front.png');
const STYLE_REF = path.join(process.cwd(), 'style-references', '01', 'style01-texture-night-window.png');

const HERO_PROMPT = [
  '[HERO CUTOUT — TRANSPARENT BACKGROUND ONLY]',
  'Image 1: Style 01 child template — copy ONLY watercolor proportions, eye size, softness, hand-drawn storybook rendering. Do NOT copy the template face identity exactly — personalize a warm generic hero child.',
  'Image 2: Canonical fox companion Uri — copy ONLY species identity: copper-tinged fur, warm lantern eyes, white chest patch, fluffy white-tipped tail, small glowing neck lantern (collar lantern). NEVER scarf. NEVER chest star.',
  'Image 3 (if present): Style 01 watercolor technique reference — linework and pigment feel only. Do NOT copy scene, creatures, or composition.',
  '',
  'TARGET: Marketing landing-page hero — child + fox friend together as a clean character cutout group on fully transparent alpha background.',
  '',
  'STYLE 01 WATERCOLOR: soft hand-drawn children\'s storybook watercolor character rendering. Gentle transparent washes, delicate linework, warm muted palette. Cute simplified proportions. NOT photoreal. NOT Style 02. NOT cinematic.',
  '',
  'BACKGROUND (for cutout): Flat pure white (#FFFFFF) only — NO cream paper panel, NO paper texture rectangle, NO scene, NO environment, NO vignette card. Characters on a single flat white field for clean alpha extraction.',
  '',
  'CHILD: Warm inviting 7–8 year old boy, FRONT-FACING toward viewer, big warm hopeful smile, eyes clearly visible, open friendly posture — emotional invitation. Generic storybook hero child (NOT a photo portrait).',
  '',
  'FOX — Uri (אוּרי): Small companion fox beside the child at correct companion scale (fox roughly knee-height). On-model from reference — clever, alert, kind, never predatory. Small glowing neck lantern lit softly.',
  '',
  'POSE: Hopeful moment-from-the-story — child and fox together as friends; child standing or kneeling, fox sitting close beside with gentle connection; warm energy.',
  '',
  'FRAMING: Full-to-mid figure duo, centered vertically, characters occupy most of frame height with transparent padding around the group.',
  '',
  STYLE_01_NO_TEXT,
].join('\n');

function formatOutDir(): string {
  const d = new Date();
  const stamp =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    '-' +
    d.toISOString().slice(11, 19).replace(/:/g, '');
  const quality = process.env.HERO_RENDER_HIGH?.trim().toLowerCase() === 'true' ? 'high' : 'low';
  return path.join(process.cwd(), 'outputs', 'hero-render', `${stamp}-${quality}`);
}

async function measureTransparency(buffer: Buffer): Promise<{ mode: string; transparentRatio: number }> {
  const meta = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 128) transparent++;
  }
  const pixels = info.width * info.height;
  return { mode: meta.hasAlpha ? 'RGBA' : 'RGB', transparentRatio: pixels ? transparent / pixels : 0 };
}

async function rembgFallback(input: Buffer): Promise<Buffer> {
  const { spawnSync } = await import('child_process');
  const py = process.env.PYTHON?.trim() || path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python312', 'python.exe');
  if (!existsSync(py)) {
    throw new Error(`rembg fallback: Python not found at ${py}`);
  }
  const tmpIn = path.join(process.cwd(), 'outputs', 'hero-render', '_rembg-in.png');
  const tmpOut = path.join(process.cwd(), 'outputs', 'hero-render', '_rembg-out.png');
  await mkdir(path.dirname(tmpIn), { recursive: true });
  await writeFile(tmpIn, input);
  const script =
    'from rembg import remove; from PIL import Image; import sys; im=Image.open(sys.argv[1]); out=remove(im); out.save(sys.argv[2], format="PNG")';
  const result = spawnSync(py, ['-c', script, tmpIn, tmpOut], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`rembg failed: ${result.stderr || result.stdout}`);
  }
  return readFile(tmpOut);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY missing — set in .env.local');
  }
  if (!existsSync(FOX_SHEET)) {
    throw new Error(`Fox reference missing: ${FOX_SHEET}`);
  }

  const boyTemplate = path.join(process.cwd(), 'style-references', '01-child-template', 'boy.png');
  const childTemplate = existsSync(boyTemplate)
    ? boyTemplate
    : resolveStyle01ChildTemplatePath('girl');
  const refs = [childTemplate, FOX_SHEET];
  if (existsSync(STYLE_REF)) refs.push(STYLE_REF);

  const companion = getCompanionById('fox_uri');
  if (!companion) throw new Error('fox_uri companion not found');

  const quality = process.env.HERO_RENDER_HIGH?.trim().toLowerCase() === 'true' ? 'high' : 'low';
  const outDir = formatOutDir();
  await mkdir(outDir, { recursive: true });
  await mkdir(path.dirname(OUT_PUBLIC), { recursive: true });

  console.log(`[hero] model=${MODEL} quality=${quality} refs=${refs.length}`);
  console.log(`[hero] companion: ${companion.name}`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const files = await Promise.all(
    refs.map(async (refPath, i) => {
      const buf = await readFile(refPath);
      return toFile(buf, path.basename(refPath), { type: 'image/png' });
    })
  );

  const response = await openai.images.edit({
    model: MODEL,
    image: files.length === 1 ? files[0] : files,
    prompt: HERO_PROMPT,
    size: '1024x1536',
    quality,
    n: 1,
    output_format: 'png',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('API returned no image data');

  let buffer = Buffer.from(b64, 'base64');
  let { transparentRatio } = await measureTransparency(buffer);
  console.log(`[hero] pre-rembg transparent ratio: ${(transparentRatio * 100).toFixed(1)}%`);

  if (process.env.HERO_SKIP_REMBG?.trim().toLowerCase() !== 'true') {
    console.log('[hero] Running rembg cutout (gpt-image-2 has no native transparent)…');
    buffer = Buffer.from(await rembgFallback(buffer));
    ({ transparentRatio } = await measureTransparency(buffer));
    console.log(`[hero] post-rembg transparent ratio: ${(transparentRatio * 100).toFixed(1)}%`);
  } else if (transparentRatio < 0.25) {
    console.warn('[hero] HERO_SKIP_REMBG=true but image is mostly opaque — hero may show a panel');
  }

  const meta = await sharp(buffer).metadata();
  await writeFile(path.join(outDir, 'hero-child-fox.png'), buffer);
  await writeFile(OUT_PUBLIC, buffer);
  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        model: MODEL,
        quality,
        size: '1024x1536',
        background: 'white-flat-then-rembg',
        output_format: 'png',
        refs,
        dimensions: { width: meta.width, height: meta.height },
        transparentRatio,
        publicPath: '/Images/hero-child-fox.png',
      },
      null,
      2
    )
  );

  console.log(`\n✓ Saved ${OUT_PUBLIC} (${meta.width}×${meta.height}, ${Math.round(buffer.length / 1024)} KB)`);
  console.log(`  Archive: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
