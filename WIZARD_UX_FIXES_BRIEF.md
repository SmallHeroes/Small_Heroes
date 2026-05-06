# Wizard UX Fixes Brief

Two targeted fixes for the wizard flow. Both are CSS/JS only — no backend changes.

---

## Fix 1: Remove price from bottom bar on early steps

**Problem:** The "סה"כ: ₪49" total shows on step 3 (and possibly other early steps). It should ONLY appear on step 12 (package selection) and step 13 (summary).

**File:** `public/JS/wizard.js`

**Current code (line ~862-866):**
```js
const bottomBarTotal = document.getElementById('bottom-bar-total');
if (bottomBarTotal) {
  const hasLength = Boolean(state.length);
  bottomBarTotal.hidden = !(hasLength && (state.currentStep === 12 || state.currentStep === 13));
}
```

**Issue:** The logic looks correct, but `state.length` may be persisted from a previous session in localStorage. When a user returns and starts a new wizard flow, `state.length` is already truthy from last time. The `hidden` check passes because `hasLength` is true even on step 3.

**Fix — two parts:**

### Part A: Force-hide on all steps before 12
Replace the condition on line 865 with a stricter check:
```js
bottomBarTotal.hidden = !(state.currentStep >= 12 && Boolean(state.length));
```
This ensures price NEVER appears before step 12, regardless of localStorage state.

### Part B: Reset length on wizard init (defensive)
In the `initWizard()` function (around line ~580), after `loadStateFromStorage()` or equivalent, if `state.currentStep < 12`, clear the cached length:
```js
if (state.currentStep < 12) {
  // Don't carry stale package selection into a new wizard flow
  state.length = null;
}
```

---

## Fix 2: Redesign extra character card layout

**Problem:** The current character card has:
- Image placeholder taking too much width on the right (RTL)
- Fields (relation dropdown + name input) on the left, too wide
- Layout feels unbalanced

**Goal:** Compact horizontal layout:
- Image is a **square** on the **LEFT side** (in LTR terms; since RTL, it will appear on the visual left)
- Square height = height of the two fields stacked (relation + name)
- The "+" icon goes **inside** the square
- Fields sit next to the square, narrower
- After selecting an image → show it in the square with "להחליף תמונה" overlay (same as hero photo)

### Files to change:

#### A. `public/CSS/wizard.css`

**Replace `.char-photo-row` (line ~1933):**
```css
.char-photo-row {
  display: flex;
  gap: 12px;
  align-items: stretch;
  direction: ltr; /* Force image-left, fields-right regardless of RTL */
}
```

**Replace `.char-photo-preview` (line ~1966):**
```css
.char-photo-preview {
  width: 100px;
  height: 100px;
  border: 1px dashed #d5cdee;
  background: #f6f4fb;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: border-color .2s ease, background .2s ease;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
```

**Remove `max-width: 160px` from `.char-photo-preview`** — we're using fixed 100×100 now.

**Replace `.char-photo-row-fields` (line ~1939):**
```css
.char-photo-row-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  direction: rtl; /* Restore RTL for the text fields */
  justify-content: center;
}
```

**Add new rule — replace overlay for existing photo:**
```css
.char-photo-preview.has-image .char-photo-replace-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  padding: 4px 0;
  cursor: pointer;
  border-radius: 0 0 13px 13px;
}
```

**Update mobile breakpoint (line ~1946):**
```css
@media (max-width: 480px) {
  .char-photo-row {
    /* Keep horizontal on mobile too — square is small enough */
  }
  .char-photo-preview {
    width: 80px;
    height: 80px;
  }
}
```

#### B. `public/JS/wizard.js` — `renderExtraCharacters()` (line ~1270)

Replace the `char-photo-row` HTML inside the template literal:

