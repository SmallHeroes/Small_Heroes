/**
 * generating.js — Small Heroes generation screen
 *
 * Polls GET /api/generate/status?orderId=<id> every 2.5 seconds and
 * drives the progress UI with real backend state.
 *
 * Standalone — does NOT import or depend on wizard.js.
 * orderId is read from the URL query string: generating.html?orderId=abc123
 *
 * File: JS/generating.js
 */

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const stepEls        = [0, 1, 2, 3].map(i => document.getElementById('step-' + i));
const pctEl          = document.getElementById('genPct');
const barFill        = document.getElementById('genBarFill');
const statusEl       = document.getElementById('genStatusText');
const storyPeekEl    = document.getElementById('genStoryPeekText');
const stageBadgeEl   = document.getElementById('genStageBadge');
const floatersEl     = document.getElementById('genBarFloaters');
const errorStateEl   = document.getElementById('genErrorState');
const errorMsgEl     = document.getElementById('genErrorMsg');
const genProgressEl  = document.getElementById('genProgressArea');
const headlineTextEl = document.getElementById('genHeadlineText');
const headlineBoldEl = document.getElementById('genHeadlineBold');
const peekLabelEl    = document.getElementById('genStoryPeekLabel');
const errorTitleEl   = document.getElementById('genErrorTitle');
const errorBackEl    = document.getElementById('genErrorBack');
const navBrandEl     = document.getElementById('navBrand');
const navTaglineEl   = document.getElementById('navTagline');
const navCtaEl       = document.getElementById('navCta');

// ─── Content ──────────────────────────────────────────────────────────────────
const GEN_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — יוצרים את הספר שלכם',
  headline: 'אנחנו מתחילים ליצור עכשיו את הספר',
  headlineBold: 'שלכם',
  peekLabel: 'הצצה קטנה מהספר',
  initialPeek: 'עוד רגע זה מוכן...',
  statusInitial: 'מתחילים לייצר את הספר',
  stallMessage: 'עוד עובדים בשבילכם...',
  completionMessage: 'הספר כמעט מוכן...',
  errorTitle: 'משהו השתבש בדרך',
  errorBack: 'חזרה לדף הבית',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorFailed: 'לא הצלחנו לסיים את הספר.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
  stages: [
    { key: 'writing', label: 'יצירת הטקסט', apiStages: ['text'] },
    { key: 'images', label: 'יצירת תמונות', apiStages: ['images'] },
    { key: 'audio', label: 'קריינות', apiStages: ['audio'] },
    { key: 'final', label: 'דיוקים אחרונים', apiStages: ['package', 'done'] },
  ],
  storyLines: ['מעבדים את הסיפור שלכם...'],
  statusLines: {
    writing: ['כותבים את הסיפור'],
    images: ['יוצרים את האיורים'],
    audio: ['מכינים קריינות'],
    final: ['דיוקים אחרונים'],
  },
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const GEN = { ...GEN_DEFAULTS, ...(HE_CONTENT.generating || {}) };
const CMN = HE_CONTENT.common || {};
const clientApi = window.SmallHeroesClient || window.__smallHeroesClientApi || null;
const ROUTES = window.SH_ROUTES || {
  ready: '/ready',
};
const STORY_LINES = Array.isArray(GEN.storyLines) && GEN.storyLines.length > 0
  ? GEN.storyLines
  : GEN_DEFAULTS.storyLines;
const STATUS_LINES = {
  ...GEN_DEFAULTS.statusLines,
  ...(GEN.statusLines || {}),
};

// Maps API currentStage values → internal key + display label
// 'done' maps to 'final' so the last step stays active during redirect
const STAGE_META = Array.isArray(GEN.stages) && GEN.stages.length > 0
  ? GEN.stages
  : GEN_DEFAULTS.stages;
const POLL_BASE_MS = 2500;
const POLL_MAX_MS = 12000;
const MAX_POLL_DURATION_MS = 12 * 60 * 1000;
const MAX_STALLED_MS = 2 * 60 * 1000;
const MAX_CONSECUTIVE_404 = 3;
const MAX_CONSECUTIVE_5XX = 4;
const MAX_CONSECUTIVE_NETWORK = 6;

