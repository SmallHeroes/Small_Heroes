# R1D Visual Contract Per-Attempt Output Budget Reallocation — Implementation Evidence

**Date:** 2026-08-16

**Status:** focused QA corrections complete; Claude Code micro re-gate pending;
repository gate remains HOLD on one resource-phase `onTaskUpdate` RPC timeout

**Branch:** `codex/r1d-visual-contract-per-attempt-output-budget-reallocation`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `982e554b8506f802712139faff8ef7d9e137987a`

**Production commit:** `19467741`

**Focused-test commit:** `21911148`

**Original closeout / QA-fix base:**
`c5c1ca0a4c5d5544d356dc320ed2b501985dc74f`

**QA-fix commit:** this focused local commit

**External cost:** `$0`

## Authority and root cause

Guy explicitly approved all nine decisions in
`R1D_VISUAL_CONTRACT_PER_ATTEMPT_OUTPUT_BUDGET_REALLOCATION_DECISION_GATE.md`.
Repository investigation confirmed the brief's hypothesis: the request stored
one page-derived `maxOutputTokens` value and the compiler reused it for the
initial call and both standard repairs. Projected and runtime reservation math
also multiplied that shared cap instead of identifying each remaining standard
attempt. The OpenAI adapter retained completion status but no sanitized provider
incomplete reason.

The correction reallocates the already-authorized standard output pool. It does
not add output capacity, calls, repairs, retries, fallback, or actual-spend
opportunism.

## Independent QA HOLD and focused corrections

Claude Code reviewed exact range
`982e554b8506f802712139faff8ef7d9e137987a..c5c1ca0a4c5d5544d356dc320ed2b501985dc74f`
and returned HOLD with two MAJOR findings plus advisory MINORs. Repository
inspection validated the findings without contradicting the nine approved
decisions.

1. **MAJOR-1 — request-invalid schedule laundering:** readiness previously
   accepted a failed `request_invalid` zero-attempt receipt when its schedule
   matched the malformed request, bypassing the separately derived snapshot
   fallback. That branch now requires exact equality with the snapshot fallback
   unconditionally. A direct regression constructs the shape-valid 13-page
   diagnostic schedule `[52,000, 39,000, 26,000]`, re-digests the invalid
   12-page request, forges its receipt to echo the same schedule and cost, and
   proves readiness rejects it.
2. **MAJOR-2 — undeclared provider reachability widening:** the milestone adapter
   had newly admitted the terminal cleanup `6,000` input / `2,000` output pair
   when paired with the page-spatial schema. That admission is removed. The real
   adapter again preserves the predecessor cleanup non-reachability: only 64K
   input with a canonical standard-attempt cap is admitted.
3. **MINOR-1/MINOR-4 — schedule bounds:** current schedule validation now requires
   its middle/base entry to remain in the existing 32K–64K band and every
   standard cap to remain at or below the 64K provider output ceiling. The 8-
   and 12-page schedules remain valid; direct lower, exact-upper and over-upper
   cases fail closed as intended.
4. **MINOR-2 — hard-ceiling defense:** live request policy validation now rejects
   `projectedMaxUsd > hardCeilingUsd` independently of exact projection rebuilds.
5. **MINOR-5 — invalid pair coverage:** direct request-body and real-adapter tests
   reject 64K/2K, 6K/48K, 6K/2K with the draft schema, and 6K/2K with the
   page-spatial schema as `output_budget_pair`; credential and transport remain
   unreachable.
6. **MINOR-6 — dead helper:** repository-wide inspection found no call site or
   external binding for `projectedMaximumAuthoringCostUsd`; the export is
   deleted. The attempt-specific projection helper remains authoritative.

MINOR-3 remains advisory because a standalone receipt authorizes nothing and
readiness rebinds receipt, request and snapshot. MINOR-7 remains a pre-existing
low-risk `stable_prop_scope_patch` end-to-end coverage limitation. Neither was
expanded into this fix. Durable canonical-preflight attestation also remains a
separately gated blocker.

## Implemented behavior

1. `authoringPolicy.ts` owns the only canonical pure schedule function. For the
   existing page-derived base `B`, it returns initial `floor(4B/3)`, repair 1
   `B`, and repair 2 `3B - initial - repair1`.
2. Required admitted examples are exact:
   - 12 pages: `[48,000, 36,000, 24,000]`, pool `108,000`;
   - 8 pages: `[42,666, 32,000, 21,334]`, pool `96,000`.
