# QA cooperative scheduling and compound-test isolation

2026-09-07. Status: ACK BARRIER LOCAL ACCEPTANCE MET; INDEPENDENT QA PENDING;
FULL CHECK NON-GREEN.
Technical owner/sole writer: Codex. Independent reviewer: Claude Code (not yet
dispatched or passed for this range). Product owner: Guy.

## Approved ACK-aware successor (2026-09-07)

Guy's subsequent `מאשר` approves the actual-promise barrier proposed in
`outputs/qa-rpc-ack-diagnostic-20260907/RPC_ACK_DIAGNOSIS_AND_GATE.md`.
That file's not-yet-approved wording describes its diagnosis closeout, not the
current authority. Same task/worktree/sole writer and base `3a455c48`; no new
implementation task, third-suite rewrite, production change or automatic push.

The measured delay spans multiple completed yields while main RPC handling is
prompt. Therefore preserve the already-installed `onTaskUpdate` delegate at
the public `onBeforeRunFiles` hook, wrap once per runner, forward receiver,
arguments and exact returned promise, and track settlement in a runner-owned
set. At `onBeforeTryTask`, native yield then drain all outstanding promises,
including updates arriving during the wait, before inherited attempt setup.
Rejected promises remain fatal. Cancellation received while waiting delegates
to the base cancellation hook and uses the public test-context skip mechanism
before inherited snapshot/mock-reset state and the test body can start.
Keep the base completed-task hook and native yield. No private RPC import,
RPC replacement, duplicate update, synthetic production message or global mutex.

Prototype/control config under `outputs/qa-rpc-ack-barrier-20260907/` passed
10 delegate/barrier controls plus 6 real fixture tests (16/16, exit 0) before
canonical wiring. Required real acceptance: unchanged uninstrumented bridge
15/15 AND process exit 0, both typechecks, focused existing consumers and one
full check with unchanged 4/2 workers and deadlines. Residual full-check failures
must remain visible. No independent PASS is inferred from Codex's local checks.

Limits: does not bound arbitrary >60-second blocking within one task, queued
but not yet sent updates, other RPC methods or every possible reporter plugin.
It observes the public delegate installed by the verified Vitest 3.2.4 runtime;
missing delegate fails closed. No dependency upgrade or time-based ACK guess.
Controls cover exact identity/calls, delayed/new/rejected updates, file reuse,
concurrency, synchronous errors, cancellation during wait and failure after cancel.
Real subprocess controls retain hooks/snapshots/fake clocks, default 5000ms
timeout, assertion/hook/unhandled failure and bail behavior. No old limits move.

The existing Supervisor/Wizard splits and 226 expectation chains are retained
unchanged. This remains test-only: no cost, key, provider, artifact mutation,
render, story/package promotion, payment or deployment. P1 remains HELD 0/3/3;
remaining M1b/M2 and product acceptance are separate. Rollback: revert only this
focused milestone after preserving unrelated work; no data migration or cleanup.
Claude first pass must be read-only against the eventual immutable commit range.

### Final ACK-barrier verification

All following results use the final canonical code unless labeled prototype or
negative control. Logs are in `outputs/qa-rpc-ack-barrier-20260907/`.

| Validation | Actual result |
| --- | --- |
| Opt-in prototype before canonical wiring | 2 files / 16 tests, exit 0, 829ms |
| Runner / execution-policy / classifier | 3 files / 33 tests, exit 0, 10.29s |
| Diagnostic taxonomy / check supervisor | 2 files / 27 tests, exit 0, 797ms |
| Unchanged, uninstrumented bridge in isolation | 1 file / 15 tests, exit 0, 181.24s total, 178.23s aggregate tests |
| Existing split Supervisor / Wizard | 2 files / 63 tests, exit 0, 102.35s |
| Both root and autonomous typechecks | exit 0 (also prerequisites of the delivered full check) |
| Deliberately broken yield-only mutant | delayed-ACK regression fails at the expected early base-hook call, exit 1 |