// ─── State ────────────────────────────────────────────────────────────────────
let displayPct     = 0;       // percentage currently shown in the UI (can be fractional)
let realPct        = 0;       // latest progress value from the API (hard floor)
let optimisticPct  = 0;       // simulated progress lead (capped per stage)
let activeStageKey = 'writing';
let redirecting    = false;
let pendingReadUrl = null;    // readUrl captured from API when status turns ready/partial

let pollTimer      = null;
let smoothTimer    = null;
let statusTimer    = null;
let storyTimer     = null;
let floaterTimer   = null;
let stallTimer     = null;
let pollDelayMs    = POLL_BASE_MS;
let pollStartedAtMs = 0;
let lastPayloadSignature = '';
let lastPayloadChangeAtMs = 0;
let consecutive404 = 0;
let consecutive5xx = 0;
let consecutiveNetwork = 0;

// ─── Static UI wiring ─────────────────────────────────────────────────────────
// Called once at boot — populates every visible string from CONTENT.
function wireStaticUI() {
  document.title = GEN.pageTitle;
  if (navBrandEl)     navBrandEl.textContent     = CMN.brand;
  if (navTaglineEl)   navTaglineEl.textContent   = CMN.tagline;
  if (navCtaEl)       navCtaEl.textContent       = CMN.navCta;
  if (headlineTextEl) headlineTextEl.textContent = GEN.headline;
  if (headlineBoldEl) headlineBoldEl.textContent = GEN.headlineBold;
  if (stageBadgeEl)   stageBadgeEl.textContent   = GEN.stages[0].label;
  stepEls.forEach(function (el, i) { if (el) el.textContent = GEN.stages[i].label; });
  if (statusEl)       statusEl.textContent       = GEN.statusInitial;
  if (peekLabelEl)    peekLabelEl.textContent    = GEN.peekLabel;
  if (storyPeekEl)    storyPeekEl.textContent    = GEN.initialPeek;
  if (errorTitleEl)   errorTitleEl.textContent   = GEN.errorTitle;
  if (errorBackEl)    errorBackEl.textContent    = GEN.errorBack;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function reportClientIssue(reason, details) {
  if (clientApi && typeof clientApi.reportClientIssue === 'function') {
    clientApi.reportClientIssue('generating', reason, details);
  }
}

function getMetaByApiStage(apiStage) {
  return STAGE_META.find(m => m.apiStages.includes(apiStage)) || STAGE_META[0];
}

function getStageIndex(key) {
  return STAGE_META.findIndex(m => m.key === key);
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

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateSteps(activeIdx) {
  stepEls.forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < activeIdx) el.classList.add('done');
    if (i === activeIdx) el.classList.add('active');
  });
}

function refreshUI() {
  const clampedDisplay = Math.max(0, Math.min(100, displayPct));
  pctEl.textContent   = Math.round(clampedDisplay) + '%';
  barFill.style.width = clampedDisplay + '%';
}

// Called when API reports a new currentStage value.
// Only updates badge, steps, and status text if the stage actually changed.
function applyApiStage(apiStage) {
  const meta = getMetaByApiStage(apiStage);
  if (meta.key === activeStageKey) return;
  activeStageKey = meta.key;
  animateTextSwap(stageBadgeEl, meta.label);
  updateSteps(getStageIndex(meta.key));
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
  statusTimer = setInterval(() => {
    animateTextSwap(statusEl, randomFrom(STATUS_LINES[activeStageKey]));
  }, 1900);
}

function cycleStoryPeek() {
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    animateTextSwap(storyPeekEl, randomFrom(STORY_LINES));
  }, 3200);
}

// ─── Smooth progress animation ────────────────────────────────────────────────
// Progress model:
// - realPct is the backend truth (hard floor)
// - optimisticPct drifts forward continuously, but never beyond stage caps
// - displayPct eases toward max(realPct, optimisticPct) to avoid hard jumps
const STAGE_PROGRESS_CAPS = {
  writing: 32,
  images: 62,
  audio: 84,
  final: 97,
};

