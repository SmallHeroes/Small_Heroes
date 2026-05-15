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
  directionPackages: [
    { id: 'bedtime', label: 'סיפור לפני שינה', pagesLine: '10 עמודים', price: 59 },
    { id: 'adventure', label: 'הרפתקה', pagesLine: '15 עמודים', price: 79 },
    { id: 'fantasy', label: 'מסע פלאי', pagesLine: '20 עמודים', price: 99 },
  ],
  styles: [],
  voices: [],
  progressLabel: 'שלב {current} מתוך {total}',
  microcopy: { s3: '', s4: '', s5: '', s6: '', s7: '', s8: '', s9: '', s10: '', s11: '', companion: '' },
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
      genderBoy: '', genderGirl: '', genderOther: '', traitsLabel: '', traitsNote: '',
      photoPrompt: '', photoOptional: '',
    },
    s4power: { title: '', sub: '', extraLabel: '', extraPlaceholder: '' },
    s4fam: {
      title: '', sub: '', sub2: '', parent1Label: '', parent2Label: '', siblingLabel: '', homeLabel: '',
      parent1NamePh: '', parent1DescPh: '', parent2NamePh: '', parent2DescPh: '',
      siblingNamePh: '', siblingAgePh: '', siblingDescPh: '', homePh: '',
    },
    s4: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    s5: { title: '', sub: '', sub2: '' },
    s6: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    s7: { title: '', sub: '', sub2: '', extraLabel: '', extraPlaceholder: '' },
    s8a: {
      title: '', sub: '', directionTitle: '', lengthTitle: '', styleLabel: '',
    },
    s8b: {
      title: '', sub: '', addonsSub: '', addonsExpanded: '', addonsCollapsed: '',
      voiceTitle: '', voicePreview: '',
      audio: { badge: '', name: '', desc: '' },
      pdf: { badge: '', name: '', desc: '' },
      video: { badge: '', name: '', desc: '' },
      bundle: { badge: '', name: '', desc: '' },
      sleep: { name: '', desc: '' },
    },
    /** Alias of addon copy (mirrors `s8b`). Kept so older merge paths remain valid. */
    s8: {
      title: '', sub: '', directionTitle: '', lengthTitle: '', styleLabel: '', addonsSub: '', addonsExpanded: '', addonsCollapsed: '',
      voiceTitle: '', voicePreview: '',
      audio: { badge: '', name: '', desc: '' },
      pdf: { badge: '', name: '', desc: '' },
      video: { badge: '', name: '', desc: '' },
      bundle: { badge: '', name: '', desc: '' },
      sleep: { name: '', desc: '' },
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
const WIZ_S8B_MERGED = mergeWizardStep8b(WIZ_DEFAULTS.steps.s8b, WIZ_STEPS_IN.s8b);

const WIZ = {
  ...WIZ_DEFAULTS,
  ...WIZ_INPUT,
  nav: { ...WIZ_DEFAULTS.nav, ...(WIZ_INPUT.nav || {}) },
  microcopy: { ...WIZ_DEFAULTS.microcopy, ...(WIZ_INPUT.microcopy || {}) },
  summary: { ...WIZ_DEFAULTS.summary, ...(WIZ_INPUT.summary || {}) },
  directionPackages:
    Array.isArray(WIZ_INPUT.directionPackages) && WIZ_INPUT.directionPackages.length > 0
      ? WIZ_INPUT.directionPackages
      : WIZ_DEFAULTS.directionPackages,
  steps: {
    ...WIZ_DEFAULTS.steps,
    ...(WIZ_INPUT.steps || {}),
    categoryFollowup: {
      ...WIZ_DEFAULTS.steps.categoryFollowup,
      ...((WIZ_INPUT.steps || {}).categoryFollowup || {}),
    },
    s8a: {
      ...WIZ_DEFAULTS.steps.s8a,
      ...(WIZ_STEPS_IN.s8a || {}),
    },
    s8b: WIZ_S8B_MERGED,
    s8: WIZ_S8B_MERGED,
    sBook: {
      ...WIZ_DEFAULTS.steps.sBook,
      ...(((WIZ_INPUT.steps || {}).sBook || {})),
    },
  },
};
const COMMON = HE_CONTENT.common || { brand: '', tagline: '', navCta: '' };
const DIRECTION_PACKAGES = WIZ.directionPackages;
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
  'קשה לזהות את הפנים בתמונה. אפשר להמשיך, אבל תמונה ברורה יותר תעזור לנו לדייק את הדמות 🙏';
const PHOTO_MSG_NO_PHOTO_HELPER =
  'תמונה ברורה של הפנים תעזור לנו ליצור דמות מדויקת יותר 😊';

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
const PHOTO_REASON_CODE_COPY = {
  multiple_faces_no_dominant: 'כמה אנשים בפריים — אם אפשר, תמונה עם פנים אחתות בולטות',
  face_too_small: 'הפנים יחסית קטנות בפריים',
  face_too_small_critical: 'הפנים יחסית קטנות בפריים',
  low_sharpness: 'התמונה קצת מטושטשת',
  low_brightness: 'התמונה קצת חשוכה',
  no_face_detected: 'קשה לנו לזהות פנים בבירור',
};
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
    detailed_whimsical_world: '/images/style-preview-03.webp',
  };
  return stylePreviewMap[styleId] || stylePreviewMap.soft_hand_drawn_storybook;
}

