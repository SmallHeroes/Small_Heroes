/**
 * guarded-v2 — scene-aware wardrobe, illustration anchor, per-page framing.
 * Profile: PHASE2_STEP5_PROFILE=guarded-v2
 */

import type { PageCard } from '@/lib/story-generator/recipes/recipe-types';
import {
  GUARDED_V1_CHILD_LOCK,
  GUARDED_V1_CLOSE_UP_RULE,
  GUARDED_V1_COMPANION_LOCK,
  STYLE_02_ANTI_SOFTNESS,
  STYLE_02_CHARACTER_GUARD,
  STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
  STYLE_02_NO_TEXT,
  STYLE_02_REFERENCE_INSTRUCTION,
  STYLE_02_RENDERING_CORRECTION,
  STYLE_02_SHARED,
  type Style02SceneClass,
} from './style02-gptimage';

export type SceneState = 'daytime' | 'transitional' | 'in-bed' | 'sleeping';

export type FramingType =
  | 'wide-establishing'
  | 'medium-environment'
  | 'medium-action'
  | 'close-emotional'
  | 'object-close-up'
  | 'hand-detail'
  | 'over-the-shoulder'
  | 'top-down'
  | 'low-angle'
  | 'intimate-low-light';

export type WardrobeBlockKey = SceneState;

export type GuardedV2PageSpec = {
  pageNumber: number;
  sceneState?: SceneState;
  framingType?: FramingType;
  focalObject?: string;
  gestureFocus?: string;
  bookPageText?: string | null;
  imageIntent?: string | null;
  sceneClass?: Style02SceneClass;
  pageCompositionTarget?: string | null;
};

export type GuardedV2PageDebug = {
  sceneState: SceneState;
  sceneStateSource: 'explicit' | 'inferred';
  framingType: FramingType;
  framingTypeSource: 'explicit' | 'inferred';
  wardrobeBlockUsed: WardrobeBlockKey;
  illustrationAnchorUsed: true;
  closeUpRuleApplied: boolean;
  handDetailRuleApplied: boolean;
  framingBlockUsed: FramingType;
  focalObject?: string;
  gestureFocus?: string;
};

const PAJAMA_PALETTE_DEFAULT = 'soft blue';

export const STYLE02_ILLUSTRATION_ANCHOR = `ILLUSTRATION ANCHOR — every page:
Faces should look like premium painted storybook characters, not retouched photos. This is hand-painted children's-book illustration in the Style 02 language. NOT photography. NOT live-action portrait. NOT plastic CGI.

The child is illustrated and expressive — visible painterly brushwork on the face, simplified illustrative skin, storybook linework, hand-painted texture. Premium painted storybook quality.

Do NOT render photographic skin pores. Do NOT render photographic eye highlights. Do NOT render hyper-detailed live-action portrait rendering.
BUT keep dimensional painted depth, material richness, and cinematic lighting — this is NOT soft watercolor / Style 01 nursery, it is rich painted storybook art with clear illustrative simplification.`;

export const HAND_DETAIL_RULE = `HAND DETAIL RULE: The hand is painted and illustrative, not photographic. No realistic skin pores on the hand. No live-action hand rendering. No photographic specular highlights on knuckles or nails. Keep soft painterly storybook texture on skin folds and fingertips. The hand reads as drawn / painted, not photographed.`;

const WARDROBE_BLOCKS: Record<SceneState, string> = {
  daytime: `WARDROBE — DAYTIME:
brown peaked cap, navy long-sleeve shirt, olive trousers, brown shoes,
small brown crossbody satchel. Full outfit worn.

CAP RULES: cap must NOT hide face, eyes, or hair silhouette. Curls visible. Brim does not shadow eyes.`,

  transitional: `WARDROBE — EVENING / TRANSITIONAL:
navy long-sleeve shirt, olive trousers, brown shoes. The brown peaked cap MAY be worn OR placed nearby (on chair, bedside, or bed) — whichever fits the scene naturally. The crossbody satchel MAY be worn OR placed nearby — naturalness wins.

Child is awake but winding down for the evening. Do not force cap on if scene reads more naturally with it off. Do not force satchel into every frame.

IDENTITY ANCHORS that survive: same face, same curly hair (visible whether cap is on or off), same skin tone, same illustrated style.`,

  'in-bed': `WARDROBE — IN BED:
${PAJAMA_PALETTE_DEFAULT} pajama top with matching pajama bottoms. This is a default sleepwear palette for this test cycle — NOT a permanent identity rule for all children.

NO cap on the head. NO crossbody satchel worn. Cap may be visible on nearby chair / bedside / pillow if composition allows — naturalness wins, do not force it. Same for satchel: visible on floor/nightstand only if naturally placed.

Bare feet OR soft slippers acceptable.

IDENTITY ANCHORS that survive cap removal: same face, same curly hair fully visible without cap, same skin tone, same illustrated children's-book style. The face and hair MUST carry the identity now — the cap is no longer doing that work.`,

  sleeping: `WARDROBE — SLEEPING:
same default pajamas as in-bed scenes (${PAJAMA_PALETTE_DEFAULT} pajama palette). NO cap, NO satchel on body. Cap visible on chair/bedside only if natural. Eyes closed. Body relaxed. Head on pillow. Partially or fully under blanket.

IDENTITY: face and hair must remain consistent and recognizable even with eyes closed.`,
};

