/**
 * Style 01 (gpt-image-1) — guarded book pipeline with lock architecture mirroring Style 02.
 * Gated by PHASE2_STYLE01_BOOK_PIPELINE=true.
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';
import type { Style02RefBudgetConfig } from './style02-gptimage';
import { resolveStyle01StoryWardrobeLock } from './style01-story-wardrobe';

export const STYLE_01_GPT_MODEL_DEFAULT = 'gpt-image-1';

/** Escalation: set STYLE_01_GPT_MODEL=gpt-image-2 to re-run same lock architecture on gpt-image-2. */
export function resolveStyle01GptModel(): string {
  const raw = process.env.STYLE_01_GPT_MODEL?.trim();
  return raw || STYLE_01_GPT_MODEL_DEFAULT;
}

/** @deprecated Use resolveStyle01GptModel() — kept for imports that expect a constant label. */
export const STYLE_01_GPT_MODEL = STYLE_01_GPT_MODEL_DEFAULT;

export const STYLE_01_REF_DIR = path.join(process.cwd(), 'style-references', '01');

export type Style01SceneClass =
  | 'fantasy-cave'
  | 'forest-day'
  | 'forest-clearing'
  | 'forest-path'
  | 'outdoor-nature'
  | 'cozy-interior'
  | 'outdoor-magical';

export type Style01SceneSubsetKey = 'fantasy-cave' | 'cozy-interior' | 'outdoor-magical';

export const STYLE_01_SHARED =
  "Style 01: soft hand-drawn children's storybook illustration on warm cream paper. Gentle transparent watercolor washes, delicate linework, luminous muted palette, cozy picture-book warmth. NOT cinematic Style 02. NOT dense ink-and-gouache. NOT photorealistic. NOT Pixar CGI.";

export const STYLE_01_RENDERING_CORRECTION =
  'RENDERING: soft watercolor storybook — visible paper texture, gentle pigment bleeds, rounded expressive characters, warm local color, airy negative space. NOT harsh shadows. NOT global orange filter. NOT empty cream void background.';

export const STYLE_01_FRAMING_RULE = `FRAMING RULE — BREATHE:
- Characters fill NO MORE than 35-50% of frame height.
- Environment must occupy at least 50% of visible area.
- Avoid tight portrait crops. Avoid close-up faces unless explicitly specified as "close-up" shotType.
- For "wide" / "medium-wide" / "establishing" shots: characters should be in lower third or off-center, environment dominates.
- For "intimate" shots: still leave breathing room — show the surrounding environment described in THIS page's staging (never default to a cave or any fixed location); keep depth and scene context visible. NOT a portrait crop.
- FORBIDDEN: character filling frame, tight headshot, claustrophobic framing, no environmental context.`;

export const STYLE_01_REFERENCE_INSTRUCTION =
  'Use attached STYLE reference images for VISUAL STYLE ONLY: soft watercolor technique, paper texture, gentle palette, picture-book warmth. Do NOT copy exact creatures, text, signs, compositions, or characters from references. Create the new original scene below.';

export const STYLE_01_NO_TEXT =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, or watermarks.';

export const STYLE_01_ANTI_STYLE02 =
  'NOT Style 02. NOT cinematic fantasy. NOT dense ink crosshatching. NOT dramatic spotlight noir. NOT semi-realistic portrait rendering.';

export const STYLE_01_CHILD_PHOTO_IDENTITY_RULE =
  'CHILD PHOTO (if attached): IDENTITY ONLY — face shape, hair, skin tone, age, gender. Render as soft hand-drawn watercolor storybook child — NEVER photoreal cutout. Outfit from WARDROBE LOCK and scene, never from photo.';

/** Scene-typed Style 01 reference subsets. */
export const STYLE_01_REF_SUBSETS: Record<
  Style01SceneSubsetKey,
  { filenames: string[]; reason: string }
> = {
  'fantasy-cave': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
      'ChatGPT Image May 18, 2026, 11_59_17 AM.png',
      'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
      'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
    ],
    reason: 'Warm cave / magical interior watercolor refs.',
  },
  'cozy-interior': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_12_02 PM.png',
      'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
      'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
    ],
    reason: 'Bedroom / cozy interior soft watercolor refs.',
  },
  'outdoor-magical': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
      'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
      'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
    ],
    reason: 'Outdoor / sky / magical landscape watercolor refs.',
  },
};

const FANTASY_CAVE_RE =
  /\b(cave|cave mouth|cave entrance|cave interior|inside cave|stalactites|stalagmites|mountain cave|mountain peak|cliff|glowing stones?|warm stone|amber glow|cavern|grotto|hollow|rocky walls|מערה|אבנ(?:ים|ה)|הר|מצוק|נטיפים|זיבים)\b/iu;
const FOREST_CLEARING_RE =
  /\b(forest clearing|sunny forest|berry bush|mossy green rock|clearing)\b/iu;
