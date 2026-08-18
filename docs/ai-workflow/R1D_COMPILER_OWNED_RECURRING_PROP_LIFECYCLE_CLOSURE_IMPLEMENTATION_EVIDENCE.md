# R1D compiler-owned recurring-prop lifecycle closure — implementation evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `293f25b55bdebc17911b7bbcb9e94036915ef843`

## Outcome

The compiler now closes the already-declared recurring-prop reveal invariant
before final validation and repair routing. For every valid recurring prop with
a positive integer `firstRevealPage`, it:

1. preserves that reveal unless an earlier page already explicitly requires
   the prop;
2. moves reveal only to the earliest such required page;
3. preserves an existing exact pre-reveal prohibition or appends one exact
   `{propId, visibility:'forbidden'}` record in deterministic page order;
4. leaves malformed page/constraint authority and unrelated constraints for
   existing fail-closed validation;
5. mutates only the compiler-owned clone, never the provider draft.

The existing cover and page projection appenders continue after this closure,
so prose containment is derived from the effective structured lifecycle. No
schema, prompt, policy, artifact version, model, budget, retry, fallback,
Candidate, Wizard or renderer behavior changed.

## Causal evidence

The consumed canonical root
`outputs/r1d-cover-cast-normalization-fresh-293f25b5-20260818T131744049Z`
contains receipt v41
`0223c9360c4baed24e3aad25e5a41397b32ab591f8f551e7da5c802dacfa6618`.
It proves the earlier cover-reference failure is closed and terminates instead
at `book_surface_repair_lifecycle_obligation_invalid` after two completed calls.
No Candidate or downstream authority was produced, and the attempt is not
replayed.

## Validation

- `visual-contract-text-first-compiler.spec.ts`: 37/37 PASS, including missing
  prohibitions, earlier required reveal, malformed fail-closed behavior and
  input non-mutation.
- `book-surface-repair.spec.ts`: 30/30 PASS.
- `visual-contract-repair-loop.spec.ts`: 36/36 PASS.
- `source-authority-lifecycle.spec.ts`: 92/92 PASS.
- Combined focused result: 4 files / 195 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The aggregate BookSurface regression remains stronger than the removed
lifecycle noise: it carries 129 authority items, retains every per-scope bound,
and admits an exact 37,182-byte request under the 59,904-byte route envelope.

No credential, provider, Fresh Readiness, live authoring, image, render,
storage, deployment or production operation occurred during implementation.
