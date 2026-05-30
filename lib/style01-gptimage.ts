/**
 * Style 01 (gpt-image-1) â€” guarded book pipeline with lock architecture mirroring Style 02.
 * Gated by PHASE2_STYLE01_BOOK_PIPELINE=true.
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';
import type { Style02RefBudgetConfig } from './style02-gptimage';

export const STYLE_01_GPT_MODEL_DEFAULT = 'gpt-image-1';

/** Escalation: set STYLE_01_GPT_MODEL=gpt-image-2 to re-run same lock architecture on gpt-image-2. */
export function resolveStyle01GptModel(): string {
  const raw = process.env.STYLE_01_GPT_MODEL?.trim();
  return raw || STYLE_01_GPT_MODEL_DEFAULT;
}

/** @deprecated Use resolveStyle01GptModel() â€” kept for imports that expect a constant label. */
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
  'RENDERING: soft watercolor storybook â€” visible paper texture, gentle pigment bleeds, rounded expressive characters, warm local color, airy negative space. NOT harsh shadows. NOT global orange filter. NOT empty cream void background.';

export const STYLE_01_FRAMING_RULE = `FRAMING RULE â€” BREATHE:
- Characters fill NO MORE than 35-50% of frame height.
- Environment must occupy at least 50% of visible area.
- Avoid tight portrait crops. Avoid close-up faces unless explicitly specified as "close-up" shotType.
- For "wide" / "medium-wide" / "establishing" shots: characters should be in lower third or off-center, environment dominates.
- For "intimate" shots: still leave breathing room â€” cave ceiling, surrounding stones, depth visible. NOT a portrait crop.
- FORBIDDEN: character filling frame, tight headshot, claustrophobic framing, no environmental context.`;

export const STYLE_01_REFERENCE_INSTRUCTION =
  'Use attached STYLE reference images for VISUAL STYLE ONLY: soft watercolor technique, paper texture, gentle palette, picture-book warmth. Do NOT copy exact creatures, text, signs, compositions, or characters from references. Create the new original scene below.';

export const STYLE_01_NO_TEXT =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, or watermarks.';

export const STYLE_01_ANTI_STYLE02 =
  'NOT Style 02. NOT cinematic fantasy. NOT dense ink crosshatching. NOT dramatic spotlight noir. NOT semi-realistic portrait rendering.';

export const STYLE_01_CHILD_PHOTO_IDENTITY_RULE =
  'CHILD PHOTO (if attached): IDENTITY ONLY â€” face shape, hair, skin tone, age, gender. Render as soft hand-drawn watercolor storybook child â€” NEVER photoreal cutout. Outfit from WARDROBE LOCK and scene, never from photo.';

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
  /\b(cave|cave mouth|cave entrance|cave interior|inside cave|stalactites|stalagmites|mountain cave|mountain peak|cliff|glowing stones?|warm stone|amber glow|cavern|grotto|hollow|rocky walls|×ž×¢×¨×”|××‘× (?:×™×|×”)|×”×¨|×ž×¦×•×§|× ×˜×™×¤×™×|×–×™×‘×™×)\b/iu;
const FOREST_CLEARING_RE =
  /\b(forest clearing|sunny forest|berry bush|mossy green rock|clearing)\b/iu;
const FOREST_PATH_RE =
  /\b(forest path|deeper forest path|walking into the forest|woods path|path into the forest)\b/iu;
const FOREST_DAY_RE =
  /\b(forest edge|forest\b|woods\b|trees(?: around| nearby| above)|meadow|woodland|×™×¢×¨|×—×•×¨×©|squirrel|berry bush)\b/iu;
const COZY_INTERIOR_RE =
  /\b(bedroom|bedside|crib|windowsill|indoor room|×—×“×¨|×ž×™×˜×”|×¢×¨×™×¡×”)\b/iu;
const OUTDOOR_MAGICAL_RE =
  /\b(sky|clouds|mountain peak|above the clouds|×©×ž×™×™×|×¢× × ×™×)\b/iu;

