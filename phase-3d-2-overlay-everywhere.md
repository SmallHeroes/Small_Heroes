# Phase 3d.2 — Collapse to full-bleed overlay everywhere + typography + stronger text-zone reservation

## Principle
Phase 3d wired up three different page templates (`full_bleed_overlay`, `art_top_text_bottom`, `character_vignette_text`). The latter two render text on a paper band BELOW the image, which means the image is partially obscured by a white block. We want one consistent rule across the entire book:

- The image is the page. Every interior page is full-bleed.
- Text always overlays on the image, in the storyboard's chosen zone.
- The image generation prompt is responsible for ensuring that zone is visually quiet enough for readable text.

This phase collapses the three templates into one full-bleed-overlay rendering, sets correct typography, and strengthens the image-generation directive so the quiet zone scales with actual text length.

## Scope

### In scope
- `app/book/[id]/read-v2/reader-v2.tsx` — remove `art_top_text_bottom` and `character_vignette_text` rendering paths for interior pages. All interior pages render as full-bleed overlay regardless of `pageTemplate`. Cover stays as-is.
- `app/book/[id]/read-v2/reader-v2.module.css` — remove the paper-band-below-image styling (`.paperTextBand`, `.paperPageText`, `.vignetteLowerPaper`, `.paperPageTextVignette`, `.tplArtTopTextBottom`, `.tplCharacterVignette` if no longer needed). Keep `.tplFullBleedOverlay` and the overlay zone classes; the typography rules live there now. Update overlay text styles to **Heebo 20px line-height 1.6**.
- Ensure Heebo font is loaded. Search the existing layout/font imports (`app/layout.tsx`, any `layout.css`, or Next.js `next/font` usage). If Heebo is not already loaded, import it via `next/font/google` in the appropriate layout file. Use weights 400 + 600 (regular for body, semibold for emphasis if needed).
- `backend/providers/image.ts` — strengthen the `textZoneDirective` so the directive scales with text length, names visual properties of the quiet zone explicitly, and avoids face/detail in that zone. Pass the page text length through so the directive can compute zone size.

### Out of scope — DO NOT TOUCH
- `pageTemplate` field in the API or DB. We're keeping the field for now; the reader just renders all values the same way.
- Story generation, story directions, wizard, payment, audio.
- LoRA, model swaps, character-lock content.
- Cover image rendering (stays as full-bleed with title overlay from 3d).
- The phantom unrelated 30+ files in working tree.

## Tasks

### T1 — Collapse interior page rendering

