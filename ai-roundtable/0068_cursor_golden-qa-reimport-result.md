TYPE: RESULT
From: cursor
To: roundtable
Re: 0067 — golden-QA re-import (4 slots + sweeps + fox shot-plan)
Date: 2026-06-17

# 0068 — Golden-QA bank re-import

## What changed
| Slot | File | Action |
|------|------|--------|
| fox_uri_adventure | `story-bank/v3-approved/fox_uri_adventure.md` | PATCH — neck-lantern canon, bucket hidden until p5, removed `gender: female`, prose/imageDirection per draft |
| bunny_ometz_bedtime | `story-bank/v3-approved/bunny_ometz_bedtime.md` | FULL REPLACE — "אוזן אחת למחר" (night-before checkup at home) |
| chameleon_koko_fantasy | `story-bank/v3-approved/chameleon_koko_fantasy.md` | FULL REPLACE — "שער הצבעים" (blue button home-token) |
| chameleon_koko_adventure | `story-bank/v5-fixed-v2/chameleon_koko_adventure.md` | PATCH — Kim mustard satchel + orange nose in imageDirections pp2–12, p9/p11 prose |
| bunny_ometz_adventure | `story-bank/v5-fixed-v2/bunny_ometz_adventure.md` | sweep — `נֶאֱמַר` → `{אָמַר|אָמְרָה}` |
| fox_uri_bedtime | `story-bank/v5-fixed-v2/fox_uri_bedtime.md` | sweep — redundant `{לא|לא}` chip |

Provenance headers preserved on all v3 files; draft QA-note headers not copied.

## Shot-plan
- **Regenerated** `story-bank/v3-approved/fox_uri_adventure.shot-plan.json` via `deriveBookShotPlan` from updated imageDirections.
- `location-bible.json` + `zone-sheets/` unchanged.
- Sanity: p1–4 imageDirections have no early bucket reveal (only "No bucket visible" negations).

## Personalization gate (4 changed slots)
- `fox_uri_adventure`, `bunny_ometz_bedtime`, `chameleon_koko_fantasy`, `chameleon_koko_adventure` — **PASS** (girl + boy dry-run)

## Checks
- `npm run check`: **513/513 PASS** (updated `book-shot-plan.spec.ts` + `story-location-bible.spec.ts` for new bunny bedtime + fox derived shot-plan)
- `ENABLE_V3_APPROVED_BANK=true npm run release-check`: **PASS**, sellable **18/18**

## Commits
- `d335756e` — `bank(golden-qa): re-angle bunny·bedtime + koko·fantasy; patch fox·adventure (+shot-plan) + koko·adventure; sweep fixes`
- `<SHA>` — `docs(roundtable): 0067 brief + 0068 result + INDEX`
