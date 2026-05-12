# Phase 12 — Critical Bug Fixes (Pre-Launch Polish)

## Context

Live QA tour of `smallheroes.co.il` revealed 6 critical bugs that block conversion or make the product feel unfinished. None are architectural — all are targeted fixes in CSS, JS, and content. **No backend changes. No pipeline changes. No new features.**

Goal: ship-ready landing + wizard summary by end of this phase.

---

## What to Change

### Bug 1 — Pricing numbers render as Hebrew letters on the landing page

**Symptom:** On the landing pricing cards (`#pricing` section), the prices `99`, `79`, `59` render in a glyph that looks like Hebrew letters (`פפ`, `פק`, `פש`). Parents cannot read the prices. **This is a buying-stopper.**

**Root cause:** `landing.css` line 879 sets `.price-num { font-family: var(--fd); }`. `--fd` is defined in `main.css` line 28 as `'Abraham', 'Heebo', sans-serif`. Abraham is a Hebrew-only display font; its digit glyphs render incorrectly at the 62px / weight-900 size used here.

**Note:** Inside the wizard summary screen (`price-row .val`), prices render correctly because that path doesn't use `--fd`. The bug is **only** on the landing.

**Fix — `public/CSS/landing.css`:**

Find the existing block at line ~887:

```css
.price-num span {
  font-size: 62px;
  font-weight: 900;
  line-height: 0.95;
}
```

Replace with:

```css
.price-num span {
  font-family: 'Heebo', sans-serif; /* override --fd — Abraham digits render incorrectly */
  font-size: 62px;
  font-weight: 900;
  line-height: 0.95;
  font-feature-settings: "tnum"; /* tabular numerals for clean alignment */
}
```

Also update the mobile breakpoint at line ~1383:

```css
.price-num span {
  font-family: 'Heebo', sans-serif;
  font-size: 52px;
  font-feature-settings: "tnum";
}
```

Leave the ₪ shekel symbol on `.price-num` itself using `--fd` (it renders fine in Abraham).

---

### Bug 2 — Stray `▼` arrow floats outside its container on Wizard Step 5

**Symptom:** On the "child details" step (step 5 of wizard), a small `▼` arrow appears at roughly `left: 18px, top: ~50%` of the page, completely detached from any dropdown. Looks like a broken UI element.

**Root cause:** `public/CSS/wizard.css` line 483 — `.select-wrap::after` is `position: absolute` with `left: 18px; top: 50%`, but `.select-wrap` itself has no `position: relative` rule. The arrow escapes to the nearest positioned ancestor.

**Fix — `public/CSS/wizard.css`:**

Find:

```css
.select-wrap::after {
  content: '▼';
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: #111;
  pointer-events: none;
}
```

**Add a new rule immediately ABOVE it:**

```css
.select-wrap {
  position: relative;
  display: block;
}

.select-wrap::after {
  content: '▼';
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: #111;
  pointer-events: none;
}
```

**Verify** the same fix is not needed in `landing.css` — the `.footer .select-wrap` styling at line 1072 already handles its scope.

---

### Bug 3 — Missing total in Wizard summary (Step 13)

**Symptom:** The middle column on the summary screen (`#price-breakdown`) shows individual line items (`ספר דיגיטלי 79₪`, `קריינות 19₪`) but **no total line**. Parent must mentally add. Bad UX right before payment.

**Root cause:** `public/JS/wizard.js` `buildSummary()` (line 2317 onwards) populates `#price-breakdown` with rows only — never appends a total row.

**Fix — `public/JS/wizard.js`:**

In `buildSummary()` at line ~2363, BEFORE `priceEl.innerHTML = rows;`, append a total row:

```javascript
    rows += `
      <div class="price-row price-row--total">
        <span class="label">${WIZ.summary.totalLabel || 'סה"כ לתשלום:'}</span>
        <span class="val">₪${total}</span>
      </div>
    `;

    priceEl.innerHTML = rows;
```

Note: `total` is already computed at line 2232 via `const { base, total } = computeTotal();` — use it directly.

