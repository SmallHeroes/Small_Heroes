# Decision Gate — Compiler-Owned Cast and Continuity Evidence Binding

**Status:** approved by Guy on 2026-08-26; offline implementation green; independent QA pending
**Date:** 2026-08-26
**Owner:** Codex
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` in
`C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `6bedc6a396b07c0261991b859a554e5954adcc87`

## 1. Proposed change

Correct two compiler-owned binding defects exposed by the first fully captured
Chameleon live authoring replay.

1. Rebind exact provider-wire child and companion aliases in typed page action
   references to the authoritative cast identities already selected by the
   compiler. The projection covers entity subjects, cast-group subjects,
   objects, relation targets and spatial-constraint targets. It never rewrites
   a non-cast reference or an unknown alias. Ambiguous or cross-role aliases
   are replaced by a compiler-owned invalid sentinel so they cannot validate as
   the wrong person.
2. When the compact Source Evidence ID route repairs a coverage record that the
   compiler has already bound to a same-page companion-state or child-wardrobe
   disposition, propagate that validated ID atomically to the matching raw
   page continuity selector. Propagation requires the exact bound pointer,
   exact represented value and exact old-ID coherence; stale, ambiguous or
   mismatched associations fail closed.

## 2. Why now?

The single bounded live attempt at Fresh root
`r1d-chameleon-v3-fresh-readiness-20260826T042742202Z` captured five responses
and failed with the complete issue path `21 -> 18 -> 14 -> 12 -> 13`. Offline
replay reproduced it with zero provider calls and proved the regression guard
correctly retained attempt 4 and rejected attempt 5.

The retained draft had 12 issues. Ten were manufactured by two deterministic
compiler mismatches:

- the draft used `child` and `chameleon_koko`, while final cast authority used
  `child:hero` and `companion:chameleon_koko`; every typed action reference
  remained on the raw IDs even though cast and page presence were overwritten;
- compact Source Evidence repair changed the coverage ID but left the exact
  bound `companionStateSourceEvidenceId` stale, so continuity projection emitted
  an empty evidence phrase.

An in-memory replay applying only these two bindings reduced the retained
complete census from 12 to the two genuine action capability gaps and selected
the existing `presentation_requirement_patch` route. A separate attempt-1
probe showed that exact continuity propagation changes the next route from
`full_draft` to the existing `book_surface_patch` route.

## 3. Scope

This is a general compiler correction. It contains no story, child, companion,
page, state, wardrobe or evidence-ID literal.

Expected surfaces:

- a small pure cast-reference projection module;
- `compileBookVisualContractTemplate.ts` integration before each assembly;
- `sourceEvidenceIdRepair.ts` atomic continuity-selector propagation;
- focused unit and production-shaped offline replay tests;
- `CURRENT.md` and implementation evidence.

Provider prompts, response schemas, model, call/repair/retry count, fallback,
cost ceiling, validators, catalog, Candidate semantics, Wizard and rendering
remain unchanged.

## 4. Risk of hardcoding

All mappings are derived at runtime from the draft's declared cast aliases and
the compiler's authoritative IDs. Authoritative IDs are preserved first;
unknown or missing aliases stay unchanged and validation rejects them normally;
colliding or ambiguous aliases are deterministically invalidated before final
validation.

Continuity propagation is driven by the compiler-bound canonical disposition
pointer and value, not by story prose. Only the two generic continuity selector
families are eligible. Zero or multiple associations do not guess.

## 5. Files likely affected

- `lib/visual-contract-compiler/draftActionCastReferenceProjection.ts` (new)
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/sourceEvidenceIdRepair.ts`
- focused specs under `lib/__tests__/`
- `CURRENT.md`
- one implementation-evidence document under `docs/ai-workflow/`

## 6. Expected behavior after change

- Provider-wire child/companion aliases resolve to the exact cast identities
  used by page presence and final validation.
- Non-cast references, unambiguous authoritative IDs, unknown aliases and
  malformed values remain byte-semantically unchanged; ambiguous cross-role
  aliases cannot validate as another cast member.
- A validated compact evidence patch updates its exact bound continuity selector
  in the same transaction, preventing a stale ID from surviving projection.
- The captured retained draft reports only its two real capability gaps and
  proceeds through an existing narrow repair lane instead of another full draft.
- Regression and stagnation guards retain their current fail-closed behavior.

## 7. Validation plan

All proof before independent QA is offline and costs `$0`.

1. Unit-test every supported action cast-reference position, preservation of
   authoritative/unknown/non-cast IDs, ambiguity/collision behavior and input
   immutability.
2. Unit-test companion-state and wardrobe evidence propagation, existing
   source-phenomenon action propagation, zero association, wrong pointer,
   stale old ID, value mismatch, ambiguous association and input immutability.
3. Replay the captured production responses through the real compiler/harness
   with injected responses only. Prove zero provider calls, non-increasing
   complete census, and the expected narrow next route.
4. Run focused suites, broader compiler/lifecycle suites,
   `npx --no-install tsc --noEmit`, `git diff --check`, and literal
   `npm run check`, reporting any established fixture/infrastructure baseline
   honestly.
5. Commit locally and send the exact immutable range to Claude Code for
   adversarial PASS before Fresh, provider, live, Candidate, Wizard or render.

## 8. Cost impact

The implementation and proof cost `$0`; no credential read or provider call is
needed. This change reduces avoidable full-draft calls. It does not increase any
budget or call allowance.

After independent PASS, the existing authorization permits at most one new
Fresh live authoring attempt. A full paid render remains downstream of a valid,
reviewed and published package plus QA Wizard qualification.

## 9. Rollback plan

The correction is one focused local commit and can be reverted normally before
a new Fresh root is consumed. Historical Fresh roots, captures, receipts and
approved artifacts are immutable and will not be rewritten.

## 10. Review assignment

Guy has authorized the narrow offline root-cause correction and continued work
toward one Wizard-generated full book.

Claude Code must try to falsify:

- exact-alias and authoritative-ID precedence;
- collision/ambiguity fail-closed behavior;
- coverage-to-continuity pointer, value and old-ID coherence;
- absence of story/page-specific branches;
- replay of the actual captured failure through production code;
- unchanged schema, prompt, model, budget, retry, fallback, validator,
  Candidate, Wizard and render contracts.

Claude Cowork is not required for this deterministic engineering correction.
Guy remains the product/editorial/visual authority for the resulting book.

## 11. Do not do

- Do not add a Chameleon, Bar, Kim, page-number or known-ID special case.
- Do not weaken the complete-census regression guard or validator.
- Do not introduce best-of-N, resampling, another route or another call.
- Do not change prompt/schema/model/budget/retry/fallback/catalog policy.
- Do not mutate or publish historical evidence or approved artifacts.
- Do not read credentials, call a provider, run live, mint a Candidate, advance
  the Wizard or render before offline proof and independent Claude Code PASS.
