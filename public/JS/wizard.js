/* ═══════════════════════════════════════════════════════════
   WIZARD.JS — גיבורים קטנים
   ═══════════════════════════════════════════════════════════ */

/* ── CONTENT ALIAS ───────────────────────────────────────── */
const WIZ_DEFAULTS = {
  topics: [],
  traits: [],
  superpowers: [],
  difficulties: [],
  goals: [],
  helpers: [],
  avoid: [],
  lengths: [],
  // Prices must match the server pricing table (backend/config/wizard.ts DIRECTION_PAGE_MAP).
  // Page numbers here = PHYSICAL pages for display ONLY (beats × 2; the engine
  // generates 8/12/16 beats). Authoritative display value: productTruth.displayPages.
  directionPackages: [
    { id: 'bedtime', label: 'סיפור לפני שינה', pagesLine: '16 עמודים', price: 59, priceILS: 59 },
    { id: 'adventure', label: 'הרפתקה', pagesLine: '24 עמודים', price: 79, priceILS: 79 },
    { id: 'fantasy', label: 'מסע פלאי', pagesLine: '32 עמודים', price: 99, priceILS: 99 },
  ],
  productPackages: [
    { id: 'bedtime', productName: 'ספר לילה טוב', pages: 16, priceILS: 59, includes: [], bestFor: [] },
    { id: 'adventure', productName: 'הרפתקה אישית', pages: 24, priceILS: 79, includes: [], bestFor: [] },
    { id: 'fantasy', productName: 'ספר פנטזיה', pages: 32, priceILS: 99, includes: [], bestFor: [] },
  ],
  styles: [],
  voices: [],
  progressLabel: 'שלב {current} מתוך {total}',
  microcopy: {
    companion: '', child: '', heroNotes: '', style: '', voice: '', book: '', product: '', summary: '',
  },
  nav: {
    back: 'חזרה',
    continueToFamily: 'המשך',
    continueToStory: 'המשך',
    continueToPackage: 'המשך',
    continueToSummary: 'המשך',
    continueDefault: 'המשך',
  },
  steps: {
    s1: { title: '', sub: '', cta: '' },
    s2: { title: '', sub: '' },
    companion: { title: '', sub: '' },
    s3: {
      title: '', sub: '', nameLabel: '', ageLabel: '', genderLabel: '',
      genderBoy: '', genderGirl: '', genderOther: '',
      photoPrompt: '', photoOptional: '',
    },
    heroNotes: {
      titleFallback: '', titleTemplate: '', sub: '', strengthQ: '', feelingQ: '',
    },
    s4fam: {
      title: '', sub: '', sub2: '', parent1Label: '', parent2Label: '', siblingLabel: '', homeLabel: '',
      parent1NamePh: '', parent1DescPh: '', parent2NamePh: '', parent2DescPh: '',
      siblingNamePh: '', siblingAgePh: '', siblingDescPh: '', homePh: '',
    },
    s4: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    s5: { title: '', sub: '', sub2: '' },
    s6: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    s7: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    sStyle: { title: '', sub: '' },
    voice: {
      title: '', subTemplate: '', subFallback: '', voicePreview: '',
      sleep: { name: '', desc: '' },
    },
    product: {
      title: '', sub: '', ctaChoose: 'לבחירה', ctaSelected: 'זו הבחירה שלי',
      bestForLabel: 'מתאים במיוחד ל:', includesLabel: 'כלול במחיר:',
    },
    s9: {
      title: '', sub: '', card1Title: '', card2Title: '', card3Title: '',
      nameLabel: '', emailLabel: '', submitBtn: '', paymentLogos: '', paymentLogosNoPhoto: '',
    },
    sBook: {
      title: '', sub: '', bookNameLabel: '', bookNameHint: '',
      dedicationHeading: '', dedicationOptional: '', dedicationHint: '', dedicationPlaceholder: '',
    },
    categoryFollowup: { title: '', sub: '' },
  },
  summary: {
    totalLabel: '', ageFormat: '{age}', childNameLabel: '', topicLabel: '', lengthLabel: '',
    styleLabel: '', audioLabel: '', pdfLabel: '', sleepLabel: '', bookDigital: '{length}',
    bundleLabel: '', audioAddon: '', pdfAddon: '', videoLabel: '', videoAddon: '',
    defaultHero: 'הגיבור/ה שלכם',
  },
};
const HE_CONTENT = globalThis.CONTENT?.he || {};
const WIZ_INPUT = HE_CONTENT.wizard || {};

function mergeWizardStep8b(defaultsBlk, inputBlk) {
  const b = defaultsBlk || {};
  const i = inputBlk || {};
  return {
    ...b,
    ...i,
    audio: { ...b.audio, ...(i.audio || {}) },
    pdf: { ...b.pdf, ...(i.pdf || {}) },
    video: { ...b.video, ...(i.video || {}) },
    bundle: { ...b.bundle, ...(i.bundle || {}) },
    sleep: { ...b.sleep, ...(i.sleep || {}) },
  };
}

const WIZ_STEPS_IN = WIZ_INPUT.steps || {};

const WIZ = {
  ...WIZ_DEFAULTS,
  ...WIZ_INPUT,
  nav: { ...WIZ_DEFAULTS.nav, ...(WIZ_INPUT.nav || {}) },
  microcopy: { ...WIZ_DEFAULTS.microcopy, ...(WIZ_INPUT.microcopy || {}) },
  summary: { ...WIZ_DEFAULTS.summary, ...(WIZ_INPUT.summary || {}) },
  productPackages:
    Array.isArray(WIZ_INPUT.productPackages) && WIZ_INPUT.productPackages.length > 0
      ? WIZ_INPUT.productPackages
      : WIZ_DEFAULTS.productPackages,
  steps: {
    ...WIZ_DEFAULTS.steps,
    ...(WIZ_INPUT.steps || {}),
    categoryFollowup: {
      ...WIZ_DEFAULTS.steps.categoryFollowup,
      ...((WIZ_INPUT.steps || {}).categoryFollowup || {}),
    },
    voice: {
      ...WIZ_DEFAULTS.steps.voice,
      ...((WIZ_INPUT.steps || {}).voice || {}),
      sleep: {
        ...WIZ_DEFAULTS.steps.voice.sleep,
        ...(((WIZ_INPUT.steps || {}).voice || {}).sleep || {}),
      },
    },
    product: {
      ...WIZ_DEFAULTS.steps.product,
      ...((WIZ_INPUT.steps || {}).product || {}),
    },
    sBook: {
      ...WIZ_DEFAULTS.steps.sBook,
      ...(((WIZ_INPUT.steps || {}).sBook || {})),
    },
  },
};
const COMMON = HE_CONTENT.common || { brand: '', tagline: '', navCta: '' };
const PRODUCT_PACKAGES = WIZ.productPackages;
// Must match backend/config/wizard.ts DIRECTION_PAGE_MAP — server is the source of truth.
const PRODUCT_PRICES = { bedtime: 59, adventure: 79, fantasy: 99 };
const PRODUCT_ICON_EMOJI = {
  book: '📖',
  audio: '🎧',
  pdf: '📥',
  card: '🃏',
  video: '🎬',
  gift: '🎁',
};
const LENGTH_TO_DIRECTION = { short: 'bedtime', medium: 'adventure', long: 'fantasy' };
const STORY_LENGTH_FROM_DIRECTION = { bedtime: 'short', adventure: 'medium', fantasy: 'long' };
const clientApi = window.SmallHeroesClient || window.__smallHeroesClientApi || null;
const PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_SIZE_BYTES = 15 * 1024 * 1024;

const PHOTO_ANALYSIS_STORAGE_KEY = 'smallheroes.photoAnalysis';
const PHOTO_QUALITY_STATUS = {
  GOOD: 'good',
  WARNING: 'warning',
  BLOCKED: 'blocked',
};
const PHOTO_MSG_WARNING =
  'אפשר להמשיך ככה, אבל תמונה ברורה יותר תיתן תוצאה מדויקת יותר 🙏';
const PHOTO_MSG_BLOCKED =
  'קשה לזהות את הפנים בתמונה — נסו תמונה ברורה יותר של הפנים 🙏';
const PHOTO_MSG_NO_PHOTO_HELPER =
  'כדי שהילד/ה יהיו גיבורי הספר, העלו תמונה אחת ברורה של הפנים.';
// Honest expectation-setting for the no-photo path — no overpromising.
const PHOTO_MSG_NO_PHOTO_DISCLAIMER =
  'בלי תמונה ניצור גיבור/ה מאוירים לפי הגיל והמין שבחרתם — אבל בלי תמונה אין לנו ממה לדמות, והדמות בספר לא תיראה כמו הילד/ה שלכם. אפשר להוסיף תמונה בכל שלב עד התשלום.';

const PHOTO_QUALITY_COPY = {
  good: { title: 'תמונה טובה — נוכל לבנות ממנה דמות' },
  warning: { title: PHOTO_MSG_WARNING },
  blocked: { title: PHOTO_MSG_BLOCKED },
};
const PHOTO_ANALYSIS_THRESHOLDS = {
  minGoodFaceRatio: 0.12,
  minWarningFaceRatio: 0.06,
  minBlockedFaceRatio: 0.04,
  dominantFaceRatioMin: 1.45,
  minCountedFaceRatio: 0.012,
  minSecondaryComparableRatio: 0.02,
  minSharpnessGood: 22,
  minSharpnessWarning: 14,
};
// Friendly Hebrew per reason code — mirrors lib/photo-quality-messages.ts on the
// server (the server's messageHe wins when /api/photo/analyze responds).
const PHOTO_REASON_MESSAGES_HE = [
  {
    // face_count_not_exactly_one is a legacy alias (old stored wizard states).
    codes: ['multiple_faces_no_dominant', 'face_count_not_exactly_one'],
    message: 'יש בתמונה כמה פנים בולטות ולא ברור מי הגיבור/ה — צריך תמונה שבה הילד/ה במרכז וברור.',
  },
  { codes: ['no_face_detected'], message: 'לא זוהו פנים בתמונה — נסו תמונה ברורה של הפנים.' },
  {
    codes: ['face_too_small_critical', 'face_area_too_small'],
    message: 'הפנים בתמונה קטנות מדי — נסו תמונה מקרוב יותר.',
  },
  {
    codes: ['face_too_small', 'face_borderline_size'],
    message: 'הפנים בתמונה קטנות יחסית — תמונה מקרוב תיתן תוצאה מדויקת יותר.',
  },
  { codes: ['low_sharpness', 'sharpness_too_low'], message: 'התמונה מטושטשת — נסו תמונה חדה יותר.' },
  { codes: ['low_brightness'], message: 'התמונה כהה מדי — נסו תמונה עם יותר אור.' },
  { codes: ['brightness_out_of_range'], message: 'התאורה בתמונה לא מתאימה — נסו תמונה עם אור טבעי ונעים.' },
];

function hebrewPhotoMessageFromCodes(reasonCodes) {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) return null;
  if (reasonCodes.length === 1 && reasonCodes[0] === 'no_photo') return null;
  if (reasonCodes.indexOf('analysis_unavailable') > -1) return null;
  for (const entry of PHOTO_REASON_MESSAGES_HE) {
    if (entry.codes.some((code) => reasonCodes.indexOf(code) > -1)) return entry.message;
  }
  return null;
}
const ORDER_SUBMIT_TIMEOUT_MS = 45_000;
const WIZARD_SESSION_ID_STORAGE_KEY = 'smallheroes.wizardSessionId';
const ROUTES = window.SH_ROUTES || {
  home: '/',
  wizard: '/wizard',
  generating: '/generating',
  ready: '/ready',
  reader: '/reader',
};
let isSubmittingOrder = false;
let transientWizardSessionId = null;
let pendingPhotoPickerOpen = false;

/* ── HELPER ──────────────────────────────────────────────── */
function renderTemplate(text, vars = {}) {
  return String(text || '').replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : ''
  );
}

