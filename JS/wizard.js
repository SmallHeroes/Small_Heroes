/* ═══════════════════════════════════════════════════════════
   WIZARD.JS  —  גיבורים קטנים
   Full wizard state, navigation, and dynamic rendering
   ═══════════════════════════════════════════════════════════ */

/* ── STATE ──────────────────────────────────────────────────── */
const state = {
  currentStep: 1,
  totalSteps: 9,

  topic:        null,
  childName:    '',
  childAge:     '',
  childGender:  '',
  childTraits:  [],
  photo:        null,

  difficulties: [],
  goals:        [],
  helpers:      [],
  avoid:        [],
  s4extra: '', s6extra: '', s7extra: '',

  /* product config */
  length:      'medium',   /* short | medium | long */
  style:       'soft',
  audioEnabled: false,
  voice:        null,      /* mom | dad | fairy */
  sleepMode:    false,
  pdfEnabled:   false,
  bundleEnabled: false,

  /* contact (step 9) */
  contactName:  '',
  contactEmail: '',
};

/* ── PRICING ─────────────────────────────────────────────────── */
const PRICES = {
  base:  { short: 39, medium: 49, long: 59 },
  audio: 19,
  pdf:   12,
  bundle: 25,
};

function computeTotal() {
  const base = PRICES.base[state.length] || 49;
  let addons = 0;
  if (state.bundleEnabled) {
    addons = PRICES.bundle;
  } else {
    if (state.audioEnabled) addons += PRICES.audio;
    if (state.pdfEnabled)   addons += PRICES.pdf;
  }
  return { base, addons, total: base + addons };
}

/* ── STATIC DATA ─────────────────────────────────────────────── */
const TOPICS = [
  { label: 'אזעקות / רעשים',         id: 'sirens'  },
  { label: 'פחדים בלילה',            id: 'night'   },
  { label: 'מעבר / גן חדש',          id: 'transition' },
  { label: 'אח / אחות חדשים',        id: 'sibling' },
  { label: 'ביטחון עצמי',            id: 'confidence' },
  { label: 'קושי חברתי',             id: 'social'  },
  { label: 'קושי בריכוז / למידה',    id: 'focus'   },
  { label: 'נושא אחר',               id: 'other'   },
];

const TRAITS = [
  'רגיש','שובב','מצחיק','חולם','ביישן',
  'אוהב להשתולל','אחר','עדין','סקרן','אמיץ',
];

const STORY_LENGTHS = [
  { id: 'long',   label: 'ארוך',   pages: '20 עמודים' },
  { id: 'medium', label: 'בינוני', pages: '15 עמודים' },
  { id: 'short',  label: 'קצר',    pages: '10 עמודים' },
];

const ILLUSTRATION_STYLES = [
  { id: 'soft',       label: 'איור ילדותי רך' },
  { id: 'disney',     label: 'דיסני רך וקסום' },
  { id: 'classic',    label: 'קלאסי (ספרים ישנים)' },
  { id: 'watercolor', label: 'תלת מימד' },
];

const VOICES = [
  { id: 'mom',   label: 'אמא',        emoji: '😸' },
  { id: 'dad',   label: 'אבא',        emoji: '😸' },
  { id: 'fairy', label: 'פייה קסומה', emoji: '🧚' },
];

/* ── INIT ────────────────────────────────────────────────────── */
function init() {
  buildPills();
  renderTopics();
  renderTraits();
  renderLengthBtns();
  renderStyleBtns();
  renderVoiceBtns();
  updateUI();
  refreshTotal(); // show initial price on step 8
}

/* ── PROGRESS PILLS ──────────────────────────────────────────── */
function buildPills() {
  const c = document.getElementById('progress-pills');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 1; i <= state.totalSteps; i++) {
    const p = document.createElement('div');
    p.className = 'pill';
    p.id = 'pill-' + i;
    c.appendChild(p);
  }
}

function updateProgress() {
  const lbl = document.getElementById('progress-label');
  if (lbl) lbl.textContent = `שלב ${state.currentStep} מתוך ${state.totalSteps}`;
  for (let i = 1; i <= state.totalSteps; i++) {
    const p = document.getElementById('pill-' + i);
    if (!p) continue;
    p.className = 'pill' + (
      i < state.currentStep  ? ' done'   :
      i === state.currentStep ? ' active' : ''
    );
  }
}

