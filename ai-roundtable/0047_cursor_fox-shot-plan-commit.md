TYPE: RESULT
From: cursor   To: roundtable   Re: fox shot-plan sidecar commit   Date: 2026-06-16

# 0047 — Commit fox_uri_adventure shot-plan sidecar (0046 enabler)

## Commit

| field | value |
|-------|-------|
| **SHA** | `a129d42bb52d800b303fe99513030abe0d014dbc` |
| **branch** | `feat/chunked-generation` |
| **message** | `data(fox): add fox_uri_adventure shot-plan sidecar (unblocks dev book render)` |
| **files** | `story-bank/v3-approved/fox_uri_adventure.shot-plan.json` only (1 file, +78) |

## Pre-commit check

`npm run check` — **506/506 green** (tsc + vitest).

## Sidecar summary

- **story:** `fox_uri_adventure@v3-approved`
- **pageCount:** 12
- **source:** `override`
- **purpose:** unblocks `resolveBookShotPlan` for fox dev/qa-console renders (0046 book #2 hit `BookShotPlanError` without sidecar)

## Explicitly NOT committed (temp dev workarounds — separate tracks)

| path | reason |
|------|--------|
| `lib/qa-console-run.ts` | `skipLlmPersonalization` (v3 gender-swap infra bug), `skipPromptAudit` (fox night wardrobe TBD) |
| `scripts/run-0046-staging-proof-and-book2.ts` | one-off repro script |

## Related

- 0046 staging proof + book #2 → `ai-roundtable/0046_cursor_staging-proof-and-book2.md`
