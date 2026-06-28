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

## Whole-scene baseline on DEV (2026-06-28) — DECISIVE: hard negatives 100 % false-pass

Scored 26 anchor→page pairs with the CURRENT gate (`checkChildIdentityViaVision` + asymmetric policy
same ≥ 0.95 / different ≥ 0.90). NO image renders; **26 vision-judge calls** (within the approved judge
budget). Image-gen spend UNCHANGED at **42 / 72**. Artifact: `outputs/diverse-calibration/dev/baseline-result.json`.

| bucket | n | expect | correct | not_measurable | wrong |
|---|---|---|---|---|---|
| clear_positive (page-1) | 8 | pass | 8 | 0 | 0 |
| stress_positive (page-2) | 6 | pass | 6 | 0 | 0 |
| stress_positive_expression (c01,c09 page-2) | 2 | pass | 2 | 0 | 0 |
| hard_negative (pA/pB cross, page-1 only) | 4 | fail | **0** | 0 | **4 FALSE-PASS** |
| easy_negative (fixed balanced sample, page-1) | 6 | fail | 6 | 0 | 0 |

**Decisive finding:** every positive AND every hard negative scored the IDENTICAL `same@0.95`; every easy
negative scored `different@1.00`. The whole-scene judge is effectively binary and CANNOT resolve hard
lookalikes when scene + wardrobe + style are matched (the controlled page-1 scene). 100 % false-pass on
the hard negatives ⇒ **crop+align is NECESSARY** as the discriminating instrument — this matrix is the
baseline crop must beat. Positives + easy negatives are already clean, so crop must hold those while
lifting hard-negative recall off the floor.

### Three no-spend fixes folded in (Codex)
1. **Stress re-tag.** `effectiveStress` (split harness) swapped only the stress NAME, not the DESCRIPTION,
   so hard-pair page-2 scenes followed the per-INDEX description. Fixed for the HOLDOUT (full clause swap).
   DEV pages keep their actual per-index stress — eyeball-confirmed (c02 = occlusion): c01/c09 = profile,
   c02/c10 = occlusion, c03/c11 = multi_child, c04/c12 = small_target. Baseline uses these actual tags.
2. **Ledger merge.** c01's 3 records (overwritten after the smoke) merged back into `render-ledger.json`
   (page URLs HTTP-200 verified; expression-anchor URL not recovered from the log — non-blocking, baseline
   scores the canonical anchor).
3. **Extraneous entity = noise.** Any unexpected creature on a page is `extraneous_entity`, NOT an identity
   failure → this set is explicitly NOT a valid proof of the entity gate.

STOPPED before crop (Codex). Holdout LOCKED.
