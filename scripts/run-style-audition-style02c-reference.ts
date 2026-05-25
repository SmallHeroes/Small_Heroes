/**
 * Style 02c — semi-realistic cinematic fantasy style-reference audition.
 * Scene-typed reference subsets (not one global set).
 *
 * Usage:
 *   npx tsx scripts/run-style-audition-style02c-reference.ts
 *   npx tsx scripts/run-style-audition-style02c-reference.ts --scenes classroom,clinic
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { copyFile, mkdir, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage, GPT_IMAGE_EDIT_MAX_REFERENCES } from '../lib/generate-image';
import { STYLE_AUDITION_SCENES } from './style-audition-shared';

process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

const RUN_LABEL = 'style02c-reference';
const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '02');
const COMPARE_STYLE02_DIR =
  'image-experiment-1/style-audition-style02-reference-2026-05-25-a5f5971c';

export const STYLE_02C_BRIEF =
  'Premium cinematic fantasy children\'s-book illustration — semi-realistic, richly rendered, and highly detailed while still clearly hand-illustrated. Dense immersive environments fill the entire frame with foreground, midground and background: shelves, books, toys, plants, curtains, stones, flowers, tiny objects, hidden details, textured walls, worn wood, fabric, dust, scratches, and environmental storytelling in every corner. Strong clean ink-like linework and fine contour detail define every object; no flat shapes, no simplified nursery look. Forms should feel dimensional and tactile, with believable materials and texture.\n\n' +
  'Lighting is a major feature: strong motivated cinematic light from visible sources — window beams, moonlight, lamps, lanterns, glowing particles — with clear highlights, deeper shadows, rim light, and warm local pools of light against cooler blue-green shadow. The image should have drama, depth and atmosphere, but stay readable. No weak flat lighting.\n\n' +
  'Characters are appealing and expressive but more realistic and nuanced than Style 01: designed storybook characters with believable proportions, detailed hair, fabric folds, subtle skin warmth, real emotion in the eyes, and dimensional faces. Big expressive eyes are okay, but avoid toy-like doll faces and generic baby-cute proportions.\n\n' +
  'The finish should feel like a premium fantasy picture-book spread or hand-painted cinematic illustration: rich, magical, detailed, atmospheric, alive, and polished. Not a literal photograph. Not plastic CGI. Not Pixar. Not flat vector. Not simple nursery watercolor. Not soft hazy wash. Not blank or sparse. Not low-detail.';

const STYLE_REFERENCE_INSTRUCTION =
  'Use the attached reference images only as VISUAL STYLE references. Match their premium semi-realistic fantasy illustration quality: rendering density, material texture, dimensional forms, ink-and-paint detail, cinematic lighting, depth, and environmental richness. Borrow rendering, materials, depth, lighting, and texture — NOT creatures, text, composition, layout, or story content. Create the scene below as a new original image. Not a literal photograph, but much more realistic, dimensional, rendered, textured, and cinematic than soft nursery watercolor. Still hand-illustrated fantasy storybook, not plastic CGI.';

const NO_TEXT_BLOCK =
  '[NO TEXT — CRITICAL]\n' +
  'No readable text: no Hebrew, English, letters, numbers, signs, labels, book titles, or alphabet charts. Pictorial symbols and abstract marks only.';

const AVOIDANCE_BLOCK =
  'Do not copy owls, dragons, turtles, fairies, giants, puppies, or reference-specific creatures, props, signs, or compositions. No readable text. Not a literal photograph. Not plastic CGI or Pixar-smooth 3D child faces. Not flat nursery illustration. No global amber/orange sepia wash over the whole image.';

const CHILD_ARCHETYPE =
  'Young child protagonist (~5 years): dimensional storybook character with believable proportions, detailed hair and clothing folds, subtle skin warmth, nuanced expression in the eyes — designed and alive, not toy-doll generic.';

const SCENES = STYLE_AUDITION_SCENES.filter((s) =>
  ['bedroom-night', 'classroom', 'clinic', 'forest'].includes(s.slug)
);

/** Full catalog for manifest. */
export const STYLE_02_REFERENCE_CATALOG = [
  { filename: 'ChatGPT Image May 18, 2026, 11_41_28 AM.png', tags: ['bedroom-night', 'inky', 'cinematic'] },
  { filename: 'ChatGPT Image May 18, 2026, 11_41_36 AM.png', tags: ['forest-village', 'dense', 'magical'] },
  { filename: 'ChatGPT Image May 18, 2026, 11_41_43 AM.png', tags: ['garden-daylight', 'semi-real', 'rich-detail'] },
  { filename: 'ChatGPT Image May 18, 2026, 11_41_49 AM.png', tags: ['bedroom', 'hebrew-text', 'owl'] },
  { filename: 'ChatGPT Image May 18, 2026, 12_36_35 PM.png', tags: ['interior-daylight', 'bright'] },
  { filename: 'ChatGPT Image May 18, 2026, 12_49_00 PM.png', tags: ['bedroom-night', 'rendered', 'hebrew-text'] },
  { filename: 'ChatGPT Image May 18, 2026, 01_45_01 PM.png', tags: ['bedroom-night', 'sparkles', 'hebrew-text'] },
  { filename: 'ChatGPT Image May 18, 2026, 01_46_14 PM.png', tags: ['village', 'dimensional', 'materials', 'hebrew-sign'] },
  { filename: 'ChatGPT Image May 18, 2026, 02_01_50 PM.png', tags: ['dark-study', 'rendered', 'dragon'] },
  { filename: 'ChatGPT Image May 18, 2026, 02_04_04 PM.png', tags: ['night', 'atmospheric', 'rendered', 'owl'] },
  { filename: 'ChatGPT Image May 18, 2026, 02_05_22 PM.png', tags: ['fairy-forest', 'pixar-leaning'] },
  { filename: 'ChatGPT Image May 18, 2026, 02_24_45 PM.png', tags: ['turtle', 'hyper-rendered', 'english-text'] },
  { filename: 'ChatGPT Image May 18, 2026, 02_39_29 PM.png', tags: ['mushroom-forest', 'dense', 'english-signs'] },
] as const;