const FOREST_PATH_RE =
  /\b(forest path|deeper forest path|walking into the forest|woods path|path into the forest)\b/iu;
const FOREST_DAY_RE =
  /\b(forest edge|forest\b|woods\b|trees(?: around| nearby| above)|meadow|woodland|יער|חורש|squirrel|berry bush)\b/iu;
const COZY_INTERIOR_RE =
  /\b(bedroom|bedside|crib|windowsill|indoor room|חדר|מיטה|עריסה)\b/iu;
const OUTDOOR_MAGICAL_RE =
  /\b(sky|clouds|mountain peak|above the clouds|שמיים|עננים)\b/iu;

import {
  DRAGON_DINI_COMPANION_LOCK,
  DRAGON_DINI_COMPOSITION_BY_PAGE,
  DRAGON_DINI_RECURRING_ENTITY_CATALOG,
  DRAGON_DINI_RECURRING_ENTITY_LOCKS,
  DRAGON_DINI_RECURRING_OBJECT_CATALOG,
  DRAGON_DINI_RECURRING_OBJECT_LOCKS,
} from './dragon-dini-style01-blocks';

export {
  DRAGON_DINI_RECURRING_OBJECT_CATALOG,
  DRAGON_DINI_RECURRING_OBJECT_LOCKS,
  DRAGON_DINI_RECURRING_ENTITY_CATALOG,
  DRAGON_DINI_RECURRING_ENTITY_LOCKS,
  DRAGON_DINI_COMPANION_LOCK,
  DRAGON_DINI_COMPOSITION_BY_PAGE,
} from './dragon-dini-style01-blocks';

export type Style01SubjectScale = 'small' | 'medium' | 'large';

export function subjectScaleHeightRange(scale: Style01SubjectScale): string {
  switch (scale) {
    case 'small':
      return '25-35';
    case 'medium':
      return '35-55';
    case 'large':
      return '50-60';
  }
}

export type Style01CompositionSpec = {
  shotType: string;
  camera: string;
  subjectDominance: string;
  staging: string;
  pagePurpose: string;
  /** Character height in frame — small/medium/large per Style 01 breathe rule. */
  subjectScale: Style01SubjectScale;
  /**
   * Rare world-scale breath: child may read smaller ONLY when identity is not the page beat.
   * Max ~1–2 per book. Child must still match CHILD VISUAL LOCK (not anonymous silhouette).
   */
  allowSmallChildForEstablishing?: boolean;
};