/** Dini audition â€” recurring object detection keywords. */
export const DRAGON_DINI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  glowing_stone: [
    'glowing stone',
    'warm stone',
    'smooth stone',
    'beloved stone',
    'large stone',
    '××‘×Ÿ',
    'glow',
    'amber',
  ],
  blue_speckled_egg: [
    'blue-speckled',
    'blue speckled',
    'speckled egg',
    'round blue',
    'blue-speckled egg',
    '×‘×™×¦×”',
    '×ž× ×•×§×“',
  ],
};

export const DRAGON_DINI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  glowing_stone: `RECURRING OBJECT LOCK â€” GLOWING STONE:
Iconic story object â€” the same large smooth oval honey-gold stone every time it appears. Warm amber glow from within. Pale polished surface, rounded, heavy, cushion-sized. Identical proportions to pages 1â€“2 whenever visible. Do not turn it into a crystal, egg, pillow, lamp, random rock pile, or outdoor boulder.`,
  blue_speckled_egg: `RECURRING OBJECT LOCK â€” BLUE-SPECKLED EGG:
The same round blue-speckled egg whenever shown. Soft pale blue shell with darker blue freckles. Sits on Dini's beloved glowing stone. Do not change to white, green, cracked open early, gem-like, or a different object.`,
};

export const DRAGON_DINI_RECURRING_ENTITY_CATALOG: Record<string, string[]> = {
  baby_dragon: [
    'baby dragon',
    'baby â€” much smaller',
    'hatchling',
    'dragon cub',
    'nestles on',
    'hatched',
    'wobbly legs',
    'tiny harmless flame',
    '×“×¨×§×•×Ÿ ×ª×™× ×•×§',
  ],
};

export const DRAGON_DINI_RECURRING_ENTITY_LOCKS: Record<string, string> = {
  baby_dragon: `RECURRING ENTITY LOCK â€” BABY DRAGON:
The same tiny copper-orange dragon hatchling whenever shown. Same species and color family as Dini â€” polished copper-to-sunset scales with warm amber highlights, NOT green, NOT teal, NOT blue, NOT lizard-like. Small sunset peach-coral wings, big gentle eyes, wobbly legs, soup-bowl size. Do NOT recolor per page.
Match the baby dragon reference sheets: oversized round head, two tiny soft head bumps (NOT developed horns), small side ear-flaps, folded tiny coral wings, chubby newborn body, soft pale cream underside.
CRITICAL â€” not a miniature adult Dini: this baby has softer features, NO developed horns, NO back spikes, NO fire yet, newborn proportions. Distinct from Dini's adult form even though they share copper-orange palette.`,
};

export const DRAGON_DINI_PAGE_5_ENVIRONMENT_LOCK = `ENVIRONMENT LOCK â€” CAVE INTERIOR (mandatory):
Mountain cave interior with rocky walls and warm amber glow from glowing stones. Same large honey-gold glowing stone as previous pages. Baby dragon on the warm zone; Dini displaced at the cooler shadow edge â€” sharing warmth, not exploring outdoors.
FORBIDDEN: forest, trees, outdoor plants, grass, meadow, open field, jungle foliage, blue-sky landscape outside a cave. This scene is NOT outdoors.`;

export const DRAGON_DINI_COMPANION_LOCK = `COMPANION LOCK â€” DINI (copper dragon):
Same Dini from the Dini reference sheets. Young copper-orange dragon with rounded childlike body proportions, short rounded snout, exactly two small curved horns on top of the head, small side ear-frills behind the cheeks (same shape every page â€” do NOT swap between ear, horn, fin and spike), three or four small back spikes behind the head (consistent count and spacing), large dark eyes with one small white highlight in each eye, warm cream belly plates from chin to belly, peach/coral sunset wing membranes, soft copper-orange scales, gentle expressive face. Same head landmarks, same horn shape, same ear-frills, same eye style, same body age and proportions every page. Warm hugging fire only â€” soft orange glow, never destructive flames.
CRITICAL â€” Dini is NOT a generic dragon, NOT a long lean lizard body, NOT green, NOT blue, NOT a realistic reptile, NOT an adult/ancient dragon, NOT a different rounded mascot. Keep the same rounded friendly Dini identity from the reference sheets across every page he appears.

ANATOMY EXACT COUNT (must not drift between pages):
- Horns: EXACTLY 2 (two), both small and curved upward, on top of the head ONLY.
  No third horn. No horn anywhere except top of head.
- Side ear-frills: EXACTLY 2 (one each side), small leaf-shaped flaps behind the cheeks.
  Must NEVER be drawn as horns. Must NEVER move to the top of the head.
- Back spikes: 3 or 4 small soft bumps ONLY behind the head and on the neck.
  Must NEVER extend down the full spine to the tail. Must NEVER become a saw-spine ridge.
- Wings: 2, peach/coral membrane. Same size relative to body across all pages.
- Body proportion: rounded childlike â€” head ~30% of body height, body chubby not lean.
  Must NEVER become a long lean adult dragon body.`;

