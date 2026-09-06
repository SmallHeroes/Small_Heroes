# M1a P2 correction — required preview discriminator and final-tree check

Date: 2026-09-06. Status: INDEPENDENT RE-GATE PASS P0=0/P1=0/P2=0;
BOTH M1a P2s CLOSED; FINAL FULL CHECK NON-GREEN.
No M1b/M2 or downstream authority.

## Independent closeout

Claude Code independently re-gated exact range
`081410dd6e25234a667381204e736764f0bb100c..09d67f387ef6949b9615c1f4e5ce02e269fd20bb`
on `codex/r3b1b-semantic-recovery-m1` in
`C:/GNart/Work/sh-r3b1b-semantic-m1`, and returned PASS P0=0/P1=0/P2=0.
It explicitly closed both original M1a findings. Review was read-only/offline;
HEAD, 1 commit / 11 files / +312/-10, clean worktree and unpushed ahead 1
status match the corrective handoff. No topology reconciliation is required.

Reviewer-rerun evidence: 160/160 focused tests, 7/7 classifier tests and both
typechecks, all exit 0. It independently counted 383 -> 385 specs, confirmed
the two exact additions and the required-field/runtime/persistence guards,
and checked unchanged candidate shape and held P1 content addresses.

The reviewer did NOT rerun `npm run check`: it verified the delivered log's
raw SHA-256 `1dde5465a0bfe1c4a851acbad46becb8a0a01443bf14c71332735e225552db7f`
and cross-read the failure table/diagnostic classes against that log. The
classifier regression is closed; the remaining non-green full gate is not
relabeled as passed or entirely inherited. No replay, standalone Wizard audit
or recovery preview was run by the reviewer.

Codex verified this same HEAD/range, clean ahead 1 / behind 0, unchanged log
hash, and clean upstream-parity d53b (`768ccb2f`) / accepted-intent (`63ccb484`)
dependencies before this documentation-only closeout. Current task is its sole
writer. This later documentation commit is outside the independent PASS range;
its final handoff supplies the new HEAD. No push, code/test/fixture edit or
provider/credential/downstream operation is part of the closeout. M1a's QA
dependency is satisfied for the next provider-free M1b milestone, not for any
render, artifact recovery or spend. P1 stays HELD P0=0/P1=3/P2=3.

Closeout validation: `npx tsc --noEmit` and `git diff --check` exited 0.
Only CURRENT, ROADMAP and this evidence file changed; no test battery or full
check was rerun for the documentation-only closeout. Its rollback is a focused
documentation revert, not a reversal of Claude Code's completed code re-gate.

The implementation and executable evidence below describe the now-reviewed
corrective milestone; its preparation-time topology is retained as history.

## Authority and topology

Original requirement: recover supporting-cast authority generally from the
accepted story, without paying to repeat P1. This corrective milestone stays
inside Guy's approved provider-free semantic-recovery Gate and the required
Codex-fixes / Claude-re-gates workflow. No new product question or spend.

Claude Code independently reviewed exact range
`768ccb2fe20edb1351cb4783796613cbf7a2993c..081410dd6e25234a667381204e736764f0bb100c`
on `codex/r3b1b-semantic-recovery-m1` and returned PASS P0=0/P1=0/P2=2.
It ran 153 focused and 198 additional legacy assertions, both typechecks,
and reproduced the two review/correction-batch failures at clean base.
Its PASS is M1a only, not the six P1 semantic findings or full M1 acceptance.

Corrective base: `081410dd6e25234a667381204e736764f0bb100c`. Current task is
sole writer in `C:/GNart/Work/sh-r3b1b-semantic-m1`, same branch, observed
clean 0/0 with local upstream before edits. Final handoff supplies exact HEAD.
No attribution of who pushed the preceding commit. Read-only dependencies:
d53b evidence branch at `768ccb2f`, accepted-intent wave-2 at `63ccb484`, both
clean 0/0. No branch/worktree cleanup, new app task, install or env-file access.
Existing dependency junction remains unchanged.

## Findings, root cause, solution and acceptance

P2-1 is valid: optional `supportingCastReviewDigest` let a subset literal
silently bypass the guard. The persistence wrapper also omitted the field in
its Pick type. Three existing persisted-candidate reconstruction callers are
safe for current inputs, but their literal pattern is unsafe for future live
previews. Expected: omission must fail at typecheck and at runtime, before
receipt inspection or persistence, while valid legacy candidates still work.