/** bear_cub_gahal (Dobi) — 10-page continuity audition composition targets. */
export const BEAR_CUB_DOBI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide forest clearing — trees and sky visible, Dobi small in lower third',
    subjectDominance: 'Forest clearing and berry bush territory dominate; Dobi small beside bush',
    staging: 'Sunny forest clearing beside mossy green rock and berry bush — environment breathes',
    pagePurpose: 'Introduce Dobi and his beloved berry bush',
  },
  2: {
    shotType: 'medium reaction',
    subjectScale: 'medium',
    camera: 'medium-wide on Dobi and empty berry bush — forest context visible',
    subjectDominance: "Dobi's frustration at bare bush; squirrel on branch; woods around",
    staging: 'Berry bush stripped bare; Dobi tensing, paws ready; clearing visible',
    pagePurpose: 'Anger rising — unfair empty bush',
  },
  3: {
    shotType: 'medium walk-away',
    subjectScale: 'medium',
    camera: 'medium-wide tracking shot — forest path depth visible',
    subjectDominance: 'Dobi clamping mouth shut with effort, cheeks puffed, shoulders hunched, taking one careful step away; path and trees share frame',
    staging: 'Forest path, tense shoulders, squirrel watching from bush',
    pagePurpose: 'Choosing safe release over lashing out',
  },
  4: {
    shotType: 'medium two-shot',
    subjectScale: 'medium',
    camera: 'medium-wide at forest edge — trees and path visible behind figures',
    subjectDominance: 'Child with broken crayon; Dobi pauses; both in lower half, environment visible',
    staging: 'Forest edge meeting — child present, emotional mirror; open woodland context',
    pagePurpose: 'Child and Dobi share the same hot anger',
  },
  5: {
    shotType: 'intimate gentle',
    subjectScale: 'medium',
    camera: 'medium shot — forest edge depth visible, not a portrait crop',
    subjectDominance: 'Gentle invitation — Dobi nudges hand; child surprised; environment breathes',
    staging: 'Soft forest edge; Dobi nudges hand; child surprised; trees and path in background',
    pagePurpose: 'Companion invites child toward safe release',
  },
  6: {
    shotType: 'wide establishing transition',
    subjectScale: 'small',
    camera: 'wide forest path opening into clearing — depth visible, archway of trees, pond clearing ahead',
    subjectDominance: 'Dobi and child small in lower third walking forward; lush ferns, mossy roots, pond clearing revealed ahead',
    staging: 'Forest path with tall ferns and mossy roots opening into pond clearing — round blue pond and large fallen log visible ahead',
    pagePurpose: 'Transition from anger to safe space — environment shift, discovery of pond',
  },
  7: {
    shotType: 'intimate medium',
    subjectScale: 'medium',
    camera: 'medium shot — Dobi at pond edge, mirror-still water with his reflection visible',
    subjectDominance: 'Dobi alone at pond edge, mouth closed after the roar, seeing his upset reflection in the still blue water; ripples beginning to break the reflection',
    staging: 'Still mirror pond, Dobi just finished roaring, mouth now closed, ripples spreading from where his roar hit the water, his rippled reflection beginning to fragment',
    pagePurpose: 'Self-confrontation through reflection — discovering safe roar',
  },
  8: {
    shotType: 'medium two-shot',
    subjectScale: 'medium',
    camera: 'medium-wide at pond edge — both characters and water visible',
    subjectDominance: 'Child and Dobi side by side at pond edge; child mid-roar toward the water (NOT toward Dobi), Dobi watching calmly',
    staging: 'Pond edge, child roaring toward the still water with soft round open mouth (vowel shape, no teeth), Dobi watching gently from beside, ripples spreading outward across pond',
    pagePurpose: 'Child learns roaring at safe space — the pond receives it',
  },
  9: {
    shotType: 'medium-wide action',
    subjectScale: 'medium',
    camera: 'medium-wide at pond — sky visible above tree canopy',
    subjectDominance: 'Child and Dobi both roaring together toward the water; two small birds startled from a tree branch overhead, one looking offended (secondary detail, not focal)',
    staging: 'Pond, both characters mid-roar toward water (not at each other, not at viewer), two small birds flying up from nearby tree branch — birds are background secondary',
    pagePurpose: 'Shared release — anger begins to move through the body',
  },
  10: {
    shotType: 'medium action',
    subjectScale: 'medium',
    camera: 'medium shot at pond edge — both characters mid-throw, water with splashes',
    subjectDominance: 'Dobi skipping a flat stone across pond; child mid-throw with a smooth grey stone; visible splashes and ripples in pond',
    staging: 'Pond edge with small smooth grey stones scattered around the bank; both characters mid-throw, two small splashes visible in pond water',
    pagePurpose: 'Physical release through stone-throwing — safe water receiving heavy feelings',
  },
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  berry_bush: ['berry bush', 'shrub', 'bush', 'branches', 'פטל', 'שיח'],
  mossy_rock: ['mossy green rock', 'mossy rock', 'green rock', 'סלע'],
  broken_crayon: ['broken crayon', 'red-orange crayon', 'snapped crayon', 'broken red crayon', 'עפרון שבור'],
  pond: ['pond', 'water', 'mirror-like water', 'blue pond', 'still pond', 'בריכה'],
  fallen_log: ['fallen log', 'fallen tree', 'log', 'tree trunk', 'גזע'],
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  berry_bush: `RECURRING OBJECT LOCK — BERRY BUSH:
The same wild forest berry bush. Distinctive visual signature: round dark-green leaves arranged in clusters of three, with bright crimson-red berries (small, round, ~1cm each) hanging in tight clusters of 5–7 berries. Bush height approximately knee-high to the child. Slightly weathered look — a real forest bush, not a manicured garden plant. Same exact bush appears in every page where present — same shape, same berry density, same lean to one side.`,
  mossy_rock: `RECURRING OBJECT LOCK — MOSSY GREEN ROCK:
The same large mossy boulder. Distinctive visual signature: rounded grey granite boulder approximately waist-high to the child, with a thick velvety moss covering the top third (vivid green moss, soft texture, slightly darker green in shaded crevices). Small patches of orange-yellow lichen on the exposed grey rock face. Same exact rock in every page where present — same silhouette, same moss coverage, same lichen pattern.`,
  broken_crayon: `RECURRING OBJECT LOCK — BROKEN CRAYON:
The same broken crayon, snapped into two uneven pieces. Color: warm red-orange (like a sun-drawing crayon, NOT blue, NOT green, NOT yellow). Both pieces visible, jagged white break edge between them. Held in the child's left hand throughout pages where present — same color, same break angle, same proportions. NEVER intact, NEVER a different color.`,
  pond: `RECURRING OBJECT LOCK — POND:
The same hidden forest pond. Distinctive visual signature: round shape, roughly 4-5 meters across (NOT a lake, NOT an ocean, NOT a river, NOT a swimming pool, NOT a puddle). Water color is deep clear blue (like a piece of sky fallen to earth), mirror-still surface when calm with reflections of the tree canopy above. Surrounded by smooth grey river stones and small mossy rocks at the edge. One large fallen log lies near the right edge of the pond. Same exact pond appears in every page where present — same size, same shape, same blue water tone, same edge details. It is small, intimate, contained — a safe container the size of a child's bedroom rug.`,
  fallen_log: `RECURRING OBJECT LOCK — FALLEN LOG:
The same large fallen tree trunk lying horizontally near the pond's right edge. Distinctive visual signature: thick old oak or pine trunk, weathered grey-brown bark with patches of vivid green moss along the top length, gentle slope (one end slightly higher than the other), broken at one end with exposed pale heartwood. Approximately as long as 4 children laid end-to-end. Same exact log appears in every page where present — same orientation, same moss coverage, same broken end.`,
};

