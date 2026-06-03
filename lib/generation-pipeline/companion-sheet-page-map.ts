import type { CompanionSheetViewKind } from './companion-character-sheet';
import {
  companionViewIntentToSheetKind,
  resolveCompanionViewIntent,
  type CompanionViewIntent,
} from '../companion-view-intent';
import type { CompanionPresence } from '../image-entity-presence';

export type CompanionSheetPageContext = {
  pageNumber?: number;
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
  shotType?: string;
  action?: string;
  emotion?: string;
  companionPresence?: CompanionPresence;
};

const HAPPY_RE =
  /\b(smile|smiling|laugh|delighted|proud|warm smile|gentle smile|happy|joy|celebrat|hug|tender)\b/i;
const CALM_THEME_RE =
  /\b(calm|reassur|comfort|soothe|gentle|peaceful|quiet|breath|settl|protect|guardian|brave)\b/i;
const WORRY_RE =
  /\b(worried|anxious|nervous|scared|fear|upset|frustrat|angry|tantrum|shout|yell)\b/i;

/**
 * Pick the best published sheet view for a story page (pose-first, then expression heuristics).
 * Uses raw scene text only — never assembled prompts (imagePrompt excluded when rawScenePrompt exists).
 */
export function resolveCompanionSheetViewForPage(
  ctx: CompanionSheetPageContext
): CompanionSheetViewKind {
  const viewIntent = resolveCompanionViewIntent({
    pageNumber: ctx.pageNumber,
    rawScenePrompt: ctx.rawScenePrompt,
    bookPageText: ctx.bookPageText,
    imagePrompt: ctx.rawScenePrompt ? undefined : ctx.imagePrompt,
    companionPresence: ctx.companionPresence,
  });

  const fromIntent = companionViewIntentToSheetKind(viewIntent);
  if (fromIntent) return fromIntent;

  const haystack = [ctx.bookPageText, ctx.rawScenePrompt, ctx.action, ctx.emotion, ctx.shotType]
    .filter(Boolean)
    .join(' ');
  if (HAPPY_RE.test(haystack)) return 'happy';
  if (WORRY_RE.test(haystack) && CALM_THEME_RE.test(haystack)) return 'theme';
  if (WORRY_RE.test(haystack)) return 'theme';
  if (CALM_THEME_RE.test(haystack)) return 'theme';
  return 'three_quarter_front';
}

export function resolveCompanionViewIntentForPage(
  ctx: CompanionSheetPageContext
): CompanionViewIntent {
  return resolveCompanionViewIntent({
    pageNumber: ctx.pageNumber,
    rawScenePrompt: ctx.rawScenePrompt,
    bookPageText: ctx.bookPageText,
    imagePrompt: ctx.rawScenePrompt ? undefined : ctx.imagePrompt,
    companionPresence: ctx.companionPresence,
  });
}
