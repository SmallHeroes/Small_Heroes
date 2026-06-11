/**
 * generating.js — Small Heroes generation screen
 *
 * Polls GET /api/generate/status?orderId=<id> every 2.5 seconds and
 * drives the progress UI with real backend state.
 *
 * Standalone — does NOT import or depend on wizard.js.
 * orderId is read from the URL query string: /generating?orderId=abc123
 *
 * File: JS/generating.js
 */

const ROUTES = globalThis.SH_ROUTES || {
  home: '/',
  ready: '/ready',
};
const accessKey = new URLSearchParams(window.location.search).get('accessKey');

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const pctEl          = document.getElementById('genPct');
const barFill        = document.getElementById('genBarFill');
const barFillLabel   = document.getElementById('genBarFillLabel');
const statusEl       = document.getElementById('genStatusText');
const etaEl          = document.getElementById('genEta');
const reassureEl     = document.getElementById('genReassure');
const closeNoteEl    = document.getElementById('genCloseNote');
const floatersEl     = document.getElementById('genBarFloaters');
const errorStateEl   = document.getElementById('genErrorState');
const errorMsgEl     = document.getElementById('genErrorMsg');
const genProgressEl  = document.getElementById('genProgressArea');
const headlineTextEl = document.getElementById('genHeadlineText');
const errorTitleEl   = document.getElementById('genErrorTitle');
const errorBackEl    = document.getElementById('genErrorBack');
const navBrandEl     = document.getElementById('navBrand');
const navTaglineEl   = document.getElementById('navTagline');
const navCtaEl       = document.getElementById('navCta');

// ─── Content ──────────────────────────────────────────────────────────────────
const GEN_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — יוצרים את הספר שלכם',
  headline: 'אנחנו מתחילים ליצור עכשיו את הספר שלכם',
  statusInitial: 'אוספים את הפרטים שלכם...',
  statusCollecting: 'אוספים את הפרטים שלכם...',
  statusWriting: 'כותבים את הסיפור...',
  statusIllustrating: 'מציירים את האיורים...',
  statusAssembling: 'מרכיבים את הספר...',
  statusAlmostReady: 'כמעט מוכן...',
  etaTemplate: 'בעוד כ-{minutes} דקות',
  etaSoon: 'עוד רגע קטן',
  reassure: 'זה לוקח כמה דקות — אפשר להישאר כאן ולראות את ההתקדמות.',
  closeNote: 'אפשר לסגור את החלון, נשלח לכם אימייל כשהספר מוכן.',
  stallMessage: 'אנחנו ממשיכים להכין את הספר...',
  completionMessage: 'הספר כמעט מוכן...',
  errorTitle: 'משהו השתבש בדרך',
  errorBack: 'חזרה לדף הבית',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorFailed: 'לא הצלחנו לסיים את הספר.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
  statusLines: {
    writing: ['מתחילים לעבד את הספר'],
    images: ['בונים את עמודי הסיפור'],
    audio: ['מלטשים את החוויה'],
    final: ['הספר כמעט מוכן'],
  },
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const GEN = { ...GEN_DEFAULTS, ...(HE_CONTENT.generating || {}) };
const CMN = HE_CONTENT.common || {};
const STATUS_LINES = GEN_DEFAULTS.statusLines;

function statusTextForPct(pct) {
  const value = Math.max(0, Math.min(100, pct));
  if (value < 20) return GEN.statusCollecting || GEN.statusInitial;
  if (value < 40) return GEN.statusWriting;
  if (value < 60) return GEN.statusIllustrating;
  if (value < 80) return GEN.statusAssembling;
  return GEN.statusAlmostReady;
}

function etaTextForPct(pct) {
  const remaining = Math.max(0, 100 - Math.max(0, Math.min(100, pct)));
  if (remaining <= 8) return GEN.etaSoon;
  const minutes = Math.max(1, Math.min(4, Math.ceil(remaining / 24)));
  return (GEN.etaTemplate || 'בעוד כ-{minutes} דקות').replace('{minutes}', String(minutes));
}

// Internal-only mapping for API stages. Never rendered directly in UI.
const STAGE_META = [
  { key: 'writing', apiStages: ['text'] },
  { key: 'images', apiStages: ['images'] },
  { key: 'audio', apiStages: ['audio'] },
  { key: 'final', apiStages: ['package', 'done'] },
];

// ─── State ────────────────────────────────────────────────────────────────────
let displayPct     = 0;       // percentage currently shown in the UI (can be fractional)
let realPct        = 0;       // latest progress value from the API (hard floor)
let activeStageKey = 'writing';
let redirecting    = false;
let pendingReadUrl = null;    // readUrl captured from API when status turns ready/partial
let startedAtMs    = 0;

let pollTimer      = null;
let smoothTimer    = null;
let statusTimer    = null;
let floaterTimer   = null;
let stallTimer     = null;

