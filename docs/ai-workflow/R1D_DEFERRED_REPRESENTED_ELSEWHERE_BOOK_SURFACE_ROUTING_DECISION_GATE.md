# R1D Deferred Represented-Elsewhere / BookSurface Routing Decision Gate

## 1. Proposed change

Allow the existing atomic BookSurface route to repair its independently closed
presentation and page-structural subset when the same complete validation
census also contains only closed `represented_elsewhere` pointer/value
diagnostics. BookSurface receives no authority over those residual coverage
records. Full validation runs again, and the residual is then eligible only for
the existing exact PageContract represented-elsewhere target and atomic
applier.

## 2. Why now?

The consumed eight-page live attempt produced a complete first census of eight
closed catalog gaps, eight page action-requirement structural issues, and one
`represented_elsewhere_pointer_out_of_scope`. The single represented issue set
`hasBlockingNonSurfaceFailure`, suppressed the otherwise closed BookSurface
route, and selected `full_draft`. That broad replacement increased the complete
unique issue count from 17 to 24, so the regression guard correctly stopped
before a third paid call. No Candidate exists.

The first production-backed harness run exposed a second independent defect:
the final coverage validator persists a flat book-level coverage index in a
page-item locator, while PageContract historically interpreted it as a
page-local draft index. The live page-5 index 43 and the synthetic page-2 flat
index 1 reproduce this mismatch. The repair builder must rebind the residual to
one unique current same-page record by re-evaluating the exact typed failure;
it must never trust or guess from the flat index.

## 3. Scope

General compiler routing change. It is not tied to Koko, one page, one child,
or one source. It applies only to the three already-typed represented-elsewhere
failure codes that the existing PageContract lane can target exactly.

## 4. Risk of hardcoding

Low if eligibility is defined by the closed diagnostic family and exact typed
locators. All other non-surface failures remain blocking. No story key, page
number, prose, provider response, or persisted live artifact is embedded.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`
- `lib/__tests__/page-contract-repair.spec.ts`
- lifecycle test only if receipt-level route/candidate proof is not already
  covered through the compiler integration
- `CURRENT.md` and implementation evidence after green validation

## 6. Expected behavior after change

A complete census containing an independently valid BookSurface subset plus
only closed represented-elsewhere residuals selects `book_surface_patch`.
BookSurface preserves all action-semantic coverage. Full revalidation exposes
the residual, which selects `page_contract_patch` with the exact affected
coverage index and permitted pointer/value authority. Because persisted
diagnostics carry a historical flat index, the builder ignores that value for
mutation and scans only the named page for records that currently reproduce
the exact closed failure code against the canonical pointer template. Exactly
one match is required; zero or multiple matches fail closed. Issue count must
not increase at either stage. A valid injected response sequence reaches a
Candidate; malformed, stale, ambiguous, or mixed residuals remain fail-closed.

## 7. Validation plan

First prove at `$0` in the production-backed offline harness and compiler loop:

1. reproduce the exact mixed family (presentation + page action structure +
   represented-elsewhere) and prove first repair is BookSurface, never
   `full_draft`;
2. prove BookSurface does not alter the represented coverage record;
3. prove the residual selects exact PageContract authority and a valid response
   reaches Candidate with non-increasing complete unique counts;
4. prove a flat book index maps to the unique page-local record, distinct codes
   map independently, and same-code ambiguity or stale state returns null;
5. prove all three represented-elsewhere codes are eligible, while any other
   action-semantic/source/world/cast/cover-source failure still blocks;
6. prove malformed/extra/overreaching PageContract output remains atomic and
   terminal;
7. run focused tests, TypeScript, diff-check, one literal repository gate, and
   independent Claude Code adversarial review before any new Fresh/live call.

## 8. Cost impact

Implementation and tests cost `$0` in product/provider spend. No call cap,
output cap, model, retry, fallback, or hard USD fence changes. At most one new
canonical live authoring attempt may occur after independent PASS and a new
Fresh Readiness. The consumed root is never reused.

## 9. Rollback plan

Revert the focused routing commit. Existing full-draft fallback and all current
artifact versions remain intact because the proposal changes no persisted
shape, prompt, schema, or policy.

## 10. Review assignment

Guy authorized diagnosis, implementation, push, one carefully gated live
attempt, and render only after real Candidate/Wizard authority. Claude Code
must first falsify route eligibility and then independently re-gate the exact
implementation range, especially coverage preservation, complete-census
monotonicity, residual authority, mixed-family rejection, and absence of
policy/version drift.

## 11. Do not do

- Do not rerun or reuse the consumed live root.
- Do not reconstruct or claim access to unpersisted provider response bodies.
- Do not let BookSurface edit represented-elsewhere coverage.
- Do not broaden eligibility to unrelated action-semantic or source failures.
- Do not change model, budgets, call counts, retries, fallback, or USD ceiling.
- Do not run Fresh/live/provider/render before offline proof and independent
  Claude PASS.
- Do not mint Candidate, reconcile Wizard, or render without genuine current
  authority.
