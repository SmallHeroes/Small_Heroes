# R1D-PVB-D1A1B1 Action-Coverage Cardinality Page-Repair Routing - Decision Gate

## Decision

Route the closed typed `action_coverage_cardinality_invalid` authority issue into the existing complete-page `page_contract_patch` repair lane. The route is permitted only for a homogeneous set of exact positive page/action locators. It changes no provider output schema, model, service tier, token/call/repair budget, timeout, retries, fallback, candidate policy, or cost ceiling.

## Observed behavior and root cause

The first post-stream-mapper live attempt completed one provider response and proved both streaming and terminal-output normalization. Local compilation then emitted exactly one typed issue: page 2, action index 3, `action_coverage_cardinality_invalid`. The action existed, but its beat did not bind exactly one same-page `actionSemanticCoverage` record with `disposition.kind: action_requirement`.

The compiler already has a bounded complete-page repair lane for page-local structural and Action Semantic problems. However, its `DraftAuthorityReferenceDomainError` catch admits only stable-prop and page-spatial families. This cardinality issue therefore falls through to a terminal non-repairable classification before the existing page repair can run.

## General solution

- Recognize only `action_coverage_cardinality_invalid` with exact `page_action / action_coverage / actionRequirements.actionSemanticCoverage` locator identity.
- Build a content-bounded repair plan containing the complete affected page, the typed target with page/action indices, and a closed deterministic validator hint.
- Require every issue in the set to belong to that one family; mixed, malformed, stale, absent-page, absent-action, duplicate, or unlocatable input stays terminal.
- Send the plan through the existing strict `PageContractRepairPatches` schema and exact affected-page apply path.
- Rerun complete compilation and every validator before candidate persistence.

## Nine architectural decisions

1. Reuse `page_contract_patch`; do not create another repair framework or output schema.
2. Eligibility is closed to the one typed issue identity and exact structural locator shape.
3. Repair authority is derived only from compiler-owned page/action indices; no prose parsing, authored-ID inference, fuzzy matching, or story literal controls routing.
4. The provider receives the already-approved complete affected-page authority, one typed target, and one deterministic invariant hint.
5. The repair may align the action and its coverage within the affected page; exact page-set application and full post-repair validation remain mandatory.
6. Mixed or malformed issue sets, missing pages/actions, duplicate targets, output-shape drift, extra/missing pages, or failed revalidation fail closed.
7. Cut page-contract repair prompt/user-prompt authority to v7; the strict output schema remains v1 because its shape is unchanged.
8. Preserve one initial call plus at most two repairs, zero transport retries, no fallback, the 64K/36K ceilings, twenty-minute timeout, `$4.884` reservation, and `$5.00` hard ceiling.
9. After focused tests, repository-gate accounting, independent Claude Code QA, push, and new Fresh Readiness, run one new bounded authoring attempt; only a valid candidate may proceed to Reconciliation, Blueprint/Wizard, and one LOW render.

## Acceptance criteria

- Direct plan tests admit exact homogeneous locators and reject mixed, malformed, duplicate, stale, missing-page, and missing-action variants.
- Prompt roundtrip contains only the complete affected page, typed locator, closed hint, and existing permitted-pointer field.
- End-to-end compiler test proves one invalid initial page routes to `page_contract_patch`, one valid repaired page returns a candidate, and non-target pages remain unchanged.
- Exhaustion, malformed repair output, budget, retry/fallback, schema and downstream behavior remain unchanged.
- TypeScript, focused tests, `git diff --check`, repository-gate accounting, and independent QA pass before new authority is materialized.

## Rollback

Revert the focused routing, prompt-authority, tests, and evidence commits. Historical artifacts and the consumed live attempt remain immutable. No storage, database, or production migration exists.

## Boundaries

Production remains blocked. This gate authorizes no full-book render, storage/database write, publication, promotion, activation, or deployment. The only downstream visual allowance remains one local Wizard-connected `gpt-image-2` LOW portrait-page measurement after a valid candidate and required local gates.
