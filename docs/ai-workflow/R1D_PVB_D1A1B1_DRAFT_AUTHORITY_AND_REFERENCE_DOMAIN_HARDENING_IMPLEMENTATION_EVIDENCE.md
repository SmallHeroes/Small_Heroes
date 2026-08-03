# R1D-PVB-D1A1B1 Draft Authority and Reference Domain Hardening - Implementation Evidence

Status: **independent Claude Code technical PASS / documentation closeout**

Date: `2026-08-03`

Repository base: `07adf0997eb7330c026fb5c395cf77e359e89e4f`

Branch: `codex/r1d-pvb-d1a1b1-draft-authority-reference-domain-hardening`

Worktree: `C:\Users\guyna\.codex\worktrees\dadc\Small_Heroes`

Cost: `$0`

## Authority and topology

Before edits, Codex reconciled `git worktree list --porcelain`, `git branch -vv`, and status across relevant worktrees. This worktree was clean at the exact required base, the target branch was created from that base, and no other task had write authority here. Other dirty worktrees were treated as user-owned and were not changed.

This task was the sole writer for the implementation milestone and is the sole writer for this two-file documentation closeout. The implementation created three focused local commits; this closeout adds one focused containing commit and does not push. The Lead task remains the decision and re-gate hub.

## Independent technical review

Claude Code independently reviewed exact implementation range `07adf0997eb7330c026fb5c395cf77e359e89e4f..5a51fea3da01eb9a4ad8cac5534b80809bd939de` and returned technical **PASS** with:

- **0 BLOCKER**;
- **0 MAJOR**;
- **2 non-blocking MINORs**.

Codex records Claude Code's verdict and does not self-award technical PASS.

### MINOR-1 - closed by independent micro re-gate

The inherited stale documentation statement identified by the review was already corrected in range `b735a22f..07adf099`. Claude Code independently micro-re-gated that exact correction range and closed MINOR-1. This document attributes the closure to Claude Code; it is not a Codex self-awarded result.

### MINOR-2 - separate test-infrastructure limitation

The Vitest worker RPC timeout calling `onTaskUpdate` was independently reproduced with a real isolated/local `node_modules`. That reproduction falsifies the earlier junction-only explanation. Claude found no implementation defect in the reviewed range that caused the event, but literal `npm run check` cannot currently produce a green exit until the separate test-infrastructure issue is resolved.

### Advisory limitations

Claude Code's N1-N4 remain advisory only:

1. The spatial-node enum remains the pre-existing closed vocabulary.
2. No raw artifact of the original 40 stale-fixture failures was preserved; Claude verified the corrected repository state.
3. Claude did not map every one of the earlier 49 errors to individually named test cases, although the structural prevention and new specifications passed.
4. Projection equality uses `JSON.stringify` and is key-order-sensitive. This is strict and fail-closed, but brittle.

## Implemented decisions

### 1. Compiler-owned action identity

- Authoring drafts carry an exact `beatId`, not a model-authored `checkId`.
- The compiler derives page-scoped action IDs deterministically from `beatId` and rewrites action and Action Semantic Coverage together.
- Binding is exact and same-page. Array order, prose similarity, normalization guesses, and fuzzy matching have no role.
- Missing, duplicate, or conflicting action/coverage bindings throw a terminal `DraftAuthorityReferenceDomainError` before repair selection.

### 2. Typed relation arity

- Unary `centered_in` has no serialized `objectId` field.
- Binary relations require `objectId`.
- Structured Outputs compatibility remains within the repository's depth contract.

### 3. Explicit page-zone spatial authority

- Page zones expose current-authority `spatialNodes` and typed `spatialRelations`.
- Page action and constraint references resolve only in their exact page-zone domain.
- Unknown or cross-domain nodes are rejected rather than dropped or rewritten heuristically.

### 4. Typed Set Board area-to-zone projection

- Every stable area carries an explicit `zoneProjection` with `one_to_one` or `one_to_many` cardinality.
- The compiler projects stable area geometry into named page zones only through exact IDs.
- Missing, duplicate, wrong-location, and ambiguous projections fail closed.