function resolveWizardChildName() {
  return (state.childName || '').trim() || 'הילד/ה';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function reportClientIssue(reason, details) {
  if (clientApi && typeof clientApi.reportClientIssue === 'function') {
    clientApi.reportClientIssue('wizard', reason, details);
  }
}

function createClientSessionId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `wiz_${window.crypto.randomUUID()}`;
    }
  } catch (_) {}
  return `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateWizardSessionId() {
  try {
    const existing = window.localStorage.getItem(WIZARD_SESSION_ID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
    const nextId = createClientSessionId();
    window.localStorage.setItem(WIZARD_SESSION_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch (_) {
    if (!transientWizardSessionId) transientWizardSessionId = createClientSessionId();
    return transientWizardSessionId;
  }
}

function clearWizardSessionId() {
  transientWizardSessionId = null;
  try {
    window.localStorage.removeItem(WIZARD_SESSION_ID_STORAGE_KEY);
  } catch (_) {}
}

function getTraitIcon(trait) {
  const normalizedId = String(trait?.id || '').toLowerCase();
  const normalizedLabel = String(trait?.label || '').toLowerCase();
  const source = `${normalizedId} ${normalizedLabel}`;
  if (source.includes('רגיש')) return '💗';
  if (source.includes('שובב')) return '😄';
  if (source.includes('מצחיק')) return '😂';
  if (source.includes('חולם')) return '🌙';
  if (source.includes('ביישן')) return '😊';
  if (source.includes('סקרן')) return '🔍';
  if (source.includes('אמיץ')) return '🦁';
  if (source.includes('פעלתן')) return '⚡';
  if (source.includes('יצירתי')) return '🎨';
  return '✨';
}

function getStylePreviewDataUrl(styleId) {
  const stylePreviewMap = {
    soft_hand_drawn_storybook: '/art-styles/simple.jpg',
    expressive_painterly_storybook: '/art-styles/classic.jpg',
    detailed_whimsical_world: '/art-styles/style-02-preview.png',
    expressive_painterly_storybook: '/art-styles/style-02-preview.png',
  };
  return stylePreviewMap[styleId] || stylePreviewMap.soft_hand_drawn_storybook;
}

function normalizeClientStyleId(styleId) {
  const raw = String(styleId || '').trim();
  if (!raw) return 'soft_hand_drawn_storybook';
  const map = {
    soft_hand_drawn_storybook: 'soft_hand_drawn_storybook',
    expressive_painterly_storybook: 'detailed_whimsical_world',
    detailed_whimsical_world: 'detailed_whimsical_world',
    SIMPLE_CALM: 'soft_hand_drawn_storybook',
    FUN_COLORFUL: 'detailed_whimsical_world',
    EMOTIONAL_ARTISTIC: 'soft_hand_drawn_storybook',
    SIMPLE_CARTOON: 'detailed_whimsical_world',
    CLASSIC_CARTOON: 'soft_hand_drawn_storybook',
    DETAILED_CARTOON: 'detailed_whimsical_world',
    clean_cartoon_2d: 'detailed_whimsical_world',
    realistic_illustrated: 'soft_hand_drawn_storybook',
    whimsical_comic_fantasy: 'detailed_whimsical_world',
    pencil_watercolor: 'soft_hand_drawn_storybook',
    DETAILED_WHIMSICAL_WORLD: 'detailed_whimsical_world',
    detailed: 'detailed_whimsical_world',
  };
  return map[raw] || 'soft_hand_drawn_storybook';
}

/* ── STATE ──────────────────────────────────────────────────── */
const state = {
  currentStep: 1,
  totalSteps: 9,

  topic: null,
  topicLabel: '',
  /** Narrative bucket for companion art + prompts (e.g. NOISE_FEAR). */
  challengeCategory: null,
  /** API payload from /api/categories/branch?category=… */
  categoryBranching: null,
  /** { question, answer, selectedQuickAnswers? }[] — persisted on order */
  categoryAnswers: [],
  /** snake_case id from COMPANIONS_BY_CATEGORY */
  companionCharacterId: null,

  childName: "",
  childAge: "",
  childGender: "",
  childTraits: [],
  childSuperpower: [],   // multi-select superpowers selected in step 4
  childSuperpowerExtra: "",
  photo: null,
  photoQuality: {
    status: PHOTO_QUALITY_STATUS.BLOCKED,
    faceCount: 0,
    reasonCodes: ['no_photo'],
  },

  difficulties: [],
  goals: [],
  helpers: [],
  avoid: [],
  s4extra: "",
  s6extra: "",
  s7extra: "",

  /* product config — set at step 8 (product cards) */
  storyDirection: null, /* bedtime | adventure | fantasy */
  productId: null,
  priceILS: null,
  /** Server-resolved {direction,pages(beats),displayPages,priceILS,source}
   *  from /api/wizard/product-truth. UI renders displayPages ONLY. */
  productTruth: null,
  style: null,
  styleSelected: false,
  audioEnabled: true,
  voice: "mom", /* mom | dad | fairy */
  sleepMode: false,
  pdfEnabled: true,
  videoEnabled: false,
  bundleEnabled: false,
  bookName: "",
  dedication: '',

  /* contact (summary) */
  contactName: "",
  contactEmail: "",

  /** Loaded from GET /api/wizard/mvp-matrix — sellable slots + challenge cards. */
  mvpMatrix: null,
};

/* ── MVP MATRIX WIZARD FLOW ─────────────────────────────────── */
function isCompanionStepEnabled() {
  return Boolean(state.mvpMatrix?.dev?.showCompanionStep);
}

function wizardStepCount() {
  return isCompanionStepEnabled() ? 9 : 8;
}

function wizardDisplayStep(physicalStep) {
  if (!isCompanionStepEnabled() && physicalStep > 2) return physicalStep - 1;
  return physicalStep;
}

function nextPhysicalStep(physicalStep) {
  if (!isCompanionStepEnabled() && physicalStep === 1) return 3;
  return physicalStep + 1;
}

function prevPhysicalStep(physicalStep) {
  if (!isCompanionStepEnabled() && physicalStep === 3) return 1;
  return physicalStep - 1;
}

function normalizeStepAfterMvpLoad() {
  if (!isCompanionStepEnabled() && state.currentStep === 2) {
    state.currentStep = 3;
  }
  state.totalSteps = wizardStepCount();
}

function getMvpSlotForTopic(topicId) {
  if (!state.mvpMatrix?.categories) return null;
  const id = normalizeWizardTopicId(topicId);
  return (
    state.mvpMatrix.categories.find((c) => c.topicId === id) ||
    state.mvpMatrix.parkedCategories?.find((c) => c.topicId === id) ||
    null
  );
}

function getDirectionSellability(direction) {
  const cat = state.challengeCategory;
  if (!cat || !state.mvpMatrix?.categories) return { sellable: true, configured: 'approved' };
  const slot = state.mvpMatrix.categories.find((c) => c.category === cat);
  return slot?.directions?.[direction] || { sellable: false, configured: 'missing' };
}

function applyMatrixCompanionForCategory(category) {
  if (!category || !state.mvpMatrix?.categories) return;
  const slot = state.mvpMatrix.categories.find((c) => c.category === category);
  if (slot?.companion?.id) {
    state.companionCharacterId = slot.companion.id;
    state.productTruth = null;
  }
}

async function loadMvpMatrix() {
  try {
    const res = await fetch('/api/wizard/mvp-matrix', { cache: 'no-store' });
    if (!res.ok) {
      console.error('[wizard] mvp-matrix HTTP', res.status);
      return;
    }
    state.mvpMatrix = await res.json();
    normalizeStepAfterMvpLoad();
    if (state.challengeCategory) {
      applyMatrixCompanionForCategory(state.challengeCategory);
    }
  } catch (err) {
    console.error('[wizard] mvp-matrix load failed', err);
  }
}

/* ── PRICING ─────────────────────────────────────────────────── */
const PRICES = {
  base: PRODUCT_PRICES,
};

const WIZARD_STORAGE_KEY = 'wizard_state';
const PREFERRED_DIRECTION_STORAGE_KEY = 'preferredDirection';
const VALID_STORY_DIRECTIONS = ['bedtime', 'adventure', 'fantasy'];

/** Hint after resume: preview was stripped from sessionStorage. */
let sessionExpectChildPhotoReplay = false;
let wizardSaveQueued = false;

function queueWizardSave() {
  if (wizardSaveQueued) return;
  wizardSaveQueued = true;
  requestAnimationFrame(() => {
    wizardSaveQueued = false;
    saveWizardState();
  });
}

function applyInitialDirectionFromContext() {
  const params = new URLSearchParams(window.location.search);
  const directionParam = params.get('direction');
  if (VALID_STORY_DIRECTIONS.includes(directionParam)) {
    state.storyDirection = directionParam;
    state.productId = directionParam;
    return;
  }
  try {
    const stored = localStorage.getItem(PREFERRED_DIRECTION_STORAGE_KEY);
    if (VALID_STORY_DIRECTIONS.includes(stored)) {
      state.storyDirection = stored;
      state.productId = stored;
      return;
    }
  } catch (_) {
    /* localStorage unavailable */
  }
  state.storyDirection = null;
  state.productId = null;
}

function persistPreferredDirection(direction) {
  if (!VALID_STORY_DIRECTIONS.includes(direction)) return;
  try {
    localStorage.setItem(PREFERRED_DIRECTION_STORAGE_KEY, direction);
  } catch (_) {
    /* localStorage unavailable */
  }
}

function saveWizardState() {
  try {
    const serializable = {
      ...state,
      photo: null,
    };
    sessionStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({
        step: state.currentStep,
        state: serializable,
        meta: { expectChildPhotoReplay: Boolean(state.photo) },
        timestamp: Date.now(),
      }),
    );
  } catch (_) {
    /* sessionStorage unavailable or quota */
  }
}

/** Map saved step numbers from the old 15-step wizard to the 10-step flow. */
function migrate15to10(step) {
  const n = Number(step) || 1;
  if (n <= 2) return n;
  if (n === 3 || n === 4) return 3;
  if (n === 5) return 4;
  if (n === 6) return 5;
  if (n >= 7 && n <= 10) return 6;
  if (n === 11) return 6;
  if (n === 12) return 7;
  if (n === 13) return 8;
  if (n === 14) return 9;
  if (n >= 15) return 10;
  return Math.min(Math.max(n, 1), 10);
}

/** Map legacy wizard step numbers to the current 9-step flow. */
function migrateLegacyWizardStep(step) {
  let n = Number(step) || 1;
  if (n > 10) {
    n = migrate15to10(n);
  }
  const tenToNine = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 8, 7: 5, 8: 6, 9: 7, 10: 9 };
  let mapped = tenToNine[n] || 1;
  if (!isCompanionStepEnabled() && mapped === 2) mapped = 3;
  return mapped;
}

function normalizeProductStateFromLegacy() {
  if (state.productId && VALID_STORY_DIRECTIONS.includes(state.productId)) {
    applyProductSelection(state.productId, { revealTotal: false });
    return;
  }
  if (state.storyDirection && VALID_STORY_DIRECTIONS.includes(state.storyDirection)) {
    applyProductSelection(state.storyDirection, { revealTotal: false });
    return;
  }
  state.storyDirection = null;
  state.productId = null;
  state.priceILS = null;
}

function applyProductSelection(packageId, options = {}) {
  const pkg = PRODUCT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return;
  state.storyDirection = packageId;
  state.productId = packageId;
  state.priceILS = pkg.priceILS;
  state.audioEnabled = true;
  state.pdfEnabled = true;
  state.videoEnabled = packageId === 'fantasy';
  state.bundleEnabled = false;
  if (!state.voice) state.voice = 'mom';
  persistPreferredDirection(packageId);
  refreshTotal();
  if (options.revealTotal !== false) {
    const bbt = document.getElementById('bottom-bar-total');
    if (bbt) bbt.hidden = false;
  }
}

function restoreWizardState() {
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot.step !== 'number' || !snapshot.state || typeof snapshot.state !== 'object') {
      return false;
    }
    if (Date.now() - snapshot.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(WIZARD_STORAGE_KEY);
      sessionExpectChildPhotoReplay = false;
      return false;
    }
    sessionExpectChildPhotoReplay = snapshot.meta?.expectChildPhotoReplay === true;
    Object.assign(state, snapshot.state);
    state.currentStep = migrateLegacyWizardStep(snapshot.step);
    if (typeof state.storyDirection !== 'string' || !state.storyDirection) {
      const legacy = state.length;
      if (legacy === 'short' || legacy === 'medium' || legacy === 'long') {
        state.storyDirection = LENGTH_TO_DIRECTION[legacy] || 'adventure';
      } else {
        state.storyDirection = null;
      }
    }
    if ('length' in state) delete state.length;
    if (!Array.isArray(state.childTraits)) state.childTraits = [];
    if (!Array.isArray(state.childSuperpower)) state.childSuperpower = [];
    if (!Array.isArray(state.difficulties)) state.difficulties = [];
    if (!Array.isArray(state.goals)) state.goals = [];
    if (!Array.isArray(state.helpers)) state.helpers = [];
    if (!Array.isArray(state.avoid)) state.avoid = [];
    if (!Array.isArray(state.categoryAnswers)) state.categoryAnswers = [];
    if (typeof state.dedication !== 'string') state.dedication = '';
    if (typeof state.videoEnabled !== 'boolean') state.videoEnabled = false;
    normalizeProductStateFromLegacy();
    if (typeof state.styleSelected !== 'boolean') {
      state.styleSelected = Boolean(state.style);
    }
    // Restored sessions may carry the not-yet-sellable Style 02 — force a re-pick.
    if (state.style && normalizeClientStyleId(state.style) === 'detailed_whimsical_world') {
      state.style = null;
      state.styleSelected = false;
    }
    if (state.style) {
      state.style = normalizeClientStyleId(state.style);
    } else {
      state.style = null;
    }
    state.photo = null;
    if (state.topic) {
      state.topic = normalizeWizardTopicId(state.topic);
      const topicMeta = TOPICS.find((t) => t.id === state.topic);
      if (topicMeta) state.topicLabel = topicMeta.label;
    }
    applyChallengeCategoryForTopic(state.topic, false);
    const catalog = getTopicCatalog();
    if (state.companionCharacterId && catalog) {
      const resolved = catalog.resolveCategoryFromCompanionId(state.companionCharacterId);
      const expected = catalog.getCategoryForTopic(state.topic);
      if (resolved && resolved !== expected) {
        console.warn(
          `[wizard] companion "${state.companionCharacterId}" category ${resolved} differs from topic ${expected} — keeping topic category`,
        );
      }
    }
    return true;
  } catch (_) {
    sessionExpectChildPhotoReplay = false;
    return false;
  }
}

function hydrateDraftFieldsFromState() {
  const cn = document.getElementById('child-name');
  if (cn) cn.value = state.childName || '';
  const ca = document.getElementById('child-age');
  if (ca) ca.value = state.childAge || '';
  const cg = document.getElementById('child-gender');
  if (cg) cg.value = state.childGender || '';
  const s4e = document.getElementById('s4-extra');
  if (s4e) s4e.value = state.s4extra || '';
  const s6e = document.getElementById('s6-extra');
  if (s6e) s6e.value = state.s6extra || '';
  const s7e = document.getElementById('s7-extra');
  if (s7e) s7e.value = state.s7extra || '';
  const spe = document.getElementById('s4power-extra');
  if (spe) spe.value = state.childSuperpowerExtra || '';
  const bookNameInput = document.getElementById('bookNameInput');
  if (bookNameInput) bookNameInput.value = state.bookName || '';
  const dedicationInput = document.getElementById('dedicationInput');
  if (dedicationInput) {
    dedicationInput.value = state.dedication || '';
    const dedicationCount = document.getElementById('dedicationCount');
    if (dedicationCount) dedicationCount.textContent = String((dedicationInput.value || '').length);
  }
  const cName = document.getElementById('contact-name');
  if (cName) cName.value = state.contactName || '';
  const cEmail = document.getElementById('contact-email');
  if (cEmail) cEmail.value = state.contactEmail || '';
}

function hydrateWizardMultiSelectChips() {
  /** @param {'difficulties'|'goals'|'helpers'|'avoid'} key */
  const syncStep = (stepSelector, key) => {
    const arr = state[key] || [];
    document.querySelectorAll(`${stepSelector} .chip`).forEach((el) => {
      const val = el.textContent.trim();
      if (!val) return;
      el.classList.toggle('selected', arr.indexOf(val) > -1);
    });
  };
  syncStep('#step-4', 'goals');
  const spWrap = document.getElementById('hero-superpower-chips');
  if (spWrap) {
    const arr = state.childSuperpower || [];
    spWrap.querySelectorAll('.trait-chip').forEach((el) => {
      const val = el.textContent.trim();
      el.classList.toggle('selected', arr.indexOf(val) > -1);
    });
  }
}

function bindDraftFieldPersistListeners() {
  const bindInput = (id, apply) => {
    const el = document.getElementById(id);
    if (!el) return;
    const run = () => {
      apply(el);
      queueWizardSave();
    };
    el.addEventListener('input', run);
    el.addEventListener('change', run);
  };
  bindInput('child-name', (el) => {
    state.childName = String(el.value || '').trim();
  });
  bindInput('child-age', (el) => {
    state.childAge = String(el.value || '').trim();
  });
  bindInput('child-gender', (el) => {
    state.childGender = String(el.value || '').trim();
  });
  bindInput('s4-extra', (el) => {
    state.s4extra = String(el.value || '');
  });
  bindInput('s6-extra', (el) => {
    state.s6extra = String(el.value || '');
  });
  bindInput('s7-extra', (el) => {
    state.s7extra = String(el.value || '');
  });
  bindInput('s4power-extra', (el) => {
    state.childSuperpowerExtra = String(el.value || '').trim();
  });
  bindInput('contact-name', (el) => {
    state.contactName = String(el.value || '').trim();
  });
  bindInput('contact-email', (el) => {
    state.contactEmail = String(el.value || '').trim();
  });
  const bookNameInput = document.getElementById('bookNameInput');
  if (bookNameInput) {
    bookNameInput.addEventListener('input', () => {
      state.bookName = bookNameInput.value.trim();
      queueWizardSave();
    });
  }
  const dedicationInput = document.getElementById('dedicationInput');
  const dedicationCount = document.getElementById('dedicationCount');
  if (dedicationInput) {
    const syncDedicationCount = () => {
      if (dedicationCount) dedicationCount.textContent = String((dedicationInput.value || '').length);
    };
    syncDedicationCount();
    dedicationInput.addEventListener('input', () => {
      state.dedication = dedicationInput.value.slice(0, 300);
      syncDedicationCount();
      queueWizardSave();
    });
  }
}

function computeTotal() {
  // Server-resolved truth wins — it reflects the story that will actually be served.
  if (state.productTruth && typeof state.productTruth.priceILS === 'number') {
    return { base: state.productTruth.priceILS, addons: 0, total: state.productTruth.priceILS };
  }
  if (state.priceILS != null) {
    return { base: state.priceILS, addons: 0, total: state.priceILS };
  }
  // No silent fallback to another package's price — unknown direction shows 0
  // until the user picks; the server rejects orders without a real direction.
  const base = state.storyDirection ? PRICES.base[state.storyDirection] || 0 : 0;
  return { base, addons: 0, total: base };
}

/* ── SERVER PRODUCT TRUTH ───────────────────────────────────── */
// Asks the server which direction/pages/price the chosen companion's story
// actually has (e.g. a v3-approved binding forces bedtime/10/₪59). The server
// is authoritative — the summary must match the book that will be generated.
let productTruthFetchSeq = 0;
async function syncProductTruthFromServer() {
  const companionId = state.companionCharacterId || '';
  const direction = state.storyDirection || '';
  if (!companionId && !direction) return;
  const seq = ++productTruthFetchSeq;
  try {
    const params = new URLSearchParams();
    if (companionId) params.set('companionId', companionId);
    if (direction) params.set('direction', direction);
    const res = await fetch(`/api/wizard/product-truth?${params.toString()}`);
    if (seq !== productTruthFetchSeq) return;
    if (!res.ok) return; /* e.g. direction not chosen yet — server validates again at order time */
    const truth = await res.json();
    if (seq !== productTruthFetchSeq) return;
    if (!truth || !VALID_STORY_DIRECTIONS.includes(truth.direction)) return;
    state.productTruth = truth;
    if (truth.direction !== state.storyDirection) {
      // Story binding overrides the local choice (summary == served book).
      applyProductSelection(truth.direction, { revealTotal: false });
    }
    state.priceILS = truth.priceILS;
    if (state.currentStep === 8) {
      renderProductCards();
      refreshTotal();
    } else if (state.currentStep === 9) {
      buildSummary();
      refreshTotal();
    }
    queueWizardSave();
  } catch (_) {
    /* network failure — order API still enforces the truth server-side */
  }
}

/* ── STATIC DATA ─────────────────────────────────────────────── */
// All sourced from CONTENT — shape is identical, no logic changes.
// NOTE: TRAITS was previously a plain string array; CONTENT.he.wizard.traits
// is [{id, label}]. renderTraits updated to use t.label — stored value
// (Hebrew label string in state.childTraits) is unchanged.
const TOPICS              = WIZ.topics;
const TRAITS              = WIZ.traits;
const ILLUSTRATION_STYLES = WIZ.styles;
const VOICES              = WIZ.voices;

const TopicCatalog = globalThis.CanonicalTopics || null;

function getTopicCatalog() {
  if (!TopicCatalog) {
    console.error('[wizard] CanonicalTopics not loaded — check canonical-topics.js script order');
  }
  return TopicCatalog;
}

function normalizeWizardTopicId(topicId) {
  const catalog = getTopicCatalog();
  return catalog ? catalog.normalizeTopicId(topicId) : String(topicId || '').trim();
}

function getCategoriesForWizardTopic(topicId) {
  const catalog = getTopicCatalog();
  if (!catalog) return ['OTHER'];
  return catalog.getCategoriesForTopic(topicId);
}

function applyChallengeCategoryForTopic(topicId) {
  const id = normalizeWizardTopicId(topicId);
  if (!id) {
    state.challengeCategory = null;
    return null;
  }
  const catalog = getTopicCatalog();
  state.challengeCategory = catalog
    ? catalog.getCategoryForTopic(id)
    : getCategoriesForWizardTopic(id)[0] || 'OTHER';
  return state.challengeCategory;
}

/** Category key for /api/categories/branch. */
function getBranchCategoryForTopic(topicId) {
  return applyChallengeCategoryForTopic(topicId) || 'OTHER';
}

function normalizeFollowupQuestion(questionItem, index) {
  if (typeof questionItem === 'string') {
    return {
      id: `q_${index + 1}`,
      question: questionItem,
      quickAnswers: [],
      placeholder: 'פרטו עוד אם תרצו',
      priority: 0,
      intent: '',
      showIf: null,
    };
  }
  if (!questionItem || typeof questionItem !== 'object') return null;
  const question = typeof questionItem.question === 'string' ? questionItem.question : '';
  if (!question) return null;
  const quickAnswers = Array.isArray(questionItem.quickAnswers)
    ? questionItem.quickAnswers.filter((a) => typeof a === 'string' && a.trim())
    : [];
  return {
    id: typeof questionItem.id === 'string' ? questionItem.id : `q_${index + 1}`,
    question,
    quickAnswers,
    placeholder:
      typeof questionItem.placeholder === 'string' && questionItem.placeholder.trim()
        ? questionItem.placeholder
        : 'פרטו עוד אם תרצו',
    priority: Number.isFinite(Number(questionItem.priority)) ? Number(questionItem.priority) : 0,
    intent: typeof questionItem.intent === 'string' ? questionItem.intent : '',
    showIf: questionItem.showIf && typeof questionItem.showIf === 'object' ? questionItem.showIf : null,
  };
}

let followupUpdateTimer = null;
let followupRefreshSerial = 0;

function getNormalizedFollowupQuestions() {
  const questions = Array.isArray(state.categoryBranching?.followUpQuestions)
    ? state.categoryBranching.followUpQuestions
    : [];
  return questions.slice(0, 3).map((q, i) => normalizeFollowupQuestion(q, i)).filter(Boolean);
}

function collectFollowupDraftFromDom() {
  const wrap = document.getElementById('category-followup-wrap');
  const questions = getNormalizedFollowupQuestions();
  if (!wrap || questions.length === 0) return [];
  return questions.map((item, i) => {
    const textEl = wrap.querySelector(`[data-cat-q-text="${i}"]`);
    const selectedQuickAnswers = Array.from(wrap.querySelectorAll(`[data-cat-q-chip="${i}"].selected`))
      .map((node) => String(node.getAttribute('data-chip-value') || '').trim())
      .filter(Boolean);
    return {
      questionId: item.id,
      question: item.question,
      answer: textEl && 'value' in textEl ? String(textEl.value || '').trim() : '',
      ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
    };
  });
}

function persistFollowupDraftFromDom() {
  state.categoryAnswers = collectFollowupDraftFromDom();
}

function upsertCategoryAnswerDraft(nextDraft) {
  const current = Array.isArray(state.categoryAnswers) ? [...state.categoryAnswers] : [];
  const idx = current.findIndex((row) => row && row.questionId === nextDraft.questionId);
  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      ...nextDraft,
    };
  } else {
    current.push(nextDraft);
  }
  state.categoryAnswers = current;
  queueWizardSave();
}

function getChallengeCategoryForTopicId(topicId) {
  return applyChallengeCategoryForTopic(topicId);
}

async function fetchCategoryBranching(category, currentAnswers) {
  const query = new URLSearchParams();
  query.set('category', String(category || ''));
  if (Array.isArray(currentAnswers) && currentAnswers.length > 0) {
    const compactAnswers = currentAnswers.map((item) => ({
      ...(item?.questionId ? { questionId: item.questionId } : {}),
      ...(Array.isArray(item?.selectedQuickAnswers) ? { selectedQuickAnswers: item.selectedQuickAnswers } : {}),
    }));
    query.set('currentAnswers', JSON.stringify(compactAnswers));
  }
  const response = await fetch('/api/categories/branch?' + query.toString(), { cache: 'no-store' });
  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch (e) { /* empty */ }
    throw new Error(`status=${response.status} body=${errBody}`);
  }
  return response.json();
}

function renderCompanionCards() {
  const grid = document.getElementById('companion-cards');
  if (!grid) return;

  const topicId = normalizeWizardTopicId(state.topic);
  const cat = state.challengeCategory;
  const map = globalThis.COMPANIONS_BY_CATEGORY;
  if (!topicId || !cat || !map || !Array.isArray(map[cat])) {
    grid.innerHTML = '';
    grid.removeAttribute('data-challenge-category');
    return;
  }

  grid.dataset.challengeCategory = cat;
  const list = map[cat];
  if (list.length === 0) {
    grid.innerHTML = '';
    return;
  }

  grid.replaceChildren();

  list.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'companion-card' + (state.companionCharacterId === c.id ? ' selected' : '');

    const inner = document.createElement('span');
    inner.className = 'companion-card-inner';

    const box = document.createElement('span');
    box.className = 'companion-img-box';

    const img = document.createElement('img');
    img.className = 'companion-img';
    img.alt = '';
    img.loading = 'lazy';
    img.src = c.image;

    const ph = document.createElement('span');
    ph.className = 'companion-img-placeholder';
    ph.hidden = true;
    const phText = document.createElement('span');
    phText.className = 'companion-img-placeholder-text';
    phText.textContent = c.name;
    ph.appendChild(phText);

    const markBad = () => {
      img.classList.add('is-hidden');
      ph.hidden = false;
    };

    img.addEventListener('error', markBad);
    img.addEventListener('load', () => {
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) markBad();
    });

    box.appendChild(img);
    box.appendChild(ph);

    const nameEl = document.createElement('span');
    nameEl.className = 'companion-name';
    nameEl.textContent = c.name;

    const tagEl = document.createElement('span');
    tagEl.className = 'companion-tagline';
    tagEl.textContent = c.tagline;

    inner.appendChild(box);
    inner.appendChild(nameEl);
    inner.appendChild(tagEl);
    btn.appendChild(inner);

    btn.addEventListener('click', () => {
      state.companionCharacterId = c.id;
      state.productTruth = null; /* re-resolve product truth for the new companion */
      const catalog = getTopicCatalog();
      if (catalog) {
        const resolved = catalog.resolveCategoryFromCompanionId(c.id);
        const expected = catalog.getCategoryForTopic(topicId);
        if (resolved && resolved !== expected) {
          console.warn(
            `[wizard] companion "${c.id}" maps to ${resolved}, topic expects ${expected} — keeping topic category`,
          );
        }
      }
      grid.querySelectorAll('.companion-card').forEach((n) => n.classList.remove('selected'));
      btn.classList.add('selected');
      const cont = document.getElementById('btn-continue');
      if (cont && state.currentStep === 2) cont.disabled = false;
      queueWizardSave();
    });

    grid.appendChild(btn);
  });
}

/* ── INIT ────────────────────────────────────────────────────── */
function init() {
  state.style = state.style ? normalizeClientStyleId(state.style) : null;
  pendingPhotoPickerOpen = false;
  initWizardContent();
  const restored = restoreWizardState();
  if (!restored) {
    applyInitialDirectionFromContext();
    state.style = null;
    state.styleSelected = false;
  }
  bindDraftFieldPersistListeners();
  buildPills();
  renderSuperpowerChips();
  renderGoalsChips();
  renderProductCards();
  renderStyleStepGrid();
  renderVoiceBtns();
  bindPhotoUploadInteractions();
  restorePhotoQualityFromStorage();
  renderPhotoUploadArea();
  renderPhotoQualityMessage();
  loadMvpMatrix().finally(() => {
    normalizeStepAfterMvpLoad();
    buildPills();
    renderTopics();
    updateUI();
    refreshTotal();
  });
  updateUI();
  refreshTotal();
  track('wizard_started');
}

/* ── STATIC CONTENT BINDING ──────────────────────────────────── */
function initWizardContent() {

  // Nav
  setText('wizNavBrand',   COMMON.brand);
  setText('wizNavTagline', COMMON.tagline);
  setText('wizNavCta',     COMMON.navCta);

  // Step 1 — topic
  setText('s2Title', WIZ.steps.s2.title);
  setText('s2Sub',   WIZ.steps.s2.sub);

  // Step 2 — companion
  setText('companionMicro', WIZ.microcopy.companion || '');
  setText('companionTitle', WIZ.steps.companion?.title || '');
  setText('companionSub',   WIZ.steps.companion?.sub || '');

  setText('childMicro',     WIZ.microcopy.child || '');
  setText('heroNotesMicro', WIZ.microcopy.heroNotes || '');
  setText('styleMicro',     WIZ.microcopy.style || '');
  setText('voiceMicro',     WIZ.microcopy.voice || '');
  setText('bookMicro',      WIZ.microcopy.book || '');
  setText('productMicro',   WIZ.microcopy.product || '');
  setText('summaryMicro',   WIZ.microcopy.summary || '');

  // Step 3 — child details
  setText('s3Title',          WIZ.steps.s3.title);
  setText('s3Sub',            WIZ.steps.s3.sub);
  setText('s3NameLabel',      WIZ.steps.s3.nameLabel);
  setText('s3AgeLabel',       WIZ.steps.s3.ageLabel);
  setText('s3GenderLabel',    WIZ.steps.s3.genderLabel);
  setText('s3GenderOptBoy',   WIZ.steps.s3.genderBoy);
  setText('s3GenderOptGirl',  WIZ.steps.s3.genderGirl);
  setText('s3GenderOptOther', WIZ.steps.s3.genderOther);
  setText('s3PhotoPrompt',    WIZ.steps.s3.photoPrompt);
  setText('s3PhotoOptional',  WIZ.steps.s3.photoOptional);

  // Step 4 — hero notes (optional)
  const hn = WIZ.steps.heroNotes || {};
  setText('heroNotesSub', hn.sub || '');
  setText('heroNotesStrengthQ', renderTemplate(hn.strengthQ || '', { name: resolveWizardChildName() }));
  setText('heroNotesFeelingQ', renderTemplate(hn.feelingQ || '', { name: resolveWizardChildName() }));

  // Step 5 — style
  setText('sStyleTitle', WIZ.steps.sStyle.title);
  setText('sStyleSub',   WIZ.steps.sStyle.sub);

  // Step 6 — voice
  const voiceCopy = WIZ.steps.voice || {};
  setText('voiceTitle', WIZ.steps.voice?.title || '');
  setText('voiceSleepName', voiceCopy.sleep?.name || '');
  setText('voiceSleepDesc', voiceCopy.sleep?.desc || '');

  // Step 8 — product
  setText('productTitle', WIZ.steps.product?.title || '');
  setText('productSub',   WIZ.steps.product?.sub || '');
  setText('bottomBarTotalLabel', 'סה"כ:');

  // Step 7 — book + dedication
  const sBook = WIZ.steps.sBook || WIZ_DEFAULTS.steps.sBook;
  setText('sBookTitle', sBook.title);
  setText('sBookSub', sBook.sub);
  setText('sBookNameLabel', sBook.bookNameLabel);
  setText('sBookNameHint', sBook.bookNameHint);
  setText('dedicationHeading', sBook.dedicationHeading);
  setText('dedicationOptionalBadge', sBook.dedicationOptional);
  setText('dedicationHint', sBook.dedicationHint);
  const ded = document.getElementById('dedicationInput');
  if (ded && sBook.dedicationPlaceholder) ded.placeholder = sBook.dedicationPlaceholder;

  // Step 15 — summary + payment
  setText('s9Title', renderTemplate(WIZ.steps.s9.title, { name: resolveWizardChildName() }));
  setText('s9Sub',          WIZ.steps.s9.sub);
  setText('s9CardBookTitle',    WIZ.steps.s9.cardBookTitle || WIZ.steps.s9.card2Title);
  setText('s9CardDetailsTitle', WIZ.steps.s9.cardDetailsTitle || WIZ.steps.s9.card1Title);
  setText('s9NameLabel',    WIZ.steps.s9.nameLabel);
  setText('s9EmailLabel',   WIZ.steps.s9.emailLabel);
  setText('btn-pay',        WIZ.steps.s9.submitBtn);
  setText('s9PaymentLogos', WIZ.steps.s9.paymentLogos);

  // Bottom bar — back button is always static; continue is set by updateUI
  setText('btn-back', WIZ.nav.back);
}

/* ── HELPERS (legacy add-ons — step removed) ─────────────────── */
function isVoicePanelActive() {
  return true;
}

function syncWizardLayout() {
  /* add-ons layout retired */
}

function applyAddonsStepLayout() {
  /* add-ons layout retired */
}

function syncStep8Layout() {
  /* add-ons layout retired */
}

/* ── PROGRESS PILLS ──────────────────────────────────────────── */
function buildPills() {
  const c = document.getElementById("progress-pills");
  if (!c) return;

  c.innerHTML = "";
  state.totalSteps = wizardStepCount();

  for (let i = 1; i <= state.totalSteps; i++) {
    const p = document.createElement("div");
    p.className = "pill";
    p.id = "pill-" + i;
    c.appendChild(p);
  }
}

function updateProgress() {
  const displayStep = wizardDisplayStep(state.currentStep);
  const total = wizardStepCount();
  const lbl = document.getElementById("progress-label");
  if (lbl) lbl.textContent = WIZ.progressLabel
    .replace('{current}', displayStep)
    .replace('{total}', total);

  for (let i = 1; i <= total; i++) {
    const p = document.getElementById("pill-" + i);
    if (!p) continue;

    p.className =
      "pill" +
      (i < displayStep
        ? " done"
        : i === displayStep
        ? " active"
        : "");
  }
}

/* ── UI ──────────────────────────────────────────────────────── */
function updateUI() {
  hydrateDraftFieldsFromState();
  hydrateWizardMultiSelectChips();

  updateProgress();
  syncWizardLayout();

  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));

  const el = document.getElementById("step-" + state.currentStep);
  if (el) {
    el.classList.add("active");
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
  }

  const bar        = document.getElementById("bottom-bar");
  const btn        = document.getElementById("btn-continue");
  const backBtn    = document.getElementById("btn-back");
  const btnAnyway  = document.getElementById("btn-continue-anyway");

  if (bar && btn && backBtn) {
    if (state.currentStep <= 1 || state.currentStep === 9) {
      bar.classList.add("hidden");
      if (btnAnyway) btnAnyway.hidden = true;
    } else {
      bar.classList.remove("hidden");

      if (state.currentStep === 3) {
        updatePhotoStepBottomBar();
      } else {
        btn.textContent =
          state.currentStep === 4  ? WIZ.nav.continueToStory   :
          state.currentStep === 7  ? WIZ.nav.continueToSummary :
          WIZ.nav.continueDefault;
        btn.onclick = goNext;
        if (btnAnyway) btnAnyway.hidden = true;
        if (state.currentStep === 2) {
          btn.disabled = !state.companionCharacterId;
        } else if (state.currentStep === 5) {
          btn.disabled = !state.styleSelected;
        } else if (state.currentStep === 8) {
          btn.disabled = !state.productId;
        } else {
          btn.disabled = false;
        }
      }

      if (state.currentStep <= 1) {
        backBtn.classList.add("hidden");
      } else {
        backBtn.classList.remove("hidden");
      }
    }
  }

  if (state.currentStep === 2) {
    renderCompanionCards();
  }

  if (state.currentStep === 4) {
    updateHeroNotesTitle();
    renderSuperpowerChips();
    renderGoalsChips();
  }

  const bottomBarTotal = document.getElementById('bottom-bar-total');
  if (bottomBarTotal) {
    bottomBarTotal.hidden = !(state.currentStep >= 8 && Boolean(state.productId));
  }

  if (state.currentStep === 6) {
    updateVoiceStepSubtitle();
    renderVoiceBtns();
    syncSleepToggleUI();
  }

  if (state.currentStep === 5) {
    renderStyleStepGrid();
  }

  if (state.currentStep === 8) {
    renderProductCards();
    refreshTotal();
    syncProductTruthFromServer();
  }

  if (state.currentStep === 9) {
    setText('s9Title', renderTemplate(WIZ.steps.s9.title, { name: resolveWizardChildName() }));
    buildSummary();
    syncProductTruthFromServer();
  }

  const photoHint = document.getElementById('photo-reupload-hint');
  if (photoHint) {
    if (state.currentStep === 3) {
      photoHint.hidden = !(sessionExpectChildPhotoReplay && !state.photo);
    } else {
      photoHint.hidden = true;
    }
  }

  saveWizardState();
}

/* ── NAVIGATION ──────────────────────────────────────────────── */
function goNext() {
  const stepBeforeAdvance = state.currentStep;

  if (state.currentStep === 2) {
    if (!state.companionCharacterId) {
      const grid = document.getElementById('companion-cards');
      if (grid) {
        grid.style.animation = 'none';
        void grid.offsetHeight;
        grid.style.animation = 'shake 0.4s ease';
      }
      return;
    }
  }

  if (state.currentStep === 3) {
    state.childName   = document.getElementById("child-name")?.value.trim() || "";
    state.childAge    = document.getElementById("child-age")?.value || "";
    state.childGender = document.getElementById("child-gender")?.value || "";

    if (!state.childName) {
      shake(document.getElementById("child-name"));
      return;
    }

    // No photo is allowed (generic-child path, disclaimer shown at this step) —
    // but a photo that EXISTS and is BLOCKED must be replaced or explicitly
    // cleared before continuing.
    if (state.photo && state.photoQuality?.status === PHOTO_QUALITY_STATUS.BLOCKED) {
      shake(document.getElementById('photo-area'));
      renderPhotoQualityMessage();
      return;
    }
  }

  if (state.currentStep === 7) {
    state.bookName = document.getElementById("bookNameInput")?.value.trim() || "";
    state.dedication = (document.getElementById("dedicationInput")?.value || "").slice(0, 300);
  }

  if (state.currentStep === 8 && !state.productId) {
    const grid = document.getElementById('product-cards');
    if (grid) {
      grid.style.animation = 'none';
      void grid.offsetHeight;
      grid.style.animation = 'shake 0.4s ease';
    }
    return;
  }

  if (state.currentStep === 9) {
    if (isSubmittingOrder) return;
    state.contactName  = document.getElementById("contact-name")?.value.trim() || "";
    state.contactEmail = document.getElementById("contact-email")?.value.trim() || "";

    if (!state.contactName || !state.contactEmail) {
      if (!state.contactName)  shake(document.getElementById("contact-name"));
      if (!state.contactEmail) shake(document.getElementById("contact-email"));
      return;
    }
    // Photo quality never blocks checkout.

    handleSubmit();
    return;
  }

  if (stepBeforeAdvance === 8) {
    persistPreferredDirection(state.storyDirection);
  }

  if (stepBeforeAdvance === 5 && !state.styleSelected) {
    const grid = document.getElementById('style-step-grid');
    if (grid) {
      grid.style.animation = 'none';
      void grid.offsetHeight;
      grid.style.animation = 'shake 0.4s ease';
    }
    return;
  }

  state.currentStep = nextPhysicalStep(stepBeforeAdvance);
  updateUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shake(el) {
  if (!el) return;

  el.style.borderColor = "#ff6b6b";
  el.style.animation   = "shake 0.4s ease";
  el.focus();

  setTimeout(() => {
    el.style.borderColor = "";
    el.style.animation   = "";
  }, 2200);
}

function goBack() {
  if (state.currentStep <= 1) return;

  state.currentStep = prevPhysicalStep(state.currentStep);

  updateUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── TOPIC CHIPS (flat ordered flow) ─────────────────────────── */

function loadCategoryBranchForTopic(topicId, afterSelect) {
  const branchCat = getBranchCategoryForTopic(topicId);
  (async function loadBranch() {
    try {
      const data = await fetchCategoryBranching(branchCat);
      state.categoryBranching = { ...data, _fetchFailed: false };
    } catch (e) {
      console.error('[wizard] category branch network failed', e);
      state.categoryBranching = {
        followUpQuestions: [],
        hebrewLabel: state.topicLabel,
        _fetchFailed: true,
      };
    }
    queueWizardSave();
    if (afterSelect) {
      setTimeout(afterSelect, 220);
    }
  })();
}

function addTopicChip(wrap, t, afterSelect) {
  const d = document.createElement('div');
  d.className = 'chip';
  d.textContent = t.label;
  d.setAttribute('data-id', t.id);
  if (t.wizardDescription) d.setAttribute('title', t.wizardDescription);
  d.addEventListener('click', () => {
    const root = document.getElementById('topic-chips');
    if (root) root.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    d.classList.add('selected');
    const previousTopic = state.topic;
    const isReselect = previousTopic === t.id;
    if (!isReselect && previousTopic) {
      state.companionCharacterId = null;
    }
    state.topic = t.id;
    state.topicLabel = t.label;
    applyChallengeCategoryForTopic(t.id);

    if (isReselect && state.categoryBranching && !state.categoryBranching._fetchFailed) {
      queueWizardSave();
      if (afterSelect) {
        setTimeout(afterSelect, 220);
      }
      return;
    }

    if (!isReselect) {
      state.categoryBranching = null;
      state.categoryAnswers = [];
    }
    queueWizardSave();
    loadCategoryBranchForTopic(t.id, afterSelect);
  });
  wrap.appendChild(d);
}

function goAfterChallengeSelect() {
  applyMatrixCompanionForCategory(state.challengeCategory);
  state.currentStep = isCompanionStepEnabled() ? 2 : 3;
  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToCompanionStep() {
  goAfterChallengeSelect();
}

function updateVoiceStepSubtitle() {
  const el = document.getElementById('voiceSub');
  if (!el) return;
  const voiceCopy = WIZ.steps.voice || {};
  const name = (state.childName || '').trim();
  if (name) {
    el.textContent = String(voiceCopy.subTemplate || voiceCopy.subFallback || '')
      .replace('{name}', name);
  } else {
    el.textContent = voiceCopy.subFallback || '';
  }
}

function updateHeroNotesTitle() {
  const hn = WIZ.steps.heroNotes || WIZ_DEFAULTS.steps.heroNotes || {};
  const childName = resolveWizardChildName();
  const rawName = (state.childName || '').trim();
  const titleEl = document.getElementById('heroNotesTitle');
  if (titleEl) {
    titleEl.textContent = rawName
      ? renderTemplate(hn.titleTemplate || 'כמה מילים על {name}', { name: childName })
      : hn.titleFallback || 'כמה מילים על הגיבור/ה שלכם';
  }
  setText('heroNotesStrengthQ', renderTemplate(hn.strengthQ || '', { name: childName }));
  setText('heroNotesFeelingQ', renderTemplate(hn.feelingQ || '', { name: childName }));
}

function addMvpChallengeCard(wrap, slot) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mvp-challenge-card' + (slot.publicVisible === false ? ' mvp-challenge-card--parked' : '');
  btn.setAttribute('data-id', slot.topicId || slot.category);
  btn.setAttribute('data-category', slot.category);

  const companion = slot.companion || {};
  const imgHtml = companion.image
    ? `<img class="mvp-challenge-card-img" src="${companion.image}" alt="" loading="lazy" />`
    : '<div class="mvp-challenge-card-img mvp-challenge-card-img--placeholder"></div>';

  btn.innerHTML = `
    <span class="mvp-challenge-card-emoji" aria-hidden="true">${slot.emoji || '✨'}</span>
    ${imgHtml}
    <span class="mvp-challenge-card-label">${slot.label || ''}</span>
    <span class="mvp-challenge-card-companion">${slot.companionLine || companion.name || ''}</span>
    <span class="mvp-challenge-card-oneliner">${slot.oneLiner || ''}</span>
    ${slot.publicVisible === false ? '<span class="mvp-challenge-card-badge">dev</span>' : ''}
  `;

  if (slot.publicVisible === false) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    wrap.appendChild(btn);
    return;
  }

  btn.addEventListener('click', () => {
    wrap.querySelectorAll('.mvp-challenge-card').forEach((c) => c.classList.remove('selected'));
    btn.classList.add('selected');
    const previousTopic = state.topic;
    const topicId = slot.topicId;
    const isReselect = previousTopic === topicId;
    if (!isReselect && previousTopic) {
      state.companionCharacterId = null;
      state.productId = null;
      state.storyDirection = null;
      state.productTruth = null;
    }
    state.topic = topicId;
    state.topicLabel = slot.label;
    state.challengeCategory = slot.category;
    applyMatrixCompanionForCategory(slot.category);

    if (isReselect && state.categoryBranching && !state.categoryBranching._fetchFailed) {
      queueWizardSave();
      setTimeout(goAfterChallengeSelect, 220);
      return;
    }
    if (!isReselect) {
      state.categoryBranching = null;
      state.categoryAnswers = [];
    }
    queueWizardSave();
    loadCategoryBranchForTopic(topicId, goAfterChallengeSelect);
  });

  wrap.appendChild(btn);
}

function renderTopics() {
  const wrap = document.getElementById('topic-chips');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (state.mvpMatrix?.categories?.length) {
    wrap.classList.add('mvp-challenge-grid');
    const header = state.mvpMatrix.header;
    if (header?.title) setText('s2Title', header.title);
    if (header?.sub) setText('s2Sub', header.sub);

    state.mvpMatrix.categories.forEach((slot) => addMvpChallengeCard(wrap, slot));
    if (state.mvpMatrix.dev?.showParkedCategories && Array.isArray(state.mvpMatrix.parkedCategories)) {
      state.mvpMatrix.parkedCategories.forEach((slot) => addMvpChallengeCard(wrap, slot));
    }
  } else {
    wrap.classList.remove('mvp-challenge-grid');
    TOPICS.forEach((topic) => {
      addTopicChip(wrap, topic, goAfterChallengeSelect);
    });
  }

  if (state.topic) {
    const normalized = normalizeWizardTopicId(state.topic);
    const selected = wrap.querySelector(`[data-id="${normalized}"]`);
    if (selected) selected.classList.add('selected');
  }
}

function retryCategoryBranchFetch() {
  const cat = String(state.challengeCategory || '');
  if (!cat) return;
  state.categoryBranching = null;
  updateUI();
  (async function () {
    try {
      const data = await fetchCategoryBranching(cat);
      state.categoryBranching = { ...data, _fetchFailed: false };
    } catch (e) {
      console.error('[wizard] category branch retry failed', e);
      state.categoryBranching = {
        followUpQuestions: [],
        hebrewLabel: state.topicLabel,
        _fetchFailed: true,
      };
    }
    updateUI();
  })();
}

function scheduleDynamicFollowupRefresh() {
  if (followupUpdateTimer) {
    clearTimeout(followupUpdateTimer);
  }
  followupUpdateTimer = setTimeout(async () => {
    followupUpdateTimer = null;
    const cat = String(state.challengeCategory || '');
    if (!cat || !state.categoryBranching || state.categoryBranching._fetchFailed) return;
    const serial = ++followupRefreshSerial;
    const currentAnswers = collectFollowupDraftFromDom();
    state.categoryAnswers = currentAnswers;
    try {
      const data = await fetchCategoryBranching(cat, currentAnswers);
      if (serial !== followupRefreshSerial) return;
      state.categoryBranching = { ...data, _fetchFailed: false };
      renderCategoryFollowupFields();
      queueWizardSave();
    } catch (e) {
      console.error('[wizard] dynamic follow-up refresh failed', e);
    }
  }, 140);
}

function renderCategoryFollowupFields() {
  const wrap = document.getElementById('category-followup-wrap');
  if (!wrap) return;
  if (!state.categoryBranching) {
    wrap.innerHTML = '<p class="category-followup-wait">טוענים…</p>';
    return;
  }
  if (state.categoryBranching._fetchFailed) {
    wrap.innerHTML = `
      <p class="category-followup-error">השאלות עוד נטענות. אפשר לנסות שוב בעוד רגע.</p>
      <button type="button" class="btn-retry-cat" id="cat-retry-btn">לטעינה מחדש</button>
    `;
    const btn = document.getElementById('cat-retry-btn');
    if (btn) {
      btn.addEventListener('click', () => retryCategoryBranchFetch());
    }
    return;
  }
  const rawQuestions = state.categoryBranching.followUpQuestions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    wrap.innerHTML = '<p class="category-followup-skip">אפשר להמשיך — אין שאלות נוספות לנושא הזה.</p>';
    return;
  }
  const followupQuestions = rawQuestions
    .slice(0, 3)
    .map((questionItem, index) => normalizeFollowupQuestion(questionItem, index))
    .filter(Boolean);
  if (followupQuestions.length === 0) {
    wrap.innerHTML = '<p class="category-followup-skip">אפשר להמשיך — אין שאלות נוספות לנושא הזה.</p>';
    return;
  }

  wrap.innerHTML = '';
  followupQuestions.forEach((item, i) => {
    const block = document.createElement('div');
    block.className = 'form-group category-followup-item';

    const lab = document.createElement('span');
    lab.className = 'form-label category-followup-label';
    lab.textContent = item.question;
    block.appendChild(lab);

    const quickWrap = document.createElement('div');
    quickWrap.className = 'category-followup-quick-wrap';
    const prev = (state.categoryAnswers || []).find((a) => a.questionId === item.id) ||
      (state.categoryAnswers || []).find((a) => a.question === item.question);
    const preselected = new Set(Array.isArray(prev?.selectedQuickAnswers) ? prev.selectedQuickAnswers : []);

    item.quickAnswers.forEach((quickAnswer) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip category-followup-chip';
      chip.textContent = quickAnswer;
      chip.setAttribute('data-cat-q-chip', String(i));
      chip.setAttribute('data-chip-value', quickAnswer);
      if (preselected.has(quickAnswer)) chip.classList.add('selected');
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        const selectedQuickAnswers = Array.from(quickWrap.querySelectorAll('.category-followup-chip.selected'))
          .map((node) => String(node.getAttribute('data-chip-value') || '').trim())
          .filter(Boolean);
        upsertCategoryAnswerDraft({
          questionId: item.id,
          question: item.question,
          answer: input.value.trim(),
          ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
        });
        if (quickAnswer === 'אחר' && chip.classList.contains('selected')) {
          const targetInput = wrap.querySelector(`[data-cat-q-text="${i}"]`);
          if (targetInput && typeof targetInput.focus === 'function') targetInput.focus();
        }
        if (i === 0) scheduleDynamicFollowupRefresh();
      });
      quickWrap.appendChild(chip);
    });
    if (item.quickAnswers.length > 0) block.appendChild(quickWrap);

    const input = document.createElement('textarea');
    input.className = 'wiz-textarea category-followup-textarea';
    input.rows = 2;
    input.placeholder = item.placeholder || 'פרטו עוד אם תרצו';
    input.setAttribute('data-cat-q-text', String(i));
    if (prev && prev.answer) input.value = prev.answer;
    input.addEventListener('input', () => {
      const selectedQuickAnswers = Array.from(quickWrap.querySelectorAll('.category-followup-chip.selected'))
        .map((node) => String(node.getAttribute('data-chip-value') || '').trim())
        .filter(Boolean);
      upsertCategoryAnswerDraft({
        questionId: item.id,
        question: item.question,
        answer: input.value.trim(),
        ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
      });
    });

    const optionalNote = document.createElement('span');
    optionalNote.className = 'form-label-note category-followup-note';
    optionalNote.textContent = 'אופציונלי';

    block.appendChild(optionalNote);
    block.appendChild(input);
    wrap.appendChild(block);
  });

  const displayedAnswers = followupQuestions.map((item, i) => {
    const prev = (state.categoryAnswers || []).find((a) => a.questionId === item.id) ||
      (state.categoryAnswers || []).find((a) => a.question === item.question);
    const textEl = wrap.querySelector(`[data-cat-q-text="${i}"]`);
    const selectedQuickAnswers = Array.from(wrap.querySelectorAll(`[data-cat-q-chip="${i}"].selected`))
      .map((node) => String(node.getAttribute('data-chip-value') || '').trim())
      .filter(Boolean);
    return {
      questionId: item.id,
      question: item.question,
      answer: textEl && 'value' in textEl ? String(textEl.value || '').trim() : (prev?.answer || ''),
      ...(selectedQuickAnswers.length > 0 ? { selectedQuickAnswers } : {}),
    };
  });
  const displayedIds = new Set(displayedAnswers.map((row) => row.questionId));
  const hiddenPreserved = (state.categoryAnswers || []).filter((row) => row && row.questionId && !displayedIds.has(row.questionId));
  state.categoryAnswers = [...displayedAnswers, ...hiddenPreserved];
}

/* ── TRAIT CHIPS ─────────────────────────────────────────────── */
// TRAITS is now [{id, label}]. Stored value is still t.label (Hebrew string) —
// behavior unchanged; state.childTraits still holds Hebrew label strings.
function renderTraits() {
  const wrap = document.getElementById("trait-chips");
  if (!wrap) return;

  wrap.innerHTML = "";

  TRAITS.forEach((t) => {
    const d = document.createElement("div");
    d.className   = "trait-chip";
    if (state.childTraits.indexOf(t.label) > -1) {
      d.classList.add('selected');
    }
    d.innerHTML = `
      <span class="trait-chip-icon" aria-hidden="true">${getTraitIcon(t)}</span>
      <span class="trait-chip-text">${t.label}</span>
    `;

    d.addEventListener("click", () => {
      d.classList.toggle("selected");

      const i = state.childTraits.indexOf(t.label);
      if (i > -1) {
        state.childTraits.splice(i, 1);
      } else {
        state.childTraits.push(t.label);
      }
      queueWizardSave();
    });

    wrap.appendChild(d);
  });
}

/* ── SUPERPOWER CHIPS (multi-select) ────────────────────────── */
const SUPERPOWERS = WIZ.superpowers;

function renderGoalsChips() {
  const wrap = document.getElementById('hero-goals-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  (WIZ.goals || []).forEach((g) => {
    const d = document.createElement('div');
    d.className = 'chip';
    if ((state.goals || []).indexOf(g.label) > -1) d.classList.add('selected');
    d.textContent = g.label;
    d.addEventListener('click', () => toggleChip(d, 'goals'));
    wrap.appendChild(d);
  });
}

function renderSuperpowerChips() {
  const wrap = document.getElementById('hero-superpower-chips');
  if (!wrap) return;

  wrap.innerHTML = '';
  SUPERPOWERS.forEach((sp) => {
    const d = document.createElement("div");
    d.className   = "trait-chip";
    if (state.childSuperpower.indexOf(sp.label) > -1) {
      d.classList.add('selected');
    }
    d.textContent = sp.label;

    d.addEventListener("click", () => {
      d.classList.toggle("selected");
      const i = state.childSuperpower.indexOf(sp.label);
      if (i > -1) {
        state.childSuperpower.splice(i, 1);
      } else {
        state.childSuperpower.push(sp.label);
      }
      queueWizardSave();
    });

    wrap.appendChild(d);
  });
}

/* ── GENERIC MULTI-SELECT CHIPS ──────────────────────────────── */
// NOT modified — still reads el.textContent.trim() and stores Hebrew label.
// state.difficulties / goals / helpers / avoid store Hebrew strings as before.
function toggleChip(el, key) {
  el.classList.toggle("selected");

  const val = el.textContent.trim();
  const arr = state[key];
  const i   = arr.indexOf(val);

  if (i > -1) {
    arr.splice(i, 1);
  } else {
    arr.push(val);
  }
  queueWizardSave();
}

/* ── PHOTO UPLOAD ────────────────────────────────────────────── */

function onPhotoUploadAreaClick() {
  const input = document.getElementById('photo-input');
  if (input) input.click();
}

function bindPhotoUploadInteractions() {
  const area = document.getElementById('photo-area');
  const input = document.getElementById('photo-input');
  if (!area || !input) return;

  area.setAttribute('role', 'button');
  area.setAttribute('tabindex', '0');
  area.setAttribute('aria-label', 'העלאת תמונה');

  area.addEventListener('click', (event) => {
    if (event.target && event.target.closest && event.target.closest('#photo-replace-btn')) return;
    input.click();
  });

  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
}

function savePhotoQualityToStorage() {
  try {
    window.localStorage.setItem(
      PHOTO_ANALYSIS_STORAGE_KEY,
      JSON.stringify({
        photo: state.photo,
        photoQuality: state.photoQuality,
      })
    );
  } catch (_) {}
}

function restorePhotoQualityFromStorage() {
  try {
    const raw = window.localStorage.getItem(PHOTO_ANALYSIS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.photo === 'string' && parsed.photo.startsWith('data:image/')) {
        state.photo = parsed.photo;
        renderPhotoUploadArea();
      }
      if (
        parsed.photoQuality &&
        typeof parsed.photoQuality === 'object' &&
        typeof parsed.photoQuality.status === 'string'
      ) {
        state.photoQuality = parsed.photoQuality;
      }
      updatePhotoHeroTitle();
      renderPhotoQualityMessage();
    }
  } catch (_) {}
}

function updatePhotoHeroTitle() {
  const t = document.getElementById('photo-hero-title');
  if (t) t.hidden = !state.photo;
}

function renderPhotoUploadArea() {
  const area = document.getElementById('photo-area');
  if (!area) return;
  if (!state.photo) {
    area.innerHTML = [
      '<div class="photo-plus">+</div>',
      '<div class="photo-txt">',
      '<span id="s3PhotoPrompt"></span>',
      '<small id="s3PhotoOptional"></small>',
      '</div>',
    ].join('');
    setText('s3PhotoPrompt', WIZ.steps.s3.photoPrompt);
    setText('s3PhotoOptional', WIZ.steps.s3.photoOptional);
    return;
  }
  area.innerHTML = [
    `<img class="preview" src="${state.photo}" alt="תמונה" />`,
    '<button type="button" class="photo-replace-btn" id="photo-replace-btn">📷 להחליף תמונה</button>',
  ].join('');
  const replaceBtn = document.getElementById('photo-replace-btn');
  if (replaceBtn) {
    replaceBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const input = document.getElementById('photo-input');
      if (input) input.click();
    });
  }
}

function updatePhotoStepBottomBar() {
  if (state.currentStep !== 3) return;
  const btn = document.getElementById('btn-continue');
  if (!btn) return;

  const st = state.photoQuality?.status;
  const hasPhoto = Boolean(state.photo);
  const openPhotoPicker = () => {
    const input = document.getElementById('photo-input');
    if (input) input.click();
  };

  const btnAnyway = document.getElementById('btn-continue-anyway');

  // No photo: continuing is allowed, with the honest generic-child disclaimer
  // shown in the photo area. The upload area stays the primary CTA.
  if (!hasPhoto) {
    btn.textContent = 'להמשיך בלי תמונה';
    btn.onclick = goNext;
    btn.disabled = false;
    if (btnAnyway) btnAnyway.hidden = true;
    return;
  }

  // BLOCKED photo: the user must either replace it, or explicitly clear it
  // (drops to the no-photo state with the disclaimer) — never continue with it.
  if (st === PHOTO_QUALITY_STATUS.BLOCKED) {
    btn.textContent = 'להחליף תמונה';
    btn.onclick = openPhotoPicker;
    btn.disabled = false;
    if (btnAnyway) {
      btnAnyway.hidden = false;
      btnAnyway.textContent = 'להמשיך בלי התמונה הזו';
      btnAnyway.onclick = () => {
        clearPhotoQualityState();
        queueWizardSave();
      };
    }
    return;
  }

  btn.textContent = st === PHOTO_QUALITY_STATUS.WARNING ? 'להמשיך בכל זאת' : 'ממשיכים';
  btn.onclick = goNext;
  btn.disabled = false;
  if (btnAnyway) btnAnyway.hidden = true;
}

function clearPhotoQualityState() {
  state.photo = null;
  state.photoQuality = {
    status: PHOTO_QUALITY_STATUS.BLOCKED,
    faceCount: 0,
    reasonCodes: ['no_photo'],
  };
  savePhotoQualityToStorage();
  renderPhotoUploadArea();
  updatePhotoHeroTitle();
  renderPhotoQualityMessage();
}

function renderPhotoQualityMessage() {
  const box = document.getElementById('photo-quality-message');
  if (!box) return;
  updatePhotoHeroTitle();

  if (!state.photo) {
    box.hidden = false;
    box.innerHTML = `
      <p class="photo-helper-text">${PHOTO_MSG_NO_PHOTO_HELPER}</p>
      <div class="photo-quality-alert photo-quality-alert--warning">
        <div class="photo-quality-alert-title">${PHOTO_MSG_NO_PHOTO_DISCLAIMER}</div>
      </div>
    `;
    updatePhotoStepBottomBar();
    return;
  }

  const status = state.photoQuality?.status || PHOTO_QUALITY_STATUS.BLOCKED;

  if (status === PHOTO_QUALITY_STATUS.GOOD) {
    box.innerHTML = '';
    box.hidden = true;
    updatePhotoStepBottomBar();
    return;
  }

  const reasonMessage =
    state.photoQuality?.messageHe ||
    hebrewPhotoMessageFromCodes(state.photoQuality?.reasonCodes);

  if (status === PHOTO_QUALITY_STATUS.WARNING) {
    box.hidden = false;
    box.innerHTML = `
    <div class="photo-quality-alert photo-quality-alert--warning">
      <div class="photo-quality-alert-title">${reasonMessage || PHOTO_MSG_WARNING}</div>
      ${reasonMessage ? `<p class="photo-helper-text">${PHOTO_MSG_WARNING}</p>` : ''}
    </div>
  `;
    updatePhotoStepBottomBar();
    return;
  }

  box.hidden = false;
  box.innerHTML = `
    <div class="photo-quality-alert photo-quality-alert--blocked">
      <div class="photo-quality-alert-title">${reasonMessage || PHOTO_MSG_BLOCKED}</div>
      <p class="photo-helper-text">אפשר להחליף לתמונה אחרת וננסה שוב.</p>
    </div>
  `;
  updatePhotoStepBottomBar();
}

async function createImageFromDataUrl(dataUrl) {
  const img = new Image();
  img.decoding = 'async';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  return img;
}

function isFaceDetectorSupported() {
  return typeof window.FaceDetector === 'function';
}

async function detectFaces(imageEl) {
  if (!isFaceDetectorSupported()) throw new Error('face_detector_unsupported');
  const detector = new window.FaceDetector({ maxDetectedFaces: 8, fastMode: true });
  const faces = await detector.detect(imageEl);
  if (!Array.isArray(faces)) throw new Error('face_detector_failed');
  return faces;
}

async function analyzePhotoQualityViaServer(dataUrl) {
  const response = await fetch('/api/photo/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
  if (!response.ok) throw new Error('server_photo_analyze_failed');
  const data = await response.json();
  if (!data || typeof data !== 'object' || typeof data.status !== 'string') {
    throw new Error('server_photo_analyze_invalid');
  }
  return data;
}

function computeSharpnessAndBrightness(imageEl) {
  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(imageEl.naturalWidth, imageEl.naturalHeight));
  const w = Math.max(32, Math.round(imageEl.naturalWidth * scale));
  const h = Math.max(32, Math.round(imageEl.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { sharpness: 0, brightness: 0 };
  }
  ctx.drawImage(imageEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let brightnessSum = 0;
  let gradientSum = 0;
  let pixelCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const idxL = (y * w + (x - 1)) * 4;
      const idxR = (y * w + (x + 1)) * 4;
      const idxU = ((y - 1) * w + x) * 4;
      const idxD = ((y + 1) * w + x) * 4;
      const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
      const lumL = 0.2126 * data[idxL] + 0.7152 * data[idxL + 1] + 0.0722 * data[idxL + 2];
      const lumR = 0.2126 * data[idxR] + 0.7152 * data[idxR + 1] + 0.0722 * data[idxR + 2];
      const lumU = 0.2126 * data[idxU] + 0.7152 * data[idxU + 1] + 0.0722 * data[idxU + 2];
      const lumD = 0.2126 * data[idxD] + 0.7152 * data[idxD + 1] + 0.0722 * data[idxD + 2];
      brightnessSum += lum;
      gradientSum += Math.abs(lumR - lumL) + Math.abs(lumD - lumU);
      pixelCount++;
    }
  }
  return {
    brightness: pixelCount > 0 ? brightnessSum / pixelCount : 0,
    sharpness: pixelCount > 0 ? gradientSum / pixelCount : 0,
  };
}

function classifyPhotoQuality(metrics) {
  const reasonCodes = [];
  const faceCount = metrics.faceCount;
  if (faceCount === 0) {
    return {
      status: PHOTO_QUALITY_STATUS.BLOCKED,
      faceCount: 0,
      dominantFaceRatio: 0,
      sharpness: Number(metrics.sharpness?.toFixed?.(2) || metrics.sharpness || 0),
      brightness: Number(metrics.brightness?.toFixed?.(2) || metrics.brightness || 0),
      reasonCodes: ['no_face_detected'],
    };
  }
  // Dominant-face rule (matches the server gates): one clearly dominant face
  // passes — background faces are invisible to the user. Only several
  // comparable faces block.
  if (!metrics.hasDominantFace) reasonCodes.push('multiple_faces_no_dominant');
  if (metrics.dominantFaceRatio < PHOTO_ANALYSIS_THRESHOLDS.minBlockedFaceRatio) {
    reasonCodes.push('face_too_small_critical');
  } else if (metrics.dominantFaceRatio < PHOTO_ANALYSIS_THRESHOLDS.minWarningFaceRatio) {
    reasonCodes.push('face_too_small');
  } else if (metrics.dominantFaceRatio < PHOTO_ANALYSIS_THRESHOLDS.minGoodFaceRatio) {
    reasonCodes.push('face_too_small');
  }
  if (metrics.sharpness < PHOTO_ANALYSIS_THRESHOLDS.minSharpnessWarning) {
    reasonCodes.push('low_sharpness');
  }
  if (!metrics.brightness || metrics.brightness < 35) reasonCodes.push('low_brightness');

  const blocked =
    !metrics.hasDominantFace ||
    metrics.dominantFaceRatio < PHOTO_ANALYSIS_THRESHOLDS.minBlockedFaceRatio ||
    metrics.sharpness < PHOTO_ANALYSIS_THRESHOLDS.minSharpnessWarning;
  if (blocked) {
    return {
      status: PHOTO_QUALITY_STATUS.BLOCKED,
      faceCount,
      dominantFaceRatio: Number(metrics.dominantFaceRatio.toFixed(4)),
      sharpness: Number(metrics.sharpness.toFixed(2)),
      brightness: Number(metrics.brightness.toFixed(2)),
      reasonCodes,
    };
  }
  const warning =
    metrics.dominantFaceRatio < PHOTO_ANALYSIS_THRESHOLDS.minGoodFaceRatio ||
    metrics.sharpness < PHOTO_ANALYSIS_THRESHOLDS.minSharpnessGood;
  return {
    status: warning ? PHOTO_QUALITY_STATUS.WARNING : PHOTO_QUALITY_STATUS.GOOD,
    faceCount,
    dominantFaceRatio: Number(metrics.dominantFaceRatio.toFixed(4)),
    sharpness: Number(metrics.sharpness.toFixed(2)),
    brightness: Number(metrics.brightness.toFixed(2)),
    reasonCodes,
  };
}

async function analyzePhotoQuality(dataUrl) {
  // Server analysis first — it is the same detector family the checkout
  // PhotoGate uses, so the upload-step verdict predicts the final gate.
  try {
    const serverResult = await analyzePhotoQualityViaServer(dataUrl);
    return serverResult;
  } catch (_) {
    /* server unavailable — fall back to in-browser analysis below */
  }
  // In-browser fallback (FaceDetector). If this throws too, handlePhoto
  // records analysis_unavailable as a soft warning.
  const imageEl = await createImageFromDataUrl(dataUrl);
  const { sharpness, brightness } = computeSharpnessAndBrightness(imageEl);
  const faces = await detectFaces(imageEl);
  const imageArea = Math.max(1, imageEl.naturalWidth * imageEl.naturalHeight);
  const faceRatios = faces
    .map((face) => {
      const box = face?.boundingBox || {};
      const width = Number(box.width || 0);
      const height = Number(box.height || 0);
      const area = width > 0 && height > 0 ? width * height : 0;
      return area / imageArea;
    })
    .filter((ratio) => ratio >= PHOTO_ANALYSIS_THRESHOLDS.minCountedFaceRatio)
    .sort((a, b) => b - a);
  const dominantFaceRatio = faceRatios[0] || 0;
  const secondaryComparable = faceRatios.find(
    (ratio, idx) => idx > 0 && ratio >= PHOTO_ANALYSIS_THRESHOLDS.minSecondaryComparableRatio
  ) || 0;
  const hasDominantFace =
    faceRatios.length === 1 ||
    secondaryComparable <= 0 ||
    (dominantFaceRatio >= PHOTO_ANALYSIS_THRESHOLDS.minBlockedFaceRatio &&
      dominantFaceRatio / secondaryComparable >= PHOTO_ANALYSIS_THRESHOLDS.dominantFaceRatioMin);
  return classifyPhotoQuality({
    faceCount: faceRatios.length,
    dominantFaceRatio,
    hasDominantFace,
    sharpness,
    brightness,
  });
}

async function handlePhoto(e) {
  const input = e.target;
  const file = input?.files?.[0];
  if (!file) return;
  hidePhotoError();

  if (!PHOTO_ALLOWED_TYPES.has(file.type)) {
    clearPhotoQualityState();
    showPhotoError('אפשר להעלות רק JPG, PNG או WEBP.');
    if (input) input.value = '';
    reportClientIssue('photo_validation_failed', { reason: 'invalid_type', mime: file.type || 'unknown' });
    return;
  }
  if (file.size > PHOTO_MAX_SIZE_BYTES) {
    clearPhotoQualityState();
    showPhotoError('התמונה גדולה מדי כרגע. נסו תמונה עד 15MB.');
    if (input) input.value = '';
    reportClientIssue('photo_validation_failed', { reason: 'file_too_large', sizeBytes: file.size });
    return;
  }

  const reader = new FileReader();

  reader.onload = async (ev) => {
    state.photo = ev.target.result;
    renderPhotoUploadArea();
    try {
      state.photoQuality = await analyzePhotoQuality(String(ev.target.result || ''));
    } catch (_) {
      state.photoQuality = {
        status: PHOTO_QUALITY_STATUS.WARNING,
        faceCount: 0,
        reasonCodes: ['analysis_unavailable'],
      };
    }
    if (!state.photoQuality.messageHe) {
      state.photoQuality.messageHe = hebrewPhotoMessageFromCodes(state.photoQuality.reasonCodes);
    }
    renderPhotoQualityMessage();
    savePhotoQualityToStorage();
    sessionExpectChildPhotoReplay = false;
    queueWizardSave();
  };
  reader.onerror = () => {
    clearPhotoQualityState();
    showPhotoError('לא הצלחנו לקרוא את הקובץ הזה. נסו תמונה אחרת.');
    reportClientIssue('photo_read_failed', { reason: 'file_reader_error' });
  };

  reader.readAsDataURL(file);
}

/* ── STEP 8: PRODUCT CARDS ───────────────────────────────────── */
function renderProductCards() {
  const wrap = document.getElementById('product-cards');
  if (!wrap) return;

  wrap.innerHTML = '';
  wrap.style.direction = 'rtl';

  const copy = WIZ.steps.product || {};
  const ORDER = { bedtime: 1, adventure: 2, fantasy: 3 };
  const pkgs = [...PRODUCT_PACKAGES].sort((a, b) => {
    const ao = ORDER[a.id] || 99;
    const bo = ORDER[b.id] || 99;
    return ao - bo;
  });

  pkgs.forEach((pkg) => {
    const dirMeta = getDirectionSellability(pkg.id);
    const comingSoon = dirMeta.sellable === false;
    const card = document.createElement('button');
    card.type = 'button';
    const selected = !comingSoon && (pkg.id === state.productId || pkg.id === state.storyDirection);
    card.className =
      'product-card' +
      (selected ? ' selected' : '') +
      (comingSoon ? ' product-card-coming-soon' : '');
    card.setAttribute('data-product', pkg.id);

    const bestForHtml = (pkg.bestFor || [])
      .map((item) => `<li>${item}</li>`)
      .join('');

    const includesHtml = (pkg.includes || [])
      .map((item) => {
        const emoji = PRODUCT_ICON_EMOJI[item.icon] || '✓';
        return `<li><span class="product-card-include-icon" aria-hidden="true">${emoji}</span>${item.label}</li>`;
      })
      .join('');

    const ctaLabel = selected
      ? (copy.ctaSelected || 'זו הבחירה שלי')
      : (copy.ctaChoose || 'לבחירה');

    card.innerHTML = `
      ${comingSoon ? '<span class="product-card-coming-soon-badge">בקרוב</span>' : ''}
      <span class="product-card-name">${pkg.productName || pkg.id}</span>
      <span class="product-card-tagline">${pkg.tagline || ''}</span>
      <span class="product-card-pages">${pkg.pages} עמודים</span>
      <p class="product-card-bestfor-label">${copy.bestForLabel || 'מתאים במיוחד ל:'}</p>
      <ul class="product-card-bestfor">${bestForHtml}</ul>
      <p class="product-card-includes-label">${copy.includesLabel || 'כלול במחיר:'}</p>
      <ul class="product-card-includes">${includesHtml}</ul>
      <span class="product-card-price">₪<span class="product-card-price-digits">${pkg.priceILS}</span></span>
      <span class="product-card-cta">${ctaLabel}</span>
    `;

    if (comingSoon) {
      card.disabled = true;
      card.setAttribute('aria-disabled', 'true');
      card.title = 'הכיוון הזה יהיה זמין בקרוב';
    } else {
      card.addEventListener('click', () => {
        applyProductSelection(pkg.id);
        renderProductCards();
        const cont = document.getElementById('btn-continue');
        if (cont && state.currentStep === 8) cont.disabled = false;
        queueWizardSave();
      });
    }

    wrap.appendChild(card);
  });

  if (state.productId && !getDirectionSellability(state.productId).sellable) {
    state.productId = null;
    state.storyDirection = null;
    state.priceILS = null;
    state.productTruth = null;
  }
}

/* ── STEP 12: STYLE CARDS ────────────────────────────────────── */
function renderStyleStepGrid() {
  const wrap = document.getElementById('style-step-grid');
  if (!wrap) return;

  wrap.innerHTML = '';

  ILLUSTRATION_STYLES.forEach((s) => {
    // Style 02 is visible but NOT sellable until its render-quality gate opens
    // (owner decision 2026-06-10). The server also rejects it — this is just honest UI.
    const comingSoon = s.id === 'detailed_whimsical_world';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'style-btn style-card style-step-card' +
      (s.id === state.style ? ' selected' : '') +
      (comingSoon ? ' style-card-coming-soon' : '');
    btn.innerHTML = `
      <span class="style-card-image-wrap">
        <img class="style-card-image" src="${getStylePreviewDataUrl(s.id)}" alt="${s.label}" />
        ${comingSoon ? '<span class="style-card-coming-soon-badge">בקרוב</span>' : ''}
      </span>
      <span class="style-card-name">${s.label}</span>
      <span class="style-card-desc">${s.description || ''}</span>
    `;
    if (comingSoon) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'הסגנון הזה יהיה זמין בקרוב';
      wrap.appendChild(btn);
      return;
    }

    btn.addEventListener('click', () => {
      document.querySelectorAll('#style-step-grid .style-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.style = s.id;
      state.styleSelected = true;
      const cont = document.getElementById('btn-continue');
      if (cont && state.currentStep === 5) cont.disabled = false;
      queueWizardSave();
    });

    wrap.appendChild(btn);
  });
}

/* ── STEP 6: VOICE BUTTONS ───────────────────────────────────── */
function renderVoiceBtns() {
  const wrap = document.getElementById("voice-btns");
  if (!wrap) return;

  wrap.innerHTML = "";

  VOICES.forEach((v) => {
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = "voice-btn" + (v.id === state.voice ? " selected" : "");
    btn.id        = "voice-" + v.id;

    btn.innerHTML = `
      <span class="voice-btn-emoji">${v.emoji}</span>
      <span class="voice-btn-label">${v.label}</span>
      <span class="voice-play-btn" title="${WIZ.steps.voice?.voicePreview || 'האזינו לדוגמה'}" aria-hidden="true">▶</span>
    `;

    btn.addEventListener("click", () => {
      document.querySelectorAll(".voice-btn").forEach((b) => b.classList.remove("selected"));

      btn.classList.add("selected");
      state.voice = v.id;
      queueWizardSave();
    });

    const playBtn = btn.querySelector(".voice-play-btn");
    if (playBtn) {
      playBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        playVoicePreview(v.id);
      });
    }

    wrap.appendChild(btn);
  });
}

function playVoicePreview(voiceId) {
  // TODO: implement voice preview playback
}

/* ── STEP 8: SLEEP TOGGLE ────────────────────────────────────── */
function syncSleepToggleUI() {
  const t = document.getElementById('sleep-toggle');
  if (t) t.classList.toggle('on', state.sleepMode);
  const row = t?.closest('.sleep-row');
  if (row) row.classList.toggle('selected', state.sleepMode);
}

function toggleSleep() {
  state.sleepMode = !state.sleepMode;
  syncSleepToggleUI();
  queueWizardSave();
}

/* ── STEP 8: PRICE REFRESH ───────────────────────────────────── */
function refreshTotal() {
  const { total } = computeTotal();
  const el = document.getElementById("total-price");
  const barPrice = document.getElementById("bottom-bar-price");

  if (el) {
    el.textContent = `₪${total}`;
  }
  if (barPrice) {
    barPrice.textContent = `₪${total}`;
  }
}

/* ── STEP 9: BUILD SUMMARY ───────────────────────────────────── */
function buildSummary() {
  const { base, total } = computeTotal();

  // No fallback package — showing a product the customer didn't choose
  // (and won't receive) is a trust bug. Server truth wins when available.
  const summaryDirection =
    state.productTruth?.direction || state.productId || state.storyDirection || null;
  const productPkg = summaryDirection
    ? PRODUCT_PACKAGES.find((d) => d.id === summaryDirection)
    : null;
  const productName = productPkg?.productName || '';
  // PHYSICAL pages only — server-provided displayPages, never the beat count
  // and never computed here. (productPkg.pages is already physical.)
  const pagesCount = state.productTruth?.displayPages ?? productPkg?.pages ?? null;
  const dirPages = pagesCount ? `${pagesCount} עמודים` : '';
  const styleObj = ILLUSTRATION_STYLES.find((s) => s.id === state.style);
  const voiceObj = VOICES.find((v) => v.id === state.voice);

  const lenLabel   = productName;
  const styleLabel = styleObj?.label || "";
  const voiceLabel = voiceObj?.label || "";
  const topicLabel = state.topicLabel || state.topic || "";

  const bookTitle = state.bookName || WIZ.summary.defaultHero || 'הגיבור/ה שלכם';

  const bookPanelEl = document.getElementById('summary-book-panel');
  if (bookPanelEl) {
  const stylePreview = state.style ? getStylePreviewDataUrl(state.style) : '';
    bookPanelEl.innerHTML = `
      <div class="summary-book-preview">
        ${stylePreview ? `<div class="summary-book-thumb"><img src="${stylePreview}" alt="" /></div>` : ''}
        <div class="summary-book-meta">
          <div class="summary-book-name">${bookTitle}</div>
          <div class="summary-row">
            <span class="summary-icon">📄</span>
            <span class="summary-label">${WIZ.summary.lengthLabel}</span>
            <span class="summary-val">${productName} · ${dirPages}</span>
          </div>
          <div class="summary-row">
            <span class="summary-icon">🎨</span>
            <span class="summary-label">${WIZ.summary.styleLabel}</span>
            <span class="summary-val">${styleLabel}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Child + story details ───────────────────────────────────
  const sumEl = document.getElementById("order-summary");
  const bookNameInput = document.getElementById('bookNameInput');
  if (bookNameInput) bookNameInput.value = state.bookName || '';
  if (sumEl) {
    const ageStr = state.childAge
      ? WIZ.summary.ageFormat.replace('{age}', state.childAge)
      : '';

    const topicDisplayVal = topicLabel
      ? (state.categoryBranching && state.categoryBranching.hebrewLabel
          ? state.categoryBranching.hebrewLabel
          : topicLabel)
      : '';

    const rows = [
      {
        icon:  "👤",
        label: WIZ.summary.childNameLabel,
        val:   state.childName + ageStr,
      },
      topicLabel
        ? { icon: "📖", label: WIZ.summary.topicLabel,  val: topicDisplayVal }
        : null,
      { icon: "🎧", label: WIZ.summary.audioLabel, val: voiceLabel || "✓" },
      { icon: "📥", label: WIZ.summary.pdfLabel, val: "✓" },
      state.videoEnabled
        ? { icon: "🎬", label: WIZ.summary.videoLabel || 'סרטון:', val: '✓' }
        : null,
      state.sleepMode
        ? { icon: "🌙", label: WIZ.summary.sleepLabel, val: "✓" }
        : null,
    ].filter(Boolean);

    // ── Emotional context capture (helpers/difficulties/etc) ─────
    const toSummaryLabels = (selected, lookup) => {
      if (!Array.isArray(selected) || selected.length === 0) return null;
      const labels = selected
        .map((value) => {
          if (typeof value !== 'string') return null;
          const byId = Array.isArray(lookup) ? lookup.find((x) => x && x.id === value) : null;
          const byLabel = byId || (Array.isArray(lookup) ? lookup.find((x) => x && x.label === value) : null);
          const rawLabel = byLabel?.label || value;
          return String(rawLabel)
            .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\s]+/gu, '')
            .trim();
        })
        .filter(Boolean);
      return labels.length > 0 ? labels.join(', ') : null;
    };

    const superpowerVal = toSummaryLabels(state.childSuperpower, WIZ.superpowers || []);
    const goalsVal = toSummaryLabels(state.goals, WIZ.goals || []);
    const heroNoteParts = [superpowerVal, goalsVal].filter(Boolean);
    const heroNotesVal = heroNoteParts.length ? heroNoteParts.join(' · ') : null;

    const extraDetails = heroNotesVal
      ? `<div class="summary-row summary-row--soft">
        <span class="summary-icon">💜</span>
        <span class="summary-label">על הגיבור/ה:</span>
        <span class="summary-val">${heroNotesVal}</span>
      </div>`
      : '';

    sumEl.innerHTML = `${rows
      .map(
        (r) => `
        <div class="summary-row">
          <span class="summary-icon">${r.icon}</span>
          <span class="summary-label">${r.label}</span>
          <span class="summary-val">${r.val}</span>
        </div>
      `,
      )
      .join("")}${extraDetails}`;
  }

  // ── Price breakdown ─────────────────────────────────────────
  const priceEl = document.getElementById("price-breakdown");
  if (priceEl) {
    const rows = `
      <div class="price-row">
        <span class="label">${productName || WIZ.summary.bookDigital.replace('{length}', lenLabel)}</span>
        <span class="val">₪${base}</span>
      </div>
      <div class="price-row price-row--total">
        <span class="label">${WIZ.summary.totalLabel || 'סה"כ לתשלום:'}</span>
        <span class="val">₪${total}</span>
      </div>
    `;

    priceEl.innerHTML = rows;
  }

  // ── Dynamic footer line based on whether photo was uploaded ─────
  const paymentLogosEl = document.getElementById('s9PaymentLogos');
  if (paymentLogosEl) {
    paymentLogosEl.textContent = state.photo
      ? WIZ.steps.s9.paymentLogos
      : (WIZ.steps.s9.paymentLogosNoPhoto || WIZ.steps.s9.paymentLogos);
  }
}