**Current (lines 1275-1293):**
```html
<div class="char-photo-row">
  <label class="char-photo-upload">
    <input class="char-photo-input" type="file" accept="image/jpeg,image/png,image/webp" />
    <div class="char-photo-preview ${hasPhoto ? 'has-image' : ''}">
      ${hasPhoto
        ? `<img src="${character.photo}" alt="תמונת דמות ${index + 1}" />`
        : `<span class="char-photo-plus">+</span><span class="char-photo-label">תמונה</span>`}
    </div>
  </label>
  <div class="char-photo-row-fields">
    <div class="char-input-group">
      <label class="char-field-label">מה הקשר לילד/ה?</label>
      <select class="form-select char-relation-select">${relationOptions}</select>
    </div>
    <div class="char-input-group">
      <label class="char-field-label">איך קוראים לדמות?</label>
      <input class="form-input char-input" type="text" maxlength="30" placeholder="שם הדמות" value="${character.name}" />
    </div>
  </div>
</div>
```

**Replace with:**
```html
<div class="char-photo-row">
  <label class="char-photo-upload">
    <input class="char-photo-input" type="file" accept="image/jpeg,image/png,image/webp" />
    <div class="char-photo-preview ${hasPhoto ? 'has-image' : ''}">
      ${hasPhoto
        ? `<img src="${character.photo}" alt="תמונת דמות ${index + 1}" /><span class="char-photo-replace-overlay">החלף</span>`
        : `<span class="char-photo-plus">+</span>`}
    </div>
  </label>
  <div class="char-photo-row-fields">
    <div class="char-input-group">
      <label class="char-field-label">מה הקשר לילד/ה?</label>
      <select class="form-select char-relation-select">${relationOptions}</select>
    </div>
    <div class="char-input-group">
      <label class="char-field-label">איך קוראים לדמות?</label>
      <input class="form-input char-input" type="text" maxlength="30" placeholder="שם הדמות" value="${character.name}" />
    </div>
  </div>
</div>
```

Key changes in the template:
1. Removed `<span class="char-photo-label">תמונה</span>` — just show "+" in the square
2. When photo exists: added `<span class="char-photo-replace-overlay">החלף</span>` overlay
3. The photo preview after upload also needs the overlay — update the `reader.onload` callback (line ~1395-1397):

**Current:**
```js
preview.classList.add('has-image');
preview.innerHTML = `<img src="${result}" alt="תמונת דמות ${index + 1}" />`;
```

**Replace with:**
```js
preview.classList.add('has-image');
preview.innerHTML = `<img src="${result}" alt="תמונת דמות ${index + 1}" /><span class="char-photo-replace-overlay">החלף</span>`;
```

#### C. Move helper text and description below the photo row

The `char-photo-quality` helper text ("תמונה ברורה תעזור לנו...") and the description textarea ("משהו קטן שמאפיין אותה") stay as they are — below the photo row, full-width. No change needed there.

---

## Visual reference

### Before (current):
```
┌──────────────────────────────────────┐
│ דמות נוספת 1              [לא חובה] │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │           │  │ מה הקשר לילד/ה  │  │
│  │     +     │  ├──────────────────┤  │
│  │  תמונה    │  │ איך קוראים לדמות│  │
│  │  (wide)   │  └──────────────────┘  │
│  └──────────┘                         │
│  helper text...                       │
│  משהו קטן שמאפיין...                 │
└──────────────────────────────────────┘
```

### After (new):
```
┌──────────────────────────────────────┐
│ דמות נוספת 1              [לא חובה] │
│                                      │
│  ┌────────────────┐  ┌────────┐      │
│  │ מה הקשר לילד/ה │  │        │      │
│  ├────────────────┤  │   +    │      │
│  │ שם הדמות       │  │ 100×100│      │
│  └────────────────┘  └────────┘      │
│  helper text...                       │
│  משהו קטן שמאפיין...                 │
└──────────────────────────────────────┘
```

Note: In RTL context with `direction: ltr` on the row, the square appears on the LEFT visually, fields on the RIGHT. The fields themselves restore `direction: rtl` for proper Hebrew text alignment.

---

## Test checklist
- [ ] Step 3: no price in bottom bar
- [ ] Step 12: price appears after selecting length
- [ ] Step 13 (summary): price visible
- [ ] Character card: square image on left, fields on right
- [ ] Character card: click square → file picker opens
- [ ] Character card: after photo upload → photo fills square + "החלף" overlay
- [ ] Character card: click on photo/overlay → new file picker
- [ ] Character card: mobile (480px) — still horizontal, smaller square
- [ ] "Add character" button card still works