### 5. Architecture and recurring-prop separation

- Fixed architecture remains a spatial node.
- A stable spatial node may bind to an exact recurring prop.
- Draft-authored `fixedObjects` are forbidden. The compiler derives final fixed-object authority from exact safe recurring-prop bindings and never turns architecture-like strings into props.

### 6. Local deterministic normalization

- Compiler-owned identities, page-zone projections, relation variants, stable geometry, and derived fixed objects normalize locally before semantic validation.
- These transformations spend no provider repair call.
- Invalid binary operands, unknown references, and ambiguity remain terminal local failures.

### 7. Versioned fail-closed cutover

Current versions are:

| Authority | Current version |
|---|---|
| Visual Contract schema | `vc-schema/v3` |
| Draft schema | `vc-draft-schema/v11` |
| System/user prompts | `vc-template-prompt/v7`, `vc-template-user-prompt/v7` |
| Repair prompts | `vc-repair-prompt/v7`, `vc-repair-user-prompt/v7` |
| Action Semantic Coverage | `action-semantic-coverage/v4` |
| Set Board / registry / content policy | `set-board/v4`, `set-registry/v4`, `set-board-content/v3` |
| Authoring request / receipt / readiness / candidate | v8 / v7 / v5 / v5 |
| B0 input / manifest / verifier | v4 / v6 / v6 |
| Canonical pre-live readiness evidence | v5 |
| Execution Request / readiness / result | v5 / v5 / v3 |
| Execution materialization input / result | v3 / v3 |

Prior authoring request v7, receipt v6, readiness v4, and candidate v4 are explicitly classified as `legacy_immutable`; they cannot be accepted as current authority.

Explicit offline migration supports historical v1 and v2 templates. It clones the input, requires exact set/area/zone mappings and explicit legacy/current node maps where needed, validates current output, and never runs from a loader. Tests prove the historical input bytes remain unchanged and incomplete mapping fails.

### 8. Lifecycle, Blueprint, and runtime binding

- Authoring request, receipt, readiness, candidate, prompts, schemas, B0 materialization/verifier, canonical readiness, Execution Request, and execution materialization versions bind the cutover.
- Blueprint validation remains feasible with projected page-zone action space.
- Wizard/runtime qualification accepts current frozen authority.
- A stale `vc-schema/v2` runtime contract fails before injected image-provider and network sentinels.
- Stale authoring request/snapshot authority fails before provider reachability.

### 9. Budget and runtime invariants

The following are unchanged:

- model `gpt-5.6-sol` and existing service tier;
- 64K input ceiling and existing output ceiling;
- initial and repair call budgets;
- transport retries `0`, no fallback, and existing timeout;
- `$4.884` maximum reservation and hard `$5.00` ceiling;
- resemblance threshold `0.70`;
- historical artifacts as immutable non-current evidence.

## Captured error-class proof

The story-neutral matrix represents the exhausted attempt's four exact classes without production story literals:

| Class | Count | Current proof |
|---|---:|---|
| Model-owned action IDs | 37 | Compiler derives all 37 IDs from exact beat bindings; reordered arrays remain stable. |
| Unknown page-zone spatial selections | 5 | Five exact projected selections pass; unknown and ambiguous mappings terminate locally. |
| Architecture-like fixed prop IDs | 6 | Six spatial architecture nodes remain nodes; only exact recurring-prop bindings can derive fixed objects. |
| Unary relation carrying object ID | 1 | `centered_in` serializes as unary and rejects an object operand. |

The positive matrix makes one initial provider-stub call and zero repair calls. Negative missing/duplicate action binding, unknown spatial reference, unsafe prop binding, unary/binary arity, and ambiguous mapping cases are terminal. There is no story ID, named character, named room, or named prop from the captured attempt in production code.

## Commit boundaries

1. `cc1f5447` - `Harden draft action identity and relation arity`
2. `0bc56fc5` - `Harden page and set reference domains`
3. This document's containing commit - lifecycle migration/version/digest bindings, B0/readiness compatibility, Blueprint/Wizard qualification, `CURRENT.md`, and durable evidence

## Validation evidence

