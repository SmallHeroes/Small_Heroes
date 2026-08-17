# R1D Atomic Action-Binding Repair and Candidate Template Projection — Implementation Evidence

**Date:** 2026-08-17
**Status:** independent Claude Code technical PASS; local and unpushed
**Decision Gate:** `d9c084372d9770a5f0aca8b2f0d4a817c43b1376`
**Base:** `b2ebdf8aa57dc588cdab4a56cbce96132b511999`
**Branch:** `codex/r1d-atomic-action-binding-repair-template-projection`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## Topology and commits

The implementation started from the exact pushed and independently QA-passed
bridge head `b2ebdf8aa57dc588cdab4a56cbce96132b511999`.

The local range is linear and contains:

1. `d9c084372d9770a5f0aca8b2f0d4a817c43b1376` — Decision Gate;
2. `0d71afebe6a70224e63dc516e0db83eb118562be` — atomic action-binding component repair and lifecycle proof;
3. `9a3c691772c79d6cdf4686fc5971a4e13b460dc2` — canonical candidate-template projection and bridge proof.

At documentation time the branch has no upstream, is unpushed and is clean
before this documentation-only change. The exact base remains the merge-base
and the range contains zero merge commits. Package and lockfile are unchanged.

## Consumed live-attempt authority

The implementation is grounded in the immutable output root:

`outputs/r1d-real-candidate-qa-wizard-bridge-fresh-readiness-20260817T090343714Z`

The bound authorities are:

- repository HEAD: `b2ebdf8aa57dc588cdab4a56cbce96132b511999`;
- Fresh Readiness v26:
  `7717d7e3c7bde73118c794daaa9761b03be069b6443d3fa16743fa276a1607b4`;
- Execution Request v26:
  `de779c13fe9ba5cfde07f07cc39f8e63e92eed86ae21ae69299dbbc35d18e450`;
- authoring request v29:
  `3482a2c1483734e64ab0ec67fd2f1c1e33bb93ef51b62217a2e58908b84c36a1`;
- receipt v32:
  `68b03d0bb5e2fc2837d4cefed070d4848c5abf4a32f6ef97c5e1abb337087ef3`;
- readiness v30:
  `71e48aa679dadf5256d400332fdc02a4db5e591a7963416772eaf71f10a90180`;
- source snapshot:
  `f8ac1292d5e225a8ff90c462416a44fe61f89b2c47f1529a1e43dd8025f1a079`.

Supervisor v19 was invoked once and ended `child_failed / child_nonzero_exit`.
Receipt v32 records exactly three logical provider calls, two repairs, three
transport dispatches, zero transport retries and no fallback. The standard
output schedule was `[40,000, 32,000, 36,000]`. Nominal cost was `$1.339074`,
conservative accounting was `$1.482818`, projected maximum was `$4.99125`, and
the hard fence remained `$5.00`.

The terminal result was:

- code: `draft_validation_repair_exhausted`;
- class: `draft_validation_budget_exhausted`;
- phase: `draft_validation`;
- repair eligibility: `budget_exhausted`;
- candidate: absent.

No reconciliation, Blueprint, Visual Package, Wizard, image or render authority
was created by that consumed attempt.

## Failure causal chain

Attempt 1 completed under the unchanged 64K input ceiling and emitted eleven
unique action-binding cardinality diagnostics:

- page 3: action indexes `3/4` and coverage index `11`;
- page 7: action indexes `0/1` and coverage index `5`;
- page 7: action indexes `2/3` and coverage index `6`;
- page 11: action index `3` and coverage index `3`.

The first three groups were complete 2-actions-to-1-action-requirement-coverage
components. The page-11 pair remained valid for the existing scalar route.
The former repair planner decomposed the duplicate components into scalar
targets. It could replace a member action `beatId`, but lacked authority to
append the exact missing matching coverage record. Attempt 2 therefore resolved
eight issues while leaving one orphaned action in each duplicate component.

Attempt 3 resolved those three persistent scalar issues. Complete validation
then exposed nineteen already-present latent issues only after the standard
repair budget was consumed:

- five `closed_catalog_capability_gap` issues on pages 4, 9, 10 and twice on 11;
- one `cover_projection_invalid`;
- twelve `final_structural_invariant_invalid` issues, pages 1–12;
- one recurring-prop `lifecycle_invariant_invalid`.

Provider transport, the input ceiling, the per-attempt output caps and the cost
fence were not causal.

## Atomic action-binding repair