Canonical focused total is 138 tests across 8 files. The 10 new promise controls
substitute the base runner to observe delegation precisely. The six existing
subprocess controls, affected suites and bridge exercise installed Vitest itself.
Controlled delayed/rejected ACK and mid-wait cancellation are unit controls,
not injected packet faults in the real bridge. The negative mutant changes only
the drain condition in an ignored prototype copy: 1 expected failure, 9 tests
not selected by the explicit name filter; no canonical skip or code mutation.
The first focused command included an unmatched `run-vitest-check.spec.ts`
selector; only the three real suites/33 tests are counted. The actual supervisor
was subsequently run explicitly with diagnostics (27 tests).

The **one** delivered `npm run check` exited **1**, after both typechecks:

| Phase | Files pass/fail/skip | Tests pass/fail/skip | Recorded phase elapsed | Workers |
| --- | --- | --- | --- | --- |
| Ordinary | 339 / 8 / 17 | 4864 / 19 / 73 | 124210ms | 4 |
| Resource-intensive | 21 / 1 / 0 | 660 / 0 / 11 | 287587ms | 2 |

Exactly 386 canonical files = 364 ordinary + 22 resource-intensive, one launch
per phase; forks, isolation and file parallelism retained. Both diagnostic
channels are valid with one completion record each. Both classify only
`signal_or_exit_failure`: zero RPC, test/hook/process timeout, launch or signal
errors. Bridge 15/15 (203914ms), Supervisor 48/48, Wizard 15/15 and runner 16/16
pass under aggregate load. No repeat-until-green full run.

The 19 failed test headers and one failed setup-suite header match the previous
single-yield full-check log exactly (`identicalFailureHeaders: true`, no new or
resolved headers). The remaining failures are ten missing-fixture cases, eight
correction review/corpus binding cases, one review golden mismatch, and the
correction-acceptance beforeAll binding failure (11 tests skipped by Vitest).
This is observed signature equality, **not proof that every root cause is
inherited**, and not permission to label the repository gate green.

Evidence SHA-256:

- `prototype-control.log`: `dbf6820cbffcbd4208d2831cff7d7ce141161251d906420831489950b54525ce`.
- `focused-infrastructure.log`: `2a1297941e5b9268ade735c0878f0a425f20cc2a91965db0390c7f306918acaf`.
- `focused-supervision.log`: `9d52a52402d7d461e5f5f7b29ffc42abb308dd2830bceb436f567d7ac90d5df1`.
- `bridge-canonical-isolated.log`: `ace6151db22122b5d810d1132714400d89212ab7366cf7a0b96a04f323d6fe5b`.
- `focused-affected.log`: `6edf9b9197b2c959bf2bafc3be06f8cbb4a4cfed2d30c02d791849435f7a7a86`.
- `npm-run-check-delivered.log`: `014b8909310283683266d2dbcb0ec66dbd265da22c7e44f50745283b378635f0`.
- `check-analysis.json`: `df5678e6a3ca3526e34a510c424cc68cd39d83f7a78a9a5f597cee8c9ca5c2e6`.

