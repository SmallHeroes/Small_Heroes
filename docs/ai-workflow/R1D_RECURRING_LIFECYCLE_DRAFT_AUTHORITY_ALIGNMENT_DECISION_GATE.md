# R1D recurring-lifecycle draft-authority alignment — Decision Gate

**Status:** approved under Guy's 2026-08-18 standing instruction to complete
the new-story Wizard path and render when valid authority exists.

## Evidence and root cause

The sole root
`outputs/r1d-incomplete-page-correction-fresh-53d790d8-20260818T135423357Z`
ended fail-closed and is not replayed. Receipt v41
`906a2a2cbe9648d41af68fe2800cfe3f6f21fc591b8f8a94e03e224340a8a77f`
records three completed calls and route
`initial -> page_contract_patch -> book_surface_patch`. The PageContract repair
completed and the prior incomplete-set failure did not recur. The final exact
identity is `book_surface_repair_lifecycle_obligation_invalid`.

The earlier lifecycle closure normalized only the assembled template clone.
When a later structural defect selected BookSurface, its source authority and
atomic applier still used the raw draft. Thus the template could be lifecycle
valid while the repair boundary recomputed obligations from stale raw
`firstRevealPage`/`propConstraints` state.

## Decision

1. Apply the same deterministic recurring-prop lifecycle closure to a
   structured clone of the draft at the top of every validation iteration,
   before any repair authority is selected.
2. Preserve malformed inputs unchanged for existing fail-closed validation.
3. When recurring props are not themselves repairable, restore every exact
   compiler-owned pre-reveal prohibition from the current PageContract
   authority before BookSurface validation/application. Remove a provider
   `required` collision for the same pre-reveal prop.
4. When recurring props are repairable, retain the existing effective-lifecycle
   validation and do not restore the old reveal obligations.
5. Keep full validation after repair. No provider patch can change unrelated
   constraints or any non-writable field.
6. Keep prompts, schemas, versions, model, policy, calls/repairs, caps,
   retry/fallback, hard `$5`, Candidate, Wizard and renderer unchanged.

## Required proof

- lifecycle normalization is visible to repair authority, not only candidate
  assembly;
- non-lifecycle BookSurface repair cannot remove or invert pre-reveal
  prohibitions;
- lifecycle-targeted recurring-prop repair retains its existing strict tests;
- malformed input and non-target drift remain terminal;
- focused compiler/BookSurface/lifecycle, TypeScript and diff-check pass;
- a new Fresh package and one live invocation only.
