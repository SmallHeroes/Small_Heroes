/**
 * Gallery render — SIX KIDS edition (per Guy, 2026-09-01).
 *
 * Replaces the style01 ("ריאליסטי מאוייר") gallery track with six adventure
 * book pages: each scene has its OWN child photo reference (Guy's six kids),
 * its own companion, and a distinct dynamic situation. Style02 track
 * (gallery-r-*.jpg) is NOT touched.
 *
 * Gallery = marketing → always LOW (same policy as generate-gallery-styles).
 *
 * Render (LOW):
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/generate-gallery-kids.ts
 * Single scene: --scene=3
 * Publish after eyeball (overwrites public/Images/gallery/gallery-1..6.jpg ONLY):
 *   GALLERY_PUBLISH=true GALLERY_PUBLISH_FROM=outputs/gallery-kids/<dir> npx tsx ... scripts/generate-gallery-kids.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
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
  isStyle01Phase2BookPipelineEnabled,
  isStyle01AuditionModeEnabled,
  resolveStyle01AuditionImageQuality,
  resolveStyle01GptModel,
} from '../lib/style01-gptimage';
import { resolveDefaultPageStoryState } from '../lib/story-page-state-catalog';
import type { PageStoryState } from '../lib/story-page-state';
import { estimateGptImage2CostUsd } from '../lib/pricing';

const TOTAL_PAGES = 10;
const PHOTOS_DIR = process.env.KIDS_PHOTOS_DIR?.trim() || 'C:/GNart/Work/SmallHeroesAssets';

const SHARED_GUARDRAILS = [
  'GALLERY GUARDRAILS (non-negotiable):',
  'Medium-wide DYNAMIC adventure scene — NOT a face portrait, NOT a static pose.',
  'HERO DOMINANCE: child protagonist occupies 45–55% of frame height, face readable forward or 3/4 toward viewer, clearly resembling the reference photo (hair type, hair length, face shape, skin tone).',
  'Companion stays on-model, clearly visible beside the child — not hidden, not a speck.',
  'Motion in the scene: wind, stride, mid-action gesture — a page from an adventure, not a posed photo.',
  '[NO TEXT] ABSOLUTE: zero readable Hebrew, English, letters, numbers, signs, labels, book titles, or garbled pseudo-text anywhere.',
  'Reference images may contain text — ignore and do NOT reproduce. Pictorial marks and abstract color blocks only.',
].join(' ');

type KidSceneDef = {
  index: number;
  category: string;
  companionId: string;
  photoFile: string;
  child: { name: string; gender: 'girl' | 'boy'; age: number };
  bookPageText: string;
  sceneCore: string;
  /** Which canonical page-state to borrow; the default (index) can carry a
      companion scene that fights the staging (dini page 4 = bedtime blocks). */
  storyStateIndex?: number;
  /** Full override when every canonical state fights the staging (dini's
      catalog REQUIRES toy_chest on 3-5, forcing the bedroom). */
  storyState?: PageStoryState;
  /** The provider resolves canonical scenes from pageNumber internally -
      point it at a page whose canon matches the staging. */
  pageNumberOverride?: number;
};

/* Guy's mapping: Lavi(7)+fox, Maayan(8)+chameleon, Yuval(8)+bunny,
   Aviv(8)+dragon, Bar(5)+lion, Arbel(5)+panda. Six different-looking kids,
   six different worlds, all adventure pages. */
