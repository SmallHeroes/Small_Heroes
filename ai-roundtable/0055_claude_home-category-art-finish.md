TYPE: BRIEF
From: claude   To: cursor   Re: finish home-page category art (.tsx didn't reach working tree) + residual commits   Date: 2026-06-17

# 0055 — Finish home-page category-art swap + commit residuals

Context: the CSS half committed (eeb1a454, pushed) but the **`.tsx` mapping never reached Guy's working tree** (a Cowork→Windows sync gap — `git add app/category-challenge-card.tsx` staged nothing). Apply everything below **directly on the real repo** (don't assume prior edits exist). `npm run check` is green at 512.

## 1) app/category-challenge-card.tsx — add the category→art map + use it
If `CATEGORY_CARD_IMAGE` is NOT already in the file, add it right after the import:
```tsx
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';

/** Home/start category-card art per MVP category (public/Images/Categories). */
const CATEGORY_CARD_IMAGE: Record<string, string> = {
  NIGHT_FEAR: '/Images/Categories/StartUri.webp',
  SOCIAL: '/Images/Categories/StartAnat.webp',
  MEDICAL_PROCEDURE: '/Images/Categories/StartBuny.webp',
  NEW_SIBLING: '/Images/Categories/StartDuni.webp',
  TRANSITION: '/Images/Categories/StartKim.webp',
  ANGER_FRUSTRATION: '/Images/Categories/StartLeo.webp',
};
```
Then change the image source line from `companion.image` to the mapped value (fallback preserved):
```tsx
  const cardImageSrc = CATEGORY_CARD_IMAGE[slot.category] ?? companion.image;
  const imageBlock = cardImageSrc ? (
    <img className="mvp-challenge-card-img" src={cardImageSrc} alt="" loading="lazy" />
  ) : (
    <span className="mvp-challenge-card-img mvp-challenge-card-img--placeholder" aria-hidden="true" />
  );
```
(`slot.category` is the uppercase MvpCategory key — verified matches the map.)

## 2) CSS — set the final `.mvp-challenge-card-img` in BOTH files (keep in sync)
`app/category-challenge-card.css` AND `public/CSS/wizard.css`, the `.mvp-challenge-card-img` rule should end with:
```css
  object-fit: contain;
  object-position: center bottom;
  transform: scale(1.04) translateY(8%);
  transform-origin: center bottom;
```
(`translateY %` = the bottom-gap knob: higher % pushes the character down, clipping the empty cream margin under the feet. wrap bg is already cream `#fdf8ee` so `contain` letterboxing is invisible. Do NOT use `cover` — it crops heads/feet.)

## 3) Categories images
`git add public/Images/Categories/` — if already tracked, no-op; if untracked, include the 6 `Start*.webp`.

## 4) Residual commits Guy approved (separate commits by concern)
- Reader/cover binaries (used in reader): `public/Images/Book.webp public/Images/HeroIllustrated.png public/Images/MaskOnBook.png public/Images/OpenBook.png`
- `story-pipeline/` (all drafts/premises/sheets)
- `HANDOFF_BRIEF_2026-06-14.md`

## Commit + push (explicit pathspecs; clear stale index.lock if any)
```
git add app/category-challenge-card.tsx public/Images/Categories/
git commit -m "feat(home): map category cards to Start* companion art"

git add app/category-challenge-card.css public/CSS/wizard.css
git commit -m "style(home): category-card image fit (scale + translateY bottom-gap)"

git add public/Images/Book.webp public/Images/HeroIllustrated.png public/Images/MaskOnBook.png public/Images/OpenBook.png
git commit -m "chore(assets): update reader/cover images"

git add story-pipeline/ HANDOFF_BRIEF_2026-06-14.md
git commit -m "docs: story-pipeline drafts/premises/sheets + handoff brief"

npm run check
git push
```

## Acceptance
- `app/category-challenge-card.tsx` contains `CATEGORY_CARD_IMAGE` and uses it.
- Home page (`/`) and `/start` show the 6 Start* images on the category cards; bottom gap reasonable.
- `npm run check` 512 green; branch pushed.
- Write result as `ai-roundtable/0056_cursor_home-category-art-result.md`.
