# R3-B1b M2a — atomic semantic correction and exact P1 preview

2026-09-08. Status: implemented locally; complete local full gate GREEN; independent
M2a QA and exact semantic product acceptance pending. No render readiness.

## Authority, topology and subdivision

Guy's standing approval covers implementation of the general semantic-recovery
Gate and progression toward a bounded render. It is not exact-artifact semantic
acceptance, nor permission to bypass independent QA. Sole writer: this Codex
task, `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`, base
`1e97f373ba34c15f9ba53ac28ad85a5ebb758641`. Start: clean, cached ahead 9 / behind 0.
Protected dependencies: d53b at `768ccb2f`, accepted-intent worktree at
`63ccb484`, both clean and read-only. No new task or parallel writer.

Engineering subdivision of already approved M2:

- M2a: atomic source-bound effective template/coverage, exact before/after
  preview, contained review-pending packet and offline CLI.
- M2b: explicitly versioned changed-coverage bridge and historical paid-chain
  verification with fresh current-consumer attestation, after independent M2a
  QA. No original M2 acceptance criterion is removed or declared completed.

Progression uses standing owner approval, prior independently reviewed M1b code
slices, and the complete local 5607-test baseline. It does not relabel Claude's
documentation review as complete M1b or independent repository PASS.
The received documentation PASS P0=0/P1=0/P2=1 covers only
`711d63f0..1e97f373`. Its P2 is locally corrected by `local` in CURRENT's
historical full-gate heading. Re-gate is pending. The external brief's
`00c6aa68...` typo does not occur in the committed evidence or local HANDOFF;
their correct baseline log hash remains
`00c6aa7807308d903c83f210198b3291625691fbf4a1e1cf29bae36fab5e2dc1`.

## Lead findings and implementation choice

Observed: M1 supplies source-reviewed cast/group authority and current `runs`
semantics, but the original paid P1 still lacks those cast members and retains
incorrect actions, conflicting cover constraints and conditional cart state.
Editing only the template would strand coverage references and old generated
prose. The cover-only bridge v5 deliberately requires unchanged coverage;
the current candidate factory deliberately cannot recreate the frozen v3 paid
receipt as a current-catalog candidate.

Expected: reuse the immutable original, produce a separate review-only overlay,
and update all selected dependent template/coverage references together. No
provider call or paid-candidate fabrication. Fail before persistence on stale,
cross-bound, ambiguous or incompatible input.

Solution: closed, strict operation union, immutable before-values, exact source
citations, source/candidate/review/catalog digest binding, shared cast facts and
appearance merge, compiler-owned action IDs and existing prose/cover functions.
No production story key, character name, page number or prop ID is hardcoded.

Risks: source fidelity is not semantic acceptance; structurally valid selected
operations do not establish completeness of all possible story corrections.
M2a does not validate an entire paid receipt chain or grant bridge approval.
Legacy factory/cover-only invariants therefore remain unchanged until M2b's
separate explicit lane is independently reviewed.

Rejected: hand-editing paid JSON, synthesizing a new provider candidate, changing
only prose, appending a second cutting beat, weakening cover-only equality,
reusing the live historical attestation, or spending on another authoring call.

## Implemented surface

`visualContractSemanticCorrection.ts` produces sealed v1 plan/correction
artifacts. The plan binds snapshot, original candidate/template/coverage,
source-evidence catalog, supporting-cast review and current action catalog.
Both builders revalidate accepted-source review authority and the historical
candidate envelope. Original inputs are never mutated.

Operations: replace action predicate, convert an action to an existing
presentation, replace a source-backed presentation, require an existing
required prop's explicit state, and the unchanged existing cover-visible-prop
operation. Cast is reconstructed through the already reviewed source-fact
assembly. The compiler's existing `mergeHuman` is exported without changing its
body; no duplicate appearance policy is introduced.

Before-state and unique target checks precede mutation of private clones.
Action IDs, generated prose and coverage move together. Original mustShow
indices are retained until removals are complete, then every affected pointer
and value is rebased, including unselected beats sharing the presentation.
Conflicting writes, orphaned references, duplicate effective actions/prose and
invalid current template/coverage fail. Whole-artifact verification recomputes
the complete overlay, not just attacker-rehashable metadata.

Group-bearing effective templates use v5. Rebuilding an alternate overlay with
no reviewed group yields v4 with the group property absent; the prior v5 overlay
is not edited or fed back as a paid v9 candidate.

`semanticCorrectionPreview.ts` reloads accepted authority from disk, requires
canonical candidate bytes, reads bounded contained input files, validates fully
before writing, and persists one content-addressed pending review packet only
with `write: true`. Output is contained under `outputs/`; the shared artifact
store rejects aliases and conflicting bytes. Default dry-run creates nothing.

`scripts/preview-semantic-correction.ts` is the actual offline entrypoint.
Unknown/repeated flags reject. Failure output is sanitized. It has no provider,
approval or promotion command. Template/resolved validators and prompt consumers
remain unchanged, as do the candidate factory and bridge v5.

## Exact original and real output

The regression fixture is a byte-identical copy, not the original paid file.
See `lib/visual-package/__tests__/fixtures/semantic-recovery-provenance.md`.
All 14 held files still match the immutable inventory: 412,516 bytes,
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

Actual evidence directory: `outputs/qa-m2a-semantic-20260908/`.
Preparation read the original held candidate directly, checked its raw SHA and
byte equality with the fixture, then copied review inputs to this new ignored
root. Both dry and write invocations used the actual production CLI with
external-network denial preloaded. Dry-run returned artifact null and left the
output directory absent. Write produced exactly one pending packet:

