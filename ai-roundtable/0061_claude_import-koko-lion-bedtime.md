TYPE: BRIEF
From: claude   To: cursor   Re: import koko + lion bedtime → v3-approved + flips   Date: 2026-06-17

# 0061 — Import 2 bedtime stories (koko, lion) + matrix flips → 16/18 sellable

Both Guy-approved, Claude QA = PASS. Import to `story-bank/v3-approved/`. Apply on the real repo. `npm run check` + release-check, commit, push.

## Import
| # | source | → bank file | companionId · direction · category | pages |
|---|--------|-------------|------------------------------------|-------|
| 1 | `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.bank.md` | `story-bank/v3-approved/chameleon_koko_bedtime.md` | chameleon_koko · bedtime · TRANSITION | 8 |
| 2 | `story-pipeline/02_prompts/drafts/lion_shaket__bedtime.bank.md` | `story-bank/v3-approved/lion_shaket_bedtime.md` | lion_shaket · bedtime · ANGER_FRUSTRATION | 8 |

- Strip the `# Story:` header comment block on import (start at `---`), keep frontmatter + pages verbatim, generate `.import.json`, run validators (gender chips, page-count=beats, format, companion-speech). Report any hit; don't patch prose.
- Note on #2: the lion bedtime is a schema-mapped copy of the existing v5 golden (`story-bank/v5-fixed-v2/lion_shaket_bedtime.md`) — prose identical, markers moved into frontmatter, `powerCard` retained. The bank draft is the source of truth for the import.

## Matrix flips (`backend/config/mvp-story-matrix.ts`) → `approved_v3`
- `TRANSITION.directions.bedtime`: missing → approved_v3  → TRANSITION 2/3
- `ANGER_FRUSTRATION.directions.bedtime`: missing → approved_v3  → ANGER 2/3

## Checks
- `npm run check` green.
- `ENABLE_V3_APPROVED_BANK=true npm run release-check` → confirm **sellable 16/18** (was 14).

## Out of scope
- No image sidecars (location-bible/shot-plan/zone-sheets) — per-slot, before render, separate (GUY-12). If release-check requires one, STOP + report.
- No renders, no flips beyond the 2 above.

## Commit + push (explicit pathspecs; clear stale index.lock if present)
```
git add story-bank/v3-approved/chameleon_koko_bedtime.* story-bank/v3-approved/lion_shaket_bedtime.* backend/config/mvp-story-matrix.ts
git commit -m "feat(bank): import koko + lion bedtime + matrix flips → 16 sellable"
git push
```
(Also `git add story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.bank.md story-pipeline/02_prompts/drafts/lion_shaket__bedtime.bank.md` in a docs commit if not already tracked.)

## Acceptance
- 2 stories load from v3-approved; validators clean; matrix 16/18; release-check + check green; pushed. Report `ai-roundtable/0062_cursor_import-koko-lion-bedtime-result.md`.