/* ── SUBMIT ──────────────────────────────────────────────────── */

/**
 * buildWizardPayload()
 *
 * Maps the flat wizard `state` object to the nested `wizardData` shape
 * that POST /api/orders expects.
 *
 * Key transformations:
 *   state.childName / childAge / childGender / childTraits
 *     → child: { name, age, gender, traits, imageUrl }
 *
 *   state.topic (short client ID)
 *     → topic (canonical backend ID via TOPIC_ID_MAP)
 *       content.js uses 'confidence' and 'night';
 *       config/wizard.ts uses 'selfconfidence' and 'nightfear'.
 *
 *   state.difficulties / s4extra  → challenge:       { selected, freeText }
 *   state.goals                   → desiredOutcome:  { selected, freeText }
 *   state.helpers / s6extra       → helpers:         { selected, freeText }
 *   state.avoid   / s7extra       → avoid:           { selected, freeText }
 *
 *   state.storyDirection / style / audioEnabled / voice / sleepMode / pdfEnabled /
 *     bundleEnabled / videoEnabled
 *     → product: { direction, length, illustrationStyle, audioEnabled, selectedVoice, sleepMode,
 *                  pdfEnabled, bundleEnabled, videoEnabled }
 *
 *   state.contactName / contactEmail
 *     → contact: { name, email }
 *
 * Child reference photo: optional data URL or URL (server persists data URLs).
 */
