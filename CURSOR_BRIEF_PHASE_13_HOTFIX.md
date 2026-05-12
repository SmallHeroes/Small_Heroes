# Phase 13 Hotfix — Step 11 Layout + Medical Chips

## Context

Three independent fixes bundled together:

1. **Step 11a/11b centering** — after Phase 13's split, the visible card sits on the right with a large empty left half. The parent `.s8-grid` is a fixed 2-column grid even when one column has no content.
2. **Style grid** — 2 illustration styles render in a 3-column grid (designed for the dropped Style 03), leaving a 33% empty slot.
3. **Medical category chips** — `MEDICAL_PROCEDURE` is the ONLY category missing from `CATEGORY_FOLLOWUP_POOLS`, so it falls back to generic chips ("חיבוק", "דיבור רגוע") that don't match the medical questions.

Fixes 1 and 2 are CSS-only (with a tiny JS class toggle). Fix 3 is one block of data added to `lib/categoryBranching.ts`. No HTML changes anywhere. No backend.

---

## Fix 1 — Center the active sub-step's content (Step 11a + 11b)

### Symptom
On the wizard, sub-steps 11a and 11b each show only ONE block of content (structure on 11a, upgrades on 11b), but the surrounding `.s8-grid` is still a 2-column grid. The visible card sits on the right; left half is empty whitespace.

### Root cause
`public/CSS/wizard.css` line 801:
```css
.s8-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;  /* fixed 2 cols */
  gap: 22px;
}
```

### Fix
Add a new modifier class for sub-step mode. Append to `public/CSS/wizard.css` (immediately after the existing `.s8-grid.s8-three-col` block, ~line 810):

```css
/* Sub-step layout — only one card visible, center it */
.s8-grid.s8-single-col {
  grid-template-columns: minmax(0, 720px);
  justify-content: center;
  max-width: 100%;
}

/* On mobile, just collapse to natural flow */
@media (max-width: 640px) {
  .s8-grid.s8-single-col {
    grid-template-columns: 1fr;
  }
}
```

### Apply the class from JS

In `public/JS/wizard.js`, find where the `.s8-grid` element is rendered/toggled (search for `s8-grid` and `packageSubStep`). When entering Step 11 rendering, add the class `s8-single-col` to the grid element. Remove the old `s8-three-col` modifier in sub-step mode.

Cheapest implementation — toggle the class based on `state.packageSubStep` AND `state.currentStep === 11`:

```javascript
function applyStep11SubLayout() {
  const grid = document.querySelector('#step-11 .s8-grid');
  if (!grid) return;
  if (state.currentStep === 11) {
    grid.classList.add('s8-single-col');
    grid.classList.remove('s8-three-col');
  } else {
    grid.classList.remove('s8-single-col');
  }
}
```

Call `applyStep11SubLayout()` from inside the existing Step 11 render path (wherever 11a/11b toggle happens — Cursor knows from Phase 13 implementation).

**Important:** This must apply in BOTH `packageSubStep: false` (11a) and `true` (11b). Both show one card. The class stays on Step 11 regardless of sub-step state.

---

## Fix 2 — Style grid: 2 cards should fill the width

### Symptom
On Step 11a, the "סגנון האיורים" section shows 2 cards (אקוורל ריאליסטי, מאויר חם ועדין). They're rendered in a 3-column grid (designed for Style 03), so 33% of the width is empty.

### Root cause
`public/CSS/wizard.css` line 876:
```css
.style-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
```

### Fix
Change to `auto-fit` so the grid adapts to the number of children. Replace lines 876-880:

```css
.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
```

This makes 2 styles spread to fill the available width. If a 3rd style is ever added, it'll auto-fit. Future-proof.

**Also check** the mobile breakpoint at line 882 — keep `grid-template-columns: 1fr` for ≤980px, which is still good (single column on small screens).

**Also check** line 1528 (another `.style-grid` rule, possibly under a different media query or scope) and line 1653 and 1965 — verify they don't override this in a way that brings back the 3-col behavior. If they do, apply the same `auto-fit` pattern.

---

## Fix 3 — Medical category: add proper followup chips

### Symptom
On Step 3 (Category Followup) for topic "טיפולים רפואיים", the 3 sub-questions show chips that don't match the questions:

| Question | Wrong chips being shown |
|----------|-------------------------|
| "באיזה סוג טיפול מדובר?" | Only "אחר" + "לא תמיד ברור" |
| "הטיפול עוד לפניכם או שכבר עבר/ה?" | "נסגר" / "מתפרץ או בוכה" (behavioral, not timing) |
| "מה הכי מפחיד — הכאב, הזרים, חוסר השליטה?" | "חיבוק" / "דיבור רגוע" (soothing strategies, not fears) |

