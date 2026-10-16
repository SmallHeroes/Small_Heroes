# Decision Gate: age calibration of the drawn child anchor from a real photo (2026-10-16)

**Owner decision:** Guy (AskUserQuestion, 2026-10-16), "Age calibration (Recommended)":

> "A general fix: a calibrated age line for every age (today only age 5 is calibrated), so the drawn portrait doesn't overshoot. Offline build, then Codex QA, then a small comparison (a few portraits, ~$0.05–0.15) with your separate approval. Testing several ages needs other children's photos, which needs your consent."

**Trigger:** in the likeness probe, Guy judged both the anchor and the page "Clearly Lavi". He then said the child "looks a bit older for age 7… more like 9 or 10".

Developer: Claude Code. QA: Codex. Product, consent and spend: Guy.

## 1. Evidence (code, read-only; no image was viewed by the developer)

**Production's anchor prompt** (`buildStage0MethodBPrompt`) carries two age elements:
1. **`buildStage0AnchorAgeLockLine(age, gender)`:**
   - For **age 5 only**, a calibrated line ("kindergarten-age… slightly longer limbs than a toddler, less baby-chubby face… Do NOT make him look 7–8 or older"). Its comment reads "Calibrated age lock — kindergarten-age ~5, must not overshoot to 7–8".
   - For **every other age**, a generic band line ("about age N with … proportions — not younger, not N+2–N+3 or older").
2. **`STAGE0_ANCHOR_ANTI_TODDLER`, for every age:** "NOT baby cheeks… NOT toddler body. This is NOT a 2–3-year-old." For ages 2–3 this contradicts the age line itself.

**The observed result:** for age 7 the generic line already says "not 9–10 or older", yet the owner sees 9–10. The instruction was present and not followed.

## 2. Cause: evidence versus hypothesis

**Evidenced:**
- an age overshoot of about 2–3 years on one anchor, one page and one photo, by the owner's eye;
- the generic line for age 7, the always-on "not a toddler" block, and a calibration that exists only for age 5.

**Hypotheses** (only the comparison can test them):
- **H1:** the generic line is weaker than a calibrated one (concrete proportion cues plus two-sided bounds).
- **H2:** the "not baby / not toddler" block pushes an older child further up.
- **Others, out of scope here:** the neutral, closed-lip anchor expression; the realism of the style; the model (production's anchor default is gpt-image-1, the probe used gpt-image-2); the photo itself.

## 3. Proposed change (general, opt-in, the new engine only)

**`lib/personal-wizard/photo-anchor-age.ts` (new):** `calibratedPhotoAnchorPrompt(input)` is **production's own prompt** (`buildStage0MethodBPrompt`) with **exactly two substitutions**. Each must occur exactly once, or it refuses, so no silent drift if production's text changes:
1. **The age line** becomes a calibrated line for the age band: concrete, non-cartoon proportion cues, plus two-sided bounds ("about N; not N+2 or older; not younger than N−1").
2. **The anti-toddler block** becomes age-aware:
   - ages 4–5: unchanged;
   - ages 2–3: a toddler bound instead of the contradiction;
   - ages 6–12: an "AGE BOUNDS" line ("NOT an N+2–N+3-year-old, NOT a preschooler; keep the soft N-year-old face").

**Age 5** keeps production's line and block, so its prompt is **byte-identical to production's**. The bands cover ages 2–12, and nothing in them is specific to one child.

**Probe** (`scripts/personal-likeness-probe.ts`), with two optional configuration fields whose defaults keep today's behaviour byte-identical:
- `anchorAge`: `production` (default) | `calibrated-v1`;
- `mode`: `anchor_and_page` (default, today's six calls) | `anchor_only` (two calls: the anchor, then photo → anchor identity), for cheap portrait comparisons.

Each comparison is its own one-use run (its own label and output folder) under the probe's existing guards: script-located privacy boundary, one run, own cap, stop on unusable evidence.

**Not touched:** production (`lib/generation-pipeline/*`), the Wizard, the new-book experiment, the evaluator and 0.70, models and quality. Adopting the calibration in production would be a separate, later decision for Guy.

## 4. Stop-check answers

| # | question | answer |
|---|---|---|
| 1 | General system or story-specific? | General: age bands for 2–12; the photo is input data. |
| 2 | Could it break another story, child, companion or style? | It is opt-in; defaults are byte-identical, and age 5 stays identical to production. The calibrated text applies only when chosen. |
| 3 | Production behaviour? | None. Production code is unchanged. |
| 4 | Money? | Offline build: none. Comparison (separate approval): about $0.04 per portrait run (one anchor + one identity check). |
| 5 | Smallest safe validation? | **Lavi:** one calibrated `anchor_only` run; the production-age anchor already exists from the probe. **Optionally,** one or two more consented children of other ages, each production versus calibrated (2 runs). About $0.04 per run. |
| 6 | What must Guy decide before the paid comparison? | Which children (consent per child), their ages, and the budget. Per run, a reservation ceiling of $0.60 (the anchor reservation alone is $0.48); expected actual about $0.04. |
| 7 | What should be falsified after implementation? | Defaults byte-identical. The age-5 calibrated prompt equals production's. Each substitution happens exactly once and refuses on drift. Bands cover 2–12 with two-sided bounds. `anchor_only` makes exactly 2 calls. Every probe guard is unchanged. |
| 8 | Claude Cowork? | Optional: the wording of the age cues (non-cartoon, non-sexualised, plain anatomy). |
| 9 | What should Guy eyeball? | Each calibrated portrait against its production version and the photo: does it read as the stated age, and is it still the same child? |

## 5. Validation

**Offline:** the spec covers the substitutions, bands, bounds and age-5 identity, the probe's `anchor_only` and `calibrated-v1` paths, and that defaults are unchanged (the existing 12 probe tests).

**Paid** (after Codex PASS and Guy's approval): the comparison above. Offline tests cannot judge apparent age; Guy's eye does.

## 6. Rollback

The change is opt-in. Revert the commit.

## 7. Do not

- No production, Wizard or experiment change. No change to the evaluator, the 0.70 bar, models, quality or the style text.
- No use of another child's photo without Guy's per-child consent.
- No paid run before Codex PASS and Guy's approval.
- No repair aimed at one child: the bands are general.