function buildWizardPayload() {
  const topic = normalizeWizardTopicId(state.topic) || state.topic;
  const combinedSuperpower = [...state.childSuperpower];
  if (state.childSuperpowerExtra) combinedSuperpower.push(state.childSuperpowerExtra);

  const dedicationRaw = typeof state.dedication === 'string' ? state.dedication.trim() : '';
  const dedication = dedicationRaw.length > 0 ? dedicationRaw.slice(0, 300) : null;

  return {
    bookName: state.bookName || null,
    dedication,
    child: {
      name:       state.childName,
      age:        state.childAge        || null,
      gender:     state.childGender     || null,
      traits:     state.childTraits,
      superpower: combinedSuperpower.length ? combinedSuperpower.join(' | ') : null,
      imageUrl:   state.photo || null,
    },
    photoQuality: state.photoQuality || null,
    topic,
    challengeCategory: state.challengeCategory || null,
    companionCharacterId: state.companionCharacterId || null,
    categoryAnswers: state.categoryAnswers || [],
    familyContext: null,
    challenge: {
      selected: state.difficulties,
      freeText: state.s4extra || null,
    },
    desiredOutcome: {
      selected: state.goals,
      freeText: null,
    },
    helpers: {
      selected: state.helpers,
      freeText: state.s6extra || null,
    },
    avoid: {
      selected: state.avoid,
      freeText: state.s7extra || null,
    },
    product: {
      direction:         state.storyDirection,
      length:            STORY_LENGTH_FROM_DIRECTION[state.storyDirection] || 'medium',
      illustrationStyle: normalizeClientStyleId(state.style),
      audioEnabled:      true,
      selectedVoice:     state.voice || 'mom',
      sleepMode:         state.sleepMode,
      pdfEnabled:        true,
      bundleEnabled:     false,
      videoEnabled:      state.videoEnabled,
    },
    contact: {
      name:  state.contactName,
      email: state.contactEmail,
    },
  };
}

