import type { CompanionSheetViewKind } from './generation-pipeline/companion-character-sheet';
import type { CompanionPresence } from './image-entity-presence';

export type CompanionViewIntent =
  | 'front'
  | 'threeQuarter'
  | 'side'
  | 'back'
  | 'partial'
  | 'silhouette';

export type CompanionViewIntentContext = {
  pageNumber?: number;
  imagePrompt?: string | null;
  bookPageText?: string | null;
  rawScenePrompt?: string | null;
  companionPresence?: CompanionPresence;
};

const COMPANION_BACK_RE =
  /\b(?:companion|fox|dragon|creature|owl|octopus|dini|uri|אורי|דיני)[^.]{0,40}\b(?:from behind|rear view|back view|turned away|walking away|facing away)\b/i;
const COMPANION_BACK_RE2 =
  /\b(?:from behind|rear view|back view|turned away|walking away|facing away)\b[^.]{0,40}\b(?:companion|fox|dragon|creature|owl|octopus|dini|uri)\b/i;
const SIDE_RE =
  /\b(side profile|profile view|from the side|lateral view|side-on|side view|in profile)\b/i;
const THREE_QUARTER_FRONT_RE =
  /\b(3\/4 front|three.quarter front|three-quarter front|slight angle toward camera|both eyes (?:and|&)? snout)\b/i;
const FACE_READABLE_RE =
  /\b(faces? the viewer|looking at (?:the )?child|both eyes|face close|expression|instructional expression|mouth open|smil|eyes (?:wide|round|soft|gentle))\b/i;
const PARTIAL_BODY_RE =
  /\b(only (?:the |a )?(?:tail|paw|ear|snout|tip)|tail tip|white tail tip|pawprint|footprint|glow(?:ing)? (?:neck )?lantern (?:in the distance|through)|visible for a moment|just (?:a |the )?tail)\b/i;
const OFFSCREEN_HINT_RE =
  /\b(shadow of|distant (?:glow|sound)|hint of|offscreen|outside (?:the )?window|through the window|only .* (?:visible|seen) (?:outside|through))\b/i;
const WALK_TOGETHER_RE =
  /\b(step(?:s|ping)? (?:down|onto|with)|walk(?:s|ing)? (?:side|together|with)|beside the (?:child|talking fox)|face close|points with)\b/i;

function sceneHaystack(ctx: CompanionViewIntentContext): string {
  return [ctx.rawScenePrompt, ctx.imagePrompt, ctx.bookPageText].filter(Boolean).join('\n');
}

/**
 * Resolve intended companion camera/framing for a page (pose + readability).
 * Uses story scene text only — never full assembled prompts.
 */
export function resolveCompanionViewIntent(ctx: CompanionViewIntentContext): CompanionViewIntent {
  if (ctx.companionPresence === 'absent') return 'front';

  const hay = sceneHaystack(ctx);

  if (ctx.companionPresence === 'partial' || PARTIAL_BODY_RE.test(hay)) {
    return 'partial';
  }
  if (ctx.companionPresence === 'offscreen_hint' || OFFSCREEN_HINT_RE.test(hay)) {
    return 'partial';
  }

  if (COMPANION_BACK_RE.test(hay) || COMPANION_BACK_RE2.test(hay)) {
    return 'back';
  }
  if (SIDE_RE.test(hay)) return 'side';
  if (THREE_QUARTER_FRONT_RE.test(hay)) return 'threeQuarter';
  if (FACE_READABLE_RE.test(hay) || WALK_TOGETHER_RE.test(hay)) {
    return 'threeQuarter';
  }
  return 'threeQuarter';
}

export function companionViewIntentToSheetKind(
  intent: CompanionViewIntent
): CompanionSheetViewKind | null {
  switch (intent) {
    case 'front':
      return 'front';
    case 'threeQuarter':
      return 'three_quarter_front';
    case 'side':
      return 'side';
    case 'back':
      return 'three_quarter_back';
    case 'partial':
    case 'silhouette':
      return null;
    default:
      return 'three_quarter_front';
  }
}

export function companionViewIntentNeedsSheetRef(intent: CompanionViewIntent): boolean {
  return intent !== 'partial' && intent !== 'silhouette';
}
