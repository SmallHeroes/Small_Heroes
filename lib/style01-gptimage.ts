/**
 * Style 01 (gpt-image-1) — guarded book pipeline with lock architecture mirroring Style 02.
 * Gated by PHASE2_STYLE01_BOOK_PIPELINE=true.
 */
import { existsSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';
import type { Style02RefBudgetConfig } from './style02-gptimage';

export const STYLE_01_GPT_MODEL = 'gpt-image-1';

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
The same large smooth oval stone every time it appears. Warm amber glow from within. Pale honey-gold surface. Rounded, heavy, polished, about cushion-sized. Do not turn it into a crystal, egg, pillow, lamp, or random pile of stones.`,
  blue_speckled_egg: `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG:
The same round blue-speckled egg whenever shown. Soft pale blue shell with darker blue freckles. Sits on Dini's beloved glowing stone. Do not change to white, green, cracked open early, gem-like, or a different object.`,
};

export const DRAGON_DINI_COMPANION_LOCK = `COMPANION LOCK — DINI (copper dragon):
Young dragon named Dini. Polished copper-orange scales (NOT green). Wings the color of sunset peach and coral. Warm hugging fire — soft orange glow, never destructive flames. Expressive gentle eyes. Same species, same copper palette, same proportions on every page he appears. Do NOT turn Dini green, blue, or into a generic lizard.`;

export type Style01CompositionSpec = {
  shotType: string;
  camera: string;
  subjectDominance: string;
  staging: string;
  pagePurpose: string;
};

/** Per-page composition targets for dragon_dini 5-page audition. */
export const DRAGON_DINI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    camera: 'wide angle from inside cave looking out over clouds',
    subjectDominance: 'Dini small within vast warm cave environment',
    staging: 'Dini curled among glowing stones — environment dominates',
    pagePurpose: 'Introduce Dini\'s mountain cave above the clouds — no human child',
  },
  2: {
    shotType: 'intimate close-up',
    camera: 'close medium on Dini and the large glowing stone',
    subjectDominance: 'Dini and his beloved stone fill the emotional focus',
    staging: 'Dini curled on the exact stone, tail wrapped, warm pulse beneath',
    pagePurpose: 'Intimate comfort moment — one dragon, one stone — no human child',
  },
  3: {
    shotType: 'discovery shot',
    camera: 'cave entrance backlit, Dini at threshold looking inward',
    subjectDominance: 'Blue-speckled egg on stone draws the eye; Dini reacts',
    staging: 'Sunset light through mouth of cave; mystery object on the stone',
    pagePurpose: 'Discovery beat — something new on the stone — no human child',
  },
  4: {
    shotType: 'medium reveal',
    camera: 'medium shot inside cave',
    subjectDominance: 'Baby dragon and Dini share frame; stone still visible',
    staging: 'Hatched baby dragon on the stone; Dini surprised beside',
    pagePurpose: 'Hatching reveal — still no human child',
  },
  5: {
    shotType: 'medium emotional',
    camera: 'medium wide, both dragons and stone',
    subjectDominance: 'Baby on stone, Dini displaced to cooler edge',
    staging: 'Polite sharing tension — Dini half off the warm zone',
    pagePurpose: 'Emotional squeeze — sharing the stone — no human child',
  },
};

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

export function buildStyle01RecurringObjectLocks(objectKeys: string[]): string {
  return objectKeys
    .map((key) => DRAGON_DINI_RECURRING_OBJECT_LOCKS[key])
    .filter(Boolean)
    .join('\n\n');
}

export function buildStyle01CompositionBlock(input: {
  pageNumber: number;
  imageDirection?: string | null;
  compositionOverride?: Style01CompositionSpec;
}): string {
  const spec =
    input.compositionOverride ??
    DRAGON_DINI_COMPOSITION_BY_PAGE[input.pageNumber] ??
    inferCompositionFromImageDirection(input.imageDirection);

  return [
    'COMPOSITION:',
    `shotType: ${spec.shotType}`,
    `camera: ${spec.camera}`,
    `subjectDominance: ${spec.subjectDominance}`,
    `staging: ${spec.staging}`,
    `pagePurpose: ${spec.pagePurpose}`,
  ].join('\n');
}

function inferCompositionFromImageDirection(imageDirection?: string | null): Style01CompositionSpec {
  const hay = (imageDirection ?? '').toLowerCase();
  if (/\bwide\b|establishing|above the clouds|mountain cave/.test(hay)) {
    return {
      shotType: 'wide establishing',
      camera: 'wide angle environmental shot',
      subjectDominance: 'environment-led; character embedded in scene',
      staging: 'Show full setting with breathing room',
      pagePurpose: 'Establish place and mood',
    };
  }
  if (/\bclose\b|intimate|curled|snugly/.test(hay)) {
    return {
      shotType: 'intimate close-up',
      camera: 'close medium on emotional focus',
      subjectDominance: 'Primary subject fills emotional center',
      staging: 'Tight cozy framing on key moment',
      pagePurpose: 'Emotional beat',
    };
  }
  if (/\bdiscovery\b|entrance|hovers|cautious|looking in/.test(hay)) {
    return {
      shotType: 'discovery shot',
      camera: 'threshold or entrance backlit view',
      subjectDominance: 'New object draws the eye',
      staging: 'Character reacts at boundary of space',
      pagePurpose: 'Discovery / surprise',
    };
  }
  return {
    shotType: 'medium story beat',
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
  compositionBlock?: string;
  entityPresenceBlock?: string;
}): string {
  return [
    input.sceneDescription.trim(),
    input.entityPresenceBlock ?? '',
    input.compositionBlock ?? '',
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    input.recurringObjectLocks ?? '',
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
  'No readable text. No photoreal child portrait. No green dragon (Dini is copper-orange). No Style 02 cinematic rendering. No duplicate human children.';
