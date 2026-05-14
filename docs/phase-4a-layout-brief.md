# Phase 4a — Book Layout (REVISED: Single Image, CSS Crop on Desktop)

**Owner:** Cursor (implementing engineer)
**Reviewer:** Guy (CTO / Product)
**Status:** Ready for implementation — pipeline (Task 1+2) already done, reader work remaining
**Estimated effort:** 1 day for Reader; image pipeline already shipped

---

## Core Insight (the simplification)

**ONE image per page** — portrait 1024×1536 — serves BOTH desktop and mobile. We do NOT generate two versions.

- **Mobile / Video:** show the full portrait image; Hebrew text overlays a soft textZone band (top OR bottom 25%, per storyboard).
- **Desktop / PDF:** CSS crops OUT the soft textZone band; the remaining 75% becomes the "image page" of a 2-page spread. The facing page holds the text.

**Why this works:** the textZone band is intentionally low-detail (sky, ground, bedding, haze). Cropping it out on desktop loses nothing important — the main 75% is a complete standalone scene.

**Cost savings:** half the images, half the API spend, perfect consistency between desktop and mobile (same exact illustration).

---

## What's Already Done (Task 1+2 — Image Pipeline)

✅ `backend/providers/image.ts`:
- `ImageInput.pageLayoutStyle` added (still used as a narrative signal: `vignette` = intimate framing, `full_bleed` = wide framing — both portrait, both with text zone)
- `generateWithGPTImage()` always returns portrait 1024×1536 for interior pages (hiResPdf overrides to 1536×1536, preview to 1024×1024)
- `buildGPTImagePrompt()` injects a "UNIVERSAL PORTRAIT" layout directive that:
  - Mandates rich edge-to-edge scene
  - Reserves a soft 25% textZone band at top or bottom (per storyboard)
  - Enforces the "STANDALONE 75% RULE" — main scene must work without the band

✅ `scripts/test-layout-pipeline.mjs`: generates one test portrait + (if `sharp` installed) a simulated desktop crop. Use this to visually verify image quality before mass generation.

---

## Reader Work (Cursor — Task 3+ below)

### Task 3 — Desktop 2-Page Spread

**Files:**
- `app/book/[id]/read-v2/reader-v2.tsx`
- `app/book/[id]/read-v2/reader-v2.module.css`

#### 3a. Spread Layout (CSS)

```css
.spread {
  display: flex;
  flex-direction: row-reverse; /* RTL — image on the right (first in reading order) */
  gap: 8px;
  max-width: 1440px;
  margin: 0 auto;
  height: 100vh;
  padding: 24px 32px;
  box-sizing: border-box;
}

.spreadPage {
  flex: 1;
  max-width: 720px;
  background: var(--page-bg, #f7f3eb);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  position: relative;
  overflow: hidden;
}

/* Text page — large text, centered vertically */
.textPage {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 56px;
}

.textPage .bodyText {
  font-family: var(--reader-font-stack);
  font-size: clamp(20px, 2.2vw, 28px);
  line-height: 1.7;
  text-align: right; /* Hebrew RTL paragraph */
  max-width: 520px;
  color: #2a2418;
}

/* Image page — CSS crops out the textZone band */
.imagePage {
  padding: 0;
  height: 100%;
}

.imagePage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Default: textZone=bottom_clear → crop bottom band → show top 75% */
  object-position: center top;
}

/* If textZone=top_clear → soft band is at top → crop top, show bottom 75% */
[data-text-zone='top_clear'] .imagePage img {
  object-position: center bottom;
}

/* For perfect 75% crop, use aspect-ratio + transform if cover doesn't crop enough */

.pageNumber {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--page-number-color, #8a7a5a);
  opacity: 0.7;
  letter-spacing: 0.05em;
}
```

#### 3b. TSX

```tsx
function InteriorPage({ page, pageNumber }: Props) {
  return (
    <div className={styles.spread} data-text-zone={page.textZone ?? 'bottom_clear'}>
      {/* Text page (left in RTL = second in reading order) */}
      <div className={`${styles.spreadPage} ${styles.textPage}`}>
        <p className={styles.bodyText}>{page.text}</p>
        <span className={styles.pageNumber}>· {pageNumber} ·</span>
      </div>
      {/* Image page (right in RTL = first) */}
      <div className={`${styles.spreadPage} ${styles.imagePage}`}>
        <img src={page.imageUrl} alt="" loading="eager" />
      </div>
    </div>
  );
}
```

### Task 4 — Mobile / Video (single screen with overlay)