The smallest fix is a required `string | null` discriminator on compiler
results and on both factory/persistence signatures. The compiler emits null
for its legacy route and a digest for supporting-cast previews. Runtime
requires an own property equal to null. Missing, undefined, digest, malformed
and prototype-inherited values fail closed with the existing preview error.
All three reconstruction callers explicitly declare null; their existing
receipt, catalog and full candidate-byte equality checks remain intact.

This is a structural omission guard, not an unforgeable cryptographic proof:
deliberately replacing a preview digest with null is still caller falsification.
A brand alone would not stop an untyped caller; the required field plus runtime
check addresses the reported accidental subset erasure. M2 must introduce its
separate effective-artifact authority, never relabel previews as paid results.
No persisted field, artifact version, catalog, source, request, receipt or
replay format changes. No credential/provider execution or CLI activation.

P2-2 is valid: the old full check predates the last M1a hardening. A new full
run must cover the actual delivered code, regardless of a non-green baseline.
The preliminary correction run additionally exposed a real M1a regression:
its two new specs increased canonical inventory 383 -> 385 (ordinary 362 ->
364; resource-intensive still 21). The classifier's frozen assertion was not
updated in M1a. Correct the counts and explicitly assert both new specs are
ordinary. Preserve all partition disjointness, coverage, duplicate and omission
checks. No production supervisor/config, timeout, worker or exclusion changes.

Stop-check: general boundary repair, not story/child/companion-specific. The
compatibility risk is existing subset callers losing their former permissive
default; all such callers and the persistence wrapper were mapped and updated.
No visuals, product semantics, live invocation, migration or spend is involved.
The smallest proof is the deliberately failing preview-subset regression, then
focused tests, both typechecks and the mandatory final full check. No new Guy
or Cowork product decision or eyeball sample is needed for this correction.

## Changed surfaces and compatibility

- `compileBookVisualContractTemplate.ts`: required in-memory discriminator;
  legacy null and preview digest emitted unconditionally.
- `visualContractAuthoringLifecycle.ts`: factory runtime guard and persistence
  wrapper type. Other paid binding/catalog checks and serialized bytes unchanged.
- `liveExecutionSupervisor.ts`, `qaWizardCandidateBridge.ts`: three explicit
  legacy declarations on persisted-candidate rebuilds, not preview adapters.
- `accepted-supporting-cast-review.spec.ts`: real preview subset rejected by
  factory and persistence; compile-time omission assertions for both APIs;
  malformed/inherited values rejected before receipt access.
- `source-authority-lifecycle.spec.ts`: legacy compile emits null; full result
  and explicit-null subset yield equal candidate artifacts; no marker persists;
  existing invalid-receipt test still reaches and tests its intended guard.
- `vitest-workload-classifier.spec.ts`: exact 385/364/21 inventory and explicit
  membership for both M1a specs, no execution-policy change.
- CURRENT, ROADMAP, historical M1a evidence and this document record independent
  PASS, corrections and honest final validation. No story-specific workaround.

Rollback: focused revert of this corrective commit; no data migration. This
would reopen both the optional-field hole and stale inventory assertion.

## Executable evidence

Before the production fix, the real-preview subset regression failed:
`npx vitest run lib/visual-package/__tests__/accepted-supporting-cast-review.spec.ts -t 'projects a source-backed arbitrary individual' --maxWorkers=1 --no-cache`
returned exit 1, 1 failed / 10 skipped. The omitted marker passed the old guard
and reached missing-receipt destructuring instead of the preview rejection.

After the fix, the original seven-file M1a battery passed 160/160 (7/7 files,
exit 0); the accepted-loader spec now has 18 tests. The isolated classifier
suite passed 7/7, exit 0, after correcting its counts. New type-level assertions
require a compile failure for omitted fields at both factory and persistence.
The same isolated classifier command passed 7/7 at untouched d53b base
`768ccb2f`, with a clean worktree afterward. Thus the stale-count regression
was introduced by M1a, not inherited; its failure was visible in the first
correction full run as expected 383 / observed 385.