| Identity | Digest |
| --- | --- |
| Original candidate | `efbdd2e13c03af194af425c5e050e0bfedad29d4e0c8cec1aa8b54530192ad88` |
| Plan | `91663548191bb7f22f6b5b990d7a33bece7c15b9e21b895bdbdede59e3410a75` |
| Correction | `d8c250119df713e753ed22c5618ddb8f25dbdfa94cfbdc5661a78670ff0bee58` |
| Effective template | `a7fe2c58a09d90a3a8f08013534fd26233c8a366594e7bdec15cae4fc3c94dc9` |
| Effective coverage | `f65f57de560f2bc550ae529bc362eb9042fdfb823712819c23de0768d463d9bf` |
| Pending review packet | `b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2` |

Nine operations plus five source-reviewed cast entries: three individual humans
and two recurring/distinct ensembles. Changed pages: 1, 2, 5, 6, 9, 10, 11, 12;
page 8 unchanged. Cover/recurring-prop first-reveal constraints corrected only
for cake/cart; tablecloth remains forbidden. Exactly one baker-agented
first-slice requirement; separate served-slice/cherry state retained.

`BEFORE_AFTER.md` is generated from that exact packet and includes complete
changed page/cover structures, cast and operations. It is not a rendered image
or independent verdict. Packet reconstruction was verified against original
inputs. `held-replay.log` records exact historical replay, zero provider calls,
congruent receipt/candidate, identical historical reader and deliberate rejection
by the current factory. No historical receipt/attestation was rewritten.

## Validation and limitations

Final complete `npm run check`: exit 0, **5634 passed, 73 existing skips, zero
failed**, both root and autonomous TypeScript projects. Ordinary 4963 passed /
73 skipped, 349 passed / 17 skipped files, 128019ms; resource-intensive 671
passed / 22 files, 307678ms. Exact inventory 388/366/22, unchanged 4/2 workers.
The complete run is green, not an aggregation of isolated reruns. No full-check
retry was needed for this implementation milestone.

Focused command in HANDOFF: 216/216 in 7 specs, exit 0, 203.39s. This includes
27 new tests, the actual network-denied CLI and existing accepted-source,
source-authority, cover-only, candidate bridge, workload and lantern-transition
regressions. Broader compiler/runtime coverage is in the full run. Separate
root tsc also exited 0. Replay and exact inventory both exited 0; the inventory
was rechecked after the full gate and still matches the original 14 files.
`git diff --check` exited 0 before staging; final staged/typecheck checks and
the immutable commit range are recorded in HANDOFF.

Raw log SHA-256 values (logs are ignored local runtime evidence):

| Log | SHA-256 |
| --- | --- |
| full-check.log | `f0dacd55b720ddccf89f1bf75278dfa1ba4879a82e9bd6f54d07a370ff2d19e5` |
| focused.log | `7143e2ef96c8640afe94a8eb78d6a9dcce37e1e189eb20888f1d1f27b850700d` |
| held-replay.log | `855f0bd2b6d8b9e52f482805ef0a5ace86c74da56d55d8009b170df806d6e5e2` |
| preview-dry.log | `5bb27b96a6746372e3a70538657d599b394055f7e88935e5b275483bef33c333` |
| preview-write.log | `e109bce95455576cbad853f550c096a97685fb91c48514a7d17488804c817ab5` |
| preview-inspection.log | `672f47648c5c0a0e7f300a666ec11feca87325b4c26ad2c1fc30184dab45ea81` |

New tests include the
real held fixture, deterministic source-bound cast, alternate IDs, group removal,
strict action shapes, stale/forged bindings, shared-pointer rebasing, operation
order, whole-artifact forgery, contained dry/write/idempotence and the actual
CLI with network denial. One new spec changes inventory 387/365/22 to
388/366/22; worker/deadline/skip policy is unchanged.

Early test iterations exposed fixture/expectation errors: exact broom-holder
alias boundary, cover full-line indices, same-page identity collision setup,
`holds` having optional objects (replaced with genuinely required-object
`approaches` for the rejection test), and idempotent store metadata returning
`created: false` on the second write. No validator was weakened to make these
tests pass. An initial TypeScript tuple typing error was corrected locally.

No independent M2a PASS, product acceptance, all-story audit, full-book render,
Blueprint, package or render qualification is claimed. Prior intermittent
native-Git/timing failures remain unexplained; a later green run does not prove
their root cause repaired. M2b remains unimplemented.

## QA handoff, next action and rollback

Review the final immutable base-to-head range supplied in the local HANDOFF.
First pass read-only. Falsify source authority, arbitrary-ID generality, partial
action/prose/coverage drift, group-as-individual projection, source/receipt
mutation, replay compatibility, output containment, and any implied approval.
Re-gate CURRENT's single wording P2 without extending old code PASS ranges.
Inspect the exact pending packet against all six original semantic findings;
do not treat the selected-operation fixture as independent acceptance evidence.

After independent M2a QA/fixes, implement M2b's explicit bridge lane, obtain exact
semantic acceptance and continue qualification toward the bounded LOW sample.
No new generic owner permission is needed for already approved implementation.
The read-only `claude auth status` check at 08:06:50 +03:00 exited 1 with
`loggedIn: false`, `authMethod: none`, `apiProvider: firstParty`. No review was
dispatched or model work performed. No secret value was read or printed.
`claude-auth-status.json` records the observation. The supplied external review
route remains available through Guy; local authentication was not repaired.

Rollback: stop consuming the pending overlay or revert this focused code
milestone. Original source, paid candidate, receipt, replay, package and locator
remain intact. No evidence, worktree, branch or database deletion is needed.
Application provider spend: USD 0. No credential access, render, publication,
deployment, payment or push performed in this milestone.
