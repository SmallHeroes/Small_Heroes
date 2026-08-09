# Implementation Evidence — R1D-PVB-D1A1B1-COMPACT-PAGE-CONTRACT-REPAIR

**Status:** implementation and bounded validation resume complete locally; independent Claude Code QA pending; repository/release HOLD remains at the six established ignored-fixture failures. Codex does not self-award technical PASS.
**Date:** 2026-08-09
**Exact base:** `41ffec0aeb8a6ab0344956134bb22edfd22175ec`
**Branch:** `codex/r1d-pvb-d1a1b1-compact-page-contract-repair`
**Worktree:** `C:\Users\guyna\.codex\worktrees\pagerepair1\Small_Heroes`
**Commit 1:** `aa6010b4b6f0a7c756859b35e683b9576683c895` — `feat(authoring): add compact page contract repair`
**Commit 2:** `db41363992b02040e0188981f1b37bd5cf3f5f1f` — `feat(authoring): bind page repair authority lifecycle`
**Implementation range before this record:** `41ffec0aeb8a6ab0344956134bb22edfd22175ec..db41363992b02040e0188981f1b37bd5cf3f5f1f`
**External state/cost:** none / `$0`

## Problem and verified root cause

The preceding live attempt completed one provider response and produced only page-local `draft_contract / final_structural_invariant_invalid` failures. The existing repair selector routed those failures to `full_draft`. That path resent the complete rejected draft and complete draft schema and was rejected locally by the unchanged `64,000` input-ceiling guard before a repair provider call.

The defect was therefore not a missing provider retry or an undersized model context. It was an overly broad repair payload for a typed, structurally page-local failure set. Increasing the ceiling, weakening strict schema validation, retrying the same request, or adding story-specific instructions was rejected.

## Implemented architecture

### Closed eligibility and routing

- Added repair mode `page_contract_patch`.
- It activates only when the complete typed diagnostic set is homogeneous `draft_contract / final_structural_invariant_invalid` and every locator safely identifies page-local final structure.
- Existing source-evidence-ID-only compact repair retains priority.
- Mixed families, non-page locators, malformed/unsafe identities, and every other failure cannot enter this mode and retain their existing full-draft or terminal behavior.
- No prose parsing, fuzzy lookup, story key, character, excerpt, authored ID, observed provider value, or page-specific production branch is used.

### Typed request and response

- Added `page-contract-repair-schema/v1`, schema name `PageContractRepairPatches`, system prompt `page-contract-repair-prompt/v1`, and user prompt `page-contract-repair-user-prompt/v1`.
- The strict schema is derived from the existing draft page-contract schema and accepts a non-empty array of complete page contracts with `additionalProperties: false` at the repair envelope.
- The request carries only affected page contracts, aligned in-memory validator errors, and bounded compiler-owned reference authority. It does not resend the complete rejected draft or unrelated Story Source prose.
- The parser enforces exact keys and safe page identities. Application requires the returned page set to equal the affected set exactly and rejects duplicates, omissions, additions, non-unique draft pages, and malformed values.
- Application clones the prior draft and replaces only affected `pageContracts` entries. Caller input and every non-page value remain unchanged.
- Assembly, deterministic overlays, source-evidence checks, Action Semantic coverage, and final validators all rerun after application. Compact repair does not create an acceptance bypass.

### Lifecycle and canonical authority

The new repair prompt/schema identity is bound across authoring, materialization, verification, Supervisor, and Fresh Readiness authority:

- Visual Contract authoring request: `visual-contract-authoring-request/v11`
- Visual Contract receipt: `visual-contract-authoring-receipt/v14`
- Visual Contract readiness: `visual-contract-authoring-readiness/v12`
- Candidate: unchanged `visual-contract-candidate-artifact/v7`
- Canonical live-request materialization manifest: `canonical-live-request-materialization/v9`
- Canonical live-request verification: `canonical-live-request-verification/v9`
- Execution-request materialization result: `canonical-live-execution-request-materialization-result/v5`
- Canonical execution request/readiness: `canonical-live-execution-request/v8` / `canonical-live-execution-readiness/v8`
- Canonical pre-live readiness evidence: `canonical-pre-live-readiness-evidence/v8`

