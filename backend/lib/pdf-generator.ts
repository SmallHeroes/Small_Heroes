/**
 * PDF Generator — pdf-lib (pure JS, no browser binary)
 *
 * Composes book pages as full-bleed images with Hebrew text overlay.
 * Works on serverless platforms without requiring Chromium.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface BookPageForPdf {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  isCover?: boolean;
}

interface GenerateBookPdfParams {
  title: string;
  pages: BookPageForPdf[];
}

const PAGE_W = 612;
const PAGE_H = 612;

const TEXT_MARGIN_TOP = 28;
const TEXT_MARGIN_X = 36;
const TEXT_FONT_SIZE = 15;
const TEXT_LINE_HEIGHT = 24;
const TEXT_COLOR = rgb(0.18, 0.14, 0.10);
const FALLBACK_BG = rgb(0.91, 0.86, 0.78);

type EmbeddedFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

/**
 * Fetch remote image and convert to JPEG.
 * We normalize dimensions to keep predictable full-bleed quality.
 */
async function fetchImageAsJpeg(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${url} (HTTP ${res.status})`);
  }
  const imageBuffer = Buffer.from(await res.arrayBuffer());
  return sharp(imageBuffer)
    .resize(PAGE_W * 2, PAGE_H * 2, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Load Heebo font — local TTF first (reliable), Google Fonts as fallback.
 * Local files are bundled via next.config.js outputFileTracingIncludes.
 */
async function loadHeeboFont(): Promise<Buffer> {
  // Primary: local font file (always available, no network dependency)
  const localPaths = [
    join(process.cwd(), 'backend', 'assets', 'fonts', 'Heebo-Bold.ttf'),
    join(process.cwd(), 'backend/assets/fonts/Heebo-Bold.ttf'),
  ];
  for (const p of localPaths) {
    try {
      return await readFile(p);
    } catch { /* try next */ }
  }

  // Fallback: fetch from Google Fonts (network-dependent)
  console.warn('[pdf-generator] Local Heebo font not found, fetching from Google Fonts');
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Heebo:wght@700&display=swap';
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; small-heroes-pdf-generator)' },
  });
  if (!cssRes.ok) {
    throw new Error(`Failed to fetch Google Fonts CSS (HTTP ${cssRes.status})`);
  }
  const css = await cssRes.text();
  const fontUrlMatch = css.match(/url\(([^)]+\.(?:woff2|woff|ttf)[^)]*)\)/i);
  if (!fontUrlMatch?.[1]) {
    throw new Error('Unable to extract Heebo font URL from Google Fonts CSS');
  }
  const fontRes = await fetch(fontUrlMatch[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch Heebo font bytes (HTTP ${fontRes.status})`);
  }
  return Buffer.from(await fontRes.arrayBuffer());
}

function sanitizeText(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wrapText(text: string, maxWidth: number, font: EmbeddedFont, fontSize: number): string[] {
  const clean = sanitizeText(text);
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateBookPdf(params: GenerateBookPdfParams): Promise<Buffer> {
  const pages = [...params.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let heeboFont: EmbeddedFont;
  try {
    const fontBytes = await loadHeeboFont();
    heeboFont = await pdfDoc.embedFont(fontBytes);
  } catch (fontErr) {
    // Helvetica CANNOT render Hebrew — only use as absolute last resort for error visibility
    console.error('[pdf-generator] CRITICAL: Failed to load Heebo font from all sources', fontErr);
    throw new Error('PDF generation failed: Hebrew font unavailable');
  }

  const maxTextWidth = PAGE_W - TEXT_MARGIN_X * 2;

  for (const bookPage of pages) {
    const pdfPage = pdfDoc.addPage([PAGE_W, PAGE_H]);

    if (bookPage.imageUrl) {
      try {
        const imageBuffer = await fetchImageAsJpeg(bookPage.imageUrl);
        const image = await pdfDoc.embedJpg(imageBuffer);
        pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      } catch (imgErr) {
        console.warn(`[pdf-generator] Image fetch failed for page ${bookPage.pageNumber}`, imgErr);
        pdfPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: FALLBACK_BG });
      }
    } else {
      pdfPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: FALLBACK_BG });
    }

    const rawText = bookPage.isCover ? params.title : bookPage.text;
    const text = sanitizeText(rawText);
    if (!text) continue;

    const fontSize = bookPage.isCover ? 28 : TEXT_FONT_SIZE;
    const lineHeight = bookPage.isCover ? 40 : TEXT_LINE_HEIGHT;
    const lines = wrapText(text, maxTextWidth, heeboFont, fontSize);
    if (lines.length === 0) continue;

    const startY = bookPage.isCover
      ? PAGE_H / 2 + ((lines.length - 1) * lineHeight) / 2
      : PAGE_H - TEXT_MARGIN_TOP - fontSize;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineWidth = heeboFont.widthOfTextAtSize(line, fontSize);
      const x = (PAGE_W - lineWidth) / 2;
      const y = startY - i * lineHeight;

      pdfPage.drawText(line, {
        x,
        y,
        size: fontSize,
        font: heeboFont,
        color: TEXT_COLOR,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}