const FRAMING_BLOCKS: Record<FramingType, (ctx: { focalObject?: string; gestureFocus?: string }) => string> = {
  'wide-establishing': () =>
    'FRAMING: wide establishing shot. Show full setting. Character may be smaller. Emphasize place, depth, world of the scene.',
  'medium-environment': () =>
    'FRAMING: medium shot with environment context. Character clearly readable; environment provides depth.',
  'medium-action': () => 'FRAMING: medium shot focused on action / movement. Capture motion.',
  'close-emotional': () =>
    'FRAMING: close emotional. Face fills 50–70% of frame. CLOSE_UP_RULE applies.',
  'object-close-up': ({ focalObject }) =>
    `FRAMING: object close-up. Focal subject: ${focalObject ?? '[object unspecified]'}. Camera close to the object. Child may be partial / out of frame — face is NOT the focal point. Painterly rendering on the object.`,
  'hand-detail': ({ gestureFocus }) =>
    `FRAMING: hand detail. Focal gesture: ${gestureFocus ?? '[gesture unspecified]'}. Tight crop on hand and immediate surroundings. HAND_DETAIL_RULE applies — painterly hand, not photographic.`,
  'over-the-shoulder': () =>
    'FRAMING: over-the-shoulder. Camera behind the child, showing what they see / the path ahead.',
  'top-down': () =>
    'FRAMING: top-down. Overhead camera looking straight down or near-down on the scene.',
  'low-angle': () =>
    'FRAMING: low-angle. Camera near floor level looking up. Emphasizes scale or wonder.',
  'intimate-low-light': () =>
    'FRAMING: intimate low-light. Soft warm lamplight or moonlight. Close framing, atmospheric, calm.',
};

const SLEEPING_RE = /(asleep|sleeping|ישן|ישנה|נרדם|נרדמה|נרדמת)/iu;
const IN_BED_RE = /\b(bed|מיטה|כרית|שמיכה|blanket|pillow|under the blanket|במיטה)\b/iu;
const LYING_RE = /\b(lying|שוכב|שוכבת|head on pillow|ראש על)\b/iu;
const EVENING_RE =
  /\b(evening|bedtime|night|לילה|ערב|לפני השינה|night light|אור לילה|pre-sleep)\b/iu;
const OBJECT_FOCAL_RE =
  /\b(thermometer|מדחום|shell plate|פס שריון|Bolly curled|כדור|object close|focal object)\b/iu;

