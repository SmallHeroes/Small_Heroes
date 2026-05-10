/**
 * Central constants for professional print-ready output (square 8.5" children's book).
 * RGB workflow; trim + bleed sized for print shops.
 */

/** Millimetres per inch (ISO). */
export const MM_PER_INCH = 25.4;

/** PostScript points per inch. */
export const PT_PER_INCH = 72;

/** Convert millimetres to points (1 mm ≈ 2.835 pt at 72 dpi). */
export const MM_TO_PT = PT_PER_INCH / MM_PER_INCH;

/** Final trim size after cutting (square). */
export const TRIM_SIZE_INCH = 8.5;

/** Trim width/height in points (8.5 in × 72). */
export const TRIM_PT = TRIM_SIZE_INCH * PT_PER_INCH; // 612

/** Bleed beyond trim on each side (full bleed for backgrounds). */
export const BLEED_MM = 3;

/** Bleed in points (one side). Spec rounds to ~8.5 pt for 3 mm. */
export const BLEED_PT = (BLEED_MM * MM_TO_PT * 1000) / 1000; // ~8.5039

/** Total PDF page size including bleed (222 mm square). */
export const FULL_PAGE_PT = TRIM_PT + 2 * BLEED_PT; // ~629

/** Keep all text and critical UI inside this margin from the trim edge. */
export const SAFE_MARGIN_MM = 12;

export const SAFE_MARGIN_PT = (SAFE_MARGIN_MM * MM_TO_PT * 1000) / 1000;

/**
 * Padding from the physical PDF page edge to the inner safe rectangle.
 * Equals bleed + safe margin — use for `.text-overlay` and cover title inset.
 */
export const CONTENT_INSET_FROM_PAGE_EDGE_PT = BLEED_PT + SAFE_MARGIN_PT;

/** Target raster resolution guideline for plate prep (embedding is mixed vector/raster). */
export const TARGET_DPI_PRINT = 300;

/** Interior story text colour (warm dark, print-safe). */
export const PRINT_BODY_TEXT_COLOR = '#2a241a';

/** Warm “rich” dark — avoid RGB 0 0 0 large solids. */
export const PRINT_SHADOW_DARK = '#1a1a1a';

/** Fallback plate background when illustration fails */
export const PRINT_FALLBACK_BG = '#ebe4d8';

/** Puppeteer raster sharpness multiplier for viewport vs PDF pts. */
export const PRINT_PDF_VIEWPORT_SCALE = 2;

/** Metadata artifact version tag. */
export const PRINT_METADATA_VERSION = '1.0';

export function buildPrintMetadata(extra: {
  pageCount: number;
  generatedAtIso: string;
  upscaledPageCount?: number;
}): Record<string, unknown> {
  return {
    format: 'print_ready',
    trimSize: '216x216mm',
    bleed: '3mm',
    safeMargin: '12mm',
    dpi: TARGET_DPI_PRINT,
    pageCount: extra.pageCount,
    colorMode: 'RGB',
    fonts: ['Heebo'],
    generatedAt: extra.generatedAtIso,
    version: PRINT_METADATA_VERSION,
    ...(typeof extra.upscaledPageCount === 'number'
      ? { upscaledPageCount: extra.upscaledPageCount }
      : {}),
  };
}