/* ── UI ──────────────────────────────────────────────────────── */
function updateUI() {
  updateProgress();

  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step-' + state.currentStep);
  if (el) {
    el.classList.add('active');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
  }

  const bar = document.getElementById('bottom-bar');
  const btn = document.getElementById('btn-continue');
  if (!bar || !btn) return;

  /* Step 1: inline start button — hide bar
     Step 2: auto-advances on chip click — hide bar */
  if (state.currentStep <= 2) {
    bar.classList.add('hidden');
  } else {
    bar.classList.remove('hidden');
    btn.textContent =
      state.currentStep === 3 ? 'ממשיכים לסיפור' :
      state.currentStep === 7 ? 'ממשיכים לבחירת חבילה' :
      state.currentStep === 8 ? 'ממשיכים לסיכום' :
      state.currentStep === 9 ? 'המשך לתשלום מאובטח →' :
      'ממשיכים';
  }

  // Update total price if on step 8
  if (state.currentStep === 8) refreshTotal();

  // Build summary on step 9
  if (state.currentStep === 9) buildSummary();
}

/* ── NAVIGATION ──────────────────────────────────────────────── */
function goNext() {
  // Validate step 3
  if (state.currentStep === 3) {
    state.childName   = document.getElementById('child-name').value.trim();
    state.childAge    = document.getElementById('child-age').value;
    state.childGender = document.getElementById('child-gender').value;
    if (!state.childName) {
      shake(document.getElementById('child-name'));
      return;
    }
  }

  // Collect textarea values
  if (state.currentStep === 4) state.s4extra = document.getElementById('s4-extra')?.value || '';
  if (state.currentStep === 6) state.s6extra = document.getElementById('s6-extra')?.value || '';
  if (state.currentStep === 7) state.s7extra = document.getElementById('s7-extra')?.value || '';

  // Step 9: submit
  if (state.currentStep === 9) {
    state.contactName  = document.getElementById('contact-name')?.value.trim() || '';
    state.contactEmail = document.getElementById('contact-email')?.value.trim() || '';
    if (!state.contactName || !state.contactEmail) {
      if (!state.contactName)  shake(document.getElementById('contact-name'));
      if (!state.contactEmail) shake(document.getElementById('contact-email'));
      return;
    }
    handleSubmit();
    return;
  }

  state.currentStep++;
  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shake(el) {
  if (!el) return;
  el.style.borderColor = '#ff6b6b';
  el.style.animation = 'shake 0.4s ease';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 2200);
}

/* ── TOPIC CHIPS ─────────────────────────────────────────────── */
function renderTopics() {
  const wrap = document.getElementById('topic-chips');
  if (!wrap) return;
  TOPICS.forEach(t => {
    const d = document.createElement('div');
    d.className = 'chip';
    d.textContent = t.label;
    d.setAttribute('data-id', t.id);
    d.addEventListener('click', () => {
      wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      d.classList.add('selected');
      state.topic = t.id;
      state.topicLabel = t.label;
      setTimeout(() => {
        state.currentStep = 3;
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    });
    wrap.appendChild(d);
  });
}

/* ── TRAIT CHIPS ─────────────────────────────────────────────── */
function renderTraits() {
  const wrap = document.getElementById('trait-chips');
  if (!wrap) return;
  TRAITS.forEach(t => {
    const d = document.createElement('div');
    d.className = 'trait-chip';
    d.textContent = t;
    d.addEventListener('click', () => {
      d.classList.toggle('selected');
      const i = state.childTraits.indexOf(t);
      i > -1 ? state.childTraits.splice(i, 1) : state.childTraits.push(t);
    });
    wrap.appendChild(d);
  });
}

/* ── GENERIC MULTI-SELECT CHIPS ──────────────────────────────── */
function toggleChip(el, key) {
  el.classList.toggle('selected');
  const val = el.textContent.trim();
  const arr = state[key];
  const i = arr.indexOf(val);
  i > -1 ? arr.splice(i, 1) : arr.push(val);
}

/* ── PHOTO UPLOAD ────────────────────────────────────────────── */
function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.photo = ev.target.result;
    const area = document.getElementById('photo-area');
    if (area) area.innerHTML = `<img class="preview" src="${ev.target.result}" alt="תמונה" />`;
  };
  reader.readAsDataURL(file);
}

