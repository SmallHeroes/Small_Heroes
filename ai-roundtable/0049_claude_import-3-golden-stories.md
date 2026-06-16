TYPE: BRIEF
From: claude   To: cursor   Re: import 3 QA'd golden stories + matrix flips   Date: 2026-06-16

# 0049 — Import 3 golden-candidate stories into the production bank + flip matrix (+3 sellable)

Three stories drafted in the story-pipeline track, Guy-approved, Claude QA = PASS (schema, gender chips, companion canon, read-aloud, niqqud). Import them into `story-bank/v3-approved/` and make their slots sellable.

## Sources (already in bank format — frontmatter + `--- Page N ---` + prose + imageDirection)
| # | source file | → bank file | companionId · direction · category | pages |
|---|-------------|-------------|------------------------------------|-------|
| 1 | `story-pipeline/02_prompts/drafts/dragon_dini__adventure.bank.md` | `story-bank/v3-approved/dragon_dini_adventure.md` | dragon_dini · adventure · NEW_SIBLING | 12 |
| 2 | `story-pipeline/02_prompts/drafts/fox_uri__fantasy.bank.md` | `story-bank/v3-approved/fox_uri_fantasy.md` | fox_uri · fantasy · NIGHT_FEAR | 16 |
| 3 | `story-pipeline/02_prompts/drafts/panda_anat__bedtime.bank.md` | `story-bank/v3-approved/panda_anat_bedtime.md` | panda_anat · bedtime · SOCIAL | 8 |

> Strip the `# Story:` header comment block + `Source/Status/QA/CANON` lines on import if the bank loader expects the file to start at the `---` frontmatter (match the existing `fox_uri_adventure.md` shape). Keep the frontmatter + pages verbatim. Do NOT rewrite prose or chips — they're QA'd.

## Steps
1. For each story: place the `.md` in `story-bank/v3-approved/` and generate its `.import.json` via the existing import pipeline (same as `fox_uri_adventure.*`). Let the importer's validators run (gender chips, page-count = beats, format, companion-speech). Report any validator hit — do NOT silently patch prose; bounce to me.
2. Flip the matrix in `backend/config/mvp-story-matrix.ts`:
   - `NEW_SIBLING.directions.adventure`: `missing` → `approved_v3`
   - `NIGHT_FEAR.directions.fantasy`: `missing` → `approved_v3`  (this completes NIGHT_FEAR to 3/3)
   - `SOCIAL.directions.bedtime`: `missing` → `approved_v3`
3. `npm run check` (tsc + vitest) → green.
4. `npm run release-check` (with `ENABLE_V3_APPROVED_BANK=true`) → confirm the 3 new slots count as sellable and nothing else regressed.

## Out of scope (do NOT do here)
- **No image sidecars** (`.location-bible.json` / `.shot-plan.json` / `.zone-sheets`) — those are per-slot and come BEFORE first render, tracked separately (Monday "Per-slot location-bible", Linear GUY-12). If `release-check` *requires* a sidecar to pass, STOP and report exactly what's missing rather than fabricating one.
- No renders, no HIGH, no flips beyond the 3 above.

## Commit (explicit pathspecs only — EOL landmine, never `git add -A`)
- If a stale `.git/index.lock` exists, remove it first (it blocked the last round).
- `git add story-bank/v3-approved/dragon_dini_adventure.* story-bank/v3-approved/fox_uri_fantasy.* story-bank/v3-approved/panda_anat_bedtime.* backend/config/mvp-story-matrix.ts`
- `git commit -m "feat(bank): import 3 golden stories (dini adventure, uri fantasy, anat bedtime) + matrix flips → +3 sellable"`
- Push.

## Acceptance
- 3 stories load from the v3-approved bank; validators clean.
- Matrix shows the 3 slots sellable; `release-check` green; `npm run check` green.
- Write result as `ai-roundtable/0050_cursor_import-3-stories-result.md` with an INDEX line (commit SHA + sellable count before/after).
