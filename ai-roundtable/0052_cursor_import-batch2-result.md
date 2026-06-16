TYPE: RESULT
From: cursor
To: roundtable
Re: 0051 — batch-2 import + matrix flips + publish dini copper sheets
Date: 2026-06-16

# 0052 — Batch-2 import (3 stories) + matrix flips + dini sheet publish

## Commit
- **SHA:** `3976379f3f552b9b5a44fa25c3071829ed43a63b`
- **Branch:** `feat/chunked-generation` (pushed)
- **Message:** `feat(bank): batch-2 import (dini bedtime, anat fantasy, bunny fantasy) + matrix flips -> 14 sellable; publish dini copper sheets`

## A) Imported stories

| # | bank file | companion · direction · category | pages | storyId |
|---|-----------|----------------------------------|-------|---------|
| 1 | `dragon_dini_bedtime.md` | dragon_dini · bedtime · NEW_SIBLING | 8 | `golden-dragon_dini_bedtime-2026-06-16` |
| 2 | `panda_anat_fantasy.md` | panda_anat · fantasy · SOCIAL | 16 | `golden-panda_anat_fantasy-2026-06-16` |
| 3 | `bunny_ometz_fantasy.md` | bunny_ometz · fantasy · MEDICAL_PROCEDURE | 16 | `golden-bunny_ometz_fantasy-2026-06-16` |

Each has `.import.json` (`approvedBy: Guy`, `approvedAt: 2026-06-16T20:00:00+03:00`).

**Sources:** `story-pipeline/02_prompts/drafts/*__*.bank.md` via `scripts/import-v3-approved-story.ts`. Header comment block stripped; prose/chips unchanged.

**Validators:** all three **PASS** (gender chips, page-count = beats, format, companion-speech, personalization gate, artifact/slash scans).

## B) Matrix flips (`backend/config/mvp-story-matrix.ts`)
- `NEW_SIBLING.directions.bedtime`: `missing` → `approved_v3` (**NEW_SIBLING 3/3**)
- `SOCIAL.directions.fantasy`: `missing` → `approved_v3` (**SOCIAL 3/3**)
- `MEDICAL_PROCEDURE.directions.fantasy`: `missing` → `approved_v3` (**MEDICAL 3/3**)

## C) Dini copper sheets published
- Command: `generate-companion-sheet.ts dragon_dini --publish-only`
- **6 views** written to `public/companions/dragon_dini/style01-sheets/`: front, 3-4, side, back, happy, theme
- **manifest.json** updated: `referenceJpg` → `/companions/dragon_dini/style01-sheets/front.png` (replaces stale green jpg path)
- Quality: LOW audition (Guy-approved as-is)

## Checks
| Gate | Result |
|------|--------|
| `npm run check` | **509/509 green** |
| `ENABLE_V3_APPROVED_BANK=true npm run release-check` | **PASS** — sellable **14/18** (was **11/18**, **+3**) |

**Sidecar gate:** release-check did **not** require image sidecars. No sidecars added, no renders.

## Sellable snapshot (v3 flag ON) — 4 complete categories
| Category | bedtime | adventure | fantasy |
|----------|---------|-----------|---------|
| NIGHT_FEAR (fox) | approved | approved_v3 | approved_v3 |
| SOCIAL (panda) | approved_v3 | approved | **approved_v3** ← new |
| MEDICAL (bunny) | approved_v3 | approved | **approved_v3** ← new |
| NEW_SIBLING (dragon) | **approved_v3** ← new | approved_v3 | approved |
| TRANSITION (koko) | missing | approved | missing |
| ANGER (lion) | missing | approved | missing |

## Code included in commit
- `lib/companions.ts` — copper-orange `visualDescription` for dragon_dini
- `lib/generation-pipeline/companion-character-sheet.ts` — dini sheet prompts + canon-redo `referenceJpg`
