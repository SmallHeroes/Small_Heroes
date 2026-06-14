/**
 * Gallery render — 6 MVP scenes × 2 production style assemblers (12 images).
 *
 * Gallery = marketing → always LOW. HIGH (GALLERY_RENDER_HIGH) is for optional dev
 * re-renders only — never required for publish. Customer books use production quality separately.
 *
 * Eyeball LOW previews in outputs/gallery-render/*-low/compare-*.png
 *
 * Publish approved LOW renders to public/Images/gallery/:
 *   GALLERY_PUBLISH=true GALLERY_PUBLISH_FROM=outputs/gallery-render/<timestamp>-low
 * Or render + publish in one run:
 *   GALLERY_PUBLISH=true npx tsx ...
 *
 * Run (LOW preview):
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/generate-gallery-styles.ts
 *
 * Optional: CHILD_PHOTO_PATH=... (girl scenes; else Mia order photo)
 * Optional: --scene=3 (render single scene index 1–6)
 * Optional: GALLERY_RENDER_HIGH=true (dev only — not for gallery publish)
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

const MIA_ORDER_ID = '345ecd64-c9c2-4e0a-8f9d-a35de8d09883';
const TOTAL_PAGES = 10;

const SHARED_GUARDRAILS = [
  'GALLERY GUARDRAILS (non-negotiable):',
  'Medium-wide scene — NOT a face portrait, NOT a close-up headshot.',
  'HERO DOMINANCE: child protagonist occupies 45–55% of frame height, face readable forward or 3/4 toward viewer.',
  'Companion stays on-model, clearly visible beside the child — not hidden, not a speck.',
  '[NO TEXT] ABSOLUTE: zero readable Hebrew, English, letters, numbers, signs, labels, book titles, or garbled pseudo-text anywhere.',
  'Reference images may contain text — ignore and do NOT reproduce. Pictorial marks and abstract color blocks only.',
].join(' ');

const STYLE02_DENSITY_INTRO =
  'STYLE 02 — MAGICAL DENSITY (selling point vs Style 01 soft simplicity): richly layered whimsical world — foreground, midground, background packed with discoverable detail. Every corner rewards a second look. Style 02 must look dramatically denser than Style 01 on the SAME scene.';

type GallerySceneDef = {
  index: number;
  category: string;
  companionId: string;
  child: { name: string; gender: 'girl' | 'boy'; age: number };
  direction: 'bedtime' | 'adventure' | 'fantasy';
  bookPageText: string;
  sceneCore: string;
  style02Density: string;
  guardedSpec: GuardedV2PageSpec;
  usePhotoReference: boolean;
};

const GALLERY_SCENES: GallerySceneDef[] = [
  {
    index: 1,
    category: 'NIGHT_FEAR',
    companionId: 'fox_uri',
    child: { name: 'מיה', gender: 'girl', age: 8 },
    direction: 'bedtime',
    bookPageText:
      'מיה לוחשת לעצמה שהלילה גדול, ואוּרי השועל מחזיק את הפנס הקטן — יחד הם מביטים אל הגינה החשוכה מחוץ לחלון.',
    sceneCore: [
      'Night bedroom window scene.',
      'An 8-year-old girl kneels on a cushioned window seat, both hands on the sill, looking out through the glass.',
      'Her small fox companion sits beside her holding a tiny warm lantern.',
      'Dark garden, distant trees, and quiet moonlit sky visible through the window.',
      'Child and fox both clearly visible in the same frame.',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: woven rug patterns, scattered picture books (NO titles), star-embroidered blanket fold, wooden blocks.',
      'MIDGROUND: layered curtains, star garland, potted plants, warm night-light, overflowing bookshelves (abstract spines only).',
      'BACKGROUND / THROUGH GLASS: moonlit garden depth, firefly-like warm points, layered indigo sky.',
      'TINY BACKGROUND LIFE: small moth near lamp, tiny owl shape in garden trees — cameos only.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'transitional',
      framingType: 'medium-environment',
      sceneClass: 'night-bedroom',
      bookPageText:
        'מיה לוחשת לעצמה שהלילה גדול, ואוּרי השועל מחזיק את הפנס הקטן — יחד הם מביטים אל הגינה החשוכה מחוץ לחלון.',
      imageIntent: 'girl at bedroom window at night with fox companion and tiny lantern',
    },
    usePhotoReference: true,
  },
  {
    index: 2,
    category: 'SOCIAL',
    companionId: 'panda_anat',
    child: { name: 'נועם', gender: 'boy', age: 6 },
    direction: 'adventure',
    bookPageText:
      'נועם עומד בקצה המגרש, ועֲנָת הפנדה לוחשת לו משהו קטן — מספיק כדי לצעוד צעד אחד לכיוון הילדים שמשחקים.',
    sceneCore: [
      'Sunny playground scene — NOT a portrait.',
      'A 6-year-old boy stands at the edge of a playground, one foot forward as if gathering courage.',
      'His panda companion stands beside him at knee height, one paw gently pointing toward children playing on swings and sandbox.',
      'Open sky, colorful play structures, and other children in soft background — child and panda are the clear heroes.',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: chalk drawings on pavement (pictorial only), fallen leaf, small toy truck, textured playground rubber tiles.',
      'MIDGROUND: climbing frame with flags and ribbons (no text), sandbox toys, picnic blanket, potted flowers along fence.',
      'BACKGROUND: trees, distant houses, birds, layered afternoon light; busy playground life as rich backdrop.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'daytime',
      framingType: 'medium-environment',
      sceneClass: 'forest-outdoor-environment',
      bookPageText:
        'נועם עומד בקצה המגרש, ועֲנָת הפנדה לוחשת לו משהו קטן — מספיק כדי לצעוד צעד אחד לכיוון הילדים שמשחקים.',
      imageIntent: 'boy at playground edge with panda companion watching other children play',
    },
    usePhotoReference: false,
  },
  {
    index: 3,
    category: 'MEDICAL_PROCEDURE',
    companionId: 'bunny_ometz',
    child: { name: 'מיה', gender: 'girl', age: 7 },
    direction: 'adventure',
    bookPageText:
      'מיה יושבת על כיסא הרופא, וּבּוּנִי הארנב הקטן לוחש לה שהיד שלה יכולה להיות קצת רועדת — וזה בסדר.',
    sceneCore: [
      'Calm pediatric clinic exam room — NOT a portrait.',
      'A 7-year-old girl sits on an exam chair, feet not quite touching the floor, hands resting on her lap.',
      'Her small bunny companion sits on the chair arm beside her with a tiny heart badge visible.',
      'Soft medical room: gentle wall colors, stethoscope on hook, friendly poster shapes (NO text), warm daylight from window.',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: colorful bandage stickers in a jar, soft tissue box with floral pattern, textured floor mat.',
      'MIDGROUND: medical tools on tray (abstract shapes), potted plant, coat hook, cheerful wall decals (pictorial only).',
      'BACKGROUND: window with soft clouds, cabinet with colored supply boxes (no labels), calm clinic depth.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'transitional',
      framingType: 'medium-environment',
      sceneClass: 'daytime-interior',
      bookPageText:
        'מיה יושבת על כיסא הרופא, וּבּוּנִי הארנב הקטן לוחש לה שהיד שלה יכולה להיות קצת רועדת — וזה בסדר.',
      imageIntent: 'girl on exam chair in calm clinic with bunny companion',
    },
    usePhotoReference: true,
  },
  {
    index: 4,
    category: 'NEW_SIBLING',
    companionId: 'dragon_dini',
    child: { name: 'נועם', gender: 'boy', age: 5 },
    direction: 'fantasy',
    bookPageText:
      'נועם מביט אל העגלה, ודיני הדרקון הקטן יושב על המיטה ולוחש: גם כשמגיע תינוק — עדיין יש לך מקום.',
    sceneCore: [
      'Cozy home nursery-adjacent bedroom — NOT a portrait.',
      'A 5-year-old boy stands beside a crib, one hand resting on the rail, looking at a newborn baby sleeping peacefully in the crib.',
      'His small friendly dragon companion perches on the bed edge nearby, wings folded, expression gentle.',
      'Warm home details: mobile above crib (no text), soft blanket, family photos in frames (blurred faces ok, NO readable text).',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: stuffed animals, picture books stacked (no titles), soft rug with star pattern.',
      'MIDGROUND: crib mobile with moons and stars, diaper supplies in woven basket, warm lamp glow, wall decals.',
      'BACKGROUND: doorway glimpse of hallway, layered home warmth, gentle evening light.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'transitional',
      framingType: 'medium-environment',
      sceneClass: 'daytime-interior',
      bookPageText:
        'נועם מביט אל העגלה, ודיני הדרקון הקטן יושב על המיטה ולוחש: גם כשמגיע תינוק — עדיין יש לך מקום.',
      imageIntent: 'boy at crib with baby sibling and small dragon companion at home',
    },
    usePhotoReference: false,
  },
  {
    index: 5,
    category: 'TRANSITION',
    companionId: 'chameleon_koko',
    child: { name: 'מיה', gender: 'girl', age: 7 },
    direction: 'adventure',
    bookPageText:
      'מיה פותחת קרטון חדש, וקִים הזיקית עם התיק הצה-חרדל (בלי צעיף!) יושב עליו — בכל מקום חדש, חלק מהבית נוסע איתך.',
    sceneCore: [
      'New room with moving boxes — NOT a portrait.',
      'A 7-year-old girl kneels opening a cardboard moving box, lifting a folded blanket.',
      'Her chameleon companion Kim sits on the box lid wearing a mustard-yellow satchel — NO scarf on the chameleon.',
      'Half-unpacked room: stacked boxes, rolled rug, window with new view, tape and bubble wrap — child and chameleon are heroes.',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: packing tape, bubble wrap texture, labeled-free cardboard flaps, crayon box peeking out.',
      'MIDGROUND: stacked boxes with doodled stickers (pictorial), floor lamp, houseplant in pot, window with new neighborhood view.',
      'BACKGROUND: doorway to hallway, moving dolly, layered afternoon light through dust motes.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'daytime',
      framingType: 'medium-environment',
      sceneClass: 'daytime-interior',
      bookPageText:
        'מיה פותחת קרטון חדש, וקִים הזיקית עם התיק הצה-חרדל (בלי צעיף!) יושב עליו — בכל מקום חדש, חלק מהבית נוסע איתך.',
      imageIntent: 'girl opening moving box with chameleon Kim mustard satchel no scarf',
    },
    usePhotoReference: true,
  },
  {
    index: 6,
    category: 'ANGER_FRUSTRATION',
    companionId: 'lion_shaket',
    child: { name: 'נועם', gender: 'boy', age: 6 },
    direction: 'adventure',
    bookPageText:
      'נועם מרגיש כעס גדול בחזה, וליאו האריה הקטן יושב לידו על השטיח — לפעמים ללחש חזק יותר מצעקה.',
    sceneCore: [
      'Home living room — big-feeling moment — NOT a portrait.',
      'A 6-year-old boy sits on a soft rug, knees up, fists loosely clenched, face showing frustrated feeling but not scary rage.',
      'His small lion companion sits beside him, one paw on the boy\'s shoulder, calm warm expression.',
      'Toppled block tower nearby, soft sofa, warm lamp — cozy home, emotional moment, child and lion clearly visible.',
    ].join(' '),
    style02Density: [
      STYLE02_DENSITY_INTRO,
      'FOREGROUND: scattered building blocks, crumpled paper ball (no writing), textured rug weave, toy cars.',
      'MIDGROUND: fallen block tower, bookshelf with colorful spines (abstract), warm floor lamp, houseplant.',
      'BACKGROUND: sofa with throw pillows, family art on wall (pictorial only), layered cozy home depth.',
    ].join(' '),
    guardedSpec: {
      pageNumber: 1,
      sceneState: 'transitional',
      framingType: 'medium-environment',
      sceneClass: 'daytime-interior',
      bookPageText:
        'נועם מרגיש כעס גדול בחזה, וליאו האריה הקטן יושב לידו על השטיח — לפעמים ללחש חזק יותר מצעקה.',
      imageIntent: 'boy on rug with frustrated feeling and small lion companion at home',
    },
    usePhotoReference: false,
  },
];

function formatOutDir(): string {
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const hms = d.toISOString().slice(11, 19).replace(/:/g, '');
  const quality = process.env.GALLERY_RENDER_HIGH?.trim().toLowerCase() === 'true' ? 'high' : 'low';
  return path.join(process.cwd(), 'outputs', 'gallery-render', `${ymd}-${hms}-${quality}`);
}

function parseSceneFilter(): number | null {
  const arg = process.argv.find((a) => a.startsWith('--scene='));
  if (!arg) return null;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n < 1 || n > 6) {
    throw new Error('--scene must be 1–6');
  }
  return n;
}

function configureEnv(): { quality: 'low' | 'high' } {
  const high = process.env.GALLERY_RENDER_HIGH?.trim().toLowerCase() === 'true';
  process.env.IMAGE_PROVIDER = 'gpt-image';
  process.env.GPT_IMAGE_QUALITY = high ? 'high' : 'low';
  process.env.STYLE01_QA_IMAGE_QUALITY = high ? 'high' : 'low';
  process.env.STYLE_01_AUDITION_MODE = high ? 'false' : 'true';
  process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
  process.env.PHASE2_STYLE02_BOOK_PIPELINE = 'true';
  process.env.PHASE2_STYLE02_REF_CONFIG = 'A';
  process.env.PHASE2_STEP5_PROFILE = 'guarded-v2';
  process.env.USE_VISUAL_DIRECTOR = 'false';

  if (!process.env.STYLE_01_GPT_MODEL?.trim()) {
    process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  }

  return { quality: high ? 'high' : 'low' };
}

function assertPipelineEnv(quality: 'low' | 'high'): void {
  const errors: string[] = [];
  if (!isStyle01Phase2BookPipelineEnabled()) errors.push('PHASE2_STYLE01_BOOK_PIPELINE must be true');
  if (!isStyle02Phase2BookPipelineEnabled()) errors.push('PHASE2_STYLE02_BOOK_PIPELINE must be true');
  if (resolveStyle02Step5Profile() !== 'guarded-v2') errors.push('PHASE2_STEP5_PROFILE must be guarded-v2');
  if (resolveStyle02BookPromptProfile() !== 'guarded-v2') {
    errors.push('Style 02 live profile must be guarded-v2');
  }
  if (resolveStyle02RefBudgetConfig() !== 'A') errors.push('PHASE2_STYLE02_REF_CONFIG must be A');
  if (quality === 'low') {
    if (!isStyle01AuditionModeEnabled()) errors.push('STYLE_01_AUDITION_MODE must be true for LOW');
    try {
      if (resolveStyle01AuditionImageQuality() !== 'low') {
        errors.push('STYLE01_QA_IMAGE_QUALITY must be low for LOW pass');
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
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

  throw new Error('No child photo — set CHILD_PHOTO_PATH or ensure Mia order has childImageUrl');
}

async function resolveChildPhotoPath(photoSource: string): Promise<{ photoPath: string; cleanup?: () => Promise<void> }> {
  if (existsSync(photoSource)) return { photoPath: photoSource };

  const visionUrl = await normalizePhotoUrlForVision(photoSource);
  if (visionUrl.startsWith('data:image/')) {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'gallery-child-'));
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
  const labels = ['Style 01 — רך וחמים', 'Style 02 — עולם קסום'];
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

function resolvePublishSourceDir(raw: string): string {
  const abs = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  if (!existsSync(abs)) {
    throw new Error(`GALLERY_PUBLISH_FROM not found: ${abs}`);
  }
  return abs;
}

async function publishToPublic(outDir: string, quality: 'low' | 'high'): Promise<void> {
  const publicGallery = path.join(process.cwd(), 'public', 'Images', 'gallery');
  await mkdir(publicGallery, { recursive: true });

  for (let i = 1; i <= 6; i++) {
    const s01 = path.join(outDir, `style01-${i}.png`);
    const s02 = path.join(outDir, `style02-${i}.png`);
    if (!existsSync(s01) || !existsSync(s02)) {
      throw new Error(`Missing render for scene ${i} in ${outDir} — cannot publish`);
    }
    await sharp(s01).jpeg({ quality: 88 }).toFile(path.join(publicGallery, `gallery-${i}.jpg`));
    await sharp(s02).jpeg({ quality: 88 }).toFile(path.join(publicGallery, `gallery-r-${i}.jpg`));
  }
  console.log(
    `[publish] Wrote public/Images/gallery/gallery-1..6.jpg + gallery-r-1..6.jpg (from ${quality} renders)`
  );
}

/** Publish an existing render folder without re-running the API. */
async function publishOnlyFromEnv(): Promise<void> {
  const raw = process.env.GALLERY_PUBLISH_FROM?.trim();
  if (!raw) {
    throw new Error('GALLERY_PUBLISH=true with no render run requires GALLERY_PUBLISH_FROM=<outputs/...-low>');
  }
  const sourceDir = resolvePublishSourceDir(raw);
  const manifestPath = path.join(sourceDir, 'manifest.json');
  let quality: 'low' | 'high' = 'low';
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as { quality?: string };
      if (manifest.quality === 'high' || manifest.quality === 'low') {
        quality = manifest.quality;
      }
    } catch {
      /* manifest optional */
    }
  } else if (sourceDir.endsWith('-high')) {
    quality = 'high';
  }
  await publishToPublic(sourceDir, quality);
  console.log(`\n=== Published ===\nSource: ${sourceDir}\nQuality: ${quality}`);
}

