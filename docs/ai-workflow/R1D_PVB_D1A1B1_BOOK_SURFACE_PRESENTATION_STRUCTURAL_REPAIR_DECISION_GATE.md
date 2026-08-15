# R1D Book-Surface Presentation/Structural Repair — Decision Gate

## Decision

Add one closed compact repair lane for the exact mixed failure family proven by
the consumed Leo v14 attempt: presentation coverage gaps together with a cover
projection/final-structure failure and page final-structure failures. The lane
repairs one complete cover contract plus the complete exact affected-page set.
It is general for every Story Source and contains no Leo, page, child,
companion, phrase, or authored-ID literal.

## Observed behavior and root cause

The immutable Leo v14 attempt completed an initial provider response and one
`page_contract_patch`. That compact repair resolved both page-3
`action_binding_cardinality_invalid` identities. Complete validation then
exposed 42 current issues: 29 closed presentation gaps, one cover projection
failure, and one final-structure failure on each of pages 1–12. The existing
page-only combined route could not repair the cover, so selection fell through
to `full_draft`. Its provider response reached the exact 36,000 output-token
ceiling and ended `completion_status_invalid`.

The validator was correct to reject the draft. The defect is repair granularity:
the final call needed one cover member and affected pages, not every global
draft collection.

## Nine architectural decisions

1. **Closed eligibility.** `book_surface_patch` is eligible only when a valid
   presentation-target set coexists with a closed structural set containing at
   least one cover issue and at least one page `final_structure` issue. Any
   unknown, collection-scoped, malformed, mixed, or unlocatable identity falls
   back to the existing fail-closed route.
2. **Exact repair surface.** Provider output contains exactly one strict
   `coverContract` and exactly the complete affected `pageContracts` set. It
   cannot return locations, zones, cast, recurring props, globals, or any other
   draft member.
3. **Compiler-owned authority.** The compiler derives affected page identities,
   validation hints, presentation targets, world type, locations, zones, cast,
   recurring props, and zone-scoped spatial references from the current draft.
   Prompt prose is never parsed into authority and no Story Source literal is
   embedded.
4. **Topology and mutation guard.** Page replacement reuses the existing exact
   page-repair application boundary, preserving page topology. The cover must
   use the exact current world type and valid location/zone/cast references.
   Canonical masked equality proves that every non-target draft field is
   unchanged and the caller input is not mutated.
5. **Strict structured output.** Introduce
   `book-surface-repair-schema/v1` / `BookSurfaceRepairPatch` with exact keys and
   reuse the current strict cover/page member schemas. The OpenAI Responses
   compatibility authority and adapter allowlist must bind this exact schema.
6. **Budget and routing unchanged.** The new route occupies one of the existing
   two repairs and records `book_surface_patch`. Model, service tier, reasoning,
   64K input ceiling, 36K output ceiling, three-call/two-repair budget, timeout,
   zero transport retries, no fallback, candidate policy, and `$4.884/$5.00`
   ceilings do not change.
7. **Fail-closed authority cutover.** Visual Contract and dependent B0,
   materialization, Supervisor, and Fresh Readiness contracts advance to new
   current versions that digest-bind the schema and prompt. Immediate prior
   artifacts remain immutable `legacy_immutable` and cannot authorize a new
   attempt.
8. **Regression proof.** Direct tests cover closed eligibility, unsafe and
   duplicate authority, exact schema/prompt roundtrip, exact page-set parsing,
   invalid references, masked non-target equality, nonmutation, adapter selection,
   receipt/readiness tampering, and the decisive bounded sequence:
   page-cardinality repair → book-surface repair → valid candidate in three
   calls.
9. **Rollback.** Revert the focused implementation commit to remove the new
   route. New-version authorities then fail closed as unsupported; historical
   artifacts remain untouched. Rollback restores the prior full-draft fallback
   and grants no candidate, Blueprint, Wizard, or render authority.

## Acceptance criteria

- The strict repair input stays below the unchanged admission ceiling and
  roundtrips losslessly through the canonical compact codec.
- A mixed cover/page/presentation fixture selects `book_surface_patch` and
  reaches a fully validated candidate within the existing three-call budget.
- Every malformed, extra, missing, duplicate, stale, out-of-domain, or
  non-target mutation fails closed.
- Lifecycle, materialization, Supervisor, Fresh Readiness, provider-adapter,
  TypeScript, and focused regression suites pass.
- The single repository gate may contain only the six established
  ignored-output fixture release failures; any seventh assertion or
  infrastructure failure stops implementation.
- Claude Code independently tries to falsify the exact eligibility boundary,
  reference authority, schema binding, version migration, and unchanged
  budgets before a new live attempt.

## Cost, risk, and explicit exclusions

Implementation and tests cost `$0`. The principal risk is admitting an
unrelated global structural failure; the closed issue catalog and exact cover
plus page locators prevent that. No prompt authority outside this repair lane,
draft schema, model, budget, timeout, retry/fallback policy, candidate
semantics, Blueprint v4, Wizard behavior, image generation, Reader, payment,
storage/database, QA deployment, or Production state changes in this
milestone.
