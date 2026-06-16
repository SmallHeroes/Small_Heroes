TYPE: BRIEF
From: claude   To: cursor   Re: import batch-2 (3 stories) + flips + publish dini sheets   Date: 2026-06-16

# 0051 — Import 3 golden stories + matrix flips + publish dini copper sheets

Three more story-pipeline stories, Guy-approved, Claude QA = PASS. Plus: publish the dini copper-orange sheet regen (LOW, Guy-approved as-is). One consolidated commit.

## A) Import 3 stories
| # | source | → bank file | companionId · direction · category | pages |
|---|--------|-------------|------------------------------------|-------|
| 1 | `story-pipeline/02_prompts/drafts/dragon_dini__bedtime.bank.md` | `story-bank/v3-approved/dragon_dini_bedtime.md` | dragon_dini · bedtime · NEW_SIBLING | 8 |
| 2 | `story-pipeline/02_prompts/drafts/panda_anat__fantasy.bank.md` | `story-bank/v3-approved/panda_anat_fantasy.md` | panda_anat · fantasy · SOCIAL | 16 |
| 3 | `story-pipeline/02_prompts/drafts/bunny_ometz__fantasy.bank.md` | `story-bank/v3-approved/bunny_ometz_fantasy.md` | bunny_ometz · fantasy · MEDICAL_PROCEDURE | 16 |

- Strip the `# Story:` header comment block on import (start at `---` frontmatter), keep frontmatter + pages verbatim. Generate `.import.json` via the existing pipeline; let validators run (gender chips, page-count=beats, format, companion-speech). Report any hit — do NOT patch prose.

## B) Matrix flips (`backend/config/mvp-story-matrix.ts`) → `approved_v3`
- `NEW_SIBLING.directions.bedtime`: missing → approved_v3  → **NEW_SIBLING 3/3**
- `SOCIAL.directions.fantasy`: missing → approved_v3  → **SOCIAL 3/3**
- `MEDICAL_PROCEDURE.directions.fantasy`: missing → approved_v3  → **MEDICAL 3/3**

## C) Publish dini copper sheets (LOW, as-is)
- `npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-companion-sheet.ts dragon_dini --publish-only`
- This replaces the stale green files in `public/companions/dragon_dini/style01-sheets/*` with the copper-orange LOW audition (6 views) + manifest + referenceJpg. Confirm front/3-4/side/back/happy/theme + manifest written.

## Checks
- `npm run check` (tsc + vitest) → green.
- `ENABLE_V3_APPROVED_BANK=true npm run release-check` → confirm **sellable 14/18** (was 11), 4 complete categories (NIGHT_FEAR, NEW_SIBLING, SOCIAL, MEDICAL).

## Out of scope
- No image sidecars (location-bible/shot-plan/zone-sheets) — per-slot, before render, separate (GUY-12). If release-check requires one, STOP + report.
- No renders, no HIGH, no flips beyond the 3 above.

## Commit (explicit pathspecs only — EOL landmine, never `git add -A`; clear stale `.git/index.lock` if present)
```
git add story-bank/v3-approved/dragon_dini_bedtime.* story-bank/v3-approved/panda_anat_fantasy.* story-bank/v3-approved/bunny_ometz_fantasy.* backend/config/mvp-story-matrix.ts lib/companions.ts lib/generation-pipeline/companion-character-sheet.ts public/companions/dragon_dini/style01-sheets/
git commit -m "feat(bank): batch-2 import (dini bedtime, anat fantasy, bunny fantasy) + matrix flips → 14 sellable; publish dini copper sheets"
git push
```
(If the dini sheet code touched other files, add them by explicit path too — check `git status` first.)

## Acceptance
- 3 stories load from v3-approved; validators clean. Matrix shows 14 sellable, release-check green, npm run check green. dini sheets in `public/` are copper (not green).
- Write result as `ai-roundtable/0052_cursor_import-batch2-result.md` with INDEX line (commit SHA + sellable before/after + dini publish confirm).
