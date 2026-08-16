# R1D Book-Surface Input-Ceiling Routing and Observability — Decision Gate

**Date:** 2026-08-16
**Owner:** Guy (product), Codex (technical)
**Base:** `bd528a609b4c6d664ba7807a3a47ca201c2cf775`
**Branch:** `codex/r1d-book-surface-input-ceiling-compaction`

## 1. Proposed change

Compact the canonical `book_surface_patch` input and prevent the compiler from
selecting that route when its exact production request cannot retain the
required safety margin below the immutable 64K ceiling. The current v2 input repeats page validation messages twice: once
inside each affected page's `validationHints` and again in one global
`validationMessages` array. Replace that global mixed array with two scoped,
deduplicated collections:

- `coverValidationHints`, containing only cover-scoped structural messages;
- `recurringPropValidationHints`, containing only the exact authorized
  recurring-prop lifecycle message and empty when that collection is not
  repairable.

Every affected page continues to carry its complete page contract, exact typed
repair targets, page-specific validation hints, and permitted pointer values.
When that complete authority is too large, the same remaining bounded call uses
the existing `full_draft` route, which carries the Story Source and typed
diagnostics without echoing the rejected full draft into the request.

## 2. Why now?

The consumed attempt-5 authority on immutable `bd528a60` completed an initial
call and one compact page-spatial repair. That repair removed all 25 prior
`out_of_scope_reference` issues. The next closed route was correctly selected
as `book_surface_patch`, but local provider admission rejected it as
`input_token_ceiling_exceeded` before a third provider call. The attempt ended
without candidate, Reconciliation, Blueprint, Wizard, or render authority.

The failure is a documented routing defect: a 12-page mixed
structural/presentation surface can exceed the unchanged 64K ceiling, but the
compiler selects `book_surface_patch` before measuring the request. The scoped
hint compaction is correct but saves only about 2.3KB because the compact
encoder already deduplicates most repeated strings. It is not sufficient by
itself. This blocks the smallest path to one LOW render.

## 3. Scope

This is a general compiler/lifecycle change for every Story Source. It is not a
Lion, child, companion, page, or story-specific patch.

Likely surfaces:

- `lib/visual-contract-compiler/bookSurfaceRepair.ts`;
- book-surface compiler and lifecycle regression tests;
- authority/materialization/Supervisor/Fresh Readiness version bindings;
- `CURRENT.md` and implementation evidence.

The strict output schema remains `BookSurfaceRepairPatch` v2 because the
provider output shape is unchanged. Only the input prompt authority changes.

## 4. Observed and expected behavior

Observed:

- the route `initial -> page_spatial_reference_patch -> book_surface_patch`
  is valid under the existing three-call/two-repair budget;
- the first repair resolved all 25 predecessor issues;
- the third logical attempt was never sent to OpenAI because the local
  conservative byte upper bound exceeded 64,000;
- the v2 prompt sends every page message once in its affected-page bundle and
  again in the global validation array.

Expected:

- every typed target and every distinct scoped validation hint remains present
  exactly where it is actionable;
- no page hint is repeated globally;
- an eligible repair route is selected only when its exact production input
  retains at least 4,096 units of conservative headroom under the unchanged
  64K ceiling;
- an oversized `book_surface_patch` deterministically falls through to the
  existing admissible `full_draft` route before provider admission;
- every provider-admission rejection records sanitized component byte counts,
  the ceiling, allowance, and total without prompt content;
- invalid, missing, cross-scoped, unsanitized, or misaligned authority still
  fails closed;
- patch parsing/application, candidate semantics, and downstream behavior do
  not change.

## 5. Root cause and rejected alternatives

Root cause: the route selector treats semantic eligibility as sufficient and
does not perform the exact production input-admission calculation before
committing the remaining call. Diagnostic duplication contributes to size but
is not the dominant cause: full draft page contracts and their typed repair
targets dominate the payload, while the compact encoder already shares repeated
strings.

Rejected alternatives:

- raising or weakening the 64K limit;
- changing the byte-based fail-closed estimator;
- increasing call/repair budgets or adding retries/fallback;
- selecting an inadmissible `book_surface_patch` and relying on the terminal
  provider-admission rejection;
- partitioning one mixed whole-book correction across calls that do not exist
  in the approved budget;
- dropping typed targets, permitted values, page contracts, or unique hints;
- story-specific shortening or literals;
- reusing the consumed authority.

## 6. Nine architectural decisions

