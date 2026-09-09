# M2b — v6 reviewed-reconciliation execution

Date: 2026-09-09. Status: CODE PASS THROUGH8766aff1; DOCUMENTATION P2 CORRECTED; RE-GATE PENDING.

## Independent review and focused-command correction

Claude supplied PASS P0=0/P1=0/P2=1 for exactly c0b3334e..8766aff1, extending
the independent code boundary to8766aff1 only. Reported reproduction:
135/135 focused,140/140 hostile harness checks,5767passed/73existing skips/
0failed full gate, both typechecks. These are reviewer-attributed executions.
The reviewer disclosed two corrected scratch-harness bugs; its final report
confirms the real approval, pending bridge, packet and protected P1 unchanged.
No independent product acceptance or real positive execution of the new route.

P2-1 is valid: a nonexistent focused filter did not fail Vitest, and the tracked
operational block still exposed that historical typo for copying. The corrected
block below lists exact files, checks each exists and rejects duplicates before
invoking Vitest, and pairs the command with expected5 files/135 tests at8766aff1.
The expected output must be checked by the operator; exit0 alone is insufficient.
This is a documented preflight, not a new global runner or automated output-count
gate. The prior103+32 execution history and original logs are preserved.

Correction start: clean8766aff1, ahead1/behind0, upstreamc0b3334e, same sole-writer
task and implementation root. Dependencies clean at768ccb2f and63ccb484.
Scope: CURRENT, ROADMAP and this document only. No production/test/script edit,
new artifact authority, credential/provider access, spend or push. The cosmetic
double validation observation is not a finding and is left unchanged. No new
size policy, downstream cutover or timing fix is bundled into this correction.
Correction validation: extracted the exact published block and executed it with
a process-local npx stub in PowerShell7.6.5 and5.1.26100.9444. Four checks in each:
valid five-path arguments reach one invocation; the original missing filename
and a duplicate each reject before invocation; simulated exit7 is propagated.
No actual focused/full Vitest rerun in this documentation correction. Root
`npx tsc --noEmit` exit0; `git diff --check` exit0. Original P1 inventory again
14files/412516bytes/cd621f77..., and the three real artifact hashes below match.
Local harness/logs: outputs/qa-m2b-focused-command-p2-20260909, ignored/untracked,
stored only here; no verified off-machine backup and not preserved by Git push.
preflight-ps7.log SHA256: `8f5200495eb45abe649a24ca68e184f0f6de3cdc87a71aa8d929f9236e11db58`.
preflight-ps5.log SHA256: `ff3a0248abf4a7094defd4796d96d79a9671bf901c75865c456f31b58dfee8e3`.
The immutable correction range is in its separate correction handoff.
Independent closure is pending; this document does not self-extend code PASS.

The following implementation account is historical at its original handoff.

## Requirement, topology and authority

Guy: proceed toward a ready book, under the existing approved semantic-recovery
Decision Gate. Same sole-writer task, branch
`codex/r3b1b-semantic-recovery-m1`, worktree
`C:/GNart/Work/sh-r3b1b-semantic-m1`, immutable implementation base
`c0b3334e6fb4765af6f909cf3e3dd34780a88256`.
Start: clean at that HEAD. Authorized documentation push advanced live origin
from28f25ef7 to c0b3334e, exit0; observed parity0/0. No authorization to push the
new implementation is inferred. Dependencies d53b768ccb2f and accepted-intent
63ccb484 remain protected/read-only. No cleanup or second writer.

Supplied Claude disclosure re-gate00ad3142..c0b3334e PASS0/0/0 closes the storage
wording P2 only. Independent code PASS still ends at28f25ef7. Claude has not
reviewed this implementation. Codex does not award independent PASS.

## Investigation and expected behavior

Observed: v6 pending bridges include corrected template AND coverage but the
existing reviewed-reconciliation loader only accepts v5. The pure decision
application engine already supports the required explicit source/presentation
mapping when given the correct visual authority. Blueprint/package callers
still load synchronous v5 production contexts; changing only a version string
would not integrate them and would manufacture authority.

Root cause: the changed-coverage bridge stops at a pending projection and lacks
a fresh-chain-bound review/approval route. Its80 pending findings represent
unreviewed obligations (13frames,54presentation requirements), not80 new defects.

Solution: extract the existing pure compiler, leave its v5 loader/persistence
unchanged, and use it behind v6 fresh-chain validation. Reviewer decisions are
explicit and exact; no default automatic preservation, supersession or rebind.
Rejected: fake provider Candidate, v5 relabeling, duplicated reconciliation
engine, skipping reconciliation, broad async conversion of all consumers in
the same authority-boundary change. No migration is needed for old artifacts.

## Implementation and acceptance criteria

