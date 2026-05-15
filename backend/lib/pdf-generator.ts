/**
 * PDF Generator — pdf-lib (pure JS, no browser binary)
 *
 * Layout matches the desktop reader spread:
 *   - Cover         → single 2:3 portrait page (image + title overlay)
 *   - Each body page → TWO 2:3 portrait pages in sequence:
 *       (a) designed TEXT page on cream paper (right side of spread, RTL)
 *       (b) full-bleed IMAGE page (left side of spread)
 *   - Dedication    → single 2:3 portrait page (cream paper with kicker + text)
 *
 * In a PDF reader's "two-page / facing pages" view this yields the same
 * spread the desktop reader shows. In single-page view the user reads
 * the text first and then sees the matching illustration.
 *
 * Aspect ratio is 2:3 portrait per the user request (2026-05-15).
 * Pure JS — no Chromium — works on serverless platforms.
 */
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface BookPageForPdf {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  isCover?: boolean;
  isDedication?: boolean;
}

interface GenerateBookPdfParams {
  title: string;
  pages: BookPageForPdf[];
}

// Single-page sub-dimensions (2:3 portrait, matches the desktop reader's per-page size)
const HALF_W = 480;
const PAGE_H = 720;
// Full body spread: 2 portrait pages side by side = 4:3 landscape
const SPREAD_W = HALF_W * 2;

const TEXT_MARGIN_X = 48;
const TEXT_MARGIN_TOP = 72;
const TEXT_FONT_SIZE = 17;
const TEXT_LINE_HEIGHT = 28;
const TEXT_COLOR = rgb(0.24, 0.16, 0.09);          // warm dark brown — matches reader
const KICKER_COLOR = rgb(0.45, 0.32, 0.18);        // muted brown for "הקדשה" / page number
const CREAM_BG = rgb(0.961, 0.922, 0.839);         // #f5ebd6 fallback when paper texture missing
const FALLBACK_BG = rgb(0.91, 0.86, 0.78);

type EmbeddedFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