async function renderScene(input: {
  scene: GallerySceneDef;
  outDir: string;
  photoPath: string | null;
  orderId: string;
  appBaseUrl: string;
}): Promise<{ costUsd: number }> {
  const { scene, outDir, photoPath, orderId, appBaseUrl } = input;
  const companion = getCompanionById(scene.companionId);
  if (!companion) throw new Error(`Companion not found: ${scene.companionId}`);

  let childPhotoDescription: string | null = null;
  if (scene.usePhotoReference && photoPath) {
    const visionUrl = await normalizePhotoUrlForVision(photoPath);
    childPhotoDescription = await describeChildFromPhoto(visionUrl);
  }

  const dna = await generateStoryBankCharacterDNA({
    childName: scene.child.name,
    childGender: scene.child.gender,
    childAge: scene.child.age,
    companionName: companion.name,
    storyText: scene.bookPageText,
    illustrationStyle: 'soft_hand_drawn_storybook',
    childPhotoDescription,
  });

  const sceneStyle01 = `${scene.sceneCore}\n\n${SHARED_GUARDRAILS}`;
  const sceneStyle02 = `${scene.sceneCore}\n\n${scene.style02Density}\n\n${SHARED_GUARDRAILS}`;

  assembleStyle01Phase2Prompt({
    pageNumber: scene.index,
    totalPages: TOTAL_PAGES,
    pagePrompt: sceneStyle01,
    rawScenePrompt: sceneStyle01,
    bookPageText: scene.bookPageText,
    childFirstName: scene.child.name,
    childAge: scene.child.age,
    childGender: scene.child.gender,
    childDescription: dna.childDNA,
    childStructured: dna.childStructured,
    companion,
    companionStructured: dna.companionStructured,
    pageStoryState: resolveDefaultPageStoryState(companion.id, scene.index),
    challengeCategory: scene.category,
  });

  const style02Assembled = assembleGuardedV2PagePrompt({
    sceneDescription: sceneStyle02,
    spec: scene.guardedSpec,
    bedtimeMedicalTone: scene.category === 'MEDICAL_PROCEDURE',
    bedtimeMedicalToneBlock: STYLE_02_BEDTIME_MEDICAL_TONE,
  });

  await writeFile(path.join(outDir, `scene-${scene.index}-style01-prompt.txt`), sceneStyle01, 'utf-8');
  await writeFile(path.join(outDir, `scene-${scene.index}-style02-prompt.txt`), style02Assembled.prompt, 'utf-8');

  const referenceImages =
    scene.usePhotoReference && photoPath
      ? (mergeGptImageReferenceSources(photoPath, companion, appBaseUrl) ?? [])
      : (mergeGptImageReferenceSources(null, companion, appBaseUrl) ?? []);

  const sharedImageInput = {
    pageNumber: scene.index,
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
    directionArchetype: scene.direction,
    challengeCategory: scene.category,
    pageStoryState: resolveDefaultPageStoryState(companion.id, scene.index),
  };

  console.log(`\n=== Scene ${scene.index} (${scene.category}) — Style 01 ===`);
  const style01Result = await generateImage({
    ...sharedImageInput,
    pagePrompt: sceneStyle01,
    rawScenePrompt: sceneStyle01,
    illustrationStyle: 'soft_hand_drawn_storybook',
  });

  console.log(`=== Scene ${scene.index} (${scene.category}) — Style 02 ===`);
  const style02Result = await generateImage({
    ...sharedImageInput,
    pagePrompt: sceneStyle02,
    rawScenePrompt: sceneStyle02,
    illustrationStyle: 'detailed_whimsical_world',
  });

  const style01Path = path.join(outDir, `style01-${scene.index}.png`);
  const style02Path = path.join(outDir, `style02-${scene.index}.png`);
  const comparePath = path.join(outDir, `compare-${scene.index}.png`);

  await downloadImage(style01Result.url, style01Path);
  await downloadImage(style02Result.url, style02Path);
  await buildSideBySide(style01Path, style02Path, comparePath);

  const cost01 = estimateGptImage2CostUsd(
    (style01Result as { style01Meta?: { usage?: Record<string, unknown> } }).style01Meta?.usage
  );
  const cost02 = estimateGptImage2CostUsd(
    (style02Result as { style02Meta?: { usage?: Record<string, unknown> } }).style02Meta?.usage
  );

  return { costUsd: (cost01.estimatedCostUsd ?? 0) + (cost02.estimatedCostUsd ?? 0) };
}