The unchanged bridge source SHA-256 is
`e0fec7ec11cdec8ed8d3ff79ee522598b125fd78c7aa97949f7469a6c615f20e`.
All seven other draft code/config/test paths still match the prior HOLD manifest;
only the runner and its regression spec changed in this successor. The prior
163 + 63 expectation-chain mapping remains applicable without alteration.
The original P1 root recomputes 14 regular single-link files / 412516 bytes /
raw inventory `cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
Read-only dependencies remain clean at d53b `768ccb2f`, accepted-intent
`63ccb484`, detached baseline `a0344114`; cached upstream of the implementation
branch was `a0344114` at validation closeout. No refreshed remote parity claim.

### Independent QA handoff boundary

Original requirement: prevent already-sent Vitest updates aging across multiple
synchronous tests, without weakening test results, deadlines or concurrency;
preserve independent Supervisor/Wizard scenario coverage. Review the focused
delivery commit from immutable base `3a455c48132fcb61d98f02ccf06f473fcdac1d8c`
on `codex/r3b1b-semantic-recovery-m1`, worktree
`C:/GNart/Work/sh-r3b1b-semantic-m1`. The task handoff supplies the full committed
HEAD/range and copy-ready commands. Stop if the reviewer sees different topology.
No reviewer has yet passed this range, and the earlier compatibility PASS ends
at the base; no independent PASS boundary is extended by Codex.

Try to falsify: delegate installation order and exact promise/receiver/error
identity; no duplicate sends or private imports; failed/new ACK handling;
repeated file hooks and cancellation mid-wait; concurrent overlap; inherited
mock/snapshot setup and real negative subprocess exits; same 226 split-spec
expectations; unchanged inventory/limits; bridge process exit rather than only
assertion count; truthful residual full-check and semantic HOLD boundaries.
No provider, credential, production artifact, render, package or payment action
is needed or authorized for the review. First pass is review-only.

The sections below preserve the previous attempt and its failed acceptance.
Their historical HOLD is not rewritten as a pass by this successor.

## Original approved Decision Gate (single-yield attempt)

Guy's `מאשר` approves the proposal in
`outputs/qa-m1b-timeout-diagnostic-20260907/RPC_DIAGNOSIS_AND_GATE.md`.
That original diagnostic remains historical and unchanged; its then-pending
approval is superseded by this explicit implementation approval.

### 1. Proposed change

Extend the installed standard Vitest runner, delegate its completed-task hook,
then yield once using native `node:timers/promises.setImmediate`. Split measured
compound filesystem and Wizard audit tests into independent fresh-fixture cases.

### 2. Why now / established cause and limits

On unchanged `3a455c48`, the real 15-test bridge passed every assertion but
exited 1 with an onTaskUpdate RPC error. A read-only observer measured a 221162ms
worker loop gap. An opt-in yielding runner executed the same 15 names in the same
order, passed all 15, exited 0 and measured a 29613ms maximum gap. Both were
sequential single-file diagnostic runs with the same observer, not benchmarks;
load/cache/order were not controlled. Aggregate test time still exceeded the
60-second RPC deadline in the passing intervention. No IPC packet IDs were
observed. This supports worker starvation for this reproduced failure, not a
universal diagnosis for every historical RPC error.

Installed Vitest 3.2.4 / @vitest/runner sends updates as pending promises; a
synchronous-test microtask chain can defer the event loop while birpc has its
independent 60000ms acknowledgement deadline. The implementation replaces no RPC
hook and catches no errors. A single task blocking beyond the deadline can
still fail; this change must not relabel that failure.

Separate unchanged 5-second compound-test timeouts were reproduced: one
Supervisor case creates three Git fixtures (41 synchronous Git calls took
3904ms inside one successful 4535ms measured run); Wizard cases perform three
or four full audits. Between-test yielding does not shorten these bodies.

Diagnostic logs under `outputs/qa-m1b-timeout-diagnostic-20260907/`:

- `bridge-loop-diagnostic.log`: SHA-256 `2e6617f484bb47e2e1d8d359cf7f2caf5ca2c1ec5ea6eda93368995ea8425caf`.
- `bridge-yield-diagnostic.log`: `e5dfa64efae0372498ecf36d6c9bbbc0e756f89bb9b9af4d2f77815d9a408a53`.
- `yield-negative-controls.log`: `13b0f5deed4ad19995647a5a6a6a8de0227b2f34380695c09b58c866bc5c6c39`.

### 3. Scope and topology

General test infrastructure only; no production code. Continue in the same task
at `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`, immutable implementation base
`3a455c48132fcb61d98f02ccf06f473fcdac1d8c`. At start: clean, ahead 1 / behind 0
of cached upstream `a03441145a442410cdaf0e799fac028517c1dcf6`. No current server
parity or actor is inferred. Dependency worktrees remain read-only: d53b at
`768ccb2fe20edb1351cb4783796613cbf7a2993c`, accepted-intent wave 2 at
`63ccb4846ebe5be9ab392960d389610a1b2b9d42`, diagnostic baseline detached at
`a03441145a442410cdaf0e799fac028517c1dcf6`. No cleanup is authorized.

### 4. Hardcoding risk

The runner has no story, task-name, path or PID allow-list. Splits preserve all
assertions and cross-call comparisons; they create fresh fixtures and restub
the original environment explicitly. No production cache or canned result.

### 5. Files and commit boundary

One focused local scheduling milestone: canonical runner + config wiring,
new real subprocess regression spec, intentionally failing `.fixture.ts` and
explicit fixture-only config, classifier inventory assertions and manifest,
the two split specs, CURRENT/ROADMAP and this evidence. No package/lockfile edits.
New subprocess spec is resource-intensive with `direct_child_process_load`;
all existing classifications remain unchanged. Exact inventory 386 = 364 + 22,
up one from 385 = 364 + 21; failing fixture is not a canonical spec.

### 6. Expected behavior and assertion mapping

Preserve pool/isolation, worker limits 4/2, file parallelism, test/hook/RPC
deadlines, cancellation and base hook/snapshot semantics. Native yielding works
even if a test leaves fake timers active. No retries or result mutation.

| Original compound case | Replacement cases / retained comparisons |
| --- | --- |
| Supervisor symlink/junction and hard-link escape | Mandatory hard-link rejection; directory symlink/junction rejection; file symlink rejection. Each retains its own complete setup and expectation. Host capability exceptions unchanged. 46 to 48 tests. |
| Wizard historical accepted lineage (3 audits) | Current override vs current digest (2 audits); current vs historical lineage and qualification (2 audits). All 8 expectations retained. |
| Wizard determinism/environment (4 audits) | Determinism plus effects (2 audits); disabled bank (1 audit); production QA-catalog exclusion (1 audit). All 9 expectations retained. Wizard 12 to 15 tests. |

No shared mutable fixture or skipped existing case. The historical comparison
split adds one real audit rather than caching production results.

### 7. Acceptance / validation plan

Both typechecks; focused runner/classifier/execution-policy/supervisor tests;
affected Wizard and Supervisor specs. Real child controls must preserve positive
results, snapshots/hooks, fake clocks and concurrent overlap; intentional
assertion failure, default 5000ms timeout, hook failure and unhandled rejection
must still exit 1. A bail control must cancel the remaining test.
The new subprocess integration budgets (30 seconds including CLI startup,
25-second child watchdog) do not change any existing or child test deadline.
Then one delivered `npm run check`, including the unchanged 15-test bridge under
the canonical two-worker resource phase without instrumentation. Report every
residual failure, not repeated full checks until green.

### 8. Cost

$0 external spend. No provider, real credential, image/audio generation or render.
Git commands in fixtures target their own local temporary repositories only.

### 9. Rollback

Revert the focused commit after preserving unrelated changes. No migration or
production artifact mutation to undo. Do not remove baseline worktrees/junctions.

### 10. Review assignment and acceptance

Guy approved this test-only implementation, not a broader policy change.
Claude Code first pass is read-only against the final immutable base-to-head
range. Try to falsify native-yield wiring, base delegation, unchanged deadlines,
failure preservation, exact-once inventory, assertion coverage and aggregate
claims. No Cowork visual/UX review is needed. Codex does not self-award an
independent PASS. Guy's product/render acceptance remains separate.

### 11. Stop-check / exclusions

This is a general test-only fix with no direct production/visual behavior or
spend. Smallest proof is real control subprocesses then the affected suites.
No timeout increase, worker reduction, full-suite serialization, retry,
quarantine, skip, ignored unhandled error, dependency upgrade, production/story
fix, real key access, provider call, render, payment, deployment or push.
No product visual decision or image eyeballing is needed for this milestone.
Any further architecture/policy expansion returns to Guy.

## Previous independent PASS (does not extend into this range)

Guy supplied Claude Code's independent review of `a0344114..3a455c48`:
PASS P0=0/P1=0/P2=0 for M1b compatibility only. It reproduced 361 tests, both
typechecks, exact captured-response replay with providerCalls=0 and identical
candidate, plus 14 protected files / 412516 bytes / raw inventory SHA-256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
The growing timeout population was a forward risk, not a QA finding or full PASS.

P1 remains semantically **HELD at P0=0/P1=3/P2=3**; group/motion cutover,
completed M1b, M2 and render qualification remain incomplete. Render approval
remains unused; no full-book authority is inferred. Payment remains last.

## Implementation validation

Initial root and autonomous typechecks exited 0. Initial focused development
run exposed a new manifest-order mistake (corrected), Windows absolute fixture
include discovery stalls (changed to repository-relative include), and incorrect
assumptions about JSON reporting (bail is `pending`; JSON alone does not print
unhandled-error text, so the real default reporter is also captured). These
are owned test-harness mistakes, not inherited failures or production defects.
The stalled standalone diagnostic process was stopped by its verified exact
PID; no unrelated process was stopped. This preceded the delivered full check.

### Final focused runs

All paths below are under `outputs/qa-m1b-test-scheduling/`.

- `focused-infrastructure-final.log`: 4 files / 29 tests passed, exit 0,
  11.11s. Six real subprocess controls passed, including all four intentionally
  failing modes retaining exit 1 and bail retaining exit 1 with the second task
  `pending` (Vitest JSON representation). Child default timeout is explicitly
  asserted to remain 5000ms. SHA-256
  `abab35f9ed10f281d77f204b8da8c8a135c783a5df182f541323547f3e7d4c72`.
- `focused-affected.log`: 2 files / 63 tests passed, exit 0, 119.74s
  (Supervisor 48, Wizard 15). No unhandled RPC error. SHA-256
  `d1c74850a297966a2e8012b56faf5ed7a5da6c57da46e2b25bae71abc100c30a`.
- `assertion-mapping.log`: TypeScript AST/printer comparison of each complete
  `expect(...)` chain against `git show 3a455c48:<path>` found identical sorted
  multisets: Supervisor 163/163, Wizard 63/63, exit 0. This verifies no assertion
  removal/modification, not just equal counts. Direct `it(...)` syntax counts
  are 26 to 28 and 12 to 15; the first excludes expanded `it.each` rows, so the
  actual Supervisor runtime count is 46 to 48. SHA-256
  `0a3e19ecf42de792978c216e3141474064de85c220cd67b0c201ebdee50b5f39`.

Commands (sequential, from the execution worktree):

```powershell
npx tsc --noEmit
npm run story:autonomous-typecheck
npx vitest run lib/__tests__/cooperative-vitest-runner.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/vitest-check-supervisor.spec.ts lib/__tests__/vitest-execution-policy.spec.ts --reporter=verbose
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/live-execution-supervisor.spec.ts --reporter=verbose
npm run check
```

The delivered full check uses the canonical config and supervisor, with no
diagnostic loop-observer preload.
The original held P1 inventory was recomputed after focused tests and remains
14 / 412516 / `cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