const KID_SCENES: KidSceneDef[] = [
  {
    index: 1,
    category: 'NIGHT_FEAR',
    companionId: 'fox_uri',
    photoFile: 'Lavi.png',
    child: { name: 'לביא', gender: 'boy', age: 7 },
    bookPageText:
      'לביא צעד בשביל היער עם אוּרי השועל, והפנס הקטן האיר את הדרך - היער שלחש מסביב כבר לא נשמע כל כך גדול.',
    sceneCore: [
      'Night forest lantern-trail adventure, fully on a safe flat woodland path.',
      'A 7-year-old boy walking mid-stride along a winding forest path, holding a small warm lantern ahead of him with both hands.',
      'His small fox companion trots a step ahead on the path, looking back at him encouragingly.',
      'A gentle stream glints BESIDE the path (they are not on or over it); fireflies drift between dark friendly trees; moonlight rims the canopy; the path continues into a warm glow ahead.',
      'Adventure energy: confident stride, jacket edge caught by breeze, lantern light on both faces.',
    ].join(' '),
  },
  {
    index: 2,
    category: 'TRANSITION',
    companionId: 'chameleon_koko',
    photoFile: 'Maayan.png',
    child: { name: 'מעיין', gender: 'boy', age: 8 },
    bookPageText:
      'מעיין רץ בין העלים המתעופפים בגינה, וקִים הזיקית הצביעה מהענף הנמוך על השביל הסודי - ההרפתקה מתחילה מתחת לעץ הגדול.',
    sceneCore: [
      'Garden wind adventure at GROUND LEVEL, late golden afternoon - both feet always on the grass, no deck, no ladder, no railing, no height anywhere.',
      'An 8-year-old boy in a GREEN zip hoodie and dark jeans running through swirling autumn leaves across a garden lawn, one arm reaching toward a low bush archway that opens into a secret path.',
      'His chameleon companion clings to a LOW branch at the boy\'s shoulder height, tail curled, pointing at the archway, mustard-yellow satchel visible - NO scarf.',
      'Golden leaves spiral in the wind, a paper windmill spins on a garden stake, the big oak with its treehouse stands far in the background (nobody on it).',
      'Wardrobe lock: green hoodie, dark jeans - NOT a blue shirt, NO sun logo.',
    ].join(' '),
    storyStateIndex: 2,
  },
  {
    index: 3,
    category: 'MEDICAL_PROCEDURE',
    companionId: 'bunny_ometz',
    photoFile: 'Yuval.png',
    child: { name: 'יובל', gender: 'girl', age: 8 },
    bookPageText:
      'יובל דחפה לאט את שער הגן הישן, ובּוּנִי הארנבון הציץ ראשון מבעד לפתח - מעבר לשער חיכה גן שאף אחד לא ראה קודם.',
    sceneCore: [
      'Secret garden gate discovery, golden afternoon - slow readable poses, faces clearly lit.',
      'An 8-year-old girl in a YELLOW t-shirt dress and white sneakers (NOT a blue shirt, NO sun logo) pushes open an old wooden garden gate overgrown with climbing roses; warm golden light spills through the opening onto her face.',
      'Her expression: wide-eyed delighted wonder, lips parted in a small gasp of discovery - the emotion must clearly match the moment.',
      'Her small bunny companion stands on its two hind legs at the gap, one front paw on the gate edge, peeking through ahead of her, ears up with curiosity, tiny heart badge visible.',
      'ANATOMY LOCK: the bunny has EXACTLY four limbs - two hind legs on the ground, two front paws visible - and the girl has natural realistic proportions, face rendered faithfully to the reference photo.',
      'Through the gate: a glowing hidden garden - fireflies, giant flowers, a winding path; ivy and rose vines frame the frame.',
    ].join(' '),
  },
  {
    index: 4,
    category: 'NEW_SIBLING',
    companionId: 'dragon_dini',
    photoFile: 'Aviv.png',
    child: { name: 'אביב', gender: 'girl', age: 8 },
    bookPageText:
      'אביב רצה בצחוק אחרי הביצה שהתגלגלה במורד מגלשת הקריסטל, ודיני הדרקונית דאתה לצידה - עוד רגע הן תופסות אותה.',
    sceneCore: [
      'OUTDOOR chase adventure on the rolling ORANGE MOSS HILLS - the speckled green egg rolls merrily down a low BLUE CRYSTAL SLIDE onto soft moss, and the heroes chase it, laughing.',
      'JOYFUL mood only: delighted laughing faces, a playful game - NOT anger, NOT screaming, NOT crying.',
      'An 8-year-old girl mid-run on the gentle mossy slope, reaching happily toward the rolling egg, hair flying.',
      'WARDROBE LOCK: coral knit cardigan over a white top, denim shorts, sneakers - absolutely NOT pajamas, NOT socks, NOT nightwear.',
      'Her small dragon companion glides low beside her at shoulder height, wings wide, grinning.',
      'Golden late-afternoon light over the moss hills, sparkling crystal glints, distant valley - safe, level, soft ground everywhere.',
    ].join(' '),
    pageNumberOverride: 10,
  },
  {
    index: 5,
    category: 'ANGER_FRUSTRATION',
    companionId: 'lion_shaket',
    photoFile: 'Bar.png',
    child: { name: 'בר', gender: 'boy', age: 5 },
    bookPageText:
      'בר קפץ מעל שלולית נוצצת בשביל, וליאו האריה זינק לצידו - עוד קפיצה אחת, והם מגיעים לעץ הגדול.',
    sceneCore: [
      'Puddle-hopping adventure on a flat meadow trail after rain, sparkling morning - completely safe ground-level play.',
      'A 5-year-old boy caught MID-HOP over a small shallow rain puddle on the path, arms out wide with joy, laughing, landing spot clear and flat.',
      'His small lion-cub companion leaps in parallel beside him over the same puddle, mane fluffed, tail high.',
      'Sunlit droplets sparkle around them, dragonflies hover, wildflowers and smooth pebbles line the path, a big friendly tree waits ahead.',
      'Peak playful action frame - a small safe jump any 5-year-old makes, water only as a shallow puddle reflection.',
    ].join(' '),
  },
  {
    index: 6,
    category: 'SOCIAL',
    companionId: 'panda_anat',
    photoFile: 'Arbel.png',
    child: { name: 'ארבל', gender: 'girl', age: 5 },
    bookPageText:
      'ארבל הרימה את צנצנת הגחליליות גבוה, ועֲנָת הפנדה הצביעה על הגבישים שנדלקו סביבן - המערה כולה ענתה באור.',
    sceneCore: [
      'Glowing crystal-cave discovery adventure.',
      'A 5-year-old girl lifts a jar of fireflies high with both hands, face lit with wonder by its warm glow.',
      'Her small panda companion stands close beside her, one paw pointing at clusters of softly glowing teal-and-violet crystals answering the light.',
      'Friendly magical cave: smooth rock arches, gentle mist, sparkles drifting like dust, a hint of the forest entrance glowing behind them.',
      'Warm-vs-cool light play: golden jar glow on faces, cool crystal glow in the depths.',
    ].join(' '),
  },
];