3. The initial draft and every standard repair route select the schedule entry
   for the logical attempt. The lifecycle retains the existing compact
   terminal-reference cleanup allowance at `2,000` output / `6,000` input; the
   real adapter retains its predecessor boundary and does not admit that pair.
4. Request, receipt and readiness persist the exact versioned schedule, total
   pool and canonical digest. Every attempt persists
   `appliedMaxOutputTokens`. Validation binds schedule shape, arithmetic,
   ordering, attempt association, provider-reported usage, projected cost and
   reservation-before-call evidence.
5. Projected exposure sums all three exact standard caps plus cleanup. Runtime
   exposure sums only the exact remaining standard caps plus remaining cleanup.
   The 12-page projected maximum remains `$4.99125`; observed reservation test
   values are `[4.99125, 3.040125, 1.485]`.
6. Current request validation derives the schedule from the admitted snapshot
   page count. A structurally invalid request can produce only a handled,
   zero-attempt `request_invalid` receipt carrying the separately derived
   authoritative schedule; it cannot promote the tampered schedule into fresh
   evidence.
7. Live materialization, verification, execution materialization, Supervisor
   and Fresh Readiness carry one exact `requestPolicy` authority containing the
   schedule, locked runtime settings and cost authority. Any valid-but-different
   schedule is rejected at the B0/Supervisor/Fresh bindings.
8. The Responses adapter maps only documented local spellings
   `max_output_tokens` and `content_filter`; absent, malformed, unknown or future
   values collapse to `other_or_absent`. Only that enum crosses the boundary.
   Raw response bodies, provider messages, prompts, outputs, stacks and secrets
   are not added to evidence.
9. Provider `incomplete` or any other invalid completion remains terminal as
   `completion_status_invalid`, with no repair, retry, fallback or candidate.
   The enum is observability only.

## Explicit authority cutover

| Authority | Prior | Current |
| --- | ---: | ---: |
| Authoring policy | v10 | v11 |
| Authoring request / receipt / readiness | v28 / v31 / v29 | v29 / v32 / v30 |
| OpenAI Responses provider evidence | v5 | v6 |
| Live materialization input / manifest / verification | v17 / v26 / v26 | v18 / v27 / v27 |
| Execution materialization input / result | v16 / v20 | v17 / v21 |
| Supervisor request / readiness / result | v25 / v25 / v17 | v26 / v26 / v18 |
| Fresh Readiness evidence | v25 | v26 |

Immediate predecessors are classified `legacy_immutable`; later unknown
versions remain unsupported. No historical artifact was rewritten, migrated or
recalculated.

## Preserved behavior

- model `gpt-5.6-sol`, Responses endpoint, default service tier and medium
  reasoning;
- strict structured outputs, system/user prompts, schema and candidate
  semantics;
- 64K standard input ceiling and existing route-admission behavior;
- three standard calls, two standard repairs and one narrowly eligible terminal
  cleanup in lifecycle policy;
- 20-minute timeout, transport retries `0`, tools disabled and no fallback;
- hard `$5.00` ceiling and exact total standard output pool;
- 12-page maximum admission. A 13-page request still fails closed as
  `page_budget_partition_decision_required` and also exceeds the unchanged hard
  ceiling under its derived `[52,000, 39,000, 26,000]` diagnostic schedule;
- repair routing, logical terminal cleanup eligibility and candidate acceptance.

Durable canonical-preflight attestation was not implemented or synthesized.
`canonicalPreflight` remains `not_run`; this is a separate required gate before
Blueprint, Wizard or render authority.

## Validation

### Focused QA-fix validation

Only directly affected slices were invoked, as required:

- schedule bounds plus forged `request_invalid` readiness laundering: 1 file /
  7 tests PASS;
- invalid adapter output-budget pairs, including real-boundary 6K/2K rejection:
  1 file / 4 tests PASS;
- exact projected arithmetic above the hard ceiling: 1 file / 1 test PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

No assertion or infrastructure failure occurred. Literal `npm run check` was not
rerun because its one authorized invocation was already exhausted.

### Original implementation validation

Focused validation covered all ten modified test files and 463 unique tests:

- compiler, repair loop, canonical boundary, lifecycle, live materialization
  and verification: 6 files / 364 tests PASS;
- execution request materialization: 1 file / 20 tests PASS;
- Supervisor: 1 file / 35 tests PASS;
- canonical launcher: 1 file / 31 tests PASS;
- Fresh Readiness: 13 unique cases PASS across three bounded filtered runs.

