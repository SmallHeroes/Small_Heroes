# R1D Repair Output Diagnostic Identity and Compact-First Routing — Decision Gate

## Decision

Retire the broad-initial spatial-reference escalation to whole-draft
regeneration now that the canonical lifecycle has a separately bounded
terminal reference cleanup. Route every closed, compiler-typed page-spatial
set through the existing exact-field compact patch, and preserve a closed,
sanitized identity for any later repair-output parse or application failure.

This is general for every Story Source. It does not inspect story prose,
companion identity, page literals, provider text, or authored IDs.

## Observed attempt-2 evidence

The consumed attempt on immutable `7a37759c` used Fresh Readiness v19 digest
`1ab7efe95ad6e4acf59147cc940c155936b5cdb4beef1145f43c9b8bd91b1d08`
and Execution Request
`432202e10b7a1347d921ec6c205a59d544eaf01e9fb4cb08f0b87ed31374ecda`.
It completed three provider calls and two repairs with zero transport retry
and no fallback. The first response had 23 page-action out-of-scope references
across most of the book. Existing broadness policy selected `full_draft` even
though exact field authority existed for every reference. That regeneration
resolved all 23. The next validation exposed 20 current issues: seven closed
presentation gaps, one cover projection failure, and twelve page final-
structure failures. The final `book_surface_patch` response could not be
parsed/applied, but the current catch-all persisted only
`repair_output_json_invalid`, so the exact safe local failure class is lost.

Receipt v25 digest is
`d9605485756a7a0234d6f772eb3c24834978a83c0db4541e7f761314a1de8f52`;
readiness v23 digest is
`e6605b285d5d89423eb3f7cda707f9f9b0ba5e5136ed781838782b60ccb02db8`.
Calls/repairs/retries/fallback were `3/2/0/false`; usage was
`50,484/50,475/0/62,607/8,725/113,091`
(input/cache-write/cached/output/reasoning/total), and nominal/conservative
accounting was `$2.193724/$2.413110`. No candidate or downstream authority
exists.

## Nine architectural decisions

1. **Compact authority wins.** Every homogeneous set accepted by
   `pageSpatialReferenceIssuesAreRepairable` and successfully converted to
   exact compiler-owned targets uses `page_spatial_reference_patch`, including
   a broad first attempt.
2. **Obsolete escalation removed.** The five-page/strict-majority predicate and
   its dead routing flag are removed rather than retained as a hidden fallback.
   A missing, malformed, ambiguous, or mixed authority still fails closed.
3. **Existing later lanes remain.** Complete validation after the compact patch
   may select the existing page, structural-bundle, book-surface, full-draft,
   or presentation lanes. The existing optional terminal reference cleanup
   remains available only under its closed predecessor/residual rules.
4. **Closed repair-output identity.** A completed repair response that is
   unusable carries one sanitized compiler-owned reason class distinguishing
   JSON decode, strict shape/schema, target identity/cardinality, reference
   authority, non-target drift, and other closed local application rejection.
   Raw output, provider message, exception text, stack, prompt, source phrase,
   and secret never cross the compiler boundary.
5. **Fail-closed semantics unchanged.** Diagnostic precision never makes a bad
   repair eligible, never retries it, and never persists a draft or candidate.
6. **Budget/provider invariants unchanged.** Model, Responses API, service
   tier, reasoning, 64K input ceiling, output ceilings, standard calls/repairs,
   optional cleanup, timeout, zero transport retry, no fallback, projected
   maximum and hard `$5.00` ceiling do not change.
7. **Versioned authority cutover.** Current request/receipt/readiness and every
   canonical materialization, Supervisor, and Fresh Readiness binding advance
   together. Historical artifacts remain immutable evidence only.
8. **Regression proof.** Tests cover broad compact-first routing, exact-field
   nonmutation, the subsequent book-surface and optional cleanup sequence,
   every sanitized failure class, receipt/readiness roundtrip and tamper
   rejection, plus unchanged budgets and provider policy.
9. **Rollback.** Reverting the focused implementation restores the prior
   routing and coarse diagnostic. No historical artifact is rewritten; a
   failed attempt remains non-authoritative.

## Acceptance criteria

- A broad first-pass spatial-only failure selects the compact field patch.
- No full-draft regeneration occurs while complete exact field authority exists.
- The existing `page_spatial_reference_patch -> book_surface_patch ->
  terminal_reference_cleanup -> candidate` route remains valid.
- Every completed but unusable repair produces one closed sanitized reason in
  receipt/readiness, with no raw material.
- Focused tests, deterministic TypeScript, `git diff --check`, and the single
  repository gate satisfy the repository policy; the six known ignored-output
  fixtures remain a separate release HOLD.
- Claude Code independently reviews the immutable implementation range before
  any new Fresh Readiness or live attempt.

## Explicit exclusions

No story-specific fix, prompt/schema-authority prose change, model/tier,
token/call/repair budget, timeout, retry/fallback, candidate semantics,
Blueprint, Wizard, Reader, image generation, payment, storage/database,
Production, or deployment change is authorized by this gate.