Current-version checks reject stale or redigested incompatible authority before provider reachability. Historical artifacts remain immutable evidence and are not authority for a new attempt.

## Unchanged boundaries

The implementation does not change:

- Story Source content, final Visual Contract semantics, or candidate acceptance;
- model, Responses API, service tier, reasoning, or structured-output strictness;
- the `64,000` input ceiling or admission estimator;
- one initial call plus at most two repairs;
- timeout, zero transport retries, no fallback;
- `$4.884` conservative reservation or `$5.00` hard ceiling;
- Blueprint, Wizard, render, approval, storage, publication, or deployment behavior;
- dependencies, `package.json`, or `package-lock.json`.

## Focused validation before the repository gate

All tests used injected/fake provider boundaries; provider sentinels remained unreachable.

- Compiler and repair-loop/lifecycle coverage: **3 files / 82 tests PASS**.
- Materialization, verifier, and readiness coverage: **4 files / 109 tests PASS**.
- Execution Supervisor, adapter boundary, and Structured Outputs compatibility: **3 files / 194 tests PASS**.
- Canonical workload classifier: **1 file / 7 tests PASS**.
- Source-authority lifecycle after authority-tamper additions: **1 file / 51 tests PASS**.
- Focused B0 prompt/schema tamper control: **1 test PASS**.
- Deterministic TypeScript: PASS.
- `git diff --check`: PASS.

The positive lifecycle control uses a complete 12-page draft, performs one initial call followed by one `page_contract_patch` repair, and produces a candidate digest. The compact repair admission retains at least `4,096` conservative units of headroom under the unchanged ceiling. Its prompt excludes unrelated full-draft fields including `worldType` and `coverContract`.

Negative coverage includes closed eligibility, source-evidence repair priority, mixed-family fallback, exact error-to-page alignment, strict keys, duplicate/missing/unexpected/unsafe pages, non-unique draft pages, non-mutation, complete revalidation, still-oversized rejection, schema compatibility, stale-version migration, and prompt/schema authority tampering before provider reachability.

## Original literal repository check

The authorized literal `npm run check` was invoked exactly once and was not rerun.

- TypeScript phase: PASS.
- Canonical workload inventory: `287` files — ordinary `268`, resource-intensive `19`.
- Ordinary phase: exited nonzero only on the exact six established missing ignored-output fixture assertions. There was no seventh implementation assertion.
- Resource-intensive phase at the repository policy's two workers: failed on **nine 5-second test timeouts** plus **three `onTaskUpdate` RPC timeouts**. Diagnostic classes included `test_timeout`, `on_task_update_rpc_timeout`, and `signal_or_exit_failure`.
- The task stopped fail-closed. The ordinary phase and literal repository check were not retried.

The six ordinary failures remain the separate release HOLD:

- `lib/__tests__/child-lexicon-ages-5-8.spec.ts` — 1
- `lib/__tests__/momentum-gate-koko.spec.ts` — 1
- `lib/__tests__/page-entity-qa.spec.ts` — 1
- `lib/__tests__/set-appearance-ref-budget.spec.ts` — 1
- `lib/__tests__/story-read-back-validation.spec.ts` — 2

## Authorized replacement resource validation

Guy authorized a narrow replacement for the failed resource phase only. It did not authorize another ordinary phase or another `npm run check`.

The repository-owned canonical classifier derived exactly all 19 `resource_intensive` specs. The existing phase runner executed that complete set exactly once, in deterministic classifier order, as one resource phase with:

- `workerLimit: 1`
- file parallelism enabled
- diagnostics enabled
- unchanged test timeout and repository configuration
- no retry, skip, quarantine, dependency change, or fallback

Result:

- **19 files / 547 tests PASS**
- Vitest duration: `224.36 s`
- phase evidence version: `small-heroes-vitest-phase-diagnostic/v1`
- phase: `resource_intensive`
- file count: `19`
- worker limit: `1`
- elapsed milliseconds: `227642`
- exit code: `0`
- signal: `null`
- launch error: `null`
- diagnostic protocol valid: `true`
- diagnostic records/bytes: `1 / 249`
- failure classes: none
- gate status: `passed`

