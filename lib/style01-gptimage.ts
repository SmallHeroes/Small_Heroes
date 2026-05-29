/**
 * Style 01 (gpt-image-1) — guarded book pipeline with lock architecture mirroring Style 02.
 * Gated by PHASE2_STYLE01_BOOK_PIPELINE=true.
 */
import { existsSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';
import type { Style02RefBudgetConfig } from './style02-gptimage';

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
  | 'cozy-interior'
  | 'outdoor-magical';

export type Style01SceneSubsetKey = Style01SceneClass;

export const STYLE_01_SHARED =
  "Style 01: soft hand-drawn children's storybook illustration on warm cream paper. Gentle transparent watercolor washes, delicate linework, luminous muted palette, cozy picture-book warmth. NOT cinematic Style 02. NOT dense ink-and-gouache. NOT photorealistic. NOT Pixar CGI.";

export const STYLE_01_RENDERING_CORRECTION =
  'RENDERING: soft watercolor storybook — visible paper texture, gentle pigment bleeds, rounded expressive characters, warm local color, airy negative space. NOT harsh shadows. NOT global orange filter. NOT empty cream void background.';

export const STYLE_01_FRAMING_RULE = `FRAMING RULE — BREATHE:
- Characters fill NO MORE than 35-50% of frame height.
- Environment must occupy at least 50% of visible area.
- Avoid tight portrait crops. Avoid close-up faces unless explicitly specified as "close-up" shotType.
- For "wide" / "medium-wide" / "establishing" shots: characters should be in lower third or off-center, environment dominates.
- For "intimate" shots: still leave breathing room — cave ceiling, surrounding stones, depth visible. NOT a portrait crop.
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
  /\b(cave|cave mouth|glowing stones?|warm stone|mountain cave|clouds above|amber glow|מערה|אבנ(?:ים|ה))\b/iu;
const COZY_INTERIOR_RE =
  /\b(bedroom|bed\b|bedside|crib|windowsill|room|indoor|חדר|מיטה|עריסה)\b/iu;
const OUTDOOR_MAGICAL_RE =
  /\b(forest|sky|clouds|mountain peak|outdoor|meadow|above the clouds|שמיים|עננים)\b/iu;

/** Dini audition — recurring object detection keywords. */
export const DRAGON_DINI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  glowing_stone: [
    'glowing stone',
    'warm stone',
    'smooth stone',
    'beloved stone',
    'large stone',
    'אבן',
    'glow',
    'amber',
  ],
  blue_speckled_egg: [
    'blue-speckled',
    'blue speckled',
    'speckled egg',
    'round blue',
    'egg',
    'ביצה',
    'מנוקד',
  ],
};

export const DRAGON_DINI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  glowing_stone: `RECURRING OBJECT LOCK — GLOWING STONE:
Iconic story object — the same large smooth oval honey-gold stone every time it appears. Warm amber glow from within. Pale polished surface, rounded, heavy, cushion-sized. Identical proportions to pages 1–2 whenever visible. Do not turn it into a crystal, egg, pillow, lamp, random rock pile, or outdoor boulder.`,
  blue_speckled_egg: `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG:
The same round blue-speckled egg whenever shown. Soft pale blue shell with darker blue freckles. Sits on Dini's beloved glowing stone. Do not change to white, green, cracked open early, gem-like, or a different object.`,
};

export const DRAGON_DINI_RECURRING_ENTITY_CATALOG: Record<string, string[]> = {
  baby_dragon: [
    'baby dragon',
    'baby — much smaller',
    'hatchling',
    'dragon cub',
    'nestles on',
    'hatched',
    'wobbly legs',
    'tiny harmless flame',
    'דרקון תינוק',
  ],
};

export const DRAGON_DINI_RECURRING_ENTITY_LOCKS: Record<string, string> = {
  baby_dragon: `RECURRING ENTITY LOCK — BABY DRAGON:
The same tiny copper-orange dragon hatchling whenever shown. Same species and color family as Dini — polished copper-to-sunset scales with warm amber highlights, NOT green, NOT teal, NOT blue, NOT lizard-like. Small sunset peach-coral wings, big gentle eyes, wobbly legs, soup-bowl size. Do NOT recolor per page.`,
};

