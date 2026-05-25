/**
 * Phase 1 v4-reference — STYLE-REFERENCE AUDITION (Guy's reference PNGs).
 *
 * STRICT: images.edit with style references only — NO silent fallback to generate.
 *
 * Usage:
 *   npx tsx scripts/run-style-audition-phase1-v4-reference.ts
 *   npx tsx scripts/run-style-audition-phase1-v4-reference.ts --with-control
 *
 * Requires: OPENAI_API_KEY, style-references/01/*.png
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
import {
  CHILD_ARCHETYPE,
  SHARED_STYLE_BRIEF,
  STYLE_AUDITION_SCENES,
} from './style-audition-shared';

process.env.GPT_IMAGE_MODEL = 'gpt-image-1';

const STYLE_REF_DIR = path.join(process.cwd(), 'style-references', '01');

const STYLE_REFERENCE_INSTRUCTION =
  "Use the attached reference images only as a visual STYLE reference. Match their premium cinematic children's-book illustration quality: rich full environments, controlled lively linework, painterly depth, warm/cool lighting, charming designed characters, and dense visual storytelling. Do not copy their content, characters, animals, creatures, objects, poses, scene layout, or composition. Create the scene described below as a new original image in that visual style.";

const V4_AVOIDANCE_BLOCK =
  'Do not include any animals, creatures, dragons, owls, puppies, birds, armadillos, monsters, magical companions, bats, lanterns, cottages, doorways, or props from the reference images unless explicitly requested by the target scene. Do not copy any reference composition, camera angle, pose, or layout. No text artifacts. No photorealism. No flat cartoon. No generic nursery-book look. No yellow/orange/sepia wash.';

const V4_SCENES = STYLE_AUDITION_SCENES.filter((s) =>
  ['bedroom-night', 'classroom', 'clinic', 'forest'].includes(s.slug)
);

/**
 * All 7 Guy references. API caps at GPT_IMAGE_EDIT_MAX_REFERENCES (4).
 * Curated subset preserves scene-type variety and reduces composition lock.
 */