No assertion, test timeout, RPC/IPC, reporter, launch, signal, teardown, or diagnostic-protocol failure occurred. No resource spec ran more than once. After this PASS, deterministic `npx --no-install tsc --noEmit` and range `git diff --check` both passed. No test or production file changed during the validation resume.

This replacement proves the affected resource suite can complete cleanly under the approved bounded worker setting. It does not erase the original infrastructure failure and does not turn the literal repository gate green; the six ignored-fixture failures remain release-blocking.

## Commit scope

Commit 1 owns the compiler contract and direct repair behavior:

- `lib/visual-contract-compiler/pageContractRepair.ts`
- compiler exports, schema projection, compile routing, and adapter-facing repair mode
- direct page-repair and repair-loop tests

Commit 2 owns lifecycle and canonical authority binding:

- authoring lifecycle and canonical live boundary
- B0/materialization/verifier authority
- Execution Request/Supervisor/Fresh Readiness authority
- schema-compatibility, lifecycle, tamper, and workload-inventory tests

The final documentation commit adds only `CURRENT.md` and this implementation-evidence file. The Decision Gate remains unchanged from its approved state. No dependency or lockfile changed.

## Explicitly absent actions and authority

No credential check/read/load, pricing lookup, network/provider/model call, real B0 materialization, Fresh Readiness, canonical preflight, live authoring, candidate generation, Semantic Reconciliation, Blueprint/Wizard execution, render/image/Vision, storage/database, Board action, approval, publication, promotion, production activation, deployment, PR, or push occurred. No historical artifact was rewritten or reinterpreted.

Accordingly, this milestone grants no Fresh Readiness, spend, live-authoring, candidate, Blueprint, Wizard, render, product, visual, release, deployment, or push authority. Independent Claude Code technical QA remains required.

## Rollback

Before any new authority is materialized, revert the documentation commit, then `db41363992b02040e0188981f1b37bd5cf3f5f1f`, then `aa6010b4b6f0a7c756859b35e683b9576683c895`. No external state requires cleanup. If a future attempt creates artifacts, preserve them as historical evidence, place live authoring on HOLD, and rematerialize from a separately reviewed head rather than rewriting them.

## Claude Code read-only falsification targets

1. Reconcile exact branch, base, three linear commits, clean worktree, no overlapping writer, and unpushed/no-upstream state.
2. Prove activation is closed to homogeneous page-local final-structure issues; source-evidence-ID repair retains priority and mixed/non-page inputs cannot enter the compact mode.
3. Falsify the strict page schema, exact affected-page set, deterministic ordering, clone/non-mutation guarantee, and rejection of duplicate/missing/unexpected/unsafe/non-unique pages.
4. Prove full assembly, overlays, source authority, Action Semantic coverage, and final validators rerun after application.
5. Reproduce the 12-page two-call lifecycle control, candidate production, absence of full-draft fields, and at least `4,096` conservative input headroom.
6. Verify all prompt/schema/version/digest bindings and fail-closed tamper rejection across request, B0, verifier, Supervisor, and readiness before provider reachability.
7. Verify historical cutover behavior and that candidate v7, model, endpoint/tier, reasoning, ceiling, call/repair budget, timeout, retries, fallback, cost ceilings, and downstream semantics are unchanged.
8. Reconcile the original `npm run check` as six known ordinary fixture failures plus the recorded resource infrastructure failures, without treating either as hidden technical PASS.
9. Derive the same 19-resource inventory and audit the exact-once one-worker replacement record: 19 files / 547 tests, clean diagnostic protocol, no failure class.
10. Search production changes for story/page/character/excerpt-specific literals, arbitrary patching, prompt/response persistence, credential reachability, dependency drift, or excluded external actions.
11. Check `CURRENT.md` and this record for factual fidelity and ensure they neither self-award PASS nor grant Fresh Readiness/live/render/release authority.