### One delivered full check — exit 1, not relabeled green

`npm-run-check-delivered.log`, SHA-256
`9f93214e33ccb16e58c1d8bac50abac65b592c6851a7e6ca172e26c8623c9c2c`.
Both typechecks passed before the two sequential phases. Each phase launched
exactly once with the canonical isolated forks, worker limits 4/2 and file
parallelism retained. No source/config edits occurred during the run.

| Phase | Files passed / failed / skipped | Tests passed / failed / skipped | Supervisor elapsed | Exit |
| --- | --- | --- | --- | --- |
| Ordinary (364 specs, 4 workers) | 339 / 8 / 17 | 4864 / 19 / 73 | 137169ms | 1 |
| Resource-intensive (22 specs, 2 workers) | 21 / 1 / 0 | 650 / 0 / 11 | 316714ms | 1 |

Inventory is exactly 386 = 364 + 22. Both diagnostic channels validated and
reported only `signal_or_exit_failure`; no onTaskUpdate RPC error, test timeout,
hook timeout or process timeout was emitted in this run. This is observed
closure in this run, not proof that every historical timeout had one cause or
that a future single blocking task cannot exceed its RPC deadline.

The real unchanged bridge passed 15/15 under the two-worker resource phase,
209270ms aggregate; Supervisor passed 48/48 and Wizard passed 15/15. The six new
runner controls also passed in aggregate. All 16 formerly failing resource
test assertions passed here; the phase still exited 1 due to the separate
correction-acceptance setup failure below. A separate uninstrumented canonical
bridge run is therefore required to demonstrate its own process exit 0 rather
than misreporting this aggregate phase's exit.