export const BEAR_CUB_DOBI_COMPANION_LOCK = `COMPANION LOCK — DOBI (warm living bear cub):
Same living bear cub from the Dobi reference sheets. Small chubby warm honey-brown fur, round cub body, small rounded ears on top, large amber-brown eyes with white highlight, thick expressive eyebrows, shiny black wet nose, short rounded snout, warm cream chest patch, soft slightly messy head fur, oversized soft paws. Same fur tone and proportions every page.
CRITICAL — Dobi is a soft hand-drawn living bear cub character, NOT a teddy bear toy, NOT plush, NOT a stuffed animal, NOT a mascot costume, NOT overly human-like, NOT a polar bear, NOT a panda, NOT a realistic photo bear, NOT a brown grizzly. Storybook cub presence — alive, gentle, expressive.

CUB PROPORTIONS LOCK (mandatory — never violate):
- Dobi is a BEAR CUB, not an adult bear. Body length is approximately equal to the child's torso, NOT taller.
- If standing on all fours next to a 6-year-old child, Dobi's shoulder height reaches the child's WAIST at most. Never higher.
- If reared up on hind legs, Dobi's head reaches the child's CHEST. Never the child's shoulder or higher.
- Head is proportionally LARGE relative to body (cub proportions — ~30% of total body length). Eyes are large and round (juvenile facial structure).
- Legs are short and stubby relative to body. NOT the long muscular legs of an adult bear.
- Snout is short and rounded — almost button-like. NOT the long muzzle of an adult.
- Belly is round and soft. NOT the lean, muscular silhouette of an adult brown bear.
- The viewer should immediately read "young animal" — not "scaled-down adult bear."

ABSOLUTE SIZE RULE vs CHILD (mandatory on every page where both appear):
- Dobi is noticeably SMALLER than the child. Never the same height.
- On all fours: top of Dobi's head reaches BELOW the child's hip line.
- Standing upright on hind legs: top of Dobi's head reaches BELOW the child's chest line.
- If Dobi appears alone in a page (no child), Dobi still reads visually as a small cub — small body, large head, short stubby legs.
- NEVER scale Dobi up to teen-bear or adult-bear size. NEVER let Dobi tower over or match the child.

CHILD-SAFE EMOTION RULE (mandatory — never violate, even on anger/frustration pages):
- NO bared teeth visible. Mouth stays closed or slightly open in a soft pout.
- NO snarling expression. NO aggressive baring of canines or incisors.
- NO threatening posture (no raised hackles, no aggressive forward lean with claws extended).
- Anger or frustration is expressed via: furrowed brow, eyes squinted slightly, ears flattened back, shoulders hunched, head lowered, paws curled into soft fists.
- The emotion should read as "upset child" — pouting, sulky, sad-angry — never as "wild predator."
- Even on the most intense emotional pages, Dobi remains visually GENTLE and SAFE for a 4–6 year old reader.`;

export type Style01StoryLockBundle = {
  recurringObjectCatalog?: Record<string, string[]>;
  recurringObjectLocks: Record<string, string>;
  recurringEntityCatalog?: Record<string, string[]>;
  recurringEntityLocks: Record<string, string>;
  companionLock?: string;
  compositionByPage?: Record<number, Style01CompositionSpec>;
  pageEnvironmentLock?: (pageNumber: number) => string | undefined;
};

export function resolveStyle01StoryLocks(companionId?: string | null): Style01StoryLockBundle {
  if (companionId === 'dragon_dini') {
    return {
      recurringObjectCatalog: DRAGON_DINI_RECURRING_OBJECT_CATALOG,
      recurringObjectLocks: DRAGON_DINI_RECURRING_OBJECT_LOCKS,
      recurringEntityCatalog: DRAGON_DINI_RECURRING_ENTITY_CATALOG,
      recurringEntityLocks: DRAGON_DINI_RECURRING_ENTITY_LOCKS,
      companionLock: DRAGON_DINI_COMPANION_LOCK,
      compositionByPage: DRAGON_DINI_COMPOSITION_BY_PAGE,
    };
  }
  if (companionId === 'bear_cub_gahal') {
    return {
      recurringObjectCatalog: BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG,
      recurringObjectLocks: BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS,
      recurringEntityCatalog: undefined,
      recurringEntityLocks: {},
      companionLock: BEAR_CUB_DOBI_COMPANION_LOCK,
      compositionByPage: BEAR_CUB_DOBI_COMPOSITION_BY_PAGE,
    };
  }
  return {
    recurringObjectLocks: {},
    recurringEntityLocks: {},
  };
}

