# R1D-PVB-D1A1B1 Whole-Book Action-Binding Diagnostic Aggregation - Decision Gate

## Decision

Collect typed page-level `DraftAuthorityReferenceDomainError` issues across the whole canonical draft before selecting the existing complete-page repair. This prevents bounded repair calls from discovering the same coherent issue family one page at a time. It is a general compiler correction, not a Story Source special case.

## Nine decisions

1. Aggregate only typed `DraftAuthorityReferenceDomainError` issues emitted by page action grounding.
2. Preserve exact page/action/coverage locators and deterministic canonical page order.
3. Keep every non-authority exception fail-fast.
4. Throw one combined typed authority error only after every canonical page has been inspected.
5. Reuse the existing closed `page_contract_patch` planner and strict schema.
6. Preserve exact complete affected-page application and full revalidation.
7. Change no prompt, schema, model, service tier, token/call/repair budget, timeout, retry, fallback or cost policy.
8. Keep historical artifacts immutable; a new pushed-head Fresh Readiness is required.
9. Only a valid candidate may proceed through Reconciliation, Blueprint/Visual Package, Wizard dry-run and one local LOW portrait-page render; production remains blocked.

## Acceptance and rollback

A multi-page regression must prove all affected pages appear in one repair and return a valid candidate in one bounded repair. Existing single-page, invalid-output and lifecycle suites, TypeScript and diff check must pass. Rollback is the focused commit; it restores page-by-page fail-fast behavior without mutating artifacts.
