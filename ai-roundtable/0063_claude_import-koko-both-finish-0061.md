TYPE: BRIEF
From: claude   To: cursor   Re: finish 0061 + import koko bedtime (fixed) + koko fantasy → 17/18   Date: 2026-06-17

# 0063 — Complete the import: koko bedtime (איתי-fixed) + koko fantasy + lion bedtime flip → 17/18

Supersedes the unfinished part of 0061. lion_shaket_bedtime is already imported (in `story-bank/v3-approved/`), it only needs its matrix flip + commit. Apply on the real repo.

## 0) Apply the koko·bedtime text fix (the personalization-gate blocker)
"איתי" was flagged as a hardcoded protagonist name (it's the word "with me", but also the name Itai). In `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.bank.md` (and re-import from it):
- title: `הכחול שבא איתי` → `הכחול שהבאתי`
- page 4: `זה בא איתי.` → `את זה הבאתי מהבית.`
(Claude already edited the draft, but verify the file on disk contains these — Cowork sync is unreliable; if not, apply them.)

## 1) Import 2 koko stories
| # | source | → bank file | companionId · direction · category | pages |
|---|--------|-------------|------------------------------------|-------|
| 1 | `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.bank.md` | `story-bank/v3-approved/chameleon_koko_bedtime.md` | chameleon_koko · bedtime · TRANSITION | 8 |
| 2 | `story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.bank.md` | `story-bank/v3-approved/chameleon_koko_fantasy.md` | chameleon_koko · fantasy · TRANSITION | 16 |

- Strip the `# Story:` header block on import (start at `---`), keep frontmatter + pages verbatim, generate `.import.json`, run validators (gender chips, page-count=beats, format, companion-speech, **personalization gate** — must pass now). Report any hit; don't patch prose.
- koko·fantasy uses a "גולה כחולה" (blue marble) home-token (Guy-approved, differentiated from the bedtime's blue curtain swatch). No "איתי/איתך" remain.

## 2) Matrix flips (`backend/config/mvp-story-matrix.ts`) → `approved_v3`
- `TRANSITION.directions.bedtime`: missing → approved_v3
- `TRANSITION.directions.fantasy`: missing → approved_v3  → **TRANSITION 3/3**
- `ANGER_FRUSTRATION.directions.bedtime`: missing → approved_v3  (lion bedtime, already imported) → ANGER 2/3

## Checks
- `npm run check` green.
- `ENABLE_V3_APPROVED_BANK=true npm run release-check` → confirm **sellable 17/18** (was 14). Only ANGER.fantasy (lion) remains missing.

## Out of scope
- No image sidecars (GUY-12). If release-check requires one, STOP + report.
- No renders.

## Commit + push (explicit pathspecs)
```
git add story-bank/v3-approved/chameleon_koko_bedtime.* story-bank/v3-approved/chameleon_koko_fantasy.* backend/config/mvp-story-matrix.ts story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.bank.md story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.bank.md
git commit -m "feat(bank): import koko bedtime+fantasy (איתי fix, marble token) + flips → 17/18 (TRANSITION 3/3, ANGER bedtime)"
git push
```

## Acceptance
- koko bedtime + fantasy load from v3-approved; validators clean (personalization gate passes); matrix 17/18; check + release-check green; pushed. Report `ai-roundtable/0064_cursor_import-koko-both-result.md`.
