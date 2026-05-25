/**
 * Style 02 FINAL audition — GPT-image-2 ONLY (no silent fallback).
 * Style-only references from style-references/02/.
 *
 * Usage: npx tsx scripts/run-style-audition-style02-gptimage2.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { copyFile, mkdir, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { generateGPTImage } from '../lib/generate-image';

/** Hard lock — never fall back to gpt-image-1. */
const REQUIRED_MODEL = 'gpt-image-2';
process.env.GPT_IMAGE_MODEL = REQUIRED_MODEL;

const RUN_LABEL = 'style02-gptimage2';
const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '02');
const COMPARE_STYLE02D_DIR =
  'image-experiment-1/style-audition-style02d-reference-2026-05-25-c2136b05';

export const STYLE_02_SHARED =
  'Style 02: a richly rendered semi-realistic cinematic fantasy children\'s-book illustration. Highly detailed and immersive, with dimensional painted forms, refined linework, realistic materials, strong motivated lighting, layered foreground-midground-background depth, and dense environmental storytelling. The image should feel hand-crafted and magical, but not soft watercolor, not pale pencil, not flat cartoon, not generic nursery art. Strong cinematic light and shadow; warm local glow balanced by cool shadows; rich colors and visible texture. The child is illustrated and expressive, cute but believable, never CGI, never plastic, never Pixar, never doll-like.';

const RENDERING_CORRECTION =
  'RENDERING: dimensional painted rendering, material definition, visible volume, controlled detailed linework, strong light direction, crisp focal hierarchy, layered atmospheric depth, rich shadows, detailed props everywhere. NOT pale watercolor wash, NOT soft pencil haze, NOT muddy softness, NOT low-contrast pastel, NOT simplified nursery look, NOT weak flat lighting, NOT empty backgrounds. "Not photorealistic" does NOT mean soft watercolor — illustrated but deep, material-rich, cinematic.';

const STYLE_REFERENCE_INSTRUCTION =
  'Use attached references for VISUAL STYLE ONLY: rendering quality, dimensionality, cinematic lighting, dense detail, atmospheric depth, material richness, linework language, magical fantasy mood. Do NOT copy exact scene, composition, creatures, text, signs, or labels. Create the new original scene below.';

const NO_TEXT_BLOCK =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, book titles, or alphabet charts. Pictorial/abstract marks only. No garbled text.';

const ANTI_SOFTNESS_STYLE01 =
  'NOT Style 01. NOT soft watercolor. NOT pale pencil. NOT dusty muted wash. NOT generic nursery illustration. NOT flat vector. NOT sparse empty room. NOT global orange/amber/yellow filter over the whole image.';

const CHARACTER_GUARD =
  'Child (~5): semi-realistic illustrated storybook character — expressive eyes, natural proportions with slight charm, believable hand-painted skin texture, fabric folds, emotional nuance. NOT Pixar, NOT plastic CGI, NOT doll eyes, NOT hyperreal portrait, NOT flat cartoon, NOT Style-01 nursery simplicity.';

const AVOIDANCE_NEGATIVE =
  'No copied owls, dragons, turtles, fairies, giants from references unless tiny toys only. No readable text. No Pixar-smooth child. No photorealistic camera portrait.';

const SCENES = [
  {
    id: '01',
    slug: 'bedroom-night',
    body:
      'A child sitting in a cozy bedroom at night, looking toward the moonlit window with quiet wonder. Rich and full: bed, quilt, bookshelves, toys, small drawings, plants, lamp, nightstand, open book on the floor, tiny objects everywhere — lived-in, magical, emotionally warm. Lighting: deep blue moonlight from window, warm lamp or lantern glow inside, strong cinematic contrast, detailed shadows, every corner readable. Dense, inky, dimensional, magical — not soft watercolor, not empty nursery room. Owls/creatures only as tiny toys if any.',
  },
  {
    id: '02',
    slug: 'classroom-day',
    body:
      'Bright daytime classroom — child standing among desks crowded with books, art supplies, plants, shelves, drawings, classroom objects; rich, active, deeply detailed. Lighting: strong natural daylight from large windows, visible sunbeams and dust particles, warm sunlight balanced by cool shadows — NO global orange wash, NO night mood, NO lanterns, candles, or fireflies. Cinematic daylight, dimensional semi-realistic illustration, detailed wood/paper/plants — not pale watercolor, not flat poster art. No readable alphabet posters.',
  },
  {
    id: '03',
    slug: 'clinic-day',
    body:
      "Child sitting in a cozy children's clinic: examination bed, shelves with jars and medical tools, plants, soft curtains, wooden cabinet, toys, pictorial cards without words, textured tiles, bright daylight from window. Lighting: strong window light, clear highlights and shadows, NO amber global wash, NO night lighting, NO lantern unless medically justified (prefer none). Detailed glass/wood/cloth/metal — cinematic but bright, distinct from Style 01. No readable health posters or labels.",
  },
  {
    id: '04',
    slug: 'forest-magical',
    body:
      'Child walking a magical forest path — dense, immersive, cinematic: giant trees, moss, mushrooms, glowing particles, small lanterns in trees, layered foliage, stones, roots, flowers, deep visible depth. Lighting: strong sunbeams through canopy and/or soft lantern-firefly glow with rich shadows — cinematic contrast, magical but not muddy. Semi-realistic fantasy storybook foliage and bark detail — not soft watercolor, not empty green tunnel, not CGI child. Full fairy-village micro-architecture not required; judge on density, depth, light, materials.',
  },
] as const;

