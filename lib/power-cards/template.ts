import { POWER_CARD_PALETTES } from './palettes';
import { personalizePowerCardCopy } from './personalize';
import type { PowerCardRenderInput } from './types';

/**
 * Export canvas — 3:5 portrait keepsake at 300 DPI (5in × 8.333in). Taller than A5 to seat the full-body hero;
 * the physical/magnet size is finalized post-MVP.
 *
 * PARITY: the reader preview (PowerCardPreview.module.css) sizes everything in `cqw` (1cqw = 1% of card width).
 * The export card is a FIXED 1500px, so `u(x)` here emits the identical value as `x cqw` at 1500px (x × 15px) —
 * same proportions, but as plain px. We deliberately do NOT use container queries in the export: headless Chrome
 * fails to PAINT container-query layout at this canvas size (the card renders blank), even though it lays out
 * correctly. Plain px paints reliably for both the PNG screenshot and the PDF.
 */
/** Final rasterized export size (PNG). */
export const POWER_CARD_EXPORT_WIDTH_PX = 1500;
export const POWER_CARD_EXPORT_HEIGHT_PX = 2500;
/**
 * The card is LAID OUT at a small CSS size (below) and rasterized UP via deviceScaleFactor (see render.ts).
 * Headless Chrome fails to PAINT a viewport-filling element at 1500px — it lays out correctly but the screenshot
 * comes back blank — whereas a small layout paints reliably. deviceScaleFactor then yields the crisp 1500×2500
 * output. (This is the standard high-DPI export pattern, not a workaround for our CSS.)
 */
export const POWER_CARD_CARD_WIDTH_PX = 375;
export const POWER_CARD_CARD_HEIGHT_PX = (POWER_CARD_CARD_WIDTH_PX * 5) / 3; // 3:5 → 625
export const POWER_CARD_EXPORT_SCALE = POWER_CARD_EXPORT_WIDTH_PX / POWER_CARD_CARD_WIDTH_PX; // 4 → deviceScaleFactor → exactly 1500×2500

