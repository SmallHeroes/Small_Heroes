# Small Heroes — בריף מעבר לשיחה חדשה (Handoff Brief)

> הדבק את הקובץ הזה (או את תוכנו) בתחילת שיחה חדשה כדי שאמשיך כ-CTO/Product Lead מאותה נקודה.
> תאריך: 2026-06-14 · נכתב כי המודל הקודם לא זמין.

---

## מי אתה ומה התפקיד שלי
אתה **Guy** — product owner ומאשר סופי. אני **Claude = CTO / מתכנן מימוש / קורא קוד / מבצע טכני**.
פרוטוקול עבודה: **Claude מציע → ChatGPT מאתגר → Guy מאשר → Cursor מבצע.**
לפני כל שינוי לא-טריוויאלי: למלא Decision Gate ולעבור stop-check (`docs/ai-workflow/`).

## מה המוצר
**Small Heroes** — מערכת שמייצרת ספרי ילדים מותאמים אישית (עברית). זרימה: wizard → story + storyboard + illustrations (gpt-image-2 / Flux) → reader → בעתיד מוצר מודפס/נמכר.
מטרה: מוצר ספר ילדים אמיתי ומכיר — איכות רגשית גבוהה, עקביות ויזואלית, תחושת ספר מודפס, UX פשוט.

## איפה הפרויקט עומד עכשיו (Live State)

**יעד קרוב — Soft Launch:** 2026-07-01 (F&F · דיגיטלי · נרציה · autonomous עם ship-gate). הבקאנד קיים; **הפער הוא הפרונט הצרכני** (wizard / checkout / my-books).

**Sprint 11 — RESUME HERE:**
- Slot #1 רונדר ונבדק בעין, **אבל אין matrix flip** — חוסם: **location-continuity** (למקום אין נעילה).
- הצעד הבא: לכתוב brief ל"STORY LOCATION LOCK" (מנגנון כללי לקיבוע מקום/setting של הספר) + rerolls ממוקדים ל-p5/p10/cover. אחר כך S3 Codex לפני slot #2.

**Golden Books:** 10/10 הושלמו (fox/עֲנָת/dini/fawn/koko/dolphin/lion/whale/bolly/bunny).
**שלב הבא אחרי הגולדנים:** מנגנון anti-template.

**Anti-Template — חוסם P0:** chip-layer הוא FAIL-OPEN (פולט עברית שבורה כמו מחייךת/מניח{יד|ה} וה-validator אומר PASS). צריך brief של **chip-normalizer FAIL-CLOSED** (של ChatGPT) → לשלוח ל-Cursor אם לא נשלח. **HOLD** על Taste Judge + scale עד שה-fail-closed סגור. לקרוא ארטיפקטים מלאים לפני כל PASS.

**Style 02 Lock Contract — APPROVED-DIRECTION (2026-06-13):** Style02 = נתיב half-locked נפרד. תיקון = `BookImageLockContext` משותף + renderer משלו (לא לפורט את Style01). brief @ `outputs/cursor-brief-style02-lock-contract.md` — ממתין ל-Guy→Cursor.

## עקרונות הנדסה (לא לשבור)
- **לתקן מערכות כלליות, לא טלאים ספציפיים לסיפור/ילד/חבר.** אם תיקון עוזר רק לסיפור אחד — הוא שגוי.
- לאמת עם ההרצה הקטנה ביותר (page-only). שער דמיון לעמוד = **0.70**, לא לשנות בלי אישור.
- מודעות עלות: gpt-image-2 **LOW** לאודישנים, **HIGH** רק לפרודקשן. (footgun: ברירת המחדל היא HIGH — להגדיר LOW לפני רנדר!)
- **לא להריץ רנדר ספר מלא בלי אישור מפורש.** ברירת מחדל = דגימת 5 עמודים / page-only.

## מוקשים בריפו (Repo Landmines)
- **EOL/CRLF churn:** `git status` מראה ~800 קבצים "modified" שזה רק line-endings. **לעשות stage רק עם pathspecs מפורשים — לעולם לא `git add -A`.**
- **`docs/` הוא gitignored:** קבצים חדשים תחת `docs/` צריכים `git add -f`.
- **תמיד `npm run check` לפני commit** (`tsc --noEmit` + `vitest run`) — tsx לא בודק טייפים.
- סקריפטים עצמאיים מייבאים `server-only` → להריץ עם `--require ./scripts/shims/register-server-only.cjs`.
- **אני (Claude) לא יכול לעשות commit** (אין הרשאת כתיבה ל-.git) — תמיד אסיים עם פקודת commit מוכנה להעתקה.

## Production Golden Path (הנתיב היחיד להזמנות לקוח)
`wizard MVP matrix` → `POST /api/orders` (`resolveStoryProductTruth` + matrix assert) → `chunked generation` (`lib/generation-pipeline/chunk-runner.ts`) → `story-bank-loader` (`v3-approved` + `v5-fixed-v2`) → image/style gates.
**לא פרודקשן (dev-only):** `lib/story-generator/*`, `lib/story-gen-v2/*`, `lib/story-gen-v3/*`, `app/api/debug/*`.

## כיוון אסטרטגי (סדר עדיפויות)
1. תקינות pipeline (data flow → prompts → images)
2. שדרוג reader ל-layout ספר אמיתי (טקסט על תמונה, full-bleed)
3. שיפור איכות תמונה (LoRA, עקביות סגנון)
4. חיזוק UX מוצרי (wizard, direction cards, flow)

## כללי עבודה איתי (Workflow)
- לסיים הודעות עם **פקודה מוכנה להעתקה**; פקודות commit פרואקטיביות באבני-דרך ירוקות.
- תמיד להציג תמונות מרונדרות inline/links.
- אתה מסנכרן תוצאות QA עם ChatGPT לפני שאני כותב brief ל-Cursor — לעצור ולתת ל-consult לקרות.
- **brief אחד שלם** ל-Cursor — אף פעם לא "תוספות" חלקיות; לאחד את הניתוח שלי + ביקורת ChatGPT ל-brief סופי מוכן-להדבקה.
- לחשוב בפאזות (3a/3b/3c), תוכניות ברורות מעל קוד גולמי, להסביר tradeoffs, ולומר "לא בטוח" במפורש כשזה המצב.

---

### השורה התחתונה לשיחה החדשה
**להתחיל מ-Sprint 11:** לכתוב brief ל-STORY LOCATION LOCK (מנגנון כללי) + rerolls p5/p10/cover, ולסגור את chip-normalizer FAIL-CLOSED (P0) לפני scale. ה-soft launch הוא 2026-07-01 והפער הוא הפרונט הצרכני.
