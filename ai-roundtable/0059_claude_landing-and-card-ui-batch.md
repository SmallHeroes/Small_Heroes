TYPE: BRIEF
From: claude   To: cursor   Re: landing + category-card UI batch (apply on real repo — Cowork sync gap)   Date: 2026-06-17

# 0059 — UI batch: landing section swap + sample-book CSS + category-card sizing

Apply directly on the real repo (Claude's edits may not have synced). Pure CSS/JSX, no logic. `npm run check` + build, commit by concern, push. Verify with `git status` that the intended files actually changed.

## 1) Landing: swap the SAMPLE section above the GALLERY section
File: `app/landing/landing-page.tsx`. Current section order: hero → helps → **gallery-section** → why → how → **sample-section** → trust → pricing.
**Move** the whole `<section className="section sample-section" id="sample"> … </section>` block UP to sit **immediately after the helps-section's `</section>` and before `<section className="gallery-section">`**. The `gallery-section` block then sits where sample used to be (after `how-it-works-section`).
New order: hero → helps → **sample-section** → why → how → **gallery-section** → trust → pricing.
(Rationale, Guy: the personalized book sample matters more than the illustration-style gallery — show it higher; gallery drops lower.) Keep both blocks otherwise unchanged. Confirm the `#sample` anchor still works and the page builds.

## 2) Landing: `.sample-book-illustration` — strip the frame (both files)
`app/landing/landing.css` AND `public/CSS/landing.css`, the base `.sample-book-illustration` rule should be exactly:
```css
.sample-book-illustration {
  margin: 0 auto;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
```
(Remove `border-radius: 24px;`, `background: #f7f4fb;`, `box-shadow: …;`.) Leave `.sample-book-illustration img` and any desktop `@media` override as-is unless they re-add a frame — if a `@media` block re-adds border-radius/background/box-shadow to `.sample-book-illustration`, strip those too.

## 3) Category cards: mobile/desktop image sizing (both files)
`app/category-challenge-card.css` AND `public/CSS/wizard.css` — identical in both:
- base (mobile) `.mvp-challenge-card-img`: `object-position: center; transform: scale(1.1) translateY(3%); transform-origin: center bottom;`
- `@media (min-width: 768px) .mvp-challenge-grid .mvp-challenge-card-img`: `object-position: center; transform: scale(1.04) translateY(3%); transform-origin: center bottom;`
- `.mvp-challenge-card-img-wrap` height: `240px` (base), `320px` (desktop).
- `.mvp-challenge-card` min-height: `320px` (base), `420px` (desktop).
In `wizard.css` ensure the wrap has the `height` and a `@media (min-width:768px)` presence block exists (add if missing) so the wizard renders identical to the home page.

## Commit + push (PowerShell: `;` not `&&`; explicit pathspecs)
```
git add app/landing/landing-page.tsx app/landing/landing.css public/CSS/landing.css
git commit -m "feat(landing): show book-sample above gallery; strip sample-book frame"
git add app/category-challenge-card.css public/CSS/wizard.css
git commit -m "style(home): category-card image sizing (mobile/desktop scale + wrap/card heights)"
npm run check
git push
```

## Acceptance
- Landing renders sample-book section above the gallery; sample image has no rounded frame/shadow; category cards sized per above on both mobile + desktop, wizard identical. `npm run check` green; pushed. Report `ai-roundtable/0060_cursor_ui-batch-result.md`.
