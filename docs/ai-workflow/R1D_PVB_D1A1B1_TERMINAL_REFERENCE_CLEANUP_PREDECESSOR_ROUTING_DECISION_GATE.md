# R1D-PVB-D1A1B1 Terminal Reference Cleanup Predecessor Routing — Decision Gate

## Decision

Proceed with a versioned, general routing correction that permits the existing
single terminal reference-cleanup call after either `full_draft` or
`book_surface_patch`. The correction is limited to predecessor recognition; it
does not add calls, widen the residual issue family, or change provider policy.

## Observed behavior and root cause

The second bounded live attempt completed the normal three logical provider
calls. Its third call used `book_surface_patch`, resolved the prior nineteen
issues, and left exactly two new non-empty
`draft_contract/out_of_scope_reference` issues at page-action reference
locators. The terminal cleanup did not run because both compiler routing and
lifecycle authority require the preceding repair mode to be exactly
`full_draft`.

That requirement is narrower than the actual mutation boundary.
`book_surface_patch` returns and replaces the complete cover contract and the
complete affected page-contract set. It can therefore introduce a page-action
reference residual in the same way as `full_draft`. The failure is not tied to
Lion, a story literal, a page number, or an authored identifier.

## Nine architectural decisions

1. **Closed predecessor catalog.** Terminal reference cleanup is eligible only
   after `book_surface_patch` or `full_draft`. The canonical value is one exact,
   sorted, duplicate-free array. No other repair mode is inferred or accepted.
2. **Residual gate unchanged.** Eligibility still requires a non-empty issue set
   composed exclusively of the existing page-action
   `draft_contract/out_of_scope_reference` identities with compiler-owned
   structural targets. Mixed, empty, malformed, duplicate, or unrelated issues
   remain terminal.
3. **Budget unchanged.** The normal budget remains one initial call plus two
   repairs. At most one fourth `terminal_reference_cleanup` call is allowed;
   there is no fifth call, transport retry, or fallback. Existing 6,000-input,
   2,000-output cleanup ceilings and the `$4.99125` conservative / `$5.00` hard
   caps remain unchanged.
4. **Versioned authority cutover.** Every request, materialization, Supervisor,
   receipt/readiness, and Fresh Readiness layer that binds the predecessor
   contract advances to a new current version. Immediate predecessors remain
   historical immutable and cannot authorize a new attempt.
5. **Exact parsing and persistence.** Canonical parsers and lifecycle validators
   require the exact allowlist, exact keys, canonical order, matching digests,
   and the same call-budget sequence in request, receipt, and readiness.
6. **General compiler routing.** Compiler eligibility checks membership in the
   closed catalog after call three. It does not inspect story IDs, prose,
   authored values, companions, pages, or provider messages.
7. **Regression and tamper proof.** Tests cover the observed sequence
   `initial -> page_spatial_reference_patch -> book_surface_patch ->
   terminal_reference_cleanup -> candidate`, the existing `full_draft` path,
   rejection after every other predecessor, and rejection of missing, extra,
   reordered, duplicated, or drifted authority values. Mixed residuals, failed
   cleanup output, and a fifth call remain rejected.
8. **Evidence and migration.** Implementation evidence records the consumed
   second attempt, exact root cause, version map, focused validation, repository
   gate, and unchanged boundaries. Old artifacts are never rewritten or
   recomputed; only a new pushed head plus new Fresh Readiness may authorize a
   later attempt.
9. **Rollback and downstream boundary.** Rollback is the focused implementation
   range. It restores the prior fail-closed predecessor rule without modifying
   historical artifacts. Candidate semantics, Semantic Reconciliation,
   Blueprint, Wizard, Reader, image rendering, storage, QA deployment, and
   Production remain unchanged and separately gated.

## Expected files

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- Visual Package lifecycle, materialization, canonical authoring, execution
  materialization, Supervisor, and Fresh Readiness modules
- Focused compiler/lifecycle/materialization/Supervisor tests
- `CURRENT.md` and implementation evidence

## Acceptance criteria

- The exact observed `book_surface_patch` predecessor sequence reaches the
  existing cleanup schema and can produce a candidate when the cleanup is
  valid.
- `full_draft` remains eligible with no behavioral regression.
- Every other predecessor and every non-exclusive residual remains ineligible.
- Request, receipt, readiness, materialization, Supervisor, and Fresh Readiness
  bindings reject legacy/current mixing and all allowlist tampering.
- Focused tests, deterministic TypeScript, `git diff --check`, and the one
  repository gate pass subject only to the separately recorded six ignored
  fixture release HOLDs.

## Cost and exclusions

Implementation and validation cost `$0`. No credential access, pricing lookup,
provider/model/network call, B0/Fresh Readiness execution, canonical preflight,
live authoring, candidate approval, render, image/Vision, storage/database,
Board, publication, Production activation, deployment, or push occurs in this
implementation milestone.

## Review assignment

Claude Code must adversarially falsify the allowlist closure, exact authority
bindings, call sequence, cost/token invariants, legacy immutability, tamper
rejection, and unchanged downstream surfaces before a new live attempt.
