/**
 * Phase 1 v4b-reference — tuned subset (classroom + clinic only).
 *
 * Goals: reduce amber/yellow wash, no text artifacts, stronger character design.
 * STRICT: images.edit + style refs — NO silent fallback.
 *
 * Usage:
 *   npx tsx scripts/run-style-audition-phase1-v4b-reference.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { mkdir, readdir, writeFile, copyFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  generateGPTImage,
  GPT_IMAGE_EDIT_MAX_REFERENCES,
  STYLE_REFERENCE_PREFIX,
} from '../lib/generate-image';
import { SHARED_STYLE_BRIEF, STYLE_AUDITION_SCENES } from './style-audition-shared';

process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

const RUN_LABEL = 'v4b-reference';
const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '01');
const V4_COMPARE_DIR =
  'image-experiment-1/style-audition-phase1-v4-reference-2026-05-25-c51f7e4a';

const STYLE_REFERENCE_INSTRUCTION =
  "Use the attached reference images only as a visual STYLE reference. Match their premium cinematic children's-book illustration quality: rich full environments, controlled lively linework, painterly depth, balanced natural lighting, charming designed characters, and dense visual storytelling. Do not copy their content, characters, animals, creatures, objects, poses, scene layout, or composition. Create the scene described below as a new original image in that visual style.";

/** v4b: drop golden/amber-heavy refs from v4 subset (forest, porch, puppy, dentist). */
const V4B_REFERENCE_CATALOG: Array<{
  filename: string;
  tags: string[];
  v4bInclude: boolean;
  excludeReason?: string;
}> = [
  {
    filename: 'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
    tags: ['indoor', 'bedroom-night', 'balanced-warm-cool', 'premium-polish'],
    v4bInclude: true,
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
    tags: ['outdoor', 'bright-daylight', 'clean-wb', 'premium-polish'],
    v4bInclude: true,
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_59_17 AM.png',
    tags: ['forest', 'golden-dappled-haze'],
    v4bInclude: false,
    excludeReason: 'v4: golden-green atmospheric haze — amber wash risk for indoor scenes',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
    tags: ['puppy', 'stone-steps', 'strong-amber-cast'],
    v4bInclude: false,
    excludeReason: 'pervasive yellow/amber cast',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
    tags: ['dentist', 'dense-indoor'],
    v4bInclude: false,
    excludeReason: 'v4 clinic run showed strong amber; dentist waiting-room warmth may globalize',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_12_02 PM.png',
    tags: ['night-porch', 'lantern-glow', 'golden-warmth'],
    v4bInclude: false,
    excludeReason: 'golden lantern + warm porch glow — global warm wash risk',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
    tags: ['night-outdoor', 'cool-blue-wb', 'premium-cinematic'],
    v4bInclude: true,
  },
];

const V4B_USED_FILENAMES = V4B_REFERENCE_CATALOG.filter((r) => r.v4bInclude).map((r) => r.filename);

const V4B_COLOR_BLOCK =
  '[COLOR & LIGHT — CRITICAL]\n' +
  'NO global yellow, amber, orange, sepia, or golden wash across the image. Warmth may appear ONLY from small local sources (a lamp bulb, sun patch on one surface) — never tinting the whole room.\n' +
  'Clean true whites and creams on walls, paper, bedding, and ceilings. Cooler blue-green-balanced shadows in corners and under furniture. Honest neutral midtones.\n' +
  'This scene uses BRIGHT TRUE DAYLIGHT: cool-neutral window light fills the room; surfaces read as naturally lit, not candlelit or sunset-filtered.';

const V4B_CHARACTER_BLOCK =
  '[CHARACTER — CRITICAL]\n' +
  'The child is a cute, carefully designed storybook character: large expressive eyes with life, soft rounded face, charming proportions, defined features, and visible personality (curious, gentle, alive). NOT a plain generic nursery illustration. NOT a toy-like doll face.';

const V4B_NO_TEXT_BLOCK =
  '[NO TEXT — CRITICAL]\n' +
  'No readable text anywhere: no letters, numbers, alphabet charts, words on posters, signs, labels, book titles, chalkboard writing, or UI. Wall art must be purely pictorial (shapes, animals, landscapes, abstract color blocks) with zero legible characters.';