export type Style01SubjectScale = 'small' | 'medium' | 'large';

export function subjectScaleHeightRange(scale: Style01SubjectScale): string {
  switch (scale) {
    case 'small':
      return '25-35';
    case 'medium':
      return '35-50';
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
  /** Character height in frame â€” small/medium/large per Style 01 breathe rule. */
  subjectScale: Style01SubjectScale;
};

/** Per-page composition targets for dragon_dini 5-page audition. */
export const DRAGON_DINI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide angle from inside cave looking out â€” clouds and sky visible through cave mouth',
    subjectDominance:
      'Vast mountain cave environment dominates; glowing stones scattered; Dini small inside, lower-left of frame',
    staging:
      'Wide establishing â€” vast mountain cave, clouds and sky visible through cave mouth, glowing stones scattered. Dini small inside, lower-left of frame.',
    pagePurpose: 'Introduce Dini\'s mountain cave above the clouds â€” no human child',
  },
  2: {
    shotType: 'intimate airy',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave â€” stone walls and surrounding pebbles visible, not a face close-up',
    subjectDominance:
      'Dini curled on glowing stone in middle of cave; warm light atmosphere; environment shares frame',
    staging:
      'Intimate but airy â€” Dini curled on glowing stone in middle of cave, stone walls and other glowing pebbles visible around, warm light atmosphere. NOT a tight close-up on Dini\'s face.',
    pagePurpose: 'Intimate comfort moment â€” one dragon, one stone â€” no human child',
  },
  3: {
    shotType: 'discovery wide',
    subjectScale: 'small',
    camera: 'wide depth shot â€” cave entrance backlit with sunset, full cave depth visible',
    subjectDominance:
      'Blue-speckled egg on glowing stone in middle distance; Dini hovering in mid-distance',
    staging:
      'Discovery wide â€” cave entrance backlit with sunset, Dini hovering in mid-distance, blue-speckled egg on the glowing stone visible in middle distance. Frame shows the depth of the cave.',
    pagePurpose: 'Discovery beat â€” something new on the stone â€” no human child',
  },
  4: {
    shotType: 'medium-wide reveal',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave â€” interior walls and floor visible around subjects',
    subjectDominance:
      'Dini and freshly-hatched baby dragon on glowing stone; both in lower half of frame',
    staging:
      'Medium-wide reveal â€” Dini and freshly-hatched baby dragon on the glowing stone, cave interior visible around them, hatched eggshell fragments scattered. Both dragons in lower half of frame.',
    pagePurpose: 'Hatching reveal â€” still no human child',
  },
  5: {
    shotType: 'medium emotional wide',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave â€” rocky walls, depth and atmosphere visible, no outdoor foliage',
    subjectDominance:
      'Copper baby on warm zone of stone; Dini at cooler edge; cave interior depth visible',
    staging:
      'Emotional wider â€” Dini at cooler edge, copper baby on warm zone of the stone. Cave interior with depth and atmosphere visible. INTERIOR ONLY â€” no outdoor staging.',
    pagePurpose: 'Sharing warmth inside the cave â€” emotional squeeze, not outdoor exploration',
  },
};