export function isStyle01Phase2BookPipelineEnabled(): boolean {
  return process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim().toLowerCase() === 'true';
}

export function isStyle01BookStyle(styleIdInput?: string | null): boolean {
  if (!styleIdInput) return false;
  const s = styleIdInput.trim().toLowerCase();
  return (
    s === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK ||
    s === 'soft_hand_drawn_storybook' ||
    s === 'pencil_watercolor' ||
    s === 'realistic_illustrated'
  );
}

export function shouldUseStyle01Phase2Path(styleIdInput?: string | null): boolean {
  return isStyle01Phase2BookPipelineEnabled() && isStyle01BookStyle(styleIdInput);
}

/** Audition-only quality — reads STYLE01_QA_IMAGE_QUALITY, never GPT_IMAGE_QUALITY. */
export function resolveStyle01AuditionImageQuality(): 'low' | 'medium' | 'high' {
  const q = process.env.STYLE01_QA_IMAGE_QUALITY?.trim().toLowerCase();
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  throw new Error(
    '[style01] STYLE01_QA_IMAGE_QUALITY must be low, medium, or high when STYLE_01_AUDITION_MODE=true'
  );
}

export function isStyle01AuditionModeEnabled(): boolean {
  return process.env.STYLE_01_AUDITION_MODE?.trim().toLowerCase() === 'true';
}

export function resolveStyle01RefBudgetConfig(): Style02RefBudgetConfig {
  const raw = (process.env.PHASE2_STYLE01_REF_CONFIG ?? process.env.PHASE2_STYLE02_REF_CONFIG ?? 'A')
    .trim()
    .toUpperCase();
  if (raw === 'B' || raw === 'C') return raw;
  return 'A';
}

export function resolveStyle01SceneRefSubset(sceneClass: Style01SceneClass): Style01SceneSubsetKey {
  if (sceneClass === 'fantasy-cave') return 'fantasy-cave';
  if (sceneClass === 'cozy-interior') return 'cozy-interior';
  return 'outdoor-magical';
}

export function classifyStyle01SceneClass(input: {
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
}): Style01SceneClass {
  const hay = [input.imagePrompt ?? '', input.rawScenePrompt ?? '', input.bookPageText ?? ''].join(' ');

  // Cave is the most specific scene — when cave keywords appear, cave wins
  // even if forest words also appear (e.g. plants near cave entrance).
  if (FANTASY_CAVE_RE.test(hay)) return 'fantasy-cave';

  if (FOREST_PATH_RE.test(hay)) return 'forest-path';
  if (FOREST_CLEARING_RE.test(hay)) return 'forest-clearing';
  if (FOREST_DAY_RE.test(hay)) return 'forest-day';

  if (COZY_INTERIOR_RE.test(hay)) return 'cozy-interior';
  if (OUTDOOR_MAGICAL_RE.test(hay)) return 'outdoor-nature';
  return 'fantasy-cave';
}

export function resolveStyle01StyleReferencePaths(
  sceneClass: Style01SceneClass,
  maxCount: number
): string[] {
  const subsetKey = resolveStyle01SceneRefSubset(sceneClass);
  const subset = STYLE_01_REF_SUBSETS[subsetKey];
  return subset.filenames.slice(0, maxCount).map((f) => path.join(STYLE_01_REF_DIR, f));
}

export function listStyle01SheetImages(dir: string, maxCount: number): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .slice(0, maxCount)
    .map((f) => path.join(dir, f))
    .filter((p) => existsSync(p));
}

export function resolveStyle01CompanionReferencePaths(input: {
  companionId?: string | null;
  companionImage?: string | null;
  presentEntities?: string[];
}): string[] {
  const companionId = input.companionId?.trim();
  const paths: string[] = [];

  if (companionId === 'dragon_dini' && input.presentEntities?.includes('baby_dragon')) {
    const babyDir = path.join(
      process.cwd(),
      'public',
      'companions',
      'dragon_dini',
      'style01-sheets',
      'baby-dragon'
    );
    paths.push(...listStyle01SheetImages(babyDir, 1));
  }

  if (companionId) {
    const sheetsDir = path.join(process.cwd(), 'public', 'companions', companionId, 'style01-sheets');
    const sheetPaths = listStyle01SheetImages(sheetsDir, 3);
    if (sheetPaths.length >= 3) {
      return sheetPaths.slice(0, 3);
    }
  }

  const single = resolveStyle01CompanionReferencePath(input.companionImage);
  return single ? [single] : [];
}

export function resolveStyle01CompanionReferencePath(
  companionImage?: string | null
): string | undefined {
  if (!companionImage?.trim()) return undefined;
  const trimmed = companionImage.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const publicAbs = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) return publicAbs;
  if (existsSync(trimmed)) return trimmed;
  return undefined;
}

