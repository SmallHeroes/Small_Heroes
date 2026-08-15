# Decision Gate — R1D-PVB-D1A1B1 Page-Contract Targeted Application Hardening

## 1. Proposed change

Make the typed repair targets carried by `PageContractRepairAffectedPage` the sole local write authority when applying a provider-returned page contract. A complete page may still be accepted as transport input, but only explicitly targeted fields are copied into a clone of the original page. `final_structural_invariant_invalid` remains the only target that authorizes complete-page replacement, with local topology preservation unchanged.

## 2. Why now?

The bounded live attempt at immutable HEAD `8cc7ddca293b36c594ea3dce32690f9d334872c0` proved that the provider resolved all 13 typed targets in its second repair, while the current whole-page assignment introduced 15 unrelated validation failures. The repair route therefore has sufficient diagnostic precision but an over-broad application boundary. This blocks candidate persistence and every downstream Blueprint, Wizard, and LOW-render gate.

## 3. Scope

General compiler/runtime hardening for every Story Source. It is not specific to the lion story, a page, child, companion, or authored literal.

## 4. Architectural decisions

1. A typed repair target is the only write authority; response fields outside the target set are ignored locally.
2. `final_structural_invariant_invalid` is the sole complete-page target. It cannot coexist with field-scoped targets on the same page unless an existing explicitly approved combined structural route already supplies it.
3. Action-cardinality targets may copy only the target action or coverage `beatId`. For `action_coverage_cardinality_invalid`, the writable closure may additionally convert at most one existing same-page coverage record to the exact matching `action_requirement` binding; adding/removing coverage records or changing their evidence identity remains forbidden.
4. Page-spatial targets may copy only the exact spatial reference at the target action index and field role, and only from the target's permitted spatial authority.
5. `represented_elsewhere` targets retain their exact `coverageIndex` and may copy only `contractPointer` and `contractValue` from one permitted same-page pair.
6. `closed_catalog_capability_gap` targets may copy only the target coverage disposition, and only one exact permitted presentation pointer/value pair with the permitted presentation class.
7. Target identity, uniqueness, target existence, response shape, permitted-value membership, and non-mutation of the input remain fail-closed. Multiple same-code targets on one page stay distinct.
8. Prompt prose and JSON schema remain unchanged, but the newly explicit represented-elsewhere `coverageIndex` advances page-repair user-prompt authority to v12 and advances the canonical lifecycle/materialization bindings. Model, service tier, token/call/repair/cost budgets, timeout, retries, fallback, candidate semantics, and downstream behavior remain unchanged. Historical artifacts remain legacy-immutable. The next Fresh Readiness is bound to the new immutable Git HEAD and source digests; no historical authority is reused.
9. Validation must prove successful targeted edits and adversarial non-target drift for every admitted target family, plus the unchanged complete-page structural control. Independent Claude Code QA must falsify the exact base-to-head range before any new live attempt.

## 5. Expected files

- `lib/visual-contract-compiler/pageContractRepair.ts`
- lifecycle/materialization version bindings and focused tests
- `CURRENT.md`
- this Decision Gate and implementation evidence

No story source, prompt prose, schema, fixture authority, render code, model/runtime budget policy, credential path, or deployment configuration is in scope.

## 6. Expected behavior

If a provider returns a corrected target together with unrelated page rewrites, the compiler applies the correction to the original page and discards the unrelated drift. Malformed, stale, ambiguous, duplicate, or non-permitted target values still fail closed. Structural repair continues to replace the complete affected page while preserving local location/zone topology.

## 7. Validation plan

Run direct unit regressions for every target family, compound action/spatial repair, multi-target identity, input non-mutation, and structural replacement. Then run affected compiler/lifecycle tests, deterministic TypeScript, `git diff --check`, and one literal repository gate. The known ignored-fixture release HOLD remains separate. No provider or render call is part of implementation validation.

## 8. Cost impact

Implementation and QA cost `$0`. After independent technical PASS and a new Fresh Readiness, one separately bounded live authoring attempt may use the existing hard `$5.00` ceiling; no render is authorized until candidate, Reconciliation, Blueprint, and Wizard gates pass.

## 9. Rollback

Revert the focused implementation commit(s). Historical artifacts and the consumed attempt remain untouched, so rollback requires no artifact migration or rewrite.

## 10. Owner decision and review

Guy authorized automatic continuation and diagnosis for Attempt 2. This records that approval; it does not grant Production changes. Claude Code must try to falsify target completeness, non-target drift containment, target-value authority, structural compatibility, lifecycle binding, and the no-policy-change claim.

## 11. Do not do

Do not access credentials, call a provider, run Fresh Readiness, preflight, live authoring, render, storage/database actions, deploy, or touch Production during this implementation milestone. Do not change prompts, schemas, model, budgets, timeouts, retries, fallback, or story-specific content.
