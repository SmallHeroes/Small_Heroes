# Phase 9c — Fix PDF Generation on Vercel (Replace Puppeteer with pdf-lib)

## Problem

PDF generation silently fails on Vercel. The user selects the PDF addon, pays for it, but never gets a download button on the ready page. The catch block in `app/api/generate/route.ts:1297` swallows the error:

```
generationLogger.error('PDF generation failed (non-fatal)', pdfErr, { orderId });
```

Root cause: `pdf-generator.ts` uses Puppeteer + `@sparticuz/chromium` which is unreliable on Vercel serverless with 1024MB memory. Chromium alone needs ~300-500MB, and by the time we reach PDF generation, the function has already done story generation + image generation.

## Solution — Replace Puppeteer with pdf-lib + sharp

`pdf-lib` is a pure JavaScript PDF library — no browser binary, no native deps, ~250KB. Since our pages are just full-bleed images with short text at the top, we don't need a full browser.

### Approach

For each page:
1. Fetch the page image (already a URL in Supabase)
2. Embed it as a full-bleed background using pdf-lib
3. Draw Hebrew text at the top using pdf-lib's text drawing (with embedded font)

### Install

```bash
npm install pdf-lib fontkit
npm uninstall @sparticuz/chromium puppeteer-core
```

**Wait** — `puppeteer-core` is also used by video generation? Check before removing. If video.ts uses it, keep it. If only pdf-generator.ts imports it, remove both.

Actually — video.ts uses `ffmpeg` + `sharp`, NOT puppeteer. Safe to remove both.

### Rewrite `backend/lib/pdf-generator.ts`

Replace the entire file. New implementation:

```typescript
/**
 * PDF Generator — pdf-lib (pure JS, no browser binary)
 *
 * Composes book pages as full-bleed images with Hebrew text overlay.
 * Works on any serverless platform — no Chromium needed.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@aspect-build/fontkit';  // or 'fontkit' — see note below
import sharp from 'sharp';

// Page size: 612pt × 612pt (8.5" square)
const PAGE_W = 612;
const PAGE_H = 612;

// Text overlay settings — match reader appearance
const TEXT_MARGIN_TOP = 28;
const TEXT_MARGIN_X = 36;
const TEXT_FONT_SIZE = 15;
const TEXT_LINE_HEIGHT = 24;
const TEXT_COLOR = rgb(0.18, 0.14, 0.10); // #2e2a22

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

/** Fetch a remote image and return as JPEG buffer (pdf-lib embeds JPEG natively). */
async function fetchImageAsJpeg(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Convert to JPEG — pdf-lib handles JPEG and PNG natively
  return sharp(buf).resize(PAGE_W * 2, PAGE_H * 2, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
}

/** Fetch Heebo font from Google Fonts for Hebrew support. */
async function fetchHeeboFont(): Promise<ArrayBuffer> {
  // Google Fonts API — get Heebo Bold (700) which supports Hebrew
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Heebo:wght@700&display=swap';
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pdf-generator)' },
  });
  const css = await cssRes.text();

  // Extract the font URL from the CSS
  const fontUrlMatch = css.match(/url\(([^)]+\.(?:woff2|woff|ttf))\)/);
  if (!fontUrlMatch) throw new Error('Could not find Heebo font URL in Google Fonts CSS');

  const fontRes = await fetch(fontUrlMatch[1]);
  if (!fontRes.ok) throw new Error(`Failed to fetch Heebo font: HTTP ${fontRes.status}`);
  return fontRes.arrayBuffer();
}

/** Simple RTL-aware line wrapping by word boundaries. */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
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

  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit);

  // Load Heebo font for Hebrew text
  let heeboFont: any;
  try {
    const fontBytes = await fetchHeeboFont();
    heeboFont = await pdfDoc.embedFont(fontBytes);
  } catch (fontErr) {
    console.warn('[pdf-generator] Failed to load Heebo font, falling back to Helvetica:', fontErr);
    heeboFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const maxTextWidth = PAGE_W - TEXT_MARGIN_X * 2;

  for (const bookPage of pages) {
    const pdfPage = pdfDoc.addPage([PAGE_W, PAGE_H]);

    // 1. Draw background image (full-bleed)
    if (bookPage.imageUrl) {
      try {
        const imgBuf = await fetchImageAsJpeg(bookPage.imageUrl);
        const img = await pdfDoc.embedJpg(imgBuf);
        pdfPage.drawImage(img, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      } catch (imgErr) {
        console.warn(`[pdf-generator] Image fetch failed for page ${bookPage.pageNumber}:`, imgErr);
        // Draw fallback background
        pdfPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.91, 0.86, 0.78) });
      }
    } else {
      pdfPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.91, 0.86, 0.78) });
    }

    // 2. Draw text overlay
    const text = bookPage.isCover ? params.title : (bookPage.text || '').replace(/\s+/g, ' ').trim();
    if (text) {
      const fontSize = bookPage.isCover ? 28 : TEXT_FONT_SIZE;
      const lineHeight = bookPage.isCover ? 40 : TEXT_LINE_HEIGHT;
      const lines = wrapText(text, maxTextWidth, heeboFont, fontSize);

      // pdf-lib y=0 is BOTTOM. Top of page = PAGE_H.
      // For cover: center vertically
      // For story pages: text at top
      let startY: number;
      if (bookPage.isCover) {
        const totalTextHeight = lines.length * lineHeight;
        startY = PAGE_H / 2 + totalTextHeight / 2;
      } else {
        startY = PAGE_H - TEXT_MARGIN_TOP - fontSize;
      }

      for (let i = 0; i < lines.length; i++) {
        const lineWidth = heeboFont.widthOfTextAtSize(lines[i], fontSize);
        // Center horizontally
        const x = (PAGE_W - lineWidth) / 2;
        const y = startY - i * lineHeight;

        // Draw stroke (background outline for readability)
        // pdf-lib doesn't support stroke on text easily, so we skip the stroke
        // The images already have a light text zone at top

        pdfPage.drawText(lines[i], {
          x,
          y,
          size: fontSize,
          font: heeboFont,
          color: TEXT_COLOR,
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
```

