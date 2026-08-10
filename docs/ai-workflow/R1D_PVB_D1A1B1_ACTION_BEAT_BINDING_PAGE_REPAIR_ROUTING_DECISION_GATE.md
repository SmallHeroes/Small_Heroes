# R1D-PVB-D1A1B1 Action-Beat Binding Page-Repair Routing - Decision Gate

## Decision

Route the closed typed action/coverage binding-cardinality authority family into the existing complete-page `page_contract_patch` lane. The route is general for every Story Source and changes no provider output schema, model, service tier, budget, timeout, retry/fallback, candidate policy or cost ceiling.

## Observed behavior and root cause

The post-structural-compaction live attempt completed one provider response. Local validation emitted exactly three page-2 issues: two `action_beat_binding_cardinality_invalid` issues at action indices 2 and 3, and one `coverage_action_binding_cardinality_invalid` issue at coverage index 14. Together they describe an incomplete page-local action identity graph. The complete-page repair lane already owns this kind of correction, but its closed planner did not recognize these typed identities, so they fell through as terminal.

## General solution

- Admit only the three closed page-local action binding identities: the existing action-to-coverage cardinality identity and the two exact beat/action binding identities.
- Validate every structural locator against the current draft before selecting repair; use no prose parsing, authored-ID inference, fuzzy matching or Story Source literal.
- Send the complete affected page, typed targets and deterministic invariant hints through the existing strict page-repair input/output boundary.
- Apply only the complete exact affected-page set to an immutable clone and rerun full compilation and validation before candidate persistence.

## Nine architectural decisions

1. Reuse `page_contract_patch`; create no new repair framework or response schema.
2. Eligibility is a closed coherent family of the three typed identities and their exact field-role/reference-class locator shapes.
3. Routing authority derives only from compiler-owned positive page/action/coverage indices that resolve uniquely in the same draft.
4. Malformed, mixed, duplicate, stale, missing-page, missing-action and missing-coverage inputs remain terminal.
5. Repair scope is the complete exact affected page; partial-field mutation is not an authority boundary.
6. Exact page-set application and full post-repair validation remain mandatory before candidate persistence.
7. Advance page-contract system/user prompt authority to v8; keep the strict output schema v1 unchanged.
8. Preserve the model, service tier, 64K/36K ceilings, one-initial/two-repair budget, twenty-minute timeout, zero transport retries, no fallback, `$4.884` reservation and `$5.00` hard ceiling.
9. Historical artifacts remain immutable; a new pushed-head B0/Fresh Readiness is required, and only a valid candidate may proceed to Reconciliation, Blueprint/Wizard and one local LOW page render.

## Acceptance criteria

- Planner tests admit exact coherent action/coverage binding failures and reject every malformed, mixed, duplicate, stale and unlocatable variant.
- An end-to-end compiler test proves the three-issue page routes once through `page_contract_patch` and a valid complete-page patch returns a candidate.
- Invalid repair output remains fail-closed and consumes only the existing bounded repair call.
- Prompt/schema/model/budget/retry/fallback/downstream behavior outside this route remains unchanged.
- Focused tests, TypeScript, diff check, repository-gate accounting and independent Claude Code QA complete before new live authority.

## Rollback and boundaries

Rollback is the focused implementation commit; it restores terminal fallthrough without mutating any historical artifact. Production stays blocked. No full-book render, image/Vision, storage/database write, publication, promotion, activation or deployment is authorized. The only visual allowance remains one local Wizard-connected `gpt-image-2` LOW portrait page after a valid candidate and downstream local gates.
