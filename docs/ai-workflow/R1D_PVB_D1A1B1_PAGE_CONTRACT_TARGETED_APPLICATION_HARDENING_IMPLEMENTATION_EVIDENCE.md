# R1D-PVB-D1A1B1 Page-Contract Targeted Application Hardening — Implementation Evidence

## Status

Implementation is complete locally. Independent Claude Code QA is pending.
Codex does not self-award technical PASS.

## Topology

- Worktree: `C:\Users\guyna\.codex\worktrees\targetedrepair1\Small_Heroes`
- Branch: `codex/r1d-page-contract-targeted-application-hardening`
- Exact base: `8cc7ddca293b36c594ea3dce32690f9d334872c0`
- Code/test/Decision-Gate commit: `7763ae2e5cc2820528762865d8bf3cf17bc13cf2`
- No upstream or same-name remote branch existed during implementation.
- One implementation task held write authority for this worktree. Other
  worktrees and user changes were not modified.

## Triggering evidence

The consumed predecessor attempt used output root
`outputs/r1d-terminal-reference-cleanup-attempt-3-fresh-readiness-8cc7ddca-20260815T203448238Z`.
Its immutable authority and outcome were:

- Fresh Readiness / Execution Request / Supervisor readiness versions:
  v18 / v18 / v18. Their exact digests remain in the canonical artifacts and
  are intentionally not reconstructed from abbreviated handoff text here.
- Receipt / readiness versions: v24 / v22. Their exact digests likewise remain
  canonical-artifact evidence rather than a documentation transcription.
- Logical provider calls / repairs / transport retries / fallback:
  `3 / 2 / 0 / false`
- Provider usage input/cache-write/cached/output/reasoning/total:
  `44,629 / 44,620 / 0 / 47,385 / 7,534 / 92,014`
- Nominal/conservative accounting: `$1.700471 / $1.870530`
- Terminal class: `draft_validation_repair_exhausted`
- Candidate, Reconciliation, Blueprint, Wizard and render authority: none

Attempt 2 left thirteen typed issues. The final `page_contract_patch` resolved
all thirteen requested targets but, because the runtime assigned each complete
provider page wholesale, admitted fifteen unrelated new issues: two closed
catalog gaps, one cover projection issue and twelve structural issues. The
repair plan already identified the intended fields exactly; the defect was the
local application boundary.

Historical artifacts were read-only evidence. This milestone did not rewrite,
redigest or reuse them as new authority.

## Implementation

### Closed write authority

`applyPageContractRepairs` now starts from a deep clone of the original draft
and applies only the fields authorized by each typed target:

- `action_coverage_cardinality_invalid`: target action `beatId`, and at most
  one existing same-page coverage record converted to the same beat with exact
  `{kind: "action_requirement"}`. Array length and evidence identity must not
  change.
- `action_beat_binding_cardinality_invalid`: target action `beatId` only.
- `coverage_action_binding_cardinality_invalid`: target coverage `beatId` only.
- `page_spatial_reference_outside_zone`: exact target action/index/field only,
  and only one permitted spatial authority ID.
- represented-elsewhere target: exact `coverageIndex`, with only an exact
  permitted `contractPointer`/`contractValue` pair copied.
- closed presentation capability target: exact `coverageIndex`, with only the
  permitted presentation class and pointer/value pair copied while retaining
  beat/source identity.
- `final_structural_invariant_invalid`: the sole complete-page replacement
  authority, with the existing location/zone topology preservation retained.

Response fields outside that closure are ignored. Target identity, exact page
and item presence, unique target keys, permitted values, response shape and
input nonmutation are fail-closed. Multiple same-code coverage targets remain
distinct because `coverageIndex` is part of canonical target identity.

### Authority cutover

- page-contract repair user authority: v12
- authoring policy: v5
- authoring request / receipt / readiness: v22 / v25 / v23
- live materialization input / manifest / verification: v11 / v20 / v20
- execution materialization input / result: v10 / v14
- Supervisor request / readiness / result: v19 / v19 / v11
- Fresh Readiness evidence: v19