function normalizeClientStyleId(styleId) {
  const raw = String(styleId || '').trim();
  if (!raw) return 'soft_hand_drawn_storybook';
  const map = {
    soft_hand_drawn_storybook: 'soft_hand_drawn_storybook',
    expressive_painterly_storybook: 'expressive_painterly_storybook',
    detailed_whimsical_world: 'soft_hand_drawn_storybook', // retired — route to Style 01
    SIMPLE_CALM: 'soft_hand_drawn_storybook',
    FUN_COLORFUL: 'expressive_painterly_storybook',
    EMOTIONAL_ARTISTIC: 'soft_hand_drawn_storybook', // Legacy compatibility only — not offered for new books.
    SIMPLE_CARTOON: 'expressive_painterly_storybook',
    CLASSIC_CARTOON: 'soft_hand_drawn_storybook',
    DETAILED_CARTOON: 'soft_hand_drawn_storybook', // Legacy compatibility only — not offered for new books.
    clean_cartoon_2d: 'expressive_painterly_storybook',
    realistic_illustrated: 'soft_hand_drawn_storybook', // Legacy compatibility only — not offered for new books.
    whimsical_comic_fantasy: 'expressive_painterly_storybook',
    pencil_watercolor: 'soft_hand_drawn_storybook',
    DETAILED_WHIMSICAL_WORLD: 'soft_hand_drawn_storybook', // retired
  };
  return map[raw] || 'soft_hand_drawn_storybook';
}

/* ── STATE ──────────────────────────────────────────────────── */
const state = {
  currentStep: 1,
  totalSteps: 15,

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

  /* product config — direction sets page count + base price */
  storyDirection: 'adventure', /* bedtime | adventure | fantasy */
  style: null,
  styleSelected: false,
  audioEnabled: false,
  voice: "mom", /* mom | dad | fairy */
  sleepMode: false,
  pdfEnabled: false,
  videoEnabled: false,
  bundleEnabled: false,
  bookName: "",
  dedication: '',

  /* contact (summary) */
  contactName: "",
  contactEmail: "",
};

