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

import {
  CHILD_ARCHETYPE,
  SHARED_STYLE_BRIEF,
  STYLE_AUDITION_SCENES,
  STYLE_BRIEF_VERSION,
} from './style-audition-shared';

export { CHILD_ARCHETYPE, SHARED_STYLE_BRIEF, STYLE_AUDITION_SCENES, STYLE_BRIEF_VERSION };

const NEGATIVE_PROMPT =
  'text, letters, words, numbers, watermark, signature, logo, caption, UI, frame border, photorealistic photo, 3D render, flat vector cartoon, sticker cutout, blank white background, empty cream paper, global amber wash, orange cast, sepia filter, yellow tint, muddy wash, hazy blur, loose watercolor bleed, smeared details, simplified sparse room, generic nursery illustration, toy-like doll face, plastic skin, visual chaos';

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
      'rich dense lived-in environment — not simplified',
      'clear focal hierarchy — not visual chaos',
      'layered depth and atmosphere',
      'clean confident linework',
      'cute appealing character with real expression — not toy-like/generic',
      'premium cinematic quality matching reference images',
      'warmth only from local light sources — no global amber/orange/sepia wash',
      'clean true whites, cooler shadows',
      'not muddy, not flat, not generic, not photoreal',
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

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-phase1.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
