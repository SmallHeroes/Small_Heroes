/**
 * generating.js — Small Heroes generation screen
 *
 * Polls GET /api/generate/status?orderId=<id> every 2.5 seconds and
 * redirects when the book is ready. Calm looping animation — no progress bar.
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
const errorStateEl   = document.getElementById('genErrorState');
const errorMsgEl     = document.getElementById('genErrorMsg');
const genProgressEl  = document.getElementById('genProgressArea');
const headlineTextEl = document.getElementById('genHeadlineText');
const bodyTextEl     = document.getElementById('genBodyText');
const errorTitleEl   = document.getElementById('genErrorTitle');
const errorBackEl    = document.getElementById('genErrorBack');
const navBrandEl     = document.getElementById('navBrand');
const navTaglineEl   = document.getElementById('navTagline');
const navCtaEl       = document.getElementById('navCta');

// ─── Content ──────────────────────────────────────────────────────────────────
const GEN_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — מכינים את הספר שלכם',
  headline: 'אנחנו מכינים את הספר של {childName} ✨',
  headlineFallback: 'אנחנו מכינים את הספר שלכם ✨',
  body: 'ההכנה לוקחת זמן. אפשר לסגור את החלון — נשלח לכם אימייל עם לינק לספר ברגע שהוא מוכן.',
  bodyHtml: 'ההכנה לוקחת זמן. אפשר לסגור את החלון — נשלח לכם <strong>אימייל עם לינק לספר</strong> ברגע שהוא מוכן.',
  errorTitle: 'משהו השתבש בדרך',
  errorBack: 'חזרה לדף הבית',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorFailed: 'לא הצלחנו לסיים את הספר.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
  reviewTitle: 'הספר שלך בבדיקה אישית',
  reviewBody: 'הספר שלך בבדיקה אישית — נעדכן במייל בקרוב',
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const GEN = { ...GEN_DEFAULTS, ...(HE_CONTENT.generating || {}) };
const CMN = HE_CONTENT.common || {};

// ─── State ────────────────────────────────────────────────────────────────────
let redirecting    = false;
let pendingReadUrl = null;
let headlineSet    = false;
let heldShown      = false;
let inFlight       = false; // guards against overlapping status requests

let pollTimer      = null;
const POLL_NORMAL_MS = 2500;
const POLL_HELD_MS   = 15000; // human-QA hold: poll slowly, no overlap

function renderTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] != null ? vars[key] : ''
  ));
}

function setHeadline(childName) {
  if (!headlineTextEl) return;
  const name = (childName || '').trim();
  if (name) {
    headlineTextEl.textContent = renderTemplate(GEN.headline, { childName: name });
  } else {
    headlineTextEl.textContent = GEN.headlineFallback;
  }
}

// ─── Static UI wiring ─────────────────────────────────────────────────────────
function wireStaticUI() {
  document.title = GEN.pageTitle;
  if (navBrandEl)     navBrandEl.textContent     = CMN.brand;
  if (navTaglineEl)   navTaglineEl.textContent   = CMN.tagline;
  if (navCtaEl)       navCtaEl.textContent       = CMN.navCta;
  setHeadline(null);
  if (bodyTextEl) {
    bodyTextEl.innerHTML = GEN.bodyHtml || GEN.body;
  }
  if (errorTitleEl)   errorTitleEl.textContent   = GEN.errorTitle;
  if (errorBackEl)    errorBackEl.textContent    = GEN.errorBack;
}

// ─── Stop everything ──────────────────────────────────────────────────────────
function stopAll() {
  clearTimeout(pollTimer);
}

// ─── Error state ──────────────────────────────────────────────────────────────
function showError(message) {
  stopAll();
  if (genProgressEl) genProgressEl.hidden = true;
  if (errorMsgEl)    errorMsgEl.textContent = message;
  if (errorStateEl)  errorStateEl.hidden    = false;
}

// ─── Human-QA hold (under_review) ──────────────────────────────────────────────
// Calm held message instead of the infinite spinner. Keeps polling slowly in case
// the book releases to ready — does NOT stop polling and is NOT an error.
function showHeldReview() {
  if (heldShown) return;
  heldShown = true;
  if (genProgressEl) {
    const hero = genProgressEl.querySelector('.gen-hero');
    if (hero) hero.hidden = true;
  }
  if (headlineTextEl) headlineTextEl.textContent = GEN.reviewTitle;
  if (bodyTextEl)     bodyTextEl.textContent      = GEN.reviewBody;
}

// ─── Completion + redirect ────────────────────────────────────────────────────
function handleReady() {
  if (redirecting) return;
  redirecting = true;
  stopAll();

  const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
  const destination = pendingReadUrl || `${ROUTES.ready}?orderId=${encodeURIComponent(orderId)}${keyPart}`;

  setTimeout(() => {
    window.location.href = destination;
  }, 800);
}

// ─── API polling ──────────────────────────────────────────────────────────────
function scheduleNextPoll(delay) {
  pollTimer = setTimeout(fetchStatus, delay);
}

async function fetchStatus() {
  // In-flight guard: never let a slow response overlap the next tick.
  if (inFlight) {
    scheduleNextPoll(POLL_NORMAL_MS);
    return;
  }
  inFlight = true;
  try {
    const keyPart = accessKey ? '&accessKey=' + encodeURIComponent(accessKey) : '';
    const res = await fetch('/api/generate/status?orderId=' + encodeURIComponent(orderId) + keyPart);

    if (!res.ok) {
      if (res.status === 404) {
        showError(GEN.errorNotFound); // stops polling
        return;
      }
      console.warn('[generating] Status request failed:', res.status);
      scheduleNextPoll(POLL_NORMAL_MS);
      return;
    }

    const data = await res.json();

    if (!headlineSet && data.childName) {
      setHeadline(data.childName);
      headlineSet = true;
    }

    if (data.readUrl) {
      pendingReadUrl = data.readUrl;
    }

    if (data.status === 'ready' || data.status === 'partial') {
      handleReady();
      return;
    }

    if (data.status === 'under_review') {
      showHeldReview();
      scheduleNextPoll(POLL_HELD_MS); // slow poll, no overlap
      return;
    }

    if (data.status === 'failed') {
      track('generation_failed', { orderId, failedStage: data.failedStage || null });
      showError(GEN.errorFailed); // stops polling
      return;
    }

    scheduleNextPoll(POLL_NORMAL_MS);
  } catch (err) {
    console.warn('[generating] Poll error (will retry):', err);
    scheduleNextPoll(POLL_NORMAL_MS);
  } finally {
    inFlight = false;
  }
}

function startPolling() {
  fetchStatus();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const orderId = new URLSearchParams(window.location.search).get('orderId');

wireStaticUI();

if (!orderId) {
  showError(GEN.errorMissingOrder);
} else {
  track('generation_viewed', { orderId });
  startPolling();
}
