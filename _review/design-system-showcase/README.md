# SmallHeroes Design System — Portfolio Showcase

A standalone, curated case-study artifact presenting the SmallHeroes design system.
Not the internal `/design-system` dev tool — this is the portfolio-facing presentation.

**Last synchronized with product tokens: commit `3f60a4a4` · 2026-08-04**

## Contents

```
index.html                 the artifact (semantic HTML, RTL, Hebrew-first)
styles.css                 art direction + component recipes (reads tokens)
interactions.js            minimal vanilla JS — progressive enhancement only
assets/tokens.css          VERBATIM copy of public/CSS/tokens.css (see header)
assets/fonts/*.woff2       the exact Rubik/Heebo files the product serves
assets/*.webp              optimized product art + verification screenshots
build-assets.mjs           regenerates assets/ from the repo (documented below)
capture-page.mjs           tiled long-page screenshot tool
record-interactions.mjs    screencast generator
capture-full-1440.png      full-page screenshot (desktop)
capture-mobile-390.png     full-page screenshot (mobile)
capture-interactions.webm  ~35s recording of the live interactions
```

Open `index.html` directly (double-click / file://) — no server, no backend, no frameworks.
Verified at 1440 / 1024 / 768 / 390 / 360 with zero horizontal overflow and zero console errors.
With JavaScript disabled the page remains fully readable (reveals default to visible,
demos show their resting states). `prefers-reduced-motion` and the in-page motion switch
zero all animation.

## Production tokens & components represented

- **Tokens (from `assets/tokens.css`, verbatim):** full brand/ink/surface/border/feedback color
  set, 14 typography roles, 8pt spacing scale, radii, shadows + selection/focus rings, z-index,
  control sizes, motion durations/easings.
- **Components mirrored 1:1 from production CSS recipes:** primary/outline/light/text buttons
  (hover, pressed, focus, disabled, loading), unified field recipe (input/select/textarea,
  helper, counter, error state with `aria-invalid` + `role=alert`), upload dropzone, chips,
  segmented toggle, sleep toggle, selection cards (selected ≠ featured ≠ hover ≠ coming-soon),
  category/style/voice/product cards, info+warning callouts, coupon ok/error lines, generation
  dots, empty state, progress pills + step shell, bottom action bar pattern.
- **Real product imagery:** hero child+fox art, companion sheets (אוּרי, עֲנָת), category card
  art, gallery pages, and screenshots from the verified redesign runs (demo data only — "נועה").

## Conceptual examples (clearly labeled in-page, not production screens)

1. Flow step 10 "היצירה" — live generation screen requires a real order; shown as a labeled concept frame.
2. Flow step 11 "הספר / הספרייה" — finished-book state shown as a labeled concept frame.
3. Form "success" tick styling beyond the coupon line — the product currently only styles error/warning/ok-text.
4. The AI-personalization demo is an *illustration of real product behavior* (name → titles,
   challenge → companion, direction → length/price) — labeled as such in the section intro.

## Moving into another website

The folder is self-contained — copy it wholesale (e.g. to `/work/smallheroes-design-system/`).
To embed inside an existing page instead: copy the `<main>` + `<header class="topbar">` markup,
and include `assets/tokens.css` before `styles.css`; all selectors are scoped to the artifact's
own class names (no resets beyond `*{box-sizing}`), fonts resolve from `assets/fonts/` via
relative paths. `interactions.js` is optional; without it everything stays readable.
An iframe embed also works as-is.

## Updating after future product changes

1. Re-copy `public/CSS/tokens.css` → `assets/tokens.css` (keep the header, bump commit + date).
2. Update the "Last synchronized" commit in `index.html` (colophon + head comment) and here.
3. `node build-assets.mjs` from the repo root (refreshes art + screenshots from `_review/design-refresh/`).
4. If component recipes changed in production CSS, mirror them in `styles.css` (sections are
   commented per component).
5. Recapture: `node capture-page.mjs 1440 capture-full-1440.png`, same for 390, and rerun
   `record-interactions.mjs` (needs ffmpeg on PATH — the repo's `@ffmpeg-installer` binary works).

## Confidentiality

No customer data, no real orders, no internal URLs, no infrastructure details, no analytics
keys. All child/parent details shown are demo values typed during verification ("נועה",
"דניאל"). Screenshots come from a local dev run of public-facing screens. The only repository
reference is the sync-commit hash above and in HTML comments (not visible content).
