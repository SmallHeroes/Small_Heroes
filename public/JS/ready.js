/**
 * ready.js — Small Heroes book ready screen
 *
 * Fetches GET /api/orders/:orderId and renders the completed book.
 * Standalone — does NOT import or depend on wizard.js.
 * orderId is read from the URL query string: /ready?orderId=abc123
 *
 * File: JS/ready.js
 */

// ─── Content ──────────────────────────────────────────────────────────────────
const RDY_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — הספר שלכם מוכן!',
  loadingText: 'טוענים את הספר שלכם...',
  headline: 'הספר שלכם מוכן',
  errorTitle: 'משהו השתבש בדרך',
  errorBack: 'חזרה לדף הבית',
  btnRead: 'לקרוא את הספר',
  btnAudio: 'להאזין לסיפור',
  btnPdf: 'הורד PDF',
  saveHint: 'שמרו את הקישור לספר כדי לחזור אליו בכל עת',
  copyLabel: 'העתקת הקישור',
  copiedLabel: 'הועתק!',
  copyBtnAriaLabel: 'העתק קישור לספר',
  dedicationPrefix: 'הסיפור הזה נכתב במיוחד בשביל {name}',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorLoadFailed: 'משהו השתבש בטעינת הספר.',
  errorNetworkFail: 'לא הצלחנו לטעון את הספר.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const RDY = { ...RDY_DEFAULTS, ...(HE_CONTENT.ready || {}) };
const CMN = HE_CONTENT.common || {};
const ROUTES = globalThis.SH_ROUTES || {
  home: '/',
  reader: '/reader',
  generating: '/generating',
};
const accessKey = new URLSearchParams(window.location.search).get('accessKey');

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const loadingEl        = document.getElementById('readyLoading');
const loadingTextEl    = document.getElementById('readyLoadingText');
const errorEl          = document.getElementById('readyError');
const errorTitleEl     = document.getElementById('readyErrorTitle');
const errorMsgEl       = document.getElementById('readyErrorMsg');
const errorBackEl      = document.getElementById('readyErrorBack');
const bookEl           = document.getElementById('readyBook');

const headlineEl       = document.getElementById('readyHeadline');
const titleEl          = document.getElementById('readyTitle');
const coverTextEl      = document.getElementById('readyCoverText');
const dedicationEl     = document.getElementById('readyDedication');

const btnReadEl        = document.getElementById('readyBtnRead');
const btnAudioEl       = document.getElementById('readyBtnAudio');
const btnPdfEl         = document.getElementById('readyBtnPdf');
const audioPlayerEl    = document.getElementById('readyAudioPlayer');
const btnCopyEl        = document.getElementById('readyBtnCopy');
const copyLabelEl      = document.getElementById('readyCopyLabel');

const saveHintEl       = document.getElementById('readySaveHint');

const navBrandEl       = document.getElementById('navBrand');
const navTaglineEl     = document.getElementById('navTagline');
const navCtaEl         = document.getElementById('navCta');

// ─── Static UI wiring ─────────────────────────────────────────────────────────
// Called once at boot — populates every visible string from CONTENT.
function wireStaticUI() {
  document.title = RDY.pageTitle;
  if (navBrandEl)        navBrandEl.textContent        = CMN.brand;
  if (navTaglineEl)      navTaglineEl.textContent      = CMN.tagline;
  if (navCtaEl)          navCtaEl.textContent          = CMN.navCta;
  if (loadingTextEl)     loadingTextEl.textContent     = RDY.loadingText;
  if (headlineEl)        headlineEl.textContent        = RDY.headline;
  if (errorTitleEl)      errorTitleEl.textContent      = RDY.errorTitle;
  if (errorBackEl)       errorBackEl.textContent       = RDY.errorBack;
  if (btnReadEl)         btnReadEl.textContent         = RDY.btnRead;
  if (btnAudioEl)        btnAudioEl.textContent        = RDY.btnAudio;
  if (btnPdfEl)          btnPdfEl.textContent          = RDY.btnPdf;
  if (saveHintEl)        saveHintEl.textContent        = RDY.saveHint;
  if (copyLabelEl)       copyLabelEl.textContent       = RDY.copyLabel;
  if (btnCopyEl)         btnCopyEl.setAttribute('aria-label', RDY.copyBtnAriaLabel);
}

