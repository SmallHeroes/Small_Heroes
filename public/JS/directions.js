/* Story directions UI — Hebrew copy in JS/content.js (directions.*).
 * Server QA checklist for cards/API: app/api/story-directions/route.ts (file header). */

const DIR_DEFAULTS = {
  pageTitle: 'גיבורים קטנים — בוחרים כיוון לסיפור',
  title: 'איזה סוג סיפור יתאים לו?',
  subtitle: 'הכנו שלוש אפשרויות שונות — בחרו את מה שהכי מרגיש נכון לילד שלכם.',
  loadingTitle: 'אנחנו מכינים עכשיו שלוש אפשרויות לסיפור שלכם...',
  loadingHint: 'זה לוקח בדרך כלל דקה או שתיים',
  retry: 'מנסים שוב',
  cardSubmitting: 'בוחרים...',
  checkoutLoading: 'מעבירים אתכם לתשלום...',
  transitioningTitle: 'מעבירים אתכם לתשלום...',
  transitioningHint: 'עוד רגע נפתח את עמוד התשלום המאובטח',
  checkoutError: 'עוד רגע ונפתח את התשלום. אפשר לנסות שוב בעוד כמה שניות.',
  errorTitle: 'עוד רגע, אנחנו מכינים את האפשרויות מחדש',
  errorMessage: 'זה לוקח קצת יותר זמן מהרגיל. אפשר לנסות שוב או לחזור שלב אחד אחורה.',
  tagPrefix: 'כיוון',
  cardChoose: 'לבחירה',
  cardSelected: 'נבחר',
  labels: {
    bedtime: 'שקט וחם',
    adventure: 'פעולה וגילוי',
    fantasy: 'דמיון ללא גבולות',
  },
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const DIR = { ...DIR_DEFAULTS, ...(HE_CONTENT.directions || {}) };
const CMN = HE_CONTENT.common || {};
const clientApi = window.SmallHeroesClient || window.__smallHeroesClientApi || null;
const WIZARD_SESSION_ID_STORAGE_KEY = 'smallheroes.wizardSessionId';
const DIRECTIONS_KICKOFF_STORAGE_PREFIX = 'sh_dirs_kickoff_';

const DIRECTION_IMAGES = {
  bedtime: '/directions/bedtime.jpg',
  adventure: '/directions/adventure.jpg',
  fantasy: '/directions/fantasy.jpg',
};

const ARCHETYPE_ORDER = ['bedtime', 'adventure', 'fantasy'];

const DIR_PACKAGE_LINE = {
  bedtime: '10 עמודים · ₪59',
  adventure: '15 עמודים · ₪79',
  fantasy: '20 עמודים · ₪99',
};

function effectiveDirectionImageUrl(direction) {
  return direction.previewImageUrl || DIRECTION_IMAGES[direction.archetype] || '';
}
const POLL_BASE_INTERVAL_MS = 700;
const POLL_MAX_INTERVAL_MS = 8000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;
const MAX_CONSECUTIVE_404S = 4;
const MAX_CONSECUTIVE_5XX = 4;
const MAX_PENDING_MS = 360000;
const MAX_NO_PROGRESS_MS = 240000;
const MAX_SUMMARY_CHARS = 116;
const START_DIRECTIONS_TIMEOUT_MS = 60000;
const START_DIRECTIONS_GRACE_MS = 70000;

const navBrandEl = document.getElementById('navBrand');
const navTaglineEl = document.getElementById('navTagline');
const navCtaEl = document.getElementById('navCta');
const heroEl = document.querySelector('.directions-hero');

const titleEl = document.getElementById('directionsTitle');
const subtitleEl = document.getElementById('directionsSubtitle');
const loadingEl = document.getElementById('directionsLoading');
const transitionEl = document.getElementById('directionsTransition');
const transitionTitleEl = document.getElementById('directionsTransitionTitle');
const transitionHintEl = document.getElementById('directionsTransitionHint');
const loadingTitleEl = document.getElementById('directionsLoadingTitle');
const loadingHintEl = document.getElementById('directionsLoadingHint');
const progressFillEl = document.getElementById('directionsProgressFill');
const progressPctEl = document.getElementById('directionsProgressPct');
const errorEl = document.getElementById('directionsError');
const errorTitleEl = document.getElementById('directionsErrorTitle');
const errorMessageEl = document.getElementById('directionsErrorMessage');
const retryBtnEl = document.getElementById('directionsRetryBtn');
const gridEl = document.getElementById('directionsGrid');
const checkoutErrEl = document.getElementById('directionsCheckoutError');
const directionsRootEl = document.getElementById('directionsRoot');

const orderId = new URLSearchParams(window.location.search).get('orderId');

let storyDirectionSet = null;
let selectedDirectionId = null;
let viewedAtMs = null;
let didSelect = false;
let isSubmitting = false;
let lastTrackedSelectionId = null;

let lastMeta = null;
let directionsReadyFired = false;
let pollTimer = null;
let progressTimer = null;
let genStartedAt = 0;
let consecutivePollFailures = 0;
let consecutive404 = 0;
let consecutive5xx = 0;
let lastProgressAtMs = 0;
let terminalState = null;
let pollInFlight = false;
let pollDelayMs = POLL_BASE_INTERVAL_MS;
let displayProgress = 0;
let optimisticProgress = 0;
let realReadyCount = 0;
let stageEnteredAtMs = 0;
const FLOW_STATES = {
  IDLE: 'IDLE',
  GENERATING_OPTIONS: 'GENERATING_OPTIONS',
  SHOWING_OPTIONS: 'SHOWING_OPTIONS',
  OPTION_SELECTED: 'OPTION_SELECTED',
  GENERATING_STORY: 'GENERATING_STORY',
};
let flowState = FLOW_STATES.IDLE;
let uiState = 'loading';
let unchangedSnapshotKey = '';
let unchangedSinceMs = 0;
let kickoffGraceUntilMs = 0;

function wireStaticUI() {
  document.title = DIR.pageTitle;
  if (navBrandEl) navBrandEl.textContent = CMN.brand;
  if (navTaglineEl) navTaglineEl.textContent = CMN.tagline;
  if (navCtaEl) navCtaEl.textContent = CMN.navCta;
  if (titleEl) titleEl.textContent = DIR.title;
  if (subtitleEl) subtitleEl.textContent = DIR.subtitle;
  if (loadingTitleEl) loadingTitleEl.textContent = DIR.loadingTitle;
  if (loadingHintEl) loadingHintEl.textContent = DIR.loadingHint;
  if (transitionTitleEl) transitionTitleEl.textContent = DIR.transitioningTitle;
  if (transitionHintEl) transitionHintEl.textContent = DIR.transitioningHint;
  if (errorTitleEl) errorTitleEl.textContent = DIR.errorTitle;
  if (errorMessageEl) errorMessageEl.textContent = DIR.errorMessage;
  if (retryBtnEl) retryBtnEl.textContent = DIR.retry;
}

function applyUiStateVisibility() {
  const isLoading = uiState === 'loading';
  const isRedirecting = uiState === 'redirecting';
  const isError = uiState === 'error';
  const isReady = uiState === 'ready';

  if (heroEl) heroEl.hidden = !isReady;
  if (loadingEl) loadingEl.hidden = !isLoading;
  if (transitionEl) transitionEl.hidden = !isRedirecting;
  if (errorEl) errorEl.hidden = !isError;
  if (gridEl) gridEl.hidden = !isReady;
  if (checkoutErrEl) checkoutErrEl.hidden = !isReady || !checkoutErrEl.textContent;
}

function uiStateForFlowState(state) {
  if (state === FLOW_STATES.SHOWING_OPTIONS) return 'ready';
  if (state === FLOW_STATES.OPTION_SELECTED || state === FLOW_STATES.GENERATING_STORY) return 'redirecting';
  return 'loading';
}

function setFlowState(nextState) {
  if (!nextState) {
    applyUiStateVisibility();
    return;
  }
  flowState = nextState;
  const nextUiState = uiStateForFlowState(nextState);
  uiState = nextUiState;
  if (directionsRootEl) directionsRootEl.setAttribute('data-state', nextUiState);
  applyUiStateVisibility();
}

function safeTrack(event, properties) {
  if (typeof track !== 'function') return;
  try {
    track(event, properties);
  } catch (_) {}
}

function trackDirectionsError(stage, errorType) {
  const raw = errorType != null ? String(errorType) : 'unknown';
  safeTrack('directions_error', {
    orderId: orderId || '',
    stage,
    error_type: raw.slice(0, 120),
  });
}

function reportClientIssue(reason, details) {
  if (clientApi && typeof clientApi.reportClientIssue === 'function') {
    clientApi.reportClientIssue('directions', reason, details);
  }
}

function compactSummary(summary) {
  const raw = (summary || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const firstSentence = raw.split(/[.!?]\s/)[0].trim() || raw;
  const sentencePreferred = firstSentence.length >= 36 ? firstSentence : raw;
  let candidate = sentencePreferred;
  if (candidate.length > MAX_SUMMARY_CHARS) {
    const commaCut = candidate.split(/[,:;]/)[0].trim();
    if (commaCut.length >= 30) candidate = commaCut;
  }
  if (candidate.length > MAX_SUMMARY_CHARS) {
    const clipped = candidate.slice(0, MAX_SUMMARY_CHARS);
    const cutAt = clipped.lastIndexOf(' ');
    candidate = (cutAt > 58 ? clipped.slice(0, cutAt) : clipped).trim();
  }
  return candidate.replace(/[,:;.\-–—\s]+$/, '');
}

function humanLabel(direction) {
  return DIR.labels[direction.archetype] || direction.emotionalLabel || '';
}

function countReadyDirections(set) {
  const dirs = set?.directions || [];
  return dirs.filter((d) => Boolean(effectiveDirectionImageUrl(d))).length;
}

function stageCapByReadyCount(readyCount) {
  if (readyCount >= 3) return 99;
  if (readyCount === 2) return 94;
  if (readyCount === 1) return 81;
  return 63;
}

function stageFloorByReadyCount(readyCount) {
  if (readyCount >= 3) return 100;
  if (readyCount === 2) return 55;
  if (readyCount === 1) return 25;
  return 4;
}

function refreshProgressUi() {
  const pct = Math.max(0, Math.min(100, Math.round(displayProgress)));
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (progressPctEl) progressPctEl.textContent = `${pct}%`;
}

function startSmoothProgress() {
  if (progressTimer) clearInterval(progressTimer);
  if (!progressFillEl) return;
  progressTimer = setInterval(() => {
    if (terminalState === 'ready' || terminalState === 'error') return;

    const elapsedSec = Math.max(0, (Date.now() - genStartedAt) / 1000);
    const stageWaitSec = Math.max(0, (Date.now() - stageEnteredAtMs) / 1000);
    const timeTarget = Math.min(95, 8 + elapsedSec * 0.62 + Math.log1p(elapsedSec) * 5.6);
    const baseCap = stageCapByReadyCount(realReadyCount);
    const capDrift = Math.min(4.2, stageWaitSec * 0.06);
    const cap = Math.min(96, baseCap + capDrift);
    const floor = stageFloorByReadyCount(realReadyCount);
    const optimisticTarget = Math.max(floor, Math.min(cap, timeTarget));

    if (optimisticProgress < optimisticTarget) {
      const capGap = optimisticTarget - optimisticProgress;
      const optimismStep = Math.min(0.5, Math.max(0.08, 0.12 + capGap * 0.14));
      optimisticProgress = Math.min(optimisticTarget, optimisticProgress + optimismStep);
    }

    const softenedTarget = Math.max(floor, optimisticProgress);
    const gap = softenedTarget - displayProgress;
    if (gap > 0.02) {
      const easedStep = Math.min(1.1, Math.max(0.12, gap * 0.24));
      displayProgress = Math.min(softenedTarget, displayProgress + easedStep);
      refreshProgressUi();
    }
  }, 90);
}

function stopSmoothProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function createSkeletonCard(archetype) {
  const card = document.createElement('article');
  card.className = 'direction-card direction-card-skeleton';
  card.setAttribute('aria-busy', 'true');
  const image = document.createElement('div');
  image.className = 'direction-card-skeleton-image';
  const body = document.createElement('div');
  body.className = 'direction-card-body';
  const tag = document.createElement('div');
  tag.className = 'direction-card-tag direction-card-skeleton-line';
  tag.textContent = `${DIR.tagPrefix} ${DIR.labels[archetype] || ''}`;
  const title = document.createElement('div');
  title.className = 'direction-card-skeleton-line direction-card-skeleton-title';
  const summary = document.createElement('div');
  summary.className = 'direction-card-skeleton-line direction-card-skeleton-summary';
  const summary2 = document.createElement('div');
  summary2.className = 'direction-card-skeleton-line direction-card-skeleton-summary short';
  body.appendChild(tag);
  body.appendChild(title);
  body.appendChild(summary);
  body.appendChild(summary2);
  card.appendChild(image);
  card.appendChild(body);
  return card;
}

async function submitSelection(direction, card, button) {
  if (!selectedDirectionId || !storyDirectionSet || isSubmitting) return;
  isSubmitting = true;
  didSelect = true;

  if (checkoutErrEl) {
    checkoutErrEl.hidden = true;
    checkoutErrEl.textContent = '';
  }

  const allCards = document.querySelectorAll('.direction-card');
  const allCtas = document.querySelectorAll('.direction-card-cta');
  allCards.forEach((node) => node.classList.add('is-disabled'));
  allCtas.forEach((node) => { node.disabled = true; });
  allCards.forEach((node) => {
    if (node !== card) node.classList.add('is-muted');
  });
  card.classList.remove('is-disabled');
  card.classList.add('is-submitting');
  button.textContent = DIR.cardSubmitting;
  setFlowState(FLOW_STATES.OPTION_SELECTED);
  setFlowState(FLOW_STATES.GENERATING_STORY);

  try {
    const sessionId = (() => {
      try {
        const stored = window.localStorage.getItem(WIZARD_SESSION_ID_STORAGE_KEY);
        return stored && stored.trim() ? stored.trim() : null;
      } catch {
        return null;
      }
    })();
    let selectionResponse = null;
    console.info('[directions] selecting direction', {
      orderId,
      selectedDirectionId,
      archetype: direction?.archetype || null,
    });
    if (clientApi && typeof clientApi.requestJson === 'function') {
      selectionResponse = await clientApi.requestJson('/api/story-directions/select', {
        fetch: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, directionId: selectedDirectionId }),
        },
        timeoutMs: 12000,
        fallbackMessage: 'לא הצלחנו לשמור את הבחירה כרגע.',
      });
    } else {
      const res = await fetch('/api/story-directions/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, directionId: selectedDirectionId }),
      });
      const data = await res.json().catch(() => ({}));
      selectionResponse = res.ok
        ? { ok: true, data }
        : { ok: false, reason: 'http_error', message: data.error || 'select_failed' };
    }

    if (!selectionResponse.ok) {
      reportClientIssue('select_failed', { reason: selectionResponse.reason || 'request_failed', orderId });
      throw new Error('select_failed');
    }

    safeTrack('checkout_started_from_directions', {
      orderId,
      archetype: direction?.archetype || null,
    });

    button.textContent = DIR.checkoutLoading;
    let checkoutResponse = null;
    console.info('[directions] starting checkout', {
      orderId,
      sessionId: sessionId || null,
    });
    if (clientApi && typeof clientApi.requestJson === 'function') {
      checkoutResponse = await clientApi.requestJson('/api/checkout', {
        fetch: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, ...(sessionId ? { sessionId } : {}) }),
        },
        timeoutMs: 15000,
        fallbackMessage: 'לא הצלחנו לפתוח את התשלום כרגע.',
      });
    } else {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...(sessionId ? { sessionId } : {}) }),
      });
      const data = await checkoutRes.json().catch(() => ({}));
      checkoutResponse = checkoutRes.ok
        ? { ok: true, data }
        : { ok: false, reason: 'http_error', message: data.error || 'checkout_failed' };
    }
    if (!checkoutResponse.ok) {
      console.error('[directions] checkout failed response', {
        orderId,
        status: checkoutResponse.status || 0,
        reason: checkoutResponse.reason || 'request_failed',
        message: checkoutResponse.message || 'checkout_failed',
        data: checkoutResponse.data || null,
      });
      reportClientIssue('checkout_failed', { reason: checkoutResponse.reason || 'request_failed', orderId });
      throw new Error(checkoutResponse.message || 'checkout_failed');
    }

    const { url, paymentProvider, paymentId } = checkoutResponse.data || {};
    console.info('[directions] checkout started', {
      orderId,
      paymentProvider: paymentProvider || null,
      paymentId: paymentId || null,
      hasUrl: Boolean(url),
    });
    if (!url) throw new Error('checkout_no_url');
    let payHref;
    try {
      const parsed = new URL(String(url).trim(), window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('bad_protocol');
      }
      if (parsed.origin === window.location.origin) {
        const p = parsed.pathname || '';
        if (
          p === '/' ||
          p.startsWith('/wizard') ||
          p.startsWith('/directions') ||
          p.startsWith('/generating') ||
          p.startsWith('/ready') ||
          p.startsWith('/reader') ||
          p.startsWith('/HTML/')
        ) {
          reportClientIssue('checkout_bad_redirect', { url: String(url).trim(), orderId });
          throw new Error('checkout_invalid_payment_url');
        }
      }
      payHref = parsed.href;
    } catch (e) {
      if (e instanceof TypeError || (e instanceof Error && e.message === 'bad_protocol')) {
        reportClientIssue('checkout_bad_redirect', { url: String(url).trim(), orderId });
        throw new Error('checkout_invalid_payment_url');
      }
      throw e;
    }
    safeTrack('checkout_opened', { orderId, archetype: direction?.archetype || null });
    window.location.href = payHref;
  } catch (error) {
    console.error('[directions] failed to select direction or checkout', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    const stage = msg === 'select_failed' ? 'select' : 'checkout';
    trackDirectionsError(stage, msg);
    didSelect = false;
    isSubmitting = false;
    setFlowState(FLOW_STATES.SHOWING_OPTIONS);
    allCards.forEach((node) => node.classList.remove('is-disabled', 'is-submitting', 'is-muted'));
    allCtas.forEach((node) => { node.disabled = false; });
    button.textContent = DIR.cardSelected;
    const normalizedMessage =
      stage === 'select'
        ? 'לא הצלחנו לשמור את הבחירה כרגע. אפשר לנסות שוב בעוד רגע.'
        : msg === 'Child photo quality check failed'
          ? 'כדי להמשיך, העלו תמונה ברורה יותר של הפנים ואז נסו שוב.'
        : msg === 'Payment provider misconfigured'
          ? 'התשלום עדיין לא זמין כרגע. נסו שוב בעוד רגע.'
          : msg === 'PayMe configuration missing'
            ? 'התשלום עדיין לא זמין כרגע. נסו שוב בעוד רגע.'
          : msg === 'Failed to create checkout session'
            ? 'לא הצלחנו לפתוח תשלום כרגע. נסו שוב בעוד רגע.'
            : msg === 'checkout_no_url'
              ? 'לא התקבל עדיין קישור תשלום תקין. נסו שוב בעוד רגע.'
              : msg === 'checkout_invalid_payment_url' ||
                  msg === 'Payment provider returned an invalid redirect URL'
                ? 'יש עיכוב זמני בפתיחת התשלום. נסו שוב בעוד רגע.'
                : DIR.checkoutError;
    if (checkoutErrEl) {
      checkoutErrEl.textContent = normalizedMessage;
      checkoutErrEl.hidden = false;
    }
  }
}

