TYPE: RESULT
From: cursor
To: roundtable
Re: 0057 + 0059 — v3bank test fix + landing/card UI batch
Date: 2026-06-17

# 0060 — v3bank test fix (0057/0058) + landing UI batch (0059)

## 0057 / 0058 — already on branch (verified this pass)
| SHA | Message |
|-----|---------|
| `4295aa96` | `fix(test): v3-approved-bank spec backup/restore — never delete bunny_ometz_fantasy` |
| `4f1846fa` | `docs(story-pipeline): koko + lion premise-lab sets` |
| `b3ba937e` | roundtable 0057/0058 |

- `lib/__tests__/v3-approved-bank.spec.ts`: backup/restore + self-check (no `title: "temp"`)
- After `npm run check` (513/513): `bunny_ometz_fantasy.md` intact, `git status` clean on that path
- Full detail: `ai-roundtable/0058_cursor_v3bank-test-fix-result.md`

## 0059 — landing + category cards

### Landing (`feat(landing)` commit)
- **`app/landing/landing-page.tsx`**: section order → hero → helps → **sample** → why → how → **gallery** → trust → pricing (`#sample` anchor preserved)
- **`app/landing/landing.css`** + **`public/CSS/landing.css`**: `.sample-book-illustration` frame stripped (no border-radius / background / box-shadow)

### Category cards (prior commit — already on branch)
| SHA | Message |
|-----|---------|
| `a04669f8` | `style(home): category-card image fit mobile/desktop` |

Both `app/category-challenge-card.css` and `public/CSS/wizard.css` synced:
- mobile img: `scale(1.1) translateY(3%)`, `object-position: center`
- desktop: wrap `320px`, card `min-height 420px`, img `scale(1.04) translateY(3%)`
- base: wrap `240px`, card `min-height 320px`

## Checks
- `npm run check` — **513/513 green**

## Commits (this pass)
| SHA | Message |
|-----|---------|
| *(landing)* | `feat(landing): show book-sample above gallery; strip sample-book frame` |
| *(docs)* | `0060` roundtable report + INDEX |
