/**
 * Print-ready PDF — bleed, safe margins, embedded Heebo, trim marks (RGB/cmyk-lite).
 *
 * Separate from pdf-generator.ts (screen PDF): this version is sized for trim + bleed
 * per backend/config/print.ts.
 */

import puppeteerCore from 'puppeteer-core';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { BookPageForPdf } from './pdf-generator';
import {
  BLEED_PT,
  CONTENT_INSET_FROM_PAGE_EDGE_PT,
  FULL_PAGE_PT,
  PRINT_BODY_TEXT_COLOR,
  PRINT_FALLBACK_BG,
  PRINT_PDF_VIEWPORT_SCALE,
  PRINT_SHADOW_DARK,
  TRIM_PT,
} from '../config/print';

const IS_SERVERLESS = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

function findLocalChrome(): string | null {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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

let embeddedHeeboCache: { regularB64: string; boldB64: string } | null = null;

function loadEmbeddedHeeboFonts(): { regularB64: string; boldB64: string } {
  if (embeddedHeeboCache) return embeddedHeeboCache;

  // Try multiple candidate directories — on Vercel, process.cwd() may differ
  const candidates = [
    path.join(process.cwd(), 'backend/assets/fonts'),
    path.resolve(__dirname, '../assets/fonts'),
    path.resolve(__dirname, '../../backend/assets/fonts'),
  ];

  let regularPath = '';
  let boldPath = '';
  let found = false;

  for (const fontsDir of candidates) {
    const rp = path.join(fontsDir, 'Heebo-Regular.ttf');
    const bp = path.join(fontsDir, 'Heebo-Bold.ttf');
    if (existsSync(rp) && existsSync(bp)) {
      regularPath = rp;
      boldPath = bp;
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error(
      `Print-ready PDF requires Heebo TTF fonts at backend/assets/fonts/Heebo-Regular.ttf and Heebo-Bold.ttf. Searched: ${candidates.join(', ')}`
    );
  }

  embeddedHeeboCache = {
    regularB64: readFileSync(regularPath).toString('base64'),
    boldB64: readFileSync(boldPath).toString('base64'),
  };
  return embeddedHeeboCache;
}

/**
 * Corner crop guides: strokes sit in bleed, meeting at trim line (inside page, no negative offsets).
 */
function trimGuideElements(): string {
  const b = BLEED_PT;
  return `
<div class="trim-layer" aria-hidden="true">
  <!-- top-left -->
  <div class="trim-mark trim-mark-h" style="top:${b - 0.25}pt;left:0;width:${b}pt;height:0.5pt"></div>
  <div class="trim-mark trim-mark-v" style="top:0;left:${b - 0.25}pt;width:0.5pt;height:${b}pt"></div>
  <!-- top-right -->
  <div class="trim-mark trim-mark-h" style="top:${b - 0.25}pt;right:0;width:${b}pt;height:0.5pt"></div>
  <div class="trim-mark trim-mark-v" style="top:0;right:${b - 0.25}pt;width:0.5pt;height:${b}pt"></div>
  <!-- bottom-left -->
  <div class="trim-mark trim-mark-h" style="bottom:${b - 0.25}pt;left:0;width:${b}pt;height:0.5pt"></div>
  <div class="trim-mark trim-mark-v" style="bottom:0;left:${b - 0.25}pt;width:0.5pt;height:${b}pt"></div>
  <!-- bottom-right -->
  <div class="trim-mark trim-mark-h" style="bottom:${b - 0.25}pt;right:0;width:${b}pt;height:0.5pt"></div>
  <div class="trim-mark trim-mark-v" style="bottom:0;right:${b - 0.25}pt;width:0.5pt;height:${b}pt"></div>
</div>`;
}

function buildPrintHtml(title: string, pages: BookPageForPdf[], imageUrls?: Map<number, string>): string {
  const { regularB64, boldB64 } = loadEmbeddedHeeboFonts();
  const pageW = FULL_PAGE_PT;
  const pageH = FULL_PAGE_PT;
  const inset = CONTENT_INSET_FROM_PAGE_EDGE_PT;

  const pageBlocks = pages.map((page) => {
    const text = sanitizeText(page.text);
    const heroUrl =
      (imageUrls?.get(page.pageNumber) ?? page.imageUrl) || null;
    const bgStyle = heroUrl ? '' : `background-color:${PRINT_FALLBACK_BG};`;
    const bgImage = heroUrl
      ? `<img
           src="${heroUrl}"
           class="page-bg-img"
           onerror="this.style.display='none'; this.parentElement.style.backgroundColor='${PRINT_FALLBACK_BG}';"
           alt=""
           crossorigin="anonymous"
         />`
      : '';

    const trimLayer = trimGuideElements();

    if (page.isCover) {
      return `
        <div class="page" style="${bgStyle}">
          ${trimLayer}
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
        ${trimLayer}
        ${bgImage}
        ${textOverlay}
      </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'Heebo';
  font-weight: 400;
  font-style: normal;
  src: url(data:font/truetype;charset=utf-8;base64,${regularB64}) format('truetype');
}
@font-face {
  font-family: 'Heebo';
  font-weight: 700;
  font-style: normal;
  src: url(data:font/truetype;charset=utf-8;base64,${boldB64}) format('truetype');
}
  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: 'Heebo', 'DejaVu Sans', Arial, sans-serif;
    background: ${PRINT_FALLBACK_BG};
  }

  .page {
    width: ${pageW}pt;
    height: ${pageH}pt;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    background-color: ${PRINT_FALLBACK_BG};
  }

  .page:last-child {
    page-break-after: auto;
  }

  .trim-layer {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }

  .trim-mark {
    position: absolute;
    background: #000000;
  }

  .page-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 0;
  }

  .cover-title-wrap {
    position: absolute;
    top: 50%;
    left: ${inset}pt;
    right: ${inset}pt;
    transform: translateY(-50%);
    text-align: center;
    z-index: 1;
    padding: ${inset * 0.15}pt 0;
  }

  .cover-title {
    font-size: ${Math.min(TRIM_PT * 0.05, 38)}pt;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.35;
    direction: rtl;
    text-shadow:
      3pt 3pt 0 ${PRINT_SHADOW_DARK},
      -2pt -2pt 0 ${PRINT_SHADOW_DARK},
      2pt -2pt 0 ${PRINT_SHADOW_DARK},
      -2pt 2pt 0 ${PRINT_SHADOW_DARK},
      4pt 0 0 ${PRINT_SHADOW_DARK},
      -4pt 0 0 ${PRINT_SHADOW_DARK};
  }

  .text-overlay {
    position: absolute;
    top: ${inset}pt;
    left: ${inset}pt;
    right: ${inset}pt;
    bottom: ${inset}pt;
    z-index: 1;
    background: transparent;
    padding-top: ${inset * 0.35}pt;
  }

  .body-text {
    font-size: 13pt;
    line-height: 1.6;
    font-weight: 400;
    color: ${PRINT_BODY_TEXT_COLOR};
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

export async function generatePrintReadyPdf(params: {
  title: string;
  pages: BookPageForPdf[];
  imageUrls?: Map<number, string>;
}): Promise<Buffer> {
  const pages = [...params.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const html = buildPrintHtml(params.title, pages, params.imageUrls);

  let browser: Awaited<ReturnType<typeof puppeteerCore.launch>>;

  if (IS_SERVERLESS) {
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
    const localChrome = findLocalChrome();
    if (!localChrome) {
      throw new Error(
        'Print-ready PDF: Chrome not found locally. Install Google Chrome or set CHROME_PATH env var.'
      );
    }
    console.log(`[print-ready-generator] Using local Chrome: ${localChrome}`);
    browser = await puppeteerCore.launch({
      executablePath: process.env.CHROME_PATH || localChrome,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  try {
    const page = await browser.newPage();
    const vs = PRINT_PDF_VIEWPORT_SCALE;
    await page.setViewport({
      width: Math.ceil(FULL_PAGE_PT * vs),
      height: Math.ceil(FULL_PAGE_PT * vs),
      deviceScaleFactor: vs,
    });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120_000 });
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdfUint8 = await page.pdf({
      width: `${FULL_PAGE_PT}pt`,
      height: `${FULL_PAGE_PT}pt`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
