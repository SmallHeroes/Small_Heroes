'use client';

import { useEffect, useState } from 'react';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';

/* ── Token inventories (names only — values are read LIVE from computed styles,
      so this page can never drift from public/CSS/tokens.css) ─────────────── */

const BRAND_TOKENS = [
  '--brand-purple', '--brand-purple-strong', '--brand-purple-deep',
  '--brand-purple-soft', '--brand-purple-faint', '--brand-yellow', '--brand-yellow-ink',
];
const INK_TOKENS = ['--ink-strong', '--ink', '--ink-2', '--ink-3'];
const SURFACE_TOKENS = [
  '--surface-page', '--surface-alt',
  '--surface-sunken', '--surface-dark',
];
const BORDER_TOKENS = ['--border-soft', '--border', '--border-strong'];
const FEEDBACK_TOKENS = [
  '--success', '--success-bg', '--warning', '--warning-bg', '--error', '--error-bg',
];
const SPACE_TOKENS: Array<[string, number]> = [
  ['--sp-3xs', 4], ['--sp-2xs', 8], ['--sp-xs', 12], ['--sp-sm', 16], ['--sp-md', 24],
  ['--sp-lg', 32], ['--sp-xl', 40], ['--sp-2xl', 48], ['--sp-3xl', 64], ['--sp-4xl', 80],
  ['--sp-5xl', 96], ['--sp-6xl', 120],
];
const RADIUS_TOKENS = ['--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill'];
const SHADOW_TOKENS = ['--shadow-1', '--shadow-2', '--shadow-3', '--shadow-primary-btn'];
const MOTION_TOKENS = ['--dur-fast', '--dur-base', '--dur-slow', '--dur-page', '--ease-out', '--ease-soft'];

const SAMPLE_SLOT: MvpMatrixCategoryPayload = {
  category: 'NIGHT_FEAR',
  topicId: 'night',
  label: 'פחדים בלילה',
  emoji: '🌙',
  oneLiner: 'סיפור שעוזר להכיר את הלילה במקום לפחד ממנו',
  companionLine: 'עם אוּרי השועל',
  publicVisible: true,
  companion: {
    id: 'fox_uri',
    name: 'השועל אוּרי',
    image: '/companions/fox_uri/style01-sheets/front.png',
    tagline: '',
  },
  directions: {},
} as MvpMatrixCategoryPayload;

function useTokenValues(names: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const n of names) next[n] = cs.getPropertyValue(n).trim();
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return values;
}

