/**
 * Showcase asset pipeline — copies + optimizes real product imagery and
 * verification screenshots into assets/. Rerun after design changes, then
 * refresh the "last synced" commit in index.html + assets/tokens.css.
 * Usage (from repo root): node _review/design-system-showcase/build-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = 'C:/GNart/Work/Small_Heroes';
const OUT = path.join(ROOT, '_review/design-system-showcase/assets');
fs.mkdirSync(OUT, { recursive: true });

/** [source, outName, width, quality] */
const JOBS = [
  // product art (public marketing assets)
  ['public/Images/hero-child-fox.png', 'art-hero-child-fox.webp', 760, 88],
  ['public/Images/Book.webp', 'art-book.webp', 680, 84],
  ['public/companions/fox_uri/style01-sheets/front.png', 'companion-uri.webp', 380, 86],
  ['public/companions/panda_anat/style01-sheets/front.png', 'companion-anat.webp', 380, 86],
  ['public/Images/Categories/StartUri.webp', 'category-uri.webp', 440, 84],
  ['public/Images/Categories/StartAnat.webp', 'category-anat.webp', 440, 84],
  ['public/Images/Categories/StartLeo.webp', 'category-leo.webp', 440, 84],
  ['public/Images/gallery/gallery-1.jpg', 'gallery-1.webp', 560, 82],
  ['public/Images/gallery/gallery-2.jpg', 'gallery-2.webp', 560, 82],
  ['public/Images/gallery/gallery-3.jpg', 'gallery-3.webp', 560, 82],

  // flow screenshots (verification captures, demo data only)
  ['_review/design-refresh/final/home--1440.png', 'flow-home.webp', 900, 80],
  ['_review/design-refresh/after-p3/hero-viewport-1440.png', 'flow-home-hero.webp', 900, 82],
  ['_review/design-refresh/final/start--1440.png', 'flow-start.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step3-child-filled--1440.png', 'flow-child.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step4-notes-selected--1440.png', 'flow-notes.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step5-style-selected--1440.png', 'flow-style.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/voice-fixed--1440.png', 'flow-voice.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step7-book-filled--1440.png', 'flow-name.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step8-product-selected--1440.png', 'flow-package.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step9-summary--1440.png', 'flow-review.webp', 900, 80],

  // mobile screenshots
  ['_review/design-refresh/final/home--390.png', 'mobile-home.webp', 390, 78],
  ['_review/design-refresh/after-p4/wizard/step3-child-filled--390.png', 'mobile-child.webp', 390, 80],
  ['_review/design-refresh/after-p4/wizard/voice-fixed--390.png', 'mobile-voice.webp', 390, 80],
  ['_review/design-refresh/after-p4/wizard/step8-product-selected--390.png', 'mobile-package.webp', 390, 80],
  ['_review/design-refresh/final/wizard-steps/step8-product-selected--768.png', 'tablet-package.webp', 700, 80],

  // before / after evidence (same viewport, comparable states)
  ['_review/design-refresh/baseline/wizard/step8-product-selected--1440.png', 'before-package.webp', 900, 80],
  ['_review/design-refresh/baseline/wizard/step3-child-validation--1440.png', 'before-validation.webp', 900, 80],
  ['_review/design-refresh/after-p4/wizard/step3-child-validation--1440.png', 'after-validation.webp', 900, 80],
  ['_review/design-refresh/baseline/wizard/step9-summary--1440.png', 'before-review.webp', 900, 80],
  ['_review/design-refresh/baseline/home--1440.png', 'before-home.webp', 900, 78],
];

let ok = 0;
for (const [src, name, width, quality] of JOBS) {
  const from = path.join(ROOT, src);
  if (!fs.existsSync(from)) {
    console.log('MISSING:', src);
    continue;
  }
  try {
    const img = sharp(from).resize({ width, withoutEnlargement: true });
    await img.webp({ quality }).toFile(path.join(OUT, name));
    ok++;
  } catch (e) {
    console.log('FAIL:', src, String(e).slice(0, 80));
  }
}
console.log(`done: ${ok}/${JOBS.length}`);
const total = fs.readdirSync(OUT).filter((f) => f.endsWith('.webp')).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log('total webp bytes:', Math.round(total / 1024), 'KB');
