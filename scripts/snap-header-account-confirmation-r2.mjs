import puppeteer from 'puppeteer-core';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetDir = path.join(root, 'ai-roundtable/assets/header-account-confirmation-r2');

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
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 };

async function snap(page, file, viewport, fullPage = false) {
  await page.setViewport(viewport);
  await page.screenshot({ path: path.join(assetDir, file), fullPage });
  console.log('wrote', path.join(assetDir, file));
}

async function snapHeader(page, file, viewport) {
  await page.setViewport(viewport);
  const header = await page.$('header');
  if (!header) throw new Error('header not found');
  await header.screenshot({ path: path.join(assetDir, file) });
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
  await snapHeader(page, '01-header-logged-out-desktop.png', desktop);
  await snapHeader(page, '01-header-logged-out-mobile.png', mobile);

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => window.scrollY > 8);
  await snapHeader(page, '02-header-sticky-scrolled-desktop.png', desktop);
  await snapHeader(page, '02-header-sticky-scrolled-mobile.png', mobile);

  await page.goto(`${baseUrl}/my-books`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('header', { timeout: 60000 });
  await snap(page, '03-my-books-1440-desktop.png', desktop, true);

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('header', { timeout: 60000 });
  await page.setViewport(mobile);
  await page.evaluate(() => {
    const btn = document.querySelector('header button[aria-haspopup="menu"], header a[aria-label="התחברות"]');
    if (btn && btn.tagName === 'BUTTON') btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await snap(page, '04-mobile-account-circle.png', mobile, false);

  await page.goto(`${baseUrl}/generating?orderId=demo-order`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('header', { timeout: 60000 });
  await snapHeader(page, '05-generating-compact-header-mobile.png', mobile);
} finally {
  await browser.close();
}