These tests directly cover 8- and 12-page integer schedules, exact `3B` pools,
unchanged hard-cost math, attempt 1/2/3 options, every standard repair route,
cleanup, remaining-cap reservations, request/receipt/readiness persistence and
tamper rejection, materialization/Supervisor/Fresh bindings, legacy immutable
predecessors, current-version fail-closed behavior, incomplete-reason
normalization, absent/unknown reasons, cap-hit terminal routing and raw-material
exclusion.

One earlier monolithic Fresh Readiness focused invocation passed all 13 test
assertions but emitted one unhandled `[vitest-worker]: Timeout calling
"onTaskUpdate"`. The segmented runs completed without an RPC event. The first
event remains part of the evidence and was not reclassified as an assertion
failure or silently waived.

Deterministic checks before the repository gate:

- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS;
- the local Prisma client used only for TypeScript was generated into an
  ignored, worktree-local dependency tree from the checked-in schema. No
  credential, `.env`, database or network access occurred, and no dependency or
  lockfile changed.

### Single repository gate — HOLD

Literal `npm run check` was invoked exactly once and was not retried.

- TypeScript and autonomous-story typecheck: PASS.
- Canonical inventory: 300 files = 281 ordinary + 19 resource-intensive.
- Ordinary phase: 261 files passed, 16 skipped, 4 failed; 3,197 tests passed,
  65 skipped, 5 failed. Its only failures were the established absent ignored
  output fixtures in unchanged `child-lexicon-ages-5-8.spec.ts`,
  `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, and two
  `story-read-back-validation.spec.ts` cases.
- Resource-intensive phase: 19/19 files and 581/581 assertions passed, but
  Vitest emitted one unhandled `[vitest-worker]: Timeout calling
  "onTaskUpdate"` after the assertions.
- The resource diagnostic was valid and closed: one 277-byte record with
  `on_task_update_rpc_timeout` and the resulting `signal_or_exit_failure`.
  There was no malformed/missing diagnostic record, unknown diagnostic class,
  launch error, signal, IPC/reporter body leakage, or new assertion failure.

The milestone instruction explicitly requires any additional timeout/RPC/IPC,
reporter, launch, signal, teardown or diagnostic-protocol failure to stop
fail-closed. Therefore this range is not locally green and Codex does not claim
technical PASS. The five missing fixtures remain the separate known release
HOLD, while the resource-phase RPC timeout is a new repository-gate HOLD that
independent QA must assess. The full gate must not be rerun.

## Commit and file boundaries

Production commit `19467741` changes only:

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/canonicalLiveVisualContractAuthoring.ts`
- `lib/visual-package/canonicalPreLiveReadiness.ts`
- `lib/visual-package/liveExecutionRequestMaterialization.ts`
- `lib/visual-package/liveExecutionSupervisor.ts`
- `lib/visual-package/liveRequestMaterialization.ts`
- `lib/visual-package/openaiResponsesVisualContractAuthoringAdapter.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- `scripts/visual-contract-authoring.ts`

Focused-test commit `21911148` changes only ten corresponding test files under
`lib/__tests__` and `lib/visual-package/__tests__`. This evidence file,
`CURRENT.md`, and the consumed Decision Gate status are the closeout commit.

The focused QA-fix changes only the central schedule policy and lifecycle
validator, live request policy validator, OpenAI adapter boundary, three directly
corresponding test files, `CURRENT.md`, and this evidence file. It preserves the
three earlier commits and adds one local QA-fix commit.

## Rollback, limitations and next gate

Rollback of the QA correction is a focused revert of the QA-fix commit. Rollback
of the whole milestone then reverts the closeout, test and production commits in
that order. There is no data or artifact migration. Any newly created authority
under the cutover versions would become inapplicable after rollback; historical
evidence remains immutable.

This implementation has no live proof and produces no candidate. The new
allocation is deterministically tested but has not been exercised against a
provider. No Fresh Readiness can follow until independent QA reviews the exact
QA-fix range and the RPC HOLD is explicitly resolved through the authority
workflow. The real adapter's retained predecessor boundary rejects the logical
cleanup 6K/2K pair; resolving this latent cleanup reachability limitation needs
a separate Decision Gate. Codex does not self-award independent technical PASS.

## Exclusions

No credential access/check/loading; no `.env` access; no pricing lookup,
network/provider/model call; no canonical application Git probe, B0, Fresh Readiness, canonical
preflight, live authoring, candidate, Semantic Reconciliation, Blueprint or
Wizard authority; no image/Vision/render, storage/database, Board, publication,
promotion, QA/Production deployment, PR or push. External cost remained `$0`.