/** bear_cub_gahal (Dobi) â€” 5-page audition composition targets. */
export const BEAR_CUB_DOBI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide forest clearing â€” trees and sky visible, Dobi small in lower third',
    subjectDominance: 'Forest clearing and berry bush territory dominate; Dobi small beside bush',
    staging: 'Sunny forest clearing beside mossy green rock and berry bush â€” environment breathes',
    pagePurpose: 'Introduce Dobi and his beloved berry bush',
  },
  2: {
    shotType: 'medium reaction',
    subjectScale: 'medium',
    camera: 'medium-wide on Dobi and empty berry bush â€” forest context visible',
    subjectDominance: "Dobi's frustration at bare bush; squirrel on branch; woods around",
    staging: 'Berry bush stripped bare; Dobi tensing, paws ready; clearing visible',
    pagePurpose: 'Anger rising â€” unfair empty bush',
  },
  3: {
    shotType: 'medium walk-away',
    subjectScale: 'medium',
    camera: 'medium-wide tracking shot â€” forest path depth visible',
    subjectDominance: 'Dobi holding back a roar, walking away; path and trees share frame',
    staging: 'Forest path, tense shoulders, squirrel watching from bush',
    pagePurpose: 'Choosing safe release over lashing out',
  },
  4: {
    shotType: 'medium two-shot',
    subjectScale: 'medium',
    camera: 'medium-wide at forest edge â€” trees and path visible behind figures',
    subjectDominance: 'Child with broken crayon; Dobi pauses; both in lower half, environment visible',
    staging: 'Forest edge meeting â€” child present, emotional mirror; open woodland context',
    pagePurpose: 'Child and Dobi share the same hot anger',
  },
  5: {
    shotType: 'intimate gentle',
    subjectScale: 'medium',
    camera: 'medium shot â€” forest edge depth visible, not a portrait crop',
    subjectDominance: 'Gentle invitation â€” Dobi nudges hand; child surprised; environment breathes',
    staging: 'Soft forest edge; Dobi nudges hand; child surprised; trees and path in background',
    pagePurpose: 'Companion invites child toward safe release',
  },
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  berry_bush: ['berry bush', 'shrub', 'bush', 'branches', '×¤×˜×œ', '×©×™×—'],
  mossy_rock: ['mossy green rock', 'mossy rock', 'green rock', '×¡×œ×¢'],
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  berry_bush: `RECURRING OBJECT LOCK â€” BERRY BUSH:
The same wild forest berry bush. Distinctive visual signature: round dark-green leaves arranged in clusters of three, with bright crimson-red berries (small, round, ~1cm each) hanging in tight clusters of 5â€“7 berries. Bush height approximately knee-high to the child. Slightly weathered look â€” a real forest bush, not a manicured garden plant. Same exact bush appears in every page where present â€” same shape, same berry density, same lean to one side.`,
  mossy_rock: `RECURRING OBJECT LOCK â€” MOSSY GREEN ROCK:
The same large mossy boulder. Distinctive visual signature: rounded grey granite boulder approximately waist-high to the child, with a thick velvety moss covering the top third (vivid green moss, soft texture, slightly darker green in shaded crevices). Small patches of orange-yellow lichen on the exposed grey rock face. Same exact rock in every page where present â€” same silhouette, same moss coverage, same lichen pattern.`,
};