function formatOutDir(): string {
  const override = process.env.GALLERY_OUT_DIR?.trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  }
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const hms = d.toISOString().slice(11, 19).replace(/:/g, '');
  return path.join(process.cwd(), 'outputs', 'gallery-kids', `${ymd}-${hms}-low`);
}

function parseSceneFilter(): number | null {
  const arg = process.argv.find((a) => a.startsWith('--scene='));
  if (!arg) return null;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n < 1 || n > 6) throw new Error('--scene must be 1-6');
  return n;
}

function configureEnv(): void {
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.STYLE01_QA_IMAGE_QUALITY = 'low';
  process.env.STYLE_01_AUDITION_MODE = 'true';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  process.env.USE_VISUAL_DIRECTOR = 'false';
  if (!process.env.STYLE_01_GPT_MODEL?.trim()) {
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  }
}

function assertPipelineEnv(): void {
  const errors: string[] = [];
  if (!isStyle01Phase2BookPipelineEnabled()) errors.push('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  if (!isStyle01AuditionModeEnabled()) errors.push('STYLE_01_AUDITION_MODE must be true for LOW');
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

async function downloadImage(url: string, destPath: string): Promise<void> {
  if (existsSync(url)) {
    await writeFile(destPath, await readFile(url));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

async function buildContactSheet(outDir: string, scenes: KidSceneDef[]): Promise<string> {
  const tileW = 400;
  const tileH = 500;
  const labelH = 32;
  const cols = 3;
  const rows = Math.ceil(scenes.length / cols);
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const file = path.join(outDir, `style01-${scene.index}.png`);
    if (!existsSync(file)) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * tileW;
    const top = row * (tileH + labelH) + labelH;
    const tile = await sharp(file)
      .resize(tileW, tileH, { fit: 'contain', background: '#f4efe3' })
      .png()
      .toBuffer();
    composites.push({ input: tile, left, top });
    const label = `${scene.index}. ${scene.photoFile.replace('.png', '')} + ${scene.companionId}`;
    const labelSvg = Buffer.from(
      `<svg width="${tileW}" height="${labelH}"><text x="8" y="22" font-family="sans-serif" font-size="14" fill="#333">${label}</text></svg>`,
    );
    composites.push({ input: labelSvg, left, top: top - labelH });
  }

  const sheetPath = path.join(outDir, 'contact-sheet.png');
  await sharp({
    create: {
      width: tileW * cols,
      height: rows * (tileH + labelH),
      channels: 3,
      background: '#f4efe3',
    },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);
  return sheetPath;
}

/* Publish overwrites the style01 track ONLY - gallery-r-* (style02) stays. */
async function publishFromDir(sourceDirRaw: string): Promise<void> {
  const sourceDir = path.isAbsolute(sourceDirRaw)
    ? sourceDirRaw
    : path.join(process.cwd(), sourceDirRaw);
  if (!existsSync(sourceDir)) throw new Error(`GALLERY_PUBLISH_FROM not found: ${sourceDir}`);
  const publicGallery = path.join(process.cwd(), 'public', 'Images', 'gallery');
  await mkdir(publicGallery, { recursive: true });
  for (let i = 1; i <= 6; i++) {
    const src = path.join(sourceDir, `style01-${i}.png`);
    if (!existsSync(src)) throw new Error(`Missing style01-${i}.png in ${sourceDir}`);
    await sharp(src).jpeg({ quality: 88 }).toFile(path.join(publicGallery, `gallery-${i}.jpg`));
  }
  console.log(`[publish] Wrote public/Images/gallery/gallery-1..6.jpg from ${sourceDir} (style02 track untouched)`);
}

async function renderScene(input: {
  scene: KidSceneDef;
  outDir: string;
  orderId: string;
  appBaseUrl: string;
}): Promise<{ costUsd: number }> {
  const { scene, outDir, orderId, appBaseUrl } = input;
  const companion = getCompanionById(scene.companionId);
  if (!companion) throw new Error(`Companion not found: ${scene.companionId}`);

  const photoPath = path.join(PHOTOS_DIR, scene.photoFile);
  if (!existsSync(photoPath)) throw new Error(`Missing kid photo: ${photoPath}`);

  const visionUrl = await normalizePhotoUrlForVision(photoPath);
  const childPhotoDescription = await describeChildFromPhoto(visionUrl);

  const dna = await generateStoryBankCharacterDNA({
    childName: scene.child.name,
    childGender: scene.child.gender,
    childAge: scene.child.age,
    companionName: companion.name,
    storyText: scene.bookPageText,
    illustrationStyle: 'soft_hand_drawn_storybook',
    childPhotoDescription,
  });

  const scenePrompt = `${scene.sceneCore}\n\n${SHARED_GUARDRAILS}`;

  assembleStyle01Phase2Prompt({
    pageNumber: scene.pageNumberOverride ?? scene.index,
    totalPages: TOTAL_PAGES,
    pagePrompt: scenePrompt,
    rawScenePrompt: scenePrompt,
    bookPageText: scene.bookPageText,
    childFirstName: scene.child.name,
    childAge: scene.child.age,
    childGender: scene.child.gender,
    childDescription: dna.childDNA,
    childStructured: dna.childStructured,
    companion,
    companionStructured: dna.companionStructured,
    pageStoryState: scene.storyState ?? resolveDefaultPageStoryState(companion.id, scene.storyStateIndex ?? scene.index),
    challengeCategory: scene.category,
  });

  await writeFile(path.join(outDir, `scene-${scene.index}-prompt.txt`), scenePrompt, 'utf-8');

  const referenceImages = mergeGptImageReferenceSources(photoPath, companion, appBaseUrl) ?? [];

  console.log(`\n=== Scene ${scene.index}: ${scene.child.name} + ${companion.name} ===`);
  const result = await generateImage({
    pageNumber: scene.pageNumberOverride ?? scene.index,
    totalPages: TOTAL_PAGES,
    bookPageText: scene.bookPageText,
    childFirstName: scene.child.name,
    childAge: scene.child.age,
    childGender: scene.child.gender,
    childDescription: dna.childDNA,
    childStructured: dna.childStructured,
    companion,
    companionStructured: dna.companionStructured,
    referenceImages,
    orderId,
    directionArchetype: 'adventure',
    challengeCategory: scene.category,
    pageStoryState: scene.storyState ?? resolveDefaultPageStoryState(companion.id, scene.storyStateIndex ?? scene.index),
    pagePrompt: scenePrompt,
    rawScenePrompt: scenePrompt,
    illustrationStyle: 'soft_hand_drawn_storybook',
  });

  await downloadImage(result.url, path.join(outDir, `style01-${scene.index}.png`));
  const cost = estimateGptImage2CostUsd(
    (result as { style01Meta?: { usage?: Record<string, unknown> } }).style01Meta?.usage,
  );
  return { costUsd: cost.estimatedCostUsd ?? 0 };
}

async function main(): Promise<void> {
  if (process.env.GALLERY_PUBLISH?.trim().toLowerCase() === 'true') {
    const from = process.env.GALLERY_PUBLISH_FROM?.trim();
    if (!from) throw new Error('GALLERY_PUBLISH=true requires GALLERY_PUBLISH_FROM=<outputs/gallery-kids/...>');
    await publishFromDir(from);
    return;
  }

  configureEnv();
  assertPipelineEnv();

  const sceneFilter = parseSceneFilter();
  const scenes = sceneFilter ? KID_SCENES.filter((s) => s.index === sceneFilter) : KID_SCENES;

  const outDir = formatOutDir();
  await mkdir(outDir, { recursive: true });
  console.log(`\nLOW pass (gallery policy) -> ${outDir}\n`);

  let totalCost = 0;
  const orderId = `gallery-kids-${randomUUID().slice(0, 8)}`;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  for (const scene of scenes) {
    const { costUsd } = await renderScene({ scene, outDir, orderId, appBaseUrl });
    totalCost += costUsd;
  }

  const sheet = await buildContactSheet(outDir, scenes);

  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        outDir,
        quality: 'low',
        scenes: scenes.map((s) => ({
          index: s.index,
          photoFile: s.photoFile,
          child: s.child,
          companionId: s.companionId,
          category: s.category,
        })),
        model: resolveStyle01GptModel(),
        estimatedCostUsd: totalCost,
        publishHint: 'GALLERY_PUBLISH=true GALLERY_PUBLISH_FROM=<this outDir> (style01 track only)',
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log('\n=== Done ===');
  console.log(`Output: ${outDir}`);
  console.log(`Contact sheet: ${sheet}`);
  console.log(`Est. cost: $${totalCost.toFixed(3)}`);
}

main().catch((err) => {
  console.error('\n[generate-gallery-kids] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
