# Claude Code re-gate: interactive execution and exact review BOM handling

## Frozen target and authority

Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
Branch: `codex/personal-book-storyboard-bridge`.
Base: `329c857ed7ee4ee5f8d6a4138262ac540f1b343d`.
Successor subject: `fix(story): guard interactive calibration and decode review BOM`.
The post-commit handoff supplies the exact head. Freeze it; reconcile any
different branch/head before review. Codex root is the sole implementation
writer. First pass read-only: no execute, key, provider, paid call, push,
deployment or rewriting historical output/approval/family records.

Guy wants a complete personal book path, Opus author from scratch, fresh Opus
editor and independent Astra readings, with human story judgment before images.
His standing corrective workflow covers these validated engineering findings;
it does not settle the pending priced live-run decision.

## Accepted independent review, exact scope

Claude's reports independently PASS `b60251b6..49e1fabb` (profile data) and
`49e1fabb..329c857e` (offline driver), P0/P1/P2 zero. They do NOT award a branch,
paid execution, literary, product, visual or release PASS. Claude authored the
underlying creative proposal: its literary opinion is not independent.
His 9/9 profile and 23/29 driver mutations are attributed reviewer evidence,
not Codex measurements. Driver survivors: five absent test pins and one
redundant late guard; current behavior was correct.

Two before-live operational traps were valid: paid probe/plan could precede
stdin EOF; PowerShell 5.1's single UTF-8 BOM could reject a valid review after
planning. This successor corrects those seams and pins the disclosed tests.

## Changed behavior and files

`scripts/personal-single-book-calibration.ts`: after free preview, reject
`process.stdin.isTTY !== true` with `interactive_stdin_required`, before
AbortController/listeners, driver construction, reservation or credential read.
Help and free preview stay usable without a terminal. A real interactive
terminal is required for execute; no pipe bypass/resume mode was added.

`scripts/personal-causal-trial-host.ts`: strip exactly one leading U+FEFF when
decoding a review, after original-file fences and byte ceiling. Do not rewrite
the file. Double/interior/trailing BOM outside JSON strings stays invalid; a
BOM inside a reason string survives. Strict schema and cohort digest binding
still run. No changes to source hashing, reservation, one-use approval, refund,
timeout, model/cap/effort, transport or family identity.

`lib/__tests__/personal-single-book-calibration.spec.ts`: 49 to 59 cases.
TTY false/undefined reject the intended clause with no inventory/listener/key/
transport changes; TTY true reaches the existing constructor failure test.
Real launcher with closed or pre-piped stdin returns the sanitized rejection;
help/default preview remain free. Comparison kinds cross the real compiler:
remaining_problem/new_regression hold; preference/improvement remain advisory.
Final readings do not admit the comparison-only kinds; comparison does not
admit issue. No fabricated out-of-contract admission claim.

The new probe reserve spy inspects result content and probe_completed seal,
claims and settlements BEFORE delegating to book-family reserve, when neither
book output nor book family exists. A separate dispatch-record tamper pins
completion verifyRecords: record_changed after one injected response, receipt
retained, no book reserve. Viewer tests pin exact escaped original/revised page
payload and QA explanation, not merely absence of an ordinary HTML closing tag.

`lib/__tests__/personal-causal-trial-host.spec.ts`: 63 to 75 cases.
Plain/single/double/interior BOM, preserved string content, 10,000/10,001 bytes
including prefix, hardlink fence, and real matching/stale digest barrier.
Matching BOM HOLD stops before prose as intended; stale BOM fails cohort_binding.

State, decision/handoff Markdown and the new full-check evidence JSON are the
only other intended changes (nine tracked paths total).
No new canonical spec file/inventory change. No public wizard/site/route,
companion profile, identity/image asset, engine prompt/schema, native CLI or
provider adapter change. Unlike the reviewed driver-only range, THIS successor
does change the shared review reader; that seam needs this re-gate.

## Codex checks

Type check: `npx tsc --noEmit`, exit 0.
Exact six-spec focused set: 239/239, six files, exit 0, 20.94s:

    lib/__tests__/personal-single-book-calibration.spec.ts            59
    lib/__tests__/personal-causal-trial-host.spec.ts                  75
    lib/__tests__/personal-causal-trial-native.spec.ts                14
    lib/__tests__/vitest-workload-classifier.spec.ts                   7
    lib/personal-wizard/__tests__/story-causal-experiment.spec.ts      61
    lib/personal-wizard/__tests__/companion-character-revision.spec.ts 23

First subset command accidentally named three nonexistent filters; only three
real files ran, 141/141. It was not counted as the six-spec set; the exact command
above then reproduced all six. No failed implementation test was concealed.

Memory-only Vite negative controls: ten deliberate variants, 10/10 caught by
the intended new cases; two unmodified controls pass. Remove TTY, remove BOM
decoding, globally strip BOM, omit either comparison defect kind, unescape page
or QA, omit probe result save, seal or full-record verify. Both production SHA
values identical before/after. This is Codex verification, not independent QA.
Reproducible local helper/config/reporter JSON and summary:
`outputs/personal-single-book-operator-fix-20261004/`.
Run: `node outputs/personal-single-book-operator-fix-20261004/run-mutations.cjs`.