export function buildStyle01ChildVisualLock(input: {
  companionId?: string | null;
  childName?: string | null;
  childDescription?: string;
  childStructured?: { face: string; hair: string; body: string; signature: string };
  childAge?: number | null;
  childGender?: string | null;
}): string {
  const cs = input.childStructured;
  if (cs?.face?.trim() && cs?.hair?.trim()) {
    const ageBit = input.childAge ? ` Age ${input.childAge}.` : '';
    const genderBit = input.childGender ? ` ${input.childGender}.` : '';
    let signature = (cs.signature ?? '').trim();
    if (input.companionId === 'dragon_dini' && /dinosaur|dino toy|green toy/i.test(signature)) {
      signature = 'Identity-only — no clothing or toy props in this line (see WARDROBE LOCK and scene).';
    }
    return `CHILD VISUAL LOCK (verbatim when child appears): ${cs.face}. ${cs.hair}. ${cs.body}.${ageBit}${genderBit} ${signature}`.trim();
  }
  const name = (input.childName ?? 'the child').trim();
  const desc = (input.childDescription ?? 'young child protagonist').trim();
  return `CHILD VISUAL LOCK (verbatim when child appears): ${name} — ${desc}.`.trim();
}

export function buildStyle01WardrobeLock(input?: {
  companionId?: string | null;
  childStructured?: { clothing: string };
}): string {
  const storyWardrobe = resolveStyle01StoryWardrobeLock(input?.companionId);
  if (storyWardrobe) return storyWardrobe;

  return `BOOK WARDROBE LOCK (mandatory — never drift, every page where child appears):
- Shirt: plain solid sky-blue t-shirt with a small yellow sun graphic at center chest. NO stripes. NO patterns. NO logos. NO other shapes. NEVER a striped shirt. NEVER a plain blue shirt without the sun.
- Shorts: dark denim shorts, mid-thigh length. Same wash on every page.
- Shoes: RED sneakers with white laces and white rubber soles. MANDATORY red. NEVER white sneakers. NEVER any other color.
- Wrist accessory: small green wristband on LEFT wrist, visible on every page.
- Same outfit on every page. NEVER substitute or simplify any element.`;
}

function childAgeBandLabel(age: number): string {
  if (age <= 3) return 'toddler';
  if (age <= 5) return 'preschool/kindergarten';
  if (age <= 8) return 'young school-age';
  return 'school-age';
}

function buildChildAgeLockLine(age: number): string {
  const band = childAgeBandLabel(age);
  if (age <= 3) {
    return `approximately ${age} years old (${band}). NOT a school-age child. NOT a teenager.`;
  }
  if (age <= 5) {
    return `approximately ${age} years old (${band}). Face and body must read as this age — NOT an older school-age child, NOT a teen, NOT a baby younger than ${age}.`;
  }
  if (age <= 8) {
    return `approximately ${age} years old (${band}). Face and body proportions must read as this age — NOT a teen, NOT a preschool toddler, NOT an adult shrunk down.`;
  }
  return `approximately ${age} years old (${band}). Proportions must read as this age — NOT a teen/adult, NOT a much younger child.`;
}

/** Structural child lock only — appearance comes from CHILD VISUAL LOCK (photo-derived). */
export function buildStyle01ChildAnatomicalLock(input?: {
  companionId?: string | null;
  childAge?: number;
}): string {
  const age = Math.max(2, Math.min(12, input?.childAge ?? 5));
  const base = `CHILD ANATOMICAL LOCK (structural only — NO hair color, skin tone, eye color, or face-feature descriptors here; those come ONLY from CHILD VISUAL LOCK):
- Age: ${buildChildAgeLockLine(age)}
- Body proportions: child-appropriate build for age ${age}. Head-to-body ratio appropriate for this age. NOT an adult body shrunk down.
- Expression: gentle childlike expression vocabulary; SAME child every page.
- EXACTLY ONE child protagonist when a child is present — NEVER two children, NEVER a duplicate protagonist, NEVER a second copy of the same child in background/foreground.`;

  if (input?.companionId === 'dragon_dini') {
    return `${base}

CHILD CONSISTENCY OVER WARDROBE:
Bird-print pajamas are story-constant wardrobe only. Face, hair, skin, age, and proportions must match CHILD VISUAL LOCK on every page even when pajama details are partially hidden.`;
  }

  return `${base}

CHILD CONSISTENCY OVER WARDROBE:
Wardrobe is secondary. Age, face, hair, body, and skin must match CHILD VISUAL LOCK every page even when outfit details are partially hidden.`;
}

export function buildStyle01CompanionTextLock(input: {
  companionName?: string;
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
  companionVisualDescription?: string;
  storyCompanionLock?: string;
}): string {
  if (input.storyCompanionLock?.trim()) return input.storyCompanionLock.trim();
  const cps = input.companionStructured;
  if (cps?.species?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${cps.species}, ${cps.size}. ${cps.coloring}. ${cps.feature}. Same design every page.`;
  }
  if (input.companionVisualDescription?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${input.companionVisualDescription.trim()}. Same design every page.`;
  }
  return '';
}

