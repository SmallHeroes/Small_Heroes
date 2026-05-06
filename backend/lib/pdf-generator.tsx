/**
 * PDF Generator — Puppeteer-based
 *
 * Uses headless Chromium to render HTML pages to PDF.
 * This gives us perfect Hebrew/RTL text rendering, proper typography,
 * and layout that matches the web reader exactly.
 *
 * Replaces the previous @react-pdf/renderer approach which could not
 * render Hebrew text correctly (garbled characters, broken RTL).
 */

import puppeteer from 'puppeteer';

interface BookPageForPdf {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  isCover?: boolean;
}

interface GenerateBookPdfParams {
  title: string;
  pages: BookPageForPdf[];
}

function sanitizeText(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a self-contained HTML document that renders all book pages.
 * Each page is a fixed-size div that maps to one PDF page.
 * Page size: 5×7 inches (360×504pt) — standard children's book.
 */
function buildHtml(title: string, pages: BookPageForPdf[]): string {
  const pageWidth = 360;   // pt
  const pageHeight = 504;  // pt

  const pageBlocks = pages.map((page) => {
    const text = sanitizeText(page.text);
    const bgStyle = page.imageUrl
      ? `background-image: url('${page.imageUrl}'); background-size: cover; background-position: center;`
      : 'background-color: #f5f0e8;';

    if (page.isCover) {
      return `
        <div class="page" style="${bgStyle}">
          <div class="cover-title-wrap">
            <div class="cover-title">${escapeHtml(title)}</div>
          </div>
        </div>`;
    }

    const textOverlay = text
      ? `<div class="text-overlay">
           <div class="body-text">${escapeHtml(text)}</div>
         </div>`
      : '';

    return `
      <div class="page" style="${bgStyle}">
        ${textOverlay}
      </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Heebo', 'Segoe UI', Tahoma, Arial, sans-serif;
    background: white;
  }

  .page {
    width: ${pageWidth}pt;
    height: ${pageHeight}pt;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    background-color: #f5f0e8;
  }

  .page:last-child {
    page-break-after: auto;
  }

  /* ── Cover ────────────────────────── */
  .cover-title-wrap {
    position: absolute;
    top: 28pt;
    left: 20pt;
    right: 20pt;
    text-align: center;
  }

  .cover-title {
    font-size: 22pt;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
    line-height: 1.35;
    direction: rtl;
  }

  /* ── Text overlay on story pages ──── */
  .text-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 14pt 18pt 16pt;
    background: linear-gradient(
      to bottom,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0.85) 18%,
      rgba(255,255,255,0.92) 100%
    );
  }

  .body-text {
    font-size: 11pt;
    line-height: 1.55;
    color: #2a241a;
    text-align: right;
    direction: rtl;
  }
</style>
</head>
<body>
${pageBlocks}
</body>
</html>`;
}

export async function generateBookPdf(params: GenerateBookPdfParams): Promise<Buffer> {
  const pages = [...params.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const html = buildHtml(params.title, pages);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for images + fonts to load
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Generate PDF with exact page size (5×7 inches)
    const pdfUint8 = await page.pdf({
      width: '360pt',
      height: '504pt',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