function haystack(spec: GuardedV2PageSpec): string {
  return [spec.bookPageText, spec.imageIntent, spec.pageCompositionTarget]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function inferSceneState(spec: GuardedV2PageSpec): {
  value: SceneState;
  source: 'explicit' | 'inferred';
} {
  if (spec.sceneState) return { value: spec.sceneState, source: 'explicit' };

  const text = haystack(spec);
  if (SLEEPING_RE.test(text)) return { value: 'sleeping', source: 'inferred' };
  if (
    spec.sceneClass === 'night-bedroom' &&
    IN_BED_RE.test(text) &&
    (LYING_RE.test(text) || /\b(eyes closed|עיניים עצומות)\b/iu.test(text) === false)
  ) {
    if (SLEEPING_RE.test(text)) return { value: 'sleeping', source: 'inferred' };
    return { value: 'in-bed', source: 'inferred' };
  }
  if (spec.sceneClass === 'night-bedroom' || EVENING_RE.test(text)) {
    return { value: 'transitional', source: 'inferred' };
  }
  return { value: 'daytime', source: 'inferred' };
}

export function inferFramingType(
  spec: GuardedV2PageSpec,
  sceneState: SceneState
): { value: FramingType; source: 'explicit' | 'inferred'; warn?: string } {
  if (spec.framingType) return { value: spec.framingType, source: 'explicit' };

  const text = haystack(spec).toLowerCase();
  if (SLEEPING_RE.test(haystack(spec)) && spec.sceneClass === 'night-bedroom') {
    return { value: 'intimate-low-light', source: 'inferred' };
  }
  if (OBJECT_FOCAL_RE.test(haystack(spec))) {
    if (!spec.focalObject) {
      return {
        value: 'object-close-up',
        source: 'inferred',
        warn: `page ${spec.pageNumber}: object-close-up inferred but focalObject missing`,
      };
    }
    return { value: 'object-close-up', source: 'inferred' };
  }
  if (/\bhand\b|יד\b|fist|אגרוף|fingers|אצבע/iu.test(haystack(spec))) {
    if (!spec.gestureFocus) {
      return {
        value: 'hand-detail',
        source: 'inferred',
        warn: `page ${spec.pageNumber}: hand-detail inferred but gestureFocus missing`,
      };
    }
    return { value: 'hand-detail', source: 'inferred' };
  }
  if (/\bclose[- ]?up\b|close emotional|intimate|face fills/iu.test(text)) {
    return { value: 'close-emotional', source: 'inferred' };
  }
  if (sceneState === 'sleeping') return { value: 'intimate-low-light', source: 'inferred' };
  if (spec.pageNumber % 3 === 2) return { value: 'close-emotional', source: 'inferred' };
  return { value: 'medium-environment', source: 'inferred' };
}

import { bollyBedtimeAge5Recipe } from '@/lib/story-generator/recipes/bolly_bedtime_age_5';

/** Merge explicit Bolly bedtime recipe cards when this book uses that recipe. */
export function resolveGuardedV2SpecForPage(
  pageNumber: number,
  context: {
    bookPageText?: string | null;
    sceneClass?: Style02SceneClass;
    imageIntent?: string | null;
    companionId?: string | null;
    recipeId?: string | null;
  }
): GuardedV2PageSpec {
  const useBollyCards =
    context.recipeId === 'bolly_bedtime_age_5' || context.companionId === 'bolly_armadillo';
  const card = useBollyCards
    ? bollyBedtimeAge5Recipe.pageCards.find((c) => c.page === pageNumber)
    : undefined;
  return pageCardToGuardedV2Spec(pageNumber, card ?? {}, {
    bookPageText: context.bookPageText,
    sceneClass: context.sceneClass,
  });
}

export function pageCardToGuardedV2Spec(
  pageNumber: number,
  card: Partial<PageCard>,
  context?: { bookPageText?: string | null; sceneClass?: Style02SceneClass }
): GuardedV2PageSpec {
  return {
    pageNumber,
    sceneState: card.sceneState,
    framingType: card.framingType,
    focalObject: card.focalObject,
    gestureFocus: card.gestureFocus,
    bookPageText: context?.bookPageText ?? null,
    imageIntent: card.imageIntent ?? null,
    sceneClass: context?.sceneClass,
    pageCompositionTarget: card.imageIntent ?? null,
  };
}

export function assembleGuardedV2PagePrompt(input: {
  sceneDescription: string;
  spec: GuardedV2PageSpec;
  bedtimeMedicalTone?: boolean;
  bedtimeMedicalToneBlock?: string;
  strictFramingWarnings?: boolean;
}): { prompt: string; debug: GuardedV2PageDebug; warnings: string[] } {
  const warnings: string[] = [];
  const sceneStateResult = inferSceneState(input.spec);
  const framingResult = inferFramingType(input.spec, sceneStateResult.value);
  if (framingResult.warn) {
    warnings.push(framingResult.warn);
    if (input.strictFramingWarnings) {
      throw new Error(framingResult.warn);
    }
  }

  const framingType = framingResult.value;
  const focalObject =
    framingType === 'object-close-up'
      ? input.spec.focalObject ?? input.spec.imageIntent ?? undefined
      : undefined;
  const gestureFocus =
    framingType === 'hand-detail' ? input.spec.gestureFocus ?? undefined : undefined;

  if (framingType === 'object-close-up' && !focalObject) {
    const msg = `page ${input.spec.pageNumber}: object-close-up requires focalObject`;
    warnings.push(msg);
    if (input.strictFramingWarnings) throw new Error(msg);
  }
  if (framingType === 'hand-detail' && !gestureFocus) {
    const msg = `page ${input.spec.pageNumber}: hand-detail requires gestureFocus`;
    warnings.push(msg);
    if (input.strictFramingWarnings) throw new Error(msg);
  }

  const wardrobeBlock = WARDROBE_BLOCKS[sceneStateResult.value];
  const framingBlock = FRAMING_BLOCKS[framingType]({ focalObject, gestureFocus });
  const closeUpRuleApplied = framingType === 'close-emotional';
  const handDetailRuleApplied = framingType === 'hand-detail';

  const parts = [
    STYLE02_ILLUSTRATION_ANCHOR,
    input.sceneDescription.trim(),
    framingBlock,
    wardrobeBlock,
    GUARDED_V1_CHILD_LOCK,
    GUARDED_V1_COMPANION_LOCK,
    input.bedtimeMedicalTone ? input.bedtimeMedicalToneBlock ?? '' : '',
    closeUpRuleApplied && !handDetailRuleApplied ? GUARDED_V1_CLOSE_UP_RULE : '',
    handDetailRuleApplied ? HAND_DETAIL_RULE : '',
    STYLE_02_SHARED,
    STYLE_02_RENDERING_CORRECTION,
    STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_02_REFERENCE_INSTRUCTION,
    STYLE_02_NO_TEXT,
    STYLE_02_ANTI_SOFTNESS,
    STYLE_02_CHARACTER_GUARD,
  ].filter(Boolean);

  return {
    prompt: parts.join('\n\n'),
    debug: {
      sceneState: sceneStateResult.value,
      sceneStateSource: sceneStateResult.source,
      framingType,
      framingTypeSource: framingResult.source,
      wardrobeBlockUsed: sceneStateResult.value,
      illustrationAnchorUsed: true,
      closeUpRuleApplied,
      handDetailRuleApplied,
      framingBlockUsed: framingType,
      focalObject,
      gestureFocus,
    },
    warnings,
  };
}
