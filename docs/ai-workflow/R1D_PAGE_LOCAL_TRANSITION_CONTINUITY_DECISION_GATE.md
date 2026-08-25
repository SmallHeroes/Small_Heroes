# R1D Page-Local Transition Continuity Routing — Decision Gate

**Authorized by:** Guy's explicit autonomous Wizard-completion authority
**Decision recorded:** 2026-08-25
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Base:** `e25ae0c0451856791c6f0f60b5c1919a2c9e8212`

## 1. Proposed change

Preserve every existing transition-continuity validation rule, but report each
cross-page continuity failure against the affected page as the existing typed
diagnostic `draft_contract/final_structural_invariant_invalid` with cause
`page_transition_invalid`, instead of repeating the collection-level
`draft_contract/topology_malformed` identity for the whole
`page_contracts/transition` surface.

This lets the existing BookSurface authority select only the affected page's
`transition` field. After full revalidation, the already-approved pure
`represented_elsewhere_patch` lane may close any remaining pointer failures.
No repair-lane admission predicate is widened.

## 2. Why now?

The one consumed paid attempt under
`outputs/r1d-chameleon-v3-fresh-readiness-20260825T184449411Z` followed
`initial 19 -> book_surface_patch 6 -> full_draft 16` and stopped correctly as
`draft_validation_repair_regressed`. The six-issue frontier contained five
`represented_elsewhere_pointer_unresolved` issues and one cross-page
transition-continuity issue.

Base validation masks vNext continuity while page action requirements are
invalid. Once the first BookSurface repair closes those base errors, the
continuity failure is unmasked. The BookSurface patch did not create it: its
only structural page-field authority was `actionRequirements`; separate
presentation authority could not touch `transition`, and the non-target
preservation guard kept that field unchanged.

The continuity error is currently reported as a collection-level topology
identity even though the validator knows the exact current page and the only
required writable surface is that page's `transition`. The coarse locator
prevents BookSurface, PageContract and the pure represented lane from acquiring
authority, so the scheduler falls back to whole-draft regeneration. That broad
repair increased the complete unique issue census from 6 to 16. The regression
guard then correctly prevented a fourth dispatch and Candidate creation.

## 3. Scope

General validation-diagnostic and existing-route correction. It applies to
every story, page count, world and transition kind. It is not specific to
Chameleon, Bar, Kim, one page number, one provider response or one persisted
artifact.

No validation rule, prompt, schema, repair mode, model, call budget, output
budget, retry, fallback, cost ceiling, Candidate rule, Wizard rule or render
rule changes.

## 4. Risk of hardcoding

Low if the diagnostic is derived directly inside the cross-page state machine
from the page currently being validated. No story key, child, companion,
literal page number, prose, persisted issue count or provider material may be
embedded in production code.

The key safety boundary is that `represented_elsewhere_patch` remains pure and
unchanged. A cross-page continuity failure must first become an independently
closed BookSurface page target, whose only writable field is `transition`.

## 5. Files likely affected

- `lib/visual-contract-compiler/validateVNextVisualContract.ts`
- `lib/__tests__/visual-contract-vnext-ws0.spec.ts`
- `lib/__tests__/visual-contract-s2b.spec.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`
- focused adjacent compiler/repair tests only if production-path proof exposes
  an actual gap
- `CURRENT.md`
- this Decision Gate and its implementation-evidence document

No Story Source, Visual Package, Board, Wizard UI, renderer, payment, database,
storage, locator, deployment or generated output is in implementation scope.

## 6. Expected behavior after change

- Every cross-page continuity error keeps the same human-readable validation
  message and fail-closed rule.
- Each error carries the affected page locator and
  `page_transition_invalid` cause.
- A complete frontier containing that page-local transition error plus deferred
  represented-elsewhere issues first selects `book_surface_patch`.
- BookSurface may change only the exact affected page's `transition`; location,
  zone, action coverage and all non-target bytes remain unchanged.
- Full revalidation leaves the pure represented frontier, which selects
  `represented_elsewhere_patch` and may reach Candidate.
- Missing, ambiguous or non-writable authority, unlike mixed families,
  regression and exact-state stagnation remain fail-closed.

## 7. Validation plan

All implementation validation is provider-free and costs `$0`:

1. Add validator cases for every cross-page continuity branch: invalid opening
   departure, undeclared steady/before-transition move, unestablished origin,
   discontinuous origin, and valid threshold/after-transition continuation.
   Assert page-local typed diagnostic identity and unchanged error text.
2. Prove the real validator-generated masking/unmasking route in the production
   compiler harness:
   `19 -> 6 -> 5 -> 0` via
   `initial -> book_surface_patch -> book_surface_patch -> represented_elsewhere_patch`,
   with Candidate outcome and no `full_draft`.
3. Prove the second BookSurface response is transition-only and preserves every
   non-target byte, including action-semantic coverage.
4. Keep represented plus `world_type_missing`, source-evidence, coverage-gap,
   page-spatial and unrelated structural counterexamples ineligible for the
   pure represented lane.
5. Keep missing/ambiguous/stale pointer authority fail-closed.
6. Preserve exact complete-census regression and stagnation guards, including
   the historical `6 -> 16` stop.
7. Prove schema/input ceilings, seven standard calls, terminal call eight,
   retries, fallback, model and cost policy are byte-unchanged.
8. Run focused production-path tests, `npx --no-install tsc --noEmit`,
   `git diff --check` and `npm run check` against the recorded baseline.
9. Commit locally and obtain independent Claude Code adversarial PASS before
   any new Fresh Readiness, provider call or render.

## 8. Cost impact

Implementation and validation cost `$0`. No credential or provider is used.
No call or budget is added. A later live attempt requires a new pushed-head
Fresh Readiness and remains bounded by the existing policy and stop rules.

## 9. Rollback plan

Revert the focused implementation commit. Historical receipts/readiness remain
immutable evidence. No migration or artifact rewrite is required because the
change affects newly computed diagnostics only.

## 10. Review assignment

Guy has already authorized autonomous technical work required to make the
approved new-story Wizard path operational, including one later bounded paid
attempt and full-book render only after genuine current authority exists. There
is no unresolved product, story or visual decision in this offline correction.

Claude Code must try to falsify page attribution, transition-only write
authority, non-target preservation, masking/unmasking realism, mixed-family
counterexamples, regression/stagnation guards, unchanged policy/version
surfaces, and the absence of story-specific literals. Claude Cowork review is
not needed because this is not a product or creative change.

## 11. Do not do

- Do not rerun or reuse the consumed live root.
- Do not weaken or bypass the complete-census regression guard.
- Do not widen `represented_elsewhere_patch` to mixed populations.
- Do not add a new route, schema, prompt, call, retry, fallback or budget.
- Do not change transition validation semantics or allow zone/location edits.
- Do not reconstruct or claim access to unpersisted provider response bodies.
- Do not use story, child, companion, page-number or receipt-count literals in
  production code.
- Do not run Fresh/live/provider/render before offline proof, focused commit,
  independent Claude PASS and a new pushed-head readiness root.