Immediate predecessors are accepted only as historical immutable records where
the existing lifecycle explicitly permits them. They are not current authority.
Prompt prose and JSON schema, model, Responses API, service tier, reasoning,
64K input ceiling, call/repair budgets, terminal cleanup budget, timeout,
transport retry, fallback, conservative/hard cost caps, candidate semantics,
Blueprint, Wizard, Reader and renderer behavior are unchanged.

## Validation

### Before the repository gate

- `page-contract-repair.spec.ts`: 60/60 PASS
- `visual-contract-repair-loop.spec.ts`: 31/31 PASS
- `source-authority-lifecycle.spec.ts`: 69/69 PASS
- Combined affected ordinary surface: 3 files / 160 tests PASS
- Selected canonical/resource surface: 7 files / 321 tests PASS
  - canonical live authoring boundary: 156
  - live request verification: 50
  - live execution supervisor: 34
  - live request materialization: 34
  - live execution request materialization: 20
  - canonical materialization input: 15
  - canonical pre-live readiness: 12
- Deterministic TypeScript: PASS
- `git diff --check`: PASS

### Single literal repository gate

`npm run check` was invoked exactly once.

- Both TypeScript contracts passed.
- Resource-intensive phase: 19 files / 577 tests PASS in 90.45 seconds;
  diagnostics were valid and reported no timeout, RPC/IPC, reporter, launch,
  signal or teardown class.
- Ordinary phase: exit 1 after 34.953 seconds. It contained the exact six
  established missing ignored-output fixture failures plus six new assertion
  failures:
  - five broad legacy repair fixtures in
    `draft-reference-domain-hardening.spec.ts` attempted to add/remove complete
    coverage or action records, which is no longer authorized by a field target;
  - one `set-appearance-ref-budget.spec.ts` fixture assumed an approved board
    PNG happened to exist under the current worktree's `outputs` directory.

The gate was not rerun.

### Post-gate correction evidence

- The five legacy compiler fixtures now assert fail-closed rejection of array
  insertion/removal while retaining the routing and exact target-prompt checks.
- Direct page-repair coverage also rejects both inserted and removed coverage
  records.
- The Set Appearance test creates and removes its own isolated temporary board
  bytes; production board behavior is unchanged.
- Direct post-correction validation: 2 files / 48 tests PASS.
- Full affected surface after correction: 5 files / 208 tests PASS.
- Deterministic TypeScript: PASS.
- `git diff --check`: PASS.

The six ignored-output fixtures remain an independent release HOLD. Their
content and policy were not changed. Because the literal repository gate was
not rerun, this evidence claims only focused post-gate closure, not a green
literal repository gate.

## Boundaries

- Dependency preparation: isolated `npm ci --offline --ignore-scripts`; local
  Prisma generation only.
- Credentials accessed: none
- Pricing/network/provider/model calls: none
- Fresh Readiness / canonical preflight / live authoring: not run
- Candidate / Reconciliation / Blueprint / Wizard / render: none
- Storage/database/Board/approval/publication/deployment: none
- External cost: `$0`
- Production: untouched

## Rollback

Revert commit `7763ae2e`. No artifact migration or cleanup is required because
historical output roots were not changed and no new runtime authority was
created.

## Independent QA targets

Claude Code should try to falsify:

1. Every field-scoped family writes only its exact typed target.
2. Unrelated provider page drift is ignored rather than applied.
3. Insert/remove/reorder, evidence-ID drift, stale indexes, duplicate targets,
   malformed values and out-of-catalog values remain fail-closed.
4. Multiple same-code coverage targets retain unique identity.
5. Structural repair remains the only complete-page route and preserves local
   topology.
6. Input drafts are never mutated.
7. Every current lifecycle/materialization/version binding is complete and each
   immediate predecessor is legacy-only.
8. Prompt/schema/model/budget/retry/fallback/candidate/downstream behavior is
   unchanged.
9. The one repository-gate result and post-gate focused corrections are
   recorded without converting the six-fixture release HOLD into a PASS.
10. No historical artifact, credential, provider, render, storage or Production
    boundary changed.
