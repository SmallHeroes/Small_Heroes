/**
 * reader.js — Small Heroes book reader
 */

// ─── Content ──────────────────────────────────────────────────────────────────
const RDR_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — קריאת הסיפור',
  navBack: 'חזרה לספר',
  loadingText: 'פותחים את הספר...',
  errorTitle: 'לא הצלחנו לפתוח את הספר',
  errorDefault: 'אנא נסו שוב.',
  errorNotFound: 'לא מצאנו את ההזמנה שלכם.',
  errorLoadFailed: 'משהו השתבש בטעינת הספר.',
  errorNoPages: 'הספר לא מכיל עמודים.',
  errorNetworkFail: 'לא הצלחנו לטעון את הספר.',
  errorMissingOrder: 'פרטי ההזמנה חסרים.',
  pageNum: 'עמוד {current}',
  progress: 'עמוד {current} מתוך {total}',
  btnPrev: 'הקודם',
  btnNext: 'הבא',
  btnFinish: 'סיום הסיפור',
  audioPlay: 'נגן',
  audioPause: 'השהה',
  audioUnavailable: 'הקריינות תתווסף בקרוב',
  audioLoadFailed: 'לא הצלחנו לטעון את הקריינות כרגע',
  audioTrackAriaLabel: 'מיקום בהקראה',
  imageFallbackText: 'האיור בעיבוד, ממשיכים לקרוא בינתיים',
  coverPageNum: 'כריכה',
  coverProgress: 'כריכה · עמוד {current} מתוך {total}',
  navAriaLabel: 'ניווט בין עמודים',
  btnPrevAriaLabel: 'עמוד קודם',
  btnNextAriaLabel: 'עמוד הבא',
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const RDR = { ...RDR_DEFAULTS, ...(HE_CONTENT.reader || {}) };
const CMN = HE_CONTENT.common || {};
const clientApi = window.SmallHeroesClient || window.__smallHeroesClientApi || null;
const ROUTES = window.SH_ROUTES || {
  ready: '/ready',
  generating: '/generating',
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const loadingEl       = document.getElementById('readerLoading');
const loadingTextEl   = document.getElementById('readerLoadingText');
const errorEl         = document.getElementById('readerError');
const errorTitleEl    = document.getElementById('readerErrorTitle');
const errorMsgEl      = document.getElementById('readerErrorMsg');
const errorBackEl     = document.getElementById('readerErrorBack');
const stageEl         = document.getElementById('readerStage');

const bookTitleEl     = document.getElementById('readerBookTitle');
const readerBookEl    = document.getElementById('readerBook');
const pageCanvasEl    = document.getElementById('readerPageCanvas');
const pageNumEl       = document.getElementById('readerPageNum');
const textEl          = document.getElementById('readerText');
const progressEl      = document.getElementById('readerProgress');
const prevBtn         = document.getElementById('readerBtnPrev');
const nextBtn         = document.getElementById('readerBtnNext');
const navBackEl       = document.getElementById('readerNavBack');
const readerNavEl     = document.getElementById('readerNav');
const readingFillEl   = document.getElementById('readerReadingFill');

// Image refs
const pageImageWrapEl = document.getElementById('readerPageImageWrap');
const pageImgEl       = document.getElementById('readerPageImg');
const pageImageFallbackEl = document.getElementById('readerPageImageFallback');
const pageImageFallbackTextEl = document.getElementById('readerPageImageFallbackText');
const coverOverlayEl = document.getElementById('readerCoverOverlay');
const coverTitleEl = document.getElementById('readerCoverTitle');
const pageProseEl = document.getElementById('readerPageProse');

// Audio refs
const audioBarEl     = document.getElementById('readerAudioBar');
const audioPlayBtn   = document.getElementById('readerAudioPlay');
const audioTrackEl   = document.getElementById('readerAudioTrack');
const audioFillEl    = document.getElementById('readerAudioFill');
const audioCurrentEl = document.getElementById('readerAudioCurrent');
const audioDurEl     = document.getElementById('readerAudioDuration');
const audioEl        = document.getElementById('readerAudioEl');
const audioUnavailableEl = document.getElementById('readerAudioUnavailable');

const navBrandEl   = document.getElementById('navBrand');
const navTaglineEl = document.getElementById('navTagline');

// ─── Static UI wiring ─────────────────────────────────────────────────────────
function wireStaticUI() {
  document.title = RDR.pageTitle;
  if (navBrandEl)    navBrandEl.textContent    = CMN.brand;
  if (navTaglineEl)  navTaglineEl.textContent  = CMN.tagline;
  if (navBackEl)     navBackEl.textContent     = RDR.navBack;
  if (loadingTextEl) loadingTextEl.textContent = RDR.loadingText;
  if (errorTitleEl)  errorTitleEl.textContent  = RDR.errorTitle;
  if (errorBackEl)   errorBackEl.textContent   = RDR.navBack;
  if (prevBtn) {
    prevBtn.textContent = RDR.btnPrev;
    prevBtn.setAttribute('aria-label', RDR.btnPrevAriaLabel);
  }
  if (nextBtn)       nextBtn.setAttribute('aria-label', RDR.btnNextAriaLabel);
  if (audioPlayBtn)  audioPlayBtn.setAttribute('aria-label', RDR.audioPlay);
  if (audioTrackEl)  audioTrackEl.setAttribute('aria-label', RDR.audioTrackAriaLabel);
  if (readerNavEl)   readerNavEl.setAttribute('aria-label', RDR.navAriaLabel);
  if (audioUnavailableEl) audioUnavailableEl.textContent = RDR.audioUnavailable;
  if (pageImageFallbackTextEl) pageImageFallbackTextEl.textContent = RDR.imageFallbackText;
}

// ─── State ────────────────────────────────────────────────────────────────────
let pages        = [];
let currentIndex = 0;
let isTurning    = false;
let audioPlayTracked = false;
let audioEventsBound = false;

// ─── State helpers ────────────────────────────────────────────────────────────
function showState(state) {
  loadingEl.hidden = state !== 'loading';
  errorEl.hidden   = state !== 'error';
  stageEl.hidden   = state !== 'reader';
}

function showError(message) {
  if (errorMsgEl) errorMsgEl.textContent = message;
  showState('error');
}

function reportClientIssue(reason, details) {
  if (clientApi && typeof clientApi.reportClientIssue === 'function') {
    clientApi.reportClientIssue('reader', reason, details);
  }
}

/**
 * Conservative fallback when API omits `pageTemplate`.
 */
function inferTemplateFallback(page, totalPages) {
  const len = (page.text || '').replace(/\s+/g, ' ').trim().length;
  const first = page.pageNumber <= 1;
  const last = totalPages > 0 && page.pageNumber >= totalPages;
  if ((first || last) && len <= 190) return 'full_bleed_overlay';
  if (len <= 130) return 'character_vignette_text';
  return 'art_top_text_bottom';
}

function hasImageUrl(page) {
  return typeof page?.imageUrl === 'string' && page.imageUrl.trim() !== '';
}

function getSafeAudioUrl(audioUrl) {
  if (typeof audioUrl !== 'string') return null;
  const trimmed = audioUrl.trim();
  if (!trimmed) return null;
  if (trimmed.includes('your-storage.example.com')) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function showImageFallback() {
  if (pageImageWrapEl) pageImageWrapEl.hidden = false;
  if (pageImgEl) {
    pageImgEl.hidden = true;
    pageImgEl.classList.remove('is-loaded');
    pageImgEl.removeAttribute('src');
  }
  if (pageImageFallbackEl) pageImageFallbackEl.hidden = false;
  if (pageImageFallbackTextEl) pageImageFallbackTextEl.textContent = RDR.imageFallbackText;
}

function hideImageFallback() {
  if (pageImageFallbackEl) pageImageFallbackEl.hidden = true;
}

function showAudioUnavailable(message) {
  if (audioBarEl) audioBarEl.hidden = true;
  if (audioUnavailableEl) {
    audioUnavailableEl.hidden = false;
    audioUnavailableEl.textContent = message || RDR.audioUnavailable;
  }
}

function hideAudioUnavailable() {
  if (audioUnavailableEl) audioUnavailableEl.hidden = true;
}

// ─── Page rendering ───────────────────────────────────────────────────────────
function updateUI() {
  const page    = pages[currentIndex];
  const total   = pages.length;
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === total - 1;
  const isCover = Boolean(page?.isCover);

  const hasImage = hasImageUrl(page);
  let template = page.pageTemplate || inferTemplateFallback(page, total);
  if (isCover) template = 'full_bleed_overlay';
  if (!isCover && !hasImage) template = 'art_top_text_bottom';

  if (pageCanvasEl) {
    pageCanvasEl.setAttribute('data-template', template);
    pageCanvasEl.setAttribute('data-cover', isCover ? 'true' : 'false');
  }
  if (readerBookEl) readerBookEl.classList.remove('reader-book--text-only');
  if (pageProseEl) pageProseEl.hidden = isCover;
  if (coverOverlayEl) coverOverlayEl.hidden = !isCover;
  if (coverTitleEl && isCover) {
    coverTitleEl.textContent = (page.title || bookTitleEl?.textContent || '').trim();
  }

  // ── Page image ──────────────────────────────────────
  if (pageImgEl && pageImageWrapEl) {
    if (hasImage) {
      const imageUrl = page.imageUrl.trim();
      pageImageWrapEl.hidden     = false;
      hideImageFallback();
      pageImgEl.hidden           = false;
      pageImgEl.classList.remove('is-loaded');
      pageImgEl.alt              = isCover ? `כריכת הספר ${bookTitleEl?.textContent || ''}` : `איור עמוד ${currentIndex + 1}`;
      pageImgEl.onload           = () => {
        pageImgEl.classList.add('is-loaded');
      };
      pageImgEl.onerror          = () => {
        console.warn(`[reader] Image failed to load for page ${page.pageNumber}:`, imageUrl);
        showImageFallback();
      };
      pageImgEl.src = imageUrl;
    } else {
      console.info(`[reader] No imageUrl for page ${page.pageNumber} — showing fallback artwork area`);
      showImageFallback();
    }
  }

  // ── Text and position ───────────────────────────────
  pageNumEl.textContent  = isCover
    ? RDR.coverPageNum
    : RDR.pageNum.replace('{current}', currentIndex + 1);
  textEl.textContent     = isCover ? '' : (page.text || '');
  progressEl.textContent = isCover
    ? RDR.coverProgress
      .replace('{current}', currentIndex + 1)
      .replace('{total}', total)
    : RDR.progress
      .replace('{current}', currentIndex + 1)
      .replace('{total}',   total);

  // Reading progress bar
  if (readingFillEl) {
    readingFillEl.style.width = ((currentIndex + 1) / total * 100) + '%';
  }

  // Buttons
  prevBtn.disabled = isFirst;

  if (isLast) {
    nextBtn.textContent = RDR.btnFinish;
    nextBtn.classList.add('is-final');
    nextBtn.disabled = false;
  } else {
    nextBtn.textContent = RDR.btnNext;
    nextBtn.classList.remove('is-final');
    nextBtn.disabled = false;
  }
}

// Fade out → swap content → fade in
const TURN_MS = 200;

function goToPage(index) {
  if (isTurning) return;
  if (index < 0) return;

  const total  = pages.length;
  const isLast = currentIndex === total - 1;

  if (isLast && index >= total) {
    const keyQuery = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
    window.location.href = ROUTES.ready + '?orderId=' + encodeURIComponent(orderId) + keyQuery;
    return;
  }

  if (index >= total) return;

  isTurning = true;
  textEl.classList.add('is-turning');
  if (pageImgEl && !pageImgEl.hidden) pageImgEl.classList.add('is-turning');

  setTimeout(() => {
    currentIndex = index;
    updateUI();
    textEl.classList.remove('is-turning');
    if (pageImgEl) pageImgEl.classList.remove('is-turning');
    isTurning = false;
  }, TURN_MS);
}

function goPrev() { goToPage(currentIndex - 1); }
function goNext() { goToPage(currentIndex + 1); }

// ─── Audio player ─────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetAudioUi() {
  if (audioFillEl) audioFillEl.style.width = '0%';
  if (audioCurrentEl) audioCurrentEl.textContent = '0:00';
  if (audioDurEl) audioDurEl.textContent = '0:00';
  if (audioPlayBtn) {
    audioPlayBtn.textContent = '▶';
    audioPlayBtn.classList.remove('is-playing');
    audioPlayBtn.setAttribute('aria-label', RDR.audioPlay);
  }
}

function bindAudioEvents() {
  if (audioEventsBound || !audioEl) return;
  audioEventsBound = true;

  audioEl.addEventListener('timeupdate', () => {
    const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
    audioFillEl.style.width    = pct + '%';
    audioCurrentEl.textContent = formatTime(audioEl.currentTime);
  });

  audioEl.addEventListener('loadedmetadata', () => {
    if (!audioEl.duration || isNaN(audioEl.duration)) {
      showAudioUnavailable(RDR.audioLoadFailed);
      return;
    }
    hideAudioUnavailable();
    audioBarEl.hidden = false;
    audioDurEl.textContent = formatTime(audioEl.duration);
    if (audioPlayBtn) audioPlayBtn.disabled = false;
  });

  audioEl.addEventListener('error', () => {
    audioEl.pause();
    resetAudioUi();
    showAudioUnavailable(RDR.audioLoadFailed);
  });

  audioEl.addEventListener('ended', () => {
    audioPlayBtn.textContent = '▶';
    audioPlayBtn.classList.remove('is-playing');
    audioPlayBtn.setAttribute('aria-label', RDR.audioPlay);
  });

  audioPlayBtn.addEventListener('click', () => {
    if (!audioEl.src) return;

    if (audioEl.paused) {
      audioEl.play().then(() => {
        audioPlayBtn.textContent = '⏸';
        audioPlayBtn.classList.add('is-playing');
        audioPlayBtn.setAttribute('aria-label', RDR.audioPause);
        if (!audioPlayTracked) {
          track('audio_played', { orderId });
          audioPlayTracked = true;
        }
      }).catch(() => {
        showAudioUnavailable(RDR.audioLoadFailed);
      });
    } else {
      audioEl.pause();
      audioPlayBtn.textContent = '▶';
      audioPlayBtn.classList.remove('is-playing');
      audioPlayBtn.setAttribute('aria-label', RDR.audioPlay);
    }
  });

  audioTrackEl.addEventListener('click', (e) => {
    if (!audioEl.duration) return;
    const rect = audioTrackEl.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = Math.max(0, Math.min(1, pct)) * audioEl.duration;
  });
}

function setupAudio(audioUrl) {
  if (!audioEl || !audioBarEl) return;

  const safeAudioUrl = getSafeAudioUrl(audioUrl);
  resetAudioUi();
  bindAudioEvents();

  if (!safeAudioUrl) {
    showAudioUnavailable(RDR.audioUnavailable);
    audioEl.removeAttribute('src');
    audioEl.load();
    return;
  }

  hideAudioUnavailable();
  audioBarEl.hidden = false;
  if (audioPlayBtn) audioPlayBtn.disabled = true;
  audioEl.src = safeAudioUrl;
  audioEl.load();
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (stageEl.hidden) return;
  if (e.key === 'ArrowLeft')  goNext();
  if (e.key === 'ArrowRight') goPrev();
});