function buildCard(direction, interactive, idx) {
  const card = document.createElement('article');
  card.className = 'direction-card';
  if (!interactive) card.classList.add('is-disabled');
  card.dataset.directionId = direction.id;
  card.style.setProperty('--card-stagger', `${Math.max(0, idx || 0) * 90}ms`);

  const image = document.createElement('img');
  image.className = 'direction-card-image';
  image.src = effectiveDirectionImageUrl(direction);
  image.alt = direction.title;
  image.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'direction-card-body';

  const tag = document.createElement('div');
  tag.className = 'direction-card-tag';
  tag.textContent = `${DIR.tagPrefix} ${humanLabel(direction)}`;

  const title = document.createElement('h3');
  title.className = 'direction-card-title';
  title.textContent = direction.title;

  const pkg = document.createElement('p');
  pkg.className = 'direction-card-package';
  pkg.textContent = DIR_PACKAGE_LINE[direction.archetype] || '';

  const summary = document.createElement('p');
  summary.className = 'direction-card-summary';
  summary.textContent = compactSummary(direction.summary);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-outline direction-card-cta';
  button.textContent = DIR.cardChoose;

  const applySelection = () => {
    if (!interactive || isSubmitting) return;
    selectedDirectionId = direction.id;
    document.querySelectorAll('.direction-card').forEach((node) => {
      node.classList.remove('is-selected', 'is-pressed', 'is-muted');
      if (node !== card) node.classList.add('is-muted');
    });
    document.querySelectorAll('.direction-card-cta').forEach((node) => {
      node.textContent = DIR.cardChoose;
    });
    card.classList.add('is-selected');
    card.classList.add('is-pressed');
    setTimeout(() => card.classList.remove('is-pressed'), 180);
    button.textContent = DIR.cardSelected;

    if (direction.id !== lastTrackedSelectionId) {
      lastTrackedSelectionId = direction.id;
      safeTrack('story_direction_selected', {
        orderId,
        archetype: direction.archetype,
        time_to_select_ms: viewedAtMs != null ? Date.now() - viewedAtMs : null,
      });
    }
    submitSelection(direction, card, button);
  };

  if (interactive) {
    card.addEventListener('click', applySelection);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      applySelection();
    });
  } else {
    button.disabled = true;
  }

  body.appendChild(tag);
  body.appendChild(title);
  if (pkg.textContent) body.appendChild(pkg);
  body.appendChild(summary);
  body.appendChild(button);
  card.appendChild(image);
  card.appendChild(body);
  return card;
}

