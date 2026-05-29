import { POWER_CARD_PALETTES } from './palettes';
import { personalizePowerCardCopy } from './personalize';
import type { PowerCardRenderInput } from './types';

/** A5 portrait at 300 DPI — matches brief export spec. */
export const POWER_CARD_EXPORT_WIDTH_PX = 1748;
export const POWER_CARD_EXPORT_HEIGHT_PX = 2480;

const EXPORT_SCALE = POWER_CARD_EXPORT_WIDTH_PX / 320;

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
  const palette = POWER_CARD_PALETTES[input.palette];
  const avatarUrl = options?.absoluteBaseUrl
    ? absolutizeAssetUrl(input.companionAvatarUrl, options.absoluteBaseUrl)
    : input.companionAvatarUrl;

  const s = EXPORT_SCALE;
  const bookTitleHtml = input.bookTitle
    ? `<span aria-hidden="true">·</span><span>${escapeHtml(input.bookTitle)}</span>`
    : '';

  const stepsHtml = copy.steps
    .map(
      (step, index) => `
        <li class="step-row">
          <span class="step-number">${index + 1}.</span>
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
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${POWER_CARD_EXPORT_WIDTH_PX}px;
      height: ${POWER_CARD_EXPORT_HEIGHT_PX}px;
      margin: 0;
      background: ${palette.bg};
    }
    .card {
      width: ${POWER_CARD_EXPORT_WIDTH_PX}px;
      height: ${POWER_CARD_EXPORT_HEIGHT_PX}px;
      background: ${palette.bgGradient};
      color: ${palette.textPrimary};
      font-family: 'Heebo', sans-serif;
      direction: rtl;
      text-align: center;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: ${Math.round(10 * s)}px ${Math.round(20 * s)}px ${Math.round(12 * s)}px;
    }
    .header {
      flex: 0 0 auto;
      min-height: ${Math.round(22 * s)}px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35em;
      font-size: ${Math.round(11 * s)}px;
      font-weight: 500;
      color: ${palette.textSecondary};
    }
    .brand-mark { color: ${palette.accent}; font-weight: 600; }
    .title-section {
      flex: 0 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${Math.round(8 * s)}px;
      max-height: 25%;
      padding: ${Math.round(12 * s)}px 0 ${Math.round(6 * s)}px;
    }
    .avatar-wrap {
      width: ${Math.round(70 * s)}px;
      height: ${Math.round(70 * s)}px;
      border-radius: 50%;
      padding: ${Math.round(3 * s)}px;
      background: linear-gradient(145deg, ${palette.accent}, transparent 70%);
      box-shadow: 0 0 ${Math.round(20 * s)}px ${palette.borderGlow};
    }
    .avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      background: ${palette.bg};
    }
    .card-title {
      font-size: ${Math.round(16 * s)}px;
      font-weight: 600;
      line-height: 1.2;
      color: ${palette.textPrimary};
    }
    .card-subtitle {
      font-size: ${Math.round(11 * s)}px;
      font-weight: 400;
      line-height: 1.28;
      color: ${palette.textSecondary};
    }
    .steps {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: ${Math.round(6 * s)}px;
      list-style: none;
      text-align: right;
      margin: 0;
      padding: ${Math.round(4 * s)}px 0;
    }
    .step-row {
      display: flex;
      align-items: flex-start;
      gap: ${Math.round(5 * s)}px;
      font-size: ${Math.round(12 * s)}px;
      line-height: 1.4;
      color: ${palette.textPrimary};
    }
    .step-number {
      flex: 0 0 auto;
      width: ${Math.round(14 * s)}px;
      font-weight: 600;
      color: ${palette.accent};
      text-align: center;
    }
    .step-text { flex: 1 1 auto; }
    .reminder-section {
      flex: 0 0 auto;
      padding-top: ${Math.round(8 * s)}px;
      font-size: ${Math.round(11 * s)}px;
      line-height: 1.4;
      color: ${palette.textSecondary};
    }
    .reminder-quote { font-style: italic; }
    .companion-attribution {
      margin-top: ${Math.round(4 * s)}px;
      font-size: ${Math.round(10 * s)}px;
      font-weight: 500;
      color: ${palette.accent};
    }
    .bottom-divider {
      width: 36%;
      max-width: ${Math.round(96 * s)}px;
      height: 1px;
      margin: ${Math.round(6 * s)}px auto 0;
      background: linear-gradient(90deg, transparent, ${palette.borderGlow} 20%, ${palette.accent} 50%, ${palette.borderGlow} 80%, transparent);
      opacity: 0.65;
    }
  </style>
</head>
<body>
  <article class="card">
    <div class="inner">
      <header class="header">
        <span class="brand-mark">גיבורים קטנים</span>
        ${bookTitleHtml}
      </header>
      <section class="title-section">
        <div class="avatar-wrap">
          <img class="avatar" src="${escapeHtml(avatarUrl)}" alt="" width="${Math.round(70 * s)}" height="${Math.round(70 * s)}" />
        </div>
        <h2 class="card-title">${escapeHtml(copy.title)}</h2>
        <p class="card-subtitle">${escapeHtml(copy.subtitle)}</p>
      </section>
      <ol class="steps">${stepsHtml}</ol>
      <section class="reminder-section">
        <p class="reminder-quote">&ldquo;${escapeHtml(copy.companionReminder)}&rdquo;</p>
        <p class="companion-attribution">— ${escapeHtml(input.companionName)}</p>
        <div class="bottom-divider" aria-hidden="true"></div>
      </section>
    </div>
  </article>
</body>
</html>`;
}