// ─── Static UI wiring ─────────────────────────────────────────────────────────
// Called once at boot — populates every visible string from CONTENT.
function wireStaticUI() {
  document.title = GEN.pageTitle;
  if (navBrandEl)     navBrandEl.textContent     = CMN.brand;
  if (navTaglineEl)   navTaglineEl.textContent   = CMN.tagline;
  if (navCtaEl)       navCtaEl.textContent       = CMN.navCta;
  if (headlineTextEl) headlineTextEl.textContent = GEN.headline;
  if (statusEl)       statusEl.textContent       = GEN.statusInitial;
  if (etaEl)          etaEl.textContent          = etaTextForPct(0);
  if (reassureEl)     reassureEl.textContent     = GEN.reassure;
  if (closeNoteEl)    closeNoteEl.textContent    = GEN.closeNote;
  if (errorTitleEl)   errorTitleEl.textContent   = GEN.errorTitle;
  if (errorBackEl)    errorBackEl.textContent    = GEN.errorBack;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMetaByApiStage(apiStage) {
  return STAGE_META.find(m => m.apiStages.includes(apiStage)) || STAGE_META[0];
}

function animateTextSwap(el, text) {
  if (!el || el.textContent === text) return;
  el.classList.remove('is-visible');
  el.classList.add('is-changing');
  setTimeout(() => {
    el.textContent = text;
    el.classList.remove('is-changing');
    el.classList.add('is-visible');
  }, 180);
}

function refreshUI() {
  const clampedDisplay = Math.max(0, Math.min(100, displayPct));
  const rounded = Math.round(clampedDisplay);
  pctEl.textContent   = rounded + '%';
  barFill.style.width = clampedDisplay + '%';
  if (barFillLabel) barFillLabel.textContent = rounded + '%';
  animateTextSwap(statusEl, statusTextForPct(clampedDisplay));
  if (etaEl) animateTextSwap(etaEl, etaTextForPct(clampedDisplay));
}

// Called when API reports a new currentStage value.
function applyApiStage(apiStage) {
  const meta = getMetaByApiStage(apiStage);
  if (meta.key === activeStageKey) return;
  activeStageKey = meta.key;
  animateTextSwap(statusEl, randomFrom(STATUS_LINES[meta.key]));
}

// ─── Floaters ─────────────────────────────────────────────────────────────────
function spawnFloater() {
  const icons   = ['✨', '⭐', '💜', '📖', '🪄', '🌙'];
  const floater = document.createElement('span');
  floater.className   = 'bar-floater';
  floater.textContent = randomFrom(icons);
  const x = Math.max(4, Math.min(96, displayPct));
  floater.style.right = `calc(${x}% - 10px)`;
  floatersEl.appendChild(floater);
  setTimeout(() => floater.remove(), 1600);
}

function startFloaters() {
  clearInterval(floaterTimer);
  floaterTimer = setInterval(() => {
    if (displayPct > 3 && displayPct < 100 && Math.random() > 0.45) {
      spawnFloater();
    }
  }, 900);
}

// ─── Cycling text ─────────────────────────────────────────────────────────────
function cycleStatusText() {
  clearInterval(statusTimer);
}

// ─── Smooth progress animation ────────────────────────────────────────────────
// The backend's /api/generate/status already returns a properly weighted progress
// value (text 24%, images 44% with per-page sub-ratio, audio 18%, package 14%).
// We trust that value and only use a small "warmup pump" during the first 6
// seconds so the bar moves immediately, plus a slow "anti-freeze creeper" that
// nudges +0.05% every 2s when the backend pct hasn't changed — keeps the bar
// alive during long sub-stages (image gen) without ever overshooting reality.

const MAX_WAITING_PCT = 94;     // never reach 100 until status === 'ready'
const MAX_CREEP_ABOVE_REAL = 3; // anti-freeze can pull up to +3% above realPct
const WARMUP_TARGET_PCT = 8;    // initial pump shows life before first poll
const WARMUP_DURATION_MS = 6000;

let creepAccumulator = 0;       // % accumulated by the anti-freeze creeper
let lastRealPct = 0;            // detect when realPct changes to reset creeper

function getWarmupPct(elapsedMs) {
  if (elapsedMs >= WARMUP_DURATION_MS) return WARMUP_TARGET_PCT;
  return (elapsedMs / WARMUP_DURATION_MS) * WARMUP_TARGET_PCT;
}

function startSmoothProgress() {
  clearInterval(smoothTimer);
  smoothTimer = setInterval(() => {
    if (redirecting) return;

    // Reset creeper whenever the backend reports new real progress.
    if (realPct > lastRealPct) {
      creepAccumulator = 0;
      lastRealPct = realPct;
    } else {
      // Creep slowly — 0.05% per tick (80ms × 25 ticks/s = +1.25%/sec at most,
      // but step is capped well below that). At 80ms tick this is ~0.625%/sec
      // raw, but the eased step (line below) clamps actual movement.
      creepAccumulator = Math.min(MAX_CREEP_ABOVE_REAL, creepAccumulator + 0.02);
    }

    const warmupPct = getWarmupPct(Date.now() - startedAtMs);
    // Target = max(realPct from API + creeper, warmup floor), hard-capped at 94.
    const target = Math.min(
      MAX_WAITING_PCT,
      Math.max(realPct + creepAccumulator, warmupPct)
    );

    const gap = target - displayPct;
    if (gap > 0.01) {
      // Ease toward target. Faster when far, slower when close.
      const step = Math.min(0.45, Math.max(0.04, gap * 0.12));
      displayPct = Math.min(target, displayPct + step);
      refreshUI();
      if (Math.random() > 0.75) spawnFloater();
    }
  }, 80);
}

// ─── Stop everything ──────────────────────────────────────────────────────────
function stopAll() {
  clearInterval(pollTimer);
  clearInterval(smoothTimer);
  clearInterval(statusTimer);
  clearInterval(floaterTimer);
  clearTimeout(stallTimer);
}

// ─── Stall detection ──────────────────────────────────────────────────────────
// If progress does not advance for 12 seconds, show a soft reassuring message.
// The timer is reset every time realPct increases.
function armStallDetection() {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    if (!redirecting) {
      animateTextSwap(statusEl, GEN.stallMessage);
    }
  }, 12000);
}