/** cqw → px at the CARD layout width (keeps the export byte-proportional to the `cqw` preview). */
function u(cqw: number): string {
  return `${((cqw * POWER_CARD_CARD_WIDTH_PX) / 100).toFixed(1)}px`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absolutizeAssetUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = baseUrl.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function buildPowerCardHtml(
  input: PowerCardRenderInput,
  options?: { absoluteBaseUrl?: string }
): string {
  const copy = personalizePowerCardCopy(input);
  const p = POWER_CARD_PALETTES[input.palette];
  const heroUrl = options?.absoluteBaseUrl
    ? absolutizeAssetUrl(input.companionHeroUrl, options.absoluteBaseUrl)
    : input.companionHeroUrl;

  const bookTitleHtml = input.bookTitle
    ? `<span> · ${escapeHtml(input.bookTitle)}</span>`
    : '';

  const stepsHtml = copy.steps
    .map(
      (step, index) => `
        <li class="step-row">
          <span class="step-num">${index + 1}</span>
          <span class="step-text">${escapeHtml(step)}</span>
        </li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${POWER_CARD_CARD_WIDTH_PX}px;
      height: ${POWER_CARD_CARD_HEIGHT_PX}px;
      background: ${p.bg};
    }
    .card {
      position: relative;
      width: ${POWER_CARD_CARD_WIDTH_PX}px;
      height: ${POWER_CARD_CARD_HEIGHT_PX}px;
      border-radius: ${u(7.8)};
      background: ${p.bgGradient};
      color: ${p.textPrimary};
      font-family: 'Heebo', sans-serif;
      direction: rtl;
      overflow: hidden;
      display: flex;
    }
    .card::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(120% 55% at 50% 0%, rgba(255,255,255,0.5), transparent 55%);
    }
    .inner {
      position: relative; z-index: 1; flex: 1; min-height: 0;
      display: flex; flex-direction: column;
      padding: ${u(4.7)} ${u(5.7)} ${u(4.2)};
    }
    .brand {
      flex: 0 0 auto; text-align: center;
      font-size: ${u(2.86)}; font-weight: 500; letter-spacing: 0.04em; color: ${p.textSecondary};
    }
    .brand-mark { color: ${p.accent}; font-weight: 700; }
    .hero {
      position: relative; flex: 1 1 auto; min-height: 0;
      margin: ${u(2.6)} 0 ${u(1.6)}; display: flex; justify-content: center;
    }
    .hero-glow {
      position: absolute; inset: 3% 12%; z-index: 0;
      background: radial-gradient(50% 46% at 50% 46%, color-mix(in srgb, ${p.accent} 26%, transparent), transparent 72%);
    }
    .hero-frame {
      position: relative; z-index: 1;
      height: 100%; aspect-ratio: 1024 / 1536; max-width: 100%;
      border-radius: ${u(5.7)}; background: ${p.frame};
      box-shadow: inset 0 0 0 ${u(0.27)} rgba(136,108,255,0.14), 0 ${u(2.6)} ${u(6.8)} -${u(3.1)} rgba(60,40,110,0.4);
      overflow: hidden;
    }
    .hero-img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .hero-frame::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,0.26), transparent 28%);
    }
    .nameplate {
      position: absolute; z-index: 2; bottom: -${u(2.9)}; left: 50%; transform: translateX(-50%);
      background: ${p.accent}; color: ${input.palette === 'magical-cool' ? '#1e1b4b' : '#fff'};
      font-size: ${u(3.1)}; font-weight: 700; letter-spacing: 0.02em;
      padding: ${u(1.3)} ${u(3.9)}; border-radius: 999px;
      box-shadow: 0 ${u(2.1)} ${u(4.7)} -${u(1.6)} color-mix(in srgb, ${p.accent} 60%, transparent);
      white-space: nowrap;
    }
    .titles { flex: 0 0 auto; text-align: center; margin-top: ${u(3.9)}; }
    .card-title { font-size: ${u(5.7)}; font-weight: 700; line-height: 1.16; letter-spacing: -0.01em; color: ${p.textPrimary}; text-wrap: balance; }
    .card-subtitle { margin-top: ${u(1.3)}; font-size: ${u(3.5)}; font-weight: 400; color: ${p.textSecondary}; }
    .ritual { flex: 0 0 auto; display: flex; flex-direction: column; gap: ${u(1.8)}; margin-top: ${u(3.7)}; }
    .ritual-label { font-size: ${u(2.6)}; font-weight: 700; letter-spacing: 0.12em; color: ${p.accent}; text-align: center; text-transform: uppercase; }
    .steps { list-style: none; display: flex; flex-direction: column; gap: ${u(1.6)}; }
    .step-row { display: flex; align-items: center; gap: ${u(2.9)}; text-align: right; }
    .step-num {
      flex: 0 0 auto; width: ${u(6)}; height: ${u(6)}; border-radius: 50%;
      display: grid; place-items: center;
      background: color-mix(in srgb, ${p.accent} 13%, transparent);
      color: ${p.accent}; font-size: ${u(3.26)}; font-weight: 700;
    }
    .step-text { flex: 1 1 auto; font-size: ${u(3.5)}; font-weight: 500; line-height: 1.25; color: ${p.textPrimary}; }
    .reminder {
      flex: 0 0 auto; margin-top: ${u(3.1)}; text-align: center;
      background: color-mix(in srgb, ${p.accent} 8%, transparent);
      border: 1px solid color-mix(in srgb, ${p.accent} 18%, transparent);
      border-radius: ${u(3.9)}; padding: ${u(2.3)} ${u(3.7)};
    }
    .reminder-quote { font-size: ${u(3.4)}; font-weight: 500; font-style: italic; line-height: 1.35; color: ${p.textPrimary}; }
    .reminder-by { margin-top: ${u(1)}; font-size: ${u(2.86)}; font-weight: 700; color: ${p.accent}; }
  </style>
</head>
<body>
  <article class="card">
    <div class="inner">
      <header class="brand"><span class="brand-mark">גיבורים קטנים</span>${bookTitleHtml}</header>
      <section class="hero">
        <div class="hero-glow"></div>
        <div class="hero-frame"><img class="hero-img" src="${escapeHtml(heroUrl)}" alt="" /></div>
        <span class="nameplate">${escapeHtml(input.companionName)}</span>
      </section>
      <section class="titles">
        <h2 class="card-title">${escapeHtml(copy.title)}</h2>
        <p class="card-subtitle">${escapeHtml(copy.subtitle)}</p>
      </section>
      <section class="ritual">
        <div class="ritual-label">הריטואל · ארבעה צעדים</div>
        <ol class="steps">${stepsHtml}</ol>
      </section>
      <section class="reminder">
        <p class="reminder-quote">&ldquo;${escapeHtml(copy.companionReminder)}&rdquo;</p>
        <p class="reminder-by">— ${escapeHtml(input.companionName)}</p>
      </section>
    </div>
  </article>
</body>
</html>`;
}
