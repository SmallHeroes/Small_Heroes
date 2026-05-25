/**
 * ready.js — Small Heroes book ready screen
 *
 * Fetches GET /api/orders/:orderId and renders the completed book.
 * Standalone — does NOT import or depend on wizard.js.
 * orderId is read from the URL query string: ready.html?orderId=abc123
 *
 * File: JS/ready.js
 */

// ─── Content ──────────────────────────────────────────────────────────────────
const RDY_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — הסיפור שלכם מוכן!',
  loadingText: 'טוענים את הספר שלכם...',
  headline: 'זה הסיפור שיצרנו עבורו',
  errorTitle: 'משהו השתבש בדרך',
  errorBack: 'חזרה לדף הבית',
  btnRead: 'לקריאה עכשיו',
  btnAudio: 'להאזין לסיפור',
  btnPdf: 'הורד PDF',
  saveHint: 'אפשר לחזור לסיפור הזה בכל זמן',
  copyLabel: 'העתקת הקישור',
  copiedLabel: 'הועתק!',
  copyBtnAriaLabel: 'העתק קישור לספר',
  previewLabel: 'הצצה לתוך הספר',
  previewPageNum: 'עמוד ראשון',
  dedicationPrefix: 'הסיפור האישי של {name}',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorLoadFailed: 'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
  errorNetworkFail: 'יש כרגע הפרעה בחיבור. נסו שוב בעוד רגע.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const RDY = { ...RDY_DEFAULTS, ...(HE_CONTENT.ready || {}) };
const CMN = HE_CONTENT.common || {};
const clientApi = window.SmallHeroesClient || window.__smallHeroesClientApi || null;
const ROUTES = window.SH_ROUTES || {
  generating: '/generating',
  readerV2: function (bookId, key) {
    const params = new URLSearchParams({ v: '1' });
    if (key) params.set('accessKey', key);
    return '/book/' + encodeURIComponent(bookId) + '/read-v2?' + params.toString();
  },
};

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
const previewLabelEl   = document.getElementById('readyPreviewLabel');
const previewPageNumEl = document.getElementById('readyPreviewPageNum');
const previewTextEl    = document.getElementById('readyPreviewText');

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
  if (previewLabelEl)    previewLabelEl.textContent    = RDY.previewLabel;
  if (previewPageNumEl)  previewPageNumEl.textContent  = RDY.previewPageNum;
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

function reportClientIssue(reason, details) {
  if (clientApi && typeof clientApi.reportClientIssue === 'function') {
    clientApi.reportClientIssue('ready', reason, details);
  }
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
    btnReadEl.href = ROUTES.readerV2(orderId, accessKey || null);
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

  // First page preview
  const firstPage = Array.isArray(book.pages) && book.pages.length > 0
    ? (book.pages.find((page) => !page?.isCover && typeof page?.text === 'string' && page.text.trim().length > 0) || null)
    : null;

  if (previewTextEl) {
    previewTextEl.textContent = firstPage?.text
      ? firstPage.text
      : '';
  }

  // Save to local history so the parent can return from this browser later
  saveBookToHistory({ orderId, childName: data.childName || null, title: book.title || null });

  // Wire copy-link button
  setupCopyLink();

  showState('book');
  track('ready_viewed', { orderId });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function loadBook(orderId) {
  try {
    const accessPart = accessKey ? `?accessKey=${encodeURIComponent(accessKey)}` : '';
    let response = null;
    if (clientApi && typeof clientApi.requestJson === 'function') {
      response = await clientApi.requestJson('/api/orders/' + encodeURIComponent(orderId) + accessPart, {
        timeoutMs: 12000,
        fallbackMessage: RDY.errorLoadFailed,
        timeoutMessage: RDY.errorNetworkFail,
        networkMessage: RDY.errorNetworkFail,
        invalidJsonMessage: RDY.errorLoadFailed,
      });
    } else {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderId) + accessPart);
      const data = await res.json().catch(() => null);
      response = res.ok
        ? { ok: true, status: res.status, data }
        : { ok: false, status: res.status, data, reason: 'http_error', message: RDY.errorLoadFailed };
    }

    if (!response.ok && response.status === 404) {
      showError(RDY.errorNotFound);
      return;
    }
    if (!response.ok) {
      reportClientIssue('load_failed', {
        reason: response.reason || 'request_failed',
        status: response.status || 0,
        orderId,
      });
      if (response.reason === 'network_error' || response.reason === 'timeout') {
        showError(RDY.errorNetworkFail);
      } else {
        showError(RDY.errorLoadFailed);
      }
      return;
    }
    const data = response.data || {};

    // Guard: if the order exists but generation is still in progress,
    // send the user back to the generating screen rather than showing an error.
    // This handles the edge case where someone navigates here early
    // (e.g. a saved link, a back-button, or a race with the redirect).
    if (data.status !== 'ready' || !data.book) {
      const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
      window.location.replace(ROUTES.generating + '?orderId=' + encodeURIComponent(orderId) + keyPart);
      return;
    }

    renderBook(data);

  } catch (err) {
    console.error('[ready] Failed to load book:', err);
    reportClientIssue('load_failed', { reason: 'exception', orderId });
    showError(RDY.errorNetworkFail);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const accessKey = urlParams.get('accessKey');

wireStaticUI();

if (!orderId) {
  showError(RDY.errorMissingOrder);
} else {
  showState('loading');
  loadBook(orderId);
}