function renderCards(set) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  realReadyCount = 3;
  displayProgress = 100;
  optimisticProgress = 100;
  refreshProgressUi();

  const sorted = [...set.directions].sort((a, b) => {
    const ra = ARCHETYPE_ORDER.indexOf(a.archetype);
    const rb = ARCHETYPE_ORDER.indexOf(b.archetype);
    return ra - rb;
  });
  sorted.forEach((direction, idx) => {
    gridEl.appendChild(buildCard(direction, true, idx));
  });
}

function isDirectionsComplete(set) {
  if (!set || set.status === 'failed') return false;
  const dirs = set.directions || [];
  if (dirs.length !== 3) return false;
  return dirs.every((d) => Boolean(effectiveDirectionImageUrl(d)));
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleNextPoll(delayMs) {
  if (terminalState) return;
  clearPoll();
  const waitMs = typeof delayMs === 'number' ? delayMs : pollDelayMs;
  pollTimer = setTimeout(() => {
    pollTick();
  }, waitMs);
}

function increasePollBackoff() {
  pollDelayMs = Math.min(POLL_MAX_INTERVAL_MS, Math.round(pollDelayMs * 1.6));
}

function resetPollBackoff() {
  pollDelayMs = POLL_BASE_INTERVAL_MS;
}

function buildSnapshotKey(set) {
  if (!set) return 'none';
  const flags = (set.directions || [])
    .map((d) => `${d.id}:${Boolean(effectiveDirectionImageUrl(d))}`)
    .join(',');
  return `${set.status || 'unknown'}|${set.updatedAt || ''}|${flags}`;
}

function enterErrorState(stage, errorType) {
  if (terminalState === 'ready') return;
  terminalState = 'error';
  clearPoll();
  stopSmoothProgress();
  trackDirectionsError(stage, errorType);
  uiState = 'error';
  if (directionsRootEl) directionsRootEl.setAttribute('data-state', 'error');
  applyUiStateVisibility();
}

async function finalizeReadySet(set, meta) {
  terminalState = 'ready';
  clearPoll();
  stopSmoothProgress();
  if (meta) lastMeta = meta;
  if (!lastMeta?.child_age_band) {
    try {
      const p = await fetchPayload();
      if (p.ok && p.meta) lastMeta = p.meta;
    } catch (_) {}
  }
  if (!directionsReadyFired) {
    directionsReadyFired = true;
    const generationTimeMs = Date.now() - genStartedAt;
    safeTrack('story_directions_ready', {
      orderId,
      generation_time_ms: generationTimeMs,
      style: set.selectedStyle || lastMeta?.style,
      child_age_band: lastMeta?.child_age_band,
    });
    safeTrack('directions_rendered_ready', {
      orderId,
      total_count: (set.directions || []).length,
      generation_time_ms: generationTimeMs,
    });
  }
  storyDirectionSet = set;
  await playReadyTransition();
  renderCards(set);
  setFlowState(FLOW_STATES.SHOWING_OPTIONS);
}

async function fetchPayload() {
  if (clientApi && typeof clientApi.requestJson === 'function') {
    const response = await clientApi.requestJson('/api/story-directions?orderId=' + encodeURIComponent(orderId), {
      timeoutMs: 12000,
      fallbackMessage: 'טעינת האפשרויות נכשלה.',
      timeoutMessage: 'השרת מתעכב בתשובה.',
      networkMessage: 'שגיאת רשת בעת טעינת האפשרויות.',
      invalidJsonMessage: 'התקבלה תשובה לא תקינה מהשרת.',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status || 0,
        reason: response.reason || 'request_failed',
        message: response.message || 'failed',
        set: null,
        meta: null,
      };
    }
    return {
      ok: true,
      status: response.status,
      reason: null,
      message: null,
      set: response.data.storyDirectionSet || null,
      meta: response.data.meta || null,
    };
  }

  try {
    const res = await fetch('/api/story-directions?orderId=' + encodeURIComponent(orderId));
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        reason: 'http_error',
        message: (data && (data.error || data.message)) || 'failed',
        set: null,
        meta: null,
      };
    }
    return { ok: true, status: res.status, reason: null, message: null, set: data.storyDirectionSet || null, meta: data.meta || null };
  } catch (error) {
    return { ok: false, status: 0, reason: 'network_error', message: String(error), set: null, meta: null };
  }
}