Fresh `npm run check`: observed cmd/npm wrapper exit 1, supervisor observes
native child exit 1 in both lanes; diagnostic protocol valid. Both type checks
completed. Ordinary: same ten missing-artifact failures, 5,997 passed/73 skipped,
392 files, 134,203ms. Resource: sixteen timeouts/619 passed, twenty files,
401,902ms plus four onTaskUpdate RPC errors. Timeout files unchanged: canonical-
materialization-input (1), canonical-pre-live-readiness (4), live-execution-
request-materialization (5), live-execution-supervisor (5), QA candidate bridge
(1). Both changed specs pass in the full gate, 59/59 and 75/75. No new baseline
full run or cause attribution; do not infer stability or GREEN.

Tracked summary: PERSONAL_SINGLE_BOOK_OPERATOR_FIX_FULL_CHECK_20261004.json.
Raw log and supervisor capture are in the ignored output folder. The historical
driver full-check JSON remains immutable. Final separate tsc exits 0 after the
full run. Negative-control/focused runs did not overlap the full check.

## Preservation and topology

Read-only recomputation: 20/20 copied snapshots, 22/22 image references,
41/41 other original sources match their manifest. Manifest has 42 original
rows: the deliberate live profile revision remains byte-identical to Git
49e1fabb, 30,872B / SHA256
256033679fb3d0fdd419affc39f94274a6c70bcebbb424b6005d2f9fc0fc579b.
Claude's original characterization remains 102,336B / SHA256
9d45bf80a6b97a11bb2c36c4df2478c10399c2939fb377ac94e63dba602cede8.
This is not a new exhaustive baseline over every historical paid-output root.

Protected d53b is clean at 768ccb2f; accepted-intent-wave-2 clean at 63ccb484.
Site QA is clean at 5fe73b3f, Claude site at 87b0d196 (ahead four, unchanged).
No edits/merge/push/deploy in those worktrees. Base329 matched cached origin;
the new local successor is not a whole-branch gate. Recheck topology at handoff.

## Reviewer baseline observations, not a Codex rerun

Claude independently ran full checks at committed329 and baseb602. Same ten
ordinary missing-artifact failures: HEAD 5,975 passed/73 skipped, base 5,903
passed/73 skipped. Resource HEAD 635/635 with three onTaskUpdate RPC errors;
base 634/635, one timeout and three RPC errors. The 72 added passing tests and
two files match the two ranges. Codex's historical fourteen timeouts did not
reproduce there. These are observations under different load, not proof of
timeout causality or stability. Full gate remains RED.

## Explicit falsification targets

1. Delete/move TTY guard after construction/reserve; test false AND undefined.
   Confirm exact error and no listener/namespace/output/key/provider activity.
   Run real launcher with EOF and pre-piped continue; default/help stay usable.
2. Remove or broaden BOM handling. Check exactly one at byte zero, no file
   rewrite, counted prefix bytes, hardlink rejection and digest barrier. Try
   BOM-shaped schema extras/stale digest, not only a valid parsing helper call.
3. Remove each missing pin independently: comparison remaining_problem and
   new_regression, page/QA escaping, successful probe save/seal. Confirm intended
   test fails, no earlier accidental rejection; no out-of-contract critic kind.
4. Delete probe completion verification: only the probe dispatch bytes are
   tampered, so admission's manifest/reservation check does not hide that test.
   Verify receipt retained and book-family reserve absent.
5. Recompute unchanged profiles, assets, snapshots, protected worktrees and
   historical evidence. Do not update the frozen packet verifier's old baseline.
6. Attack shared host compatibility and real listener/property cleanup after
   failures. No stdout/key/story leak or newly resumed/consumed allowance.

## Unchanged open decisions and limits

No book generated, key lookup/provider call/spend, imagery/storyboard/narration,
public recording-to-book cutover, site QA merge, deployment or product acceptance.
No independent PASS on this successor until your re-gate. Prior ranges remain
their exact boundaries. P3-4 coordinator pins and P3-6 broad coordinator label
are unchanged; no blanket closure of nonblocking notes.

PL-1 remains empirical: eight-spread author cap 8k includes thinking; earlier
combined plan/manuscript evidence is NOT a measurement of the current split
author. It can stop after paid probe/plan with no book. PL-2 exact Astra returned
identity stays unmeasured. Do not guess aliases or silently raise caps/budget.
One-use reference, reviewer within twenty minutes, fresh pricing, clean pinned
workspace and no edits during execution remain mandatory. Existing key reuse
is authorized; priced owner consent and retry authority are not invented.

Combined allowances $11.59 in requested $12 are estimates, not invoice or native
internal-call guarantees. Proposed exact reference guy-text-calibration-20261004-01
is pending owner approval, with no automatic new-reference retry on failure.
First re-gate these free fixes, then resolve the priced live decision. Preserve
all receipts even if a later approved experiment fails; never reset its family.

## Inspection and optional later work-branch push

The focused local successor is committed by Codex; no stage/commit reconstruction
is needed. The exact post-commit handoff supplies HEAD. Inspect first; push only
under Guy's explicit instruction, and never treat it as independent review.

    Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
    git status --short --branch
    git log -1 --format=fuller
    git diff 329c857ed7ee4ee5f8d6a4138262ac540f1b343d HEAD --stat
    git diff 329c857ed7ee4ee5f8d6a4138262ac540f1b343d HEAD --check
    git push origin HEAD:refs/heads/codex/personal-book-storyboard-bridge

No force push, git add -A, site QA branch push or evidence reset. Ignored scratch
logs/helpers are local only and not backed up by the work-branch Git commit.
