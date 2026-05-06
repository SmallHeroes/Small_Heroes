# Phase 3d.4 — Reader text polish + cover fix

## Context
After 3e.3, textZone now varies per page. But left_clear/right_clear/center_clear zones create half-width text blocks that look terrible in Hebrew. The cover displays an English scene description as subtitle. Font feels weak for a children's book. Minor visual artifacts (shadow on page edges).

## Tasks

### T1 — Restrict textZone to top/bottom only

The storyboard generates 5 possible textZone values. The reader CSS for left/right/center constrains text to a narrow column (48% width or 220px). Hebrew text in a narrow column looks broken. We only want `top_clear` and `bottom_clear`.

**In `backend/providers/image.ts`**, find the `normalizeStoryboardRows` function (around line 670-700). Where `textZone` is assigned (line 684-687):

```typescript
textZone:
  typeof row.textZone === 'string' && TEXT_ZONES.includes(row.textZone as TextZone)
    ? (row.textZone as TextZone)
    : TEXT_ZONES[i % TEXT_ZONES.length],
```

Change to map everything to top or bottom:

```typescript
textZone: normalizeToVerticalZone(row.textZone, i),
```

Add this helper function near the top of the file (after the TEXT_ZONES constant):

```typescript
/** Map any textZone to top_clear or bottom_clear — side/center zones break Hebrew text layout. */
function normalizeToVerticalZone(raw: unknown, pageIndex: number): TextZone {
  if (raw === 'top_clear') return 'top_clear';
  if (raw === 'bottom_clear') return 'bottom_clear';
  // For left/right/center or invalid: alternate top/bottom based on page index
  // Prefer bottom for even pages, top for odd — visual variety
  return pageIndex % 2 === 0 ? 'bottom_clear' : 'top_clear';
}
```

**Also in the storyboard system prompt** (same file, around line 760-780 where allowed enum values are listed), restrict the textZone guidance:

Change:
```typescript
`textZone: ${TEXT_ZONES.join(', ')}`,
```
To:
```typescript
`textZone: top_clear, bottom_clear (ONLY these two — never use left_clear, right_clear, or center_clear)`,
```

This way the LLM tries to pick top/bottom, and the normalizer catches anything else.

### T2 — Text padding: 40px all sides, full width always

In `app/book/[id]/read-v2/reader-v2.module.css`:

**overlayTextShell** (line 192-201):
Change `padding-inline: 32px;` to `padding: 40px;`

```css
.overlayTextShell {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  padding: 40px;
}
```

**overlayZoneBottom** (line 239-246):
```css
.overlayZoneBottom {
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 48%;
  justify-content: flex-end;
}
```
(Remove the old padding values — the parent's `padding: 40px` handles it now)

**overlayZoneTop** (line 252-258):
```css
.overlayZoneTop {
  top: 0;
  left: 0;
  right: 0;
  max-height: 48%;
  justify-content: flex-start;
}
```
(Remove the old padding values)

**Remove or comment out** the CSS for `.overlayZoneLeft`, `.overlayZoneRight`, `.overlayZoneCenter` and their gradient children (lines 265-308). They should never render now, but removing the CSS is cleaner.

### T3 — Replace Heebo with Rubik for reader text

Rubik is rounder, warmer, and more suitable for a children's book. Available on Google Fonts with excellent Hebrew support.

**In `app/layout.tsx`:**
```typescript
import { Arimo, Rubik } from 'next/font/google';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const arimo = Arimo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-arimo',
  display: 'swap',
});

// In the html tag:
<html lang="he" dir="rtl" className={`${rubik.variable} ${arimo.variable}`}>
```

**In `reader-v2.module.css`** (line 4):
Change:
```css
--reader-font-stack: var(--font-heebo), var(--font-arimo), 'Heebo', 'Arimo', sans-serif;
```
To:
```css
--reader-font-stack: var(--font-rubik), var(--font-arimo), 'Rubik', 'Arimo', sans-serif;
```

**Note:** Check if Heebo is used elsewhere in the app (wizard, other pages). If so, keep the Heebo import but add Rubik alongside it. The reader should use Rubik; other pages can stay with Heebo.

### T4 — Remove page shadow

In `reader-v2.module.css`, `.pageCanvas` (line 79):
Change:
```css
box-shadow: 0 8px 28px rgba(46, 42, 34, 0.06);
```
To:
```css
box-shadow: none;
```

Also check `.tplCover` and any other element that might have a shadow. The mobile media query already sets `box-shadow: none` for pageCanvas — make it consistent for desktop too.

### T5 — Fix cover subtitle (English text leak)

The cover shows "enters the classroom and finds it quiet but daunting יובלי" as a subtitle. This comes from `brain.narrativeCore.opening` (pipeline.ts line 2984), which is in English (the Brain stage outputs English).

**Option A (recommended): Don't display coverText at all.**
The title "הספר של יובלי" is enough. The cover subtitle adds visual noise and is currently English.

In `reader-v2.tsx` (line 374):
```typescript
// Remove or comment out:
// {coverText ? <p className={styles.coverSubtitle}>{coverText}</p> : null}
```

**Option B (if we want a subtitle): Use the first sentence of page 1 text (which is Hebrew).**
In `reader-v2.tsx`, after `normalizeReaderPages`:
```typescript
const firstPageText = normalizedPages.find(p => !p.isCover)?.text ?? '';
const subtitle = firstPageText.split(/[.!?]/)[0]?.trim() ?? '';
setCoverText(subtitle);
```

**Pick Option A** — cleaner, simpler. We can revisit subtitles later.

## Safety
- T1 only affects new generations (existing textZone values in DB are already persisted)
- T2 is CSS-only — no data changes
- T3 is font swap — if Rubik fails to load, Arimo is fallback
- T4 is CSS-only
- T5 removes one line of JSX
- `npm run build` must pass

## Acceptance criteria
- `npm run build` passes
- Open the most recent generated book in the reader:
  - Text is always full width (never half-page column)
  - Text has ~40px padding from all edges
  - Font looks rounder/warmer (Rubik)
  - No shadow on page edges
  - Cover shows only the Hebrew title, no English subtitle
- For a NEW generation: textZone values in DB should only be `top_clear` or `bottom_clear`

## Verification
1. Open an existing generated book — check CSS changes (T2, T3, T4, T5)
2. Generate a new book — check that textZone is only top_clear/bottom_clear (T1)
3. Screenshot 3-4 pages showing text at different vertical positions with full-width layout

## Return format
- **GO / NO-GO**
- **Files changed**
- **Screenshots** of at least 2 pages showing the new text layout
- **textZone DB values** for the new generation (should be only top_clear/bottom_clear)

## Git commit (after GO)
```
phase 3d.4: reader text polish — full-width zones, Rubik font, cover fix

T1: textZone restricted to top_clear/bottom_clear only (left/right/center broke Hebrew layout)
T2: 40px padding all sides on text overlay
T3: Rubik font replaces Heebo — rounder, warmer for children's book
T4: page shadow removed
T5: English cover subtitle removed (was leaking brain.narrativeCore.opening)
```

Stage:
```powershell
git add app/layout.tsx app/book/[id]/read-v2/reader-v2.module.css app/book/[id]/read-v2/reader-v2.tsx backend/providers/image.ts
git diff --cached --stat
```