/** Scene-typed subsets — child-prominent scenes avoid turtle/fairy hyper-real child anchors. */
const REF_SUBSETS: Record<string, { filenames: string[]; reason: string }> = {
  'bedroom-night': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_28 AM.png',
      'ChatGPT Image May 18, 2026, 11_41_49 AM.png',
      'ChatGPT Image May 18, 2026, 12_49_00 PM.png',
      'ChatGPT Image May 18, 2026, 01_45_01 PM.png',
    ],
    reason: 'Four dense bedroom-night refs; child-prominent — no turtle/fairy/Pixar-leaning refs.',
  },
  'classroom-day': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
    ],
    reason:
      'Daytime interior + dimensional village + garden detail + material-rich study (no dragon). Excluded turtle hyper-render and night refs.',
  },
  'clinic-day': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
    ],
    reason: 'Bright clinic/day interior + jars/wood study materials + architecture. No turtle/fairy/night bedroom.',
  },
  'forest-magical': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_36 AM.png',
      'ChatGPT Image May 18, 2026, 02_39_29 PM.png',
      'ChatGPT Image May 18, 2026, 02_05_22 PM.png',
      'ChatGPT Image May 18, 2026, 02_04_04 PM.png',
    ],
    reason:
      'Environment-heavy: fairy village + mushroom forest + lantern forest + atmospheric night-tree depth (style only; child stays human).',
  },
};

const COMPARE_02D_MAP: Record<string, string> = {
  'bedroom-night': 'scene-01-bedroom-night.png',
  'classroom-day': 'scene-02-classroom.png',
  'clinic-day': 'scene-03-clinic.png',
  'forest-magical': 'scene-04-forest.png',
};

function buildPrompt(body: string): string {
  return [
    body,
    STYLE_02_SHARED,
    RENDERING_CORRECTION,
    STYLE_REFERENCE_INSTRUCTION,
    NO_TEXT_BLOCK,
    ANTI_SOFTNESS_STYLE01,
    CHARACTER_GUARD,
  ].join('\n\n');
}

function assertModelLock() {
  const envModel = (process.env.GPT_IMAGE_MODEL || '').trim();
  if (envModel !== REQUIRED_MODEL) {
    throw new Error(
      `BLOCKER: GPT_IMAGE_MODEL must be "${REQUIRED_MODEL}" (got "${envModel}"). No fallback to gpt-image-1.`
    );
  }
}

async function verifyGPTImage2Available(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY required');
  const openai = new OpenAI({ apiKey });
  try {
    await openai.models.retrieve(REQUIRED_MODEL);
    console.log(`[preflight] ${REQUIRED_MODEL} model id reachable`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `BLOCKER: ${REQUIRED_MODEL} unavailable or not accessible on this API key.\n${msg}\nDo NOT fall back to gpt-image-1.`
    );
  }
}

function assertGenerationModel(model: string, fallbackUsed: boolean) {
  if (fallbackUsed) {
    throw new Error('BLOCKER: fallbackUsed=true — audition aborted.');
  }
  if (model.trim() !== REQUIRED_MODEL) {
    throw new Error(
      `BLOCKER: API returned model "${model}" but REQUIRED_MODEL is "${REQUIRED_MODEL}". No silent fallback.`
    );
  }
}

async function copyCompare02d(outDir: string) {
  const d = path.join(outDir, 'compare-style02d');
  await mkdir(d, { recursive: true });
  const prior = path.join(process.cwd(), COMPARE_STYLE02D_DIR);
  if (!existsSync(prior)) return;
  for (const scene of SCENES) {
    const srcName = COMPARE_02D_MAP[scene.slug];
    const src = path.join(prior, srcName);
    if (existsSync(src)) {
      await copyFile(src, path.join(d, `style02d-${scene.slug}.png`));
    }
  }
}

