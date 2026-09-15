# Localized anatomy experiment — owner approved

## Purpose and observed cause
Guy approved the proposed targeted anatomy experiment with free technical direction.
5.4/5.5 previously missed the malformed child. Recorded explanations rationalize
exposed fragments as plausible hidden limbs; the current prompt explicitly invites
plausible continuations. Whole-frame and broad quadrants already failed. Whether
automatic child localization and more evidence-grounded wording help is a hypothesis.

## Scope, acceptance and stop-check
Same task, sole writer C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1, base53b9ff5b, clean ahead19. Protected dependencies
d53b768ccb2f and accepted-intent63ccb484 clean/read-only. New experimental modules
only; existing judge/policy/threshold0.70 and production defaults unchanged.
General target-localization box -> original-pixel child/detail crops -> anatomy
inspection distinguishing observable defects, uncertainty and ordinary occlusion.
No fixed story coordinates, anatomy labels or expected outcomes given to the model.
Geometry/consistency validates in code; no assumption coordinate validation proves
semantic localization. Inspect actual crops. Localization failure holds, not PASS.

Six existing images: original rejected anatomy, corrected counterpart, and four
implementer-inspected anatomy controls (pages3,5,9,12: action/occlusion/seated poses).
These are provisional control labels, not new owner or independent QA acceptance.
Max12 calls initially, GPT-5.5 Medium, one5USD planning fence, no retries. Existing
key explicitly authorized. No image rendering, image replacement or new audio.
Validate geometry, schema contradictions, provenance, unknown/replay/budget behavior,
real provider requests and crop pixels, then evaluate misses AND false positives.
Success on this small sample alone grants no render or repair permission.

## Files, boundaries and rollback
lib/local-anatomy-experiment.ts, scripts/lib/local-anatomy-experiment.ts,
scripts/experiment-localized-anatomy.ts, focused tests, CURRENT and handoff.
New evidence root only; no media/source edits or reader changes. No auto cutover
or calibration override. Revert the focused commit to remove experimental tooling.
Risks: wrong localization, crop omits context, overstrict wording, false positives,
correlated model errors. No repeated model switching or threshold lowering.

## Bounded second variant after observed first-run failure
v1 located all six children and passed all five anatomy controls but missed the
original malformed anatomy again. Crop inspection confirms the exposed defective
regions are included. Completed12calls, conservative accounted1.43019USD.
Owner's approved experiment continues with one inventory-first variant: explicit
four-limb observations (visible proximal/distal boundaries, garment edge, visible
vs naturally occluded vs untraceable), same5.5/medium and same six source images.
Separate v2 root, planning budget3.5USD: v1 accounted + v2 allowance4.93019USD,
inside this task's5USD planning limit. Max12 additional calls; no unlimited tuning.
This modifies both output schema and prompt and repeats localization; not a pure
crop-only causal benchmark. Old receipts remain untouched. Both variants return
renderAuthorized=false regardless of experimental outcome.

v2 stopped after4calls: sample-a still missed; sample-b returned invalid boxes
(x1 + width1), rejected after receipt preservation. Sample-a boxes at origin also
do not overlap the child, exposing a gap in evidence grounding despite individually
valid coordinate ranges. Inspector instructions had not explicitly stated units.
One final bounded two-image v3 comparison adds explicit full-image fractional units
and rejects evidence boxes outside the target crop (2% full-image tolerance).
The two earlier protocols remain frozen for replay. v1+v2 upper accounting2.01753;
v3 separate allowance1.5USD => combined3.51753USD, within the original5USD limit.
No automatic retries; at most4 extra requests, then stop this experiment series.

## Review / next step
Claude first pass read-only against immutable range; no self-awarded independent
PASS. Falsify expected-label leakage, crop binding, normal-occlusion handling,
no hidden spend/retries and no active-route change. Owner intent is settled; no
new creative decision needed for this experiment. Five-page render follows only
if quality evidence supports it and existing gates are genuinely satisfied.
