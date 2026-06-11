/**
 * Book page layout engine — assigns layouts for reader rendering only (no DB / pipeline).
 *
 * @see HTML/reader.html + CSS/reader.css + JS/reader.js for structure per layout.
 *
 * ━━━ BOOK-LEVEL QA (manual — review a full generated book) ━━━
 *  - Overall: pages feel varied but still one coherent “book”, not random templates.
 *  - Rhythm: no long awkward runs of the same layout (especially overlay / text-first).
 *  - Opening & closing: first and last spreads feel a bit special (overlay or clear hero beat),
 *    without sacrificing readability.
 *  - Long copy: text-first pages stay readable (comfortable line length, not cramped under image).
 *  - Overlay: only short / open–close beats — should feel premium and uncrowded on small phones.
 *  - Text-only: when images are missing, typography still feels intentional, not “broken layout”.
 *  - Spot-check RTL, 320–400px width, and a few font-size settings if OS text scaling is large.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

export type BookPageLayout =
  | 'text_top_image_bottom'
  | 'image_top_text_bottom'
  | 'image_full_overlay_text'
  | 'text_only';

/** Page templates for image composition + persistence (not the same as reader `BookPageLayout` CSS). */
export type BookPageTemplate =
  | 'full_bleed_overlay'
  | 'art_top_text_bottom'
  | 'character_vignette_text';

const SHORT_TEXT_CHARS = 130;
const LONG_TEXT_CHARS = 300;

/** Caption-like: safe for full-bleed + bottom band on mobile. */
const OVERLAY_CAPTION_MAX = 52;

/** Opening / closing: overlay only when still short enough not to crowd the band. */
const OVERLAY_OPEN_CLOSE_MAX = 88;

/** Emotional cue may suggest overlay only at true “beat” length — not body copy. */
const OVERLAY_EMOTIONAL_MAX = 72;

const EMOTIONAL_HE =
  /לב|אהבה|פחד|דמע|נשימה|חיבוק|ביחד|לבד|מפחד|אומץ|גאווה|קרוב|רחוק|שקט|תחושה|מרגיש|חיבור|נשמה|עיניים|דופק/i;
const EMOTIONAL_EN =
  /\b(heart|love|afraid|fear|hug|brave|courage|cry|tears|together|alone|breath)\b/i;

/** Borderline length band: allow neighbor-based alternation when stacking is ambiguous. */
const BORDERLINE_LOW = 118;
const BORDERLINE_HIGH = 220;

const MAX_OVERLAY_STREAK = 2;
const MAX_TEXT_FIRST_STREAK = 3;

export type BookPageForLayout = {
  pageNumber: number;
  text: string;
  imageUrl: string | null | undefined;
};

function normalizedLength(text: string): number {
  return text.replace(/\s+/g, ' ').trim().length;
}

function hasEmotionalCue(text: string): boolean {
  return EMOTIONAL_HE.test(text) || EMOTIONAL_EN.test(text);
}

function overlayEligible(len: number, pageNumber: number, totalPages: number, text: string): boolean {
  if (len <= OVERLAY_CAPTION_MAX) return true;
  const first = pageNumber <= 1;
  const last = totalPages > 0 && pageNumber >= totalPages;
  if ((first || last) && len <= OVERLAY_OPEN_CLOSE_MAX) return true;
  if (hasEmotionalCue(text) && len <= OVERLAY_EMOTIONAL_MAX) return true;
  return false;
}

/** Stacked fallback when an overlay must be downgraded (still has image). */
function stackedFallback(
  len: number,
  pageNumber: number
): 'text_top_image_bottom' | 'image_top_text_bottom' {
  if (len >= LONG_TEXT_CHARS) return 'text_top_image_bottom';
  if (len <= SHORT_TEXT_CHARS) return 'image_top_text_bottom';
  return pageNumber % 2 === 0 ? 'image_top_text_bottom' : 'text_top_image_bottom';
}

function computeRawLayout(page: BookPageForLayout, totalPages: number): BookPageLayout {
  if (!page.imageUrl) return 'text_only';

  // Force text-top for ALL pages: text always at top on clean background, image below.
  // No overlay, no image-top variants. This keeps dark text readable and consistent.
  return 'text_top_image_bottom';
}

function overlayStreakEndingAt(layouts: BookPageLayout[], end: number): number {
  let c = 0;
  for (let j = end; j >= 0; j--) {
    if (layouts[j] !== 'image_full_overlay_text') break;
    c++;
  }
  return c;
}

