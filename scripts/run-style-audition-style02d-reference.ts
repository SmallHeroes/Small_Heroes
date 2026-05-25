/**
 * Style 02d — precise target reset (semi-realistic cinematic fantasy).
 * Scene-typed refs; aggressive density + lighting vs Guy's Style 02 folder.
 *
 * Usage: npx tsx scripts/run-style-audition-style02d-reference.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { copyFile, mkdir, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage } from '../lib/generate-image';
import { STYLE_AUDITION_SCENES } from './style-audition-shared';

process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

const RUN_LABEL = 'style02d-reference';
const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '02');
const COMPARE_STYLE02C_DIR =
  'image-experiment-1/style-audition-style02c-reference-2026-05-25-ef6b9db6';

export const STYLE_02D_BRIEF =
  'Semi-realistic cinematic fantasy storybook illustration — a separate visual lane from soft watercolor Style 01. Match high-end fantasy picture book / animated film concept-art hybrid: rich, immersive, highly detailed fantasy worlds with dramatic lighting, realistic materials, strong depth, premium cinematic polish.\n\n' +
  'VISUAL DNA: Semi-realistic illustrated fantasy (not soft watercolor). Rich cinematic lighting — motivated lanterns, moonlight, sunbeams, rim light, volumetric light, particles, fireflies, glowing mushrooms. Stronger contrast than Style 01: deep shadows, bright highlights, clear focal light. Dense environmental storytelling — every part of the frame has meaningful detail. Layered world depth: active readable foreground, midground, background. Highly detailed materials: wood grain, fabric weave, stone, moss, leaves, bark, glass, metal, dust, worn paint, scratches, books, toys, shelves, tools, plants. Magical but grounded with believable space and real texture.\n\n' +
  'DISTINCTION: Not photorealistic does NOT mean soft, flat, pale, watercolor, or simple. Be MORE realistic, dimensional, rendered, detailed, and cinematic than Style 01. Avoid literal camera realism only.\n\n' +
  'ENVIRONMENT: Fill the frame with layered details — no large empty areas. Background as interesting as the character. Discoverable micro-details in every corner. Do not simplify for cleanliness.\n\n' +
  'LIGHTING: Stronger and more dramatic than prior attempts. Clear motivated sources; visible contrast and atmosphere. No flat ambient light. No pale global orange/yellow wash — warmth only from real sources.\n\n' +
  'RENDERING: Precise detailed linework + rich painterly rendering. Fine ink detail and visible paint texture OK. No muddy wash, loose watercolor blur, or messy noise. Polished, premium, dense, controlled.\n\n' +
  'CHARACTER: Cute but semi-realistic child — better anatomy, nuanced face, rich hair volume, fabric folds, dimensional face lighting, believable skin light, expressive eyes. NOT nursery cartoon, NOT toy/doll, NOT Pixar-smooth plastic CGI, NOT giant empty eyes.\n\n' +
  'NOT Style 01. NOT soft watercolor. NOT pale nursery. NOT simple cute cartoon. NOT flat vector. NOT sparse background. NOT Pixar/Disney 3D. NOT plastic CGI. NOT camera photo. NOT muddy. NOT global orange/yellow wash. NOT generic children\'s book.';

const STYLE_REFERENCE_INSTRUCTION =
  'Use attached references aggressively for RENDERING QUALITY, cinematic lighting, material richness, density, and depth — borrow their polish and semi-realistic fantasy illustration DNA. Do NOT copy exact creatures, Hebrew/English text, signs, composition, poses, or scene layout. Create a new original scene below. Much more realistic, dimensional, rendered, and cinematic than Style 01 — still hand-illustrated fantasy, not a literal photograph or plastic CGI.';

const NO_TEXT_BLOCK =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, or book titles. Pictorial/abstract marks only.';

const AVOIDANCE_BLOCK =
  'No copied owls, dragons, turtles, fairies, giants, or reference creatures unless scene requires. No readable text. No Style-01 soft watercolor look. No sparse empty rooms. No flat ambient lighting. No global orange/yellow filter. No Pixar-smooth 3D child. No literal photograph.';

const CHILD_BLOCK =
  'Child protagonist (~5): semi-realistic designed character — dimensional face lighting, believable hair volume, fabric folds, nuanced expression, child-friendly but NOT nursery cartoon or doll face.';

const SCENES = STYLE_AUDITION_SCENES.filter((s) =>
  ['bedroom-night', 'classroom', 'clinic', 'forest'].includes(s.slug)
);

const REF_SUBSETS: Record<string, { filenames: string[]; reason: string }> = {
  'bedroom-night': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_28 AM.png',
      'ChatGPT Image May 18, 2026, 11_41_49 AM.png',
      'ChatGPT Image May 18, 2026, 12_49_00 PM.png',
      'ChatGPT Image May 18, 2026, 01_45_01 PM.png',
    ],
    reason:
      'Four dense packed bedroom-night refs (shelves, toys, clutter, lamp/moon contrast). Style-only borrow; block owl/mirror creatures and all text.',
  },
  classroom: {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
    ],
    reason:
      'Daytime bright anchor + dimensional village materials + garden detail + hyper-rendered texture ref. No night-bedroom refs.',
  },
  clinic: {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
    ],
    reason:
      'Bright interior + dark study material richness (jars, wood, books — no dragon) + hyper-render + dimensional architecture.',
  },
  forest: {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_36 AM.png',
      'ChatGPT Image May 18, 2026, 02_39_29 PM.png',
      'ChatGPT Image May 18, 2026, 02_05_22 PM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
    ],
    reason:
      'Fairy-village + mushroom-forest + magical lantern forest + hyper-rendered foliage. Aggressive fantasy-world density; child must stay human child not fairy.',
  },
};

const SCENE_BODY: Record<string, string> = {
  'bedroom-night':
    "A child's cozy bedroom at night — packed like premium fantasy references: shelves overflowing with books and toys, posters and curtains, lamps, window with moon and stars, patterned fabrics, floor clutter, tiny discoverable objects everywhere. Strong lamp vs moonlight contrast, rim light, volumetric glow, deep shadows. The child is on the bed. NOT sparse.",
  classroom:
    'Bright daytime classroom but cinematically rich: strong sunbeams through large windows, dust motes in light beams, desks crowded with books papers art tools, plants, shelves, textured wood floor and walls, deep perspective, layered foreground objects. Child stands among desks. NO lanterns, candles, fireflies, or night mood. NOT pale nursery.',
  clinic:
    "Fantasy-rich bright children's clinic: shelves of glass jars and tools, wooden cabinets, fabric curtains, tiled floor, plants, toys, pictorial posters without words, light beams from windows, detailed props and worn materials everywhere. Child sits in room. Friendly, dimensional, NOT soft nursery. NO dusk lanterns.",
  forest:
    'Magical forest path with fairy-village-level depth: layered foliage, textured bark, moss, glowing mushrooms, stones, ferns, sunbeams or lantern glow through trees, atmospheric depth, firefly-like particles, tiny discoverable details in roots and leaves. Child walks path. Much more micro-detail and deep space — NOT flat cartoon forest. No tiny houses unless naturally distant in background.',
};

function buildPrompt(slug: string): string {
  return [
    STYLE_REFERENCE_INSTRUCTION,
    NO_TEXT_BLOCK,
    STYLE_02D_BRIEF,
    CHILD_BLOCK,
    SCENE_BODY[slug],
  ].join('\n\n');
}

async function copyCompare(outDir: string) {
  const d = path.join(outDir, 'compare-style02c');
  await mkdir(d, { recursive: true });
  const prior = path.join(process.cwd(), COMPARE_STYLE02C_DIR);
  if (!existsSync(prior)) return;
  for (const s of SCENES) {
    const src = path.join(prior, `scene-${s.id}-${s.slug}.png`);
    if (existsSync(src)) await copyFile(src, path.join(d, `style02c-${s.slug}.png`));
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY required');
    process.exit(1);
  }

  const files = await readdir(STYLE_REF_DIR);
  for (const sub of Object.values(REF_SUBSETS)) {
    for (const f of sub.filenames) {
      if (!files.includes(f)) throw new Error(`Missing: ${f}`);
    }
  }

  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-${RUN_LABEL}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  );
  await mkdir(outDir, { recursive: true });
  await copyCompare(outDir);

  console.log('=== Style 02d — precise target reset ===');
  console.log(`Output: ${outDir}`);
  console.log(`Compare 02c: ${COMPARE_STYLE02C_DIR}\n`);

  const results: Record<string, unknown>[] = [];

  for (const scene of SCENES) {
    const sub = REF_SUBSETS[scene.slug];
    const paths = sub.filenames.map((f) => path.join(STYLE_REF_DIR, f));
    console.log(`--- ${scene.slug} --- refs: ${sub.filenames.length}`);

    const gen = await generateGPTImage({
      finalPrompt: buildPrompt(scene.slug),
      negativePrompt: AVOIDANCE_BLOCK,
      referenceImages: paths,
      referenceMode: 'style',
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: 'high',
    });

    if (gen.apiMode !== 'images.edit') throw new Error(`Expected images.edit, got ${gen.apiMode}`);

    const fn = `scene-${scene.id}-${scene.slug}.png`;
    await writeFile(path.join(outDir, fn), gen.buffer);
    await writeFile(
      path.join(outDir, `scene-${scene.id}-${scene.slug}-prompt.txt`),
      buildPrompt(scene.slug) + '\n\n--- refs ---\n' + sub.filenames.join('\n'),
      'utf8'
    );
    console.log(`[saved] ${fn} refs=${gen.referenceCountPassed}/4`);

    results.push({
      slug: scene.slug,
      outputPath: fn,
      apiMode: gen.apiMode,
      referencesUsed: sub.filenames,
      subsetReason: sub.reason,
      durationMs: gen.durationMs,
    });
  }

  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        styleId: 'style_02d',
        status: 'complete',
        model: 'gpt-image-1',
        apiMode: 'images.edit',
        style02dBrief: STYLE_02D_BRIEF,
        referenceSubsets: REF_SUBSETS,
        compareStyle02c: COMPARE_STYLE02C_DIR,
        scenes: results,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  await writeFile(path.join(outDir, 'style02d-brief.txt'), STYLE_02D_BRIEF + '\n', 'utf8');

  console.log('\n=== Style 02d complete ===');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-style02d-reference.ts');
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
