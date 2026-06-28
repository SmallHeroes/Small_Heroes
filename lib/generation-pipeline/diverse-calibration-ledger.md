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

## Crop+align vs whole-scene on DEV (2026-06-28) — crop INSUFFICIENT; the JUDGE is the bottleneck

FAIR head detector (vision-LLM, **blind to the reference** → physically cannot pick the best-match face; picks
the protagonist by prominence; ambiguity/failure → `not_measurable`, never whole-scene auto-pass) + sharp
cropper (square head incl hair/ears/chin; eye-level alignment ONLY when frontal + reliable, never force-distorts
a profile). Head-to-head on the SAME 26 pairs, SAME judge/prompt/**FIXED** thresholds — only the INPUT changed
(whole image vs head crop). NO image renders; detections cached; **x3 per hard direction in both arms**.
Artifact: `outputs/diverse-calibration/dev/crop-vs-wholescene-result.json` (full rows: actual model, verdict
reason, judge + detector prompt versions, run index, per-image detector pose/conf/aligned).

| bucket | whole-scene | crop+align |
|---|---|---|
| clear positives (8) | 8 pass | 8 pass |
| stress positives (8) | 8 pass | 6 pass + 2 not_measurable (c10 occlusion, c12 small-target) |
| easy negatives (6) | 6 fail | 6 fail |
| hard negatives (4 dir × 3 = 12) | 0 fail / **12 FALSE-PASS** | 0 fail / **12 FALSE-PASS** |

Bar: clear ✓ · stress ✓ · easy ✓ · hard-neg ZERO-auto-pass ✗ (12/12 pass) · hard ≥3/4 majority-fail ✗ (0/4).
**BAR NOT MET → holdout NOT requested. crop/thresholds/model/prompt NOT frozen.**

### Eyeball diagnosis (decisive): JUDGE bottleneck — not crop, not too-similar pairs
Both arms scored EVERY hard-neg run the IDENTICAL `same@0.95` — the same canned value as every true positive
(easy negatives = `different@1.00`). The judge is near-binary (*plausibly-same* vs *obviously-different*) and
does NOT calibrate identity confidence. Eyeballing the cropped faces:
- **pA c01 vs c02:** c01 = tighter springy curls + rounder face; c02 = longer looser waves + longer face
  (+ a stray dragon = `extraneous_entity`). Distinct-but-similar — a human (and Guy's front-load verdict) tells
  them apart.
- **pB c03 vs c04:** both blonde/blue-eyed boys; c04 reads distinctly younger/rounder. Distinguishable.
Crop correctly removed the scene/wardrobe confounds (clean buckets held; occlusion/small-target honestly became
`not_measurable` instead of force-passing) — but gpt-4o @ `detail:low` rubber-stamps similar children as
`same@0.95`. **Crop is NECESSARY but INSUFFICIENT alone.**

### Recommended next lever (needs Guy/Codex sign-off — changes the judge Codex fixed for the comparison)
Re-judge the SAME cached DEV crops with a STRONGER judge config: `detail:'high'` + a discrimination-forcing
prompt (enumerate distinguishing features; "same" only if NO meaningful difference; bias to different/uncertain
on doubt); optionally a stronger vision model. Cheap (crops cached → ~26–34 judge calls, NO detection, NO
renders). Decision rule: if it lifts hard-neg recall while holding the clean buckets → freeze crop+strict-judge
and proceed to holdout; if NO judge config catches distinct-but-similar children → vision-LLM identity has a
discrimination floor and the similar-child case needs a different mechanism (mandatory human-review when the
anchor reads generic, or a dedicated model). Thresholds still must stay fixed across any such comparison.

## Pre-prod-flag-on requirements (tracked; do NOT block the crop work)
- **P1-b durability** (code-verified `chunk-runner.ts:1599`): `identityVisionHold = isChildIdentityVisionEnabled()`
  reads the env flag at PACKAGING time, not a persisted fact that the book was RENDERED with identity-vision. If
  the flag flips off (or packaging runs in a different process/deploy) between render and packaging, the hold
  vanishes → a book rendered with the experimental gate could ship. BEFORE any prod flag-on: persist
  `identityVisionUsed`/`qaHold` on the order or pipeline cache AT RENDER TIME and force the package hold by that
  PERSISTENT value, not the live env read. (Not now — required before flag-on.)