/** Fetch remote image and convert to JPEG, sized for the image PDF page. */
async function fetchImageAsJpeg(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (HTTP ${res.status})`);
  const imageBuffer = Buffer.from(await res.arrayBuffer());
  return sharp(imageBuffer)
    .resize(HALF_W * 2, PAGE_H * 2, { fit: 'cover' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Load cream-paper texture for designed text pages. Returns null when not available. */
async function loadPaperTexture(): Promise<Buffer | null> {
  const candidates = [
    join(process.cwd(), 'public', 'Images', 'EmptyPage.png'),
    join(process.cwd(), 'public/Images/EmptyPage.png'),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p);
      return await sharp(raw)
        .resize(HALF_W * 2, PAGE_H * 2, { fit: 'cover' })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch { /* try next */ }
  }
  return null;
}

/** Load Heebo font — local TTF first (reliable), Google Fonts as fallback. */
async function loadHeeboFont(): Promise<Buffer> {
  const localPaths = [
    join(process.cwd(), 'backend', 'assets', 'fonts', 'Heebo-Bold.ttf'),
    join(process.cwd(), 'backend/assets/fonts/Heebo-Bold.ttf'),
  ];
  for (const p of localPaths) {
    try { return await readFile(p); } catch { /* try next */ }
  }
  console.warn('[pdf-generator] Local Heebo font not found, fetching from Google Fonts');
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Heebo:wght@700&display=swap';
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; small-heroes-pdf-generator)' },
  });
  if (!cssRes.ok) throw new Error(`Failed to fetch Google Fonts CSS (HTTP ${cssRes.status})`);
  const css = await cssRes.text();
  const fontUrlMatch = css.match(/url\(([^)]+\.(?:woff2|woff|ttf)[^)]*)\)/i);
  if (!fontUrlMatch?.[1]) throw new Error('Could not extract font URL from Google Fonts CSS');
  const fontRes = await fetch(fontUrlMatch[1]);
  if (!fontRes.ok) throw new Error(`Failed to fetch Heebo font (HTTP ${fontRes.status})`);
  return Buffer.from(await fontRes.arrayBuffer());
}

function sanitizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Hebrew-aware word wrap. Breaks on whitespace; falls back to char-count for unspaced runs. */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const sentences = sanitizeText(text).split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences.length ? sentences : [sanitizeText(text)]) {
    const words = sentence.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Draw the cream-paper background for designed text pages. */
function drawCreamPage(page: PDFPage, paperImg: Awaited<ReturnType<PDFDocument['embedJpg']>> | null): void {
  if (paperImg) {
    page.drawImage(paperImg, { x: 0, y: 0, width: HALF_W, height: PAGE_H });
  } else {
    page.drawRectangle({ x: 0, y: 0, width: HALF_W, height: PAGE_H, color: CREAM_BG });
  }
}

/** Draw RTL right-aligned Hebrew text on a designed text page. */
function drawDesignedTextPage(
  page: PDFPage,
  text: string,
  paperImg: Awaited<ReturnType<PDFDocument['embedJpg']>> | null,
  font: PDFFont,
  pageNumberLabel?: string,
): void {
  drawCreamPage(page, paperImg);

  const maxTextWidth = HALF_W - TEXT_MARGIN_X * 2;
  const lines = wrapText(text, maxTextWidth, font, TEXT_FONT_SIZE);
  if (!lines.length) return;

  // Vertically center the text block inside the visible area
  const totalTextHeight = lines.length * TEXT_LINE_HEIGHT;
  const startY = (PAGE_H + totalTextHeight) / 2 - TEXT_FONT_SIZE;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = font.widthOfTextAtSize(line, TEXT_FONT_SIZE);
    // Right-align for RTL — anchor each line to the right margin
    const x = HALF_W - TEXT_MARGIN_X - lineWidth;
    const y = startY - i * TEXT_LINE_HEIGHT;
    page.drawText(line, { x, y, size: TEXT_FONT_SIZE, font, color: TEXT_COLOR });
  }

  if (pageNumberLabel) {
    const labelSize = 10;
    const labelWidth = font.widthOfTextAtSize(pageNumberLabel, labelSize);
    page.drawText(pageNumberLabel, {
      x: (HALF_W - labelWidth) / 2,
      y: 32,
      size: labelSize,
      font,
      color: KICKER_COLOR,
    });
  }
}

/** Same as drawDesignedTextPage but anchored at an x-offset — used for the
 *  RIGHT half of a landscape spread. */
function drawDesignedTextPageAt(
  page: PDFPage,
  xOffset: number,
  text: string,
  paperImg: Awaited<ReturnType<PDFDocument['embedJpg']>> | null,
  font: PDFFont,
  pageNumberLabel?: string,
): void {
  // Cream/paper background only on this half
  if (paperImg) {
    page.drawImage(paperImg, { x: xOffset, y: 0, width: HALF_W, height: PAGE_H });
  } else {
    page.drawRectangle({ x: xOffset, y: 0, width: HALF_W, height: PAGE_H, color: CREAM_BG });
  }

  const maxTextWidth = HALF_W - TEXT_MARGIN_X * 2;
  const lines = wrapText(text, maxTextWidth, font, TEXT_FONT_SIZE);
  if (!lines.length) return;

  const totalTextHeight = lines.length * TEXT_LINE_HEIGHT;
  const startY = (PAGE_H + totalTextHeight) / 2 - TEXT_FONT_SIZE;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = font.widthOfTextAtSize(line, TEXT_FONT_SIZE);
    // Right-align within this half (xOffset is the LEFT edge of the half)
    const x = xOffset + HALF_W - TEXT_MARGIN_X - lineWidth;
    const y = startY - i * TEXT_LINE_HEIGHT;
    page.drawText(line, { x, y, size: TEXT_FONT_SIZE, font, color: TEXT_COLOR });
  }

  if (pageNumberLabel) {
    const labelSize = 10;
    const labelWidth = font.widthOfTextAtSize(pageNumberLabel, labelSize);
    page.drawText(pageNumberLabel, {
      x: xOffset + (HALF_W - labelWidth) / 2,
      y: 32,
      size: labelSize,
      font,
      color: KICKER_COLOR,
    });
  }
}

/** Draw the image PDF page — full-bleed illustration only. */
function drawImagePage(
  page: PDFPage,
  image: Awaited<ReturnType<PDFDocument['embedJpg']>> | null,
): void {
  if (image) {
    page.drawImage(image, { x: 0, y: 0, width: HALF_W, height: PAGE_H });
  } else {
    page.drawRectangle({ x: 0, y: 0, width: HALF_W, height: PAGE_H, color: FALLBACK_BG });
  }
}

/** Draw the cover — image full-bleed with title overlay near top. */
function drawCoverPage(
  page: PDFPage,
  image: Awaited<ReturnType<PDFDocument['embedJpg']>> | null,
  title: string,
  font: PDFFont,
): void {
  drawImagePage(page, image);

  if (!title) return;
  const titleSize = 30;
  const lineHeight = 42;
  const maxWidth = HALF_W - 56;
  const titleLines = wrapText(title, maxWidth, font, titleSize);
  if (!titleLines.length) return;

  // Title near the upper third of the cover, with a subtle warm cream tone
  const startY = PAGE_H - 90;
  for (let i = 0; i < titleLines.length; i++) {
    const line = titleLines[i];
    const lineWidth = font.widthOfTextAtSize(line, titleSize);
    const x = (HALF_W - lineWidth) / 2;
    const y = startY - i * lineHeight;
    // Subtle warm background plate for readability
    page.drawRectangle({
      x: x - 12,
      y: y - 6,
      width: lineWidth + 24,
      height: titleSize + 14,
      color: rgb(0.96, 0.92, 0.84),
      opacity: 0.62,
    });
    page.drawText(line, { x, y, size: titleSize, font, color: rgb(0.18, 0.12, 0.07) });
  }
}

/** Draw the dedication page — cream paper with kicker + centered text. */
function drawDedicationPage(
  page: PDFPage,
  text: string,
  paperImg: Awaited<ReturnType<PDFDocument['embedJpg']>> | null,
  font: PDFFont,
): void {
  drawCreamPage(page, paperImg);

  const kicker = 'הקדשה';
  const kickerSize = 12;
  const kickerWidth = font.widthOfTextAtSize(kicker, kickerSize);
  page.drawText(kicker, {
    x: (HALF_W - kickerWidth) / 2,
    y: PAGE_H / 2 + 80,
    size: kickerSize,
    font,
    color: KICKER_COLOR,
  });

  const maxWidth = HALF_W - 80;
  const lines = wrapText(text, maxWidth, font, 18);
  const totalH = lines.length * 30;
  const startY = (PAGE_H + totalH) / 2 - 18;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = font.widthOfTextAtSize(line, 18);
    const x = (HALF_W - lineWidth) / 2;
    const y = startY - i * 30;
    page.drawText(line, { x, y, size: 18, font, color: TEXT_COLOR });
  }

  // Decorative dots
  const dots = '· · ·';
  const dotsSize = 14;
  const dotsWidth = font.widthOfTextAtSize(dots, dotsSize);
  page.drawText(dots, {
    x: (HALF_W - dotsWidth) / 2,
    y: PAGE_H / 2 - totalH / 2 - 36,
    size: dotsSize,
    font,
    color: KICKER_COLOR,
  });
}

export async function generateBookPdf(params: GenerateBookPdfParams): Promise<Buffer> {
  const pages = [...params.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let heeboFont: EmbeddedFont;
  try {
    heeboFont = await pdfDoc.embedFont(await loadHeeboFont());
  } catch (fontErr) {
    console.error('[pdf-generator] CRITICAL: Failed to load Heebo font', fontErr);
    throw new Error('PDF generation failed: Hebrew font unavailable');
  }

  // Preload the cream paper texture once, share across all text pages
  let paperImg: Awaited<ReturnType<PDFDocument['embedJpg']>> | null = null;
  try {
    const paperBytes = await loadPaperTexture();
    if (paperBytes) paperImg = await pdfDoc.embedJpg(paperBytes);
  } catch (paperErr) {
    console.warn('[pdf-generator] Paper texture unavailable, using solid cream fallback', paperErr);
  }

  // Count body pages so we can label "עמוד N של M"
  const bodyPageCount = pages.filter((p) => !p.isCover && !p.isDedication).length;
  let bodyIndex = 0;

  for (const bookPage of pages) {
    // ── Cover ────────────────────────────────────────────────
    if (bookPage.isCover) {
      const cover = pdfDoc.addPage([HALF_W, PAGE_H]);
      let img = null;
      if (bookPage.imageUrl) {
        try {
          img = await pdfDoc.embedJpg(await fetchImageAsJpeg(bookPage.imageUrl));
        } catch (err) {
          console.warn(`[pdf-generator] Cover image fetch failed`, err);
        }
      }
      drawCoverPage(cover, img, params.title, heeboFont);
      continue;
    }

    // ── Dedication ───────────────────────────────────────────
    if (bookPage.isDedication) {
      const ded = pdfDoc.addPage([HALF_W, PAGE_H]);
      drawDedicationPage(ded, sanitizeText(bookPage.text), paperImg, heeboFont);
      continue;
    }

    // ── Body page → TWO portrait PDF pages (image, then text), both 2:3 ──
    // Per user request (2026-05-15 evening): a 15-body-page book should yield
    // 30 PDF pages so the count reflects what readers see when scrolling. Each
    // page gets its own '· N ·' label including the image page.
    bodyIndex += 1;

    // (a) Image page — full bleed
    const imagePage = pdfDoc.addPage([HALF_W, PAGE_H]);
    let img = null;
    if (bookPage.imageUrl) {
      try {
        img = await pdfDoc.embedJpg(await fetchImageAsJpeg(bookPage.imageUrl));
      } catch (err) {
        console.warn(`[pdf-generator] Image fetch failed for page ${bookPage.pageNumber}`, err);
      }
    }
    drawImagePage(imagePage, img);
    // Image-page label: subtle bottom-center, white-on-shadow so it reads over the art
    const imgPageLabel = `· ${bodyIndex * 2 - 1} ·`;
    const imgLabelSize = 10;
    const imgLabelWidth = heeboFont.widthOfTextAtSize(imgPageLabel, imgLabelSize);
    imagePage.drawRectangle({
      x: (HALF_W - imgLabelWidth) / 2 - 8,
      y: 18,
      width: imgLabelWidth + 16,
      height: imgLabelSize + 10,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });
    imagePage.drawText(imgPageLabel, {
      x: (HALF_W - imgLabelWidth) / 2,
      y: 24,
      size: imgLabelSize,
      font: heeboFont,
      color: KICKER_COLOR,
    });

    // (b) Designed text page — cream paper, RTL right-aligned, label at bottom
    const textPage = pdfDoc.addPage([HALF_W, PAGE_H]);
    const textPageLabel = `· ${bodyIndex * 2} ·`;
    drawDesignedTextPage(textPage, sanitizeText(bookPage.text), paperImg, heeboFont, textPageLabel);
  }

  // Suppress unused-var lint when bodyPageCount isn't used directly
  void bodyPageCount;

  // Set "facing pages" hint so PDF readers default to spread view when supported
  // (most viewers respect /PageLayout TwoPageRight or TwoPageLeft)
  pdfDoc.catalog.set(pdfDoc.context.obj('PageLayout'), pdfDoc.context.obj('SinglePage'));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