export const DRAGON_DINI_PAGE_5_ENVIRONMENT_LOCK = `ENVIRONMENT LOCK — CAVE INTERIOR (mandatory):
Mountain cave interior with rocky walls and warm amber glow from glowing stones. Same large honey-gold glowing stone as previous pages. Baby dragon on the warm zone; Dini displaced at the cooler shadow edge — sharing warmth, not exploring outdoors.
FORBIDDEN: forest, trees, outdoor plants, grass, meadow, open field, jungle foliage, blue-sky landscape outside a cave. This scene is NOT outdoors.`;

export const DRAGON_DINI_COMPANION_LOCK = `COMPANION LOCK — DINI (copper dragon):
Young dragon named Dini. Polished copper-orange scales (NOT green). Wings the color of sunset peach and coral. Warm hugging fire — soft orange glow, never destructive flames. Expressive gentle eyes. Same species, same copper palette, same proportions on every page he appears. Do NOT turn Dini green, blue, or into a generic lizard.`;

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
  /** Character height in frame — small/medium/large per Style 01 breathe rule. */
  subjectScale: Style01SubjectScale;
};

/** Per-page composition targets for dragon_dini 5-page audition. */
export const DRAGON_DINI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide angle from inside cave looking out — clouds and sky visible through cave mouth',
    subjectDominance:
      'Vast mountain cave environment dominates; glowing stones scattered; Dini small inside, lower-left of frame',
    staging:
      'Wide establishing — vast mountain cave, clouds and sky visible through cave mouth, glowing stones scattered. Dini small inside, lower-left of frame.',
    pagePurpose: 'Introduce Dini\'s mountain cave above the clouds — no human child',
  },
  2: {
    shotType: 'intimate airy',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — stone walls and surrounding pebbles visible, not a face close-up',
    subjectDominance:
      'Dini curled on glowing stone in middle of cave; warm light atmosphere; environment shares frame',
    staging:
      'Intimate but airy — Dini curled on glowing stone in middle of cave, stone walls and other glowing pebbles visible around, warm light atmosphere. NOT a tight close-up on Dini\'s face.',
    pagePurpose: 'Intimate comfort moment — one dragon, one stone — no human child',
  },
  3: {
    shotType: 'discovery wide',
    subjectScale: 'small',
    camera: 'wide depth shot — cave entrance backlit with sunset, full cave depth visible',
    subjectDominance:
      'Blue-speckled egg on glowing stone in middle distance; Dini hovering in mid-distance',
    staging:
      'Discovery wide — cave entrance backlit with sunset, Dini hovering in mid-distance, blue-speckled egg on the glowing stone visible in middle distance. Frame shows the depth of the cave.',
    pagePurpose: 'Discovery beat — something new on the stone — no human child',
  },
  4: {
    shotType: 'medium-wide reveal',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — interior walls and floor visible around subjects',
    subjectDominance:
      'Dini and freshly-hatched baby dragon on glowing stone; both in lower half of frame',
    staging:
      'Medium-wide reveal — Dini and freshly-hatched baby dragon on the glowing stone, cave interior visible around them, hatched eggshell fragments scattered. Both dragons in lower half of frame.',
    pagePurpose: 'Hatching reveal — still no human child',
  },
  5: {
    shotType: 'medium emotional wide',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — rocky walls, depth and atmosphere visible, no outdoor foliage',
    subjectDominance:
      'Copper baby on warm zone of stone; Dini at cooler edge; cave interior depth visible',
    staging:
      'Emotional wider — Dini at cooler edge, copper baby on warm zone of the stone. Cave interior with depth and atmosphere visible. INTERIOR ONLY — no outdoor staging.',
    pagePurpose: 'Sharing warmth inside the cave — emotional squeeze, not outdoor exploration',
  },
};