export function buildStyle01RecurringObjectLocks(
  objectKeys: string[],
  lockMap: Record<string, string> = DRAGON_DINI_RECURRING_OBJECT_LOCKS
): string {
  return objectKeys
    .map((key) => lockMap[key])
    .filter(Boolean)
    .join('\n\n');
}

export function buildStyle01RecurringEntityLocks(
  entityKeys: string[],
  lockMap: Record<string, string> = DRAGON_DINI_RECURRING_ENTITY_LOCKS
): string {
  return entityKeys
    .map((key) => lockMap[key])
    .filter(Boolean)
    .join('\n\n');
}

function buildChildIdentityCompositionAddendum(
  scale: Style01SubjectScale,
  allowSmallEstablishing: boolean
): string {
  if (allowSmallEstablishing) {
    return [
      'IDENTITY COMPOSITION (establishing exception — allowSmallChildForEstablishing):',
      'Child may read smaller in frame but MUST remain recognizable — same hair, face, skin, and age as CHILD VISUAL LOCK.',
      'Frontal or 3/4 face visible; NOT back-turned; NOT an anonymous tiny silhouette.',
    ].join('\n');
  }
  return [
    'IDENTITY COMPOSITION (child protagonist present):',
    'Child face clearly readable — frontal or 3/4 view, NOT back-view, NOT distant profile silhouette.',
    `Child head/face occupies roughly ${subjectScaleHeightRange(scale)}% of illustration height (match SUBJECT SCALE).`,
    'Same child as CHILD VISUAL LOCK on every page — hair, age, skin, face; do NOT shrink into a generic younger child.',
  ].join('\n');
}

export function buildStyle01CompositionBlock(input: {
  pageNumber: number;
  imageDirection?: string | null;
  compositionOverride?: Style01CompositionSpec;
  compositionByPage?: Record<number, Style01CompositionSpec>;
  /** When true, inject identity-scale composition rules (default for child-present pages). */
  childOnPage?: boolean;
}): string {
  const spec =
    input.compositionOverride ??
    input.compositionByPage?.[input.pageNumber] ??
    DRAGON_DINI_COMPOSITION_BY_PAGE[input.pageNumber] ??
    inferCompositionFromImageDirection(input.imageDirection);

  const childOnPage = input.childOnPage ?? compositionAssumesChildPresent(spec);
  let scale = spec.subjectScale ?? 'medium';
  if (childOnPage && scale === 'small' && !spec.allowSmallChildForEstablishing) {
    scale = 'medium';
  }
  const heightRange = subjectScaleHeightRange(scale);
  const allowSmall = Boolean(spec.allowSmallChildForEstablishing);

  const parts = [
    'COMPOSITION:',
    `shotType: ${spec.shotType}`,
    `camera: ${spec.camera}`,
    `subjectDominance: ${spec.subjectDominance}`,
    `staging: ${spec.staging}`,
    `pagePurpose: ${spec.pagePurpose}`,
    `SUBJECT SCALE: ${scale}. Character occupies approx ${heightRange}% of frame height. Environment fills the rest.`,
  ];
  if (childOnPage) {
    parts.push(buildChildIdentityCompositionAddendum(scale, allowSmall));
  }
  return parts.join('\n');
}

/** @internal exported for child-scale validator */
export function compositionAssumesChildPresent(spec: Style01CompositionSpec): boolean {
  const hay = `${spec.subjectDominance} ${spec.staging} ${spec.pagePurpose}`.toLowerCase();
  if (/\bno child\b|child not in|without (the )?child|solo moment|dini'?s solo|not in this frame/.test(hay)) {
    return false;
  }
  return true;
}

function inferCompositionFromImageDirection(imageDirection?: string | null): Style01CompositionSpec {
  const hay = (imageDirection ?? '').toLowerCase();
  if (/\bwide\b|establishing|above the clouds|mountain cave/.test(hay)) {
    return {
      shotType: 'wide establishing',
      subjectScale: 'small',
      camera: 'wide angle environmental shot',
      subjectDominance: 'environment-led; character embedded in scene',
      staging: 'Show full setting with breathing room',
      pagePurpose: 'Establish place and mood',
    };
  }
  if (/\bclose\b|intimate|curled|snugly/.test(hay)) {
    return {
      shotType: 'intimate airy',
      subjectScale: 'medium',
      camera: 'medium-wide on emotional focus — surroundings still visible',
      subjectDominance: 'Primary subject clear but environment shares frame',
      staging: 'Cozy moment with ceiling, walls, or depth visible — not portrait crop',
      pagePurpose: 'Emotional beat',
    };
  }
  if (/\bdiscovery\b|entrance|hovers|cautious|looking in/.test(hay)) {
    return {
      shotType: 'discovery wide',
      subjectScale: 'small',
      camera: 'threshold or entrance backlit view with depth',
      subjectDominance: 'New object draws the eye; character in mid-distance',
      staging: 'Character reacts at boundary of space; environment dominates',
      pagePurpose: 'Discovery / surprise',
    };
  }
  return {
    shotType: 'medium story beat',
    subjectScale: 'medium',
    camera: 'medium shot, eye-level or gentle angle',
    subjectDominance: 'Balanced character and environment',
    staging: 'Action embedded in setting',
    pagePurpose: 'Advance story moment',
  };
}

