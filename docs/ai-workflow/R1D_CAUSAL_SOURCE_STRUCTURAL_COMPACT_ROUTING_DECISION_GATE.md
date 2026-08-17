# R1D Causal Source-Evidence + Pure Structural Compact Routing — Decision Gate

**Date:** 2026-08-17
**Owner decision:** approved under Guy's standing instruction to continue autonomously toward the first QA Wizard render, while preserving every canonical and independent-QA gate
**Base:** `a8e2f59c6e02fda5e7e60fee6b8e18e8ae0991be`
**Branch:** `codex/r1d-causal-source-structural-compact-routing`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Close two general repair-routing gaps exposed by the single consumed live attempt on the exact base:

1. Route a malformed/unknown/wrong-page Source Evidence identity through the existing `source_evidence_id_patch` when every co-reported action-semantic issue is the exact same-beat `source_phenomenon_binding_mismatch` caused by that unresolved identity. The existing compact applier already updates both the coverage record and its bound `source_phenomenon` subject.
2. Route the existing closed book-surface family through `book_surface_patch` even when no closed-catalog presentation target is present. Eligibility remains exact: at least one permitted cover failure, at least one page final-structure failure, optional exact recurring-props lifecycle failure, and no unrelated diagnostic.

## 2. Why now?

Fresh Readiness `322124500400b492901381cce02eaeb050d025332af801ee57223bfd83e35ac1` and Execution Request `b59f5caf8bd660cbcd8778c8d55b92c526f67316b94e48b83e6b5cada1494d7e` authorized one live attempt. Receipt `8fb94c557c1d63c6e7169e65cd0433722f42c104ea4540dc35eaa672e0901a0e` records three completed provider calls, two repairs, zero retries, no fallback, `$2.700506` nominal / `$2.999715` conservative cost, and no candidate.

The initial response had only two typed issues on page 12: `source_evidence_id_malformed` plus its exact bound-action consequence `source_phenomenon_binding_mismatch`. The router selected `full_draft`. The next attempt resolved both and exposed the closed structural surface: `cover_projection_invalid`, all twelve `final_structural_invariant_invalid` page identities, and exact recurring-props `lifecycle_invariant_invalid`. Because `book_surface_patch` was artificially coupled to presentation gaps, the router selected `full_draft` again. The last call resolved only lifecycle and left the cover plus twelve pages, exhausting the standard budget.

This is a routing/authority defect, not provider transport failure: all three responses completed, Supervisor v19 exited fail-closed with child exit 1 and null output authority, and no candidate or downstream authority leaked.

## 3. Scope

General compiler/lifecycle repair routing only. No story-, page-, child-, companion-, or Dini-specific literal is permitted.

Likely files:

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- `lib/__tests__/book-surface-repair.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- status/evidence documentation

## 4. Risk of hardcoding

The implementation must derive causality from typed page/beat/action/coverage coordinates and the canonical Source Evidence catalog. It must never match prose, story key, page 12, a particular companion, or the observed IDs. Pure structural eligibility must be defined only by the existing closed typed issue family.

## 5. Architectural decisions

1. The consumed attempt is immutable and will never be retried.
2. A Source Evidence patch is eligible only when every semantic co-failure maps one-to-one to an affected same-page/same-beat `source_phenomenon` action. Any unrelated, ambiguous, duplicate, partial, or non-action semantic issue remains fail-closed on the existing route.
3. The compact Source Evidence patch shape, prompt, schema and applier remain unchanged; full validation runs again after application.
4. Pure book-surface repair reuses the existing v3 authority/prompt/schema/output and exact local applier. It does not create a second implementation.
5. Pure structural eligibility requires cover plus page failure, admits only the exact optional recurring-props lifecycle identity, and rejects every mixed family or unsafe validation hint.
6. Presentation-plus-structural behavior remains byte/semantics compatible. Empty presentation targets are permitted only for the newly proven pure structural family.
7. Model, tier, reasoning, timeout, `3 / 2 / 0`, `[40000, 32000, 36000]`, optional reference-only cleanup, no-fallback policy and `$5` fence remain unchanged.
8. No current persisted envelope, prompt, repair output schema or authority shape changes; historical artifacts remain readable and immutable. A later live attempt still requires a new pushed HEAD and brand-new Fresh Readiness.
9. Independent Claude Code QA must PASS the exact immutable implementation range before push/Fresh/live. Any new live failure stops without retry.

## 6. Expected behavior after change

For the proven shape, the bounded sequence is:

`initial invalid draft -> source_evidence_id_patch -> book_surface_patch -> candidate`

This consumes exactly three logical calls and two repairs. Non-causal source/action mixtures and non-closed structural mixtures retain their existing conservative route, normally `full_draft` or terminal fail-closed behavior.

## 7. Validation plan

- Direct causal-positive regression for malformed coverage identity plus exact same-beat `source_phenomenon_binding_mismatch`.
- Direct negatives for different beat/page, ambiguous/duplicate binding, independent semantic issue, and unrelated source-evidence records.
- Book-surface unit positive with zero presentation targets and exact cover/pages/optional recurring-props lifecycle.
- Book-surface negatives for cover-only, page-only, unrelated collection/code/locator, unsafe hints, and authority ambiguity.
- End-to-end lifecycle regression proving exact route sequence, three calls/two repairs, unchanged caps, full revalidation, candidate persistence, no input mutation, and no fourth call.
- Negative lifecycle regression proving a mixed semantic/structural family cannot hijack either compact route.
- Focused tests, deterministic `npx --no-install tsc --noEmit`, `git diff --check`, and one literal `npm run check` only after focused green.
- Independent Claude Code read-only adversarial review and correction re-gate if needed.

No image or render is part of this implementation validation.

## 8. Cost impact

Implementation and tests cost `$0`. No credential, provider, image, Vision or render call is authorized during implementation/QA. After push and brand-new Fresh Readiness, at most one newly authorized live authoring attempt may run under its frozen `$5` ceiling. Failure stops without retry.

## 9. Rollback

Revert the focused implementation and documentation commits. No data migration, artifact rewrite, database/storage change, mutable production state, or cleanup of historical output roots is required.

## 10. Review assignment

Claude Code must try to falsify causal one-to-one eligibility, same-page/same-beat binding, compact-applier completeness, empty-presentation structural eligibility, rejection of mixed families, prompt/schema/version invariants, full revalidation, exact call count, diagnostic truthfulness, historical readability and the recorded repository-gate result.

Guy retains product/visual acceptance. Claude Cowork review is unnecessary because this is a typed technical routing correction, not a creative or UX decision.

## 11. Do not do

- Do not rerun the consumed attempt.
- Do not add retries, fallback, a fourth general repair, a higher budget, a new provider/model, prose parsing, story-specific logic or weakened validators.
- Do not touch credentials during implementation/QA.
- Do not run Fresh Readiness, live authoring, Blueprint, Wizard, image, Vision, render, storage/database, deployment or production before the independent technical gate closes.
- Do not rewrite or delete historical artifacts.
