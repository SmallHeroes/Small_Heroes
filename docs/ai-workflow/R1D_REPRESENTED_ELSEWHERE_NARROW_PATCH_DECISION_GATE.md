# R1D Represented-Elsewhere Narrow Patch — Decision Gate

**Approved by:** Guy
**Approved:** 2026-08-25
**Branch:** `codex/r1d-represented-elsewhere-narrow-patch`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Base:** `06280b5a3f971996280e6d59a686eca4f890cd8a`

## 1. Proposed change

Add one distinct `represented_elsewhere_patch` repair lane for a complete
diagnostic population made exclusively of:

- `represented_elsewhere_pointer_out_of_scope`;
- `represented_elsewhere_pointer_unresolved`; and
- `represented_elsewhere_value_mismatch`.

The provider selects only a page-level zero-based `pointerChoiceIndex` for an
exact target identity. The compiler owns the finite permitted pointer/value
domain, maps complete-census global indexes to page-local coverage indexes,
requires an order-independent exact target set, applies the selected canonical
pointer/value pairs atomically and emits only sanitized closed diagnostics.

Cut the new schema, prompt and repair mode through current request, receipt,
readiness, B0, execution, Fresh and QA Wizard authority. Keep immediate
predecessors readable as immutable legacy authority.

## 2. Why now?

The bounded paid attempt under
`outputs/r1d-chameleon-v3-live-20260824T214715731Z` converged from 17 complete
issues to nine and then six. The six remaining issues were all represented-
elsewhere references. The scheduler nevertheless used the broad
`page_contract_patch`, which asked for six complete page-contract echoes to
change six compiler-owned pointer selections. Its response failed target
association as `page_contract_repair_represented_elsewhere_target_invalid`.

Another paid retry would repeat an unnecessarily broad contract. A narrow,
offline-proven lane removes that mismatch without increasing budget, calls or
fallback behavior.

## 3. Scope

General compiler, scheduler and authority-lifecycle change. It is not specific
to Chameleon, Bar, Kim, a story, a child, a companion, a page number or one
record count.

## 4. Risk of hardcoding

Production admission is defined by closed typed diagnostic identities and a
complete-population predicate. Target authority is derived from each draft
page at runtime. The historical `17 -> 9 -> 6 -> 0` counts and pages exist only
in regression fixtures and documentation.

## 5. Files likely affected

- compiler mode, scheduler, policy and diagnostic modules under
  `lib/visual-contract-compiler/`;
- a new `representedElsewhereRepair.ts` module;
- authoring request/receipt/readiness and terminal diagnostics under
  `lib/visual-package/`;
- canonical materialization, execution, Fresh and QA Wizard bindings;
- focused compiler, lifecycle, compatibility, census and offline-harness
  tests;
- `CURRENT.md` and this milestone's evidence document.

No Story Source, Visual Package, Board, locator, renderer, payment, database or
deployment file is in scope.

## 6. Expected behavior after change

- Independent BookSurface and page-spatial work remains earlier in the route.
- A pure complete represented-elsewhere residual selects the new narrow lane,
  never PageContract or full-draft.
- Provider output cannot author raw JSON pointers or values.
- Every expected target appears exactly once; response order is irrelevant.
- Missing, extra, duplicate, forged, cross-page and invalid ordinal patches are
  rejected before mutation.
- A rejected application preserves the entire source draft byte-for-byte.
- Persisted diagnostics expose only bounded identities and indexes.
- Mixed residual populations do not gain terminal call eight. The existing
  pure terminal-reference cleanup remains unchanged.

## 7. Validation plan

All validation is provider-free:

1. Prove the production-shaped complete/surfaced census
   `17 -> 9 -> 6 -> 0` through
   `initial -> book_surface_patch -> page_spatial_reference_patch -> represented_elsewhere_patch`,
   Candidate outcome and `providerCalls: 0`.
2. Prove exact-set, order independence, global-to-local index rebinding,
   deterministic pointer domains and atomic non-target preservation.
3. Reject missing, extra, duplicate, forged, cross-page, negative,
   fractional, string and out-of-range choices without raw-data leakage.
4. Prove route admission is complete-population-only and bounded to standard
   attempts 2 through 7.
5. Prove mixed spatial-plus-represented exhaustion stops at seven while pure
   spatial terminal cleanup still receives the one existing eighth call.
6. Prove oversized input refuses dispatch and persists valid receipt/readiness
   authority.
7. Prove schema compatibility, exact prompt/schema digests, current/legacy
   version replay and every canonical equality junction through QA Wizard.
8. Run focused suites, `npx --no-install tsc --noEmit`, `git diff --check` and
   repository-wide `npm run check` against the documented baseline.

## 8. Cost impact

`$0` for this milestone. No credential, provider, network, live authoring,
Candidate persistence, Wizard order, image, audio, Vision, render or deployment
operation is authorized.

The runtime allocation is unchanged: no model, input ceiling, output pool,
standard call count, repair count, retry, fallback or cost-ceiling increase.

## 9. Rollback plan

Revert the focused milestone commit. No external state or current artifact is
migrated by this offline implementation. Legacy readers remain available, so
rollback does not require rewriting historical receipts.

## 10. Review assignment

Guy decided the product intent and authorized this bounded offline correction.
Claude Code must receive the immutable base-to-head range read-only and try to
falsify:

- pure-population route selection and absence of PageContract/full-draft
  widening;
- exact-set association and page-local index binding;
- compiler ownership of pointer/value authority;
- atomicity and diagnostic sanitization;
- input-ceiling refusal, stagnation/regression and call-eight boundaries;
- current-versus-legacy version cutover at every downstream equality junction;
- unchanged model, policy, budget, retry, fallback, Candidate, Wizard and
  render behavior.

No Claude Cowork product/creative review is required for this technical repair.

## 11. Rejected alternatives

- Another paid attempt against the same PageContract contract: rejected as an
  unproven repeat of the failure.
- Expanding or strengthening PageContract: rejected because the required edit
  is narrower than a page echo.
- Full-draft rewrite or best-of-N sampling: rejected because the residual is a
  closed deterministic pointer-selection problem.
- Provider-authored raw pointer/value pairs: rejected because authority already
  exists in the compiler.
- Increasing budget, calls or model: rejected because capacity was not the
  failure identity.

## 12. Do not do

- Do not run provider, Fresh, live, Candidate, Wizard, image, audio or render.
- Do not change model, budgets, standard calls, retries, fallback or cost cap.
- Do not patch Chameleon, Bar, Kim or any fixed page in production code.
- Do not weaken complete-census, regression, stagnation, route-admission,
  schema or immutable-artifact checks.
- Do not push or deploy by implication of this Decision Gate.