async function pollTick() {
  if (terminalState) return;
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const payload = await fetchPayload();
    if (terminalState) return;
    const now = Date.now();
    const elapsedMs = now - genStartedAt;
    if (elapsedMs >= MAX_PENDING_MS) {
      enterErrorState('poll', 'pending_timeout');
      return;
    }

    if (!payload.ok) {
      consecutivePollFailures += 1;
      increasePollBackoff();

      if (payload.status === 404) {
        const kickoffGraceActive = now < kickoffGraceUntilMs;
        if (kickoffGraceActive) {
          scheduleNextPoll();
          return;
        }
        consecutive404 += 1;
      } else {
        consecutive404 = 0;
      }
      if (payload.status >= 500 && payload.status <= 599) {
        consecutive5xx += 1;
      } else {
        consecutive5xx = 0;
      }

      if (consecutive404 >= MAX_CONSECUTIVE_404S) {
        reportClientIssue('poll_failed', { reason: 'repeated_404', orderId });
        enterErrorState('poll', 'repeated_404');
        return;
      }
      if (consecutive5xx >= MAX_CONSECUTIVE_5XX) {
        reportClientIssue('poll_failed', { reason: 'repeated_5xx', orderId });
        enterErrorState('poll', 'repeated_5xx');
        return;
      }
      if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        reportClientIssue('poll_failed', {
          reason: payload.reason || 'poll_unreachable',
          status: payload.status || 0,
          orderId,
        });
        enterErrorState('poll', 'poll_unreachable');
        return;
      }

      scheduleNextPoll();
      return;
    }

    resetPollBackoff();
    consecutivePollFailures = 0;
    consecutive404 = 0;
    consecutive5xx = 0;

    const { set, meta } = payload;
    if (meta) lastMeta = meta;

    if (!set) {
      scheduleNextPoll();
      return;
    }
    kickoffGraceUntilMs = 0;
    if (set.status === 'failed') {
      enterErrorState('poll', 'set_failed');
      return;
    }

    const nextReadyCount = countReadyDirections(set);
    if (nextReadyCount !== realReadyCount) {
      stageEnteredAtMs = Date.now();
      realReadyCount = nextReadyCount;
      lastProgressAtMs = now;
    }

    const snapshotKey = buildSnapshotKey(set);
    if (snapshotKey !== unchangedSnapshotKey) {
      unchangedSnapshotKey = snapshotKey;
      unchangedSinceMs = now;
      lastProgressAtMs = now;
    } else if (!unchangedSinceMs) {
      unchangedSinceMs = now;
    }

    if (isDirectionsComplete(set)) {
      await finalizeReadySet(set, meta);
      return;
    }
    if (set.status === 'pending' && now - unchangedSinceMs >= MAX_NO_PROGRESS_MS) {
      reportClientIssue('poll_stalled', { reason: 'pending_no_progress_timeout', orderId });
      enterErrorState('poll', 'pending_no_progress_timeout');
      return;
    }
    scheduleNextPoll();
  } catch (error) {
    if (terminalState) return;
    console.error('[directions] poll failed', error);
    consecutivePollFailures += 1;
    increasePollBackoff();
    if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
      reportClientIssue('poll_failed', { reason: 'poll_unreachable', orderId });
      enterErrorState('poll', 'poll_unreachable');
      return;
    }
    scheduleNextPoll();
  } finally {
    pollInFlight = false;
  }
}