Residual failures (all left visible; no quarantine or added skip):

| Surface | Remaining failure |
| --- | --- |
| child-lexicon-ages-5-8 | 1 missing ignored story fixture |
| momentum-gate-koko | 1 missing ignored story fixture |
| page-entity-qa | 1 missing local PNG fixture |
| story-read-back-validation | 2 missing ignored story fixtures |
| story-source-visual-direction-acceptance-lifecycle | 4 missing ignored Visual Directions output fixtures |
| reserved-page-placement-authority | 1 missing production-scale offline fixture |
| story-source-visual-direction-correction-batch | 8 review-batch/storyboard-corpus binding failures |
| story-source-visual-direction-review-batch | 1 deterministic digest golden mismatch |
| story-source-visual-direction-correction-acceptance-lifecycle (resource) | beforeAll binding failure; its 11 tests skipped by Vitest, not newly marked skipped |

`ordinary-failure-comparison.log` compares exact failed test names to the prior
compatibility delivered log: 21 to 19, no newly failing name; the removed two
entries correspond to the Wizard cases mapped above (one was renamed/split).
The prior delivered log remains SHA-256
`fd80e8c96b26ee6fbba421eca1d86a80afc1b8fa8b398e926865d3fc43d17d00`.
Matching names/signatures are not blanket proof of inheritance or a root-cause
diagnosis for every residual failure. No residual code/fixture repair was
included in this approved scheduling milestone.

