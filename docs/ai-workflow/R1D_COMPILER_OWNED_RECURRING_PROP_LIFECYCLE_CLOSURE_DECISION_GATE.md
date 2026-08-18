# R1D compiler-owned recurring-prop lifecycle closure — Decision Gate

**Status:** approved under Guy's 2026-08-18 standing instruction to complete the new-story Wizard path and render when valid authority exists.

## Evidence and root cause

The sole run at
`outputs/r1d-cover-cast-normalization-fresh-293f25b5-20260818T131744049Z`
ended fail-closed after two completed calls. Receipt v41
`0223c9360c4baed24e3aad25e5a41397b32ab591f8f551e7da5c802dacfa6618`
proves the cover-reference failure is closed. The new exact terminal identity is
`book_surface_repair_lifecycle_obligation_invalid`; no Candidate exists and the
root will not be replayed.

The compiler already treats `firstRevealPage` as one book-level fact and appends
its exact cover prohibition. It does not materialize the corresponding required
page-level prohibitions. BookSurface is therefore asked to change the reveal fact
and every affected page together, and correctly rejects a response that leaves
any pre-reveal page inconsistent.

## Decision

1. After deterministic fact overlay, preserve an authored positive integer
   `firstRevealPage` unless an earlier page already has an exact `required`
   constraint for that prop; in that case set reveal to the earliest required
   page because the page-local fact is stronger and already exposes the prop.
2. For every page strictly before the effective reveal, preserve an existing
   exact `forbidden` constraint or append one exact
   `{propId, visibility:'forbidden'}` constraint.
3. Never replace malformed constraints or change unrelated prop constraints.
   Malformed page numbers, prop IDs, constraint shapes, invalid reveal values and
   every unrelated structural defect continue to fail closed.
4. Keep the existing cover lifecycle projection and page projection appenders;
   they operate after closure so prose containment remains exact and idempotent.
5. Keep every schema, prompt, policy and artifact version unchanged. This is
   compiler-owned materialization of an already-declared structured lifecycle
   invariant; Git HEAD and canonical digests provide the cutover.
6. Model, call/repair caps, retry/fallback, hard `$5`, Candidate, Wizard and
   renderer remain unchanged.

## Required proof

- missing pre-reveal constraints are appended in deterministic page order;
- an earlier required page moves reveal to that page and only earlier pages are
  forbidden;
- exact existing constraints and input objects are not mutated;
- malformed/unrelated constraints remain fail-closed;
- focused compiler/BookSurface/lifecycle, TypeScript and diff-check pass;
- a new Fresh package and one live invocation only.