- `lib/visual-package/reconciliationAuthoringLifecycle.ts`: pure
  `ReconciliationAuthoringBasis` and `buildReviewedReconciliationContent`.
  Existing v5 prepare delegates the identical computation, with unchanged
  loading, approval and persistence. The helper returns pending content, not
  approval authority. Hypothetical validation uses the existing reserved2000
  timestamp, never an actual approval record.
- `lib/visual-package/semanticCorrectionApprovalBridge.ts`: four v6 operations
  prepare/read review and record/read approval. Stored review includes exact
  decisions, plan, pending reconciliation, content review and Markdown. Reads
  reconstruct the entire payload via fresh historical/current validation and
  reread original bytes after awaits. Corrected identities are preserved.
  Exact approval pins review digest and canonical Guy/timestamp metadata,
  rejects the prospective timestamp, validates complete approved reconciliation,
  and rebuilds its review bundle. It is not authentication or a signature.
  Both new artifact categories are content addressed under contained outputs;
  previews create no output, replay is immutable/idempotent. Writer rejects
  artifacts over the existing reader4MB limit before output creation.
- `scripts/semantic-correction-approval-bridge.ts`: strict one-request JSON
  interface adds `prepare-reconciliation-review`, `read-reconciliation-review`,
  `approve-reconciliation`, `read-reconciliation-approval`. Only prepare-review
  can carry up to1MB of inline decisions; other requests retain32KB. Errors are
  sanitized and report providerCalls0. Shared module inputs are copied before
  asynchronous validation; there is no validator/proof injection API.
- Existing approval-bridge test spec: adds hostile and positive tests on the
  real P1 fixture and real reconciliation engine. No new spec/inventory entry.

Acceptance: v6 uses corrected coverage, rejects incomplete/duplicate/stale or
cross-page decisions, binds exact digest/subject/review, rejects payload or
current-proof drift, preserves v5 compatibility, and never emits a Blueprint/
package production context. All remain offline. No guard/timeout/worker change.

## Validation record

Initial incremental run:69/69 passed. Added positive rebind fixture initially
pointed to its unchanged original pointer, correctly rejected by the engine;
the test also incorrectly accessed `presentationRequirements.dispositions`,
which root typecheck rejected. Fixed TEST ONLY: choose a different same-page
pointer and read `presentationRequirementDispositions.entries`. No production
validation was relaxed. That development run was72pass/1fail, exit1; raw output
is retained in task history, not a standalone log. Subsequent bridge-only
run73/73 passed in `outputs/qa-m2b-reconciliation-20260909/bridge-focused.log`.
Final suite adds one CLI negative test (74 total in this spec).

Final focused suite:103/103 passed across4 specs, exit0,155.49s. Separate
current-consumer suite:32/32 passed, exit0. Combined135/135 across5 specs.
Full `npm run check`: exit0, both root and autonomous typechecks passed;
ordinary5096passed/73existing skips, resource671passed, total5767passed and
0failed. Inventory391=369ordinary+22resource, workers4/2 unchanged. One full
run was performed for this milestone; no retry-until-green, timing change or
test skip. Phase times103699ms/223207ms. The historically flaky supervisor
fake-key rejection passed in1162ms here; that does not resolve its open P1.
Environment actually observed: PowerShell7.6.5, Node22.19.0. Do not transpose
Claude's previous PowerShell5.1 environment claim onto this execution.
The initial focused command included a nonexistent
consumer-validation filename; Vitest selected only the four real specs. The
actual `semantic-correction-consumer.spec.ts` is run separately and reported
separately, not silently counted as part of that command.

