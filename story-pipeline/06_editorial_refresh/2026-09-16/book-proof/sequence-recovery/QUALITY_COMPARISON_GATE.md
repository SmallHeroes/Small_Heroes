# Separate quality comparison gate — 2026-09-23

## 1. Proposed change and owner authority

Guy approved the recommendation to compare the model, then separately test quality.
The LOW model-only milestone is complete and remains immutable. Continue in this
same task/worktree/branch, sole writer Codex, base69a75de0 clean/ahead19. Protected
768ccb2f/63ccb484 remain clean/read-only. This is a separate follow-up, not an
expansion of the completed LOW run or an independent technical PASS.

Add optional sample-only imageQuality low/medium to the owner CLI. Omission keeps
LOW and the old serialized config. One Sunburst MEDIUM page, identical first-page
prompt, three references, size, source/plan/sequence and QA. No image edits.

## 2. Why now / observed cause

Sunburst LOW still failed the canonical wheel spoke count. Seven other context
categories and the blind anatomy check passed, but this does not establish visual
accuracy or model superiority. Model selection alone did not remove this defect.
Quality is the next controlled variable; repeated identical retries or changing
QA thresholds would not answer that question. No promise MEDIUM will solve it.

## 3–6. Scope, risks, files and behavior

General opt-in diagnostic configuration, not a story-specific renderer. Change
owner CLI, its tests, comparison evidence harness, CURRENT and ROADMAP only.
No shared generator, production flow, prompt, anchor or judge changes. Unknown
qualities and explicit non-sample overrides reject. Identity and checkpoint bind
quality; a changed quality cannot reuse an old run. Provider output quality is
not independently attested; verify the actual request seam with a focused test.

## 7. Validation and acceptance

Focused tests and tsc before local commit; replay original LOW evidence offline.
Full check on preceding code milestone was native1, including assertions and
timeouts. No new full run is claimed; stability remains RED. Prepare offline,
then render exactly page1 in a fresh root and run the existing two QA calls.
Stop after that result, even if held; no further paid quality ladder this task.
Compare saved requests/reference bytes, checkpoint fingerprints, pixels, raw QA,
usage and old-artifact SHA/size/mtime. A single observation is not calibration.

## 8. Cost and smallest run

Prior accounted upper6.65329 + LOW0.74079 =7.39408 (historical unknown1 retained).
New image cap0.50 + QA cap1.50 =2.00; maximum aggregate9.39408 < unchanged9.50.
One image, at most two QA calls. No refill/retry/fallback. Known LOW usage estimate
0.12878, not invoice verified. Recompute ledger immediately before dispatch.
Use existing authorized key only through the existing owner CLI, never print it.

## 9. Rollback

Omit imageQuality in a NEW root; original LOW default remains. Preserve every
historical artifact and raw verdict. No reset/delete or retrospective acceptance.

## 10. Review and stop-check

Guy selected the controlled comparison; no unresolved creative choice is being
made. Guy later judges pixels. Claude should attack quality/default/checkpoint
binding, no prompt/reference drift, legacy compatibility, cumulative accounting
and stop behavior. No Cowork decision required for this technical comparison.
General option, no customer-path change, one paid test image, bounded known risk.

## 11. Do not do

No HIGH/full book/narration, no third retry, no threshold/severity relaxation,
no source/plan/sequence changes, no push/deployment, no release or product PASS.
Local ignored inputs/outputs/logs have no verified off-machine backup.