async function startSelectionFlow() {
  if (!orderId) {
    trackDirectionsError('boot', 'missing_order_id');
    uiState = 'error';
    if (directionsRootEl) directionsRootEl.setAttribute('data-state', 'error');
    applyUiStateVisibility();
    return;
  }

  const wasErrorUi = uiState === 'error';
  const kickoffKey = DIRECTIONS_KICKOFF_STORAGE_PREFIX + orderId;

  directionsReadyFired = false;
  lastMeta = null;
  consecutivePollFailures = 0;
  consecutive404 = 0;
  consecutive5xx = 0;
  terminalState = null;
  pollInFlight = false;
  resetPollBackoff();
  isSubmitting = false;
  genStartedAt = Date.now();
  lastProgressAtMs = genStartedAt;
  viewedAtMs = genStartedAt;
  selectedDirectionId = null;
  unchangedSnapshotKey = '';
  unchangedSinceMs = genStartedAt;
  kickoffGraceUntilMs = Date.now() + START_DIRECTIONS_GRACE_MS;
  clearPoll();
  stopSmoothProgress();

  safeTrack('story_directions_viewed', { orderId, timestamp: genStartedAt });
  setFlowState(FLOW_STATES.IDLE);
  setFlowState(FLOW_STATES.GENERATING_OPTIONS);
  displayProgress = 0;
  optimisticProgress = 0;
  realReadyCount = 0;
  stageEnteredAtMs = genStartedAt;
  refreshProgressUi();
  startSmoothProgress();
  scheduleNextPoll(0);

  try {
    if (wasErrorUi) {
      try {
        sessionStorage.removeItem(kickoffKey);
      } catch (_) {}
    }
    let skipDuplicatePost = false;
    if (!wasErrorUi) {
      try {
        if (sessionStorage.getItem(kickoffKey) === '1') {
          skipDuplicatePost = true;
          console.info(
            '[DirectionsGeneration] skip_duplicate (client) orderId=' + orderId + ' reason=session_kickoff_already_sent'
          );
        }
      } catch (_) {}
    }

    let postResponse = null;
    if (!skipDuplicatePost) {
      if (clientApi && typeof clientApi.requestJson === 'function') {
        postResponse = await clientApi.requestJson('/api/story-directions', {
          fetch: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
          },
          timeoutMs: START_DIRECTIONS_TIMEOUT_MS,
          fallbackMessage: 'לא הצלחנו להתחיל יצירת אפשרויות סיפור.',
        });
      } else {
        const postRes = await fetch('/api/story-directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const data = await postRes.json().catch(() => ({}));
        postResponse = postRes.ok
          ? { ok: true, status: postRes.status, data }
          : { ok: false, status: postRes.status, reason: 'http_error', message: data.error || 'failed', data: null };
      }
    } else {
      postResponse = { ok: true, status: 202, data: { status: 'pending' }, reason: null, message: null };
    }

    if (postResponse.ok) {
      try {
        if (postResponse.status === 200 || postResponse.status === 202) {
          sessionStorage.setItem(kickoffKey, '1');
        }
      } catch (_) {}
    }

    if (!postResponse.ok) {
      if (postResponse.status === 202) return;
      if (postResponse.reason === 'timeout' || postResponse.reason === 'network_error') {
        reportClientIssue('start_pending_after_client_timeout', {
          reason: postResponse.reason,
          status: postResponse.status || 0,
          orderId,
        });
        return;
      }
      reportClientIssue('start_failed', {
        reason: postResponse.reason || 'request_failed',
        status: postResponse.status || 0,
        orderId,
      });
      throw new Error(postResponse.message || 'failed');
    }

    if (postResponse.status === 202) return;
    kickoffGraceUntilMs = 0;
    const data = postResponse.data || {};
    if (data.storyDirectionSet && isDirectionsComplete(data.storyDirectionSet)) {
      await finalizeReadySet(data.storyDirectionSet, data.meta || lastMeta);
    }
  } catch (error) {
    console.error('[directions] failed to load directions', error);
    const errType = error instanceof Error ? error.message : 'unknown';
    enterErrorState('post', errType);
  }
}