export const BEAR_CUB_DOBI_COMPANION_LOCK = `COMPANION LOCK â€” DOBI (warm living bear cub):
Same living bear cub from the Dobi reference sheets. Small chubby warm honey-brown fur, round cub body, small rounded ears on top, large amber-brown eyes with white highlight, thick expressive eyebrows, shiny black wet nose, short rounded snout, warm cream chest patch, soft slightly messy head fur, oversized soft paws. Same fur tone and proportions every page.
CRITICAL â€” Dobi is a soft hand-drawn living bear cub character, NOT a teddy bear toy, NOT plush, NOT a stuffed animal, NOT a mascot costume, NOT overly human-like, NOT a polar bear, NOT a panda, NOT a realistic photo bear, NOT a brown grizzly. Storybook cub presence â€” alive, gentle, expressive.

CUB PROPORTIONS LOCK (mandatory â€” never violate):
- Dobi is a BEAR CUB, not an adult bear. Body length is approximately equal to the child's torso, NOT taller.
- If standing on all fours next to a 6-year-old child, Dobi's shoulder height reaches the child's WAIST at most. Never higher.
- If reared up on hind legs, Dobi's head reaches the child's CHEST. Never the child's shoulder or higher.
- Head is proportionally LARGE relative to body (cub proportions â€” ~30% of total body length). Eyes are large and round (juvenile facial structure).
- Legs are short and stubby relative to body. NOT the long muscular legs of an adult bear.
- Snout is short and rounded â€” almost button-like. NOT the long muzzle of an adult.
- Belly is round and soft. NOT the lean, muscular silhouette of an adult brown bear.
- The viewer should immediately read "young animal" â€” not "scaled-down adult bear."

CHILD-SAFE EMOTION RULE (mandatory â€” never violate, even on anger/frustration pages):
- NO bared teeth visible. Mouth stays closed or slightly open in a soft pout.
- NO snarling expression. NO aggressive baring of canines or incisors.
- NO threatening posture (no raised hackles, no aggressive forward lean with claws extended).
- Anger or frustration is expressed via: furrowed brow, eyes squinted slightly, ears flattened back, shoulders hunched, head lowered, paws curled into soft fists.
- The emotion should read as "upset child" â€” pouting, sulky, sad-angry â€” never as "wild predator."
- Even on the most intense emotional pages, Dobi remains visually GENTLE and SAFE for a 4â€“6 year old reader.`;

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
      pageEnvironmentLock: (pageNumber) =>
        pageNumber === 5 ? DRAGON_DINI_PAGE_5_ENVIRONMENT_LOCK : undefined,
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

  // Cave is the most specific scene â€” when cave keywords appear, cave wins
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
    return `CHILD VISUAL LOCK (verbatim when child appears): ${cs.face}. ${cs.hair}. ${cs.body}.${ageBit}${genderBit} ${cs.signature ?? ''}`.trim();
  }
  const name = (input.childName ?? 'the child').trim();
  const desc = (input.childDescription ?? 'young child protagonist').trim();
  return `CHILD VISUAL LOCK (verbatim when child appears): ${name} â€” ${desc}.`.trim();
}

export function buildStyle01WardrobeLock(input: {
  childStructured?: { clothing: string };
}): string {
  const clothing = input.childStructured?.clothing?.trim();
  if (clothing) {
    return `BOOK WARDROBE LOCK (same outfit whenever child appears): ${clothing}`;
  }
  return 'BOOK WARDROBE LOCK (same outfit whenever child appears): comfortable storybook clothes â€” consistent colors across pages.';
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
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} â€” ${cps.species}, ${cps.size}. ${cps.coloring}. ${cps.feature}. Same design every page.`;
  }
  if (input.companionVisualDescription?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} â€” ${input.companionVisualDescription.trim()}. Same design every page.`;
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

export function buildStyle01CompositionBlock(input: {
  pageNumber: number;
  imageDirection?: string | null;
  compositionOverride?: Style01CompositionSpec;
  compositionByPage?: Record<number, Style01CompositionSpec>;
}): string {
  const spec =
    input.compositionOverride ??
    input.compositionByPage?.[input.pageNumber] ??
    DRAGON_DINI_COMPOSITION_BY_PAGE[input.pageNumber] ??
    inferCompositionFromImageDirection(input.imageDirection);

  const scale = spec.subjectScale ?? 'medium';
  const heightRange = subjectScaleHeightRange(scale);

  return [
    'COMPOSITION:',
    `shotType: ${spec.shotType}`,
    `camera: ${spec.camera}`,
    `subjectDominance: ${spec.subjectDominance}`,
    `staging: ${spec.staging}`,
    `pagePurpose: ${spec.pagePurpose}`,
    `SUBJECT SCALE: ${scale}. Character occupies approx ${heightRange}% of frame height. Environment fills the rest.`,
  ].join('\n');
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
      camera: 'medium-wide on emotional focus â€” surroundings still visible',
      subjectDominance: 'Primary subject clear but environment shares frame',
      staging: 'Cozy moment with ceiling, walls, or depth visible â€” not portrait crop',
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
    lines.push('Child may appear small in background only â€” not the focal subject.');
  } else if (input.childPresence === 'partial') {
    lines.push('Child partial visibility only (hand, silhouette, edge) â€” not full portrait.');
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