**Add CSS — `public/CSS/wizard.css`:**

Append at the end of the file:

```css
.price-row--total {
  border-top: 1px solid #e1dcea;
  margin-top: 8px;
  padding-top: 12px;
  font-weight: 700;
  font-size: 17px;
}

.price-row--total .val {
  color: var(--accent, #7c5ce0);
  font-weight: 900;
}
```

---

### Bug 4 — Summary omits half the data the parent entered

**Symptom:** Summary shows: book name, child name+age, topic, package, style, voice, sleep mode. **Does NOT show:** chosen superpower (כוחות), difficulties (מה קשה), goals (מה רוצים), helpers (מה עוזר), avoid (להימנע). Parent answered ~10 emotional questions; summary feels like only basic data was captured.

**Root cause:** `buildSummary()` in `wizard.js` (line 2261) constructs `rows` array with only direct fields, not the emotional answer arrays.

**Fix — `public/JS/wizard.js`:**

In `buildSummary()`, AFTER the existing `rows` array assignment (line ~2295, right after `.filter(Boolean);`), build a "what we captured" block from the state arrays. The state fields exist — verified in `buildWizardPayload()`:

- `state.superpowers` (array of trait IDs)
- `state.difficulties` (array of difficulty IDs)
- `state.goals` (array of goal IDs)
- `state.helpers` (array of helper IDs)
- `state.avoid` (array of avoid IDs)

Map IDs → Hebrew labels using the existing lookup arrays already in `content.js` (`WIZ.superpowers`, `WIZ.difficulties`, `WIZ.goals`, `WIZ.helpers`, `WIZ.avoid`).

Add immediately AFTER the rows assignment, BEFORE `const answeredFollowups`:

```javascript
    // ── Emotional context capture (helpers/difficulties/etc) ─────
    const idsToLabels = (ids, lookup) => {
      if (!Array.isArray(ids) || ids.length === 0) return null;
      const labels = ids
        .map((id) => {
          const item = lookup.find((x) => x.id === id);
          if (!item) return null;
          // Strip leading emoji from label for cleaner summary display
          return item.label.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\s]+/u, '').trim();
        })
        .filter(Boolean);
      return labels.length > 0 ? labels.join(', ') : null;
    };

    const emotionalRows = [
      idsToLabels(state.superpowers, WIZ.superpowers || [])
        ? { icon: '💪', label: 'כוחות:', val: idsToLabels(state.superpowers, WIZ.superpowers) }
        : null,
      idsToLabels(state.difficulties, WIZ.difficulties || [])
        ? { icon: '🌊', label: 'מה קצת קשה:', val: idsToLabels(state.difficulties, WIZ.difficulties) }
        : null,
      idsToLabels(state.goals, WIZ.goals || [])
        ? { icon: '🌟', label: 'לאן נוביל:', val: idsToLabels(state.goals, WIZ.goals) }
        : null,
      idsToLabels(state.helpers, WIZ.helpers || [])
        ? { icon: '🤍', label: 'מה עוזר:', val: idsToLabels(state.helpers, WIZ.helpers) }
        : null,
      idsToLabels(state.avoid, WIZ.avoid || [])
        ? { icon: '🚫', label: 'להשאיר בחוץ:', val: idsToLabels(state.avoid, WIZ.avoid) }
        : null,
    ].filter(Boolean);
```

Then change the existing line:

```javascript
const extraDetails = `<div class="summary-followup-count">עניתם על ${answeredFollowups.length} שאלות השלמה</div>`;
```

**Replace with:**

```javascript
const emotionalHtml = emotionalRows.map((r) => `
  <div class="summary-row summary-row--soft">
    <span class="summary-icon">${r.icon}</span>
    <span class="summary-label">${r.label}</span>
    <span class="summary-val">${r.val}</span>
  </div>
`).join('');

// Keep the followup count only if there's value beyond what we just showed
const followupHint = answeredFollowups.length > 0
  ? `<div class="summary-followup-count">+ ${answeredFollowups.length} שאלות השלמה</div>`
  : '';

const extraDetails = emotionalHtml + followupHint;
```

