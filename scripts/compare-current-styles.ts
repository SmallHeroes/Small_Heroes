/**
 * Compare CURRENT production Style 01 vs Style 02 on one shared scene (gallery direction).
 * Does NOT use scripts/compare-styles.mjs (relic).
 *
 * Run:
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/compare-current-styles.ts
 *
 * Optional: CHILD_PHOTO_PATH=/path/to/photo.jpg (else Mia order photo from DB)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

import { generateImage } from '../backend/providers/image';
import {
  describeChildFromPhoto,
  generateStoryBankCharacterDNA,
} from '../backend/providers/story-bank-loader';
import { getCompanionById } from '../lib/companions';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import { normalizePhotoUrlForVision } from '../lib/child-photo-normalize';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';
import {
  assembleGuardedV2PagePrompt,
  type GuardedV2PageSpec,
} from '../lib/style02-guarded-v2';
import {
  isStyle01Phase2BookPipelineEnabled,
  isStyle01AuditionModeEnabled,
  resolveStyle01AuditionImageQuality,
  resolveStyle01GptModel,
} from '../lib/style01-gptimage';
import {
  isStyle02Phase2BookPipelineEnabled,
  resolveStyle02BookPromptProfile,
  resolveStyle02RefBudgetConfig,
  resolveStyle02Step5Profile,
  STYLE_02_BEDTIME_MEDICAL_TONE,
  STYLE_02_GPT_MODEL,
} from '../lib/style02-gptimage';
import { resolveDefaultPageStoryState } from '../lib/story-page-state-catalog';
import { estimateGptImage2CostUsd } from '../lib/pricing';

const CHILD = { name: 'מיה', gender: 'girl' as const, age: 8 };
const COMPANION_ID = 'fox_uri';
const PAGE_NUMBER = 1;
const TOTAL_PAGES = 10;
const CHALLENGE_CATEGORY = 'NIGHT_FEAR';
const DIRECTION = 'bedtime' as const;
const MIA_ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';

const BOOK_PAGE_TEXT =
  'מיה לוחשת לעצמה שהלילה גדול, ואוּרי השועל מחזיק את הפנס הקטן — יחד הם מביטים אל הגינה החשוכה מחוץ לחלון.';

const SCENE_CORE = [
  'Medium-wide bedroom scene at night — NOT a face portrait, NOT a close-up headshot.',
  'An 8-year-old girl kneels on a cushioned window seat beside her bedroom window, both hands resting on the sill.',
  'Her small fox companion sits beside her, holding a tiny warm lantern that glows softly.',
  'Together they look out through the glass at a dark garden, distant trees, and a quiet moonlit sky.',
  'The child and fox are both clearly visible in the same frame; the window and night outside are part of the story.',
].join(' ');

const STYLE02_DENSITY_BLOCK = [
  'STYLE 02 — MAGICAL DENSITY (this is the whole selling point vs Style 01 soft simplicity):',
  'Build a richly layered whimsical night-bedroom world — foreground, midground, and background all packed with discoverable detail and atmospheric depth.',
  'FOREGROUND: woven rug with ornate patterns and visible thread texture; scattered picture books with illustrated covers (NO readable titles);',
  'a soft blanket fold with embroidered stars; wooden toy blocks; crayons in a ceramic cup; a tiny mushroom figurine on the sill.',
  'MIDGROUND: the window seat, curtains with layered fabric and subtle star garland draped along the rod;',
  'potted plants in decorated pots on the sill and shelf; hanging paper star lanterns and a small warm night-light;',
  'overflowing bookshelves with colorful spines (abstract color blocks only — NO letters); stuffed toys tucked between books;',
  'child drawings taped to walls (pictorial only — NO writing); star stickers on the window frame; wood grain and paint texture on every surface.',
  'BACKGROUND / THROUGH THE GLASS: moonlit garden depth — distant trees, soft path, firefly-like points of warm light,',
  'garden mushrooms glowing faintly at the edge, layered indigo sky with depth — NOT flat empty night.',
  'TINY BACKGROUND LIFE (NOT main characters): miniature curious creatures peeking from corners — a small moth near the lamp,',
  'a tiny mouse silhouette on a bookshelf ledge, a little owl shape in the garden trees, fireflies outside — charming background cameos only.',
  'LIGHTING: warm magical local glow — fox lantern pool, bedside lamp, garland pinpoints, moon silver on glass;',
  'rich shadows with cinematic depth; cozy enchanted night, NOT harsh noir, NOT global orange wash.',
  'TEXTURE EVERYWHERE: fabric weave, paper grain, painted wood, ceramic glaze, leaf veins, glass reflections —',
  'every corner rewards a second look. The room should feel like an enchanted picture-book world brimming with small treasures.',
  'Density target: Style 02 must look dramatically richer and more detailed than Style 01 on the SAME scene.',
].join(' ');

const STYLE02_COMPARE_GUARDRAILS = [
  'COMPARE GUARDRAILS (critical — differentiate from reference art that drowns the child):',
  'HERO DOMINANCE: the child protagonist remains the clear hero — occupies 45–55% of frame height,',
  'face readable and forward or 3/4 toward viewer, locked identity from photo reference.',
  'NOT a tiny distant back-view silhouette lost inside the environment. The rich world surrounds the child; it does not swallow her.',
  'COMPANION PROMINENCE: the fox companion stays on-model, clearly visible beside the child, holding the tiny lantern —',
  'same design every page, not hidden behind props, not reduced to a speck.',
  '[NO TEXT] ABSOLUTE: zero readable Hebrew, English, letters, numbers, signs, labels, book titles, alphabet charts, or garbled pseudo-text anywhere.',
  'Reference images may contain text — ignore and do NOT reproduce. Pictorial marks and abstract color blocks only.',
].join(' ');

const GUARDED_SPEC: GuardedV2PageSpec = {
  pageNumber: PAGE_NUMBER,
  sceneState: 'transitional',
  framingType: 'medium-environment',
  sceneClass: 'night-bedroom',
  bookPageText: BOOK_PAGE_TEXT,
  imageIntent: 'girl kneeling at bedroom window at night with fox companion and tiny lantern',
};

function formatOutDir(): string {
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const hms = d.toISOString().slice(11, 19).replace(/:/g, '');
  return path.join(process.cwd(), 'outputs', 'style-compare', `${ymd}-${hms}`);
}

function configureEnv(): void {
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.STYLE01_QA_IMAGE_QUALITY = 'low';
  process.env.STYLE_01_AUDITION_MODE = 'true';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  process.env.PHASE2_STYLE02_BOOK_PIPELINE = 'true';
  process.env.PHASE2_STYLE02_REF_CONFIG = 'A';
  process.env.PHASE2_STEP5_PROFILE = 'guarded-v2';
  process.env.USE_VISUAL_DIRECTOR = 'false';

  if (!process.env.STYLE_01_GPT_MODEL?.trim()) {
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  }

  // Dev preview only — generateImage does not call assertOrderStyleSellable; do NOT flip STYLE02_SELLABLE.
}

function assertPipelineEnv(): void {
  const errors: string[] = [];
  if (!isStyle01Phase2BookPipelineEnabled()) {
    errors.push('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  }
  if (!isStyle02Phase2BookPipelineEnabled()) {
    errors.push('PHASE2_STYLE02_BOOK_PIPELINE must be true');
  }
  if (resolveStyle02Step5Profile() !== 'guarded-v2') {
    errors.push('PHASE2_STEP5_PROFILE must be guarded-v2');
  }
  if (resolveStyle02BookPromptProfile() !== 'guarded-v2') {
    errors.push('Style 02 live profile must be guarded-v2');
  }
  if (resolveStyle02RefBudgetConfig() !== 'A') {
    errors.push('PHASE2_STYLE02_REF_CONFIG must be A');
  }
  if (!isStyle01AuditionModeEnabled()) {
    errors.push('STYLE_01_AUDITION_MODE must be true for LOW Style 01');
  }
  try {
    if (resolveStyle01AuditionImageQuality() !== 'low') {
      errors.push('STYLE01_QA_IMAGE_QUALITY must be low');
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (errors.length) {
    throw new Error(`Env guard failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

async function resolveChildPhotoSource(): Promise<string> {
  const envPath = process.env.CHILD_PHOTO_PATH?.trim();
  if (envPath && existsSync(envPath)) {
    console.log(`[photo] Using CHILD_PHOTO_PATH: ${envPath}`);
    return envPath;
  }

  const { prisma } = await import('../lib/prisma');
  try {
    const mia = await prisma.order.findUnique({
      where: { id: MIA_ORDER_ID },
      select: { childImageUrl: true },
    });
    if (mia?.childImageUrl) {
      console.log(`[photo] Using Mia reference from order ${MIA_ORDER_ID}`);
      return mia.childImageUrl;
    }
  } finally {
    await prisma.$disconnect();
  }

  throw new Error(
    'No child photo — set CHILD_PHOTO_PATH or ensure Mia order has childImageUrl'
  );
}

async function resolveChildPhotoPath(photoSource: string): Promise<{ photoPath: string; cleanup?: () => Promise<void> }> {
  if (existsSync(photoSource)) {
    return { photoPath: photoSource };
  }

  const visionUrl = await normalizePhotoUrlForVision(photoSource);
  if (visionUrl.startsWith('data:image/')) {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'style-compare-child-'));
    const photoPath = path.join(tempDir, 'child.jpg');
    const b64 = visionUrl.replace(/^data:image\/\w+;base64,/, '');
    await writeFile(photoPath, Buffer.from(b64, 'base64'));
    return {
      photoPath,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  }

  return { photoPath: photoSource };
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  if (existsSync(url)) {
    await writeFile(destPath, await readFile(url));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

async function buildSideBySide(leftPath: string, rightPath: string, outPath: string): Promise<void> {
  const tileW = 512;
  const tileH = 640;
  const labelH = 36;
  const labels = [
    'Style 01 — soft_hand_drawn_storybook',
    'Style 02 — detailed_whimsical_world',
  ];
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < 2; i++) {
    const file = i === 0 ? leftPath : rightPath;
    const tile = await sharp(file)
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    const left = i * tileW;
    composites.push({ input: tile, left, top: labelH });
    const labelSvg = Buffer.from(
      `<svg width="${tileW}" height="${labelH}"><text x="8" y="24" font-family="sans-serif" font-size="13" fill="#333">${labels[i]}</text></svg>`
    );
    composites.push({ input: labelSvg, left, top: 0 });
  }

  await sharp({
    create: {
      width: tileW * 2,
      height: tileH + labelH,
      channels: 3,
      background: '#f4efe3',
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}

async function main(): Promise<void> {
  configureEnv();
  assertPipelineEnv();

  const companion = getCompanionById(COMPANION_ID);
  if (!companion) throw new Error(`Companion not found: ${COMPANION_ID}`);

  const outDir = formatOutDir();
  await mkdir(outDir, { recursive: true });

  const photoSource = await resolveChildPhotoSource();
  const { photoPath, cleanup } = await resolveChildPhotoPath(photoSource);

  try {
    const visionUrl = await normalizePhotoUrlForVision(
      existsSync(photoPath) ? photoPath : photoSource
    );
    const childPhotoDescription = await describeChildFromPhoto(visionUrl);
    const dna = await generateStoryBankCharacterDNA({
      childName: CHILD.name,
      childGender: CHILD.gender,
      childAge: CHILD.age,
      companionName: companion.name,
      storyText: BOOK_PAGE_TEXT,
      illustrationStyle: 'soft_hand_drawn_storybook',
      childPhotoDescription,
    });

    const sceneStyle01 = SCENE_CORE;
    const sceneStyle02 = `${SCENE_CORE}\n\n${STYLE02_DENSITY_BLOCK}\n\n${STYLE02_COMPARE_GUARDRAILS}`;

    const style01Assembled = assembleStyle01Phase2Prompt({
      pageNumber: PAGE_NUMBER,
      totalPages: TOTAL_PAGES,
      pagePrompt: sceneStyle01,
      rawScenePrompt: sceneStyle01,
      bookPageText: BOOK_PAGE_TEXT,
      childFirstName: CHILD.name,
      childAge: CHILD.age,
      childGender: CHILD.gender,
      childDescription: dna.childDNA,
      childStructured: dna.childStructured,
      companion,
      companionStructured: dna.companionStructured,
      pageStoryState: resolveDefaultPageStoryState(companion.id, PAGE_NUMBER),
      challengeCategory: CHALLENGE_CATEGORY,
    });

    const style02Assembled = assembleGuardedV2PagePrompt({
      sceneDescription: sceneStyle02,
      spec: GUARDED_SPEC,
      bedtimeMedicalTone: false,
      bedtimeMedicalToneBlock: STYLE_02_BEDTIME_MEDICAL_TONE,
    });

    await writeFile(path.join(outDir, 'style01-prompt.txt'), style01Assembled.prompt, 'utf-8');
    await writeFile(path.join(outDir, 'style02-prompt.txt'), style02Assembled.prompt, 'utf-8');
    await writeFile(
      path.join(outDir, 'scene.txt'),
      [
        '=== Shared scene core ===',
        SCENE_CORE,
        '',
        '=== Style 02 density add-on ===',
        STYLE02_DENSITY_BLOCK,
        '',
        '=== Style 02 compare guardrails ===',
        STYLE02_COMPARE_GUARDRAILS,
        '',
        '=== Book page text ===',
        BOOK_PAGE_TEXT,
      ].join('\n'),
      'utf-8'
    );

    for (const w of style02Assembled.warnings) {
      console.warn(`[guarded-v2] ${w}`);
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referenceImages =
      mergeGptImageReferenceSources(photoPath, companion, appBaseUrl) ?? [];
    const orderId = `style-compare-${randomUUID().slice(0, 8)}`;

    const sharedImageInput = {
      pageNumber: PAGE_NUMBER,
      totalPages: TOTAL_PAGES,
      bookPageText: BOOK_PAGE_TEXT,
      childFirstName: CHILD.name,
      childAge: CHILD.age,
      childGender: CHILD.gender,
      childDescription: dna.childDNA,
      childStructured: dna.childStructured,
      companion,
      companionStructured: dna.companionStructured,
      referenceImages,
      orderId,
      directionArchetype: DIRECTION,
      challengeCategory: CHALLENGE_CATEGORY,
      pageStoryState: resolveDefaultPageStoryState(companion.id, PAGE_NUMBER),
    };

    console.log('\n=== Rendering Style 01 (production assembler) ===');
    const style01Result = await generateImage({
      ...sharedImageInput,
      pagePrompt: sceneStyle01,
      rawScenePrompt: sceneStyle01,
      illustrationStyle: 'soft_hand_drawn_storybook',
    });

    console.log('\n=== Rendering Style 02 (production assembler — guarded-v2) ===');
    const style02Result = await generateImage({
      ...sharedImageInput,
      pagePrompt: sceneStyle02,
      rawScenePrompt: sceneStyle02,
      illustrationStyle: 'detailed_whimsical_world',
    });

    const style01Path = path.join(outDir, 'style01.png');
    const style02Path = path.join(outDir, 'style02.png');
    const comparePath = path.join(outDir, 'compare.png');

    await downloadImage(style01Result.url, style01Path);
    await downloadImage(style02Result.url, style02Path);
    await buildSideBySide(style01Path, style02Path, comparePath);

    const cost01 = estimateGptImage2CostUsd(
      (style01Result as { style01Meta?: { usage?: Record<string, unknown> } }).style01Meta?.usage
    );
    const cost02 = estimateGptImage2CostUsd(
      (style02Result as { style02Meta?: { usage?: Record<string, unknown> } }).style02Meta?.usage
    );

    const manifest = {
      outDir,
      scene: 'night-fear window — girl + fox + lantern (NOT portrait)',
      child: CHILD,
      companion: { id: companion.id, name: companion.name },
      models: {
        style01: style01Result.provider ?? resolveStyle01GptModel(),
        style02: style02Result.provider ?? STYLE_02_GPT_MODEL,
      },
      quality: 'low',
      estimatedCostUsd: (cost01.estimatedCostUsd ?? 0) + (cost02.estimatedCostUsd ?? 0),
      files: {
        style01: 'style01.png',
        style02: 'style02.png',
        compare: 'compare.png',
        style01Prompt: 'style01-prompt.txt',
        style02Prompt: 'style02-prompt.txt',
      },
      style02SellableBypass:
        'Dev script only — did not set STYLE02_SELLABLE; generateImage has no sellable gate.',
    };

    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    console.log('\n=== Done ===');
    console.log(`Output: ${outDir}`);
    console.log(`  style01.png / style02.png / compare.png`);
    console.log(`  style01-prompt.txt / style02-prompt.txt`);
    console.log(`Est. cost: $${manifest.estimatedCostUsd.toFixed(3)}`);
    console.log('\nSTOP — eyeball compare.png vs mockup direction.');
  } finally {
    if (cleanup) await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