function wireEvents() {
  if (retryBtnEl) {
    retryBtnEl.addEventListener('click', () => {
      startSelectionFlow();
    });
  }

  window.addEventListener('beforeunload', () => {
    if (!viewedAtMs || didSelect) return;
    const elapsed = Math.max(0, Math.round((Date.now() - viewedAtMs) / 1000));
    safeTrack('story_direction_selection_abandoned', {
      orderId,
      style: storyDirectionSet?.selectedStyle || null,
      time_to_select: elapsed,
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playReadyTransition() {
  const leaving = loadingEl;
  if (!leaving || leaving.hidden) return;
  // Structural guard: never keep cards visible while loading UI fades out.
  if (gridEl) gridEl.hidden = true;
  leaving.classList.add('is-fading-out');
  await wait(280);
  leaving.classList.remove('is-fading-out');
  leaving.hidden = true;
  await wait(220);
}

try {
  wireStaticUI();
  wireEvents();
  startSelectionFlow().catch((error) => {
    console.error('[directions] startSelectionFlow failed', error);
    const errType = error instanceof Error ? error.message : 'unknown';
    enterErrorState('boot', errType);
  });
} catch (error) {
  console.error('[directions] bootstrap failed', error);
  const errType = error instanceof Error ? error.message : 'unknown';
  enterErrorState('boot', errType);
}