```css
@media (max-width: 1023px) {
  .spread {
    flex-direction: column;
    max-width: 100%;
    height: 100vh;
    padding: 0;
  }
  .textPage {
    display: none; /* hidden — text overlays the image */
  }
  .imagePage {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
  .imagePage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center; /* show full image */
  }
  /* Text overlay in the textZone band — uses STRONG CSS gradient for legibility */
  .overlayText {
    position: absolute;
    left: 0;
    right: 0;
    padding: 40px 24px 60px;
    font-family: var(--reader-font-stack);
    font-size: clamp(16px, 4.5vw, 22px);
    line-height: 1.6;
    color: #2a2418;
    text-align: right;
    /* Gradient covers ~33% of screen height for text legibility */
    min-height: 33vh;
    display: flex;
    align-items: center;
  }
  [data-text-zone='bottom_clear'] .overlayText {
    bottom: 0;
    /* Strong gradient — opaque page-bg color at text level → transparent toward middle */
    background: linear-gradient(to top,
      var(--page-bg, #f7f3eb) 0%,
      rgba(247, 243, 235, 0.95) 40%,
      rgba(247, 243, 235, 0.70) 70%,
      rgba(247, 243, 235, 0) 100%);
  }
  [data-text-zone='top_clear'] .overlayText {
    top: 0;
    background: linear-gradient(to bottom,
      var(--page-bg, #f7f3eb) 0%,
      rgba(247, 243, 235, 0.95) 40%,
      rgba(247, 243, 235, 0.70) 70%,
      rgba(247, 243, 235, 0) 100%);
  }
  .pageNumber {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    z-index: 2;
  }
}
```

In TSX, add a mobile-only overlay text element inside `.imagePage`:

```tsx
<div className={`${styles.spreadPage} ${styles.imagePage}`}>
  <img src={page.imageUrl} alt="" loading="eager" />
  {/* Mobile-only overlay text (hidden on desktop via CSS) */}
  <div className={styles.overlayText}>{page.text}</div>
  <span className={`${styles.pageNumber} ${styles.mobileOnly}`}>· {pageNumber} ·</span>
</div>
```

### Task 5 — Navigation by Spread on Desktop

```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');

const goNext = () => {
  const step = isDesktop ? 1 : 1; // each "page" is a spread already
  setCurrentPageIndex((i) => Math.min(i + step, totalPages - 1));
};
```

(Since each "spread" is a single logical page-with-image, navigation can stay single-step. The spread shows the SAME logical page's text + image.)

### Task 6 — Special Pages (Full-Image, No Text Page)

For pages where the text overlay isn't needed (Cover / Letter / Closing / Dedication):

```tsx
if (page.kind === 'cover' || page.kind === 'letter' || page.kind === 'closing') {
  return (
    <div className={`${styles.spread} ${styles.specialPage}`}>
      <div className={styles.fullImagePage}>
        <img src={page.imageUrl} alt="" />
        {page.kind === 'cover' && <div className={styles.coverTitle}>{page.title}</div>}
      </div>
    </div>
  );
}
```

```css
.specialPage { flex-direction: column; }
.fullImagePage {
  width: 100%;
  height: 100%;
  position: relative;
}
.fullImagePage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}
```

### Task 7 — Page Number

Already covered in CSS above. Format: ` · 5 · ` (Arabic numeral, small, subtle).
- Desktop: appears on the TEXT page only
- Mobile: small at very bottom, z-index above image

---

## Acceptance Criteria

- [ ] On desktop (≥1024px), book opens as a 2-page spread: text page (left in RTL) + image page (right in RTL with bottom soft band cropped out)
- [ ] On mobile (<1024px), full portrait image fills screen, Hebrew text overlays in the textZone band (top or bottom per storyboard)
- [ ] Image is CSS-cropped on desktop, NOT a different image
- [ ] PDF export = same as desktop spread
- [ ] Page number shows on text page (desktop) or at very bottom (mobile), small + subtle
- [ ] Cover / letter / closing render as full-screen image with no text page
- [ ] Hebrew text alignment: right-aligned within column
- [ ] Verify in browser DevTools that the image element has `object-position` matching textZone

---

## Test Story for Verification

Pilot on `chameleon_koko_bedtime` (top-scored story, 10 interior pages):

1. Find or create an order with chameleon_koko + bedtime in dev DB
2. Regenerate images via `/api/debug/replicate-image` for pages 1-3 (no need to redo all)
3. Open `/book/<id>/read-v2`
4. Test breakpoints:
   - 1440px wide → spread layout, text page + image page
   - 800px wide → mobile single-page with overlay (tablet collapses to mobile)
   - 375px wide → mobile single-page, full image, text overlay
5. Test PDF export → should look like desktop spread
6. Manual visual review by Guy before mass image regen

---

## Out of Scope

- LoRA / style refinement (separate phase)
- Video generation (Phase 5)
- Direction-preview cards (already done)
- Cover special-case styling (basic only here; refinement later)