function applyOverlayStreakCap(layouts: BookPageLayout[], pages: BookPageForLayout[]): void {
  let streak = 0;
  for (let i = 0; i < layouts.length; i++) {
    if (layouts[i] === 'image_full_overlay_text') {
      streak++;
      if (streak > MAX_OVERLAY_STREAK) {
        layouts[i] = stackedFallback(normalizedLength(pages[i].text), pages[i].pageNumber);
        streak = overlayStreakEndingAt(layouts, i - 1);
      }
    } else {
      streak = 0;
    }
  }
}

function applyTextFirstStreakCap(layouts: BookPageLayout[], pages: BookPageForLayout[]): void {
  for (let i = 2; i < layouts.length; i++) {
    const a = layouts[i - 2];
    const b = layouts[i - 1];
    const c = layouts[i];
    if (
      a === 'text_top_image_bottom' &&
      b === 'text_top_image_bottom' &&
      c === 'text_top_image_bottom' &&
      pages[i - 1].imageUrl
    ) {
      const len = normalizedLength(pages[i - 1].text);
      if (len < LONG_TEXT_CHARS + 80) {
        layouts[i - 1] = 'image_top_text_bottom';
      }
    }
  }
}

function applyBorderlineNeighborRhythm(layouts: BookPageLayout[], pages: BookPageForLayout[]): void {
  for (let i = 1; i < layouts.length; i++) {
    const len = normalizedLength(pages[i].text);
    if (!pages[i].imageUrl) continue;
    if (len < BORDERLINE_LOW || len > BORDERLINE_HIGH) continue;
    if (layouts[i] === 'text_only' || layouts[i] === 'image_full_overlay_text') continue;
    const prev = layouts[i - 1];
    const cur = layouts[i];
    if (prev === 'text_top_image_bottom' && cur === 'text_top_image_bottom') {
      layouts[i] = 'image_top_text_bottom';
    } else if (prev === 'image_top_text_bottom' && cur === 'image_top_text_bottom') {
      layouts[i] = 'text_top_image_bottom';
    }
  }
}

/**
 * Assign layouts for an entire book so rhythm rules can apply across pages.
 */
export function assignLayoutsForBook(pages: BookPageForLayout[]): BookPageLayout[] {
  const total = pages.length;
  const layouts = pages.map((p) => computeRawLayout(p, total));

  applyOverlayStreakCap(layouts, pages);
  applyTextFirstStreakCap(layouts, pages);
  applyBorderlineNeighborRhythm(layouts, pages);

  return layouts;
}

/**
 * @deprecated Prefer assignLayoutsForBook — single-page call skips cross-page rhythm.
 * Kept for tests or callers that only have one page.
 */
export function chooseBookPageLayout(input: {
  text: string;
  imageUrl: string | null | undefined;
  pageNumber: number;
  totalPages: number;
}): BookPageLayout {
  return assignLayoutsForBook([
    {
      pageNumber: input.pageNumber,
      text: input.text,
      imageUrl: input.imageUrl,
    },
  ])[0];
}

export type BookPageForTemplate = {
  pageNumber: number;
  text: string;
  imageUrl?: string | null;
  imageSubject?: string;
  pageIntent?: unknown;
};

function mapReaderLayoutToPageTemplate(layout: BookPageLayout): BookPageTemplate {
  switch (layout) {
    case 'image_full_overlay_text':
      return 'full_bleed_overlay';
    case 'text_top_image_bottom':
      return 'art_top_text_bottom';
    case 'image_top_text_bottom':
      return 'character_vignette_text';
    case 'text_only':
    default:
      return 'art_top_text_bottom';
  }
}

/**
 * Pipeline / DB page templates derived from the reader layout heuristics (image composition vocabulary).
 * Uses a truthy placeholder when `imageUrl` is missing so pre-image generation can still pick layouts.
 */
export function assignTemplatesForBook(pages: BookPageForTemplate[]): BookPageTemplate[] {
  const forLayout: BookPageForLayout[] = pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
    imageUrl: p.imageUrl != null && p.imageUrl !== '' ? p.imageUrl : 'pending',
  }));
  return assignLayoutsForBook(forLayout).map(mapReaderLayoutToPageTemplate);
}

export function textPlacementForTemplate(template: BookPageTemplate): string {
  switch (template) {
    case 'full_bleed_overlay':
      return 'overlay';
    case 'art_top_text_bottom':
      return 'art_top';
    case 'character_vignette_text':
      return 'vignette';
  }
}