function bleedReportMd(): string {
  const rows = SCENES.map(
    (s) =>
      `| ${s.slug} | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ | _CTO_ |`
  ).join('\n');
  return [
    '# Style 02 — GPT-image-2 final audition bleed report',
    '',
    `Model: **${REQUIRED_MODEL}** | fallbackUsed: **false** (hard requirement)`,
    '',
    'Compare: `compare-style02d/` vs outputs in this folder.',
    '',
    '| Scene | Creature bleed | Comp copy | Text | CGI/Pixar child | Style 01 drift | Lighting strong | BG dense | More real than S01 | Matches Guy refs |',
    '|-------|----------------|-----------|------|-----------------|----------------|-----------------|---------|-------------------|------------------|',
    rows,
    '',
    '## Notes',
    '',
    '- Provider test: gpt-image-2 vs prior gpt-image-1 (02d)',
    '- Child-prominent scenes excluded turtle/fairy hyper-real refs',
    '- Forest uses environment-heavy fairy-village subset',
    '',
  ].join('\n');
}

async function main() {
  assertModelLock();
  await verifyGPTImage2Available();

  const files = await readdir(STYLE_REF_DIR);
  for (const sub of Object.values(REF_SUBSETS)) {
    for (const f of sub.filenames) {
      if (!files.includes(f)) throw new Error(`Missing reference: ${f}`);
    }
  }

  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-${RUN_LABEL}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  );
  await mkdir(outDir, { recursive: true });
  await copyCompare02d(outDir);

  console.log('=== Style 02 FINAL — GPT-image-2 ONLY ===');
  console.log(`Model: ${REQUIRED_MODEL} | fallback: forbidden`);
  console.log(`Output: ${outDir}`);
  console.log(`Compare 02d: ${COMPARE_STYLE02D_DIR}\n`);

  const sceneResults: Record<string, unknown>[] = [];

  for (const scene of SCENES) {
    const sub = REF_SUBSETS[scene.slug];
    const refPaths = sub.filenames.map((f) => path.join(STYLE_REF_DIR, f));
    const prompt = buildPrompt(scene.body);
    const outputPath = `scene-${scene.id}-${scene.slug}.png`;
    const promptPath = `scene-${scene.id}-${scene.slug}-prompt.txt`;

    console.log(`--- ${scene.slug} --- refs ${sub.filenames.length}`);

    let gen;
    try {
      gen = await generateGPTImage({
        finalPrompt: prompt,
        negativePrompt: AVOIDANCE_NEGATIVE,
        referenceImages: refPaths,
        referenceMode: 'style',
        requireReferenceEdit: true,
        size: '1024x1536',
        quality: 'high',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\nBLOCKER: ${REQUIRED_MODEL} generation failed for ${scene.slug}`);
      console.error(msg);
      await writeFile(
        path.join(outDir, 'BLOCKER.md'),
        `# BLOCKER\n\nModel: ${REQUIRED_MODEL}\nScene: ${scene.slug}\n\n\`\`\`\n${msg}\n\`\`\`\n\nNo fallback to gpt-image-1.\n`,
        'utf8'
      );
      process.exit(1);
    }

    const fallbackUsed = false;
    assertGenerationModel(gen.model, fallbackUsed);

    await writeFile(path.join(outDir, outputPath), gen.buffer);
    await writeFile(path.join(outDir, promptPath), prompt + '\n\n--- refs ---\n' + sub.filenames.join('\n'), 'utf8');

    console.log(
      `[saved] ${outputPath} model=${gen.model} apiMode=${gen.apiMode} refs=${gen.referenceCountPassed}/${gen.referenceCountRequested}`
    );

    sceneResults.push({
      slug: scene.slug,
      outputPath,
      promptPath,
      model: gen.model,
      apiMode: gen.apiMode,
      refsRequested: gen.referenceCountRequested,
      refsPassed: gen.referenceCountPassed,
      fallbackUsed,
      referencesUsed: sub.filenames,
      subsetReason: sub.reason,
      durationMs: gen.durationMs,
    });

    await writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({ status: 'in_progress', model: REQUIRED_MODEL, fallbackUsed: false, scenes: sceneResults }, null, 2) +
        '\n',
      'utf8'
    );
  }

  const manifest = {
    styleId: 'style_02_gptimage2_final',
    phase: 'style02-gptimage2-final-audition',
    status: 'complete',
    generatedAt: new Date().toISOString(),
    model: REQUIRED_MODEL,
    fallbackUsed: false,
    apiModeNote: 'images.edit when style references passed',
    style02SharedBrief: STYLE_02_SHARED,
    referenceSubsets: REF_SUBSETS,
    compareStyle02d: COMPARE_STYLE02D_DIR,
    scenes: sceneResults,
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outDir, 'style02-gptimage2-brief.txt'), STYLE_02_SHARED + '\n\n' + RENDERING_CORRECTION + '\n', 'utf8');
  await writeFile(path.join(outDir, 'bleed-report.md'), bleedReportMd(), 'utf8');

  console.log('\n=== Style 02 GPT-image-2 complete ===');
  console.log(`manifest: ${path.join(outDir, 'manifest.json')}`);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-style02-gptimage2.ts');
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