/** Puts the pay button into loading / ready state. */
function setPayBtnState(loading) {
  const btn = document.getElementById('btn-pay');
  if (!btn) return;
  btn.disabled = loading;
  btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  btn.classList.toggle('is-submitting', loading);
  if (!loading) {
    btn.classList.remove('is-pressed');
  }

  if (loading) {
    btn.textContent = '';
    const dots = document.createElement('span');
    dots.className = 'submit-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'submit-dot';
      dots.appendChild(dot);
    }
    btn.appendChild(dots);
    return;
  }

  btn.textContent = WIZ.steps.s9.submitBtn;
}

/** Inserts (or updates) a small error line below the pay button. */
function showSubmitError(message) {
  let el = document.getElementById('submit-error');
  if (!el) {
    el = document.createElement('p');
    el.id         = 'submit-error';
    el.style.cssText =
      'color:#e55;font-size:.875rem;margin-top:.75rem;text-align:center;line-height:1.4';
    const btn = document.getElementById('btn-pay');
    if (btn && btn.parentNode) btn.parentNode.insertBefore(el, btn.nextSibling);
  }
  el.textContent = message;
  el.hidden      = false;
}

function hideSubmitError() {
  const el = document.getElementById('submit-error');
  if (el) el.hidden = true;
}

