# R1D Offline Repair Harness and Collect-All Validation — Implementation Evidence

**Date:** 2026-08-18

**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Base:** `89ecd3389f220844241a61167e9d4140ccd72192`

**Implementation commit:** `f0ee02d3`

**Independent-QA fix commit:** `54bfd774`

**Decision Gate:** `R1D_OFFLINE_REPAIR_HARNESS_AND_COLLECT_ALL_VALIDATION_DECISION_GATE.md`

## Outcome

Implemented the approved `$0` diagnosis milestone. No best-of-N sampling was
added. No model, tier, call count, output cap, hard cost fence, retry, fallback,
Candidate, Wizard or render policy changed. No provider, credential, network,
Fresh, image or render operation was performed.

## Implementation claims

1. `offlineRepairHarness.ts` runs the production
   `compileBookVisualContractTemplate` path against an in-memory response queue.
   It records route, budget class, output cap and schema for each simulated
   call, while its result states `executionMode: offline_stub` and
   `providerCalls: 0`.
2. Optional independent typed censuses let the harness report surfaced delta
   separately from complete delta. A surfaced increase with nonpositive
   complete delta is classified as unmasking; a positive complete delta is
   destructive.
3. Draft assembly collects the safely independent authority/reference,
   source-evidence, coverage, world, cover, cast, final structural, capability
   and semantic-coverage failures into one normalized typed frontier. The
   individual validators and zero-issue Candidate boundary are unchanged.
4. A complete admissible mixed surface selects existing BookSurface authority.
   A reference-only surface retains the compact PageSpatial route. Dependent
   structural diagnoses stay persisted in the complete census.
5. If a completed repair raises the normalized complete unique-issue count,
   the compiler restores the prior draft in memory and throws
   `TemplateRepairIssueRegressionError` before another dispatch.
6. Lifecycle persistence maps that boundary to the closed failed terminal
   `draft_validation_repair_regressed`, with exact call/repair/attempt and
   previous/current count binding. It cannot produce Candidate authority.
7. The offline CLI is available as:

   `npm run visual-contract-repair-harness -- --scenario <json>`

   It writes only JSON to stdout and exits nonzero when a complete supplied
   census contains a positive delta.

## PageContract secondary investigation

Historical `page_contract_patch` could replace a complete page for a broad
final-structural target, including `actionRequirements`, which explains the
observed real action-binding/cardinality damage. This milestone does not add a
second PageContract redesign. Collect-all removes the masked mixed surface from
that route: BookSurface owns the mixed structural surface, while a pure
PageContract target uses the existing targeted application and ignores
unrelated action-array mutation. Focused tests preserve the observed failure
identity and prove no action-cardinality regression in the mixed path.

## Authority cutover

- Full-draft repair input envelope: v2; repair user prompt: v14.
- Authoring request / receipt / readiness: v42 / v46 / v44.
- B0 materialization input / manifest / verification: v31 / v40 / v40.
- Execution materialization input / result: v30 / v34.
- Supervisor request / readiness / result: v39 / v39 / v32.
- Fresh readiness: v39.
- Immediate authoring predecessors v41 / v45 / v43 are `legacy_immutable`.
- Policy v17, standard output budget v6, Candidate v9, child-output authority
  v1 and QA Wizard bridge v2 are unchanged.

## Validation evidence

- `offline-repair-harness.spec.ts`, `visual-contract-repair-loop.spec.ts`,
  `draft-reference-domain-hardening.spec.ts`,
  `draft-validation-diagnostics.spec.ts`, prompt compaction, workload
  classifier and legacy boundary: **135/135 PASS**.
- `source-authority-lifecycle.spec.ts`: **96/96 PASS**.
- Canonical authoring boundary, B0/materialization verification, execution
  materialization, Fresh and Supervisor: **331/331 PASS**.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check` was executed. Its first pass reported 3,284
  ordinary assertions passed, 65 skipped and nine failures: five established
  missing ignored-output fixtures plus four stale milestone expectations. The
  four milestone failures were corrected and their owning suites rerun green.
  The resource phase reported 608 assertions passed, one now-corrected legacy
  caller-inventory failure, and two known post-assertion worker RPC timeouts.

## Independent QA falsification targets

- Prove the harness cannot reach the real provider, credentials, network or
  artifact writers.
- Try to produce a positive complete delta that advances to another call.
- Verify complete issue identity/count determinism and that no validator rule
  was weakened or silently skipped.
- Falsify mixed BookSurface preference with unrepairable or unsafe reference
  authority; it must remain fail-closed.
- Verify reference-only routing remains PageSpatial and that dependent
  structural issues remain visible in persisted diagnostics.
- Recheck current/legacy version propagation through receipt, readiness, B0,
  execution materialization, Fresh and Supervisor.
- Confirm no budget, model, retry/fallback, Candidate, Wizard or render
  authority changed.

## Independent-QA HOLD correction

Claude Code found one valid MAJOR in the first stop guard: it compared raw
diagnostic-array length instead of normalized unique identity count. Historical
evidence contained two cases where emissions rose while unique issues fell, so
that comparison could have stopped a converging BookSurface repair.

Fix `54bfd774` makes the guard and
`TemplateRepairIssueRegressionError` constructor share normalized unique
counts. Each in-memory validation attempt is also tagged `complete` or
`route_subset`; the guard compares only two complete populations. The
regression fixes the historical-shaped trajectory of 8 emissions/8 unique to
18 emissions/7 unique and proves it cannot be classified as regression. It
also proves a route subset cannot be compared with a complete census.

Post-fix validation:

- Exact four-file Claude re-gate set: **115/115 PASS**.
- Lifecycle + harness + diagnostic suites: **120/120 PASS**.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Stop condition

Do not create Fresh Readiness, perform live authoring, reconcile Wizard state or
render until Claude Code independently returns PASS on the immutable commit
range produced by this milestone.