function getStageCap(stageKey) {
  return STAGE_PROGRESS_CAPS[stageKey] || STAGE_PROGRESS_CAPS.writing;
}

function startSmoothProgress() {
  clearInterval(smoothTimer);
  smoothTimer = setInterval(() => {
    if (redirecting) return;

    const stageCap = getStageCap(activeStageKey);
    const safeOptimisticTarget = Math.max(realPct, stageCap);

    // Gentle optimism: keep moving, then slow down near the cap.
    if (optimisticPct < safeOptimisticTarget) {
      const capGap = safeOptimisticTarget - optimisticPct;
      // Asymptotic approach keeps subtle motion instead of "hit cap then freeze".
      const optimismStep = Math.min(0.18, capGap * 0.045);
      if (optimismStep > 0.002) {
        optimisticPct = Math.min(safeOptimisticTarget, optimisticPct + optimismStep);
      }
    }

    const softenedTarget = Math.max(realPct, optimisticPct);
    const targetGap = softenedTarget - displayPct;
    if (targetGap > 0.01) {
      // Ease toward target with bounded velocity to prevent milestone snapping.
      const easedStep = Math.min(0.85, Math.max(0.05, targetGap * 0.2));
      displayPct = Math.min(softenedTarget, displayPct + easedStep);
      refreshUI();
      if (Math.random() > 0.7) spawnFloater();
    }
  }, 80);
}

