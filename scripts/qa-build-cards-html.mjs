/**
 * Fetches /api/categories/branch + /api/debug/direction-drafts (dev) and writes public/qa-capture/cards.html
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.QA_BASE || 'http://localhost:3000';

const SUMMARY_MAX_CHARS = 116;
function compactSummary(summary) {
  const raw = (summary || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const firstSentence = raw.split(/[.!?]\s/)[0].trim() || raw;
  const sentencePreferred = firstSentence.length >= 36 ? firstSentence : raw;
  let candidate = sentencePreferred;
  if (candidate.length > SUMMARY_MAX_CHARS) {
    const commaCut = candidate.split(/[,:;]/)[0].trim();
    if (commaCut.length >= 30) candidate = commaCut;
  }
  if (candidate.length > SUMMARY_MAX_CHARS) {
    const clipped = candidate.slice(0, SUMMARY_MAX_CHARS);
    const cutAt = clipped.lastIndexOf(' ');
    candidate = (cutAt > 58 ? clipped.slice(0, cutAt) : clipped).trim();
  }
  return candidate.replace(/[,:;.\-–—\s]+$/, '');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function load() {
  const [nightB, nightD, angerB, angerD] = await Promise.all([
    fetch(`${base}/api/categories/branch?category=NIGHT_FEAR`).then((r) => r.json()),
    fetch(`${base}/api/debug/direction-drafts?category=NIGHT_FEAR&topicLabel=${encodeURIComponent('פחד בלילה')}`).then((r) => r.json()),
    fetch(`${base}/api/categories/branch?category=ANGER_FRUSTRATION`).then((r) => r.json()),
    fetch(`${base}/api/debug/direction-drafts?category=ANGER_FRUSTRATION&topicLabel=${encodeURIComponent('כעס')}`).then((r) => r.json()),
  ]);

  if (nightB.error) throw new Error('branch night: ' + JSON.stringify(nightB));
  if (angerB.error) throw new Error('branch anger: ' + JSON.stringify(angerB));
  if (nightD.error) throw new Error('drafts night: ' + JSON.stringify(nightD));
  if (angerD.error) throw new Error('drafts anger: ' + JSON.stringify(angerD));

  return { nightB, nightD, angerB, angerD };
}

const placeImg =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#e8e4df" width="100%" height="100%"/><text x="200" y="150" text-anchor="middle" fill="#666" font-family="system-ui" font-size="16">מקום לתצוגה מקדימה</text></svg>`
  );

function cardHtml({ categoryHe, tagHe, title, cardSummary, anchorHe }) {
  return `<article class="direction-card" style="max-width:380px">
  <img class="direction-card-image" src="${placeImg}" alt="" width="400" height="300" />
  <div class="direction-card-body">
    <div class="direction-card-tag">${esc(categoryHe)} · ${esc(tagHe)}</div>
    <h3 class="direction-card-title">${esc(title)}</h3>
    <p class="direction-card-summary">${esc(cardSummary)}</p>
    <p class="qa-anchor" style="font-size:0.8rem;opacity:0.85;margin-top:0.5rem;color:#444;">עוגן (לא במוצר—לבדיקה): ${esc(anchorHe)}</p>
    <button type="button" class="btn-outline direction-card-cta" disabled>לבחירה</button>
  </div>
</article>`;
}

const flavorOrder = ['connection', 'adventure', 'courage'];
const labelHe = { connection: 'חיבור', adventure: 'הרפתקה', courage: 'אומץ' };

function section(categoryHe, branchJson, draftsJson) {
  const byFlavor = new Map(
    branchJson.storyDirectionSummaries.map((s) => [s.flavor, s])
  );
  const drows = (draftsJson.drafts || []).sort(
    (a, b) => flavorOrder.indexOf(a.archetype) - flavorOrder.indexOf(b.archetype)
  );
  const cards = drows
    .map((d) => {
      const b = byFlavor.get(d.archetype) || {};
      const cardSummary = compactSummary(d.summary);
      return cardHtml({
        categoryHe,
        tagHe: `כיוון ${labelHe[d.archetype] || d.archetype}`,
        title: d.title,
        cardSummary,
        anchorHe: b.realWorldAnchor || '(חסר)',
      });
    })
    .join('\n');
  return `<section class="qa-block"><h2 class="qa-h2">${esc(categoryHe)}</h2>
  <div class="directions-grid" style="display:flex;flex-wrap:wrap;gap:1.25rem;justify-content:center;align-items:stretch;">${cards}</div></section>`;
}

const data = await load();
const { nightB, nightD, angerB, angerD } = data;

// Console: premise flags (from live drafts)
function logPremise(name, djson) {
  console.log(`\n── ${name} (storyPremise substrings) ──`);
  for (const d of djson.drafts || []) {
    const p = d.storyPremise || '';
    console.log(
      d.archetype,
      'TREATMENT_ENGINE',
      p.includes('TREATMENT_ENGINE:'),
      'REQUIRED_OUTCOME',
      p.includes('REQUIRED_OUTCOME:'),
      'FORBIDDEN',
      p.includes('FORBIDDEN_PLOT_DRIVERS:'),
      'REAL_WORLD_ANCHOR',
      p.includes('REAL_WORLD_ANCHOR')
    );
  }
}
logPremise('NIGHT', nightD);
logPremise('ANGER', angerD);

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>בדיקת כרטיסי כיוון — נתונים חיים</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/CSS/main.css" />
  <link rel="stylesheet" href="/CSS/directions.css" />
  <style>
    .qa-h2 { font-size: 1.15rem; text-align: center; margin: 2rem 0 1rem; }
    .qa-block { margin-bottom: 2.5rem; }
    .directions-hero h1 { text-align: center; font-size: 1.4rem; max-width: 40rem; margin: 0 auto; }
    .qa-note { max-width: 48rem; margin: 1rem auto 0; padding: 0.75rem 1rem; background: #f0ebe4; border-radius: 8px; font-size: 0.88rem; line-height: 1.4; }
    .qa-anchor { line-height: 1.3; }
  </style>
</head>
<body>
  <main class="directions-main">
    <div class="directions-wrap">
      <section class="directions-hero">
        <h1>כרטיסי כיוון — נלקחו מהשרת (${esc(base)})</h1>
        <p>סיכומים כמו <code>directions.js</code> (עד 116 תווים). שורת העוגן — רק לבדיקת QA (לא בכרטיס אמיתי).</p>
      </section>
      <p class="qa-note">מקור: <code>/api/debug/direction-drafts</code> (רק dev) + <code>/api/categories/branch</code> לעוגנים. &quot;תמונה&quot; היא placeholder.</p>
      ${section('פחדים בלילה (NIGHT_FEAR) — buildDirectionDrafts + compactSummary', nightB, nightD)}
      ${section('כעס ותסכול (ANGER_FRUSTRATION)', angerB, angerD)}
    </div>
  </main>
</body>
</html>`;

const outDir = path.join(__dirname, '..', 'public', 'qa-capture');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'cards.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out);
