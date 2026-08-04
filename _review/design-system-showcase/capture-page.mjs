/**
 * Reliable long-page capture: viewport tiles stitched with sharp
 * (Chrome fullPage stitching breaks past ~16384px).
 * Usage: node capture-page.mjs <width> <outfile>
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const width = Number(process.argv[2] || 1440);
const out = process.argv[3] || `capture-${width}.png`;
const VH = 900;

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const pg = await b.newPage();
await pg.setViewport({ width, height: VH, deviceScaleFactor: 1 });
await pg.goto('file:///C:/GNart/Work/Small_Heroes/_review/design-system-showcase/index.html', { waitUntil: 'networkidle0' });

// neutralize sticky/scroll behaviors + reveal everything for a clean stitch
await pg.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  const bar = document.querySelector('.topbar');
  if (bar) bar.style.position = 'static';
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));
});

const total = await pg.evaluate(() => document.documentElement.scrollHeight);
const tiles = [];
for (let y = 0; y < total; y += VH) {
  await pg.evaluate((yy) => window.scrollTo(0, yy), y);
  await new Promise((r) => setTimeout(r, 130));
  const actualY = await pg.evaluate(() => window.scrollY);
  const buf = await pg.screenshot({ type: 'png' });
  tiles.push({ buf, y: actualY });
}
await b.close();

// compose: last tile may overlap (page end) — position by actual scrollY
const canvas = sharp({ create: { width, height: total, channels: 3, background: '#ffffff' } });
const layers = tiles.map((t) => ({ input: t.buf, top: Math.round(t.y), left: 0 }));
await canvas.composite(layers).png({ compressionLevel: 9 }).toFile(out);
console.log('stitched', out, width + 'x' + total, 'from', tiles.length, 'tiles');