/** Scene-typed subsets — max 4 per API call. */
const REF_SUBSETS: Record<
  string,
  { filenames: string[]; reason: string; excludedNote: string }
> = {
  'bedroom-night': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_28 AM.png',
      'ChatGPT Image May 18, 2026, 12_49_00 PM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
      'ChatGPT Image May 18, 2026, 02_04_04 PM.png',
    ],
    reason:
      'Dark inky cinematic bedrooms + richly rendered night interior + dimensional material study (style only) + atmospheric depth/lighting ref. Hebrew/owl/dragon content blocked in prompt.',
    excludedNote:
      'Excluded fairy forest (Pixar child), daytime kitchen, garden turtle, mushroom village signs, hyper-real turtle for daytime.',
  },
  classroom: {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
    ],
    reason:
      'Bright interior daylight + rich garden semi-real detail + dimensional village materials + hyper-rendered texture borrow. NO night/lantern refs.',
    excludedNote:
      'Excluded night bedroom refs, fairy forest, owl closeup, mushroom village (English text), mirror bedroom.',
  },
  clinic: {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
    ],
    reason: 'Same daytime rich subset as classroom — bright anchors only, plus dimensional rendering ref.',
    excludedNote: 'Excluded all night/magical-lantern bedroom and forest-night refs.',
  },
  forest: {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_36 AM.png',
      'ChatGPT Image May 18, 2026, 02_24_45 PM.png',
      'ChatGPT Image May 18, 2026, 02_04_04 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
    ],
    reason:
      'Magical forest village density + hyper-rendered foliage/material borrow + atmospheric moonlit depth + garden foliage realism. Excluded fairy (Pixar-smooth child).',
    excludedNote: 'Excluded fairy forest ref, dragon study, daytime-only kitchen, Hebrew-heavy bedrooms.',
  },
};

