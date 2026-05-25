/**
 * Style 02 — STYLE-REFERENCE AUDITION (separate from Style 01).
 *
 * Cinematic fantasy storybook via gpt-image-1 images.edit + Guy's style-references/02/
 *
 * Usage:
 *   npx tsx scripts/run-style-audition-style02-reference.ts
 *   npx tsx scripts/run-style-audition-style02-reference.ts --scenes classroom,clinic
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { mkdir, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  generateGPTImage,
  GPT_IMAGE_EDIT_MAX_REFERENCES,
  STYLE_REFERENCE_PREFIX,
} from '../lib/generate-image';
import { STYLE_AUDITION_SCENES } from './style-audition-shared';

process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

const RUN_LABEL = 'style02-reference';
const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '02');

export const STYLE_02_BRIEF =
  "A premium cinematic fantasy children's-book illustration with rich hand-drawn detail. Dense magical environments fill the frame: layered foreground, midground, and background; shelves, books, toys, lanterns, plants, curtains, stones, flowers, tiny objects, hidden details, and environmental storytelling. Clear ink-like linework and fine contour detail define every object. The image should feel hand-illustrated, tactile, and crafted — not smooth, plastic, glossy, or 3D-rendered. Lighting is dramatic and motivated: lanterns, candles, moonlight, window light, fireflies, glowing objects, and warm local pools of light against deep blue-green shadows. Light may be magical and cinematic, but must come from visible sources, not a global yellow/orange wash. Characters are appealing, expressive, slightly more dimensional and detailed than soft nursery watercolor, but still clearly illustrated. Big expressive eyes are allowed; avoid toy-like doll faces. The character should feel alive, emotional, and designed. Like a premium fantasy picture book spread: immersive, atmospheric, detailed, magical, readable, emotionally warm. NOT photorealistic. NOT CGI. NOT 3D render. NOT Pixar. NOT flat vector. NOT simple nursery watercolor. NOT generic cute. NOT blank background. NOT soft hazy wash. NOT muddy. NOT global amber/orange/yellow color grading.";

const CHILD_ARCHETYPE_STYLE02 =
  'Young child protagonist (around 5 years old): expressive eyes with emotion, defined features, charming proportions, alive and designed — cinematic fantasy storybook, not nursery-doll generic.';

const STYLE_REFERENCE_INSTRUCTION =
  "Use the attached reference images only as a visual STYLE reference. Match their premium cinematic fantasy children's-book illustration quality: dense hand-drawn environments, ink-like linework, dramatic motivated lighting, rich atmosphere, and high visual storytelling density. Do not copy their content, characters, animals, creatures, objects, poses, scene layout, Hebrew/English text, signs, or composition. Create the scene described below as a new original image in that visual style.";

const STYLE_02_NO_TEXT_BLOCK =
  '[NO TEXT — CRITICAL]\n' +
  'No readable text anywhere: no Hebrew, no English, no letters, numbers, alphabet charts, book titles, signs, labels, or UI. Wall art and posters must be purely pictorial — shapes, icons, symbols, abstract marks only — zero legible characters.';

const STYLE_02_AVOIDANCE_BLOCK =
  'Do not copy owls, dragons, turtles, tortoises, fairies, butterflies, giants, magical creatures, Hebrew/English signs, or specific props/layouts from references unless the target scene explicitly requires them. No photorealism. No CGI. No 3D render. No Pixar gloss. No flat vector cartoon. No nursery watercolor simplicity. No global amber/orange/yellow/sepia grading. No readable text.';

/** Full catalog — document include/exclude for manifest. */
export const STYLE_02_REFERENCE_CATALOG: Array<{
  filename: string;
  tags: string[];
  include: boolean;
  reason: string;
}> = [
  {
    filename: 'ChatGPT Image May 18, 2026, 11_41_28 AM.png',
    tags: ['bedroom-night', 'ink-detail', 'dense-interior', 'cinematic'],
    include: true,
    reason: 'Preferred: rich illustrated bedroom, clear linework, magical motivated light',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_41_36 AM.png',
    tags: ['forest-village', 'dense-environment', 'lantern-light', 'hand-illustrated'],
    include: true,
    reason: 'Preferred: dense fantasy world-building, ink texture, cinematic depth',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
    tags: ['garden', 'turtle-character', 'hebrew-text'],
    include: false,
    reason: 'Creature-centric (tortoise); Hebrew text on signs — bleed risk',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_41_49 AM.png',
    tags: ['bedroom', 'mirror-magic', 'owl', 'hebrew-text'],
    include: false,
    reason: 'Overlaps bedroom ref; heavy Hebrew text; owl content',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
    tags: ['interior-daylight', 'window-light', 'hand-illustrated', 'readable'],
    include: true,
    reason: 'Preferred: illustrated interior with daylight — keeps classroom/clinic readable',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_49_00 PM.png',
    tags: ['bedroom', 'lantern', 'hebrew-text'],
    include: false,
    reason: 'Redundant bedroom; Hebrew wall text',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 01_45_01 PM.png',
    tags: ['bedroom', 'sparkles', 'hebrew-text'],
    include: false,
    reason: 'Redundant bedroom; Hebrew sign',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
    tags: ['village-twilight', 'hand-illustrated', 'hebrew-sign'],
    include: false,
    reason: 'Strong style but Hebrew signpost; twilight may over-darken daytime scenes',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
    tags: ['dragon-closeup', 'dark-study', 'hebrew-spines'],
    include: false,
    reason: 'Creature closeup; dark single-subject — pushes CGI-real creature render',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 02_04_04 PM.png',
    tags: ['owl-closeup', 'hebrew-sign', 'hyper-detailed'],
    include: false,
    reason: 'Owl-centric; Hebrew text; glossy cinematic realism risk',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 02_05_22 PM.png',
    tags: ['forest-night', 'fairy', 'lantern', 'ink-fantasy'],
    include: true,
    reason: 'Preferred: magical forest atmosphere, local lantern light, hand-illustrated',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
    tags: ['turtle', 'hyper-real', 'cgi-leaning', 'english-text'],
    include: false,
    reason: 'AVOID: hyper-real / 3D-miniature turtle; English book titles and signs',
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 02_39_29 PM.png',
    tags: ['mushroom-village', 'english-signs', 'dense'],
    include: false,
    reason: 'English sign text throughout; fantasy-village composition lock risk',
  },
];

