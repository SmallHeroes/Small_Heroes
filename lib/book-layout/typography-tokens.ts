/**
 * Book typography tokens — screen reader + future print.
 *
 * --font-book-display
 *   Intended production face: ABRAHAM (Fontef / Daniel Grumer) — commercial license required.
 *   Do NOT substitute free "Abraham" files from Dafont / 1001Fonts (different typeface, personal-use only).
 *   Phase 1 fallback: David Libre (Google Fonts, OFL). Swap by setting --font-david → licensed @font-face.
 *
 * --font-book-prose
 *   Frank Ruhl Libre 400 (body). Weight 500 for emphasis only. Not for headings.
 *
 * --font-ui
 *   Rubik / Heebo — navigation and system controls only.
 */

export const BOOK_TYPOGRAPHY_CSS_VARS: Record<string, string> = {
  '--font-book-prose':
    'var(--font-frank), "Frank Ruhl Libre", var(--font-noto-serif-hebrew), "Noto Serif Hebrew", serif',
  '--font-book-display':
    'var(--font-david), "David Libre", var(--font-noto-serif-hebrew), "Noto Serif Hebrew", serif',
  '--font-ui': 'var(--font-rubik), Rubik, var(--font-heebo), Heebo, sans-serif',
};

export function bookTypographyCssVars(): Record<string, string> {
  return { ...BOOK_TYPOGRAPHY_CSS_VARS };
}
