/**
 * Phase 1 — STYLE AUDITION (text-to-image only, no book pipeline).
 *
 * Provider: gpt-image-1 via images.generate — NO reference photos, NO images.edit.
 *
 * Usage:
 *   npx tsx scripts/run-style-audition-phase1.ts
 *   npx tsx scripts/run-style-audition-phase1.ts --scene 3   # single scene (cheap retry)
 *   npx tsx scripts/run-style-audition-phase1.ts --scenes bedroom-night,classroom,clinic,forest
 *
 * Requires: OPENAI_API_KEY
 * Output: image-experiment-1/style-audition-phase1-<date>-<id>/
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage } from '../lib/generate-image';

/** Locked for Phase 1 — do not use gpt-image-2 until CTO approves style (Phase 2). */
process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

export const STYLE_BRIEF_VERSION = 'v2';

export const SHARED_STYLE_BRIEF =
  "A polished, premium children's picture-book illustration — rich, cinematic, warm and magical, but controlled and readable. Clean delicate storybook linework defines the main forms; painterly gouache and watercolor texture with clear readable shapes — NOT a loose, hazy, muddy watercolor wash. A complete, fully-realized world fills the frame: a detailed environment with foreground, midground and background — furniture, plants, props, light sources, small objects to discover — every element charming and readable, never smeared or noisy. Warm and cozy with a touch of magic; motivated, gently dramatic lighting — warm glow from lamps, lanterns or windows against cooler shadows; grounded, believable space and depth, still clearly illustrated. The child is a cute, appealing, carefully designed character — expressive eyes, soft rounded face, charming proportions, defined features, real personality and warmth. The quality of a beloved modern premium printed picture book. NOT photorealistic. NOT flat vector cartoon. NOT overly digital or plastic. NOT a hazy or muddy watercolor wash. NOT generic soft watercolor. NOT a character on blank paper. Bright, clean, true color — clear whites, honest midtones, no yellow/sepia/muddy wash, never dim.";

const CHILD_ARCHETYPE =
  'Young child protagonist (around 5 years old, soft rounded features, expressive eyes).';

export const STYLE_AUDITION_SCENES: Array<{ id: string; slug: string; sceneLine: string }> = [
  {
    id: '01',
    slug: 'bedroom-night',
    sceneLine:
      "A child's cozy bedroom at night — a bed, a window showing the moon and stars, shelves with toys and books, a small lamp glowing softly. The child is on the bed.",
  },
  {
    id: '02',
    slug: 'classroom',
    sceneLine:
      "A warm, lived-in classroom — wooden desks, a chalkboard, posters and children's art on the walls, plants on the windowsill. The child stands among the desks.",
  },
  {
    id: '03',
    slug: 'clinic',
    sceneLine:
      "A friendly children's clinic room — an examination bed, a shelf of jars and supplies, a curtained window, gentle posters on the wall. The child sits in the room.",
  },
  {
    id: '04',
    slug: 'forest',
    sceneLine:
      'A lush forest in dappled afternoon light — tall trees, ferns, mushrooms, soft light falling through the leaves, a winding path. The child walks the path.',
  },
  {
    id: '05',
    slug: 'night-outdoors',
    sceneLine:
      'A magical night outdoors — a deep starry sky, a crescent moon, fireflies, a glowing lantern, hills in the distance. The child stands outside, looking up in wonder.',
  },
  {
    id: '06',
    slug: 'cottage-garden',
    sceneLine:
      'A cottage and its garden in warm afternoon light — flowers, a winding stone path, a low fence, a leafy tree, a watering can. The child is in the garden.',
  },
];

const NEGATIVE_PROMPT =
  'text, letters, words, numbers, watermark, signature, logo, caption, UI, frame border, photorealistic photo, 3D render, flat vector cartoon, sticker cutout, blank white background, empty cream paper, sepia filter, heavy yellow cast, muddy wash, hazy blur, loose watercolor bleed, smeared details, dim muddy lighting, plastic skin';

function buildScenePrompt(sceneLine: string): string {
  return [SHARED_STYLE_BRIEF, CHILD_ARCHETYPE, sceneLine].join('\n\n');
}

function resolveOneSceneToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const normalized = trimmed.padStart(2, '0');
  const byId = STYLE_AUDITION_SCENES.find((s) => s.id === normalized);
  if (byId) return byId;
  const bySlug = STYLE_AUDITION_SCENES.find((s) => s.slug === trimmed);
  if (bySlug) return bySlug;
  return null;
}

