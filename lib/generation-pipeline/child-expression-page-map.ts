import type { ChildExpressionKind } from './child-expression-sheet';

export type PageExpressionContext = {
  pageNumber: number;
  /** When set, Dini-only page overrides apply; other companions use generic heuristics only. */
  companionId?: string | null;
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
  shotType?: string;
  action?: string;
  emotion?: string;
};

const SHOUTING_RE =
  /\b(shout|shouting|yell|yelling|roar|roaring|scream|screaming|open mouth|wide mouth|loud cry)\b/i;
const WORRIED_RE =
  /\b(worried|worry|sad|tear|tears|anxious|nervous|scared|fearful|upset|frown|concerned|determined|dizzy)\b/i;
/** Strong locomotion only — NOT wrapping, hugging, careful manual work, or generic "action shot". */
const ACTION_STRONG_RE =
  /\b(running\b|mid-run|sprinting|jumping\b|mid-jump|leaping|leap\b|riding\b|falling\b|chasing\b|being chased|fast movement|mid-fall)\b/i;
const HAPPY_RE = /\b(smile|smiling|laugh|delighted|proud|warm smile|gentle smile|happy|tender|gentle)\b/i;

/** dragon_dini_fantasy focused 5-page gate — explicit beats (action used sparingly). */
const DRAGON_DINI_PAGE_OVERRIDES: Record<number, ChildExpressionKind> = {
  1: 'neutral',
  4: 'happy',
  8: 'shouting',
  13: 'worried',
  20: 'happy',
};

function isStrongLocomotionBeat(haystack: string): boolean {
  if (ACTION_STRONG_RE.test(haystack)) return true;
  if (/\bcomic action shot\b/i.test(haystack) && ACTION_STRONG_RE.test(haystack)) return true;
  return false;
}

export function resolveChildExpressionKindForPage(ctx: PageExpressionContext): ChildExpressionKind {
  if (ctx.companionId === 'dragon_dini') {
    const override = DRAGON_DINI_PAGE_OVERRIDES[ctx.pageNumber];
    if (override) return override;
  }

  const haystack = [
    ctx.imagePrompt,
    ctx.bookPageText,
    ctx.rawScenePrompt,
    ctx.action,
    ctx.emotion,
    ctx.shotType,
  ]
    .filter(Boolean)
    .join(' ');

  if (SHOUTING_RE.test(haystack)) return 'shouting';
  if (WORRIED_RE.test(haystack)) return 'worried';
  if (isStrongLocomotionBeat(haystack)) return 'action';
  if (HAPPY_RE.test(haystack)) return 'happy';
  return 'neutral';
}