**Add CSS — `public/CSS/wizard.css`:**

```css
.summary-row--soft {
  opacity: 0.85;
  font-size: 13px;
  padding: 4px 0;
}

.summary-row--soft .summary-val {
  font-weight: 400;
  color: #4a4358;
}
```

**Result:** Parent sees a complete picture of what we captured, in a soft secondary visual tier so it doesn't compete with the primary order details.

---

### Bug 5 — Misleading copy "based on the photo" when no photo was uploaded

**Symptom:** Summary footer shows "הספר כולל סיפור אישי ודמות מאוירת בהשראת התמונה" — even when parent skipped photo upload.

**Root cause:** `content.js` line 289 — hardcoded string. `wizard.js` line 912 sets it unconditionally via `setText('s9PaymentLogos', WIZ.steps.s9.paymentLogos);`.

**Fix Part A — `public/JS/content.js`:**

Add a new content key. In `WIZ.steps.s9` block (around line 289), keep the existing `paymentLogos` and add a no-photo variant:

```javascript
        s9: {
          title:       'כמעט מתחילים ליצור את הסיפור',
          sub:         'ניצור עבורו סיפור אישי בעברית עם דמות מאוירת שמבוססת עליו',
          card1Title:  'מה יהיה בספר',
          card2Title:  'סה"כ לתשלום',
          card3Title:  'לאן לשלוח?',
          nameLabel:   'שם מלא',
          emailLabel:  'אימייל',
          submitBtn:   'המשך לתשלום מאובטח',
          paymentLogos:        'הספר כולל סיפור אישי ודמות מאוירת בהשראת התמונה',
          paymentLogosNoPhoto: 'הספר כולל סיפור אישי ודמות מאוירת שתיווצר עבורו במיוחד',
        },
```

**Fix Part B — `public/JS/wizard.js`:**

Find line ~912:

```javascript
setText('s9PaymentLogos', WIZ.steps.s9.paymentLogos);
```

This is in a global setText pass. Move the dynamic decision into `buildSummary()` instead. Inside `buildSummary()`, at the very end (after the `priceEl.innerHTML = rows;` line at ~2363), add:

```javascript
  // ── Dynamic footer line based on whether photo was uploaded ─────
  const paymentLogosEl = document.getElementById('s9PaymentLogos');
  if (paymentLogosEl) {
    paymentLogosEl.textContent = state.photo
      ? WIZ.steps.s9.paymentLogos
      : (WIZ.steps.s9.paymentLogosNoPhoto || WIZ.steps.s9.paymentLogos);
  }
```

The original `setText` at line 912 can stay — it sets a default; `buildSummary` will override based on photo presence each time the user lands on step 13.

---

### Bug 6 — Confusing badge "הושלם במתנה" on PDF addon (₪19)

**Symptom:** On Step 11 (Package & Style), the PDF addon shows the badge "הושלם במתנה" (Included as a gift) but ALSO shows price `+₪19`. Parents see contradiction: is it free or not?

**Root cause:** `content.js` line 271:

```javascript
pdf:    { badge: 'מושלם כמתנה',  name: 'קובץ מוכן להדפסה (+₪19)', desc: 'קובץ מעוצב להדפסה' },
```

The badge says "מושלם כמתנה" ("Perfect as a gift" — positioning copy, not "Included as a gift"). My eye misread it on the live site as "הושלם במתנה" because of cursor obscuring a letter. **Reread on site to confirm:** if it actually says "מושלם כמתנה" — no bug, leave it alone. If anywhere it says "הושלם" — change to "מושלם".

**Action:** Verify exact text in the live render. No code change unless wording is actually wrong.

---

## What NOT to Change

- Do **NOT** touch the backend pipeline, story generation, image generation, or any `/api/` routes.
- Do **NOT** add new wizard steps or remove existing ones (wizard structure is locked per CTO decision).
- Do **NOT** change the order of summary fields beyond what's specified above (the existing order is parent-tested).
- Do **NOT** restyle existing summary rows — only add the new `--soft` tier below them.
- Do **NOT** import any new fonts; the `Heebo` font is already loaded via Google Fonts in `index.html`.

