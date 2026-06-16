TYPE: RESULT
From: cursor
To: roundtable
Re: 0049 — import 3 golden stories + matrix flips
Date: 2026-06-16

# 0050 — Import 3 golden stories → v3-approved bank + matrix flips

## Commit
- **SHA:** `6707c32e6417a86dd6b540fd42d1b4f2a170cdfb`
- **Branch:** `feat/chunked-generation` (pushed)
- **Message:** `feat(bank): import 3 golden stories (dini adventure, uri fantasy, anat bedtime) + matrix flips -> +3 sellable`

## Imported stories

| # | bank file | companion · direction · category | pages | storyId |
|---|-----------|----------------------------------|-------|---------|
| 1 | `dragon_dini_adventure.md` | dragon_dini · adventure · NEW_SIBLING | 12 | `golden-dragon_dini_adventure-2026-06-16` |
| 2 | `fox_uri_fantasy.md` | fox_uri · fantasy · NIGHT_FEAR | 16 | `golden-fox_uri_fantasy-2026-06-16` |
| 3 | `panda_anat_bedtime.md` | panda_anat · bedtime · SOCIAL | 8 | `golden-panda_anat_bedtime-2026-06-16` |

Each has a matching `.import.json` (`approvedBy: Guy`, `approvedAt: 2026-06-16T15:00:00+03:00`).

**Sources:** `story-pipeline/02_prompts/drafts/*__*.bank.md` via `scripts/import-v3-approved-story.ts` (temp run dirs under `outputs/story-pipeline-import-runs/golden-*-2026-06-16/`). Prose/chips unchanged; `# Story:` / Source / Status / CANON header stripped; `# Story: golden pipeline import` prepended before frontmatter for traceability injection.

## Validators
All three **PASS** (gender chips, page-count = beats, format, companion-speech, personalization gate, artifact scans). No prose patches.

## Matrix flips (`backend/config/mvp-story-matrix.ts`)
- `NEW_SIBLING.directions.adventure`: `missing` → `approved_v3`
- `NIGHT_FEAR.directions.fantasy`: `missing` → `approved_v3` (NIGHT_FEAR now **3/3** sellable with flag ON)
- `SOCIAL.directions.bedtime`: `missing` → `approved_v3`

## Checks
| Gate | Result |
|------|--------|
| `npm run check` | **509/509 green** |
| `ENABLE_V3_APPROVED_BANK=true npm run release-check` | **PASS** — sellable **11/18** (was **8/18**, **+3**) |

**Sidecar gate:** release-check did **not** require image sidecars (`.location-bible.json` / `.shot-plan.json` / `.zone-sheets`) for these slots. No sidecars added.

## Out of scope (confirmed not done)
- No image sidecars, no renders, no HIGH
- `lib/qa-console-run.ts` skip flags, `scripts/run-0046-*`, `scripts/run-0048-*`, outputs left uncommitted

## Sellable snapshot (v3 flag ON)
| Category | bedtime | adventure | fantasy |
|----------|---------|-----------|---------|
| NIGHT_FEAR (fox) | approved | approved_v3 | **approved_v3** ← new |
| SOCIAL (panda) | **approved_v3** ← new | approved | missing |
| SEPARATION (bunny) | approved_v3 | approved | missing |
| NEW_SIBLING (dragon) | missing | **approved_v3** ← new | approved |
