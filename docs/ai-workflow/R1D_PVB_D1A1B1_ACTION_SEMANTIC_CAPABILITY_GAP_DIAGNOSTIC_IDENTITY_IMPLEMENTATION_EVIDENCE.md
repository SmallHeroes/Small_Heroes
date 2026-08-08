# R1D-PVB-D1A1B1 Action Semantic Capability-Gap Diagnostic Identity - Implementation Evidence

**Date:** 2026-08-09
**Base:** `769ab56f1ec332172a9976c2bbd567ba79121f3c`
**Branch:** `codex/r1d-pvb-d1a1b1-action-semantic-gap-diagnostic-identity`
**Implementation commit:** `456ac1cc33380dab6de2e903cb3dc846596df9dd`
**Independent QA:** pending

## Outcome

The milestone implements the nine approved architectural decisions from the companion
Decision Gate. A closed Action Semantic Catalog capability gap now produces a typed,
sanitized structural identity in the existing per-attempt diagnostic trail. The change is
general for every Story Source and does not alter semantic capability or repair behavior.

## Trigger evidence

The consumed live attempt at immutable head `769ab56f...` completed one provider response
and stopped on exactly one `action_semantic_capability_gap`. Its canonical receipt v12 and
readiness v10 correctly persisted the terminal class, gap count, one logical call, zero
repairs/retries/fallback, usage, cost, and absence of candidate/downstream authority. They
did not persist a safe page/coverage locator. Raw provider material had correctly been
discarded, so the missing capability could not be reconstructed without guessing.

Claude Code independently returned PASS for that attempt's execution-record and artifact
fidelity. That review granted no retry, product, visual, candidate, Blueprint, Wizard,
render, billing, release, or deployment acceptance.

## Implemented contract

### Producer-owned identity

- `ActionSemanticCapabilityGap` now carries the producer-owned `coverageIndex` captured
  while the draft coverage array is enumerated.
- `actionSemanticCapabilityGapDiagnosticIssues()` emits only
  `action_semantic / closed_catalog_capability_gap` plus a structural locator.
- A safe page emits `page_item / page_action_semantic_coverage / disposition` with page and
  coverage index. An unsafe page emits the existing bounded `collection_item` fallback.
- Sorting is deterministic by page, coverage index, beat identity, and source phrase, but
  only the page/index structural projection crosses the evidence boundary.
- Beat IDs, source-evidence IDs, source phrases, predicates, authored values, prompts,
  responses, provider messages, stacks, paths, hashes, and credentials are excluded.

### Exact attempt binding

`ActionSemanticCapabilityGapError` owns both the typed emission sets and the canonical
diagnostic trail. When a gap appears after an earlier full-draft repair, the compiler
prepends the prior repair emissions and terminates with the gap emission on the matching
completed provider attempt. The lifecycle applies that full trail through the existing
validator. Initial-call and post-repair gaps therefore cannot be misbound to attempt 1.

The terminal remains:

- code `action_semantic_capability_gap`;
- phase `action_semantic_capability`;
- class `semantic_capability_failure`;
- eligibility `ineligible`;
- reason `semantic_capability_not_repairable`.

No additional repair or provider call is authorized by the diagnostic.

### Versioning and immutable history

- `draft-validation-attempt-diagnostics/v2` is current; v1 is rejected by the current
  validator and remains historical inside legacy artifacts.
- `visual-contract-authoring-receipt/v13` is current; v12 becomes `legacy_immutable`.
- `visual-contract-authoring-readiness/v11` is current; v10 becomes `legacy_immutable`.
- Request v10, candidate v7, OpenAI authoring evidence v3, provider-failure evidence v2,
  Blueprint receipt/validator v4, prompt/schema/model/budget authorities, and downstream
  contracts are unchanged.

## Preserved invariants

The existing trail remains the sole authority for canonical normalization, ordering,
deduplication, emitted/current/transition counts, 128-item persisted cap, truncation,
exact-key validation, canonical persistence, readiness deep-copy, and exact
receipt-to-readiness equality. Duplicate structural gaps preserve truthful `emittedCount`
while canonical `currentUniqueCount` deduplicates them.

The implementation does not change:

- Action Semantic Catalog v3 or coverage v5 capability;
- acceptance or candidate semantics;
- full-draft or compact-repair routing;
- model, endpoint, service tier, reasoning, prompt, or structured-output schema;
- 64K input ceiling, one-initial/two-repair budget, timeout, zero transport retries, or no
  fallback;
- `$4.884` conservative reservation or `$5.00` hard ceiling;
- Semantic Reconciliation, Blueprint, Wizard, renderer, storage, publication, or release
  policy.

## Validation evidence

### Focused tests

- `lib/__tests__/draft-validation-diagnostics.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`

Result: **2 files / 65 tests PASS**.

This selection directly covers closed-code validation, page/index ordering, unsafe-page
fallback, duplicate normalization, count/truncation/version/extra/missing-key tampering,
initial-call terminal evidence, receipt/readiness write-read-revalidation, sanitization,
and correct attempt-2 binding after a full-draft repair.

- `lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts`

Result: **1 file / 132 tests PASS** under the resource-intensive two-worker bound.

- `lib/__tests__/action-semantic-catalog.spec.ts`
- `lib/__tests__/draft-action-authority.spec.ts`
- `lib/__tests__/visual-contract-live-authoring.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/__tests__/visual-contract-text-first-compiler.spec.ts`

Result: **5 files / 78 tests PASS**.

Combined focused result: **8 files / 275 tests PASS**.

Deterministic `npx --no-install tsc --noEmit`: PASS.
`git diff --check`: PASS.

### Literal repository gate

`npm run check` was invoked exactly once and was not retried. TypeScript passed. The
canonical inventory was **286 files**:

- ordinary: **267 files**, four workers, exit `1` only for the exact six established
  missing ignored-output fixtures, elapsed `33.564 s`;
- resource-intensive: **19 files**, two workers, PASS, elapsed `101.737 s`.

Both diagnostic protocols were valid. No seventh assertion and no timeout, RPC/IPC,
reporter, launch, signal, termination, teardown, or diagnostic-protocol failure occurred.
The repository and release therefore remain HOLD only at the pre-existing six-fixture
baseline; that separate HOLD is not an implementation finding in this milestone.

## Rollback

Rollback is the focused implementation commit before any new authority is materialized.
No existing artifact was migrated, rewritten, redigested, or promoted. After independent
QA and push, any operational continuation requires new B0/Execution Request/Fresh
Readiness authority bound to the new exact head.

## Exclusions and cost

No credential was accessed; no pricing lookup, network/provider/model call, B0/Fresh
Readiness, canonical preflight, live authoring, candidate, Semantic Reconciliation,
Blueprint/Wizard execution, render/image/Vision, storage/database, Board action,
publication, promotion, activation, deployment, or push occurred. External cost was `$0`.

## Independent QA target

Claude Code must review exact immutable range:

`769ab56f1ec332172a9976c2bbd567ba79121f3c..456ac1cc33380dab6de2e903cb3dc846596df9dd`

Codex claims implementation completion and local validation only; it does not self-award
independent technical PASS.
