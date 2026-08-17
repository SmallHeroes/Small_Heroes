# R1D Book Surface Hint Admission and Structural Observability — Decision Gate

**Date:** 2026-08-17
**Owner decision:** approved under Guy's standing instruction to continue autonomously toward the first QA Wizard render, while remaining cost-conscious and preserving canonical and independent-QA gates
**Base:** `37983ab41e039fa36b694344f2a399504a6806e0`
**Branch:** `codex/r1d-book-surface-hint-admission-observability`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Correct two linked Visual Contract compiler evidence boundaries:

1. Remove the redundant whole-authority aggregate count rejection in Book
   Surface v4. Keep every per-scope sanitization bound and let the existing
   canonical `59,904`-byte route-admission boundary decide whether the exact
   mixed Book Surface request is dispatched or uses the already-authorized
   presentation-first split.
2. Preserve closed, bounded structural subcauses for each page-level
   `final_structural_invariant_invalid` issue. The external diagnostic identity,
   deduplication key, routing family and issue counts remain unchanged.

## 2. Why now?

The consumed pushed-head attempt under
`outputs/r1d-mustshow-freeze-readiness-37983ab4-20260817T195312869Z`
ended fail-closed without a candidate. Receipt
`799af897555237565283b35237f549bc267237899a5366e2cfe9d8508b0fb6d4`
records exactly three completed provider calls, two repairs, zero transport
retries, no fallback, and `$2.147054 / $2.361773`
nominal/conservative cost.

The `mustShow` freeze worked: the final Book Surface patch applied and reached
full revalidation, with no stale presentation-target or repair-output failure.
The route nevertheless became `initial -> full_draft -> book_surface_patch`.
The initial response carried 126 structural validation messages plus eight
exact presentation targets. A redundant aggregate `128`-item guard rejected
that otherwise typed authority before canonical byte admission, so neither the
mixed Book Surface route nor its safe split fallback was available. The final
24 raw errors then collapsed into twelve page-level identities whose exact
structural clauses are not persisted, preventing a precise next diagnosis.

## 3. Scope

This is a general compiler-authority and observability correction. It is not
tied to Dini, a story, child, companion, page, phrase, response or artifact
digest.

Expected surfaces:

- Book Surface authority admission and focused tests;
- draft-validation diagnostic construction, validation and cloning;
- current receipt/readiness versions only where the persisted nested shape
  requires a cutover;
- focused compiler/lifecycle/canonical boundary tests;
- `CURRENT.md` and implementation evidence.

## 4. Risk of hardcoding

Production behavior may depend only on typed issue families, closed subcause
values, exact compiler-owned targets, sanitized validation messages and
canonical byte accounting. No story key, page number, authored phrase or
historical digest may enter the implementation.

## 5. Architectural decisions

1. Remove only the aggregate Book Surface authority count rejection. Retain
   per-scope maximum counts, maximum message length, whitespace normalization,
   deduplication, NUL/secret rejection and all target/reference guards.
2. Canonical route admission remains the ultimate input limit: at most
   `64,000 - 4,096 = 59,904` estimated bytes.
3. If the exact mixed authority fits, use Book Surface v4. If it does not fit
   while two repairs remain, retain the approved presentation-first split. If
   no structural follow-up slot remains, retain the existing fail-before-spend
   behavior.
4. Structural subcauses use a closed enum. They are required only on
   page-scoped `draft_contract/final_structural_invariant_invalid` issues and
   forbidden elsewhere.
5. Diagnostic identity remains exactly family + code + locator. Cause changes
   do not create a new issue, change route precedence, inflate unique counts or
   waive persistence; duplicate identities union causes deterministically.
6. Raw validation prose, provider output, drafts, prompts, IDs, paths, stacks,
   credentials and secrets are not persisted.
7. The nested draft-attempt diagnostics version advances. Receipt/readiness
   advance only as required to bind that current nested shape; historical
   artifacts remain immutable and classified as legacy.
8. Book Surface v4 schema/prompt/user prompt, authoring request, policy, model,
   service tier, reasoning, three-call/two-repair budget, output caps
   `[40000, 32000, 36000]`, timeout, retries, fallback, candidate semantics and
   `$5.00` fence remain unchanged.
9. Independent Claude Code QA must PASS the immutable implementation range
   before push, Fresh Readiness, credential access or another live call.

## 6. Expected behavior after change

An exact mixed authority with more than 128 aggregate sanitized items is not
rejected merely by count. Canonical byte accounting selects the safe route.
The consumed family can close within the existing budget as either:

`initial -> book_surface_patch -> book_surface_patch -> candidate`

or, when byte admission requires the existing split:

`initial -> presentation_requirement_patch -> book_surface_patch -> candidate`

If a later page structural invariant persists, the receipt identifies its
closed structural subcause without exposing authored content.

## 7. Validation plan

- Authority regression with exactly 126 sanitized structural messages and
  eight presentation targets; all survive and the authority builds.
- Preserve rejection of more than 128 messages within one bounded scope and of
  blank, overlong, NUL- or secret-bearing validation text.
- Compiler/lifecycle proof that canonical bytes—not aggregate count—select
  mixed Book Surface or the approved safe split, never `full_draft` for this
  reason alone.
- Exact three-call/two-repair candidate proof with unchanged caps and no fourth
  call.
- Diagnostic tests for every closed cause, exact-key validation, required vs
  forbidden causes, sorted union, stable issue identity/count/transition
  semantics, truncation and tamper rejection.
- Receipt/readiness persist-load-rebuild and legacy-version tests required by
  the final nested-version cutover.
- Focused tests, `npx --no-install tsc --noEmit`, `git diff --check`, then one
  literal `npm run check` after focused green.
- Independent Claude Code read-only adversarial review and correction re-gate.

No image or render is part of implementation validation.

## 8. Cost impact

Implementation and tests spend `$0` in provider/image usage. No credential,
provider, image, Vision or render call is authorized during implementation or
independent QA. A later pushed-head Fresh Readiness may authorize only one new
bounded live attempt under the unchanged `$5.00` ceiling.

## 9. Rollback

Revert the focused implementation and documentation commits. Historical
artifacts remain content-addressed and untouched. No data, storage, database,
deployment or production rollback is required.

## 10. Review assignment

Claude Code must try to falsify aggregate-count removal, per-scope bounds,
canonical byte admission, safe split/final-slot behavior, cause completeness,
cause sanitization, stable route/count semantics, receipt/readiness binding,
legacy immutability and unchanged cost/model/budget policy.

Guy retains product and visual acceptance. Claude Cowork is unnecessary: this
is typed compiler authority and engineering observability, not a creative or
UX decision.

## 11. Do not do

- Do not rerun any consumed attempt.
- Do not add a provider call, retry, fallback, fourth standard repair, output
  budget or cost allowance.
- Do not change Book Surface prompt/schema, model, tier, reasoning, candidate
  authority or presentation/structural semantics.
- Do not persist raw diagnostics, prompts, provider messages, drafts, authored
  identifiers, secrets or stacks.
- Do not touch credentials, Fresh Readiness, provider, Blueprint, Wizard,
  image, Vision, render, storage/database, deployment or production before
  independent PASS.
- Do not rewrite or delete historical artifacts.