function parseSceneFilters(argv: string[]): string[] | null {
  const scenesIdx = argv.indexOf('--scenes');
  if (scenesIdx !== -1) {
    const raw = (argv[scenesIdx + 1] ?? '').trim();
    if (!raw) {
      console.error('Usage: --scenes <slug1,slug2,...>');
      process.exit(1);
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const sceneIdx = argv.indexOf('--scene');
  if (sceneIdx !== -1) {
    const raw = (argv[sceneIdx + 1] ?? '').trim();
    if (!raw) {
      console.error('Usage: --scene <1-6|01-06|slug>');
      process.exit(1);
    }
    return [raw];
  }
  return null;
}

function selectScenes(filters: string[] | null) {
  if (!filters) return STYLE_AUDITION_SCENES;
  const picked: typeof STYLE_AUDITION_SCENES = [];
  for (const token of filters) {
    const scene = resolveOneSceneToken(token);
    if (!scene) {
      console.error(`Unknown scene "${token}". Use 1-6 or slug: ${STYLE_AUDITION_SCENES.map((s) => s.slug).join(', ')}`);
      process.exit(1);
    }
    if (!picked.some((p) => p.id === scene.id)) picked.push(scene);
  }
  return picked;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY is required.');
    process.exit(1);
  }

  const runId = randomUUID().slice(0, 8);
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-phase1-${STYLE_BRIEF_VERSION}-${new Date().toISOString().slice(0, 10)}-${runId}`
  );
  await mkdir(outDir, { recursive: true });

  const sceneFilters = parseSceneFilters(process.argv);
  const scenes = selectScenes(sceneFilters);

  console.log(`=== Phase 1 — Style Audition ${STYLE_BRIEF_VERSION} (gpt-image-1, text-only) ===`);
  console.log(`Model: ${process.env.GPT_IMAGE_MODEL} | mode: images.generate | size: 1024x1536`);
  console.log(`Scenes: ${scenes.length} | output: ${outDir}\n`);

  const results: Array<{
    sceneId: string;
    slug: string;
    sceneLine: string;
    fullPrompt: string;
    filename: string;
    model: string;
    hasReferencePhoto: boolean;
    durationMs: number;
    bytes: number;
  }> = [];

  for (const scene of scenes) {
    const fullPrompt = buildScenePrompt(scene.sceneLine);
    const filename = `scene-${scene.id}-${scene.slug}.png`;
    const dest = path.join(outDir, filename);

    console.log(`--- Scene ${scene.id}: ${scene.slug} ---`);
    console.log(`[prompt] ${fullPrompt.length} chars`);

    const generated = await generateGPTImage({
      finalPrompt: fullPrompt,
      negativePrompt: NEGATIVE_PROMPT,
      referenceImages: [],
      size: '1024x1536',
      quality: 'high',
    });

    if (generated.hasReferencePhoto) {
      throw new Error('Phase 1 violation: reference photo path was used (expected images.generate only).');
    }
    if (generated.model !== 'gpt-image-1') {
      throw new Error(`Phase 1 violation: expected gpt-image-1, got ${generated.model}`);
    }

    await writeFile(dest, generated.buffer);
    await writeFile(
      path.join(outDir, `scene-${scene.id}-${scene.slug}-prompt.txt`),
      `${fullPrompt}\n\n--- negative ---\n${NEGATIVE_PROMPT}\n`,
      'utf8'
    );

    results.push({
      sceneId: scene.id,
      slug: scene.slug,
      sceneLine: scene.sceneLine,
      fullPrompt,
      filename,
      model: generated.model,
      hasReferencePhoto: generated.hasReferencePhoto,
      durationMs: generated.durationMs,
      bytes: generated.buffer.length,
    });

    console.log(`[saved] ${filename} (${Math.round(generated.buffer.length / 1024)} KB, ${generated.durationMs}ms)\n`);
  }

  const manifest = {
    phase: 1,
    experiment: 'style-audition',
    generatedAt: new Date().toISOString(),
    provider: 'openai',
    model: 'gpt-image-1',
    apiMode: 'images.generate',
    size: '1024x1536',
    aspectRatio: '2:3',
    referenceImages: false,
    styleBriefVersion: STYLE_BRIEF_VERSION,
    sharedStyleBrief: SHARED_STYLE_BRIEF,
    childArchetype: CHILD_ARCHETYPE,
    negativePrompt: NEGATIVE_PROMPT,
    ctoCriteria: [
      'clean precise linework without digital/plastic',
      'controlled gouache/watercolor clarity, not hazy/muddy/loose',
      'rich readable environment',
      'cute well-designed appealing child character',
      'clear focal point',
      'premium printed storybook polish',
      'grounded believable lighting and space',
      'bright true color, no yellow/sepia/muddy wash',
      'clearly illustrated, not photoreal',
      'not flat cartoon',
      'no text artifacts',
    ],
    scenes: results,
    notes: [
      'Phase 1 tests style/environment only — not book-level identity consistency.',
      'Do NOT proceed to Phase 2 until CTO approves shared style brief.',
      'Iterate SHARED_STYLE_BRIEF in this script (2-3 rounds max) if needed.',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(
    path.join(outDir, 'shared-style-brief.txt'),
    `${SHARED_STYLE_BRIEF}\n`,
    'utf8'
  );

  console.log('=== Phase 1 complete ===');
  console.log(`Output: ${outDir}`);
  console.log(`Manifest: ${path.join(outDir, 'manifest.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
