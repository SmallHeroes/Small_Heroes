/** Records a short webm of the live interactions (AI demo, price bar,
    validation, mini wizard, motion cards). Output: capture-interactions.webm */
import puppeteer from 'puppeteer-core';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const pg = await b.newPage();
await pg.setViewport({ width: 1280, height: 800 });
await pg.goto('file:///C:/GNart/Work/Small_Heroes/_review/design-system-showcase/index.html', { waitUntil: 'networkidle0' });

const rec = await pg.screencast({ path: 'C:/GNart/Work/Small_Heroes/_review/design-system-showcase/capture-interactions.webm' });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const show = async (sel) => {
  await pg.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'auto' }), sel);
  await pause(700);
};

// 1 · AI personalization: retype name, switch topic + direction
await show('#aiDemo');
await pg.click('#aiName', { clickCount: 3 });
await pg.type('#aiName', 'דניאל', { delay: 140 });
await pause(700);
await pg.click('input[name="aiTopic"][value="social"]');
await pause(900);
await pg.click('input[name="aiDir"][value="adventure"]');
await pause(1100);

// 2 · selection semantics: pick different cards
await show('#components .pick-grid');
const picks = await pg.$$('#components .pick-grid input[name="pick"]:not(:disabled)');
for (const p of picks) { await p.click(); await pause(650); }

// 3 · mini wizard: select option → next → back
await show('#wizardDemo');
await pg.click('#wizardDemo .wd-panel--1 .wd-opt');
await pause(500);
await pg.click('#wdNext');
await pause(800);
await pg.click('#wizardDemo .wd-panel--2 .wd-opt:nth-child(2)');
await pause(500);
await pg.click('#wdBack');
await pause(700);

// 4 · motion tokens
await show('#motion .motion-tokens');
for (const d of ['fast', 'base', 'slow', 'page']) {
  await pg.click(`[data-motion-demo="${d}"]`);
  await pause(650);
}

// 5 · validation: submit empty → error; type → clears
await show('#valDemo');
await pg.click('#valDemo .btn-primary');
await pause(1100);
await pg.type('#valName', 'נועה', { delay: 120 });
await pause(800);

// 6 · price follows choice
await show('#priceDemo');
for (const v of ['99', '59', '79']) {
  await pg.click(`input[name="sigPrice"][value="${v}"]`);
  await pause(700);
}

await rec.stop();
await b.close();
console.log('recorded capture-interactions.webm');
