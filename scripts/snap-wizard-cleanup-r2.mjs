import puppeteer from 'puppeteer-core';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetDir = path.join(root, 'ai-roundtable/assets/wizard-mobile-cleanup-r2');

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
const HANDOFF = `${baseUrl}/wizard?category=NIGHT_FEAR`;

const SNAPSHOT_STEP_BY_PHYSICAL = {
  3: 3,
  4: 5,
  5: 7,
  6: 8,
  7: 9,
  8: 6,
  9: 10,
};

async function waitForWizardReady(page) {
  await page.waitForFunction(() => !document.body.classList.contains('wizard-booting'), {
    timeout: 120000,
  });
  await page.waitForSelector('.step.active', { timeout: 60000 });
}

async function seedWizardStep(page, physicalStep) {
  const snapshotStep = SNAPSHOT_STEP_BY_PHYSICAL[physicalStep] ?? physicalStep;
  await page.evaluate(
    (step, snapStep) => {
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
      s.dedication = s.dedication || '';
      s.topic = s.topic || 'night';
      s.challengeCategory = s.challengeCategory || 'NIGHT_FEAR';
      s.directionLockedFromStart = false;
      if (step === 8 || step === 9) {
        s.productId = 'bedtime';
        s.storyDirection = 'bedtime';
      } else {
        s.productId = null;
        s.storyDirection = null;
      }
      sessionStorage.setItem(key, JSON.stringify(snap));
    },
    physicalStep,
    snapshotStep,
  );
}

async function bootstrapWizardSession(page) {
  await page.goto(HANDOFF, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForWizardReady(page);
  const snap = await page.evaluate(() => sessionStorage.getItem('wizard_state'));
  await page.goto(`${baseUrl}/wizard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate((raw) => {
    if (raw) sessionStorage.setItem('wizard_state', raw);
  }, snap);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForWizardReady(page);
}

async function snapPage(page, file, viewport) {
  await page.setViewport(viewport);
  await page.screenshot({
    path: path.join(assetDir, file),
    fullPage: true,
  });
  console.log('wrote', path.join(assetDir, file));
}

async function snapElement(page, selector, file, viewport) {
  await page.setViewport(viewport);
  const el = await page.waitForSelector(selector, { timeout: 30000 });
  await el.screenshot({ path: path.join(assetDir, file) });
  console.log('wrote', path.join(assetDir, file));
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
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/start`, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForSelector('.mvp-challenge-grid', { timeout: 60000 });
  await snapPage(page, '01-start-challenge-only-desktop.png', desktop);
  await snapPage(page, '01-start-challenge-only-mobile.png', mobile);

  await bootstrapWizardSession(page);

  const shots = [
    [3, '02-child-fields-mobile.png', mobile, '#step-3'],
    [4, '03-traits-chips-mobile.png', mobile, '#step-4'],
    [6, '04-voice-grid-mobile.png', mobile, '#step-6'],
    [8, '05-experience-step-mobile.png', mobile, '#step-8'],
    [8, '05-experience-step-desktop.png', desktop, '#step-8'],
    [8, '06-power-card-tips-mobile.png', mobile, '.wizard-tips-card'],
    [8, '06-power-card-tips-desktop.png', desktop, '.wizard-tips-card'],
  ];

  for (const [step, file, viewport, selector] of shots) {
    if (step !== 3) {
      await seedWizardStep(page, step);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitForWizardReady(page);
    }
    await page.waitForSelector(`#step-${step}.active`, { timeout: 60000 });
    if (selector.startsWith('#step')) {
      await snapPage(page, file, viewport);
    } else {
      await snapElement(page, selector, file, viewport);
    }
  }
} finally {
  await browser.close();
}
