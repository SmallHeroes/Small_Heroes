# Phase 3d.3 — Polish: text color, padding, font fallback, cover style, story length

## Principle
Five fixes after 3d.2 lands. Each is small and independent, but they ship together because they're all about closing the gap between "the layout works in principle" and "the page reads well."

## Scope

### In scope
- `app/book/[id]/read-v2/reader-v2.module.css` — overlay text color, padding, font stack
- `app/layout.tsx` — keep existing Heebo loader, add Arimo as a parallel fallback Google Font (or via system stack — see T3)
- The cover image generation path in `backend/providers/image.ts` (or wherever cover prompts are composed — needs investigation; cover today renders in a different aesthetic than interior pages)
- The story-prose target word range in `backend/providers/pipeline.ts` (the Stage 3D "minimum page length" repair logic)

### Out of scope — DO NOT TOUCH
- Other rendering branches (cover layout, text_only)
- Image generation for non-cover pages
- The stronger text-zone directive from 3d.2 — that stays as-is (it's working)
- LoRA, character lock, story directions, wizard, payment
- Adding new layout variations (hero pages, image-dominant pages, etc.) — deferred to a future phase per user direction

## Tasks

### T1 — Overlay text: dark color, no shadow

In `reader-v2.module.css`, the `.overlayPageText` rule (and any `.overlay*` text style):

Replace current white-on-shadow style:
```css
color: #fff9f0;
text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 12px rgba(0, 0, 0, 0.25);
```

With dark-on-light, no shadow:
```css
color: #2a241a;
text-shadow: none;
```

Why: the 3d.2 directive forces Flux to leave text-zone areas calm and low-saturation, which in practice produces light cream/paper-toned regions. White text on cream is illegible. Dark text on cream is clean and book-like.

The existing gradient behind the text (`.overlayTextGradient`) can stay but should be inverted/lightened — currently it's a dark gradient meant for white text. Either remove it entirely (let the text sit on the calm image area directly) or change to a very subtle paper-fade `linear-gradient(to top, rgba(253, 249, 244, 0.7), transparent)` so it brightens the area behind the text without darkening it. Default to remove unless you find a page where contrast fails.

### T2 — More horizontal padding for overlay text

Increase horizontal padding of the overlay text shell. The text should not reach within ~24-32px of the page edges.

Find `.overlayTextShell` (or whichever class wraps the overlay text). Add or increase:
```css
padding-inline: 32px;
/* or padding: 24px 32px; */
```

Verify on both short text (single line) and long text (full page) — the padding should look intentional in both cases.

### T3 — Font fallback: Heebo + Arimo

Two things:

1. Verify Heebo is actually being applied. Inspect `<html className={heebo.variable}>` in the rendered output and confirm `--font-heebo` resolves to the Next-injected Heebo family. If it doesn't (e.g., the import didn't ship, or the variable isn't reaching read-v2 CSS), fix the path.

2. Regardless, add Arimo as a fallback so we have a second Hebrew sans-serif if Heebo fails to load:

In `app/layout.tsx`:
```ts
import { Heebo, Arimo } from 'next/font/google';
const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '600'], variable: '--font-heebo', display: 'swap' });
const arimo = Arimo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '700'], variable: '--font-arimo', display: 'swap' });
```

Apply both variables to `<html>`:
```tsx
<html className={`${heebo.variable} ${arimo.variable}`}>
```

In `reader-v2.module.css`, font-family stack becomes:
```css
font-family: var(--font-heebo), var(--font-arimo), 'Heebo', 'Arimo', sans-serif;
```

This way: Next-injected Heebo first, Next-injected Arimo as backup, system Heebo/Arimo as next backup, then generic sans-serif.

### T4 — Cover style alignment (investigate then fix)

The cover image is currently rendered in a noticeably different aesthetic (cleaner, more polished, more "digital cartoon") than the interior pages (which use the soft hand-drawn / expressive painterly style assigned to the book).

**Investigation** (not optional — must report findings):
- Find where the cover image prompt is composed. Likely in `backend/providers/image.ts` (look for `assetType: 'cover'` branching or `pageNumber: 0`), or in `backend/providers/pipeline.ts` Stage 4 / package.
- Compare the cover prompt to a typical interior page prompt. Identify what's different:
  - Is the style block missing or different?
  - Is `STYLE_LOCK` truncated for cover?
  - Is the model the same?
  - Are the dimensions different (cover may be square / landscape; that's fine, but style should still match)?
  - Is `isDirectionPreview` accidentally true?

**Fix**: align the cover prompt to use the same style block as interior pages. If the cover needs a slightly different framing (e.g. show character full body, hero pose, no companion required), keep those framing differences but ensure the STYLE LOCK / negatives are identical.

Add a log line:
```
[cover_style_alignment] orderId=<id> styleId=<id> styleBlockLen=<chars> matchesInteriorPath=<bool>
```

### T5 — Reduce story page length by ~35%

In `backend/providers/pipeline.ts` (Stage 3D Prose repair logic), the current target word range per page is roughly **40–80 Hebrew words** (visible from logs: `Repairing p1 (34w → target 40–80)`).

Reduce target to **25–55 words per page** (a ~35% drop):
- `MIN_WORDS_PER_PAGE`: 25 (was likely 40)
- `MAX_WORDS_PER_PAGE`: 55 (was likely 80)

Find the constants — they're likely named something like `TARGET_MIN_WORDS`, `TARGET_MAX_WORDS`, `MIN_PAGE_LENGTH`, `MAX_PAGE_LENGTH`, or hardcoded into a prompt template.

Also update the LLM prompt that asks for prose generation — wherever the target is mentioned in the system/user prompt to the model, change "40–80 words" or "around 60 words" to the new range.

Verify by running one full generation and checking logs:
```
[Pipeline][Prose-3D] Repairing p1 (Xw → target 25–55)...
```

### T6 — (Documentation only, no code) — Future layout variation note

In a code comment near the rendering switch in `reader-v2.tsx`, add a note:

```ts
// LAYOUT NOTE (2026-04, phase 3d.3):
// All interior pages currently render as full-bleed overlay (single layout).
// Future phase will add variation: hero pages (image fills 100%, no text on overlay,
// short caption only), image-dominant pages (large image, minimal text), and
// asymmetric spreads. For now we keep one consistent treatment.
```

This is for the next developer (or future-you) to know the current uniformity is intentional, not an oversight.

## Safety
- All CSS changes scoped to `reader-v2.module.css`.
- Story length change in pipeline doesn't affect existing books (no DB write, only changes future generations).
- Cover style fix changes the prompt for newly-generated covers; existing covers unchanged.
- `npm run build` must pass.

## Acceptance criteria
- `npm run build` passes.
- Opening any existing book in read-v2: overlay text is dark `#2a241a` with no shadow, has visible 24-32px horizontal padding from page edges.
- Inspect element on overlay text confirms `font-family` resolves to Heebo first, with Arimo as a fallback if Heebo fails.
- For a fresh book generation: cover style matches interior page style (the soft hand-drawn / expressive painterly style of the chosen styleId), not a different polished cartoon aesthetic.
- For the same fresh book: page lengths are in the 25-55 Hebrew word range. Logs show new target range.
- The new `[cover_style_alignment]` log shows `matchesInteriorPath=true` for new covers.

## Return format
- **GO / NO-GO**
- **Files changed**
- **T4 investigation finding** — what was different about the cover prompt before, what was changed, where (file + line range)
- **T5 constants** — names of the constants and old → new values
- **Sample new directive output** — paste the actual cover prompt for one fresh book and the corresponding page-1 prompt, confirming styleId is identical
- **Sample browser computed style** for `.overlayPageText`: confirms color=#2a241a, text-shadow=none, padding-inline=32px, font-family resolves to Heebo
- **Risks / open questions**

## Future phases (NOT in this task — for orientation)
- Phase 3e: prompt-builder rebuild — kill the 5000-char prompt, English scene per page, real character lock from wizard, fix PROMPT_CONTRACT origin
- Phase 3b: LoRA training and integration
- Phase 3c: three-cards differentiation + magic archetype + card copy
- Phase 3d.4 (later): layout variations — hero pages, image-dominant pages, asymmetric spreads