// ─── Stop everything ──────────────────────────────────────────────────────────
function stopAll() {
  clearTimeout(pollTimer);
  clearInterval(smoothTimer);
  clearInterval(statusTimer);
  clearInterval(storyTimer);
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

function withAccessKey(url, key) {
  if (!url || !key) return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (!parsed.searchParams.get('accessKey')) {
      parsed.searchParams.set('accessKey', key);
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}accessKey=${encodeURIComponent(key)}`;
  }
}

// ─── Completion + redirect ────────────────────────────────────────────────────
function handleReady() {
  if (redirecting) return;
  redirecting = true;
  stopAll();

  // Snap floor and optimistic lead to 100, then finish quickly and cleanly.
  realPct = 100;
  optimisticPct = 100;
  displayPct = Math.max(displayPct, 96);
  refreshUI();

  animateTextSwap(statusEl, GEN.completionMessage);

  // Prefer the readUrl provided by the API; fall back to constructing it locally.
  const keyQuery = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
  const fallbackDestination = ROUTES.ready + '?orderId=' + encodeURIComponent(orderId) + keyQuery;
  const destination = withAccessKey(pendingReadUrl, accessKey) || fallbackDestination;

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
function scheduleNextPoll(delayMs) {
  if (redirecting) return;
  clearTimeout(pollTimer);
  pollTimer = setTimeout(fetchStatus, typeof delayMs === 'number' ? delayMs : pollDelayMs);
}

function increasePollBackoff() {
  pollDelayMs = Math.min(POLL_MAX_MS, Math.round(pollDelayMs * 1.7));
}

function resetPollBackoff() {
  pollDelayMs = POLL_BASE_MS;
}

function buildStatusSignature(data) {
  return [
    data?.status || 'unknown',
    data?.currentStage || 'none',
    typeof data?.progress === 'number' ? data.progress : 'na',
    data?.failedStage || 'none',
    Boolean(data?.readUrl),
  ].join('|');
}

async function fetchStatus() {
  if (redirecting) return;
  const now = Date.now();
  if (pollStartedAtMs && now - pollStartedAtMs >= MAX_POLL_DURATION_MS) {
    reportClientIssue('poll_timeout', { reason: 'max_poll_duration', orderId });
    showError('התהליך מתעכב יותר מהרגיל. רעננו את העמוד כדי לנסות שוב.');
    return;
  }

  let response = null;
  if (clientApi && typeof clientApi.requestJson === 'function') {
    response = await clientApi.requestJson('/api/generate/status?orderId=' + encodeURIComponent(orderId), {
      timeoutMs: 12000,
      fallbackMessage: 'טעינת מצב ההפקה נכשלה.',
      timeoutMessage: 'השרת מתעכב במתן עדכון התקדמות.',
      networkMessage: 'שגיאת רשת בזמן בדיקת התקדמות.',
      invalidJsonMessage: 'התקבלה תשובה לא תקינה משרת ההתקדמות.',
    });
  } else {
    try {
      const res = await fetch('/api/generate/status?orderId=' + encodeURIComponent(orderId));
      const data = await res.json().catch(() => null);
      response = res.ok
        ? { ok: true, status: res.status, data, reason: null }
        : { ok: false, status: res.status, data, reason: 'http_error', message: 'טעינת מצב ההפקה נכשלה.' };
    } catch (err) {
      response = { ok: false, status: 0, data: null, reason: 'network_error', message: String(err) };
    }
  }

  if (!response.ok) {
    increasePollBackoff();
    if (response.status === 404) {
      consecutive404 += 1;
      if (consecutive404 >= MAX_CONSECUTIVE_404) {
        reportClientIssue('poll_failed', { reason: 'repeated_404', orderId });
        showError(GEN.errorNotFound);
        return;
      }
    } else {
      consecutive404 = 0;
    }
    if (response.status >= 500 && response.status <= 599) {
      consecutive5xx += 1;
      if (consecutive5xx >= MAX_CONSECUTIVE_5XX) {
        reportClientIssue('poll_failed', { reason: 'repeated_5xx', status: response.status, orderId });
        showError('השרת מתקשה לעדכן כרגע. נסו שוב בעוד רגע.');
        return;
      }
    } else {
      consecutive5xx = 0;
    }
    if (response.reason === 'network_error' || response.reason === 'timeout') {
      consecutiveNetwork += 1;
      if (consecutiveNetwork >= MAX_CONSECUTIVE_NETWORK) {
        reportClientIssue('poll_failed', { reason: response.reason, orderId });
        showError('נראה שיש בעיית רשת מתמשכת. בדקו חיבור ונסו שוב.');
        return;
      }
    } else {
      consecutiveNetwork = 0;
    }
    scheduleNextPoll();
    return;
  }

  resetPollBackoff();
  consecutive404 = 0;
  consecutive5xx = 0;
  consecutiveNetwork = 0;

  const data = response.data || {};
  const signature = buildStatusSignature(data);
  if (signature !== lastPayloadSignature) {
    lastPayloadSignature = signature;
    lastPayloadChangeAtMs = now;
  } else if (lastPayloadChangeAtMs && now - lastPayloadChangeAtMs >= MAX_STALLED_MS) {
    reportClientIssue('poll_stalled', { reason: 'unchanged_status_timeout', orderId, signature });
    showError('לא מתקבל עדכון התקדמות כבר זמן מה. רעננו את העמוד כדי לנסות שוב.');
    return;
  }

  if (typeof data.progress === 'number' && data.progress > realPct) {
    realPct = data.progress;
    armStallDetection();
    lastPayloadChangeAtMs = now;
  }

  if (data.currentStage) {
    applyApiStage(data.currentStage);
  }

  if (data.readUrl) {
    pendingReadUrl = data.readUrl;
  }

  if (data.status === 'ready' || data.status === 'partial') {
    handleReady();
    return;
  }

  if (data.status === 'failed') {
    track('generation_failed', { orderId, failedStage: data.failedStage || null });
    showError(GEN.errorFailed);
    return;
  }

  scheduleNextPoll();
}

function startPolling() {
  resetPollBackoff();
  pollStartedAtMs = Date.now();
  lastPayloadChangeAtMs = pollStartedAtMs;
  lastPayloadSignature = '';
  consecutive404 = 0;
  consecutive5xx = 0;
  consecutiveNetwork = 0;
  scheduleNextPoll(0);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const accessKey = urlParams.get('accessKey');

wireStaticUI();

if (!orderId) {
  // Page loaded without an orderId — show a soft, non-technical error
  showError(GEN.errorMissingOrder);
} else {
  track('generation_viewed', { orderId });
  refreshUI();
  cycleStatusText();
  cycleStoryPeek();
  startFloaters();
  startSmoothProgress();
  armStallDetection();  // start stall clock; resets whenever progress advances
  startPolling();
}
