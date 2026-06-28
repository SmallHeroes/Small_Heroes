# Diverse identity-calibration — human verdict + spend ledger

The `outputs/diverse-calibration/` artifacts are gitignored (URLs + the WEAK palette-histogram score only).
This tracked file is the authoritative HUMAN record.

## Hard-pair front-load — HUMAN verdict (Guy, 2026-06-28)

Synthetic photo → Stage-0 Method-B canonical watercolour anchor for the 8 hard-pair children (`c01`–`c08`).
The `0.16–0.41` resemblance numbers are the palette-histogram, **NOT an identity measure — not used in any decision.**

- **pA `c01/c02`** — PASS, hard + good. Similar-but-distinct identities.
- **pB `c03/c04`** — PASS with caution. `c04` reads younger in the anchor + some wardrobe drift → a MEDIUM pair, not very hard.
- **pC `c05/c06`** — PASS. The hardest + highest-quality pair.
- **pD `c07/c08`** — PASS, but easier (tone / hair / anchor-composition differences).
- All 8: `photo→anchor` identity held sufficiently. **No re-render needed.**

**Gate result: the generator CAN make distinct-but-similar diverse hard pairs → the ruler is buildable.**

## Approved sequence (Codex/Guy — supersedes "render all 52 in one batch")

1. ✅ Push `11294617` (front-load harness) to origin.
2. Build the anchor→page harness with NO render; `npm run check` green.
3. Harness supports `CALIB_SPLIT=dev|holdout` (DEFAULT `dev`); holdout requires an explicit unlock env.
4. Cumulative ledger (below).
5. Render the DEV half ONLY: ≤26 LOW calls — **separate Guy spend approval required.**
6. Blind ground-truth + whole-scene baseline + crop development on DEV ONLY.
7. Freeze crop, thresholds, model, prompt.
8. THEN request separate approval for the 26 holdout calls + open the holdout ONCE.

## Harness requirements (Codex)

- Expression page MUST be rendered with the expression anchor as the ACTUAL first reference (not an unused anchor).
- Persist per page: model, quality, prompt, refs, and their order.
- Hard-pair negatives: SAME scene + SAME wardrobe (so the judge can't separate by scene/clothes).
- Generator drift is rejected at GT; replacement ONLY from the remaining budget.

## Spend ledger (hard cap 72 LOW image-gen)

| phase | calls | cumulative | note |
|---|---|---|---|
| hard-pair front-load (c01–c08 photos + anchors) | 16 | **16 / 72** | DONE — verdict above |
| DEV half (c09–c12 photo+anchor, c01+c09 expression anchors, 16 DEV pages) | 26 | **42 / 72** | DONE — 16 pages + 6 anchors, no errors; c01/c09 page-2 used the expression anchor; spot-checked c01 (canonical + expression) + c09 (fresh) hold identity |
| HOLDOUT half (c13–c16 photo+anchor, c05+c13 expression anchors, 16 holdout pages) | ≤26 | 68 / 72 (planned) | LOCKED until DEV blind-GT + baseline + crop frozen + separate approval |

## DEV render DONE (2026-06-28) — next: blind GT → baseline → crop (DEV only)

DEV assets in `outputs/diverse-calibration/dev/assets/` (16 pages + anchors) + `render-ledger.json`
(per-page model/quality/prompt/refs+order). Next phase (no holdout):
1. Per-page BLIND ground-truth (eyeball 16 pages IDs-hidden; reject/replace drift from the 4-call reserve).
2. Sentinel regression (3 real children).
3. Whole-scene baseline on DEV (vision scoring → the 4 report buckets).
4. Build + decide crop on DEV; freeze crop/thresholds/model/prompt. THEN unlock holdout (separate approval).

Hard-pair anchors (c01–c08) are REUSED (front-load) — never re-rendered.
