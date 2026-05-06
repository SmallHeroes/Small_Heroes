# Phase 3d — Real picture-book page layout (text on image, no card chrome)

## Principle
The illustration IS the page. Text lives on the illustration in a deliberately quiet zone, not in a separate container below it. No dark gray wrapper. No card with the image inside it. The reader is a book, not a CMS.

## Goal
After this phase, opening a generated book produces:
- Pages that feel like real picture-book spreads — image bleeds to edges, text overlays on a quiet region of the image, paper-toned background everywhere.
- Page chrome reduced to minimal corner element (or removed on cover).
- The storyboard's existing `pageTemplate` and `textZone` decisions actually drive the rendering instead of being ignored.

## Scope

### In scope
- `app/book/[id]/read-v2/reader-v2.tsx` — rewrite the per-page render to use template-driven layout
- `app/book/[id]/read-v2/reader-v2.module.css` — new layout rules per template; replace card chrome with paper substrate; absolute-position text over image
- `backend/providers/image.ts` — add a one-line "leave [zone] visually quiet for text overlay" directive to the image prompt, derived from the storyboard's `textZone`
- (No DB changes. No new tables. The data is already there.)

### Out of scope — DO NOT TOUCH
- Story generation (`backend/providers/story.ts`, `pipeline.ts`)
- Wizard, payment, story-direction generation, audio
- `lib/styles.ts`, `lib/promptBuilder.ts`, `lib/visualDirector.ts`
- LoRA, IP-Adapter, model swaps
- The PROMPT_CONTRACT upstream pollution (deferred to phase 3e)
- Cover generation logic (we touch how cover is *displayed*, not how it's *generated*)
- Any of the 30+ unrelated uncommitted files in working tree

## Tasks

### T1 — Page substrate: kill the dark gray chrome

In `reader-v2.module.css` (and any global reader.css that affects this view), replace the page wrapper styling so the user sees:

- Page background: warm paper `#fdf9f4` (already defined in `public/CSS/reader.css` but apparently overridden — find the override and remove it).
- The current dark gray surrounding box around each page must go. The image should sit directly on the paper.
- Optional: a very subtle paper texture (existing `bookPalette` may already provide this; reuse if available, otherwise plain `#fdf9f4` is fine).

Header chrome (`עמוד N מתוך M`, book title): collapse into a single small unobtrusive footer line at the bottom of the page, in the existing book-typography font, color `#b8a990` (a desaturated tan), 10-11px. No top header bar at all on interior pages. On the cover, no chrome.

### T2 — Per-template layout rules

The order's API already returns `pageTemplate` per page (one of `full_bleed_overlay`, `art_top_text_bottom`, `character_vignette_text`, derived from the storyboard). Today the reader ignores these and always renders "image on top, text in dark gray box below." Wire them up.

**`full_bleed_overlay`** (used for short text + emotional beats):
- Image fills the entire page-canvas, bleeding to all four edges of the paper substrate.
- Text absolutely positioned over the image in the zone determined by `textZone`:
  - `top_clear` → text near top, with a subtle bottom-shaded gradient behind text only (so text reads on any image).
  - `bottom_clear` → text near bottom, gradient on top side of text region.
  - `left_clear` / `right_clear` → text on that side, vertical gradient strip.
  - `center_clear` → text centered, light radial fade behind it.
- Gradient behind text: very subtle, `linear-gradient(to top, rgba(20,15,10,0.55), rgba(20,15,10,0))` (or equivalent depending on direction). Strong enough that text is readable, soft enough that the image still reads as the dominant element.
- Text color on overlay: `#fff9f0` (warm white). Drop shadow `0 1px 3px rgba(0,0,0,0.45)` for legibility on light image regions.

**`art_top_text_bottom`** (used for medium text):
- Image bleeds left, right, and TOP of the page-canvas.
- The bottom ~35% of the page-canvas is paper-toned (the same `#fdf9f4` substrate).
- The image fades into the paper via a CSS mask (linear gradient bottom→transparent) at the boundary, so the transition is soft, not a hard cut. The fade should be ~80-120px tall.
- Text sits in the paper area in book typography (existing `var(--fd)` font, dark color `#2e2a22`, line-height 1.9).
- No dark box behind the text. Text is on paper.

**`character_vignette_text`** (used for spot illustrations / quiet beats):
- Image is a soft-edged vignette in the upper-center of the page-canvas, occupying ~55-65% of vertical height.
- Image edges fade to transparent (CSS mask: radial gradient or all-edges linear gradients).
- Text fills the remaining lower portion in paper area, in book typography, generous left/right margin (`max-width: 30em; margin: 0 auto`).
- This is the most "white space" of the three modes.

**`text_only`** (when no image — leave existing CSS as-is, just remove the dark wrapper).

### T3 — Image prompt: reserve the chosen zone

In `backend/providers/image.ts`, when assembling the final image prompt, append one explicit directive based on the storyboard's `textZone`:

```ts
function textZoneDirective(textZone?: string): string {
  if (!textZone) return '';
  const zoneMap: Record<string, string> = {
    top_clear: 'upper third',
    bottom_clear: 'lower third',
    left_clear: 'left third',
    right_clear: 'right third',
    center_clear: 'central area',
  };
  const zoneLabel = zoneMap[textZone] ?? textZone;
  return `Leave the ${zoneLabel} visually quiet and uncluttered: no faces, no busy details, suitable for text overlay. The quiet area can be sky, soft wall, simple background, or atmospheric haze.`;
}
```

Insert this directive into the prompt at the same point where `[image_negative_prompt_final]` is logged today, before the prompt is sent. Log a new line:
```
[text_zone_directive] page=<n> textZone=<zone> directiveLen=<chars>
```

### T4 — Cover treatment

The cover currently renders with the same chrome as interior pages. Change:
- No page number, no "1 of 9", no book title in dark header bar.
- Image is full-bleed, paper substrate behind.
- Book title overlays at the top of the image in large book-display typography (`var(--fd)`, weight 900, ~clamp(36px, 6vw, 64px), color `#fff9f0`, with text-shadow for readability against any image content).
- Author / subtitle line if present, smaller, below the title with comfortable spacing.
- Optional: a soft top-down gradient behind the title for guaranteed contrast.

Cover IMAGE generation is NOT changed in this phase. It still produces what it produces. We're only fixing how the cover is displayed.

## Safety
- No backend logic changes other than the one-line `textZoneDirective` insertion.
- No DB writes, no migrations.
- The existing `read-v2` route still works — we're rewriting how it renders, not the route itself.
- The legacy reader (`/read-v1` if it exists, or static HTML reader) is untouched.
- Hebrew RTL support must not regress. Test with both short and long Hebrew page text.
- `npm run build` and `tsc --noEmit` (or repo equivalent) must pass.

## Acceptance criteria
- `npm run build` passes.
- Opening any existing book in read-v2 shows:
  - No dark gray wrapper around the page.
  - Warm paper background everywhere.
  - At least three different page treatments visible across the book (depending on which `pageTemplate` each page got).
  - Text either overlays on image OR sits on paper area below a softly-faded image — never inside a dark gray box.
- The new `[text_zone_directive]` log line appears once per page generation.
- Cover renders with title overlay, no page number chrome.
- A page text of 200+ Hebrew characters renders readably without overflow.
- A page text of 30 Hebrew characters in `full_bleed_overlay` mode reads cleanly over the image.

## Return format

Reply with:
- **GO / NO-GO**
- **Files changed** — full list
- **Where the per-template layout rules live** — file + class names
- **How `pageTemplate` from the API is consumed by the reader** — function + line range
- **Sample HTML structure of one rendered page in `full_bleed_overlay` mode** — paste the actual DOM output (or what you expect from the JSX)
- **Sample log line** for the new `[text_zone_directive]`
- **Risks / open questions** — particularly any places where `pageTemplate` from the API doesn't map cleanly to the new CSS templates

## Future phases (NOT in this task — for orientation only)
- Phase 3e: upstream image content fix (English scene descriptions per page, fix character lock to use wizard data, fix PROMPT_CONTRACT origin in pipeline.ts, fix cover generation to be a story scene).
- Phase 3b: LoRA training and integration.
- Phase 3c: Three direction cards differentiation + new "magic" archetype.
