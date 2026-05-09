/**
 * PDF Generator — Puppeteer-core + @sparticuz/chromium
 *
 * Uses headless Chromium via @sparticuz/chromium (works on Vercel/AWS Lambda)
 * to render HTML pages to PDF. Gives us perfect Hebrew/RTL text rendering,
 * proper typography, and layout that matches the web reader exactly.
 *
 * On localhost (non-Vercel), uses the locally installed Chrome browser.
 *
 * Page size: 8.5x8.5 inches (612x612pt) — square format for children's books.
 *
 * Packages required:
 *   npm install puppeteer-core @sparticuz/chromium
 *   npm uninstall puppeteer
 */

import puppeteerCore from 'puppeteer-core';
import { existsSync } from 'fs';

const IS_SERVERLESS = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

/**
 * Find Chrome/Chromium executable path for local development.
 * Returns null if not found (will fall back to @sparticuz/chromium).
 */
function findLocalChrome(): string | null {
  const candidates = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

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

/** Fallback color when an image fails to load */
const FALLBACK_BG = '#e8dcc8';

/**
 * Build a self-contained HTML document that renders all book pages.
 * Each page is a fixed-size div that maps to one PDF page.
 * Page size: 8.5x8.5 inches (612x612pt) — square children's book.
 */
function buildHtml(title: string, pages: BookPageForPdf[]): string {
  const pageWidth = 612;   // pt  (8.5 inches)
  const pageHeight = 612;  // pt  (8.5 inches)

  const pageBlocks = pages.map((page) => {
    const text = sanitizeText(page.text);

    // Image background with onerror fallback to solid color
    const bgStyle = page.imageUrl
      ? ''  // handled via <img> element for error fallback
      : `background-color: ${FALLBACK_BG};`;

    const bgImage = page.imageUrl
      ? `<img
           src="${page.imageUrl}"
           class="page-bg-img"
           onerror="this.style.display='none'; this.parentElement.style.backgroundColor='${FALLBACK_BG}';"
           alt=""
         />`
      : '';

    if (page.isCover) {
      return `
        <div class="page" style="${bgStyle}">
          ${bgImage}
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
        ${bgImage}
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
    background-color: ${FALLBACK_BG};
  }

  .page:last-child {
    page-break-after: auto;
  }

  /* Full-bleed background image as <img> for onerror fallback */
  .page-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 0;
  }

  /* ── Cover ────────────────────────── */
  .cover-title-wrap {
    position: absolute;
    top: 50%;
    left: 32pt;
    right: 32pt;
    transform: translateY(-50%);
    text-align: center;
    z-index: 1;
  }

  .cover-title {
    font-size: 32pt;
    font-weight: 700;
    color: #ffffff;
    text-shadow:
      0 2px 12px rgba(0,0,0,0.7),
      0 0 40px rgba(0,0,0,0.3);
    line-height: 1.35;
    direction: rtl;
  }

  /* ── Text overlay on story pages — top, no gradient ──── */
  .text-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 20pt 28pt 16pt;
    z-index: 1;
    background: none;
  }

  .body-text {
    font-size: 13pt;
    line-height: 1.6;
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

  let browser: Awaited<ReturnType<typeof puppeteerCore.launch>>;

  if (IS_SERVERLESS) {
    // Vercel / Lambda — use @sparticuz/chromium
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromiumMod: { default: any } = await import('@sparticuz/chromium');
    const chromium = chromiumMod.default;
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless ?? true,
    });
  } else {
    // Local development — use installed Chrome
    const localChrome = findLocalChrome();
    if (!localChrome) {
      throw new Error(
        'PDF generation: Chrome not found locally. Install Google Chrome or set CHROME_PATH env var.'
      );
    }
    console.log(`[pdf-generator] Using local Chrome: ${localChrome}`);
    browser = await puppeteerCore.launch({
      executablePath: process.env.CHROME_PATH || localChrome,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  try {
    const page = await browser.newPage();

    // Set content and wait for images + fonts to load
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Extra delay to ensure Google Fonts are fully rendered
    // (networkidle0 fires when network is quiet, but font painting can lag behind)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate PDF with exact page size (8.5x8.5 inches)
    const pdfUint8 = await page.pdf({
      width: '612pt',
      height: '612pt',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
