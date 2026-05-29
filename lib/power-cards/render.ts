import 'server-only';

import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import {
  buildPowerCardHtml,
  POWER_CARD_EXPORT_HEIGHT_PX,
  POWER_CARD_EXPORT_WIDTH_PX,
} from './template';
import type { PowerCardRenderInput } from './types';

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
      defaultViewport: {
        width: POWER_CARD_EXPORT_WIDTH_PX,
        height: POWER_CARD_EXPORT_HEIGHT_PX,
        deviceScaleFactor: 1,
      },
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
    defaultViewport: {
      width: POWER_CARD_EXPORT_WIDTH_PX,
      height: POWER_CARD_EXPORT_HEIGHT_PX,
      deviceScaleFactor: 1,
    },
  });
}

export async function renderPowerCard(
  input: PowerCardRenderInput
): Promise<{ pngBuffer: Buffer; pdfBuffer: Buffer }> {
  const html = buildPowerCardHtml(input, { absoluteBaseUrl: resolveAppBaseUrl() });
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: POWER_CARD_EXPORT_WIDTH_PX,
      height: POWER_CARD_EXPORT_HEIGHT_PX,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const [pngRaw, pdfRaw] = await Promise.all([
      page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: POWER_CARD_EXPORT_WIDTH_PX,
          height: POWER_CARD_EXPORT_HEIGHT_PX,
        },
      }),
      page.pdf({
        width: '148mm',
        height: '210mm',
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
