# R1D-PVB-D1A1B1-PRESENTATION-CAPABILITY-GAP-COMPACT-REPAIR-ROUTING — Decision Gate

**Status:** APPROVED by Guy; implemented for independent technical QA

**Base:** `9ac7ef4293cc724dbda72afc21c0fe2481cd494a`

**Goal:** convert only a safe, homogeneous closed Action Semantic capability-gap set into compiler-bound `presentation_requirement` coverage without expanding the Action Semantic Catalog or weakening complete validation.

## Observed behavior and root cause

The consumed live attempt completed provider work and reached three `closed_action_catalog_gap` results whose beats were visually representable by exact same-page `mustShow` authority. The compiler already supported typed `presentation_requirement` coverage, but the repair router treated every `ActionSemanticCapabilityGapError` as terminal. Therefore no bounded route could select the existing typed presentation lane and no candidate could persist.

## Nine approved architectural decisions

1. Do not expand the Action Semantic Catalog and do not add story-specific literals.
2. Admit repair only when the complete terminal set is a homogeneous closed Action Semantic capability-gap set.
3. Require an exact page, coverage index, beat identity, Source Evidence identity and currently unsupported disposition for every target.
4. Derive a finite same-page authority set only from non-empty compiler-owned `mustShow` entries and the closed presentation-class catalog.
5. Let the model select only `{presentationClass, contractPointer}`; the compiler supplies the exact current `contractValue`.
6. Apply patches only to the selected coverage dispositions, clone before mutation, and canonically prove that every non-target field is unchanged.
7. Keep mixed, malformed, unsafe, stale, out-of-domain and genuine action gaps terminal; rerun complete compilation and validation after repair.
8. Keep model, service tier, reasoning, 64K input ceiling, output/call/repair budgets, timeout, zero transport retries, no fallback and `$4.884/$5.00` ceilings unchanged. Cut over all request/B0/Supervisor/readiness authority versions fail-closed.
9. After technical PASS and Fresh Readiness, run one bounded authoring attempt; only a persisted candidate may proceed through Semantic Reconciliation, Blueprint/Wizard qualification, render pricing and one local `gpt-image-2` LOW portrait-page measurement.

## Acceptance criteria

- Strict Responses-compatible patch schema contains no provider-authored value or prose field.
- Complete-set, exact-key, duplicate, stale, pointer-domain and non-target-drift guards fail closed.
- Adapter, canonical live boundary, B0 materialization/verifier, Execution Supervisor and Fresh Readiness bind the new schema and prompt authority.
- Focused compiler/lifecycle/boundary tests and deterministic TypeScript pass.
- Literal repository check contains no failure beyond the six established ignored-output fixtures; those remain a separate release HOLD.
- No credential, provider, live, render, storage/database, publication or deployment action occurs during implementation.

## Rollback

Revert the implementation commit and retain the immediately preceding authority versions as historical evidence only. No artifact is rewritten and no failed or legacy artifact becomes authority for a new attempt.