// ─── Touch / swipe navigation ─────────────────────────────────────────────────
const SWIPE_THRESHOLD = 50;
let touchStartX = null;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (touchStartX === null || stageEl.hidden) return;
  const delta = touchStartX - e.changedTouches[0].clientX;
  touchStartX = null;
  if (Math.abs(delta) < SWIPE_THRESHOLD) return;
  if (delta > 0) goNext();
  else           goPrev();
}, { passive: true });

// ─── Button click handlers ────────────────────────────────────────────────────
prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);

// ─── Fetch and boot ───────────────────────────────────────────────────────────
async function loadReader(orderId) {
  try {
    const accessPart = accessKey ? `?accessKey=${encodeURIComponent(accessKey)}` : '';
    let response = null;
    if (clientApi && typeof clientApi.requestJson === 'function') {
      response = await clientApi.requestJson('/api/orders/' + encodeURIComponent(orderId) + accessPart, {
        timeoutMs: 12000,
        fallbackMessage: RDR.errorLoadFailed,
        timeoutMessage: RDR.errorNetworkFail,
        networkMessage: RDR.errorNetworkFail,
        invalidJsonMessage: RDR.errorLoadFailed,
      });
    } else {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderId) + accessPart);
      const data = await res.json().catch(() => null);
      response = res.ok
        ? { ok: true, status: res.status, data }
        : { ok: false, status: res.status, data, reason: 'http_error', message: RDR.errorLoadFailed };
    }

    if (!response.ok && response.status === 404) { showError(RDR.errorNotFound);   return; }
    if (!response.ok) {
      reportClientIssue('load_failed', {
        reason: response.reason || 'request_failed',
        status: response.status || 0,
        orderId,
      });
      if (response.reason === 'network_error' || response.reason === 'timeout') {
        showError(RDR.errorNetworkFail);
      } else {
        showError(RDR.errorLoadFailed);
      }
      return;
    }

    const data = response.data || {};

    if (data.status !== 'ready' || !data.book) {
      const keyQuery = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
      window.location.replace(ROUTES.generating + '?orderId=' + encodeURIComponent(orderId) + keyQuery);
      return;
    }

    const book = data.book;

    if (!Array.isArray(book.pages) || book.pages.length === 0) {
      showError(RDR.errorNoPages);
      return;
    }

    // Diagnose image coverage
    const withImage    = book.pages.filter(p => p.imageUrl).length;
    const withoutImage = book.pages.length - withImage;
    console.info(`[reader] Pages: ${book.pages.length} total, ${withImage} with image, ${withoutImage} without image`);
    if (withoutImage > 0) {
      console.warn(`[reader] ${withoutImage} page(s) have no imageUrl — check image generation pipeline`);
    }

    pages = book.pages;

    if (bookTitleEl) bookTitleEl.textContent = book.title || '';

    setupAudio(book.audioUrl);

    const keyQuery = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
    const backHref = ROUTES.ready + '?orderId=' + encodeURIComponent(orderId) + keyQuery;
    if (navBackEl)   navBackEl.href   = backHref;
    if (errorBackEl) errorBackEl.href = backHref;

    currentIndex = 0;
    updateUI();
    showState('reader');
    track('reader_opened', { orderId });

  } catch (err) {
    console.error('[reader] Failed to load:', err);
    reportClientIssue('load_failed', { reason: 'exception', orderId });
    showError(RDR.errorNetworkFail);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const accessKey = urlParams.get('accessKey');

wireStaticUI();

if (!orderId) {
  showError(RDR.errorMissingOrder);
} else {
  showState('loading');
  loadReader(orderId);
}
