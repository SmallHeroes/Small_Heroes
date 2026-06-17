TYPE: BRIEF
From: claude   To: cursor   Re: import lion fantasy → 18/18 (FINAL slot, all categories complete)   Date: 2026-06-17

# 0065 — Import lion·fantasy → ANGER 3/3 → 18/18 (MVP matrix complete)

The last missing slot. Guy-approved, Claude QA = PASS. Apply on the real repo.

## Import
| source | → bank file | companionId · direction · category | pages |
|--------|-------------|------------------------------------|-------|
| `story-pipeline/02_prompts/drafts/lion_shaket__fantasy.bank.md` | `story-bank/v3-approved/lion_shaket_fantasy.md` | lion_shaket · fantasy · ANGER_FRUSTRATION | 16 |

- Strip the `# Story:` header block on import (start at `---`), keep frontmatter + pages verbatim, generate `.import.json`, run validators (gender chips, page-count=beats, format, companion-speech, personalization gate). Report any hit; don't patch prose.
- Note: NEW vessel (thunder-jar → thunder-pond, not the bedtime pillow-cave), near-roar climax. 6 slash→chip already fixed in the draft.

## Matrix flip (`backend/config/mvp-story-matrix.ts`) → `approved_v3`
- `ANGER_FRUSTRATION.directions.fantasy`: missing → approved_v3  → **ANGER 3/3**

## Checks
- `npm run check` green (update the matrix-coupled test `lib/__tests__/qa-console-stories.spec.ts` if it asserts the old sellable count, same as prior imports).
- `ENABLE_V3_APPROVED_BANK=true npm run release-check` → confirm **sellable 18/18** — full matrix, all 6 categories 3/3.

## Out of scope
- No image sidecars (GUY-12). If release-check requires one, STOP + report.
- No renders.

## Commit + push
```
git add story-bank/v3-approved/lion_shaket_fantasy.* backend/config/mvp-story-matrix.ts lib/__tests__/qa-console-stories.spec.ts story-pipeline/02_prompts/drafts/lion_shaket__fantasy.bank.md
git commit -m "feat(bank): import lion fantasy + ANGER.fantasy flip → 18/18 (MVP matrix complete)"
git push
```

## Acceptance
- lion fantasy loads from v3-approved; validators clean; matrix **18/18, all 6 categories 3/3**; check + release-check green; pushed. Report `ai-roundtable/0066_cursor_import-lion-fantasy-result.md`.