const ALL_STYLE_REFERENCES: Array<{
  filename: string;
  tags: string[];
}> = [
  {
    filename: 'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
    tags: ['indoor', 'bedroom-night', 'child-in-environment', 'warm-cool-light'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
    tags: ['outdoor', 'nature', 'bridge', 'child-in-environment'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 11_59_17 AM.png',
    tags: ['outdoor', 'forest', 'dense-environment', 'child-in-environment'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
    tags: ['outdoor', 'stone-steps', 'puppy', 'warm-cast-risk'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
    tags: ['indoor', 'clinic-like', 'dense-props', 'child-in-environment'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_12_02 PM.png',
    tags: ['night', 'magical-light', 'porch', 'child-in-environment'],
  },
  {
    filename: 'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
    tags: ['night', 'outdoor', 'mountains', 'bat'],
  },
];

/** Subset used when API cannot take all 7 — one pick per category. */
const CURATED_SUBSET_FILENAMES = [
  'ChatGPT Image May 18, 2026, 11_48_10 AM.png', // bedroom-night indoor
  'ChatGPT Image May 18, 2026, 12_06_22 PM.png', // rich indoor / clinic-like
  'ChatGPT Image May 18, 2026, 11_59_17 AM.png', // forest / outdoor nature
  'ChatGPT Image May 18, 2026, 12_12_02 PM.png', // magical night lighting
];

function buildV4ScenePrompt(sceneLine: string): string {
  return [
    STYLE_REFERENCE_INSTRUCTION,
    '',
    SHARED_STYLE_BRIEF,
    '',
    CHILD_ARCHETYPE,
    '',
    sceneLine,
  ].join('\n');
}

async function loadStyleReferencePaths(): Promise<{
  allAvailable: string[];
  allFilenames: string[];
  usedPaths: string[];
  usedFilenames: string[];
  subsetReason: string;
}> {
  if (!existsSync(STYLE_REF_DIR)) {
    throw new Error(`Style reference directory missing: ${STYLE_REF_DIR}`);
  }

  const dirFiles = await readdir(STYLE_REF_DIR);
  const pngs = dirFiles.filter((f) => f.toLowerCase().endsWith('.png'));
  if (pngs.length === 0) {
    throw new Error(`No PNG files in ${STYLE_REF_DIR}`);
  }

  const allFilenames = ALL_STYLE_REFERENCES.map((r) => r.filename);
  for (const name of allFilenames) {
    if (!pngs.includes(name)) {
      throw new Error(`Missing expected reference file: ${name}`);
    }
  }

  const allAvailable = allFilenames.map((f) => path.join(STYLE_REF_DIR, f));
  const useAll = allAvailable.length <= GPT_IMAGE_EDIT_MAX_REFERENCES;
  const usedFilenames = useAll ? allFilenames : CURATED_SUBSET_FILENAMES;
  const usedPaths = usedFilenames.map((f) => path.join(STYLE_REF_DIR, f));

  for (const p of usedPaths) {
    if (!existsSync(p)) throw new Error(`Reference file not found: ${p}`);
  }

  const subsetReason = useAll
    ? `All ${allFilenames.length} references passed (within API cap of ${GPT_IMAGE_EDIT_MAX_REFERENCES}).`
    : `API cap is ${GPT_IMAGE_EDIT_MAX_REFERENCES} images per images.edit call; Guy provided ${allFilenames.length}. ` +
      `Using curated subset of ${usedFilenames.length} for variety: indoor bedroom-night, indoor clinic-rich, outdoor forest, magical night porch. ` +
      `Excluded to reduce composition lock: bridge+bird, puppy+stone-steps (amber cast risk), bat+mountains night.`;

  return {
    allAvailable,
    allFilenames,
    usedPaths,
    usedFilenames,
    subsetReason,
  };
}

type BleedLevel = 'none_detected' | 'mild' | 'major' | 'pending_cto_review';

function initialBleedNotes(slug: string): {
  level: BleedLevel;
  possibleContentBleed: string[];
  possibleCompositionBleed: string[];
  sceneMatch: string;
} {
  return {
    level: 'pending_cto_review',
    possibleContentBleed: [],
    possibleCompositionBleed: [],
    sceneMatch: `Target scene: ${slug} — CTO visual pass required.`,
  };
}

async function generateOneScene(input: {
  scene: (typeof V4_SCENES)[number];
  outDir: string;
  styleRefPaths: string[];
  styleRefFilenames: string[];
  prefix: string;
}): Promise<Record<string, unknown>> {
  const fullPrompt = buildV4ScenePrompt(input.scene.sceneLine);
  const filename = `${input.prefix}scene-${input.scene.id}-${input.scene.slug}.png`;
  const dest = path.join(input.outDir, filename);

  console.log(`--- ${input.prefix || ''}Scene ${input.scene.id}: ${input.scene.slug} ---`);
  console.log(`[prompt] ${fullPrompt.length} chars | refs=${input.styleRefPaths.length}`);

  const generated = await generateGPTImage({
    finalPrompt: fullPrompt,
    negativePrompt: V4_AVOIDANCE_BLOCK,
    referenceImages: input.styleRefPaths,
    referenceMode: 'style',
    requireReferenceEdit: true,
    size: '1024x1536',
    quality: 'high',
  });

  if (generated.apiMode !== 'images.edit') {
    throw new Error(
      `v4-reference HARD STOP: expected images.edit, got ${generated.apiMode} for ${input.scene.slug}`
    );
  }
  if (generated.referenceCountPassed === 0) {
    throw new Error(`v4-reference HARD STOP: zero references passed for ${input.scene.slug}`);
  }

  await writeFile(dest, generated.buffer);
  await writeFile(
    path.join(input.outDir, `${input.prefix}scene-${input.scene.id}-${input.scene.slug}-prompt.txt`),
    `${generated.finalPrompt}\n\n--- style prefix ---\n${STYLE_REFERENCE_PREFIX}\n\n--- avoidance ---\n${V4_AVOIDANCE_BLOCK}\n`,
    'utf8'
  );

  console.log(
    `[saved] ${filename} apiMode=${generated.apiMode} refsPassed=${generated.referenceCountPassed}/${generated.referenceCountRequested} (${generated.durationMs}ms)`
  );

  const bleed = initialBleedNotes(input.scene.slug);

  return {
    sceneId: input.scene.id,
    slug: input.scene.slug,
    sceneLine: input.scene.sceneLine,
    outputPath: filename,
    fullPrompt: generated.finalPrompt,
    styleReferenceInstruction: STYLE_REFERENCE_INSTRUCTION,
    sharedStyleBrief: SHARED_STYLE_BRIEF,
    avoidanceBlock: V4_AVOIDANCE_BLOCK,
    apiMode: generated.apiMode,
    model: generated.model,
    referenceFilenamesUsed: input.styleRefFilenames,
    referenceCountRequested: generated.referenceCountRequested,
    referenceCountPassed: generated.referenceCountPassed,
    size: '1024x1536',
    aspectRatio: '2:3',
    durationMs: generated.durationMs,
    bytes: generated.buffer.length,
    fallbackUsed: false,
    retryCount: 0,
    bleedReport: bleed,
  };
}

async function runControlBedroomV3TextOnly(outDir: string): Promise<Record<string, unknown>> {
  const scene = V4_SCENES.find((s) => s.slug === 'bedroom-night')!;
  const fullPrompt = [SHARED_STYLE_BRIEF, CHILD_ARCHETYPE, scene.sceneLine].join('\n\n');
  const filename = 'control-bedroom-night-v3-text-only.png';

  console.log('\n=== OPTIONAL CONTROL: v3 text-only bedroom-night (labeled separately) ===');
  const generated = await generateGPTImage({
    finalPrompt: fullPrompt,
    negativePrompt: V4_AVOIDANCE_BLOCK,
    referenceImages: [],
    size: '1024x1536',
    quality: 'high',
  });

  if (generated.apiMode !== 'images.generate') {
    throw new Error(`Control run must use images.generate, got ${generated.apiMode}`);
  }

  await writeFile(path.join(outDir, filename), generated.buffer);
  await writeFile(
    path.join(outDir, 'control-bedroom-night-v3-text-only-prompt.txt'),
    `${fullPrompt}\n`,
    'utf8'
  );

  return {
    label: 'control-bedroom-night-v3-text-only',
    outputPath: filename,
    apiMode: generated.apiMode,
    model: generated.model,
    referenceCountPassed: 0,
    fullPrompt,
    note: 'Debug comparison only — NOT part of v4-reference result set.',
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY is required.');
    process.exit(1);
  }

  const withControl = process.argv.includes('--with-control');
  const refs = await loadStyleReferencePaths();
  const runId = randomUUID().slice(0, 8);
  const outDir = path.join(
    process.cwd(),
    'image-experiment-1',
    `style-audition-phase1-v4-reference-${new Date().toISOString().slice(0, 10)}-${runId}`
  );
  await mkdir(outDir, { recursive: true });

  console.log('=== Phase 1 v4-reference — Style-Reference Audition ===');
  console.log(`Model: gpt-image-1 | required mode: images.edit`);
  console.log(`References available: ${refs.allFilenames.length} in ${STYLE_REF_DIR}`);
  console.log(`References used this run: ${refs.usedFilenames.length}`);
  console.log(refs.subsetReason);
  console.log(`Scenes: ${V4_SCENES.map((s) => s.slug).join(', ')}`);
  console.log(`Output: ${outDir}\n`);

  const sceneResults: Record<string, unknown>[] = [];
  for (const scene of V4_SCENES) {
    sceneResults.push(
      await generateOneScene({
        scene,
        outDir,
        styleRefPaths: refs.usedPaths,
        styleRefFilenames: refs.usedFilenames,
        prefix: '',
      })
    );
  }

  let control: Record<string, unknown> | null = null;
  if (withControl) {
    const controlDir = path.join(outDir, 'control-debug');
    await mkdir(controlDir, { recursive: true });
    control = await runControlBedroomV3TextOnly(controlDir);
  }

  const manifest = {
    phase: '1-v4-reference',
    experiment: 'style-reference-audition',
    generatedAt: new Date().toISOString(),
    provider: 'openai',
    model: 'gpt-image-1',
    requiredApiMode: 'images.edit',
    silentFallbackAllowed: false,
    size: '1024x1536',
    aspectRatio: '2:3',
    styleReferences: {
      directory: STYLE_REF_DIR,
      totalAvailable: refs.allFilenames.length,
      allFilenames: refs.allFilenames,
      allTags: ALL_STYLE_REFERENCES,
      apiMaxPerRequest: GPT_IMAGE_EDIT_MAX_REFERENCES,
      usedFilenames: refs.usedFilenames,
      usedCount: refs.usedFilenames.length,
      subsetReason: refs.subsetReason,
    },
    styleReferenceInstruction: STYLE_REFERENCE_INSTRUCTION,
    sharedStyleBrief: SHARED_STYLE_BRIEF,
    stylePrefixBlock: STYLE_REFERENCE_PREFIX,
    avoidanceBlock: V4_AVOIDANCE_BLOCK,
    ctoCriteria: [
      'premium cinematic storybook quality',
      'rich detailed environments',
      'dense visual storytelling',
      'controlled lively linework',
      'designed characters with nuance',
      'not generic nursery-book',
      'not too simple',
      'not muddy/hazy',
      'not flat cartoon',
      'not photorealistic',
      'no yellow/orange/sepia wash',
      'clean true color and balanced lighting',
      'clear focal hierarchy',
      'layered foreground/midground/background',
      'no text artifacts',
      'no content bleed',
      'no composition bleed',
    ],
    scenes: sceneResults,
    controlRun: control,
    bleedReportSummary: {
      note: 'Per-scene bleed.level is pending_cto_review until Guy/CTO visual pass. Update manifest after review.',
      contentBleedWatchlist: [
        'owl', 'bird', 'puppy', 'dog', 'armadillo', 'dragon', 'bat', 'magical creature',
        'lantern', 'cottage', 'doorway', 'purple dragon', 'stuffed creature from refs',
      ],
      compositionBleedWatchlist: [
        'same window-bed layout as bedroom ref',
        'dentist waiting room layout copied to clinic',
        'porch-lantern-cottage night layout copied',
        'forest armadillo pose copied',
      ],
    },
    decisionTree: {
      A: 'strong style match + no meaningful bleed → leading Style 01 candidate',
      B: 'strong style + mild bleed → curated subset rerun',
      C: 'strong style + major bleed → style refs unsafe; consider LoRA',
      D: 'no improvement over v3 → stop reference mode',
    },
    hardStops: [
      'references cannot load',
      'API rejects references',
      'fallback to text-only without label',
      'heavy creature/content copy',
      'variant of one reference composition',
    ],
    notes: [
      'Style-only — no book pipeline, no child photo, no Bolly ref, no identity test.',
      'Do NOT proceed to Phase 2 until CTO approves v4-reference style.',
    ],
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outDir, 'bleed-report.md'), buildBleedReportMd(manifest), 'utf8');
  await writeFile(
    path.join(outDir, 'references-used.json'),
    JSON.stringify(refs, null, 2) + '\n',
    'utf8'
  );

  console.log('\n=== v4-reference complete ===');
  console.log(`Output: ${outDir}`);
  console.log(`manifest.json + bleed-report.md`);
  if (control) console.log(`Control (separate): ${outDir}/control-debug/`);
}

function buildBleedReportMd(manifest: {
  scenes: Array<{ slug: string; bleedReport: { level: string; sceneMatch: string } }>;
  bleedReportSummary: { contentBleedWatchlist: string[]; compositionBleedWatchlist: string[] };
}): string {
  const lines = [
    '# v4-reference bleed report (CTO fill-in)',
    '',
    'Review each output image against Guy\'s 7 references in `style-references/01/`.',
    '',
    '## Per scene',
    '',
  ];
  for (const s of manifest.scenes as Array<{
    slug: string;
    outputPath: string;
    bleedReport: { level: string; sceneMatch: string };
  }>) {
    lines.push(`### ${s.slug} (\`${s.outputPath}\`)`);
    lines.push(`- Status: **${s.bleedReport.level}**`);
    lines.push(`- ${s.bleedReport.sceneMatch}`);
    lines.push('- Content bleed (owl/bird/puppy/armadillo/dragon/bat/lantern/cottage/etc.): _CTO_');
    lines.push('- Composition bleed (pose/layout/camera): _CTO_');
    lines.push('');
  }
  lines.push('## Watchlist');
  lines.push('');
  lines.push('**Content:** ' + manifest.bleedReportSummary.contentBleedWatchlist.join(', '));
  lines.push('');
  lines.push('**Composition:** ' + manifest.bleedReportSummary.compositionBleedWatchlist.join(', '));
  lines.push('');
  return lines.join('\n');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('run-style-audition-phase1-v4-reference.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error('v4-reference FAILED:', err);
    process.exit(1);
  });
}