---

## Testing Checklist

After implementing all fixes, manually verify:

**Bug 1 — Prices:**
- [ ] Open `https://smallheroes.co.il/` (login with QA password).
- [ ] Scroll to pricing section.
- [ ] Confirm `59`, `79`, `99` render as clear, readable digits.
- [ ] Resize browser to 600px width → confirm mobile prices (`52px size`) also render correctly.

**Bug 2 — Stray arrow:**
- [ ] Start wizard → reach Step 5 (child details).
- [ ] Confirm no floating `▼` appears anywhere outside the age/gender dropdowns.
- [ ] Confirm the `▼` IS visible inside both the age and gender dropdowns.

**Bug 3 — Total line:**
- [ ] Complete wizard to summary (step 13).
- [ ] Try with: (a) bedtime no addons (₪59 only), (b) adventure + audio (₪79 + ₪19 = ₪98), (c) fantasy + bundle (₪99 + ₪39 = ₪138).
- [ ] Confirm total line appears at the bottom of the middle column with the correct sum.
- [ ] Confirm the total is visually emphasized (heavier weight, accent color, top border).

**Bug 4 — Emotional summary rows:**
- [ ] On summary screen, confirm new rows appear for: כוחות, מה קצת קשה, לאן נוביל, מה עוזר, להשאיר בחוץ.
- [ ] Confirm Hebrew labels are rendered without leading emoji (cleaner look in summary).
- [ ] Skip the optional fields in the wizard → confirm those rows do NOT appear in summary (only filled ones show).
- [ ] Confirm visual hierarchy: primary fields (name, topic, package) are bolder; emotional rows are lighter/smaller.

**Bug 5 — Photo conditional copy:**
- [ ] Complete wizard WITHOUT uploading photo → on summary, footer reads "הספר כולל סיפור אישי ודמות מאוירת שתיווצר עבורו במיוחד".
- [ ] Restart wizard, this time UPLOAD a photo → footer reads original "...בהשראת התמונה".

**Bug 6:**
- [ ] Visit Step 11 → confirm PDF addon badge says "מושלם כמתנה" (not "הושלם"). If text differs from expectation, report back.

**Regression check:**
- [ ] All other wizard steps still work end-to-end.
- [ ] Submit a test order through to payment screen (use fake payment in dev).
- [ ] Confirm no console errors in DevTools.

---

## Commit Plan

Use one targeted commit per bug. Example messages:

```
fix(landing): use Heebo for pricing digits (Abraham renders digits wrong)
fix(wizard): add position:relative to .select-wrap to anchor dropdown arrow
feat(wizard/summary): add total line to price breakdown
feat(wizard/summary): show emotional context rows (powers/difficulties/goals/helpers/avoid)
fix(wizard/summary): conditional photo-inspired copy based on upload presence
```

If Bug 6 is real, add:
```
fix(wizard/copy): correct PDF addon badge wording
```

---

## Files Touched (Summary)

| File | Bugs |
|------|------|
| `public/CSS/landing.css` | 1 |
| `public/CSS/wizard.css` | 2, 3 (CSS), 4 (CSS) |
| `public/JS/wizard.js` | 3, 4, 5 |
| `public/JS/content.js` | 5, possibly 6 |

**No backend files. No Prisma schema. No pipeline code.**

---

## Out of Scope (Coming in Phase 13)

The following items from the homepage review are intentionally **NOT** in this phase:

- Wizard step 11 split (Package vs Addons) — Phase 13
- Step 6 + Step 8 copy rewrites — Phase 13
- Step 7 vs Step 3 redundancy decision — needs CTO product call
- Topic chip emojis (Step 2) — Phase 13
- Landing: "About the founder" block — Phase 13
- Landing: testimonials section — Phase 13
- Landing: gallery shows page-with-text screenshots — Phase 13 (needs new asset gen)

This phase is **bug fixes only.** Ship it clean before we touch anything else.
