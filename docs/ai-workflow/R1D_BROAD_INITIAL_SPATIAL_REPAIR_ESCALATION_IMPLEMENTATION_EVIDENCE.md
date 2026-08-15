# R1D Broad Initial Spatial Repair Escalation — Implementation Evidence

## Objective

Use the unchanged two-repair budget in a better order when the initial draft
has spatial-reference corruption across most of a book. Preserve compact
repair for small initial failures and every later residual.

## Implementation

`broadInitialPageSpatialFailureRequiresFullDraft` is a pure, exported policy
predicate. It returns true only for attempt 1 when at least five distinct,
in-range pages are affected and the set is a strict majority of the declared
page count. Duplicate targets do not affect the count. When true, the compiler
selects the existing `full_draft` route instead of the field-scoped spatial
patch. Nothing else in repair selection changes.

No story, child, companion, page, predicate, phrase or authored identifier is
embedded. No prompt, schema, model, service tier, token ceiling, maximum output,
call/repair budget, timeout, retry, fallback, pricing or candidate contract was
changed.

## Direct proof

The regression suite proves:

- six of twelve pages is not broad; seven is broad;
- duplicate targets cannot inflate the affected-page count;
- attempt 2 never escalates;
- four of eight pages is not broad;
- an eight-page initial draft with five spatially invalid pages selects
  `full_draft` on call 2;
- a single action-binding residual from that regenerated draft selects
  `page_contract_patch` on call 3;
- the repaired result becomes a valid eight-page candidate within the unchanged
  three-call/two-repair budget.

## Validation

- Direct file: `draft-reference-domain-hardening.spec.ts`: **44/44 PASS**.
- Compiler, page repair, repair loop and lifecycle: **4 files / 194 tests
  PASS**.
- Canonical live boundary and request materialization/verification: **3 files /
  229 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Single `npm run check`:
  - TypeScript and autonomous story TypeScript: PASS;
  - resource-intensive: **19 files / 566 tests PASS**, clean diagnostic
    protocol;
  - ordinary: **280 files / 3,217 tests**, with exactly the six established
    missing ignored-output fixture failures and no seventh assertion or
    infrastructure failure.

The six fixtures remain an independent release HOLD. They are not caused by
this range and do not weaken the focused technical proof.

## Authority, risk, and rollback

This local implementation has no independent technical PASS until Claude Code
reviews the exact committed range. It creates no Fresh Readiness, provider,
candidate, Reconciliation, Blueprint, Wizard or render authority. Revert the
focused implementation commit to restore the prior field-first route; all
historical artifacts remain immutable.