All commands ran repository-locally and deterministically. No credential or external provider boundary was used.

### Green focused commands

- Action/reference/compiler and Set Board: **10 files / 170 tests PASS**.
- Authoring lifecycle, B0, readiness, execution, canonical/legacy boundaries: **13 files / 392 tests PASS**.
- Canonical live authoring boundary: **1 file / 132 tests PASS**.
- Historical migration and schema/stage guards: **3 files / 65 tests PASS**.
- Blueprint feasibility and Wizard/runtime qualification: **2 files / 103 tests PASS**.
- Post-repository-gate affected corrections:
  - visual-package lifecycle: **1 file / 31 tests PASS**;
  - Fox cover/source fidelity: **1 file / 6 tests PASS**;
  - historical schema and repair-version guards: **3 files / 52 tests PASS**.
- `npx tsc --noEmit`: PASS after final source/test corrections.
- `git diff --check`: PASS.

### Single literal repository gate

`npm run check` ran exactly once and was not retried.

Exact command outcome:

- command exit: `1`;
- TypeScript phase: PASS;
- Vitest: reported 40 failures in stale shared fixture/version expectations exposed by the cutover;
- Vitest also reported one unhandled error: `[vitest-worker]: Timeout calling "onTaskUpdate"`.

The command was not rerun after corrections. The stale shared Fox lifecycle/cover draft fixtures were upgraded with explicit test-only reference-domain mappings and compiler-owned draft action identity; old v2/v6 expectations were updated to current v3/v7 where they asserted current authority. No historical artifact was edited.

### Post-correction dependency-scoped evidence

`npx vitest related --run --reporter=dot` over all changed production modules produced:

- **69 test files passed**;
- **3 test files skipped**;
- **1,577 tests passed**;
- **8 tests skipped**;
- **zero assertion failures**;
- command exit `1` solely because the same unhandled worker `onTaskUpdate` RPC timeout recurred.

The aggregate is not claimed as a command PASS because its exit was nonzero. The smaller affected suites listed above all exited `0`. The repeated worker reporting timeout is an execution-stability limitation distinct from assertion correctness and was not hidden through retry, serialization, timeout expansion, skipping, or assertion weakening.

### Independent reproduction

Claude Code independently reproduced:

- deterministic repository-local TypeScript: **PASS**;
- corrected changed-spec surface: **26 changed spec files / 574 tests passed**;
- assertion result: **zero assertion failures**;
- command exit: `1` only because of one `[vitest-worker] Timeout calling "onTaskUpdate"`;
- Structured Outputs draft v11, repair, and Blueprint v4 compatibility: **zero issues**;
- measured draft schema depth: **9/10**.

The nonzero command exit remains disclosed. The isolated/local dependency reproduction shows that the worker RPC limitation is not explained by a cross-worktree dependency junction.

## Files and implementation surface

Primary production surfaces:

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/templateDraftSchema.ts`
- `lib/visual-contract-compiler/types.ts`
- `lib/visual-contract-compiler/setBoardStableAuthority.ts`
- `lib/visual-contract-compiler/contractTemplateMigration.ts`
- `lib/visual-contract-compiler/contractTemplateTypes.ts`
- `lib/visual-contract-compiler/actionSemanticCoverage.ts`
- `lib/set-identity-board/setDefinition.ts`
- `lib/set-identity-board/types.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`

Focused story-neutral tests live under compiler, Set Board, visual-package, Blueprint, and generation-pipeline test directories. Checked-in historical Story Bank artifacts were not rewritten.

## Exclusions and authority boundary

There was no credential loading/check, pricing lookup, network/provider/model call, live authoring, real B0/readiness run, render, image/Vision, storage/database write, Board action, real Semantic Reconciliation, approval, publication, promotion, production activation, deployment, PR, or push. No full-book or page render occurred. Cost is exactly `$0`.

Independent technical PASS does not authorize a new live attempt. It grants no product, visual, Blueprint, Wizard, render-readiness, readiness, live-authoring, release, launch, provider, credential, deployment, or push acceptance. The `onTaskUpdate` worker RPC stability issue remains a separate planning concern and does not expand this milestone's authority.