The 92 focused assertions are green, but the scheduling milestone is NOT ready
for independent acceptance: the isolated acceptance failure below blocks its
closure. The remaining non-green repository gate is also an explicit blocker
for later readiness claims. No P1 recovery or render qualification is inferred
from cleaner aggregate test scheduling.

### Final isolated acceptance — FAIL, retained without retry

Command, unchanged canonical config, no diagnostic observer:

```powershell
npx vitest run lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts --pool=forks --isolate --reporter=verbose
```

`bridge-canonical-isolated.log`: 1 file passed, 15/15 assertions passed,
**one unhandled onTaskUpdate RPC timeout, exit 1**, 273.79s total, 270.97s
test aggregate. SHA-256
`ccc2e38f66b6c2d8b3e576fe1cc4aeff4b919affdbcd0e3addca2581fc178a37`.
Bridge spec remains byte-identical at SHA-256
`e0fec7ec11cdec8ed8d3ff79ee522598b125fd78c7aa97949f7469a6c615f20e`.

This falsifies the proposed isolated process-exit acceptance criterion.
It does not erase the earlier full-run observation (zero RPC errors in that
specific run), nor permit an overall RPC-closure claim. The longest reported
test body was 56783ms; none of the reported bodies exceeded 60000ms. There was
no event-loop or IPC observer in this run, so the failing packet, its send/ack
times, actual loop gaps and causal load/reporter contributions remain unknown.
Do not assert a measured single-task >60s gap or an exact packet delay.

Source check after failure narrowed a design limitation:

- `@vitest/runner/dist/chunk-hooks.js:1648`: the completed-task hook is awaited
  **before** `updateTask("test-finished", ...)`; our yield is not after every
  final update has been enqueued.