/* ── STEP 8: LENGTH BUTTONS ──────────────────────────────────── */
function renderLengthBtns() {
  const wrap = document.getElementById('length-btns');
  if (!wrap) return;
  STORY_LENGTHS.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'length-btn' + (l.id === state.length ? ' selected' : '');
    btn.innerHTML = `${l.label}<span class="pages">${l.pages}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.length = l.id;
      refreshTotal();
    });
    wrap.appendChild(btn);
  });
}

/* ── STEP 8: STYLE BUTTONS ───────────────────────────────────── */
function renderStyleBtns() {
  const wrap = document.getElementById('style-btns');
  if (!wrap) return;
  ILLUSTRATION_STYLES.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'style-btn' + (s.id === state.style ? ' selected' : '');
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.style = s.id;
    });
    wrap.appendChild(btn);
  });
}

/* ── STEP 8: ADDON CHECKBOXES ────────────────────────────────── */
function toggleAddon(key) {
  state[key] = !state[key];

  // Bundle logic: selecting bundle enables both, disabling individual disables bundle
  if (key === 'bundleEnabled' && state.bundleEnabled) {
    state.audioEnabled = true;
    state.pdfEnabled   = true;
  }
  if ((key === 'audioEnabled' || key === 'pdfEnabled') && !state[key]) {
    state.bundleEnabled = false;
  }

  // Sync checkbox visuals
  syncAddonUI();
  refreshTotal();

  // Show/hide voice column & total
  const voiceActive = state.audioEnabled || state.bundleEnabled;
  const voiceCol = document.getElementById('s8-voice-col');
  if (voiceCol) voiceCol.classList.toggle('hidden', !voiceActive);
  const s8Grid = document.getElementById('s8-grid');
  if (s8Grid) s8Grid.classList.toggle('s8-three-col', voiceActive);
  const totalEl = document.getElementById('s8-total');
  if (totalEl) totalEl.style.display = 'block';

  // Dynamic add-ons card title
  const addonsTitle = document.getElementById('s8-addons-title');
  if (addonsTitle) {
    addonsTitle.textContent = voiceActive
      ? 'הפכו את הסיפור לחווייה מלאה'
      : 'רוצים לשדרג את הספר?';
  }
}

function syncAddonUI() {
  ['audio','pdf','bundle'].forEach(k => {
    const cb = document.getElementById('cb-' + k);
    if (cb) cb.classList.toggle('checked', state[k + 'Enabled']);
  });
}

/* ── STEP 8: VOICE BUTTONS ───────────────────────────────────── */
function renderVoiceBtns() {
  const wrap = document.getElementById('voice-btns');
  if (!wrap) return;
  VOICES.forEach(v => {
    const btn = document.createElement('div');
    btn.className = 'voice-btn' + (v.id === state.voice ? ' selected' : '');
    btn.id = 'voice-' + v.id;
    btn.innerHTML = `
      <div class="voice-btn-emoji">${v.emoji}</div>
      <div class="voice-btn-label">${v.label}</div>
      <button class="voice-play-btn" title="האזן לדוגמה" onclick="event.stopPropagation();playVoicePreview('${v.id}')">▶</button>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.voice = v.id;
    });
    wrap.appendChild(btn);
  });
}

function playVoicePreview(voiceId) {
  // TODO: call /api/audio/preview?voice=voiceId and play the audio
  console.log('[Voice preview]', voiceId);
}

/* ── STEP 8: SLEEP TOGGLE ────────────────────────────────────── */
function toggleSleep() {
  state.sleepMode = !state.sleepMode;
  const t = document.getElementById('sleep-toggle');
  if (t) t.classList.toggle('on', state.sleepMode);
  // Update addon checkbox style too
  const cb = document.getElementById('sleep-toggle');
  if (cb) cb.classList.toggle('on', state.sleepMode);
}

/* ── STEP 8: PRICE REFRESH ───────────────────────────────────── */
function refreshTotal() {
  const { total } = computeTotal();
  const el = document.getElementById('total-price');
  if (el) el.textContent = `₪${total}`;
}