const V4B_AVOIDANCE_BLOCK =
  'No global yellow/amber/orange/sepia/golden color grading. No alphabet posters. No readable words. No animals or creatures from references unless scene requires. No photorealism. No flat vector cartoon. No generic nursery-book simplification. No dentist waiting room copy. No composition copy from references.';

const V4B_SCENES = STYLE_AUDITION_SCENES.filter((s) => ['classroom', 'clinic'].includes(s.slug));

const SCENE_TUNING: Record<string, string> = {
  classroom:
    'Bright mid-morning classroom: large windows on one side pour in cool-neutral daylight; white walls and pale wood stay clean, not orange. Chalkboard is empty green slate with NO writing. Posters show only pictures (houses, trees, suns) with NO words. Desks, plants, books, art supplies, and children\'s drawings create a rich lived-in room.',
  clinic:
    'Bright daytime pediatric clinic: cool daylight from a curtained window; white and cream walls stay neutral, not amber. Examination bed, supply jars, pictorial wall art with NO words or labels. Friendly, calm, richly detailed room — NOT a dentist waiting room layout.',
};

function buildV4bPrompt(sceneLine: string, slug: string): string {
  const tuning = SCENE_TUNING[slug] ?? '';
  return [
    STYLE_REFERENCE_INSTRUCTION,
    '',
    V4B_COLOR_BLOCK,
    '',
    V4B_CHARACTER_BLOCK,
    '',
    V4B_NO_TEXT_BLOCK,
    '',
    SHARED_STYLE_BRIEF,
    '',
    tuning,
    '',
    sceneLine,
  ].join('\n');
}

async function loadV4bReferences() {
  if (!existsSync(STYLE_REF_DIR)) {
    throw new Error(`Style reference directory missing: ${STYLE_REF_DIR}`);
  }
  const dirFiles = await readdir(STYLE_REF_DIR);
  for (const name of V4B_USED_FILENAMES) {
    if (!dirFiles.includes(name)) throw new Error(`Missing reference: ${name}`);
  }
  const usedPaths = V4B_USED_FILENAMES.map((f) => path.join(STYLE_REF_DIR, f));
  return {
    usedFilenames: V4B_USED_FILENAMES,
    usedPaths,
    subsetReason:
      `v4b curated ${V4B_USED_FILENAMES.length} refs (max ${GPT_IMAGE_EDIT_MAX_REFERENCES}): ` +
      'bedroom balanced WB + premium polish, bridge bright daylight, cool blue night cinematic. ' +
      'Removed from v4 set: forest golden haze, magical porch lantern, puppy amber steps, dentist indoor (clinic amber in v4).',
    excluded: V4B_REFERENCE_CATALOG.filter((r) => !r.v4bInclude),
  };
}

