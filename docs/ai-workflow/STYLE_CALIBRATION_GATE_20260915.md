# Style-aware automatic QA: three-arm calibration experiment

Guy explicitly wants automatic book QA rather than recurring human QA and approved
finding/testing exemplar calibration. Product direction recorded; not yet proof
that current automated output can safely replace visual review. No render authorized
by this experiment. Same sole writer/task, C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base6542e4faf447918a31bd2bbba3cb43af573b7256,
clean ahead22/behind0. Protected d53b768ccb2f / accepted-intent63ccb484 clean.

Observed Qwen flags missing nail beds/toe detail and simplified grips, including
the corrected control. Explicit style teaching has not been tested. Hypothesis:
text or positive visual examples reduce false alarms without losing known defects.
Scope: optional calibration in isolated comparison tooling, one preregistered CLI,
tests and evidence. No active gate/default/threshold/reader/source change.

Three arms use the same model and four target bytes: baseline instruction; baseline
plus tolerance rubric; same rubric plus two visually inspected normal examples.
Examples: old page4 hanging hands, new page6 occluded grip/back view. Both labels
are implementer-provisional; no owner acceptance inferred. Targets: original malformed
page1 (Guy rejection), corrected page1, new page8 and new page12 (provisional normal).
No example/target page-family or hash overlap. Original/corrected targets are related;
there is only ONE positive defect case, not general held-out sensitivity evidence.
No target label/id/path/previous verdict sent. Examples teach normal stylization;
there is no independently labelled second defective exemplar available in this set.

Main agent inspected examples and targets before calls; new page8 reserved case
is now explicitly consumed for this experiment (old dataset remains historical).
General tooling with story-specific experiment data only. No training/model install.
Rejected alternatives: overwrite old verdicts; teach exact target answer; tune until
all pass; infer independent ground truth from model outputs; production cutover now.

Transport: official Replicate models endpoint in async mode (no Prefer:wait); this
is the documented official-model route and returns an ID before long inference.
Prior504 cause not proven; reliable transport is separately tested, not assumed.
GET recovery and existing unknown claims preserved. No automatic paid retry.
Old comparison requests/replay fingerprints unchanged when new options omitted.
Requested metadata version not an attested snapshot; returned hidden retained.

Up to12 new assessment calls,0.25USD reservation each,total3USD planning allowance,
3000output tokens/call,120s cancellation request. Not a provider hard-dollar cap.
Known Replicate key reused; no reference photo, public uploads or image generation.
Unknown provider calls retain reserve. Raw receipts preserved; no billing assertion
without evidence. Whole-run lock, source snapshots/hashes, immutable new root.

Validation: input ordering/example hash/target leakage, rubric vs examples isolation,
async routing and old replay, failure/unknown claims, focused tests and tsc. Fullcheck
not rerun for isolated experiment; NON-GREEN remains. Main risk is exemplar-driven
over-acceptance, so original defect retained as unlabelled-to-model positive control.
No broad accuracy from this small single-story set. Independent QA pending.

Stop-check: general isolated tool; other stories/production unchanged; bounded paid
assessment approved; smallest paired3x4; no new product decision needed; QA should
attack teaching leakage, all-pass bias, snapshot/cost claims and replay isolation;
no creative edit needing Cowork; no new image for Guy to accept. Rollback: omit new
options/do not run experiment. Preserve old outputs; no push or release authority.