In `reader-v2.tsx`, around the rendering switch (~lines 318–395 per Cursor's previous report):

- Cover branch: unchanged.
- `text_only` branch: unchanged (no image, paper page, typographic focus).
- ALL OTHER values of `pageTemplate` (`full_bleed_overlay`, `art_top_text_bottom`, `character_vignette_text`, anything else) render as **full-bleed overlay** with the existing `.tplFullBleedOverlay` shell.

Keep the `textZone` logic — `top_clear` / `bottom_clear` / `left_clear` / `right_clear` / `center_clear` still control where the overlay text goes. Default to `bottom_clear` if missing.

Delete the JSX branches and CSS classes for `art_top_text_bottom` and `character_vignette_text` (or leave the CSS and just stop using it; verify nothing else references those class names).

### T2 — Typography

In `reader-v2.module.css`, the overlay text class (`.overlayPageText` per Cursor's report):

```css
.overlayPageText {
  font-family: 'Heebo', sans-serif;
  font-size: 20px;
  line-height: 1.6;
  color: #fff9f0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 12px rgba(0, 0, 0, 0.25);
  font-weight: 500;
  /* preserve existing overlay positioning, RTL direction, etc. */
}
```

If Heebo is not already loaded somewhere in the app, add it. Use Next.js `next/font/google`:

```ts
// in app/layout.tsx (or the closest applicable layout)
import { Heebo } from 'next/font/google';
const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '600'], variable: '--font-heebo' });
```

Then either expose `--font-heebo` and use `font-family: var(--font-heebo), sans-serif;` in the CSS, or apply the className. Pick whichever pattern matches existing font loading in the repo.

For the cover title (`.coverDisplayTitle`) — also use Heebo, but at the existing larger size. No change to the size, only the family.

### T3 — Stronger text-zone reservation in image prompt

The current `textZoneDirective` says: "Leave the upper third visually quiet and uncluttered: no faces, no busy details, suitable for text overlay."

Replace with a directive that is:
- **Proportional to text length.** A 30-word page needs less reserved area than a 150-word page.
- **Specific about the visual properties** the zone must have.
- **Repeated as a hard constraint** (Flux honors hard-emphasis better than soft suggestion).

New helper:

```ts
function textZoneDirective(textZone?: string, textLength?: number): string {
  if (!textZone) return '';
  const zoneLabelMap: Record<string, string> = {
    top_clear: 'upper portion',
    bottom_clear: 'lower portion',
    left_clear: 'left portion',
    right_clear: 'right portion',
    center_clear: 'central portion',
  };
  const zoneLabel = zoneLabelMap[textZone] ?? textZone;
  const isLong = (textLength ?? 0) > 120;
  const sizeLabel = isLong ? 'at least the lower 40% of the frame' : 'at least the lower 25% of the frame';
  // (replace 'lower' with the appropriate spatial word in the sizeLabel based on zoneLabel)
  return [
    `CRITICAL TEXT OVERLAY ZONE: The ${zoneLabel} must be visually quiet for text overlay.`,
    `This zone must cover ${sizeLabel}, with low color saturation and minimal detail.`,
    `Acceptable content for the zone: open sky, plain wall, soft fog, water surface, snow, grass, or atmospheric haze.`,
    `Do NOT place faces, hands, intricate patterns, written text, complex lighting, or focal subjects in this zone.`,
    `The rest of the frame can be richly detailed, but this zone must remain calm and uncluttered.`,
  ].join(' ');
}
```

Pass `textLength` from the caller (the page text length, or imagePrompt length, whichever is the practical proxy).

Compute `sizeLabel` correctly per zone:
- `top_clear` → "the upper 25% / 40%"
- `bottom_clear` → "the lower 25% / 40%"
- `left_clear` → "the left 25% / 40%"
- `right_clear` → "the right 25% / 40%"
- `center_clear` → "a central rectangle covering ~30% / 50%"

Update the existing log to include length:
```
[text_zone_directive] page=<n> textZone=<zone> textLength=<chars> directiveLen=<chars>
```

### T4 — RTL safety

Hebrew is RTL. `left_clear` and `right_clear` are PHYSICAL screen positions (visual left, visual right), not RTL-flipped. The reader CSS should use physical positioning (`left: 0`, `right: 0`), not logical (`inset-inline-start`). Verify that the storyboard's `textZone` selection is also visual, not logical — if in doubt, document this in a code comment.

## Safety
- No backend logic change other than the directive helper.
- No DB changes.
- All CSS changes are scoped to `reader-v2.module.css`.
- The `pageTemplate` field continues to be returned by the API and accepted by the reader; we just stop branching on it for non-cover non-text-only cases.
- `npm run build` must pass.

## Acceptance criteria
- `npm run build` passes.
- Opening any existing book in read-v2: every interior page renders as full-bleed image with text overlay. No white paper band below image. No image being cut off.
- Heebo font is visibly applied to overlay text (verify by inspecting computed style in browser, font-family should resolve to Heebo).
- Overlay text is 20px with 1.6 line-height.
- The new `[text_zone_directive]` log line includes `textLength` and `directiveLen` is significantly longer than before (the new directive is more verbose by design).
- For a fresh book generation, the directive in the final prompt explicitly mentions "CRITICAL TEXT OVERLAY ZONE", a percentage of frame, and prohibited content (faces, text, intricate patterns).

## Return format

- **GO / NO-GO**
- **Files changed**
- **Where the directive helper now lives** — file + function + line range
- **Sample new directive output** for one short page (text < 120 chars) and one long page (text > 120 chars), with `textZone=bottom_clear`
- **How Heebo is loaded** — file + import statement (or confirmation it was already loaded)
- **Sample browser computed style** for `.overlayPageText` — confirms font-family=Heebo, font-size=20px, line-height=32px (= 20*1.6)
- **Risks / open questions**

## Future phases (NOT in this task — for orientation)
- Phase 3e: upstream image-content fix — clean rebuild of the prompt builder, English scene description per page, real character lock from wizard data, fix PROMPT_CONTRACT origin in pipeline.ts.
- Phase 3b: LoRA training and integration.
- Phase 3c: Three direction cards differentiation + new "magic" archetype.