### Important Notes

1. **fontkit compatibility**: pdf-lib needs fontkit to embed custom fonts. There are multiple packages:
   - `fontkit` (original, may have ESM issues)
   - `@pdf-lib/fontkit` (pdf-lib's own fork, recommended)
   
   Use `@pdf-lib/fontkit`:
   ```bash
   npm install pdf-lib @pdf-lib/fontkit
   ```
   Import as: `import fontkit from '@pdf-lib/fontkit';`

2. **Hebrew text direction**: pdf-lib draws text left-to-right by default. Hebrew characters will render correctly (they have built-in directionality in Unicode), but the LINE as a whole needs to be positioned right-to-left. The `wrapText` + center alignment approach handles this — each line is centered, so directionality doesn't matter for positioning.

3. **Font caching**: The Heebo font is fetched from Google Fonts on every PDF generation. For production, consider caching the font file locally (bundle it in the repo as `assets/fonts/Heebo-Bold.woff2`). This avoids a network call and is more reliable.

4. **Image quality**: We resize to 2x page dimensions (1224×1224) for sharp print quality, then JPEG compress at 85%.

### Files to Modify

- `backend/lib/pdf-generator.ts` — **full rewrite** (replace Puppeteer with pdf-lib)
- `package.json` — add `pdf-lib` + `@pdf-lib/fontkit`, remove `@sparticuz/chromium` + `puppeteer-core`

### Files NOT to Modify

- `backend/lib/pdf-storage.ts` — no changes needed, it just uploads the buffer
- `app/api/generate/route.ts` — no changes needed, it calls `generateBookPdf()` which returns a Buffer
- `public/JS/ready.js` — no changes needed, the button logic is correct (shows when pdfUrl exists)

### Testing

1. Generate a book with PDF addon enabled
2. Check Vercel logs — should NOT see "PDF generation failed"  
3. Ready page should show the "קובץ מוכן להדפסה" download button
4. Download the PDF — verify:
   - Square format (8.5" × 8.5")
   - Full-bleed images
   - Hebrew text readable at top of each page
   - Cover page has title centered

### Cleanup After Verification

Remove from `package.json`:
- `@sparticuz/chromium`
- `puppeteer-core`

This saves ~50MB from the deployment bundle.

## Priority

**CRITICAL** — users who pay for PDF get nothing. This is a payment-breaking bug.