/* ── STEP 9: BUILD SUMMARY ───────────────────────────────────── */
function buildSummary() {
  const { base, addons, total } = computeTotal();
  const lenLabel = STORY_LENGTHS.find(l => l.id === state.length)?.label || '';
  const styleLabel = ILLUSTRATION_STYLES.find(s => s.id === state.style)?.label || '';
  const voiceLabel = VOICES.find(v => v.id === state.voice)?.label || '';
  const topicLabel = state.topicLabel || state.topic || '';

  // Order summary (right card)
  const sumEl = document.getElementById('order-summary');
  if (sumEl) {
    const rows = [
      { icon: '👤', label: 'שם הילד:', val: state.childName + (state.childAge ? ` · גיל ${state.childAge}` : '') },
      topicLabel ? { icon: '📖', label: 'נושא:', val: topicLabel } : null,
      { icon: '📄', label: 'אורך:', val: `${lenLabel} (${STORY_LENGTHS.find(l=>l.id===state.length)?.pages||''})` },
      { icon: '🎨', label: 'סגנון:', val: styleLabel },
      state.audioEnabled ? { icon: '🎧', label: 'קריינות:', val: voiceLabel || '✓' } : null,
      state.pdfEnabled   ? { icon: '📥', label: 'PDF:', val: '✓' } : null,
      state.sleepMode    ? { icon: '🌙', label: 'מצב שינה:', val: '✓' } : null,
    ].filter(Boolean);

    sumEl.innerHTML = rows.map(r => `
      <div class="summary-row">
        <span class="summary-icon">${r.icon}</span>
        <span class="summary-label">${r.label}</span>
        <span class="summary-val">${r.val}</span>
      </div>`).join('');
  }

  // Pricing (middle card)
  const priceEl = document.getElementById('price-breakdown');
  if (priceEl) {
    let rows = `<div class="price-row"><span class="label">ספר דיגיטלי ${lenLabel}</span><span class="val">₪${base}</span></div>`;
    if (state.bundleEnabled) {
      rows += `<div class="price-row"><span class="label">קריינות + PDF (חבילה)</span><span class="val">₪${PRICES.bundle}</span></div>`;
    } else {
      if (state.audioEnabled) rows += `<div class="price-row"><span class="label">קריינות 🎧</span><span class="val">₪${PRICES.audio}</span></div>`;
      if (state.pdfEnabled)   rows += `<div class="price-row"><span class="label">PDF 📥</span><span class="val">₪${PRICES.pdf}</span></div>`;
    }
    rows += `<div class="price-total-row"><span class="price-total-label">סה״כ לתשלום:</span><span class="price-total-val">₪${total}</span></div>`;
    priceEl.innerHTML = rows;
  }

  // Dynamic quote using child name and topic
  const quoteEl = document.getElementById('s9-quote-text');
  if (quoteEl) {
    const name = state.childName || 'הגיבור/ת שלכם';
    const topicQuotes = {
      sirens:     `"פעם, כש${name} שמע/ה רעש חזק בחוץ... ${name} לקח/ה נשימה עמוקה ומצא/ה את הגיבור שבפנים..."`,
      night:      `"${name} היה/ייתה פעם קצת פוחד/ת בלילה... אבל אז ${name} פגש/פגשה את שומר האור שלו/שלה..."`,
      transition: `"${name} הגיע/ה למקום חדש ולב ${name} פעם הרגיש קצת רועד... עד שגילה/גילתה את הגיבור שבו/בה..."`,
      sibling:    `"כש${name} פגש/פגשה את התינוק הקטן בפעם הראשונה... ${name} גילה/גילתה כוח שלא ידע/ידעה שיש לו/לה..."`,
      confidence: `"${name} עמד/ה בפני האתגר ולב ${name} דפק חזק... ואז ${name} הבין/הבינה — הגיבור/ת תמיד היה/הייתה שם..."`,
      social:     `"${name} הסתכל/ה על הילדים האחרים... ואז ${name} החליט/החליטה להושיט יד עם לב פתוח..."`,
      focus:      `"${name} ישב/ישבה לפני המשימה הגדולה... ואז ${name} לקח/ה נשימה ומצא/ה את השקט שבפנים..."`,
      other:      `"פעם ${name} הרגיש/הרגישה קצת קשה... אבל ${name} גילה/גילתה שבתוכו/בתוכה חי גיבור/ה אמיתי/ת..."`,
    };
    quoteEl.textContent = topicQuotes[state.topic] || `"פעם ${name} הרגיש/הרגישה קצת קשה... אבל ${name} גילה/גילתה שהגיבור/ת חי בפנים..."`;
  }
}

/* ── SUBMIT ──────────────────────────────────────────────────── */
function handleSubmit() {
  console.log('[Wizard submit]', state);

  // TODO: POST to /api/orders then redirect to Stripe checkout
  // Example:
  // fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'},
  //   body: JSON.stringify({ wizardData: state }) })
  //   .then(r => r.json())
  //   .then(({ orderId }) => fetch('/api/checkout', { method:'POST',
  //     headers:{'Content-Type':'application/json'},
  //     body: JSON.stringify({ orderId }) }))
  //   .then(r => r.json())
  //   .then(({ url }) => window.location.href = url);

  // For now: go to generating page with state in sessionStorage
  sessionStorage.setItem('wizardState', JSON.stringify(state));
  window.location.href = 'generating.html';
}

/* ── SHAKE ANIMATION ─────────────────────────────────────────── */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{ transform:translateX(0);   }
    20%     { transform:translateX(-6px); }
    40%     { transform:translateX(6px);  }
    60%     { transform:translateX(-4px); }
    80%     { transform:translateX(4px);  }
  }
`;
document.head.appendChild(shakeStyle);

/* ── BOOT ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