function SwatchGrid({ tokens }: { tokens: string[] }) {
  const values = useTokenValues(tokens);
  return (
    <div className="ds-grid">
      {tokens.map((t) => (
        <div key={t} className="ds-swatch">
          <div className="ds-swatch-color" style={{ background: `var(${t})` }} />
          <div className="ds-swatch-meta">
            <span className="ds-swatch-name">{t}</span>
            <span className="ds-swatch-value">{values[t] || '…'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DesignSystemClient() {
  const motionValues = useTokenValues(MOTION_TOKENS);
  const [selectedCard, setSelectedCard] = useState(false);

  return (
    <div className="ds-root" data-motion="on">
      {/* Real wizard stylesheet — form/chip/progress specimens below use production classes */}
      <link rel="stylesheet" href="/CSS/wizard.css" />

      <div className="ds-shell">
        <header className="ds-intro">
          <h1 className="t-h1">Design System — גיבורים קטנים</h1>
          <p className="t-body-lg" style={{ marginTop: 'var(--sp-2xs)' }}>
            עמוד פנימי (dev בלבד). כל מה שמוצג כאן נקרא ישירות מ־
            <code>public/CSS/tokens.css</code> ומהקלאסים האמיתיים של המוצר — אין כאן העתקים.
          </p>
        </header>

        {/* ── Colors ── */}
        <section className="ds-section" id="colors">
          <h2>צבע — מותג</h2>
          <p className="ds-section-note">
            סגול = אינטראקציה ומותג. צהוב = הדגשה בלבד (אף פעם לא כפתור ראשי). הערכים החיים נקראים מה־DOM.
          </p>
          <SwatchGrid tokens={BRAND_TOKENS} />

          <h2 style={{ marginTop: 'var(--sp-lg)' }}>צבע — טקסט (ink)</h2>
          <p className="ds-section-note">
            ארבע דרגות בלבד: כותרות · גוף · משני · מעומעם. אין יותר אפורים אד-הוק.
          </p>
          <SwatchGrid tokens={INK_TOKENS} />

          <h2 style={{ marginTop: 'var(--sp-lg)' }}>משטחים וגבולות</h2>
          <SwatchGrid tokens={[...SURFACE_TOKENS, ...BORDER_TOKENS]} />

          <h2 style={{ marginTop: 'var(--sp-lg)' }}>משוב (הצלחה / אזהרה / שגיאה)</h2>
          <SwatchGrid tokens={FEEDBACK_TOKENS} />
        </section>

        {/* ── Typography ── */}
        <section className="ds-section" id="typography">
          <h2>טיפוגרפיה</h2>
          <p className="ds-section-note">
            תצוגה: <strong>Rubik</strong> (משתנה, 800–900 לכותרות) · גוף: <strong>Heebo</strong>.
            Abraham הוסר (לא מורשה + ספרות שבורות). Rubik Mono One נפסל — אין לו עברית.
            כל תפקיד = משפחה + גודל clamp + משקל + גובה שורה.
          </p>
          <div>
            <div className="ds-type-row"><span className="ds-type-label">display · 900</span><span className="t-display">גיבורים קטנים</span></div>
            <div className="ds-type-row"><span className="ds-type-label">h1 · 800</span><span className="t-h1">ספר אישי שילדים גדלים איתו</span></div>
            <div className="ds-type-row"><span className="ds-type-label">h2 · 800</span><span className="t-h2">איך זה עובד?</span></div>
            <div className="ds-type-row"><span className="ds-type-label">h3 · 700</span><span className="t-h3">הרפתקה אישית — 24 עמודים</span></div>
            <div className="ds-type-row"><span className="ds-type-label">h4 (Heebo) · 700</span><span className="t-h4">כותרת כרטיס</span></div>
            <div className="ds-type-row"><span className="ds-type-label">eyebrow</span><span className="t-eyebrow">הצצה לדוגמה</span></div>
            <div className="ds-type-row"><span className="ds-type-label">body-lg</span><span className="t-body-lg">טקסט מוביל מתחת לכותרות — עד {`{--measure-sub}`} תווים לשורה.</span></div>
            <div className="ds-type-row"><span className="ds-type-label">body</span><span className="t-body">טקסט רץ רגיל. שורה נוחה לקריאה בעברית ולא רחבה מדי.</span></div>
            <div className="ds-type-row"><span className="ds-type-label">label</span><span className="t-label">איך קוראים לו?</span></div>
            <div className="ds-type-row"><span className="ds-type-label">caption</span><span className="t-caption">66/300 · טקסט עזר קטן</span></div>
            <div className="ds-type-row"><span className="ds-type-label">error</span><span className="t-error">צריך למלא שם כדי להמשיך</span></div>
            <div className="ds-type-row"><span className="ds-type-label">מספרים (tnum)</span><span className="t-h2 t-tnum">₪59 · ₪79 · ₪99</span></div>
            <div className="ds-type-row"><span className="ds-type-label">עברית + English</span><span className="t-h2">סיפור עם AI ולב גדול</span></div>
          </div>
        </section>

        {/* ── Spacing ── */}
        <section className="ds-section" id="spacing">
          <h2>ריווח — סולם 8pt</h2>
          <p className="ds-section-note">
            4px הוא חריג-מיקרו יחיד. ריווח סקשן: <code>--section-pad-y</code> (clamp 56→88).
            קונטיינרים: 1440 (גריד רחב) · 1180 (סקשן רגיל) · 760 (טקסט).
          </p>
          {SPACE_TOKENS.map(([name, px]) => (
            <div key={name} className="ds-space-row">
              <span className="ds-space-label">{name} · {px}px</span>
              <div className="ds-space-bar" style={{ width: `var(${name})` }} />
            </div>
          ))}
        </section>

        {/* ── Radii + Shadows ── */}
        <section className="ds-section" id="surfaces">
          <h2>רדיוסים</h2>
          <div className="ds-row">
            {RADIUS_TOKENS.map((t) => (
              <div key={t} className="ds-radius-demo" style={{ borderRadius: `var(${t})` }}>{t.replace('--radius-', '')}</div>
            ))}
          </div>
          <h2 style={{ marginTop: 'var(--sp-lg)' }}>הצללות</h2>
          <div className="ds-row">
            {SHADOW_TOKENS.map((t) => (
              <div key={t} className="ds-shadow-demo" style={{ boxShadow: `var(${t})` }}>{t.replace('--shadow-', '')}</div>
            ))}
          </div>
        </section>

        {/* ── Buttons (production classes from main.css) ── */}
        <section className="ds-section" id="buttons">
          <h2>כפתורים — קלאסים אמיתיים</h2>
          <p className="ds-section-note">
            היררכיה: ראשי (מלא) · משני (מתאר) · שקט (בהיר). גובה 48px, מגע 44px+. פוקוס מקלדת גלוי על כולם.
          </p>
          <div className="ds-row">
            <a href="#buttons" className="btn-primary">ליצירת הספר</a>
            <a href="#buttons" className="btn-outline">לדוגמה מלאה</a>
            <a href="#buttons" className="btn-light">אולי אחר־כך</a>
            <button type="button" className="btn-primary" disabled style={{ background: 'var(--interactive-disabled-bg)', color: 'var(--interactive-disabled-ink)', boxShadow: 'none' }}>לא זמין</button>
          </div>
        </section>

        {/* ── Form controls (production wizard classes) ── */}
        <section className="ds-section" id="forms">
          <h2>טפסים — קלאסים של הוויזרד</h2>
          <p className="ds-section-note">
            שפה אחת לכל שדה: רקע לבן, מסגרת <code>--border</code>, פוקוס סגול, גובה <code>--control-h</code>.
          </p>
          <div className="ds-form-stage">
            <div className="form-group">
              <label className="form-label" htmlFor="ds-name">איך קוראים לו?</label>
              <input className="form-input" id="ds-name" type="text" placeholder="למשל: נועה" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ds-age">בן כמה הוא?</label>
              <div className="select-wrap">
                <select className="form-select" id="ds-age" defaultValue="5">
                  <option>3</option><option>4</option><option>5</option><option>6</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ds-teaxtarea">הקדשה אישית</label>
              <textarea className="wiz-textarea" id="ds-teaxtarea" rows={3} defaultValue="לנועה האהובה שלנו…" />
              <div className="char-count">21/300</div>
            </div>
            <div className="chips-wrap" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="chip">דמיון עשיר</button>
              <button type="button" className="chip selected">לב טוב</button>
              <button type="button" className="chip">אומץ מבפנים</button>
            </div>
          </div>
        </section>

        {/* ── Cards ── */}
        <section className="ds-section" id="cards">
          <h2>כרטיסים</h2>
          <p className="ds-section-note">
            כרטיס קטגוריה (קומפוננטת production) — כולל מצב נבחר אמיתי; כרטיס תוכן (why-card).
          </p>
          <div className="ds-card-stage">
            <div style={{ width: 224 }}>
              <CategoryChallengeCard
                slot={SAMPLE_SLOT}
                as="button"
                selected={selectedCard}
                onClick={() => setSelectedCard((v) => !v)}
              />
            </div>
            <article className="why-card" style={{ maxWidth: 280 }}>
              <h3 className="landing-card-title">מותאם באמת</h3>
              <p className="landing-card-body">השם, הפנים והאתגר של הילד שלכם — בתוך סיפור שנכתב בשבילו.</p>
            </article>
          </div>
        </section>

        {/* ── Progress + status (wizard classes) ── */}
        <section className="ds-section" id="feedback">
          <h2>התקדמות ומשוב</h2>
          <div className="ds-row" style={{ maxWidth: 380 }}>
            <div className="progress-pills" style={{ width: '100%' }}>
              <span className="pill done" /><span className="pill done" /><span className="pill active" />
              <span className="pill" /><span className="pill" /><span className="pill" /><span className="pill" />
            </div>
          </div>
          <div className="ds-row">
            <div className="photo-quality-alert photo-quality-alert--warning" style={{ maxWidth: 420 }}>
              <div className="photo-quality-alert-title">התמונה קצת חשוכה — אפשר להמשיך, אבל תמונה בהירה תיתן דמות מדויקת יותר.</div>
            </div>
          </div>
        </section>

        {/* ── Motion ── */}
        <section className="ds-section" id="motion">
          <h2>תנועה</h2>
          <p className="ds-section-note">
            עקומות ומשכים קבועים: מיקרו {motionValues['--dur-fast'] || '140ms'} · קומפוננטה {motionValues['--dur-base'] || '200ms'} ·
            פאנל {motionValues['--dur-slow'] || '280ms'} · מעבר שלב {motionValues['--dur-page'] || '400ms'}.
            תמיד opacity/transform בלבד; <code>prefers-reduced-motion</code> מאפס הכול (מוגדר בטוקנים).
          </p>
          <div className="ds-row">
            <div className="ds-motion-box" title="hover" />
            <span className="t-caption">hover — translateY עם --ease-out / --dur-slow</span>
          </div>
        </section>

        {/* ── Docs ── */}
        <section className="ds-section ds-doc" id="docs">
          <h2>כללי שימוש</h2>
          <h3>שמות טוקנים</h3>
          <p>
            סמנטיים תחילה: <code>--interactive</code>, <code>--ink-2</code>, <code>--surface-alt</code>.
            כינויי legacy (<code>--purple</code>, <code>--fd</code>…) קיימים רק לתאימות — לא לשימוש חדש.
          </p>
          <h3>טיפוגרפיה</h3>
          <p>
            כותרות אמיתיות בלבד ב־Rubik (display/h1/h2/h3). כותרות כרטיסים וטקסט UI — Heebo.
            מחירים ומונים: להוסיף <code>.t-tnum</code>.
          </p>
          <h3>ריווח</h3>
          <p>
            רק ערכי הסולם. יוצא-דופן אופטי (מסגרת 1.5px, תיקון -2px) מותר — בלי להמציא ערכי ריווח חדשים.
          </p>
          <h3>RTL</h3>
          <ul>
            <li>תמיד מאפיינים לוגיים: <code>margin-inline-start</code>, <code>padding-block</code>, <code>text-align: start</code>.</li>
            <li>חץ "המשך" מצביע שמאלה; "חזרה" ימינה. סדר כפתורים: המשך בצד שמאל של חזרה.</li>
            <li>מספרים ומחירים נשארים LTR בתוך שורה עברית (<code>direction:ltr; unicode-bidi:embed</code> בעת הצורך).</li>
            <li>תערובת עברית-English: לא לפצל מילים; לבדוק ב־390px.</li>
          </ul>
          <h3>חריגים מתועדים</h3>
          <ul>
            <li>הרדיוס 17px בראש כרטיס הקטגוריה = 18px פחות מסגרת 1px (אופטי).</li>
            <li>גריד הקטגוריות שומר רוחב 1344px כדי שהכרטיסים בבית וב־/start יהיו זהים.</li>
            <li>הריידר (<code>/book/[id]/read-v2</code>) מחוץ למערכת — משטח בהקפאה (Decision Gate).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