export function buildStyle01EntityPresenceBlock(input: {
  childPresence: string;
  companionPresence: string;
  forbiddenEntities: string[];
}): string {
  const lines = [
    'ENTITY PRESENCE CONTRACT:',
    `childPresence: ${input.childPresence}`,
    `companionPresence: ${input.companionPresence}`,
  ];
  if (input.childPresence === 'absent') {
    lines.push(
      'CRITICAL: NO human child in this illustration. Do NOT depict any boy, girl, kid, or human protagonist.',
      'Do NOT use child reference photos for this page.'
    );
  } else if (input.childPresence === 'background') {
    lines.push('Child may appear small in background only — not the focal subject.');
  } else if (input.childPresence === 'partial') {
    lines.push('Child partial visibility only (hand, silhouette, edge) — not full portrait.');
  } else {
    lines.push('Child MUST appear clearly and match CHILD VISUAL LOCK.');
  }
  if (input.companionPresence === 'present') {
    lines.push('Companion MUST appear and match COMPANION LOCK.');
  } else {
    lines.push('NO companion creature in this scene.');
  }
  if (input.forbiddenEntities.length > 0) {
    lines.push(`FORBIDDEN: ${input.forbiddenEntities.join(', ')}.`);
  }
  return lines.join('\n');
}

export function buildStyle01BookPagePrompt(input: {
  sceneDescription: string;
  childVisualLock?: string;
  wardrobeLock?: string;
  childAnatomicalLock?: string;
  companionTextLock?: string;
  recurringObjectLocks?: string;
  recurringEntityLocks?: string;
  environmentLock?: string;
  compositionBlock?: string;
  entityPresenceBlock?: string;
}): string {
  return [
    input.sceneDescription.trim(),
    input.entityPresenceBlock ?? '',
    input.compositionBlock ?? '',
    input.environmentLock ?? '',
    STYLE_01_FRAMING_RULE,
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    input.recurringObjectLocks ?? '',
    input.recurringEntityLocks ?? '',
    input.companionTextLock ?? '',
    input.childVisualLock ?? '',
    input.wardrobeLock ?? '',
    input.childAnatomicalLock ?? '',
    STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_01_REFERENCE_INSTRUCTION,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function assembleStyle01BookReferences(input: {
  styleRefPaths: string[];
  childPhotoPath?: string;
  /** @deprecated use companionRefPaths */
  companionRefPath?: string;
  companionRefPaths?: string[];
  config: Style02RefBudgetConfig;
  includeChildPhoto: boolean;
  useMultiCompanionSheets?: boolean;
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const styleAll = input.styleRefPaths;
  const breakdown: Record<string, string[]> = { style: [], child: [], companion: [] };
  const companionPaths =
    input.companionRefPaths ??
    (input.companionRefPath ? [input.companionRefPath] : []);
  const multiSheets = input.useMultiCompanionSheets && companionPaths.length >= 3;

  switch (input.config) {
    case 'A': {
      if (multiSheets) {
        breakdown.style = styleAll.slice(0, 1);
        breakdown.companion = companionPaths.slice(0, input.includeChildPhoto && input.childPhotoPath ? 2 : 3);
        if (input.includeChildPhoto && input.childPhotoPath) {
          breakdown.child = [input.childPhotoPath];
        }
      } else {
        breakdown.style = styleAll.slice(0, 2);
        if (input.includeChildPhoto && input.childPhotoPath) {
          breakdown.child = [input.childPhotoPath];
        }
        if (companionPaths[0]) breakdown.companion = [companionPaths[0]];
      }
      break;
    }
    case 'B': {
      breakdown.style = styleAll.slice(0, multiSheets ? 1 : 3);
      if (input.includeChildPhoto && input.childPhotoPath) {
        breakdown.child = [input.childPhotoPath];
      }
      if (multiSheets) {
        breakdown.companion = companionPaths.slice(0, 3);
      }
      break;
    }
    case 'C': {
      breakdown.style = styleAll.slice(0, multiSheets ? 1 : 3);
      if (multiSheets) {
        breakdown.companion = companionPaths.slice(0, 3);
      } else if (companionPaths[0]) {
        breakdown.companion = [companionPaths[0]];
      }
      break;
    }
  }

  const paths = [...breakdown.style, ...breakdown.child, ...breakdown.companion];
  return { paths, breakdown };
}

export const STYLE_01_AVOIDANCE_NEGATIVE =
  'No readable text. No photoreal child portrait. No green dragon (Dini is copper-orange). No green/teal baby dragon hatchling. No outdoor forest on Dini cave pages. No tight portrait crop or character filling frame. No Style 02 cinematic rendering. No duplicate human children.';
