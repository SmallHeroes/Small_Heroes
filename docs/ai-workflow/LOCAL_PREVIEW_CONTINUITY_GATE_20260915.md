# Local preview continuity and automatic repair — owner-approved implementation

## Proposed change / why now
Guy requested general continuity, anatomy, breathing-room framing, automatic QA and
bounded correction during book creation, then narration in the next review round.
He approved proceeding without repeated permission questions on 2026-09-15.
The local preview omitted existing framing/anatomy locks; plan labels were not
pixel evidence, location projection lost visible prior sets, and review did not
drive correction. Identity scores alone missed malformed anatomy and prop counts.

## Scope and topology
Sole writer: current Codex task, C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, start 4d3bfab0, ahead17. Existing uncommitted
preview accounting/review/repair and local-reader changes belong to this task and
are preserved. Protected d53b768ccb2f and accepted-intent63ccb484 remain clean,
read-only. No independent PASS. No push or hosted/customer cutover.

## Implementation order / likely files
1. Versioned structured continuity plan and reuse general Style01 framing/anatomy.
2. Evidence-bound QA categories and bounded render-review-repair loop; malformed,
   unavailable or uncertain QA holds, never authorizes a paid image retry.
3. Wire the local CLI and calibrate with existing known-bad and control images.
4. Narration input/reader integration using the exact personalized source.
Files: local-story-preview, new local-preview-quality module, local preview scripts,
local-book-review/audio route, focused tests. No accepted manuscript edits.

## Acceptance and validation
Prove changed image/context invalidates review; every category must be assessed;
actual verified defects alone authorize at most two repairs per page; each repair
is fully rejudged. Prior failed images/receipts remain immutable. Check source-bound
state changes, background location identity, scale and composition constraints.
Run focused tests, tsc, diff check; full repository check remains an independent
stability obligation and is not presumed green. Live judge must catch known-bad
examples before new book images can be counted as corrected. Visual interpretation
is probabilistic; tests of routing do not establish judge accuracy.

## Cost / stop-check / exclusions
General opt-in local lane; old artifacts remain readable. No story-name/page-number
exceptions, no threshold changes (resemblance remains0.70), no prompt-only PASS.
Existing-key use is explicitly authorized. LOW only, per-run conservative ceiling
USD10 including QA/repair; initial validation reuses existing PNGs, not a new full
book. Unknown paid outcome never retries. Audio is local audition, no upload or
new credentials. No HIGH, payment, deployment, source publication or auto-release.
Owner reviews next images/audio; no claim of human-level infallibility.
Rollback: revert focused code commits; original artifacts and accepted text remain.
Claude handoff must attack false PASS, context binding, resource bounds, source
mutation, false-positive occlusion, changed object states, environment access and
audio containment. No additional creative decision needed for this implementation.
