# R1D-PVB-D1A1B1 Residual Action Semantic Coverage — Implementation Evidence

**Date:** 2026-08-04

**Status:** independent Claude Code technical PASS; documentation closeout local and unpushed

**Branch:** `codex/r1d-pvb-d1a1b1-residual-action-semantic-coverage`

**Worktree:** `C:\Users\guyna\.codex\worktrees\5bed\Small_Heroes`

**Exact base:** `84d779d14f9175d863738db6e35a81917c7b3dcb`

**External cost:** `$0`

## Scope and verified cause

The first Wizard-connected LOW-page authoring measurement reached a completed provider response but produced no candidate. Local validation found two residual closed-catalog capability gaps: a unary recoil action and a group seated beside a prop. The failure was not credential, transport, provider, source-evidence-ID, structured-output, Blueprint, Wizard, or image-render failure. The existing Action Semantic Catalog could not express those source-grounded meanings without semantic force-fitting.

The implementation generalizes the missing concepts for every Story Source. Production code contains no calibration story, character, page, beat, source phrase, or prop literal.

## Commit 1 — action contract, compiler, validators, and migration

Commit: `edbfd0d885366da772a519bb6b67bcda0b41cc41` (`feat: add residual action semantic authority`)

- Advances the Action Semantic Catalog from v2 to v3 and Action Semantic Coverage from v4 to v5.
- Adds the general unary `recoils` predicate.
- Adds typed `cast_group` subjects with exact, unique same-page cast membership.
- Adds unary `sits` and a separate optional typed current-frame spatial constraint.
- Introduces the closed static spatial-constraint relation `beside`; it is not encoded as movement or prompt prose.
- Keeps object, movement result, static relation, laterality, source evidence, and coverage ownership independently validated.
- Updates compiler-owned check identity, source-grounded prose projection, structured-output schema, prompt family v8, validators, repair guards, and explicit migration.
- Preserves exact source-evidence repair: only source-evidence identifiers may change, and all other semantic fields remain immutable.

Validation recorded by the implementation Task:

- Focused: **26 files / 500 tests passed**.
- Deterministic TypeScript: passed.

## Commit 2 — Blueprint feasibility and Wizard qualification

Commit: `7b9182c0a724578ded83ef85f53ece7fc6ee049c` (`feat: enforce grouped static Blueprint actions`)

- Advances Blueprint draft schema to v5 and authoring authority to v3 while preserving the Blueprint v4 artifact family.
- Expands `cast_group` into exact participant support and counts every unique group member against action-space capacity.
- Carries static spatial constraints into action-space capability declarations and exact entity support.
- Validates `beside` as current-frame geometry: disjoint regions, sufficient vertical alignment, and a bounded horizontal edge gap.
- Requires exact subject and target placements and rejects missing, overlapping, distant, ambiguous, or capacity-invalid geometry.
- Projects current authority into runtime/Blueprint feasibility and proves zero-cost Wizard qualification without image-provider reachability.

Validation recorded by the implementation Task:

- Focused: **10 files / 243 tests passed**.
- Deterministic TypeScript: passed.

## Commit 3 — lifecycle cutover and authority bindings

The final cutover advances every authority that depends on the changed contract shape and semantic digests. Current authority after this commit is:

| Boundary | Current version |
| --- | --- |
| Visual Contract schema | `vc-schema/v4` |
| Draft schema | `vc-draft-schema/v12` |
| Template and repair prompt families | `v8` |
| Action Semantic Catalog | `action-semantic-catalog/v3` |
| Action Semantic Coverage | `action-semantic-coverage/v5` |
| Approved PVB runtime authority | `approved-pvb-runtime-authority/v6` |
| Blueprint / draft / authoring authority | `v4` / `v5` / `v3` |
| Visual package / qualification | `visual-package/v5` / `visual-package-v5-offline-qualification/v3` |
| Authoring request / receipt / readiness / candidate | `v9` / `v8` / `v6` / `v6` |
| B0 input / manifest / verifier | `v5` / `v7` / `v7` |
| Canonical pre-live readiness evidence | `v6` |
| Execution Request / readiness / result | `v6` / `v6` / `v4` |

The previous current authoring artifact families are added to explicit legacy-immutable classification. No historical artifact is rewritten, promoted, or accepted as new authority.

## Validation-resume evidence

The first lifecycle batch reported 316 passing tests, one stale `vc-draft-schema/v11` expectation, one new 5-second timeout in `live-execution-request-materialization.spec.ts`, and two `onTaskUpdate` RPC timeouts. It stopped before `npm run check`, commit 3, documentation, or push.

Guy authorized one narrow validation resume. The only correction was the stale expectation from v11 to v12. No production behavior or test infrastructure changed.

### Focused workload phases