Commit `0d71afeb` introduces the typed
`action_beat_binding_component_invalid` target. Its identity is derived only
from current validated page structure and the complete typed diagnostic set:
page number, original page-scoped beat ID, sorted member action indexes, the one
matching coverage index, the existing Source Evidence ID and the exact coverage
deficit. No prose parsing, fuzzy match, story literal or authored free-form
locator creates repair authority.

A component is eligible only when the complete duplicate graph is proven.
Partial, mixed, ambiguous and stale graphs remain fail-closed. Application may
only:

1. assign valid unique page-scoped beat IDs to member actions;
2. bind the existing component coverage record to the first resulting beat;
3. append exactly the coverage deficit in member-action order;
4. preserve the original Source Evidence ID and exact
   `{ kind: "action_requirement" }` disposition.

The applier rejects action-body drift, invalid or duplicate beat IDs,
missing/extra/reordered records, Source Evidence drift, non-target coverage
drift and wider page changes. Component-scope failures use a distinct
fail-closed error and do not enter the legacy scalar `target_scope_invalid`
retry path. Existing scalar action/coverage, represented-elsewhere, spatial,
presentation and mixed/predecessor routes remain unchanged.

The lifecycle regression proves the intended bounded sequence: the initial
action-binding family is closed by one atomic page-contract repair; full
validation then exposes the latent closed book-surface family; the existing
`book_surface_patch` route owns the second repair; and a valid response persists
a candidate in exactly three calls and two repairs. A companion negative
regression proves that mixed residuals after that sequence do not admit a
fourth cleanup call.

## Candidate-template projection

Commit `9a3c6917` removes the operator-supplied bare-template path from current
QA bridge preparation. The bridge loads the canonical candidate envelope,
validates its Story Source and candidate authority, and deterministically
persists `candidate.template` as canonical JSON at:

`<bridge-output>/candidate-template-projections/<templateDigest>.json`

The candidate template digest is both filename and content digest. Bridge
manifest v2 binds candidate path/digest, projected-template path/digest,
template schema, Story Source, receipt/readiness/Supervisor authority and the
reconciliation/review identities.

Persistence uses the existing contained content-addressed JSON store and its
regular-file, realpath, symlink-alias, unique-link and collision protections.
Wrapper substitution, arbitrary paths, tamper, hard links, collision, alias and
cross-candidate replay fail closed. Current reconciliation is rebuilt directly
from the validated candidate, and the independently loaded package template
must be byte-equal to `candidate.template`.

## Versioning and migration

- page-contract repair schema remains `page-contract-repair-schema/v2`;
- page-contract repair prompt remains `page-contract-repair-prompt/v12`;
- page-contract repair user prompt remains
  `page-contract-repair-user-prompt/v13`;
- page-contract repair input encoding moves from v2 to
  `page-contract-repair-input-encoding/v3`;
- the complete-page output schema remains unchanged;
- the QA Wizard bridge manifest moves from v1 to v2.

Historical receipts, readiness evidence, candidates and bridge artifacts are
not rewritten or re-digested. Exact bridge v1 pending and approved manifests
remain readable and replayable in place but are legacy immutable: the v2 path
cannot approve, advance or rewrite them. No database or storage migration is
required.

Because the implementation changes HEAD and current authority bytes, every
earlier Fresh Readiness and Execution Request is historical only. A future live
attempt requires a new pushed HEAD, canonical Git probe, Fresh Readiness and
Execution Request.

## Files

Production:

- `lib/visual-contract-compiler/pageContractRepair.ts`;
- `lib/visual-package/qaWizardCandidateBridge.ts`;
- `scripts/qa-wizard-candidate-bridge.ts`.

Tests:

- `lib/__tests__/page-contract-repair.spec.ts`;
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`;
- `lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts`.

Documentation:

- `CURRENT.md`;
- this evidence file.

No package, lockfile, dependency, provider adapter, database, storage, render or
deployment file changed.

## Validation

All implementation-focused and adjacent validation completed before the two
code commits:

- focused ordinary implementation: **2 files / 149 tests PASS**;
- focused resource bridge: **1 file / 7 tests PASS**;
- adjacent actual ordinary: **3 files / 66 tests PASS**;
- adjacent actual resource: **1 file / 162 tests PASS**;
- deterministic TypeScript: **PASS**;
- `git diff --check`: **PASS**.

The literal `npm run check` ran exactly once and was not retried:

- ordinary: **281 files**, **3,213 passed**, **65 skipped** and exactly **5
  failed assertions** in the four established missing-output fixture specs;
- resource-intensive: **20 files / 599 tests PASS**;
- both diagnostic protocols were valid;
- no timeout, RPC/IPC, reporter, launch, signal, termination, teardown or other
  infrastructure failure occurred.

The direct tests cover one and multiple closed 2-to-1 components; exact minimum
append and final 1:1 binding; missing, extra, reordered, duplicate, invalid-beat,
action-body, Source Evidence and non-target drift rejection; the live-shaped
three-call/two-repair lifecycle; rejection of a fourth cleanup; novel-story
bridge preparation without a tracked template; canonical projection bytes,
digest and idempotency; containment/tamper/collision/cross-candidate rejection;
exact read-only v1 replay; and downstream reconciliation rebuilt from candidate
authority.

## Independent Claude Code QA

Claude Code independently reviewed the exact immutable range:

`b2ebdf8aa57dc588cdab4a56cbce96132b511999..bfcbfcec148bbd784d627d5da671948a197a340a`

The verdict was **TECHNICAL PASS** with zero BLOCKER, zero MAJOR and zero MINOR.
The review independently confirmed:

- four linear commits, zero merges, nine files, a clean worktree and unchanged
  package/lockfile;
- exact complete-graph admission and fail-closed rejection of partial, stale,
  ambiguous and malformed component authority;
- preservation of all eleven diagnostic identities while planning five repair
  targets;
- Source Evidence ID enforcement at planning, target validation and apply;
- exactly one occurrence of every resulting member beat across all coverage
  dispositions, including non-visual and unsupported collision rejection;
- deterministic minimum-deficit application without multi-component index
  drift, followed by full lifecycle revalidation and the exact three-call,
  two-repair candidate path;
- unchanged schema/prompt/user-prompt, model, budget, timeout, retry, fallback,
  candidate and cost-fence policy;
- canonical candidate-template projection, containment and tamper rejection,
  v2 current-only persistence, exact immutable v1 replay and approved-v2 replay;
- accurate separation of the five-fixture release HOLD from this implementation.

The sole advisory note observes that the non-target action-drift rejection is
implemented in the broader page validation layer rather than only inside the
per-target apply loop. The direct regression proves the invariant, so this is
not a finding and requires no correction or re-gate.

The independent review used one Claude Sonnet High session, cost
`$1.73291045`, and was not retried. Codex records this external verdict and does
not self-award it. Technical PASS grants no push, Fresh Readiness, provider,
render, QA deployment, production or product-acceptance authority.

## Separate repository fixture HOLD

The current directly observed baseline is five missing ignored-output
assertions across four unchanged specs:

- `child-lexicon-ages-5-8.spec.ts`;
- `momentum-gate-koko.spec.ts`;
- `page-entity-qa.spec.ts`;
- two cases in `story-read-back-validation.spec.ts`.

The historical six-assertion baseline is no longer current because commit
`7763ae2e` replaced the former `set-appearance-ref-budget.spec.ts` ignored PNG
dependency with an isolated temporary fixture. The five failures remain a
separate repository/release HOLD. They are not an implementation finding and
are not waived for release.

## Cost and exclusions

The historical consumed attempt cost `$1.339074` nominal and `$1.482818`
conservative. This implementation and validation milestone incurred `$0` new
Small Heroes provider or image spend. The separate independent Claude Code QA
cost `$1.73291045`:

- credential access: `none`;
- new provider/network calls: `0`;
- Fresh Readiness: `not_run`;
- canonical preflight: `not_run`;
- live authoring: `not_run`;
- image/render: `0`;
- storage/database: `none`;
- deployment/production: `none`.

No raw prompt, provider response, provider message, secret or stack is persisted
in this evidence.

## Rollback

Rollback is a focused revert of `0d71afeb` and `9a3c6917`. No database rollback
or historical-artifact mutation is required. Historical v1 bridge artifacts
remain immutable. If a v2 artifact is produced before a later rollback, it must
remain preserved as immutable evidence and must not be silently downgraded or
paired with a different candidate.

## Next gate

Independent technical QA is closed. The next step is to push this branch. Push
does not authorize reuse of the consumed readiness. The next operational
sequence requires a new canonical Git probe, Fresh Readiness, Execution
Request, official pricing verification, one preflight, one Supervisor verify
and one bounded live invocation. Only a persisted candidate may proceed to the
exact reconciliation checkpoint. Reconciliation, Blueprint, package and visual
acceptance remain Guy checkpoints. Production remains untouched.