// ─── State helpers ────────────────────────────────────────────────────────────
function showState(state) {
  // state: 'loading' | 'error' | 'book'
  loadingEl.hidden = state !== 'loading';
  errorEl.hidden   = state !== 'error';
  bookEl.hidden    = state !== 'book';

  if (state === 'book') {
    // Trigger entrance animation after the element is un-hidden
    requestAnimationFrame(() => bookEl.classList.add('is-visible'));
  }
}

function showError(message) {
  if (errorMsgEl) errorMsgEl.textContent = message;
  showState('error');
}

// ─── Copy link ────────────────────────────────────────────────────────────────
let copyResetTimer = null;

function setupCopyLink() {
  if (!btnCopyEl || !copyLabelEl) return;

  btnCopyEl.addEventListener('click', async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
    } catch (_) {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    // Brief confirmation
    copyLabelEl.textContent = RDY.copiedLabel;
    btnCopyEl.classList.add('is-copied');
    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyLabelEl.textContent = RDY.copyLabel;
      btnCopyEl.classList.remove('is-copied');
    }, 2500);
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderBook(data) {
  const book = data.book;

  // Hero
  if (titleEl)      titleEl.textContent      = book.title || '';
  if (coverTextEl)  coverTextEl.textContent  = book.coverText || '';
  if (dedicationEl) dedicationEl.textContent = data.childName
    ? RDY.dedicationPrefix.replace('{name}', data.childName)
    : '';

  // "לקרוא את הספר" — opens the reader
  if (btnReadEl) {
    if (ROUTES && typeof ROUTES.readerV2 === 'function') {
      btnReadEl.href = ROUTES.readerV2(orderId, accessKey || undefined);
    } else {
      const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
      btnReadEl.href = `${ROUTES.reader}?orderId=${encodeURIComponent(orderId)}${keyPart}`;
    }
  }

  // Audio button — show only if URL exists
  if (btnAudioEl && audioPlayerEl) {
    if (book.audioUrl) {
      audioPlayerEl.src = book.audioUrl;
      btnAudioEl.hidden = false;

      // Toggle player on click instead of navigating
      btnAudioEl.addEventListener('click', (e) => {
        e.preventDefault();
        const isVisible = !audioPlayerEl.hidden;
        audioPlayerEl.hidden = isVisible;
        if (!isVisible) {
          audioPlayerEl.play().catch(() => {});
        } else {
          audioPlayerEl.pause();
        }
      });
    } else {
      btnAudioEl.hidden = true;
    }
  }

  // PDF button — show only if URL exists
  if (btnPdfEl) {
    if (book.pdfUrl) {
      btnPdfEl.href   = book.pdfUrl;
      btnPdfEl.hidden = false;
    } else {
      btnPdfEl.hidden = true;
    }
  }

  // Save to local history so the parent can return from this browser later
  saveBookToHistory({ orderId, childName: data.childName || null, title: book.title || null, accessKey: accessKey || null });

  // Wire copy-link button
  setupCopyLink();

  showState('book');
  track('ready_viewed', { orderId });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function loadBook(orderId) {
  try {
    const keyPart = accessKey ? `?accessKey=${encodeURIComponent(accessKey)}` : '';
    const res = await fetch('/api/orders/' + encodeURIComponent(orderId) + keyPart);

    if (res.status === 404) {
      showError(RDY.errorNotFound);
      return;
    }

    if (!res.ok) {
      showError(RDY.errorLoadFailed);
      return;
    }

    const data = await res.json();

    // Guard: if the order exists but generation is still in progress,
    // send the user back to the generating screen rather than showing an error.
    // This handles the edge case where someone navigates here early
    // (e.g. a saved link, a back-button, or a race with the redirect).
    // Accept 'partial' too — audio may have failed but book is deliverable.
    if ((data.status !== 'ready' && data.status !== 'partial') || !data.book) {
      const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
      window.location.replace(`${ROUTES.generating}?orderId=${encodeURIComponent(orderId)}${keyPart}`);
      return;
    }

    renderBook(data);

  } catch (err) {
    console.error('[ready] Failed to load book:', err);
    showError(RDY.errorNetworkFail);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const orderId = new URLSearchParams(window.location.search).get('orderId');

wireStaticUI();

if (!orderId) {
  showError(RDY.errorMissingOrder);
} else {
  showState('loading');
  loadBook(orderId);
}
