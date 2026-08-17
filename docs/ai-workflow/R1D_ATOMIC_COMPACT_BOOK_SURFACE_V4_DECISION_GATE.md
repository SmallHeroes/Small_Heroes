# R1D Atomic Compact Book Surface v4 — Decision Gate

**Date:** 2026-08-17
**Owner decision:** approved under Guy's standing instruction to continue autonomously toward the first QA Wizard render, while remaining cost-conscious and preserving every canonical and independent-QA gate
**Base:** `48ef78ff77f325b111219654b463608792fd2b39`
**Branch:** `codex/r1d-atomic-compact-book-surface-v4`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Replace the full-surface Book Surface v3 repair payload with a compact, atomic
v4 delta contract. It may repair, in one existing standard repair call:

- exact typed presentation dispositions;
- the cover only when cover repair is authorized;
- recurring props only when lifecycle repair is authorized; and
- only the structural fields of the exact affected pages.

Action-semantic coverage and every other non-target field remain local and
immutable. When only one standard repair remains, an inadmissible combined v4
request stops before provider dispatch instead of spending that call on a
presentation-only patch that cannot complete the book.

## 2. Why now?

The consumed canonical attempt on pushed HEAD `48ef78ff` proved the preceding
compact-admission fix works, but also exposed its call-position blind spot.
Receipt `1a69883d3b55b053f85a8d3361a241dd8cb1949067a7ffbbf28f28007c25d2db`
records exactly three completed calls, two repairs, zero retries, no fallback,
and `$0.954122 / $1.050246` nominal/conservative cost.

The first response had nine spatial-reference failures. The exact spatial patch
resolved all nine and exposed one presentation gap plus cover, all twelve page
final-structure failures and recurring-prop lifecycle. The final compact
presentation patch resolved its sole target exactly, but fourteen structural
issues remained and no standard repair was left. No candidate or downstream
authority exists.

The local cause is deterministic: Book Surface v3 sends full cover, full props
and complete page contracts, including non-target action coverage. Its combined
request can exceed the 64K admission ceiling. The current fallback is safe when
two repairs remain, but predictably terminal when it is the last repair.

## 3. Scope

This is a general typed repair-contract correction. It is not tied to Dini, one
story, companion, child, page, phrase or observed response.

Expected surfaces:

- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler and lifecycle tests
- prompt/schema authority bindings and only the minimal immutable-version
  cutover required by those changed nested authorities
- `CURRENT.md` and implementation evidence

## 4. Risk of hardcoding

Eligibility and application derive only from current typed diagnostics, exact
validated target sets, canonical page identities and the existing presentation,
cover, lifecycle and structural authorities. No story key, page constant,
companion, literal prose or historical artifact digest may enter production
logic.

## 5. Architectural decisions

1. Keep the standard budget at exactly three calls, two repairs, zero transport
   retries, no fallback and the existing `[40000, 32000, 36000]` schedule.
2. Keep the hard authoring ceiling at `$5.00`; no conditional fourth standard
   call and no widening of terminal reference cleanup.
3. Retain repair mode `book_surface_patch`, but advance its schema, system
   prompt and user prompt to v4 because its input/output authority changes.
4. Output carries exact presentation patches, nullable authorized cover/props,
   and structural page projections only. It does not carry page
   `actionSemanticCoverage` or unrelated full-page fields.
5. The applier validates every component before mutation, clones once, applies
   all components atomically, and proves canonical non-target equality across
   the whole draft. Any mismatch rejects the entire response and leaves input
   unchanged.
6. Existing exact presentation permitted-pair authority is reused. Cover,
   recurring-prop and page target sets must equal the compiler-owned authority;
   missing, extra, duplicate, stale or reordered authority fails closed.
7. Full compilation and all validators run after application. No diagnostic is
   waived, reclassified or treated as resolved merely because a patch parsed.
8. If a mixed v4 request is inadmissible with two repairs remaining, the current
   safe presentation-first split may still be used. If it is inadmissible with
   only one repair remaining, stop before provider dispatch rather than make a
   predictably incomplete presentation-only call.
9. Pure presentation, pure structural, direct admissible Book Surface and all
   unrelated repair routes retain their existing behavior unless the v4 exact
   authority applies.
10. Historical v3 artifacts remain immutable and readable. Current writers use
    only v4. Version changes follow the smallest authority-consistent cutover;
    no historical artifact is rewritten or re-digested.
11. Independent Claude Code QA must PASS the immutable implementation range
    before push, new Fresh Readiness, credential access or another live call.
    Any later live failure stops without retry.

## 6. Expected behavior after change

The consumed progression is closed within the existing budget:

`initial -> page_spatial_reference_patch -> atomic book_surface_patch v4 -> candidate`

When two repairs remain and an intentionally split path is necessary:

`initial -> presentation_requirement_patch -> book_surface_patch v4 -> candidate`

If v4 admission or exact authority fails, the provider is not called through an
unsafe compact path and no candidate is emitted.

## 7. Validation plan

- Exact 12-page live-shaped regression: initial spatial failures, then the
  observed mixed presentation/cover/all-pages/lifecycle surface, then v4
  candidate in three calls/two repairs with unchanged caps and no fourth call.
- Byte-accounting regression proving Book Surface v3 is inadmissible while v4
  is at most `64000 - 4096` bytes and represents all exact structural hints.
- Atomic application positives and negatives for missing/extra/duplicate
  targets; stale page identities; illegal presentation pairs; cover/prop/page
  overreach; action-coverage drift; non-target page/global drift; malformed
  schema; input non-mutation; and complete post-apply validation.
- Routing negatives for unrelated mixed families, invalid authority, oversized
  v4, pure presentation, pure structural and one-repair-left admission failure.
- Prompt/schema digest, request/materialization, receipt/readiness, legacy-v3
  readability and tamper tests required by the final version cutover.
- Focused tests, `npx --no-install tsc --noEmit`, `git diff --check`, then one
  literal `npm run check` after focused green.
- Independent Claude Code read-only adversarial review and correction re-gate.

No image or render is part of implementation validation.

## 8. Cost impact

Implementation and tests spend `$0` in provider/image usage. No credential,
provider, image, Vision or render call is authorized during implementation or
independent QA. A later pushed-head Fresh Readiness may authorize only one new
bounded live attempt under the unchanged frozen `$5` ceiling.

## 9. Rollback

Revert the focused implementation and documentation commits. Historical v3
artifacts remain readable and untouched. No data, storage, database, deployment
or production rollback is required.

## 10. Review assignment

Claude Code must try to falsify v4 eligibility, compact byte accounting, exact
target completeness, atomic apply, non-target equality, action-coverage
preservation, one-repair-left fail-closed routing, full revalidation, unchanged
budget/model/retry/fallback policy, version cutover and legacy v3 readability.

Guy retains product/visual acceptance. Claude Cowork is unnecessary because
this is a typed compiler-authority correction rather than a creative decision.

## 11. Do not do

- Do not rerun any consumed attempt.
- Do not add a fourth standard call, raise the `$5` ceiling, enlarge standard
  output caps, add retries/fallback, change model/tier/reasoning or parse prose.
- Do not make a deterministic creative presentation/structural choice locally.
- Do not touch credentials, Fresh Readiness, provider, Blueprint, Wizard,
  image, Vision, render, storage/database, deployment or production before
  independent PASS.
- Do not rewrite or delete historical artifacts.
