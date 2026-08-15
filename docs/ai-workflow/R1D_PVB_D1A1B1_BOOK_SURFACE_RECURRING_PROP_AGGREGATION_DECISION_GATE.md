# R1D-PVB-D1A1B1 Book-Surface Recurring-Prop Aggregation — Decision Gate

**Status:** approved by Guy through the standing Attempt-2 continuation authority; implementation started 2026-08-16
**Base:** `95fe597587ad81da43d1aeee8699824fb02da909`
**Branch:** `codex/r1d-book-surface-recurring-prop-aggregation`
**Worktree:** `C:\Users\guyna\.codex\worktrees\booksurface2\Small_Heroes`

## Observed failure and root cause

The consumed live attempt first used the compact page-spatial repair and
resolved all eleven reference issues. The resulting draft then exposed a
closed mixed surface: presentation targets, cover final structure, page final
structure, and one recurring-prop lifecycle invariant. The current
`book_surface_patch` can repair the first three surfaces but rejects the
recurring-prop lifecycle identity. That makes its authority null and routes the
remaining standard repair to `full_draft`. The full draft call reached the
provider and then ended in a sanitized response-parse failure. The attempt is
exhausted and remains immutable.

The expected behavior is to keep the already-valid draft and use one bounded
compact repair for the complete closed surface. The provider must receive and
return only the cover, the exact recurring-prop collection, and the exact
affected pages.

## Nine architectural decisions

1. **One compact surface authority.** `book_surface_patch` v2 owns the closed
   union of cover, recurring props, affected page contracts, and presentation
   targets. It never receives or returns the full draft.
2. **Closed eligibility.** The only newly admitted structural identity is
   `draft_contract/lifecycle_invariant_invalid` at locator
   `collection:recurring_props/lifecycle`. Any other collection, code, locator,
   malformed diagnostic, missing cover, missing affected page, or missing
   presentation target remains ineligible and fail-closed.
3. **Exact recurring-prop identity.** The patch must return the same non-empty,
   unique recurring-prop ID set exactly once. Order is restored from the input
   authority. Missing, duplicated, unexpected, or renamed IDs are rejected.
4. **Strict response v2.** The response has exactly three root keys:
   `coverContract`, `recurringProps`, and `pageContracts`, with the current
   member schemas and no additional keys. Schema, system prompt, and user
   prompt advance together to v2.
5. **Bounded application.** Application is non-mutating. Only the complete
   cover, exact recurring-prop collection, and authorized pages may change.
   A canonical masked comparison rejects drift anywhere else; existing page
   target and reference guards remain active.
6. **Unchanged final validation.** The normal compiler, action-semantic,
   presentation, structural, lifecycle, source-evidence, and reference-domain
   validators all run after application. This patch does not waive or reinterpret
   any invariant and does not guarantee a candidate by itself.
7. **Explicit lifecycle cutover.** Newly materialized authorities advance the
   book-surface bindings and the enclosing request/receipt/readiness,
   materialization, Supervisor, and Fresh Readiness versions. Immediate
   predecessors remain historical immutable evidence and cannot authorize a
   new live attempt. Existing output artifacts are never rewritten.
8. **Regression proof.** Tests cover every admitted/rejected diagnostic
   identity; exact recurring-prop keys and IDs; missing/duplicate/unexpected
   props; wrong lifecycle locator; root/member drift; page/reference guards;
   input nonmutation; non-target drift; compact prompt round-trip; lifecycle
   persistence/tamper rejection; and an end-to-end repair loop reproducing the
   mixed live failure without selecting `full_draft`.
9. **Rollback and authority.** Rollback is a code revert plus rematerialization
   under the preceding historical versions; no artifact migration runs in
   place. A new pushed immutable HEAD, Fresh Readiness, pricing gate, preflight,
   Supervisor verify, and separately bounded live invocation are required
   before operational proof. Production remains blocked.

## Scope, risk, validation, and exclusions

This is a general compiler/lifecycle change, not a Lion, story, child,
companion, page, or provider-response special case. The primary risk is
accidentally broadening repair authority; the closed locator check, strict
schema, exact identity maps, masked equality, tamper tests, and unchanged final
validators contain that risk. A full-draft retry, prose-only prompt change,
story literal, new fallback, higher budget, or artifact rewrite was rejected.

Validation is zero-cost: focused ordinary/resource phases, deterministic
TypeScript, `git diff --check`, and one repository gate. After an independent
Claude Code PASS and push, the smallest operational proof is Fresh Readiness
and one bounded live authoring attempt. Only if a candidate passes all canonical
downstream gates may the existing LOW-render plan continue.

No model, service tier, reasoning, 64K input ceiling, output ceiling, normal or
terminal call budget, repair count, timeout, transport retry, fallback,
candidate semantics, Blueprint/Wizard/Reader/render policy, resemblance
threshold, storage, payment, deployment, QA promotion, or Production behavior
changes in this milestone. Implementation and validation cost `$0`.