const STYLE_02_USED_FILENAMES = STYLE_02_REFERENCE_CATALOG.filter((r) => r.include).map(
  (r) => r.filename
);

const SCENES = STYLE_AUDITION_SCENES.filter((s) =>
  ['bedroom-night', 'classroom', 'clinic', 'forest'].includes(s.slug)
);

const SCENE_TUNING: Record<string, string> = {
  'bedroom-night':
    '[SCENE TONE] Dark magical bedtime bedroom: moon and stars through the window, star fairy lights, warm lamp glow on a small area only, deep blue-green shadows elsewhere. Highly atmospheric and cinematic — still a real child bedroom with bed, shelves, toys, books.',
  classroom:
    '[SCENE TONE] DAYTIME classroom — must stay bright and readable. Cool-neutral daylight from large windows fills the room; it is a real school classroom with desks and chalkboard, NOT a fantasy cave or night forest. Rich illustrated detail and cinematic depth, but clearly daytime and inviting.',
  clinic:
    '[SCENE TONE] DAYTIME friendly children\'s clinic — bright, calm, welcoming, NOT gothic or creepy. Cool daylight from curtained windows; exam bed, supply shelves, pictorial wall art with NO words. Cozy atmospheric illustration but well-lit and readable.',
  forest:
    '[SCENE TONE] Magical forest path in afternoon/evening: deep greens, layered foliage, dappled light, optional soft glowing particles from plants or fireflies — cinematic fantasy atmosphere, winding path, ferns and mushrooms as environment only (no copied creatures).',
};