- The resource-intensive materialization spec ran once alone with one fork worker: **1 file / 20 tests passed** in 40.34 seconds. The exact formerly timed-out idempotency/collision test completed in 3.912 seconds.
- Ordinary changed specs ran with file parallelism and at most four workers: **3 files / 39 tests passed** in 2.59 seconds.
- The remaining resource-intensive changed specs ran with file parallelism and at most two workers: **3 files / 177 tests passed** in 72.53 seconds.
- Combined changed-spec surface: **7 files / 236 tests passed**. No test timeout, `onTaskUpdate` RPC timeout, IPC/reporter failure, launch failure, or teardown failure occurred.
- Deterministic `node node_modules/typescript/lib/tsc.js --noEmit`: passed.

### Single repository check

Literal repository gate `npm run check` ran exactly once and was not retried.

- TypeScript: passed.
- Canonical inventory: 283 files.
- Ordinary phase: 264 files, four-worker ceiling, exit `1` only for the established six absent ignored-output fixture tests in five unchanged files:
  - `child-lexicon-ages-5-8.spec.ts` — 1
  - `momentum-gate-koko.spec.ts` — 1
  - `page-entity-qa.spec.ts` — 1
  - `set-appearance-ref-budget.spec.ts` — 1
  - `story-read-back-validation.spec.ts` — 2
- Resource-intensive phase: 19 files, two-worker ceiling, exit `0`.
- Diagnostic protocols were valid. No new assertion, timeout, RPC/IPC, reporter, launch, signal, or teardown class appeared beyond the ordinary phase's expected nonzero exit caused by those six assertions.
- Aggregate command exit: `1`. This is recorded as the accepted non-production fixture baseline, not a literal green command and not a release waiver. The six fixture failures remain release-blocking.

## Dependency and topology discipline

- The two completed implementation commits and the 20-file lifecycle cutover were preserved without reset, discard, or unrelated edits.
- Validation used a temporary local `node_modules` junction only after proving the target was a real directory, contained deterministic Vitest/TypeScript, and had a byte-identical `package-lock.json` SHA-256 of `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59`.
- The junction was removed without recursion after validation. Its target remained present and unchanged by this Task.
- No dependency version, `package.json`, lockfile, Vitest policy, worker policy, timeout, retry, skip, reporter protocol, or global configuration changed.

## Acceptance and remaining authority

Implementation acceptance criteria are locally satisfied:

1. Recoil and static group-seating semantics are expressible through typed general contracts.
2. Unsupported meanings are not force-fit into movement, object, or prompt prose.
3. Compiler, validators, Blueprint feasibility, runtime authority, and Wizard qualification share the same versioned semantics.
4. Old artifacts remain immutable and fail closed as stale authority.
5. All changed tests pass under the repository workload policy.
6. The one repository check reproduces no failure beyond the six accepted experiment-only fixture failures.

## Independent Claude Code QA

Claude Code independently reviewed exact immutable implementation range `84d779d14f9175d863738db6e35a81917c7b3dcb..f6d013b9065ee286fe378f4cf82009e40a38ed7b` and returned **PASS** with **zero BLOCKER, zero MAJOR, and zero MINOR**. Codex records this external verdict; it does not self-award technical PASS.

Claude statically verified all ten handoff targets:

1. exact clean three-commit topology with no merge, upstream, remote ref, reflog update, or push;
2. general typed `recoils`, `cast_group`, unary `sits`, and static `beside` semantics;
3. fail-closed unknown-field, group-membership, reference, target, contradiction, and forbidden-prop validation;
4. source-evidence repair mutates only `sourceEvidenceId`;
5. exact participant, capacity, geometry, ambiguity, and feasibility enforcement in Blueprint;
6. Wizard qualification holds the paid image seam unreachable;
7. the complete lifecycle/version cutover without policy drift;
8. explicit immutable legacy migrations with no loader fallback;
9. validation-resume scope limited to v11-to-v12 test expectations, with no production/test-policy drift; and
10. documentation does not claim Codex PASS or render authority.

Advisory limitations retained from the review:

- **N1:** `node_modules` was absent during Claude's review, so Claude did not independently reproduce TypeScript or Vitest. The test figures remain Codex execution evidence; Claude's PASS is static.
- **N2:** unary `sits` cannot bypass `sits_on` safety semantics because it forbids an object and permits only the distinct current-frame `beside` constraint.
- **N3:** the general `BESIDE_MAX_HORIZONTAL_EDGE_GAP = 150` tolerance is not a story literal, but its basis should be named if it is tuned later.
- **N4:** the constraint switch is exhaustive for today's single closed relation; it must remain exhaustive if that union grows.

None is a BLOCKER, MAJOR, MINOR, or prerequisite for the next zero-cost Fresh Readiness. No further Claude round is required for this faithful closeout unless its record fidelity is disputed.

This implementation grants no product or visual acceptance, candidate, Semantic Reconciliation, Blueprint/package approval, Wizard execution, Fresh Readiness, credential access, provider/model/network call, render/image/Vision call, storage/database/Board action, publication, promotion, production activation, deployment, push, or release authority.

## Rollback

Rollback is the normal branch rollback of the three focused commits before any new B0/readiness authority is materialized. Historical artifacts remain untouched. Do not selectively downgrade only lifecycle version constants: the compiler, catalog, Blueprint, runtime, B0, readiness, and execution bindings form one fail-closed cutover.