async function main(): Promise<void> {
  const publishRequested = process.env.GALLERY_PUBLISH?.trim().toLowerCase() === 'true';
  const publishFromOnly = Boolean(process.env.GALLERY_PUBLISH_FROM?.trim());

  if (publishRequested && publishFromOnly) {
    await publishOnlyFromEnv();
    return;
  }

  const { quality } = configureEnv();
  assertPipelineEnv(quality);

  if (quality === 'high') {
    console.warn('\n⚠ HIGH dev re-render — gallery marketing uses LOW; customer books use production pipeline.\n');
  } else {
    console.log('\nLOW quality pass — eyeball compare-*.png, then GALLERY_PUBLISH=true to ship to landing.\n');
  }

  const sceneFilter = parseSceneFilter();
  const scenes = sceneFilter
    ? GALLERY_SCENES.filter((s) => s.index === sceneFilter)
    : GALLERY_SCENES;

  const outDir = formatOutDir();
  await mkdir(outDir, { recursive: true });

  const photoSource = await resolveChildPhotoSource();
  const { photoPath: resolvedPhotoPath, cleanup } = await resolveChildPhotoPath(photoSource);

  let totalCost = 0;
  const orderId = `gallery-${randomUUID().slice(0, 8)}`;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    for (const scene of scenes) {
      const photoPath = scene.usePhotoReference ? resolvedPhotoPath : null;
      const { costUsd } = await renderScene({
        scene,
        outDir,
        photoPath,
        orderId,
        appBaseUrl,
      });
      totalCost += costUsd;
    }

    const manifest = {
      outDir,
      quality,
      scenes: scenes.map((s) => ({
        index: s.index,
        category: s.category,
        companionId: s.companionId,
        child: s.child,
        usePhotoReference: s.usePhotoReference,
      })),
      models: {
        style01: resolveStyle01GptModel(),
        style02: STYLE_02_GPT_MODEL,
      },
      estimatedCostUsd: totalCost,
      publishHint:
        'After eyeball: GALLERY_PUBLISH=true GALLERY_PUBLISH_FROM=<this outDir> npx tsx ... (LOW is fine)',
      style02SellableBypass:
        'Dev script only — did not set STYLE02_SELLABLE; generateImage has no sellable gate.',
    };

    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    if (publishRequested) {
      await publishToPublic(outDir, quality);
    }

    console.log('\n=== Done ===');
    console.log(`Output: ${outDir}`);
    console.log(`Quality: ${quality}`);
    console.log(`Est. cost: $${totalCost.toFixed(3)}`);
    console.log('Files: style01-N.png, style02-N.png, compare-N.png per scene');
    if (!publishRequested) {
      console.log(
        `\nTo publish these ${quality} renders: GALLERY_PUBLISH=true GALLERY_PUBLISH_FROM=${outDir} npx tsx ...`
      );
    }
  } finally {
    if (cleanup) await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