The exact already-reviewed inventory script from the Gate was executed in
d53b, exit 0: 14 regular single-link files / 412,516 bytes and raw inventory
SHA-256 `cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
Original P1 bytes remain unchanged. No actual paid replay or recovery ran.

Both typechecks in the final `npm run check` passed. A separate final
`npx tsc --noEmit` also exited 0. `git diff --check` passed. Logs are ignored
tooling diagnostics under `outputs/qa-m1a-p2-final-check/`, not candidate or
recovery artifacts.

Preliminary `npm-run-check.log`: exit 1, ordinary 338 passed / 9 failed /
17 skipped files (4,844 passed / 20 failed / 73 skipped tests); resource-intensive
20 passed / 1 failed files (642 passed / 11 skipped tests) and 3 unhandled
onTaskUpdate RPC errors. Includes the stale classifier assertion. The final run
uses `npm-run-check-final.log` after that fix. No code/test edits after its
start; only documentation is finalized from its observed output.

Final `npm run check` exited **1**, after both phases completed on the final
code/test tree (all seven changed code/test blobs rechecked before commit).
The canonical 385-file inventory was partitioned 364 ordinary / 21 resource
intensive; the corrected classifier assertion passed in this run.

| Final phase | Files passed / failed / skipped | Tests passed / failed / skipped | Process |
| --- | --- | --- | --- |
| Ordinary | 338 / 9 / 17 | 4,844 / 20 / 73 | exit 1; 110,283 ms |
| Resource-intensive | 19 / 2 / 0 | 641 / 1 / 11 | exit 1; 293,320 ms; 3 unhandled RPC errors |

Supervisor `gateStatus: failed` is authoritative. Ordinary diagnostic classes:
`test_timeout`, `signal_or_exit_failure`. Resource-intensive classes:
`on_task_update_rpc_timeout`, `test_timeout`, `signal_or_exit_failure`.
Full log raw SHA-256:
`1dde5465a0bfe1c4a851acbad46becb8a0a01443bf14c71332735e225552db7f`.

Final failures are explicitly bounded, not all called inherited:

- Six ordinary specs need missing ignored fixtures: child lexicon, Koko
  momentum, page-entity PNG, story read-back, Visual Direction acceptance,
  and reserved-page placement. No fixture authority was fabricated or copied.
- Review-batch digest mismatch and correction-batch binding failures are the
  same signatures independently reproduced at clean base by Claude Code.
  Correction-acceptance setup fails on that binding too (11 tests skipped).
- Wizard semantic-digest test timed out at 5,115 ms against 5,000 ms; the
  Supervisor hard-link/junction guard test timed out at 5,226 ms. Both passed
  in the preliminary run (4,321 / 4,968 ms), with the same production code.
  The final resource phase also reported three onTaskUpdate RPC timeouts.

After full completion, a diagnostic-only run at the unchanged default timeout:

```powershell
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/live-execution-supervisor.spec.ts -t 'keeps its semantic digest deterministic|rejects symlink/junction and hard-link escape' --maxWorkers=1 --no-cache
```

passed 2/2 files, 2 tests / 56 skipped, exit 0 (Supervisor 3,542 ms; Wizard
2,932 ms). This demonstrates timing variation, not a green replacement for the
failed full gate or proof that every timeout is inherited. No timeout changed.

Compatibility assertions on the final full tree: source-authority lifecycle
113/113, real-candidate bridge 15/15, canonical live boundary 177/177 passed;
supporting-cast review 27/27 and accepted-loader/preview boundary 18/18 passed.
Supervisor full suite was 45 passed / 1 timeout, not 46/46; its isolated
timeout target passed only in the diagnostic above. No assertion failure was
hidden behind the earlier preliminary green result.

P2-2's missing-final-run evidence is addressed, not full-repository stability.
The full gate remains non-green. At corrective handoff this range required
independent re-gate before M1b; that re-gate is now closed as recorded above.
No provider calls/spend or actual P1 recovery.

## Original independent re-gate brief (completed)

Review only this corrective milestone on the branch/worktree above; immutable
range starts at `081410dd6e25234a667381204e736764f0bb100c` and ends at HEAD
supplied in Codex's handoff. Challenge omitted/null/undefined/prototype
discriminators through factory AND persistence; ensure ordinary authoring and
all three persisted-candidate rebuilds still preserve exact authority/bytes.
Confirm no preview adapter, receipt/catalog weakening or new paid path exists.
Verify the classifier changes match exactly the two M1a specs and preserve
test coverage. Check that final full-check evidence covers every delivered code
and test edit; do not classify all failures as inherited from the corpus proof.

First pass read-only/offline. No credentials, providers, actual P1 recovery,
Blueprint/Board/package, locator, render, publication, deployment or payments.
Return technical PASS/HOLD and P0/P1/P2. Codex claims correction, not independent
closure. P1 remains HELD P0=0/P1=3/P2=3, and M1b/M2 remain unimplemented.