Supported focused rerun for reviewed8766aff1 (PowerShell5.1 and7 compatible).
Expected: **Test Files5 passed(5); Tests135 passed(135); exit0**, no skips.
Breakdown:74 approval/reconciliation +15 bridge +32 consumer +7 reconciliation
+7 classifier. Stop and investigate any smaller count, even if exit0.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$focusedSpecs = @(
  'lib/visual-package/__tests__/semantic-correction-approval-bridge.spec.ts'
  'lib/visual-package/__tests__/source-prompt-reconciliation.spec.ts'
  'lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts'
  'lib/visual-package/__tests__/semantic-correction-consumer.spec.ts'
  'lib/__tests__/vitest-workload-classifier.spec.ts'
)
if ($focusedSpecs.Count -ne 5 -or @($focusedSpecs | Select-Object -Unique).Count -ne 5) {
  throw 'Expected five distinct focused spec paths'
}
foreach ($focusedSpec in $focusedSpecs) {
  if (-not (Test-Path -LiteralPath $focusedSpec -PathType Leaf)) {
    throw "Missing focused spec: $focusedSpec"
  }
}
# At8766aff1 expect5 passed files /135 passed tests; verify the printed counts.
npx vitest run @focusedSpecs --maxWorkers=2
if ($LASTEXITCODE -ne 0) { throw "Focused Vitest failed: $LASTEXITCODE" }
```

Historical execution, not a supported copy-ready command: the first run used
the same four other filters but mistyped the consumer filter as
`lib/visual-package/__tests__/semantic-correction-consumer-validation.spec.ts`;
it selected4 specs/103 tests. The separate correct consumer run used
`semantic-correction-consumer.spec.ts --maxWorkers=1`,32 tests. The full gate
was `npm run check`. Original logs were captured with `2>&1 | Tee-Object` and
the original `$LASTEXITCODE` propagated. The corrected block does not rewrite
what those logs recorded. SHA256:

- bridge-focused.log: `5d3cde185474feb56c16986a13167ac29a6502618b90ff397c078a514d16ac66`
- focused-final.log: `d7898b8c359e435fba56d24e9259dff490a98f5ca638a58daeca13bf5e3b6459`
- consumer-focused.log: `1f71daa6d7dbbb5d54dd80466adb0dfecd0073c576252529db5d87df11ebbb29`
- full-check.log: `ce15a8c450d12c837851813588df5c3f23408d47d864926a7a7dc276ef09affb`

## Runtime, preservation and limitations

No real P1 review/approval is minted from unreviewed code. Positive tests mock
ONLY historical/current validation and current Git, using the real fixture,
transformation, canonical storage and strict reconstruction. Test source
mappings exercise structural pointers; they are NOT product judgments and must
not be reused as approved real content. Real CLI negative paths run with the
deny-network preload. A real clean-parity positive run remains after code QA;
neither mocked tests nor historical runtime evidence close that gap.

Original14-file P1, packet b7fdd4e5 and real approval c2b51f0d/pending bridge
80177ac9 are not rewritten. Pending bridge80177ac9 remains historical at28f25ef7.
Preservation was recomputed during validation using the Gate's original
published inventory command from d53b:14files,412516bytes, inventory SHA256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
Raw file hashes also match the earlier evidence: approval
`522e48e78350c93042bcc59c9df41386caf3a64f41527ffd51eb5346362a536e`, pending bridge
`c2251c152a90fc5a1ce9ac4313e688bfe293b0231b807f3c1a8f1ce969bbc44c`, packet
`d2020e7381679502380fa44c0e1c357da4204155f73885adabb479759eb3c4ba`.
New review/approval chains deliberately inherit current-proof freshness; later
code movement stales them. Exact semantic acceptance itself remains valid;
real downstream integration must precede minting a production approval chain
intended for that consumer HEAD. Never refresh by mutating old artifacts.

All logs under `outputs/qa-m2b-reconciliation-20260909` are ignored/untracked,
local to this machine; no verified off-machine backup. Git push will not retain
them. The prior real artifact/log storage limitation is unchanged; no artifact
is force-added or published. Runtime spendingUSD0; provider calls0 and credential
access0. No source, Candidate, style, Blueprint, package, locator, renderer,
publication, deployment or payment operation. Original P1 semantic HOLD0/3/3
and the out-of-range resource-phase timing P1 remain open. No product/render/
release acceptance is asserted, and M2b is not complete.

## Next functional work and rollback

Original handoff sequence (code review now supplied; P2 correction re-gate pending):
complete actual v6 Blueprint/package context consumers; author/review the real
reconciliation decisions and bind them at the qualified current HEAD; produce
qualified Blueprint/package/Board artifacts, then the bounded visual sample
and approved book render. Unchanged accepted correction must not be sent for
another generic approval. Explicit new reconciliation decisions are not covered
by a fixture or that earlier correction acceptance.

Rollback: do not invoke the four additive v6 operations; v5 remains available.
If code rollback is needed, revert this focused commit with normal review;
preserve all prior artifacts and evidence, no branch/worktree deletion.

## Claude Code — original implementation review brief (completed)

Review-only first pass. Worktree and branch above, base c0b3334e; resolve the
exact implementation HEAD from the final handoff, not an unpinned moving HEAD.
Requirement: advance v6 reviewed reconciliation without losing corrected
coverage or manufacturing approval/production authority. Review all changed
code and call sites, the old v5 route, CLI request bounds, and tests; check that
the pure extraction preserves old serialized plan/content outputs.

Try to falsify: rehashed review/approval substitutions; wrong trusted digest;
wrong source hash, exact-but-cross-page pointers, missing/duplicate decisions;
silent supersession/rebind; prospective approval leakage; current Git/proof or
file drift across awaits; containment/link/collision rules; changed effective
coverage falling back to original coverage; Blueprint/package acceptance of a
null-context approval; mocked positives being represented as real execution;
new full-check failures being called inherited or stability being overstated.
Do not edit, access credentials, invoke providers or mint real P1 approvals.
Guy retains product acceptance. No independent PASS beyond your actual range.
