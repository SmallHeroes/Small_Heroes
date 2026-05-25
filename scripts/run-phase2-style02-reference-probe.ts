/**
 * Step 4 — reference-budget probe (configs A / B / C).
 * STOP after this script — CTO picks config before Step 5 book test.
 *
 * Usage:
 *   PHASE2_STYLE02_BOOK_PIPELINE=true npx tsx scripts/run-phase2-style02-reference-probe.ts
 *
 * Env:
 *   CHILD_PHOTO_PATH — required (local path or URL)
 *   COMPANION_ID — default bolly_armadillo
 *   PROBE_SCENES — comma slugs: classroom-day,forest-magical (default both)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateGPTImage } from '../lib/generate-image';
import {
  assembleStyle02BookReferences,
  buildStyle02BookPagePrompt,
  buildStyle02ChildVisualLock,
  buildStyle02CompanionTextLock,
  buildStyle02WardrobeLock,
  resolveCompanionReferencePath,
  resolveStyle02StyleReferencePaths,
  STYLE_02_AVOIDANCE_NEGATIVE,
  STYLE_02_GPT_MODEL,
  type Style02RefBudgetConfig,
  type Style02SceneSubsetKey,
} from '../lib/style02-gptimage';
import { getCompanionById } from '../lib/companions';

const PROBE_SCENES: Record<
  Style02SceneSubsetKey,
  { slug: string; sceneDescription: string }
> = {
  'classroom-day': {
    slug: 'classroom-day',
    sceneDescription:
      'Bright daytime classroom — child and companion among crowded desks, books, art supplies, plants; strong sunbeams through windows, dust in light; cinematic daylight, no night mood.',
  },
  'forest-magical': {
    slug: 'forest-magical',
    sceneDescription:
      'Magical forest path — child and companion walking; dense foliage, moss, mushrooms, sunbeams through canopy, layered depth, firefly-like particles.',
  },
  'bedroom-night': {
    slug: 'bedroom-night',
    sceneDescription: 'Cozy bedroom at night — child and companion; lamp vs moonlight contrast, packed room detail.',
  },
  'clinic-day': {
    slug: 'clinic-day',
    sceneDescription: "Bright children's clinic — child and companion; jars, wood shelves, daylight window.",
  },
};

const CONFIGS: Style02RefBudgetConfig[] = ['A', 'B', 'C'];

function parseScenes(): Style02SceneSubsetKey[] {
  const raw = process.env.PROBE_SCENES ?? 'classroom-day,forest-magical';
  const keys = raw.split(',').map((s) => s.trim()) as Style02SceneSubsetKey[];
  return keys.filter((k) => k in PROBE_SCENES);
}

async function runOne(
  config: Style02RefBudgetConfig,
  subsetKey: Style02SceneSubsetKey,
  childPhoto: string,
  companionRef: string | undefined,
  outDir: string
) {
  process.env.PHASE2_STYLE02_REF_CONFIG = config;
  const styleCount = config === 'A' ? 2 : 3;
  const stylePaths = resolveStyle02StyleReferencePaths(subsetKey, styleCount);
  const { paths, breakdown } = assembleStyle02BookReferences({
    styleRefPaths: stylePaths,
    childPhotoPath: config === 'C' ? undefined : childPhoto,
    companionRefPath: config === 'B' ? undefined : companionRef,
    config,
  });

  const childVisualLock = buildStyle02ChildVisualLock({
    childName: 'TestChild',
    childDescription: 'young child around 5 years old',
    childAge: 5,
    childGender: 'neutral',
  });
  const wardrobeLock = buildStyle02WardrobeLock({});
  const companion = getCompanionById(process.env.COMPANION_ID ?? 'bolly_armadillo');
  const companionTextLock = buildStyle02CompanionTextLock({
    companionName: companion?.name,
    companionVisualDescription: companion?.visualDescription,
  });

  const prompt = buildStyle02BookPagePrompt({
    sceneDescription: PROBE_SCENES[subsetKey].sceneDescription,
    childVisualLock,
    wardrobeLock,
    companionTextLock,
  });

  const gen = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_02_AVOIDANCE_NEGATIVE,
    referenceImages: paths,
    referenceMode: 'style02_book',
    requireReferenceEdit: true,
    modelOverride: STYLE_02_GPT_MODEL,
    size: '1024x1536',
    quality: 'high',
  });

  if (gen.model !== STYLE_02_GPT_MODEL) {
    throw new Error(`Model mismatch: ${gen.model}`);
  }

  const base = `config-${config}-${subsetKey}`;
  const png = `${base}.png`;
  const promptPath = `${base}-prompt.txt`;
  await writeFile(path.join(outDir, png), gen.buffer);
  await writeFile(path.join(outDir, promptPath), prompt, 'utf8');

  return {
    config,
    scene: subsetKey,
    outputPath: png,
    promptPath,
    model: gen.model,
    apiMode: gen.apiMode,
    quality: 'high',
    size: '1024x1536',
    refsRequested: gen.referenceCountRequested,
    refsPassed: gen.referenceCountPassed,
    fallbackUsed: gen.fallbackUsed,
    referenceBreakdown: breakdown,
    durationMs: gen.durationMs,
    usage: gen.usage,
    responseMeta: gen.responseMeta,
  };
}

async function main() {
  const childPhoto = process.env.CHILD_PHOTO_PATH?.trim();
  if (!childPhoto) {
    console.error('CHILD_PHOTO_PATH required');
    process.exit(1);
  }
  if (!existsSync(childPhoto) && !childPhoto.startsWith('http')) {
    console.error(`CHILD_PHOTO_PATH not found: ${childPhoto}`);
    process.exit(1);
  }

  const companion = getCompanionById(process.env.COMPANION_ID ?? 'bolly_armadillo');
  const companionRef = resolveCompanionReferencePath(companion?.image ?? null);
  if (!companionRef) {
    console.error('Companion reference image missing');
    process.exit(1);
  }

  const scenes = parseScenes();
  const outDir = path.join(
    process.cwd(),
    'phase2-logs',
    `reference-budget-probe-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  );
  await mkdir(outDir, { recursive: true });

  console.log('=== Phase 2 Step 4 — reference-budget probe ===');
  console.log(`Output: ${outDir}`);
  console.log(`Configs: ${CONFIGS.join(', ')} | Scenes: ${scenes.join(', ')}`);
  console.log('STOP after this run — CTO selects config for Step 5.\n');

  const runs: Record<string, unknown>[] = [];

  for (const scene of scenes) {
    for (const cfg of CONFIGS) {
      console.log(`--- ${cfg} / ${scene} ---`);
      const row = await runOne(cfg, scene, childPhoto, companionRef, outDir);
      runs.push(row);
      await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ status: 'in_progress', runs }, null, 2) + '\n', 'utf8');
    }
  }

  const manifest = {
    phase: 'phase2-step4-reference-budget-probe',
    status: 'complete',
    model: STYLE_02_GPT_MODEL,
    childPhotoPath: childPhoto,
    companionId: companion?.id,
    companionRefPath: companionRef,
    configs: CONFIGS,
    scenes,
    runs,
    ctoNext: 'Pick A, B, or C — then set PHASE2_STYLE02_REF_CONFIG and run Step 5 book test.',
  };

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(
    path.join(outDir, 'CTO_CHECKPOINT.md'),
    [
      '# CTO checkpoint — reference budget',
      '',
      'Compare configs A / B / C for each scene in this folder.',
      '',
      '| Config | Style refs | Child photo | Companion image |',
      '|--------|------------|-------------|-----------------|',
      '| A | 2 | yes | yes |',
      '| B | 3 | yes | text only |',
      '| C | 3 | text lock only | yes |',
      '',
      '**Do not run Step 5 until config is chosen.**',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log('\n=== Probe complete — awaiting CTO config choice ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
