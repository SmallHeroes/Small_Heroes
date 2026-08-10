# R1D-PVB-D1A1B1-STABLE-PROP-SCOPE-COMPACT-REPAIR — Decision Gate

**Owner decision:** approved by Guy's standing instruction to continue through the first Wizard-connected LOW page without intermediate approval stops.

**Base:** `72d25784454de9da61f081bbf42546f3a121e7cc`

## 1. Proposed change

Add one closed, typed compact-repair lane for draft Set Board `stablePropId` bindings rejected only as `recurring_prop_lifecycle_gated` or `recurring_prop_consumer_forbidden`. The provider receives sanitized structural locators and must return an exact patch set whose sole value change is `stablePropId: null`. The compiler then reruns the complete draft authority, action-semantic, final Visual Contract and downstream feasibility validation.

## 2. Why now?

The bounded post-input-compaction live attempt completed one provider response but produced no candidate. Receipt v20 `5cdc1a66146143052c83be4fb06094fc45067f3f4c61b0fcb123d59c6918c625` contains exactly two `recurring_prop_lifecycle_gated` issues at sanitized Set Board node locators. Both are currently terminal because all `DraftAuthorityReferenceDomainError` families except page-spatial selection are repair-ineligible. The compiler already knows the safe representation boundary: a reveal-gated or consumer-forbidden recurring prop must not be a stable Set Board consumer and remains eligible only in page-frame constraints.

## 3. Scope and root cause

This is a general authoring-lifecycle change, not a Fox/story/page patch. The provider-facing schema permits any string in `stablePropId`; the compiler correctly validates dynamic lifecycle authority afterward, but the repair router has no typed lane for this closed and mechanically reversible failure family. Prompt prose alone cannot enforce story-dependent eligibility.

## 4. Risk of hardcoding

No authored prop ID, story key, page number, phrase, companion or location literal is accepted by the repair contract. Eligibility is all-or-nothing over closed issue codes and exact structural locators. Mixed failures remain terminal.

## 5. Likely files

- compiler repair contract, parser, target derivation and non-target-drift guard;
- compiler repair routing and prompt-authority unions;
- authoring request/receipt/readiness plus B0/materialization/Supervisor authority bindings;
- Structured Outputs compatibility evidence and lifecycle fixtures;
- focused compiler, adapter, materialization, Supervisor and readiness tests;
- `CURRENT.md` and implementation evidence.

## 6. Expected behavior

An initial or repair draft containing only lifecycle-gated/consumer-forbidden Set Board stable bindings becomes eligible for one compact repair call. Every distinct locator is patched exactly once to `null`; duplicates normalize deterministically. Missing, extra, stale, reordered-identity, non-null or malformed patches fail closed. All other authority-reference issues preserve their current terminal behavior. Page-frame prop constraints and every non-target field remain unchanged.

## 7. Validation

Direct unit tests cover both eligible codes, duplicate-code normalization at one locator, mixed/ineligible rejection, exact patch parsing, stale/duplicate/missing/extra/tampered patches, canonical non-target equality, one successful repair-to-candidate lifecycle, persisted receipt/readiness roundtrip, Structured Outputs compatibility and every B0/Execution/Supervisor binding. Run focused ordinary/resource phases, TypeScript, `git diff --check`, and one literal `npm run check`; only the six established ignored-output fixture failures may remain.

## 8. Cost

Implementation costs `$0`. A future live attempt keeps the existing initial-plus-two-repairs maximum, three provider-call ceiling, zero transport retries, no fallback, `$4.884` conservative ceiling and `$5.00` hard ceiling. This change creates no additional call authority.

## 9. Rollback

Revert the implementation commits. Historical receipt/readiness/materialization artifacts remain immutable and unsupported as authority for a new attempt. No existing live artifact is rewritten.

## Nine architectural decisions

1. **Closed eligibility:** only `recurring_prop_lifecycle_gated` and `recurring_prop_consumer_forbidden` at `set_area_node / spatialNodes.stablePropId / recurring_prop` are eligible; mixed issue sets remain terminal.
2. **One target per locator:** issue codes at the same exact locator normalize into one sorted target with a sorted unique reason-code set.
3. **Null-only result:** the repair schema requires `stablePropId: null`; it cannot select, rename or invent an ID.
4. **Structural identity:** authority, area and node indices are the complete patch identity; raw authored IDs and values never cross the repair prompt boundary.
5. **Exact set:** every target is returned exactly once, with no missing, duplicate or unexpected patch.
6. **Non-target preservation:** canonical masking proves that only the selected `stablePropId` fields changed; the caller input is never mutated.
7. **Full revalidation:** a patch grants no candidate authority until the ordinary compiler and all final validators pass again.
8. **Existing budgets:** model, schema authority outside this new repair schema, token/call/cost ceilings, timeout, retry and fallback policy remain unchanged.
9. **Versioned cutover:** new request/receipt/readiness/materialization/Execution/Fresh Readiness authority versions fail closed; old artifacts remain immutable historical evidence.

## Rejected alternatives

- Stronger prompt prose alone: cannot enforce dynamic lifecycle authority.
- Silently nulling the field locally: hides a provider error and violates observable repair accounting.
- Disabling all stable recurring-prop authoring: removes a valid general capability.
- Fuzzy ID matching or story-specific allow/deny lists: violates compiler-owned authority.
- Enlarging context, repair count or cost: unnecessary and explicitly excluded.

## Acceptance and review

Claude Code must try to falsify closed eligibility, locator deduplication, null-only/exact-set behavior, non-target preservation, persisted authority/version bindings, unchanged budgets and the absence of story literals. Guy's later product acceptance is limited to the eventual single local LOW render; production remains blocked.

## Do not do

No credential access, provider/network call, live authoring, B0/Fresh Readiness, image/Vision/render, storage/database, Board, publication, promotion, activation or deployment during implementation. Do not rewrite historical artifacts or relax the six-fixture release HOLD.