function showPhotoError(message) {
  let el = document.getElementById('photo-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'photo-error';
    el.style.cssText = 'color:#e55;font-size:.85rem;margin-top:.6rem;text-align:center;line-height:1.4';
    const area = document.getElementById('photo-area');
    if (area && area.parentNode) area.parentNode.insertBefore(el, area.nextSibling);
  }
  el.textContent = message;
  el.hidden = false;
}

function hidePhotoError() {
  const el = document.getElementById('photo-error');
  if (el) el.hidden = true;
}

function resolveCheckoutPaymentUrl(url, orderId) {
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
        p.startsWith('/generating') ||
        p.startsWith('/ready') ||
        p.startsWith('/reader') ||
        p.startsWith('/HTML/')
      ) {
        reportClientIssue('checkout_bad_redirect', { url: String(url).trim(), orderId });
        throw new Error('checkout_invalid_payment_url');
      }
    }
    return parsed.href;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.message === 'bad_protocol')) {
      reportClientIssue('checkout_bad_redirect', { url: String(url).trim(), orderId });
      throw new Error('checkout_invalid_payment_url');
    }
    throw error;
  }
}

async function startCheckout(orderId, sessionId) {
  const checkoutBody = { orderId, ...(sessionId ? { sessionId } : {}) };
  if (clientApi && typeof clientApi.requestJson === 'function') {
    return clientApi.requestJson('/api/checkout', {
      fetch: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutBody),
      },
      timeoutMs: 15000,
      fallbackMessage: 'לא הצלחנו לפתוח את התשלום כרגע.',
    });
  }

  const checkoutRes = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutBody),
  });
  const data = await checkoutRes.json().catch(() => ({}));
  return checkoutRes.ok
    ? { ok: true, data }
    : { ok: false, reason: 'http_error', message: data.error || 'checkout_failed' };
}