### Root cause
`lib/categoryBranching.ts` defines `CATEGORY_FOLLOWUP_POOLS` (line 135). All 10 other categories have entries. **MEDICAL_PROCEDURE is the only category without an entry**, so it falls back to `defaultPool` (line 1229) which uses generic hardcoded chips.

### Fix
Add a `MEDICAL_PROCEDURE` entry inside `CATEGORY_FOLLOWUP_POOLS`. Insert immediately after the existing `FOCUS_LEARNING` block (around line 336, BEFORE the `OTHER` block):

```typescript
  MEDICAL_PROCEDURE: [
    {
      id: 'medical_treatment',
      question: 'באיזה סוג טיפול מדובר?',
      quickAnswers: [
        '💉 זריקה או חיסון',
        '🦴 שבר, גבס או תפרים',
        '🦷 טיפול שיניים',
        '🏥 ניתוח או אשפוז',
        '💊 תרופה ארוכה / מחלה ממושכת',
        '✏️ אחר',
      ],
      priority: 100,
    },
    {
      id: 'medical_timing',
      question: 'הטיפול עוד לפניכם, או שהילד/ה כבר עבר/ה את זה ומעבד/ת?',
      quickAnswers: [
        '📅 לפני הטיפול',
        '⏱️ ממש בקרוב (יום-יומיים)',
        '🌀 באמצע תהליך ממושך',
        '🌿 חזרנו הביתה היום',
        '📖 עבר מזמן, עדיין מהדהד',
        '✏️ אחר',
      ],
      priority: 90,
    },
    {
      id: 'medical_fear',
      question: 'מה הכי מפחיד — הכאב, הזרים, חוסר השליטה, או משהו אחר?',
      quickAnswers: [
        '😖 הכאב עצמו',
        '🧑‍⚕️ הרופאים והאנשים הזרים',
        '🎯 חוסר שליטה — שעושים לו/ה',
        '🌫️ לא לדעת מה יקרה',
        '🏠 הריחוק מהבית והמוכר',
        '✏️ אחר',
      ],
      priority: 80,
    },
  ],
```

### Verify
After this change:
- Step 3 for "טיפולים רפואיים" shows the 3 correctly-matched chip rows above.
- The other 10 categories are unchanged (they have their own pool entries — no regression).
- The questions text rendered should match the `question` field, not the original `followUpQuestions` array (the pool takes precedence per the existing logic at line 1240).

---

## What NOT to Change

- Do NOT modify the JS logic of `packageSubStep` — it works correctly. Only the visual presentation.
- Do NOT add additional steps or modify the step counter.
- Do NOT touch backend or pipeline files.
- Do NOT modify the `.s8-card` padding or borders — they're correct.

---

## Testing Checklist

After implementing:

**Fix 1 (centering):**
- [ ] Open wizard → reach Step 11a (structure + style). The card is horizontally centered, NOT right-aligned.
- [ ] Click "ממשיכים" to advance to Step 11b (upgrades). The upgrades card is centered, NOT right-aligned.
- [ ] Click "חזור" — back to 11a, still centered.
- [ ] On mobile (≤640px), the card uses full width without left/right gutters.

**Fix 2 (style grid):**
- [ ] On Step 11a, the 2 style cards (אקוורל ריאליסטי, מאויר חם ועדין) span the full row width with equal sizes.
- [ ] No empty 3rd slot visible.
- [ ] On mobile (≤980px), the styles stack vertically (1 column).

**Fix 3 (medical chips):**
- [ ] Start wizard, Step 2 → select "🩹 טיפולים רפואיים".
- [ ] Step 3 shows 3 sub-questions with the new chips (6 chips each).
- [ ] No chip says "חיבוק" or "דיבור רגוע" (the old generic fallback).
- [ ] Select chips, advance, return back → state preserved.

**Regression:**
- [ ] No visual regression on other wizard steps.
- [ ] Direction selector (סוג הסיפור והיקף) still shows 3 options in a row.
- [ ] Total price still correct.
- [ ] Other 10 categories' followup chips remain unchanged (sanity-check on at least 2 — NIGHT_FEAR + NEW_SIBLING).

---

## Commit Plan

Three commits:

```
fix(wizard/step11): center single-column sub-step content
fix(wizard/styles): use auto-fit grid so 2 styles fill the row
feat(wizard/medical): add chip pool for MEDICAL_PROCEDURE category followups
```

After ALL commits — **`git push origin main`** — confirm `origin/main` HEAD matches local before reporting done. Vercel deploy ~2 min.

---

## Files Touched

| File | Changes |
|------|---------|
| `public/CSS/wizard.css` | Add `.s8-grid.s8-single-col` rule + change `.style-grid` to auto-fit |
| `public/JS/wizard.js` | Add `applyStep11SubLayout()` helper + call in Step 11 render path |
| `lib/categoryBranching.ts` | Add `MEDICAL_PROCEDURE` entry to `CATEGORY_FOLLOWUP_POOLS` |

**No backend. No HTML. No content.js.**