/* ── PRICING ─────────────────────────────────────────────────── */
const PRICES = {
  base: { bedtime: 59, adventure: 79, fantasy: 99 },
  audio: 19,
  pdf: 19,
  video: 29,
  bundle: 39,
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
    return;
  }
  try {
    const stored = localStorage.getItem(PREFERRED_DIRECTION_STORAGE_KEY);
    if (VALID_STORY_DIRECTIONS.includes(stored)) {
      state.storyDirection = stored;
      return;
    }
  } catch (_) {
    /* localStorage unavailable */
  }
  state.storyDirection = 'adventure';
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
    state.currentStep = snapshot.step;
    if (typeof state.storyDirection !== 'string' || !state.storyDirection) {
      const legacy = state.length;
      if (legacy === 'short' || legacy === 'medium' || legacy === 'long') {
        state.storyDirection = LENGTH_TO_DIRECTION[legacy] || 'adventure';
      } else {
        state.storyDirection = 'adventure';
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
    if (typeof state.videoEnabled !== 'boolean')     state.videoEnabled = false;
    state.audioEnabled = Boolean(state.audioEnabled);
    state.pdfEnabled = Boolean(state.pdfEnabled);
    state.bundleEnabled = Boolean(state.bundleEnabled);
    if (typeof state.styleSelected !== 'boolean') {
      state.styleSelected = Boolean(state.style);
    }
    if (state.style) {
      state.style = normalizeClientStyleId(state.style);
    } else {
      state.style = null;
    }
    state.photo = null;
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
  syncStep('#step-7', 'difficulties');
  syncStep('#step-8', 'goals');
  syncStep('#step-9', 'helpers');
  syncStep('#step-10', 'avoid');
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
  const base = PRICES.base[state.storyDirection] || PRICES.base.adventure;
  let addons = 0;

  if (state.bundleEnabled) {
    addons = PRICES.bundle;
  } else {
    if (state.audioEnabled) addons += PRICES.audio;
    if (state.pdfEnabled)   addons += PRICES.pdf;
    if (state.videoEnabled)  addons += PRICES.video;
  }

  return { base, addons, total: base + addons };
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

/** content.js `topics[].id` → COMPANIONS_BY_CATEGORY key */
const TOPIC_TO_CHALLENGE_CATEGORY = {
  sirens: 'NOISE_FEAR',
  night: 'NIGHT_FEAR',
  general_fears: 'GENERAL_FEARS',
  anger: 'ANGER_FRUSTRATION',
  sensitivity: 'SENSITIVITY_OVERWHELM',
  transition: 'TRANSITION',
  sibling: 'NEW_SIBLING',
  confidence: 'SELF_CONFIDENCE',
  social: 'SOCIAL',
  focus: 'FOCUS_LEARNING',
  medical: 'MEDICAL_PROCEDURE',
  other: 'OTHER',
};

const TOPIC_CHIP_ORDER = [
  'night',
  'sibling',
  'anger',
  'confidence',
  'transition',
  'social',
  'sensitivity',
  'general_fears',
  'sirens',
  'focus',
  'medical',
  'other',
];

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
  if (!topicId) return null;
  return TOPIC_TO_CHALLENGE_CATEGORY[topicId] || 'OTHER';
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

  const cat = state.challengeCategory;
  const map = globalThis.COMPANIONS_BY_CATEGORY;
  if (!cat || !map || !Array.isArray(map[cat])) {
    grid.innerHTML = '';
    if (cat) grid.dataset.challengeCategory = cat;
    return;
  }

  grid.dataset.challengeCategory = cat;
  const list = map[cat];

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
      grid.querySelectorAll('.companion-card').forEach((n) => n.classList.remove('selected'));
      btn.classList.add('selected');
      const cont = document.getElementById('btn-continue');
      if (cont && state.currentStep === 4) cont.disabled = false;
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
  renderTopics();
  renderTraits();
  renderSuperpowerChips();
  renderDirectionCards();
  renderStyleStepGrid();
  renderVoiceBtns();
  bindPhotoUploadInteractions();
  restorePhotoQualityFromStorage();
  renderPhotoUploadArea();
  renderPhotoQualityMessage();
  updateUI();
  refreshTotal();
  syncWizardLayout();
  syncStep8Layout(true);
  track('wizard_started');
}

/* ── STATIC CONTENT BINDING ──────────────────────────────────── */
function initWizardContent() {

  // Nav
  setText('wizNavBrand',   COMMON.brand);
  setText('wizNavTagline', COMMON.tagline);
  setText('wizNavCta',     COMMON.navCta);

  // Step 1 — title has a newline rendered as <br> in HTML
  const [s1Line1, s1Line2 = ''] = WIZ.steps.s1.title.split('\n');
  setText('s1TitleLine1', s1Line1);
  setText('s1TitleLine2', s1Line2);
  setText('s1Sub', WIZ.steps.s1.sub);
  setText('s1Btn', WIZ.steps.s1.cta);

  // Step 2
  setText('s2Title', WIZ.steps.s2.title);
  setText('s2Sub',   WIZ.steps.s2.sub);

  setText('catFollowTitle', (WIZ.steps.categoryFollowup || WIZ_DEFAULTS.steps.categoryFollowup).title);
  setText('catFollowSub',   (WIZ.steps.categoryFollowup || WIZ_DEFAULTS.steps.categoryFollowup).sub);

  // Step 4 — companion
  setText('companionMicro', WIZ.microcopy.companion || '');
  setText('companionTitle', WIZ.steps.companion?.title || '');
  setText('companionSub',   WIZ.steps.companion?.sub || '');

  // Micro-copy — warm acknowledgment lines shown at top of each step
  setText('s3micro',  WIZ.microcopy.s3);
  setText('s4micro',  WIZ.microcopy.s4);
  setText('s5micro',  WIZ.microcopy.s5);
  setText('s6micro',  WIZ.microcopy.s6);
  setText('s7micro',  WIZ.microcopy.s7);
  setText('s8micro',  WIZ.microcopy.s8);
  setText('s9micro',  WIZ.microcopy.s9);
  setText('sStyleMicro', WIZ.microcopy.sStyle || '');
  setText('sAddonsMicro', WIZ.microcopy.s8);
  setText('s10micro', WIZ.microcopy.s10);
  setText('s11micro', WIZ.microcopy.s11 || '');

  // Step 3
  setText('s3Title',               WIZ.steps.s3.title);
  setText('s3Sub',                 WIZ.steps.s3.sub);
  setText('s3NameLabel',           WIZ.steps.s3.nameLabel);
  setText('s3AgeLabel',            WIZ.steps.s3.ageLabel);
  setText('s3GenderLabel',         WIZ.steps.s3.genderLabel);
  setText('s3GenderOptBoy',        WIZ.steps.s3.genderBoy);
  setText('s3GenderOptGirl',       WIZ.steps.s3.genderGirl);
  setText('s3GenderOptOther',      WIZ.steps.s3.genderOther);
  setText('s3TraitsLabel',         WIZ.steps.s3.traitsLabel);
  setText('s3TraitsNote',          WIZ.steps.s3.traitsNote);
  setText('s3PhotoPrompt',         WIZ.steps.s3.photoPrompt);
  setText('s3PhotoOptional',       WIZ.steps.s3.photoOptional);

  // Step 4 — superpower
  setText('s4powermicro',      WIZ.microcopy.s4);
  setText('s4powerTitle',      WIZ.steps.s4power.title);
  setText('s4powerSub',        WIZ.steps.s4power.sub);
  setText('s4powerExtraLabel', WIZ.steps.s4power.extraLabel);
  const s4powerTa = document.getElementById('s4power-extra');
  if (s4powerTa) s4powerTa.placeholder = WIZ.steps.s4power.extraPlaceholder;

  // Step 6 — difficulties
  setText('s4Title',      WIZ.steps.s4.title);
  setText('s4Sub',        WIZ.steps.s4.sub);
  setText('s4Sub2',       WIZ.steps.s4.sub2);
  setText('s4ExtraLabel', WIZ.steps.s4.extraLabel);
  const s4ta = document.getElementById('s4-extra');
  if (s4ta) s4ta.placeholder = WIZ.steps.s4.extraPlaceholder;
  // Chip labels — toggleChip still reads el.textContent; values stored unchanged
  WIZ.difficulties.forEach((d, i) => setText('s4Chip' + i, d.label));

  // Step 6 — goals (was step 5)
  setText('s5Title', WIZ.steps.s5.title);
  setText('s5Sub',   WIZ.steps.s5.sub);
  setText('s5Sub2',  WIZ.steps.s5.sub2);
  WIZ.goals.forEach((g, i) => setText('s5Chip' + i, g.label));

  // Step 7 — helpers (was step 6)
  setText('s6Title',      WIZ.steps.s6.title);
  setText('s6Sub',        WIZ.steps.s6.sub);
  setText('s6Sub2',       WIZ.steps.s6.sub2);
  setText('s6ExtraLabel', WIZ.steps.s6.extraLabel);
  const s6ta = document.getElementById('s6-extra');
  if (s6ta) s6ta.placeholder = WIZ.steps.s6.extraPlaceholder;
  WIZ.helpers.forEach((h, i) => setText('s6Chip' + i, h.label));

  // Step 8 — avoid (was step 7)
  setText('s7Title',      WIZ.steps.s7.title);
  setText('s7Sub',        WIZ.steps.s7.sub);
  setText('s7Sub2',       WIZ.steps.s7.sub2);
  setText('s7ExtraLabel', WIZ.steps.s7.extraLabel);
  const s7ta = document.getElementById('s7-extra');
  if (s7ta) s7ta.placeholder = WIZ.steps.s7.extraPlaceholder;
  WIZ.avoid.forEach((a, i) => setText('s7Chip' + i, a.label));

  // Step 11 — direction
  setText('sDirectionTitle', WIZ.steps.sDirection.title);
  setText('sDirectionSub',   WIZ.steps.sDirection.sub);

  // Step 12 — style
  setText('sStyleTitle', WIZ.steps.sStyle.title);
  setText('sStyleSub',   WIZ.steps.sStyle.sub);

  // Step 13 — add-ons
  setText('s8Title', WIZ.steps.s8b.title);
  setText('s8Sub',   WIZ.steps.s8b.sub);
  setText('s8AddonSub',    WIZ.steps.s8b.addonsSub);
  setText('s8AudioBadge',  WIZ.steps.s8b.audio.badge);
  setText('s8AudioName',   WIZ.steps.s8b.audio.name);
  setText('s8AudioDesc',   WIZ.steps.s8b.audio.desc);
  setText('s8PdfBadge',    WIZ.steps.s8b.pdf.badge);
  setText('s8PdfName',     WIZ.steps.s8b.pdf.name);
  setText('s8PdfDesc',     WIZ.steps.s8b.pdf.desc);
  setText('s8VideoBadge',  WIZ.steps.s8b.video.badge);
  setText('s8VideoName',   WIZ.steps.s8b.video.name);
  setText('s8VideoDesc',   WIZ.steps.s8b.video.desc);
  setText('s8BundleBadge', WIZ.steps.s8b.bundle.badge);
  setText('s8BundleName',  WIZ.steps.s8b.bundle.name);
  setText('s8BundleDesc',  WIZ.steps.s8b.bundle.desc);
  setText('s8VoiceTitle',  WIZ.steps.s8b.voiceTitle);
  setText('s8SleepName',   WIZ.steps.s8b.sleep.name);
  setText('s8SleepDesc',   WIZ.steps.s8b.sleep.desc);
  setText('s8TotalLabel',  WIZ.summary.totalLabel);
  setText('bottomBarTotalLabel', 'סה"כ:');

  // Step 12 — book + dedication
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
  setText('s9Title',        WIZ.steps.s9.title);
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

/* ── HELPERS ─────────────────────────────────────────────────── */
function isVoicePanelActive() {
  return state.audioEnabled || state.videoEnabled || state.bundleEnabled;
}

function getVoiceCol() {
  return document.getElementById("s8-voice-col");
}

function getStep8Grid() {
  return document.getElementById("s8-grid");
}

function getAddonsTitle() {
  return document.getElementById("s8-addons-title");
}

/** Step 13 add-ons: centered stack, or side-by-side when voice panel is open. */
function applyAddonsStepLayout() {
  const grid = document.querySelector('#step-13 .s8-grid');
  if (!grid) return;
  if (state.currentStep === 13) {
    const split = isVoicePanelActive();
    grid.classList.toggle('s8-single-col', !split);
  } else {
    grid.classList.remove('s8-single-col');
  }
}

/* ── WIZARD LAYOUT ───────────────────────────────────────────── */
function syncWizardLayout() {
  const main = document.querySelector(".wizard-main");
  if (!main) return;

  const open = isVoicePanelActive() && state.currentStep === 13;
  main.classList.toggle("wizard-audio-open", open);
}

/* ── PROGRESS PILLS ──────────────────────────────────────────── */
function buildPills() {
  const c = document.getElementById("progress-pills");
  if (!c) return;

  c.innerHTML = "";

  for (let i = 1; i <= state.totalSteps; i++) {
    const p = document.createElement("div");
    p.className = "pill";
    p.id = "pill-" + i;
    c.appendChild(p);
  }
}

function updateProgress() {
  const lbl = document.getElementById("progress-label");
  if (lbl) lbl.textContent = WIZ.progressLabel
    .replace('{current}', state.currentStep)
    .replace('{total}',   state.totalSteps);

  for (let i = 1; i <= state.totalSteps; i++) {
    const p = document.getElementById("pill-" + i);
    if (!p) continue;

    p.className =
      "pill" +
      (i < state.currentStep
        ? " done"
        : i === state.currentStep
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
  const photoReassure = document.getElementById("photo-step-reassure");

  if (bar && btn && backBtn) {
    if (state.currentStep <= 2 || state.currentStep === 15) {
      bar.classList.add("hidden");
      if (btnAnyway) btnAnyway.hidden = true;
      if (photoReassure) photoReassure.hidden = true;
    } else {
      bar.classList.remove("hidden");

      if (state.currentStep === 5) {
        updatePhotoStepBottomBar();
      } else {
        btn.textContent =
          state.currentStep === 6  ? WIZ.nav.continueToStory   :
          state.currentStep === 10 ? WIZ.nav.continueToDirection :
          state.currentStep === 14 ? WIZ.nav.continueToSummary :
          WIZ.nav.continueDefault;
        btn.onclick = goNext;
        if (btnAnyway) btnAnyway.hidden = true;
        if (photoReassure) photoReassure.hidden = true;
        if (state.currentStep === 4) {
          btn.disabled = !state.companionCharacterId;
        } else if (state.currentStep === 12) {
          btn.disabled = !state.styleSelected;
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

  if (state.currentStep === 3) {
    renderCategoryFollowupFields();
  }

  if (state.currentStep === 4) {
    renderCompanionCards();
  }

  // Running total appears from the direction step onward (step 11), once a
  // direction is selected — user requested seeing the price as soon as they pick.
  const bottomBarTotal = document.getElementById('bottom-bar-total');
  if (bottomBarTotal) {
    bottomBarTotal.hidden = !(state.currentStep >= 11 && Boolean(state.storyDirection));
  }

  if (state.currentStep === 11) {
    renderDirectionCards();
    refreshTotal();
  }

  if (state.currentStep === 12) {
    renderStyleStepGrid();
  }

  if (state.currentStep === 13) {
    syncStep8Layout(true);
    refreshTotal();
  }

  if (state.currentStep === 15) {
    buildSummary();
  }

  const photoHint = document.getElementById('photo-reupload-hint');
  if (photoHint) {
    if (state.currentStep === 5) {
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

  if (state.currentStep === 3) {
    persistFollowupDraftFromDom();
  }

  if (state.currentStep === 4) {
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

  if (state.currentStep === 5) {
    state.childName   = document.getElementById("child-name")?.value.trim() || "";
    state.childAge    = document.getElementById("child-age")?.value || "";
    state.childGender = document.getElementById("child-gender")?.value || "";

    if (!state.childName) {
      shake(document.getElementById("child-name"));
      return;
    }
    // Photo is optional: never block progression here.
  }

  if (state.currentStep === 6) {
    state.childSuperpowerExtra = document.getElementById("s4power-extra")?.value.trim() || "";
  }

  if (state.currentStep === 7) {
    state.s4extra = document.getElementById("s4-extra")?.value || "";
  }

  if (state.currentStep === 9) {
    state.s6extra = document.getElementById("s6-extra")?.value || "";
  }

  if (state.currentStep === 10) {
    state.s7extra = document.getElementById("s7-extra")?.value || "";
  }

  if (state.currentStep === 14) {
    state.bookName = document.getElementById("bookNameInput")?.value.trim() || "";
    state.dedication = (document.getElementById("dedicationInput")?.value || "").slice(0, 300);
  }

  if (state.currentStep === 15) {
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

  if (stepBeforeAdvance === 11) {
    persistPreferredDirection(state.storyDirection);
  }

  if (stepBeforeAdvance === 12 && !state.styleSelected) {
    const grid = document.getElementById('style-step-grid');
    if (grid) {
      grid.style.animation = 'none';
      void grid.offsetHeight;
      grid.style.animation = 'shake 0.4s ease';
    }
    return;
  }

  state.currentStep++;
  if (state.currentStep === 12 && stepBeforeAdvance === 11) {
    state.style = null;
    state.styleSelected = false;
    renderStyleStepGrid();
  }

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

  state.currentStep--;

  updateUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── TOPIC CHIPS (flat ordered flow) ─────────────────────────── */

function addTopicChip(wrap, t, afterSelect) {
  const d = document.createElement('div');
  d.className = 'chip';
  d.textContent = t.label;
  d.setAttribute('data-id', t.id);
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
    state.challengeCategory = getChallengeCategoryForTopicId(t.id);
    const cat = String(state.challengeCategory || '');

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

    (async function loadBranch() {
      try {
        const data = await fetchCategoryBranching(cat);
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
  });
  wrap.appendChild(d);
}

function goToCategoryFollowupStep() {
  state.currentStep = 3;
  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTopics() {
  const wrap = document.getElementById('topic-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const topicById = new Map(TOPICS.map((topic) => [topic.id, topic]));
  TOPIC_CHIP_ORDER.forEach((topicId) => {
    const topic = topicById.get(topicId);
    if (!topic) return;
    addTopicChip(wrap, topic, goToCategoryFollowupStep);
  });

  if (state.topic) {
    const selected = wrap.querySelector(`[data-id="${state.topic}"]`);
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

function renderSuperpowerChips() {
  const wrap = document.getElementById("superpower-chips");
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
  if (state.currentStep !== 5) return;
  const btn = document.getElementById('btn-continue');
  const btnAnyway = document.getElementById('btn-continue-anyway');
  const photoReassure = document.getElementById('photo-step-reassure');
  if (!btn) return;

  const st = state.photoQuality?.status;
  const hasPhoto = Boolean(state.photo);
  const isWarningOrBlocked =
    st === PHOTO_QUALITY_STATUS.WARNING || st === PHOTO_QUALITY_STATUS.BLOCKED;

  btn.textContent = !hasPhoto
    ? 'להמשיך בלי תמונה'
    : isWarningOrBlocked
      ? 'להמשיך בכל זאת'
      : 'ממשיכים';
  btn.onclick = goNext;
  btn.disabled = false;
  if (btnAnyway) {
    btnAnyway.hidden = true;
  }
  if (photoReassure) {
    photoReassure.hidden = hasPhoto;
  }
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
    box.innerHTML = `<p class="photo-helper-text">${PHOTO_MSG_NO_PHOTO_HELPER}</p>`;
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

  if (status === PHOTO_QUALITY_STATUS.WARNING) {
    box.hidden = false;
    box.innerHTML = `
    <div class="photo-quality-alert photo-quality-alert--warning">
      <div class="photo-quality-alert-title">${PHOTO_MSG_WARNING}</div>
    </div>
  `;
    updatePhotoStepBottomBar();
    return;
  }

  box.hidden = false;
  box.innerHTML = `
    <div class="photo-quality-alert photo-quality-alert--blocked">
      <div class="photo-quality-alert-title">${PHOTO_MSG_BLOCKED}</div>
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
    faceCount > 1 ||
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
  const imageEl = await createImageFromDataUrl(dataUrl);
  const { sharpness, brightness } = computeSharpnessAndBrightness(imageEl);
  try {
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
    const result = classifyPhotoQuality({
      faceCount: faceRatios.length,
      dominantFaceRatio,
      hasDominantFace,
      sharpness,
      brightness,
    });
    return result;
  } catch (_) {
    const serverResult = await analyzePhotoQualityViaServer(dataUrl);
    return serverResult;
  }
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

/* ── STEP 11: DIRECTION CARDS ─────────────────────────────────── */
function renderDirectionCards() {
  const wrap = document.getElementById('direction-cards');
  if (!wrap) return;

  wrap.innerHTML = '';
  wrap.style.direction = 'rtl';

  // RTL pricing order: DOM index 1 → visually RIGHTMOST when parent has direction:rtl.
  // We want entry-level (bedtime ₪59) on the right where the Hebrew eye starts reading,
  // ascending to premium (fantasy ₪99) on the left — natural cheap→expensive flow
  // following the reading direction. Mobile (single column) stacks cheapest-first.
  const ORDER = { bedtime: 1, adventure: 2, fantasy: 3 };
  const pkgs = [...DIRECTION_PACKAGES].sort((a, b) => {
    const ao = ORDER[a.id] || 99;
    const bo = ORDER[b.id] || 99;
    return ao - bo;
  });

  pkgs.forEach((d) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'direction-card' + (d.id === state.storyDirection ? ' selected' : '');
    card.setAttribute('data-direction', d.id);

    const featuresHtml = (d.features || [])
      .map((feature) => `<li><span class="direction-card-feature-icon" aria-hidden="true">✨</span>${feature}</li>`)
      .join('');

    const pillHtml = d.parentPill
      ? `<span class="direction-card-pill direction-card-pill--floating">${d.parentPill}</span>`
      : '';

    const ctaLabel = d.id === state.storyDirection
      ? (d.ctaSelected || d.ctaChoose || 'זו הבחירה שלי')
      : (d.ctaChoose || 'לבחירה');

    card.innerHTML = `
      ${pillHtml}
      <span class="direction-card-kicker">${d.topLabel || d.label}</span>
      <span class="direction-card-title">${d.title || d.label}</span>
      <span class="direction-card-pages">${d.pagesLine || d.subtitle || ''}</span>
      <p class="direction-card-desc">${d.description || ''}</p>
      <ul class="direction-card-features">${featuresHtml}</ul>
      <span class="direction-card-price">₪<span class="direction-card-price-digits">${d.price}</span></span>
      <span class="direction-card-cta">${ctaLabel}</span>
    `;

    card.addEventListener('click', () => {
      state.storyDirection = d.id;
      persistPreferredDirection(d.id);
      renderDirectionCards();
      refreshTotal();
      const bbt = document.getElementById('bottom-bar-total');
      if (bbt) bbt.hidden = false;
      const cont = document.getElementById('btn-continue');
      if (cont && state.currentStep === 11) cont.disabled = false;
      queueWizardSave();
    });

    wrap.appendChild(card);
  });
}

/* ── STEP 12: STYLE CARDS ────────────────────────────────────── */
function renderStyleStepGrid() {
  const wrap = document.getElementById('style-step-grid');
  if (!wrap) return;

  wrap.innerHTML = '';

  ILLUSTRATION_STYLES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'style-btn style-card style-step-card' + (s.id === state.style ? ' selected' : '');
    btn.innerHTML = `
      <span class="style-card-image-wrap">
        <img class="style-card-image" src="${getStylePreviewDataUrl(s.id)}" alt="${s.label}" />
      </span>
      <span class="style-card-name">${s.label}</span>
      <span class="style-card-desc">${s.description || ''}</span>
    `;

    btn.addEventListener('click', () => {
      document.querySelectorAll('#style-step-grid .style-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.style = s.id;
      state.styleSelected = true;
      const cont = document.getElementById('btn-continue');
      if (cont && state.currentStep === 12) cont.disabled = false;
      queueWizardSave();
    });

    wrap.appendChild(btn);
  });
}

/* ── STEP 8: ADDONS ──────────────────────────────────────────── */
function toggleAddon(key) {
  switch (key) {
    case "audioEnabled": {
      const next = !state.audioEnabled;

      state.audioEnabled = next;

      if (!next) {
        state.bundleEnabled = false;
        state.voice         = null;
        state.sleepMode     = false;
      } else {
        if (state.bundleEnabled) {
          state.bundleEnabled = false;
          state.videoEnabled = false;
          state.pdfEnabled = false;
        }
        if (!state.voice) {
          state.voice = "mom";
        }
      }

      break;
    }

    case "pdfEnabled": {
      const next = !state.pdfEnabled;

      state.pdfEnabled = next;

      if (!next) {
        state.bundleEnabled = false;
      }

      break;
    }

    case "videoEnabled": {
      const next = !state.videoEnabled;
      state.videoEnabled = next;
      if (next) {
        if (!state.voice) state.voice = "mom";
      } else {
        if (state.bundleEnabled) {
          state.bundleEnabled = false;
          state.pdfEnabled = false;
        }
        if (!state.audioEnabled) {
          state.voice = null;
          state.sleepMode = false;
        }
      }
      break;
    }

    case "bundleEnabled": {
      const next = !state.bundleEnabled;

      state.bundleEnabled = next;

      if (next) {
        state.videoEnabled = true;
        state.pdfEnabled = true;
        state.audioEnabled = false;
        if (!state.voice) state.voice = "mom";
      } else {
        state.videoEnabled = false;
        state.pdfEnabled = false;
        state.voice = null;
        state.sleepMode = false;
      }

      break;
    }

    default:
      return;
  }

  syncAddonUI();
  refreshTotal();
  syncStep8Layout();
  queueWizardSave();
}

/* ── STEP 8: CHECKBOX UI ─────────────────────────────────────── */
function syncAddonUI() {
  const checkboxMap = {
    audio:  state.audioEnabled,
    pdf:    state.pdfEnabled,
    video:  state.videoEnabled,
    bundle: state.bundleEnabled,
  };

  Object.entries(checkboxMap).forEach(([name, active]) => {
    const cb = document.getElementById("cb-" + name);
    if (!cb) return;

    cb.classList.toggle("checked", active);

    const row = cb.closest(".addon-row");
    if (row) row.classList.toggle("selected", active);
  });
}

/* ── STEP 8: VOICE PANEL ANIMATION ───────────────────────────── */
function syncStep8Layout(skipAnimation = false) {
  const voiceCol    = getVoiceCol();
  const grid        = getStep8Grid();
  const addonsTitle = getAddonsTitle();
  const step13Addons = state.currentStep === 13;
  const shouldShow = isVoicePanelActive() && step13Addons;

  if (addonsTitle) {
    addonsTitle.textContent = shouldShow
      ? WIZ.steps.s8b.addonsExpanded
      : WIZ.steps.s8b.addonsCollapsed;
  }

  if (grid) {
    grid.classList.toggle("voice-open", shouldShow);
    if (state.currentStep === 13) {
      grid.classList.remove("s8-three-col");
    } else {
      grid.classList.toggle("s8-three-col", shouldShow);
    }
  }

  syncWizardLayout();
  applyAddonsStepLayout();

  if (!voiceCol) return;

  if (state.currentStep === 13) {
    voiceCol.style.maxHeight = '';
    voiceCol.style.overflow = '';
    voiceCol.style.willChange = 'opacity, transform';
    voiceCol.style.transition = 'opacity 280ms ease, transform 280ms ease';
    voiceCol.classList.toggle('hidden', !shouldShow);
    voiceCol.classList.toggle('is-open', shouldShow);
    voiceCol.style.pointerEvents = shouldShow ? 'auto' : 'none';
    voiceCol.style.opacity = shouldShow ? '1' : '0';
    voiceCol.style.transform = shouldShow ? 'translateX(0)' : 'translateX(-10px)';
    return;
  }

  if (skipAnimation) {
    voiceCol.classList.toggle("hidden",  !shouldShow);
    voiceCol.classList.toggle("is-open",  shouldShow);
    voiceCol.style.pointerEvents = shouldShow ? "auto"               : "none";
    voiceCol.style.opacity       = shouldShow ? "1"                  : "0";
    voiceCol.style.transform     = shouldShow ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)";
    voiceCol.style.maxHeight     = shouldShow ? "420px"              : "0px";
    voiceCol.style.overflow      = "hidden";
    return;
  }

  animateVoicePanel(voiceCol, shouldShow);
}

function animateVoicePanel(panel, show) {
  if (!panel) return;

  if (state.currentStep === 13) {
    panel.style.maxHeight = '';
    panel.style.overflow = '';
    panel.style.willChange = 'opacity, transform';
    panel.style.transition = 'opacity 280ms ease, transform 280ms ease';
    panel.classList.toggle('hidden', !show);
    panel.classList.toggle('is-open', show);
    panel.style.pointerEvents = show ? 'auto' : 'none';
    panel.style.opacity = show ? '1' : '0';
    panel.style.transform = show ? 'translateX(0)' : 'translateX(-10px)';
    return;
  }

  panel.style.overflow    = "hidden";
  panel.style.willChange  = "opacity, transform, max-height";
  panel.style.transition  = "opacity 320ms ease, transform 320ms ease, max-height 360ms ease";

  if (show) {
    panel.classList.remove("hidden");
    panel.style.display      = "";
    panel.style.pointerEvents = "none";
    panel.style.opacity      = "0";
    panel.style.transform    = "translateY(12px) scale(0.98)";
    panel.style.maxHeight    = "0px";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add("is-open");
        panel.style.opacity   = "1";
        panel.style.transform = "translateY(0) scale(1)";
        panel.style.maxHeight = panel.scrollHeight + 24 + "px";
      });
    });

    clearTimeout(panel._hideTimer);
    panel._showTimer = setTimeout(() => {
      panel.style.maxHeight    = "420px";
      panel.style.pointerEvents = "auto";
    }, 380);

    return;
  }

  panel.style.pointerEvents = "none";
  panel.style.maxHeight     = panel.scrollHeight + "px";
  panel.style.opacity       = "1";
  panel.style.transform     = "translateY(0) scale(1)";

  requestAnimationFrame(() => {
    panel.classList.remove("is-open");
    panel.style.opacity   = "0";
    panel.style.transform = "translateY(10px) scale(0.985)";
    panel.style.maxHeight = "0px";
  });

  clearTimeout(panel._showTimer);
  panel._hideTimer = setTimeout(() => {
    panel.classList.add("hidden");
  }, 360);
}

/* ── STEP 8: VOICE BUTTONS ───────────────────────────────────── */
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
      <span class="voice-play-btn" title="${WIZ.steps.s8b.voicePreview}" aria-hidden="true">▶</span>
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
function toggleSleep() {
  if (!isVoicePanelActive()) return;

  state.sleepMode = !state.sleepMode;

  const t = document.getElementById("sleep-toggle");
  if (t) {
    t.classList.toggle("on", state.sleepMode);
  }

  const row = t?.closest(".sleep-row");
  if (row) {
    row.classList.toggle("selected", state.sleepMode);
  }
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

  const dirPkg =
    DIRECTION_PACKAGES.find((d) => d.id === state.storyDirection) || DIRECTION_PACKAGES[1];
  const dirLabel = dirPkg?.label || "";
  const dirPages = dirPkg?.pagesLine || "";
  const styleObj = ILLUSTRATION_STYLES.find((s) => s.id === state.style);
  const voiceObj = VOICES.find((v) => v.id === state.voice);

  const lenLabel   = dirLabel;
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
            <span class="summary-val">${dirPkg?.title || lenLabel} · ${dirPages}</span>
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
      state.audioEnabled && !state.videoEnabled && !state.bundleEnabled
        ? { icon: "🎧", label: WIZ.summary.audioLabel, val: voiceLabel || "✓" }
        : null,
      state.pdfEnabled && !state.bundleEnabled
        ? { icon: "📥", label: WIZ.summary.pdfLabel, val: "✓" }
        : null,
      state.videoEnabled && !state.bundleEnabled
        ? { icon: "🎬", label: WIZ.summary.videoLabel || 'סרטון:', val: voiceLabel ? `${voiceLabel}` : '✓' }
        : null,
      state.bundleEnabled
        ? { icon: "🎁", label: WIZ.summary.bundleLabel, val: voiceLabel ? `${voiceLabel}` : '✓' }
        : null,
      state.sleepMode &&
        (state.audioEnabled || state.videoEnabled || state.bundleEnabled)
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
    const difficultiesVal = toSummaryLabels(state.difficulties, WIZ.difficulties || []);
    const goalsVal = toSummaryLabels(state.goals, WIZ.goals || []);
    const helpersVal = toSummaryLabels(state.helpers, WIZ.helpers || []);
    const avoidVal = toSummaryLabels(state.avoid, WIZ.avoid || []);

    const emotionalRows = [
      superpowerVal
        ? { icon: '💪', label: 'כוחות:', val: superpowerVal }
        : null,
      difficultiesVal
        ? { icon: '🌊', label: 'מה קצת קשה:', val: difficultiesVal }
        : null,
      goalsVal
        ? { icon: '🌟', label: 'לאן נוביל:', val: goalsVal }
        : null,
      helpersVal
        ? { icon: '🤍', label: 'מה עוזר:', val: helpersVal }
        : null,
      avoidVal
        ? { icon: '🚫', label: 'להשאיר בחוץ:', val: avoidVal }
        : null,
    ].filter(Boolean);

    const answeredFollowups = (state.categoryAnswers || []).filter((a) => {
      const hasText = Boolean(a && a.answer && a.answer.trim());
      const hasQuick = Boolean(a && Array.isArray(a.selectedQuickAnswers) && a.selectedQuickAnswers.length > 0);
      return hasText || hasQuick;
    });

    const emotionalHtml = emotionalRows.map((r) => `
      <div class="summary-row summary-row--soft">
        <span class="summary-icon">${r.icon}</span>
        <span class="summary-label">${r.label}</span>
        <span class="summary-val">${r.val}</span>
      </div>
    `).join('');

    const followupHint = answeredFollowups.length > 0
      ? `<div class="summary-followup-count">+ ${answeredFollowups.length} שאלות השלמה</div>`
      : '';

    const extraDetails = emotionalHtml + followupHint;

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
    let rows = `
      <div class="price-row">
        <span class="label">${WIZ.summary.bookDigital.replace('{length}', lenLabel)}</span>
        <span class="val">₪${base}</span>
      </div>
    `;

    if (state.bundleEnabled) {
      rows += `
        <div class="price-row">
          <span class="label">${WIZ.summary.bundleLabel}</span>
          <span class="val">₪${PRICES.bundle}</span>
        </div>
      `;
    } else {
      if (state.audioEnabled) {
        rows += `
          <div class="price-row">
            <span class="label">${WIZ.summary.audioAddon}</span>
            <span class="val">₪${PRICES.audio}</span>
          </div>
        `;
      }

      if (state.pdfEnabled) {
        rows += `
          <div class="price-row">
            <span class="label">${WIZ.summary.pdfAddon}</span>
            <span class="val">₪${PRICES.pdf}</span>
          </div>
        `;
      }

      if (state.videoEnabled) {
        rows += `
          <div class="price-row">
            <span class="label">${WIZ.summary.videoAddon || 'סרטון 🎬'}</span>
            <span class="val">₪${PRICES.video}</span>
          </div>
        `;
      }
    }

    rows += `
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
  // Normalise topic IDs — content.js uses abbreviated keys, backend uses full keys.
  const TOPIC_ID_MAP = {
    confidence: 'selfconfidence',
    night: 'nightfear',
    general_fears: 'generalfears',
  };
  const topic = TOPIC_ID_MAP[state.topic] || state.topic;
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
      audioEnabled:      state.audioEnabled,
      selectedVoice:
        state.audioEnabled || state.videoEnabled || state.bundleEnabled
          ? (state.voice || null)
          : null,
      sleepMode:         state.sleepMode,
      pdfEnabled:        state.pdfEnabled,
      bundleEnabled:     state.bundleEnabled,
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

/* ── BOOT ──────────────────────────────────────────