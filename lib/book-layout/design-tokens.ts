/**
 * Book design tokens — print-aware, consumed by screen reader + future PrintRenderer.
 */

export type BookDesignTokens = {
  trim: {
    widthIn: number;
    heightIn: number;
    aspectRatio: number;
  };
  page: {
    textBlockWidthPct: number;
    innerMarginMm: number;
    outerMarginMm: number;
    topMarginMm: number;
    bottomMarginMm: number;
    ornamentZoneMm: number;
    safeZoneMm: number;
    visualGutterEffectMm: number;
  };
  printBleedMm: number;
};

export const BOOK_DESIGN_TOKENS: BookDesignTokens = {
  trim: {
    widthIn: 7,
    heightIn: 10,
    aspectRatio: 7 / 10,
  },
  page: {
    textBlockWidthPct: 0.78,
    innerMarginMm: 12,
    outerMarginMm: 10,
    topMarginMm: 14,
    bottomMarginMm: 14,
    ornamentZoneMm: 6,
    safeZoneMm: 10,
    visualGutterEffectMm: 8,
  },
  /** Screen reader ignores bleed; PrintRenderer consumes this only. */
  printBleedMm: 3,
};

export function tokensToCssVars(tokens: BookDesignTokens = BOOK_DESIGN_TOKENS): Record<string, string> {
  const p = tokens.page;
  return {
    '--book-trim-ratio': String(tokens.trim.aspectRatio),
    '--book-text-block-width': `${p.textBlockWidthPct * 100}%`,
    '--book-inner-margin': `${p.innerMarginMm}mm`,
    '--book-outer-margin': `${p.outerMarginMm}mm`,
    '--book-top-margin': `${p.topMarginMm}mm`,
    '--book-bottom-margin': `${p.bottomMarginMm}mm`,
    '--book-ornament-zone': `${p.ornamentZoneMm}mm`,
    '--book-safe-zone': `${p.safeZoneMm}mm`,
    '--book-spine-effect': `${p.visualGutterEffectMm}mm`,
  };
}