async function handleSubmit() {
  if (isSubmittingOrder) return;
  isSubmittingOrder = true;
  hideSubmitError();
  const payBtn = document.getElementById('btn-pay');
  if (payBtn) {
    payBtn.classList.add('is-pressed');
  }
  setPayBtnState(true);
  track('checkout_started', { topic: state.topic, storyDirection: state.storyDirection });

  try {
    const payload = {
      wizardData: buildWizardPayload(),
      sessionId: getOrCreateWizardSessionId(),
    };
    // ── Step 1: create the order ──────────────────────────────────
    let orderResponse = null;
    if (clientApi && typeof clientApi.requestJson === 'function') {
      orderResponse = await clientApi.requestJson('/api/orders', {
        fetch: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        timeoutMs: ORDER_SUBMIT_TIMEOUT_MS,
        fallbackMessage: 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏',
        timeoutMessage: 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏',
        networkMessage: 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏',
        invalidJsonMessage: 'התקבלה תגובה לא תקינה מהשרת.',
      });
    } else {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const fallbackData = await orderRes.json().catch(() => ({}));
      orderResponse = orderRes.ok
        ? { ok: true, data: fallbackData, message: null, reason: null, status: orderRes.status }
        : {
            ok: false,
            data: fallbackData,
            message: fallbackData.error || 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏',
            reason: 'http_error',
            status: orderRes.status,
          };
    }

    if (!orderResponse.ok) {
      const userMessage = 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏';
      reportClientIssue('submit_failed', {
        reason: orderResponse.reason || 'request_failed',
        status: orderResponse.status || 0,
      });
      throw new Error(userMessage);
    }

    const { orderId } = orderResponse.data || {};
    if (!orderId || typeof orderId !== 'string') {
      reportClientIssue('submit_failed', { reason: 'missing_order_id_in_response' });
      throw new Error('יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏');
    }

    const checkoutResponse = await startCheckout(orderId, payload.sessionId);
    if (!checkoutResponse.ok) {
      reportClientIssue('checkout_failed', {
        reason: checkoutResponse.reason || 'request_failed',
        orderId,
      });
      throw new Error(checkoutResponse.message || 'לא הצלחנו לפתוח את התשלום כרגע.');
    }

    const { url } = checkoutResponse.data || {};
    if (!url) {
      reportClientIssue('checkout_failed', { reason: 'missing_checkout_url', orderId });
      throw new Error('לא הצלחנו לפתוח את התשלום כרגע.');
    }

    const payHref = resolveCheckoutPaymentUrl(url, orderId);
    clearWizardSessionId();
    try {
      sessionStorage.removeItem(WIZARD_STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
    window.location.href = payHref;

  } catch (err) {
    console.error('[Wizard] Submit failed:', err);
    setPayBtnState(false);
    showSubmitError(
      err.message && err.message.length > 0
        ? err.message
        : 'יש עיכוב קטן בהכנת ההזמנה. נסו שוב בעוד רגע 🙏',
    );
  } finally {
    isSubmittingOrder = false;
  }
}

/* ── SHAKE ANIMATION ─────────────────────────────────────────── */
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

/* ── BOOT ────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", init);