const SCENE_LINES: Record<string, string> = {
  'bedroom-night':
    "A child's cozy bedroom at night — a bed, a window showing the moon and stars, shelves with toys and books, a small lamp glowing softly. The child is on the bed.",
  classroom:
    'Bright daytime classroom, but cinematic and richly detailed: strong natural daylight beams from large windows, visible dust motes, crisp shadows, many desks, books, art materials, shelves, plants, wall drawings with no readable text, textured walls and floor, layered foreground objects. No lanterns, no candles, no fireflies, no night. The child stands among the desks.',
  clinic:
    "Bright friendly children's clinic, but cinematic and richly detailed: strong daylight from windows, clean exam bed, supply shelves full of jars and tools, plants, toys, pictorial posters with no readable text, textured tiles, soft shadows, realistic materials, layered background. No lanterns, no candles, no fireflies, no dusk. The child sits in the room.",
  forest:
    'Magical forest path with much more depth and realism: dense layered foliage, textured bark, moss, mushrooms, stones, ferns, atmospheric depth, shafts of light, glowing particles, detailed leaves and ground texture. More cinematic, more dimensional, less flat cartoon. The child walks the path.',
};

const SCENE_OBEDIENCE: Record<string, string> = {
  'bedroom-night':
    '[SCENE TONE] Night bedroom — dark, magical, moonlit, highly atmospheric with strong cinematic lamp/moonlight; rich ink-and-paint detail; deeper shadows and rim light. Still a real child bedroom.',
  classroom:
    '[SCENE TONE] MUST be bright daytime school classroom — NOT night, NOT lanterns/candles/fireflies. Strong window light beams and crisp shadows required.',
  clinic:
    '[SCENE TONE] MUST be bright daytime pediatric clinic — friendly, well-lit, NOT dusk/gothic/lantern-lit.',
  forest:
    '[SCENE TONE] Magical forest — cinematic depth, shafts of light, glowing particles allowed; maximum foliage/material detail.',
};

function buildPrompt(slug: string): string {
  return [
    STYLE_REFERENCE_INSTRUCTION,
    '',
    NO_TEXT_BLOCK,
    '',
    STYLE_02C_BRIEF,
    '',
    CHILD_ARCHETYPE,
    '',
    SCENE_OBEDIENCE[slug],
    '',
    SCENE_LINES[slug],
  ].join('\n');
}

function resolveRefPaths(filenames: string[]): string[] {
  return filenames.map((f) => path.join(STYLE_REF_DIR, f));
}

