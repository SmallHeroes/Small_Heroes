import { BOOK_PALETTES, DEFAULT_BOOK_PALETTE, type StaticBookPalette } from '@/data/bookPalettes';

export type BookPalette = StaticBookPalette & {
  accent?: string;
  pageBgSource?: 'map' | 'fallback';
  altSource?: 'map' | 'fallback';
};

export type BookPaletteWithMetrics = BookPalette & {
  luminance: number;
  contrastRatio: number;
  source: 'map' | 'fallback';
};

function toLinear(c: number): number {
  const channel = c / 255;
  if (channel <= 0.03928) return channel / 12.92;
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function luminanceFromHex(hex: string): number {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return 1;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return 1;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = luminanceFromHex(hexA);
  const lumB = luminanceFromHex(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function withMetrics(palette: BookPalette, source: BookPaletteWithMetrics['source']): BookPaletteWithMetrics {
  return {
    ...palette,
    luminance: luminanceFromHex(palette.page_bg),
    contrastRatio: contrastRatio(palette.page_bg, palette.text_color),
    source,
  };
}

function resolvePalette(bookId: string): { palette: BookPalette; source: BookPaletteWithMetrics['source'] } {
  const fromMap = BOOK_PALETTES[bookId];
  if (fromMap) {
    return {
      source: 'map',
      palette: {
        ...fromMap,
        pageBgSource: 'map',
        altSource: 'map',
      },
    };
  }
  return {
    source: 'fallback',
    palette: {
      ...DEFAULT_BOOK_PALETTE,
      pageBgSource: 'fallback',
      altSource: 'fallback',
    },
  };
}

export function getBookPaletteFallback(bookId: string): BookPaletteWithMetrics {
  const { palette, source } = resolvePalette(bookId);
  return withMetrics(palette, source);
}

export async function extractBookPalette(
  bookId: string,
  _imageUrls: string[]
): Promise<BookPaletteWithMetrics> {
  return getBookPaletteFallback(bookId);
}

