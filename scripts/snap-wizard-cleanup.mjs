import puppeteer from 'puppeteer-core';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetDir = path.join(root, 'ai-roundtable/assets/wizard-mobile-cleanup');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

async function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('Chrome executable not found — set CHROME_PATH');
}

const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:3000';
const HANDOFF = `${baseUrl}/wizard?category=NIGHT_FEAR&direction=bedtime`;

async function waitForWizardReady(page) {
  await page.waitForFunction(() => !document.body.classList.contains('wizard-booting'), {
    timeout: 90000,
  });
  await page.waitForSelector('.step.active', { timeout: 30000 });
}

/** Session `step` field is passed through migrateLegacyWizardStep on restore. */
const SNAPSHOT_STEP_BY_PHYSICAL = {
  3: 3,
  4: 5,
  5: 7,
  6: 8,
  7: 9,
  8: 6,
  9: 10,
};

async function seedWizardStep(page, physicalStep) {
  const snapshotStep = SNAPSHOT_STEP_BY_PHYSICAL[physicalStep] ?? physicalStep;
  await page.evaluate((step, snapStep) => {
    const key = 'wizard_state';
    const raw = sessionStorage.getItem(key);
    const snap = raw
      ? JSON.parse(raw)
      : {
          step: 3,
          state: {},
          timestamp: Date.now(),
          meta: {},
        };
    snap.step = snapStep;
    snap.timestamp = Date.now();
    const s = snap.state;
    s.currentStep = step;
    s.childName = s.childName || 'נועם';
    s.childAge = s.childAge || '5';
    s.childGender = s.childGender || 'boy';
    s.style = 'soft_hand_drawn_storybook';
    s.styleSelected = true;
    s.voice = s.voice || 'mom';
    s.bookName = s.bookName || 'ההרפתקה של נועם';
    s.productId = s.productId || 'bedtime';
    s.storyDirection = s.storyDirection || 'bedtime';
    s.dedication = s.dedication || '';
    s.topic = s.topic || 'night';
    s.challengeCategory = s.challengeCategory || 'NIGHT_FEAR';
    s.directionLockedFromStart = true;
    sessionStorage.setItem(key, JSON.stringify(snap));
  }, physicalStep, snapshotStep);
}

async function bootstrapWizardSession(page) {
  await page.goto(HANDOFF, { waitUntil: 'networkidle2', timeout: 90000 });
  await waitForWizardReady(page);
  const snap = await page.evaluate(() => sessionStorage.getItem('wizard_state'));
  await page.goto(`${baseUrl}/wizard`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate((raw) => {
    if (raw) sessionStorage.setItem('wizard_state', raw);
  }, snap);
  await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
  await waitForWizardReady(page);
}

async function snapWizard({ step, outPath, viewport, bootstrappedPage = null }) {
  const browser = bootstrappedPage
    ? null
    : await puppeteer.launch({
        executablePath: await resolveChrome(),
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
  const page = bootstrappedPage || (await browser.newPage());
  try {
    if (!bootstrappedPage) {
      await page.setViewport(viewport);
      await bootstrapWizardSession(page);
    }
    if (step !== 3) {
      await seedWizardStep(page, step);
      await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
      await waitForWizardReady(page);
    }
    await page.waitForSelector(`#step-${step}.active`, { timeout: 30000 });
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('wrote', outPath);
    return page;
  } finally {
    if (browser) await browser.close();
  }
}

await mkdir(assetDir, { recursive: true });

const mobile = { width: 390, height: 844, deviceScaleFactor: 2 };
const desktop = { width: 1280, height: 900, deviceScaleFactor: 1 };

const browser = await puppeteer.launch({
  executablePath: await resolveChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  let page = await browser.newPage();
  await page.setViewport(mobile);
  await bootstrapWizardSession(page);

  for (const [step, file, vp] of [
    [3, 'wizard-step3-mobile.png', mobile],
    [4, 'wizard-step4-mobile.png', mobile],
    [5, 'wizard-step5-mobile.png', mobile],
    [8, 'wizard-step8-desktop.png', desktop],
    [9, 'wizard-summary-desktop.png', desktop],
    [9, 'wizard-summary-mobile.png', mobile],
  ]) {
    if (vp !== mobile) await page.setViewport(vp);
    if (step !== 3) {
      await seedWizardStep(page, step);
      await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
      await waitForWizardReady(page);
    }
    await page.waitForSelector(`#step-${step}.active`, { timeout: 30000 });
    await page.screenshot({
      path: path.join(assetDir, file),
      fullPage: true,
    });
    console.log('wrote', path.join(assetDir, file));
  }
} finally {
  await browser.close();
}