function parseSceneFilters(argv: string[]): string[] | null {
  const idx = argv.indexOf('--scenes');
  if (idx === -1) return null;
  const raw = (argv[idx + 1] ?? '').trim();
  if (!raw) {
    console.error('Usage: --scenes classroom,clinic');
    process.exit(1);
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function copyCompareImages(outDir: string) {
  const compareDir = path.join(outDir, 'compare-style02-prior');
  await mkdir(compareDir, { recursive: true });
  const prior = path.join(process.cwd(), COMPARE_STYLE02_DIR);
  if (!existsSync(prior)) {
    console.warn(`Compare folder missing: ${COMPARE_STYLE02_DIR}`);
    return;
  }
  for (const scene of SCENES) {
    const src = path.join(prior, `scene-${scene.id}-${scene.slug}.png`);
    if (existsSync(src)) {
      await copyFile(src, path.join(compareDir, `style02-prior-${scene.slug}.png`));
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY required');
    process.exit(1);
  }

  const dirFiles = await readdir(STYLE_REF_DIR);
  for (const entry of Object.values(REF_SUBSETS)) {
    for (const f of entry.filenames) {
      if (!dirFiles.includes(f)) throw new Error(`Missing reference: ${f}`);
    }
  }

  const runId = randomUUID().slice(0, 8);
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-${RUN_LABEL}-${new Date().toISOString().slice(0, 10)}-${runId}`
  );
  await mkdir(outDir, { recursive: true });
  await copyCompareImages(outDir);

  const filterSlugs = parseSceneFilters(process.argv);
  const scenesToRun = filterSlugs
    ? SCENES.filter((s) => filterSlugs.includes(s.slug))
    : SCENES;
  if (scenesToRun.length === 0) {
    console.error('No matching scenes');
    process.exit(1);
  }

  console.log('=== Style 02c — semi-realistic style-reference audition ===');
  console.log(`Model: gpt-image-1 | images.edit | max refs: ${GPT_IMAGE_EDIT_MAX_REFERENCES}`);
  console.log(`Compare prior Style 02: ${COMPARE_STYLE02_DIR}`);
  console.log(`Output: ${outDir}\n`);

  const sceneResults: Record<string, unknown>[] = [];

  for (const scene of scenesToRun) {
    const subset = REF_SUBSETS[scene.slug];
    const refPaths = resolveRefPaths(subset.filenames);
    const fullPrompt = buildPrompt(scene.slug);
    const filename = `scene-${scene.id}-${scene.slug}.png`;

    console.log(`--- ${scene.slug} ---`);
    console.log(`Refs (${subset.filenames.length}): ${subset.filenames.join(' | ')}`);

    const generated = await generateGPTImage({
      finalPrompt: fullPrompt,
      negativePrompt: AVOIDANCE_BLOCK,
      referenceImages: refPaths,
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
      fullPrompt + '\n\n--- refs ---\n' + subset.filenames.join('\n'),
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
      referenceSubset: subset,
      referenceCountPassed: generated.referenceCountPassed,
      fullPrompt,
      durationMs: generated.durationMs,
      comparePrior: `compare-style02-prior/style02-prior-${scene.slug}.png`,
    });

    await writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify(
        { status: sceneResults.length < scenesToRun.length ? 'in_progress' : 'complete', scenes: sceneResults },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }

  const manifest = {
    styleId: 'style_02c_cinematic_fantasy_semi_real',
    phase: 'style02c-reference-audition',
    status: 'complete',
    generatedAt: new Date().toISOString(),
    model: 'gpt-image-1',
    apiMode: 'images.edit',
    style02cBrief: STYLE_02C_BRIEF,
    sceneTypedReferenceSubsets: REF_SUBSETS,
    referenceCatalog: STYLE_02_REFERENCE_CATALOG,
    compareAgainst: COMPARE_STYLE02_DIR,
    note: 'Style 02b folder not found in repo; compared to prior Style 02 run (a5f5971c).',
    scenes: sceneResults,
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outDir, 'style02c-brief.txt'), STYLE_02C_BRIEF + '\n', 'utf8');
  await writeFile(
    path.join(outDir, 'bleed-report.md'),
    [
      '# Style 02c bleed report',
      '',
      'Compare: `compare-style02-prior/` vs Style 02c PNGs.',
      '',
      '## Per scene — CTO review',
      '',
      '| Scene | Content bleed | Creature bleed | Text bleed | Photoreal/CGI drift | Too dark (class/clinic) | Prior Style 02 detail lift |',
      '|-------|---------------|----------------|------------|---------------------|-------------------------|---------------------------|',
      '| bedroom-night | _CTO_ | _CTO_ | _CTO_ | _CTO_ | n/a | _CTO_ |',
      '| classroom | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ |',
      '| clinic | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ |',
      '| forest | _CTO_ | _CTO_ | _CTO_ | _CTO_ | n/a | _CTO_ |',
      '',
      '## Success criteria',
      '',
      '- More detailed than Style 01',
      '- More semi-realistic/dimensional than Style 02 prior',
      '- Strong cinematic lighting',
      '- Not flat/nursery/generic cute',
      '- Still illustrated, not literal photo',
      '- No readable text; no copied creatures',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log('\n=== Style 02c complete ===');
  console.log(outDir);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-style02c-reference.ts');
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
