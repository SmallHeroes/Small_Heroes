# Residual repository gate — diagnosis and proposed bounded correction

2026-09-07. **DIAGNOSIS COMPLETE; IMPLEMENTATION PROPOSED, NOT STARTED.**
Guy approved diagnosis and scoping with `יש אישוטר תתקדם`. Current task is the
sole diagnostic writer at `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`, diagnostic code base
`ef7a13e863e9c5429440f423d2ea541adaef7fb7`. At start: clean, ahead 2 / behind 0
of cached upstream `a0344114`. No remote refresh, push or cleanup in this task.

## Previous independent gate is closed

Guy supplied Claude Code's read-only **PASS P0=0/P1=0/P2=0** for
`3a455c48132fcb61d98f02ccf06f473fcdac1d8c..ef7a13e863e9c5429440f423d2ea541adaef7fb7`.
The reviewed branch/HEAD match local topology. Claude reproduced 60 infrastructure,
63 Supervisor/Wizard and 15 bridge tests, both typechecks, matching evidence
hashes and unchanged 14-file P1 inventory. Its broader yield-only mutant run
failed 7/10 controls (Codex's earlier name-filtered run failed the selected one).
Claude did not rerun the full check; it inspected the hashed delivered log and
independently compared its 20 failure headers. Its remote check failed during
a reported network outage; propagation remained unverified. No actor inferred.
That PASS covers scheduling only and ends at `ef7a13e8`, not this diagnosis or
its later documentation commit. No scheduling finding remains to fix.

## Two verified failure families

| Family | Delivered full-check footprint | Root cause |
| --- | --- | --- |
| Non-portable fixture inputs | 10 failed tests across 6 specs | Tests directly read dated, ignored `outputs/` inputs absent from this checkout. The exact inputs still exist in older worktrees. |
| Historical replay policy drift | 9 failed tests plus 1 failed setup suite (11 skipped tests) | The frozen R3-B0b replay now hashes current authoring-policy v22 into all 18 audit records; its approved authority was created with v21. This changes the review and correction identities and correctly triggers strict binding rejection. |

The full gate is still NON-GREEN. No failing test was skipped, deleted, weakened
or declared passed by this diagnosis. No full check was rerun this turn.

### A. Exact replay-policy mechanism and causal control

`c42f3ce678166cda910b4263e26681e2c72c30e4` introduced current authoring policy
v22 while retaining the exported legacy v21 constant. The shared readiness
builder in `lib/visual-package/wizardAllStoryRenderReadiness.ts` uses the current
constant at `records[].authoringPolicy.version`, including when called through
`auditWizardAllStoryRenderReadinessForR3B0bReplay`. The public current/replay
split already isolates gender and accepted-lineage behavior, but not this policy.

The review batch hashes the whole audit row into each
`readinessEvidence.sourceAuditRecordDigest`, then hashes every review record
and the top-level report. `prepareStorySourceVisualDirectionCorrectionBatch`
rebuilds that review and checks immutable expected digests at
`validateStorySourceVisualDirectionCorrectionPlanBindings`; the guard is doing
its job, not a candidate for removal or repinning to the drifted output.

Verified original batch:
`C:/GNart/Work/sh-r3b0b-story-source-review/outputs/r3b0b-story-source-visual-direction-review-batch/7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143.json`.
Its canonical digest is valid and raw SHA-256 equals the pinned
`143ff1a7a0f67382ae5efce1deecf492761bb51809f7183cf6c8304c682d5a08`.

Recomputed historical and current replay reports differ in exactly **19 leaf
values**: authoringPolicy.version on all 18 rows (v21 -> v22), plus the resulting
top-level digest. No other report value differs. Their report digests are
`4e0a667926639526b106bc45cd3c4e7df7c11518d7cf941e35d528d856294977` and
`6c08fc71469d4a6fd911aa70c397cdad490fdb78de3538539c5cce63979a1203`.
Current review digest is
`6a549d1339ce364659e521b1d280a7250a3d331e0205b3a4c69b0a203e3efd6a`.
Replacing only the top-level audit digest did NOT recover the original review:
the individual audit/record hashes also participate. This rejected shortcut is
recorded in `review-diff.json`, not concealed.

An opt-in Vitest counterfactual wraps only the replay auditor in the diagnostic
module graph, changes row policy version to v21 in memory, and recomputes the
report digest. No canonical module or persisted artifact is changed. Four
controls passed, exit 0, 11.62s:

1. With the real, unmodified auditor, reproduce the drifted review and strict
   correction rejection.
2. With the isolated policy counterfactual, reconstruct the exact approved
   review digest `7a8434c7...` AND original raw bytes hash `143ff1a7...`.
3. Reconstruct the exact original correction batch
   `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`
   with `write: false`, `artifact.created: false`, and reported zero effects.
4. The ordinary current auditor still reports v22 for all 18 stories.

This establishes the causal policy leak for the reproduced binding failures.
It is **not** an implemented correction, a replayed publication/acceptance test,
or permission to relabel actual current state as historical authority.

### B. Fixture dependencies and recoverability

| Failing spec family | Original data found in | Proposed portable input |
| --- | --- | --- |
| child lexicon (1) | `C:/GNart/Work/Small_Heroes/outputs/sprint-11-runs/slot01-sprint11_slot01_night_fear_fox_adventure-prose-uri_premise_10-2026-06-12T07-15-49-776Z/story.md` | Same 6,917-byte story as a tracked regression fixture |
| momentum (1) | main checkout `outputs/story-gen-v3-runs/koko_scenario_2_transition-stop2-2026-06-09T14-35-00-165Z/` | Same beats, premise and spine JSON (20,487 bytes) |
| story read-back (2) | main checkout `outputs/story-gen-v3-runs/dini_premise_sprint_b-p10-2026-06-09T09-45-32-833Z/` | Same complete pages and source markdown (15,440 bytes); retain tracked truncated example |
| local PNG transport (1) | main checkout `outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-155755/page-05.png` | Small deterministic valid PNG created for the test; no semantic/visual image assertion depends on this 3,068,484-byte render |
| visual-direction acceptance (4) | `C:/GNart/Work/sh-wt-r1d-output-budget/outputs/r1d-chameleon-first-kindergarten-visual-directions-v1/` | Seven original text/JSON files (31,039 bytes), staged into each test's own temporary repository layout |
| reserved-page placement (1) | `C:/GNart/Work/sh-order-package-authority/outputs/r1d-lantern-blueprint-wire-20260830T044048214Z/bridge-corrected/candidate-template-projections/d96336715724d498a19792df094bfb5f085309f2cf946c853d4e6443c4528f2e.json` | Same 81,574-byte contract, retaining exact production-scale hash and 10-event/6-placement assertions |

The text/JSON source inventory totals 14 files / **155,457 bytes**, excluding
the PNG. These inputs were located and sized read-only; they were NOT copied
into canonical fixtures, linked into outputs or used to mark all ten tests
passed. More assertions may become reachable when the missing input is fixed;
that remains a validation risk, not a promise that all ten will immediately pass.
Fixture selection must retain provenance, byte identities where authority is
hashed, and inspect source contents before adding them to Git. No broad output
archive, machine-specific fallback or implicit link to another worktree.

## Proposed Decision Gate — not implementation approval

### 1. Change

One bounded residual-gate milestone with two ordered parts:

A. Supply explicit historical authoring-policy metadata (v21 / 16-page policy)
through the existing closed replay lane. Current callers retain v22/current
policy. Use existing exported legacy/version types where suitable; keep this
choice private rather than exposing a caller-controlled production bypass.
Freeze the relevant historical version/page-limit semantics together, without
changing the actual authoring compiler, repair routing or current admissibility.

B. Make the six failing fixture consumers self-contained with the bounded
inputs above. Use temporary outputs per test, preserve the real source examples
and all semantic assertions, and use a tiny valid PNG for byte-transport testing.
Keep the existing PNG transport assertions and add exact-byte checking if useful.

### 2. Why now

These two families account for all currently recorded residual failures and
block a full-green repository gate. The ACK runner itself is independently closed.

### 3. Scope and ordering

Same task, branch/worktree and sole writer; no parallel implementation. First
historical policy isolation, then portable fixtures, focused validation, both
typechecks, one delivered full check and one focused local implementation commit.
This diagnostic documentation commit does not implement either part.

### 4. Hardcoding risk / rejected alternatives

Historical compatibility is tied to the named replay version, not one story.
Story examples stay data-only in fixtures. Reject updating expected approved
digests, disabling binding validation, changing current policy to v21, copying
entire output trees, optional test skips when files are missing, runtime path
fallbacks to old checkouts, global fs mocks, arbitrary sleeps or raised deadlines.

### 5. Likely files

- `lib/visual-package/wizardAllStoryRenderReadiness.ts` and its existing spec;
  review/correction specs may gain exact historical/current separation controls.
- The six fixture-consuming specs named above and a small tracked fixture
  directory with provenance/inventory; no new canonical spec required by default.
- CURRENT.md, ROADMAP.md and implementation evidence. No dependency upgrade,
  runner/config/workload-policy change or change to immutable approved plans.

### 6. Expected behavior, risks and exceptions

Historical review/correction bytes remain exact; current policy and P1 HOLD
remain untouched. Tests run without dated outputs or access to another checkout.
Preserve current admission and ordinary caller contracts; future current policy
changes must not silently alter the frozen replay. Avoid merely stamping an old
label over changed policy semantics. Stop on new source/content authority drift
or a necessary production behavior change beyond historical replay isolation.

### 7. Acceptance and validation

Exact review `7a8434c7...` / raw `143ff1a7...` / correction `96154a39...` with
unmodified immutable pins; v22 current surface and v21 historical lane remain
separate and tampering still fails. All nine affected specs, current/historical
Wizard tests and existing runner controls pass. Missing-output independence is
explicitly proven; no provider/real credential or external checkout dependency.
Both typechecks and one complete `npm run check` under unchanged 386/364/22
inventory, 4/2 workers and deadlines. No repeat-until-green or relaxed gate.
If another genuine failure emerges, report it rather than broaden silently.

### 8. Cost

$0 provider/render/audio spend. No existing real key use, image generation,
paid re-authoring, Blueprint, Board, package promotion or deployment.

### 9. Rollback

One focused local commit, reversible without production migration. Preserve all
original fixtures, protected P1 artifacts and worktrees. No deletion or cleanup.

### 10. Owner / review / stop-check

Guy approves this bounded implementation before canonical edits. No creative or
visual choice needs Cowork or eyeballing. Claude's first pass is read-only on the
eventual immutable range and should falsify policy isolation, exact authority
reproduction, fixture independence, unchanged assertions and truthful full-gate
status. This is a general recovery/portability fix, not a new story-specific path.

### 11. Exclusions

No revisit of the passed ACK runner, relaxed hashes, story edits, current-policy
rollback, arbitrary test limits, remote push, provider, render, payment, cleanup
or M1b/M2 implementation by implication. Product acceptance stays with Guy.

## Evidence / topology / limitations

Diagnostic artifacts: `outputs/qa-residual-gate-diagnostic-20260907/`:
`diagnose-review.ts`, `review-diff.json`, `current-replay-audit.json`,
`historical-replay-audit.json`, `compare-audits.mjs`, `audit-diff.json`,
`policy-counterfactual.fixture.ts`, `counterfactual.config.ts`,
`policy-counterfactual.log`. They are ignored diagnostic files, not canonical
test discovery or runtime configuration. They contain no fetched credentials.

The historical report was recomputed using that historical checkout's own
module/dependency resolution, not mixed current aliases. Read-only source
checkouts were never edited: historical review `1227495e` clean; order-package
`a3f6491a` clean/ahead 4 cached; output-budget `be2d7e44` has four pre-existing
untracked Set Board files; main `90364542` has pre-existing design/user changes.
These dirty sources were not reused as implementation worktrees or cleaned.
d53b `768ccb2f`, accepted-intent `63ccb484` and detached baseline `a0344114`
remain read-only. No claim of remote propagation or identity of a push actor.

Code, tests, policy constants, approved plans and protected artifacts were not
changed. Existing full-check outcomes remain non-green; no full-run result is
invented from four diagnostic controls. P1 stays semantically HELD 0/3/3,
remaining M1b/M2 and render qualification remain incomplete, spend $0.

Final diagnostic checks: both typechecks exit 0; `git diff --check` exit 0;
the canonical classifier still returns 386/364/22. A literal Git
`lib/**/*.spec.ts` pathspec initially counted 385 because it omits the root-level
`lib/style01-audition-preview.spec.ts`; full tracked-lib enumeration and the
actual classifier both confirm 386. No test path was removed or reclassified.
P1 was recomputed after the diagnostics: 14 files / 412516 bytes / raw inventory
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

Key diagnostic SHA-256 values:

- `audit-diff.json`: `81eaecea641ff895ec128f25d75dcbd954ba94e12cd344b173ab4a9de1a72834`.
- `policy-counterfactual.log`: `42bc0acd67979cd2c0452cbaec7771c850f11c96814fd88e55d3a65f84e0a526`.
- `review-diff.json`: `b363e056fb0bd84ec7e64c9c0e813f5ee98d33d140af67a81f2982abb7b74a13`.

Read-only reproduction from the implementation worktree:

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
node --require ./scripts/shims/register-server-only.cjs --import tsx outputs/qa-residual-gate-diagnostic-20260907/diagnose-review.ts
node outputs/qa-residual-gate-diagnostic-20260907/compare-audits.mjs
node node_modules/vitest/vitest.mjs run --config outputs/qa-residual-gate-diagnostic-20260907/counterfactual.config.ts --reporter=verbose
```

The documentation delivery is limited to CURRENT.md, ROADMAP.md and this brief.
Its committed range is supplied in the task handoff; it neither changes code
nor extends the independent scheduling PASS. There is no background run after
this completed diagnostic handoff. Owner approval of the proposed correction,
not an additional scheduling re-gate, is the next implementation boundary.
