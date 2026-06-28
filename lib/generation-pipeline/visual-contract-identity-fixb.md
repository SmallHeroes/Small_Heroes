# Visual-contract child-identity gate — design & Fix B status

The reroll identity recheck decides whether a contract-corrected reroll still shows the **same child**.
It is a 3-state verdict — `pass | fail | not_measurable` — where only `fail` drops the page (no-leak),
and `not_measurable` keeps the image but flags it for human review.

## Why the original gate was broken (T16, order cmqt4635e)

The reroll re-score was `scoreResemblanceAgainstReference`, which is a **coarse whole-image palette
histogram** (`cosineSimilarity` of two colour/texture vectors), NOT face recognition. On a busy multi-face
page (4 kids on a slide) the portrait anchor vs. the full scene scored **0.252**, and the old
`score < 0.70` hard-block **dropped a page where the child was clearly preserved** (verified by eyeball).
The histogram measures composition, not identity, and is worst on multi-face / busy scenes.

## What is built (this branch)

1. **Rename** `embedding → paletteHistogram` (`resemblance-core.ts`) — the vector is a palette histogram,
   not an identity embedding. Self-documenting.
2. **3-state `evaluateRerollIdentity`** (`visual-contract-gate.ts`) — removed the `score < 0.70` hard-block:
   - `not_measurable` ← `geometryWeird` (faceCount ≠ 1 OR faceAreaRatio < 0.05) / low face-detect
     confidence / null score. Never a silent keep, never a hard drop → **human review**.
   - histogram-only `fail` ← reliably measured single prominent face **with a clear mismatch** only.
   - live path: `not_measurable` → keep + `style01Meta.needsHumanReview` + `identityStatus` in the gate-proof;
     the T16 driver summary lists `humanReviewPages`.
3. **Vision-LLM identity signal** (`child-identity-vision.ts`) — `checkChildIdentityViaVision(anchor, page)`
   asks gpt-4o "same child?" (face/hair/age/skin only; ignore pose/background/style/other characters;
   small/turned/occluded → uncertain). Robust to watercolor, which defeats the histogram.
4. **Vision drives the gate** (flag-gated): when a vision verdict is present it is AUTHORITATIVE —
   confident `different` → fail, confident `same` → pass (overrides the histogram, so the page-3 multi-face
   case is correctly **kept**), uncertain/low-confidence → not_measurable. Wired behind
   `isChildIdentityVisionEnabled()` (env `VISUAL_CONTRACT_IDENTITY_VISION`, **OFF by default**); a vision
   error falls back to the histogram.

## Fix B — REMAINING before turning the vision gate on (needs labelled data / Codex)

- **Recalibrate on a DIVERSE set** — Phase-1 calibration DONE (asymmetric `same 0.95 / different 0.90`, see
  "Calibration result" below), but on only 3 staging children (1 girl + 2 similar boys). A diverse holdout
  (≥10-12 children; varied skin tone / hair colour+texture / age / gender; hard lookalikes; multi-child /
  profile / occluded) is required before broad/prod flag-on — and is NOT buildable from staging (needs new
  renders or prod). Label BY HAND, split BY CHILD (no leakage). Do NOT reuse the old `0.70` palette threshold.
- **Tone-invariant face detector.** `resemblance-core` face/skin-blob detection (`detectFaceLikeBlobRatios`,
  `faceDetectConfidence`) is colour/tone-biased and can mis-measure darker or stylised skin → wrong
  `geometryWeird`/confidence → wrong `not_measurable`. Make detection tone-invariant so measurability is fair.
- **Crop + align the child face** before any comparison (and before sending to the vision model), so the
  signal is the child's face, not the whole scene / a background child. This also de-risks the multi-face
  ambiguity at the source.
- **Validate** end-to-end with the T16 driver on `VISUAL_CONTRACT_IDENTITY_VISION=true` over the labelled
  pairs (a real render — gated on Codex), confirming same-child pages PASS / not_measurable and a planted
  different-child reroll FAILs.

## Calibration result (Phase 1, no render — `scripts/run-identity-calibration.ts`)

Scored 30 same-child + 30 different-child REAL pairs (3 staging children: יובל/בר/נועם) with the vision
model. Verdicts cluster high (no `uncertain`): same@0.95 (24) / same@0.90 (6); different catches @0.90-1.00
(26); and 4 different-child FALSE-PASSES all at same@0.90. A single symmetric threshold cannot split the 4
false-passes from the 6 clean same@0.90 positives → ASYMMETRIC thresholds.

REAL gate policy (`IDENTITY_VISION_SAME_MIN_CONFIDENCE=0.95`, `IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE=0.90`):
- positives (n=30): **24 auto-pass · 0 false-fail · 6 human-review**
- negatives (n=30): **26 auto-fail · 0 false-pass · 4 human-review**

The T16 page-3 reroll (the 0.252 palette false-low) → same@0.95 → PASS (Fix B validated). The 4 review cases
are ONE similar-boy pair (בר↔נועם) — eyeballed as genuinely-similar-but-distinct children (a real
discrimination limit, not a data error), routed to human review, never false-passed.

**Calibration is UNDER-TESTED:** staging's entire rendered universe is only 3 children (1 girl + 2 similar
boys; see `scripts/survey-calibration-diversity.ts`). The diverse-holdout recalibration above is required
before broad/prod flag-on. Confidence is self-reported + discrete (0.90/0.95) — treat as conservative
interim, not a zero-error model.

## Acceptance (tests, all green, no render)

- `visual-contract-gate-resemblance.spec.ts`: histogram 3-state (multi-face → not_measurable, the page-3
  case); vision authoritative (different→fail overriding histogram, multi-face same→pass, uncertain/low-conf
  → not_measurable).
- `child-identity-vision.spec.ts`: tolerant parser (same/different/uncertain, garbage→uncertain, clamps
  confidence, 0-confidence claim→uncertain) + the request shape (both images, detail:low) + error paths.