// ─── Error state ──────────────────────────────────────────────────────────────
function showError(message) {
  stopAll();
  if (genProgressEl) genProgressEl.hidden = true;   // hide the whole progress UI
  if (errorMsgEl)    errorMsgEl.textContent = message;
  if (errorStateEl)  errorStateEl.hidden    = false;
}

// ─── Completion + redirect ────────────────────────────────────────────────────
function handleReady() {
  if (redirecting) return;
  redirecting = true;
  stopAll();

  // Keep the tail short and intentional on completion.
  realPct = 100;
  displayPct = Math.max(displayPct, 96);
  refreshUI();

  animateTextSwap(statusEl, GEN.completionMessage);

  // Prefer the readUrl provided by the API; fall back to constructing it locally.
  const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
  const destination = pendingReadUrl || `${ROUTES.ready}?orderId=${encodeURIComponent(orderId)}${keyPart}`;

  let ticks = 0;
  const finishTimer = setInterval(() => {
    ticks++;
    if (displayPct < 100) {
      displayPct += 1;
      refreshUI();
    } else {
      clearInterval(finishTimer);
      setTimeout(() => {
        window.location.href = destination;
      }, 1200);
    }
    if (ticks > 15) {
      // Safety — if something stalls, redirect anyway
      clearInterval(finishTimer);
      window.location.href = destination;
    }
  }, 110);
}

// ─── API polling ──────────────────────────────────────────────────────────────
async function fetchStatus() {
  try {
    const res = await fetch('/api/generate/status?orderId=' + encodeURIComponent(orderId));

    if (!res.ok) {
      if (res.status === 404) {
        showError(GEN.errorNotFound);
      }
      // Other 5xx errors: log quietly and let the next poll retry
      console.warn('[generating] Status request failed:', res.status);
      return;
    }

    const data = await res.json();

    // Advance the real floor — never go backward.
    // Reset the stall clock whenever real progress is made.
    if (typeof data.progress === 'number' && data.progress > realPct) {
      realPct = data.progress;
      armStallDetection();
    }

    // Apply stage change if reported
    if (data.currentStage) {
      applyApiStage(data.currentStage);
    }

    // Capture readUrl whenever the API provides it — used by handleReady()
    if (data.readUrl) {
      pendingReadUrl = data.readUrl;
    }

    // Terminal: success
    if (data.status === 'ready') {
      handleReady();
      return;
    }

    // Terminal: partial — audio failed but book is deliverable; redirect same as ready
    if (data.status === 'partial') {
      handleReady();
      return;
    }

    // Terminal: failure — show safe Hebrew copy, never the raw backend error string
    if (data.status === 'failed') {
      track('generation_failed', { orderId, failedStage: data.failedStage || null });
      showError(GEN.errorFailed);
      return;
    }

  } catch (err) {
    // Network error — keep polling silently
    console.warn('[generating] Poll error (will retry):', err);
  }
}

function startPolling() {
  fetchStatus();                                 // immediate first call
  pollTimer = setInterval(fetchStatus, 2500);    // then every 2.5 s
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const orderId = new URLSearchParams(window.location.search).get('orderId');

wireStaticUI();

if (!orderId) {
  // Page loaded without an orderId — show a soft, non-technical error
  showError(GEN.errorMissingOrder);
} else {
  track('generation_viewed', { orderId });
  startedAtMs = Date.now();
  displayPct = 5;
  refreshUI();
  cycleStatusText();
  startFloaters();
  startSmoothProgress();
  armStallDetection();  // start stall clock; resets whenever progress advances
  startPolling();
}