- `sendTasksUpdate` at line 1456 tracks promises without awaiting each one;
  `finishSendTasksUpdate` drains them at the end of the files run. The custom
  hook neither accesses nor drains those promises.
- `vitest/dist/chunks/index.CwejwG0H.js:47` wraps the task-update hook with a
  real RPC promise. Returning from a native yield is not proof that this promise
  has resolved. [Node 22.19.0 documents setImmediate as event-loop scheduling](https://nodejs.org/download/release/v22.19.0/docs/api/timers.html#setimmediatecallback-args),
  not an application-level acknowledgement barrier. The relevance of this
  limitation to the exact failed packet is an inference, not captured proof.

The small controls prove one native callback can run between tests; they do
not simulate delayed two-process acknowledgement. That coverage gap is now
explicit. No extra yield/delay, retry, RPC method replacement, private API
import, worker reduction, raised deadline or third-suite rewrite was attempted
to make this failure disappear.

## Hold handoff / next scoped decision

The draft is preserved uncommitted and unstaged at `3a455c48`. No green
milestone commit or independent-QA PASS range is issued because a required
acceptance criterion failed. This is an implementation/diagnostic HOLD, not
a claim that the user-approved work was completed. The original compatibility
PASS and candidate semantic HOLD remain unchanged. No project-remote push.

Recommended next bounded step: read-only send/ack timing instrumentation for
one real bridge run, plus a small delayed-ack regression reproducer. Record
only timestamps, event kinds and local sequence counters; no message payloads,
credentials, environment dumps or real provider access. Distinguish updates
enqueued before/after hooks, worker opportunity to receive acknowledgements,
and main-side reporter/ack completion. Preserve canonical source/config and
all deadlines while diagnosing, and do not rerun the full gate until a
separately justified code change exists. This is the follow-up proposal, not
an already executed or silently scheduled task.

Before further canonical changes, report the observed mechanism, supported
public extension options, fallback risks, exact files, acceptance controls and
rollback under a new Decision Gate. Do not import private Vitest RPC internals
or expand into bridge case restructuring by implication. Independent Claude
QA should receive a committed immutable range only after local acceptance is
actually met. No cleanup, provider, render, payment or deployment is needed.

## Final preserved state

After the isolated failure, both root and autonomous typechecks were rerun and
exited 0; `git diff --check` exited 0. There are no staged paths. HEAD remains
`3a455c48132fcb61d98f02ccf06f473fcdac1d8c`, ahead 1 / behind 0 of the cached
upstream. This draft added no commit. d53b, accepted-intent and detached baseline
dependencies remain at the recorded heads and clean. Final P1 recomputation
still returns 14 files / 412516 bytes / raw SHA-256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
No bridge/control subprocess remains running. No project-remote push or spend.

The ignored `outputs/qa-m1b-test-scheduling/HOLD_HANDOFF.md` contains the exact
draft path inventory and inspection-only PowerShell handoff. This is not the
normal committed independent-QA handoff; no push command is offered for a
milestone that failed its own acceptance criterion.

## Subsequent approved diagnosis (2026-09-07)

The previously proposed bounded request/ack diagnosis was subsequently approved
and completed, without modifying any of the draft's canonical code/config/tests.
All 17 real requests matched their four timing points; 14 acknowledgements
spanned at least two completed yields. Maximum worker round trip 46237.9475ms,
maximum main handling 1.0346ms. The instrumented run passed 15/15, exit 0; it
does not replace the failed uninstrumented acceptance recorded above.
Exact evidence, instrumentation limits, controls and a newly proposed actual
ACK-promise barrier Decision Gate are in
`outputs/qa-rpc-ack-diagnostic-20260907/RPC_ACK_DIAGNOSIS_AND_GATE.md`.
At that diagnosis closeout the new mechanism was not approved or implemented,
and the draft remained HOLD, uncommitted and unstaged. The later approval and
implementation are recorded at the top; no independent QA or render authority follows.
