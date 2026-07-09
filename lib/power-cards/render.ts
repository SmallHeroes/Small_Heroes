import 'server-only';

import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import {
  buildPowerCardHtml,
  POWER_CARD_CARD_HEIGHT_PX,
  POWER_CARD_CARD_WIDTH_PX,
  POWER_CARD_EXPORT_SCALE,
} from './template';
import type { PowerCardRenderInput } from './types';

// Lay the card out small (paints reliably) and rasterize up via deviceScaleFactor → a crisp 1500×2500 PNG.
const EXPORT_VIEWPORT = {
  width: POWER_CARD_CARD_WIDTH_PX,
  height: POWER_CARD_CARD_HEIGHT_PX,
  deviceScaleFactor: POWER_CARD_EXPORT_SCALE,
} as const;

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function launchBrowser(): Promise<Browser> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: EXPORT_VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim() ||
    (process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome');

  return puppeteer.launch({
    headless: true,
    executablePath,
    defaultViewport: EXPORT_VIEWPORT,
  });
}

export async function renderPowerCard(
  input: PowerCardRenderInput
): Promise<{ pngBuffer: Buffer; pdfBuffer: Buffer }> {
  const html = buildPowerCardHtml(input, { absoluteBaseUrl: resolveAppBaseUrl() });
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport(EXPORT_VIEWPORT);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const [pngRaw, pdfRaw] = await Promise.all([
      page.screenshot({
        // clip is in CSS px; deviceScaleFactor (EXPORT_VIEWPORT) rasterizes it up to 1500×2500.
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: POWER_CARD_CARD_WIDTH_PX,
          height: POWER_CARD_CARD_HEIGHT_PX,
        },
      }),
      page.pdf({
        // 3:5 keepsake at 300 DPI (1500×2500px = 5in × 8.333in) — matches the PNG canvas + the reader preview.
        width: '5in',
        height: '8.3333in',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    ]);

    const pngBuffer = Buffer.from(pngRaw as Uint8Array);
    const pdfBuffer = Buffer.from(pdfRaw as Uint8Array);

    if (!pngBuffer?.length || !pdfBuffer?.length) {
      throw new Error('Power Card export produced empty buffers.');
    }

    return { pngBuffer, pdfBuffer };
  } finally {
    await browser.close();
  }
}