async function copyV4Comparison(outDir: string) {
  const compareDir = path.join(outDir, 'compare-v4');
  await mkdir(compareDir, { recursive: true });
  const pairs = [
    ['scene-02-classroom.png', 'v4-classroom.png'],
    ['scene-03-clinic.png', 'v4-clinic.png'],
  ];
  for (const [srcName, destName] of pairs) {
    const src = path.join(process.cwd(), V4_COMPARE_DIR, srcName);
    if (existsSync(src)) {
      await copyFile(src, path.join(compareDir, destName));
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY is required.');
    process.exit(1);
  }

  const refs = await loadV4bReferences();
  const runId = randomUUID().slice(0, 8);
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-phase1-${RUN_LABEL}-${new Date().toISOString().slice(0, 10)}-${runId}`
  );
  await mkdir(outDir, { recursive: true });
  await copyV4Comparison(outDir);

  console.log(`=== Phase 1 ${RUN_LABEL} (classroom + clinic tuning) ===`);
  console.log(`Model: gpt-image-1 | required: images.edit`);
  console.log(refs.subsetReason);
  console.log(`Refs: ${refs.usedFilenames.join(' | ')}`);
  console.log(`Compare v4: ${V4_COMPARE_DIR} → ${outDir}/compare-v4/`);
  console.log(`Output: ${outDir}\n`);

  const sceneResults: Record<string, unknown>[] = [];

  for (const scene of V4B_SCENES) {
    const fullPrompt = buildV4bPrompt(scene.sceneLine, scene.slug);
    const filename = `scene-${scene.id}-${scene.slug}.png`;
    const dest = path.join(outDir, filename);

    console.log(`--- Scene ${scene.slug} ---`);
    const generated = await generateGPTImage({
      finalPrompt: fullPrompt,
      negativePrompt: V4B_AVOIDANCE_BLOCK,
      referenceImages: refs.usedPaths,
      referenceMode: 'style',
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: 'high',
    });

    if (generated.apiMode !== 'images.edit') {
      throw new Error(`HARD STOP: expected images.edit, got ${generated.apiMode}`);
    }
    if (generated.referenceCountPassed === 0) {
      throw new Error('HARD STOP: zero references passed');
    }

    await writeFile(dest, generated.buffer);
    await writeFile(
      path.join(outDir, `scene-${scene.id}-${scene.slug}-prompt.txt`),
      fullPrompt + '\n\n--- avoidance ---\n' + V4B_AVOIDANCE_BLOCK + '\n',
      'utf8'
    );

    console.log(
      `[saved] ${filename} mode=${generated.apiMode} refs=${generated.referenceCountPassed}/${generated.referenceCountRequested}`
    );

    sceneResults.push({
      slug: scene.slug,
      outputPath: filename,
      apiMode: generated.apiMode,
      model: generated.model,
      referenceFilenamesUsed: refs.usedFilenames,
      referenceCountPassed: generated.referenceCountPassed,
      fullPrompt,
      durationMs: generated.durationMs,
      fallbackUsed: false,
      compareV4: path.join('compare-v4', `v4-${scene.slug}.png`),
      bleedReport: {
        level: 'pending_cto_review',
        notes: `Compare to v4 in compare-v4/v4-${scene.slug}.png`,
      },
    });
  }

  const manifest = {
    phase: '1-v4b-reference',
    experiment: 'style-reference-tuning',
    generatedAt: new Date().toISOString(),
    model: 'gpt-image-1',
    requiredApiMode: 'images.edit',
    silentFallbackAllowed: false,
    scenesRun: ['classroom', 'clinic'],
    tuningGoals: [
      'reduce amber/yellow global wash',
      'no text artifacts',
      'stronger character appeal',
      'keep reference-style richness',
    ],
    styleReferences: {
      directory: STYLE_REF_DIR,
      usedFilenames: refs.usedFilenames,
      usedCount: refs.usedFilenames.length,
      subsetReason: refs.subsetReason,
      excludedFromV4: refs.excluded,
      catalog: V4B_REFERENCE_CATALOG,
    },
    promptBlocks: {
      styleReferenceInstruction: STYLE_REFERENCE_INSTRUCTION,
      colorBlock: V4B_COLOR_BLOCK,
      characterBlock: V4B_CHARACTER_BLOCK,
      noTextBlock: V4B_NO_TEXT_BLOCK,
      sharedStyleBrief: SHARED_STYLE_BRIEF,
      sceneTuning: SCENE_TUNING,
      avoidanceBlock: V4B_AVOIDANCE_BLOCK,
    },
    compareAgainstV4: V4_COMPARE_DIR,
    scenes: sceneResults,
    notes: ['Style-only. Do NOT proceed to Phase 2 until CTO approves.'],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(
    path.join(outDir, 'bleed-report.md'),
    [
      '# v4b-reference bleed report',
      '',
      '## vs v4 (same scenes)',
      '',
      '| Scene | v4 | v4b |',
      '|-------|----|-----|',
      '| classroom | `compare-v4/v4-classroom.png` | `scene-02-classroom.png` |',
      '| clinic | `compare-v4/v4-clinic.png` | `scene-03-clinic.png` |',
      '',
      '## CTO checks',
      '',
      '- Amber/yellow wash reduced vs v4?',
      '- No alphabet/text on walls?',
      '- Character less generic/toy-like?',
      '- Environment still rich (not v2-simple)?',
      '- No creature/content bleed',
      '',
      '## Per scene',
      '',
      '### classroom — pending_cto_review',
      '',
      '### clinic — pending_cto_review',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log('\n=== v4b-reference complete ===');
  console.log(outDir);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-phase1-v4b-reference.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