function parseSceneFilters(argv: string[]): string[] | null {
  const idx = argv.indexOf('--scenes');
  if (idx === -1) return null;
  const raw = (argv[idx + 1] ?? '').trim();
  if (!raw) {
    console.error('Usage: --scenes bedroom-night,classroom,clinic,forest');
    process.exit(1);
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function selectScenes(filters: string[] | null) {
  if (!filters) return SCENES;
  const picked = SCENES.filter((s) => filters.includes(s.slug));
  if (picked.length === 0) {
    console.error(`No matching scenes. Available: ${SCENES.map((s) => s.slug).join(', ')}`);
    process.exit(1);
  }
  return picked;
}

function buildStyle02Prompt(sceneLine: string, slug: string): string {
  return [
    STYLE_REFERENCE_INSTRUCTION,
    '',
    STYLE_02_NO_TEXT_BLOCK,
    '',
    STYLE_02_BRIEF,
    '',
    CHILD_ARCHETYPE_STYLE02,
    '',
    SCENE_TUNING[slug] ?? '',
    '',
    sceneLine,
  ].join('\n');
}

async function loadReferences() {
  if (!existsSync(STYLE_REF_DIR)) throw new Error(`Missing ${STYLE_REF_DIR}`);
  const dirFiles = await readdir(STYLE_REF_DIR);
  for (const name of STYLE_02_USED_FILENAMES) {
    if (!dirFiles.includes(name)) throw new Error(`Missing reference: ${name}`);
  }
  return {
    usedFilenames: STYLE_02_USED_FILENAMES,
    usedPaths: STYLE_02_USED_FILENAMES.map((f) => path.join(STYLE_REF_DIR, f)),
    subsetReason:
      `4 of 13 references (API max ${GPT_IMAGE_EDIT_MAX_REFERENCES}): bedroom ink interior, forest fairy lantern, kitchen/daylight interior for readable daytime scenes, dense forest village for world-building. Excluded photoreal/CGI turtle, owl/dragon closeups, Hebrew/English text-heavy refs, redundant bedrooms.`,
    excluded: STYLE_02_REFERENCE_CATALOG.filter((r) => !r.include),
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY required');
    process.exit(1);
  }

  const refs = await loadReferences();
  const runId = randomUUID().slice(0, 8);
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-${RUN_LABEL}-${new Date().toISOString().slice(0, 10)}-${runId}`
  );
  await mkdir(outDir, { recursive: true });

  console.log('=== Style 02 — Style-Reference Audition ===');
  console.log(`Model: gpt-image-1 | required: images.edit`);
  console.log(refs.subsetReason);
  console.log(`Refs: ${refs.usedFilenames.join(' | ')}`);
  console.log(`Output: ${outDir}\n`);

  const scenesToRun = selectScenes(parseSceneFilters(process.argv));
  const sceneResults: Record<string, unknown>[] = [];

  async function writeManifestPartial(done: Record<string, unknown>[]) {
    const partial = {
      styleId: 'style_02_cinematic_fantasy',
      phase: 'style02-reference-audition',
      status: done.length < scenesToRun.length ? 'in_progress' : 'complete',
      generatedAt: new Date().toISOString(),
      model: 'gpt-image-1',
      requiredApiMode: 'images.edit',
      styleReferences: {
        usedFilenames: refs.usedFilenames,
        subsetReason: refs.subsetReason,
      },
      scenesCompleted: done.length,
      scenesTotal: scenesToRun.length,
      scenes: done,
    };
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(partial, null, 2) + '\n', 'utf8');
  }

  for (const scene of scenesToRun) {
    const fullPrompt = buildStyle02Prompt(scene.sceneLine, scene.slug);
    const filename = `scene-${scene.id}-${scene.slug}.png`;

    console.log(`--- ${scene.slug} ---`);
    const generated = await generateGPTImage({
      finalPrompt: fullPrompt,
      negativePrompt: STYLE_02_AVOIDANCE_BLOCK,
      referenceImages: refs.usedPaths,
      referenceMode: 'style',
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: 'high',
    });

    if (generated.apiMode !== 'images.edit') {
      throw new Error(`HARD STOP: expected images.edit, got ${generated.apiMode}`);
    }

    await writeFile(path.join(outDir, filename), generated.buffer);
    await writeFile(
      path.join(outDir, `scene-${scene.id}-${scene.slug}-prompt.txt`),
      fullPrompt + '\n\n--- avoidance ---\n' + STYLE_02_AVOIDANCE_BLOCK,
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
      referenceCountRequested: generated.referenceCountRequested,
      fullPrompt,
      durationMs: generated.durationMs,
      fallbackUsed: false,
      bleedReport: { level: 'pending_cto_review' },
    });
    await writeManifestPartial(sceneResults);
  }

  const manifest = {
    styleId: 'style_02_cinematic_fantasy',
    phase: 'style02-reference-audition',
    status: 'complete',
    generatedAt: new Date().toISOString(),
    model: 'gpt-image-1',
    requiredApiMode: 'images.edit',
    silentFallbackAllowed: false,
    style02Brief: STYLE_02_BRIEF,
    styleReferences: {
      directory: STYLE_REF_DIR,
      totalAvailable: 13,
      usedFilenames: refs.usedFilenames,
      catalog: STYLE_02_REFERENCE_CATALOG,
      subsetReason: refs.subsetReason,
      excluded: refs.excluded,
    },
    scenes: sceneResults,
    notes: [
      'Separate from Style 01. Do not modify production registry.',
      'Do NOT proceed to Phase 2 or book render until CTO approves Style 02.',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(
    path.join(outDir, 'bleed-report.md'),
    [
      '# Style 02 reference audition — bleed report',
      '',
      '## References used (4/13)',
      '',
      ...refs.usedFilenames.map((f) => `- ${f}`),
      '',
      '## Excluded (9)',
      '',
      ...refs.excluded.map((e) => `- **${e.filename}**: ${e.reason}`),
      '',
      '## CTO checklist (per scene)',
      '',
      '- content bleed',
      '- creature bleed',
      '- composition bleed',
      '- text bleed',
      '- photoreal/3D drift',
      '- excessive darkness (classroom/clinic)',
      '- global yellow/orange wash',
      '- distinct from Style 01',
      '',
      '### bedroom-night — pending',
      '### classroom — pending',
      '### clinic — pending',
      '### forest — pending',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log('\n=== Style 02 audition complete ===');
  console.log(outDir);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-style02-reference.ts');
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
