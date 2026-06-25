import puppeteer from 'puppeteer-core';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetDir = path.join(root, 'ai-roundtable/assets/header-account-confirmation');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

async function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* next */
    }
  }
  throw new Error('Chrome not found — set CHROME_PATH');
}

const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:3000';
const mobile = { width: 390, height: 844, deviceScaleFactor: 2 };
const desktop = { width: 1280, height: 900, deviceScaleFactor: 1 };

async function snap(page, file, viewport) {
  await page.setViewport(viewport);
  await page.screenshot({ path: path.join(assetDir, file), fullPage: true });
  console.log('wrote', path.join(assetDir, file));
}

await mkdir(assetDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await resolveChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('header', { timeout: 60000 });
  await snap(page, '01-landing-header-desktop.png', desktop);
  await snap(page, '01-landing-header-mobile.png', mobile);

  await page.evaluate(() => window.scrollTo(0, 400));
  await snap(page, '02-landing-header-scrolled-mobile.png', mobile);

  await page.goto(`${baseUrl}/start`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('header', { timeout: 60000 });
  await snap(page, '03-start-header-mobile.png', mobile);

  await page.goto(`${baseUrl}/generating?orderId=demo-order`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('[class*="wrap"]', { timeout: 60000 });
  await snap(page, '04-generating-confirmation-mobile.png', mobile);
  await snap(page, '04-generating-confirmation-desktop.png', desktop);
} finally {
  await browser.close();
}