/** bear_cub_gahal (Dobi) — 5-page audition composition targets. */
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
    subjectDominance: 'Dobi holding back a roar, walking away; path and trees share frame',
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
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  berry_bush: ['berry bush', 'shrub', 'bush', 'branches', 'פטל', 'שיח'],
  mossy_rock: ['mossy green rock', 'mossy rock', 'green rock', 'סלע'],
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  berry_bush: `RECURRING OBJECT LOCK — BERRY BUSH:
The same small raspberry/berry bush every time. Low leafy shrub with thin branches near a mossy rock. Do not turn it into a tree, flower pot, or random hedge.`,
  mossy_rock: `RECURRING OBJECT LOCK — MOSSY GREEN ROCK:
The same rounded moss-covered green rock beside the berry bush. Soft moss, forest-floor scale. Do not turn it into a boulder cliff or indoor prop.`,
};

export const BEAR_CUB_DOBI_COMPANION_LOCK = `COMPANION LOCK — DOBI (warm bear cub):
Small chubby warm-brown bear cub named Dobi. Honey-dark amber eyes, big soft expressive eyebrows, oversized paws, faint warm chest glow. Same fur tone and proportions every page. Do NOT turn Dobi into a polar bear, panda, or realistic photo bear.`;

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

export function classifyStyle01SceneClass(input: {
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
}): Style01SceneClass {
  const hay = [input.imagePrompt ?? '', input.rawScenePrompt ?? '', input.bookPageText ?? ''].join(' ');
  if (FANTASY_CAVE_RE.test(hay)) return 'fantasy-cave';
  if (COZY_INTERIOR_RE.test(hay)) return 'cozy-interior';
  if (OUTDOOR_MAGICAL_RE.test(hay)) return 'outdoor-magical';
  return 'fantasy-cave';
}

export function resolveStyle01StyleReferencePaths(
  subsetKey: Style01SceneSubsetKey,
  maxCount: number
): string[] {
  const subset = STYLE_01_REF_SUBSETS[subsetKey];
  return subset.filenames.slice(0, maxCount).map((f) => path.join(STYLE_01_REF_DIR, f));
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
  return `CHILD VISUAL LOCK (verbatim when child appears): ${name} — ${desc}.`.trim();
}

export function buildStyle01WardrobeLock(input: {
  childStructured?: { clothing: string };
}): string {
  const clothing = input.childStructured?.clothing?.trim();
  if (clothing) {
    return `BOOK WARDROBE LOCK (same outfit whenever child appears): ${clothing}`;
  }
  return 'BOOK WARDROBE LOCK (same outfit whenever child appears): comfortable storybook clothes — consistent colors across pages.';
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
  companionRefPath?: string;
  config: Style02RefBudgetConfig;
  includeChildPhoto: boolean;
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const styleAll = input.styleRefPaths;
  const breakdown: Record<string, string[]> = { style: [], child: [], companion: [] };

  switch (input.config) {
    case 'A': {
      breakdown.style = styleAll.slice(0, 2);
      if (input.includeChildPhoto && input.childPhotoPath) {
        breakdown.child = [input.childPhotoPath];
      }
      if (input.companionRefPath) breakdown.companion = [input.companionRefPath];
      break;
    }
    case 'B': {
      breakdown.style = styleAll.slice(0, 3);
      if (input.includeChildPhoto && input.childPhotoPath) {
        breakdown.child = [input.childPhotoPath];
      }
      break;
    }
    case 'C': {
      breakdown.style = styleAll.slice(0, 3);
      if (input.companionRefPath) breakdown.companion = [input.companionRefPath];
      break;
    }
  }

  const paths = [...breakdown.style, ...breakdown.child, ...breakdown.companion];
  return { paths, breakdown };
}

export const STYLE_01_AVOIDANCE_NEGATIVE =
  'No readable text. No photoreal child portrait. No green dragon (Dini is copper-orange). No green/teal baby dragon hatchling. No outdoor forest on Dini cave pages. No tight portrait crop or character filling frame. No Style 02 cinematic rendering. No duplicate human children.';
