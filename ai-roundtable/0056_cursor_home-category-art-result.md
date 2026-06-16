TYPE: RESULT
From: cursor
To: roundtable
Re: 0055 — home category-art finish + residual commits
Date: 2026-06-17

# 0056 — Home category-art swap + residual commits (verified on repo)

## Status
0055 acceptance criteria were **already implemented and pushed** on `feat/chunked-generation` before this pass (Guy local commits). Cursor verified file contents, `npm run check`, and branch sync; added the remaining `HANDOFF_BRIEF` commit + this report.

## Commits (by concern)

| SHA | Message | Files |
|-----|---------|-------|
| `9be66cec` | `feat(home): category cards use Start* companion art (per-category map + fallback)` | `app/category-challenge-card.tsx` + 6× `public/Images/Categories/Start*.webp` |
| `eeb1a454` | `feat(home): category cards use Start* companion art + card image CSS tuning` | `app/category-challenge-card.css`, `public/CSS/wizard.css` |
| `60b8bea1` | `chore(assets): update reader/cover images` | `Book.webp`, `HeroIllustrated.png`, `MaskOnBook.png`, `OpenBook.png` |
| `02564ece` | `docs(story-pipeline): premise sets + bank drafts + dini sheet prompt` | `story-pipeline/02_prompts/drafts/*`, `03_companion_sheets/dragon_dini__sheet_prompt.md` |
| *(this pass)* | `docs: handoff brief 2026-06-14` | `HANDOFF_BRIEF_2026-06-14.md` |

## 1) `category-challenge-card.tsx`
- `CATEGORY_CARD_IMAGE` maps all 6 MVP categories → `/Images/Categories/Start*.webp`
- Image src: `CATEGORY_CARD_IMAGE[slot.category] ?? companion.image` (fallback preserved)

## 2) CSS (both files in sync)
`.mvp-challenge-card-img` in `app/category-challenge-card.css` and `public/CSS/wizard.css`:
- `object-fit: contain; object-position: center bottom;`
- `transform: scale(1.04) translateY(8%); transform-origin: center bottom;`
- Wrap background `#fdf8ee` (letterboxing invisible)

## 3) Categories assets
All 6 `Start*.webp` tracked under `public/Images/Categories/`.

## Checks
- `npm run check` — **512/512 green**
- Branch pushed to `origin/feat/chunked-generation`

## Note
`story-bank/v3-approved/bunny_ometz_fantasy.md` was accidentally deleted locally during triage; restored from HEAD (no content change).