1. **Scope, do not flatten.** Validation hints are partitioned by their typed
   locator into cover, recurring-prop, or page scope before prompt assembly.
2. **Page bundles remain complete.** Each affected page retains its exact
   `repairTargets`, `validationHints`, `permittedPointerValues`, and page
   contract. No page instruction is inferred from prose.
3. **Closed non-page scopes.** Cover hints are allowed only for permitted cover
   issue identities. Recurring-prop hints are allowed only for the exact
   collection lifecycle identity and only when `repairRecurringProps` is true.
4. **Aligned evidence.** Diagnostic issues and validation messages remain
   length- and index-aligned; malformed or cross-scoped input returns no
   authority.
5. **Sanitized deterministic sets.** Each scoped hint set is whitespace-cleaned,
   secret-screened, deduplicated, deterministically sorted, bounded, and
   non-empty where its repair scope requires it.
6. **Input-only cutover.** Advance book-surface system/user prompt authorities
   to v3. Keep output schema/name/version v2 unchanged. Advance all lifecycle,
   materialization, Supervisor, and Fresh Readiness authorities that bind the
   prompt digests; predecessors become legacy immutable only.
7. **Admission-aware routing without policy expansion.** Model, Responses API, service tier, reasoning,
   prompt/schema output contract, 64K ceiling, max output, cost ceilings,
   timeout, three standard calls/two standard repairs, the closed terminal
   reference cleanup, zero transport retries, no provider fallback, and
   candidate/downstream semantics remain unchanged. The selector measures the
   complete `book_surface_patch` request first and uses the existing
   `full_draft` route when the compact route lacks 4,096 units of headroom.
8. **Production-faithful budget proof and observability.** A deterministic
   12-page high-entropy regression builds the authority through the production
   builder and proves that an oversized compact route is skipped while the
   selected route remains admissible. Every actual admission rejection records
   sanitized system/user/schema/separator/allowance/total byte counts and the
   applicable ceiling. No prompt content is persisted.
9. **Historical immutability and new authority.** Existing readiness, receipts,
   failure evidence, and output roots are never rewritten. A successful code
   change grants only authority to create a new Fresh Readiness and a new live
   attempt; it does not grant candidate, render, QA deployment, Production, or
   release acceptance.

## 7. Validation and acceptance criteria

Focused tests must prove:

- correct cover/recurring/page partitioning and deterministic deduplication;
- rejection of missing/misaligned/cross-scoped/secret-bearing messages;
- complete page hints and typed targets survive encode/decode exactly;
- recurring props remain immutable when not authorized;
- v3 prompt bindings propagate through request, receipt/readiness,
  materialization, Supervisor, and Fresh Readiness verification;
- immediate predecessors are legacy immutable and cannot authorize a new run;
- a production-shaped oversized 12-page book-surface request is recognized as
  inadmissible before call dispatch and the same logical call is routed through
  an admissible existing authority;
- input-accounting arithmetic and readiness tamper rejection are exact;
- the unchanged output patch guards and downstream candidate behavior remain
  green.

After focused PASS: deterministic TypeScript, `git diff --check`, then one
literal `npm run check`. The established ignored-output fixture baseline
remains a separate release HOLD; any new assertion or infrastructure failure
stops the milestone.

## 8. Cost and runtime impact

Implementation, tests, and independent QA cost `$0` and do not access
credentials or providers. After technical PASS and new Fresh Readiness, a new
bounded authoring attempt may use the already-approved maximum of three
provider calls under the hard `$5.00` ceiling. The smallest image proof remains
one `gpt-image-2` LOW render only after candidate, Reconciliation, Blueprint,
and Wizard gates pass.

## 9. Migration, rollback, review, and exclusions

Migration is a hard cutover to new current prompt/lifecycle authorities. Older
artifacts stay readable only under their recorded immutable legacy versions and
cannot authorize a new attempt. Rollback is the focused commit range revert;
because no historical artifact is mutated, rollback restores the v2 prompt
without data migration.

Claude Code must try to falsify semantic completeness, scoped hint alignment,
sanitization, the 12-page headroom proof, version/digest propagation, legacy
rejection, unchanged budgets/output schema, and absence of unrelated behavior.
Guy's standing instruction authorizes Codex to continue through this gate
without another approval request. Guy still owns visual acceptance of the LOW
render.

Do not access credentials, pricing/provider/network services, run Fresh
Readiness or live authoring, render, modify storage/database, deploy, publish,
or touch Production during this implementation milestone.
