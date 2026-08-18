# R1D recurring-lifecycle draft-authority alignment — implementation evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `53d790d8ed117e231e203a5ebc1200c753e99be3`

## Outcome

Recurring-prop lifecycle closure now runs against a structured clone of the
current provider draft before each validation/repair-routing iteration. Repair
authority therefore sees the same effective `firstRevealPage` and exact
pre-reveal prohibitions as final template validation.

For a BookSurface repair that cannot change recurring props, the applier also
restores every exact current compiler-owned pre-reveal prohibition before
validation. A provider-supplied `required` record for the same pre-reveal prop
is removed. Unrelated constraints retain their order/content and remain within
the existing causal writable-field mask. If recurring props are a repair
target, the existing effective post-patch lifecycle validator remains in force
and no old obligation is restored.

Malformed recurring props, pages, page numbers, constraint collections or
constraint records are not normalized into authority. They continue through
existing fail-closed validation. The provider input is never mutated.

## Causal evidence

The consumed root
`outputs/r1d-incomplete-page-correction-fresh-53d790d8-20260818T135423357Z`
contains receipt v41
`906a2a2cbe9648d41af68fe2800cfe3f6f21fc591b8f8a94e03e224340a8a77f`.
It proves the prior incomplete-set identity is absent, PageContract completes,
and the third completed BookSurface call stops specifically at
`book_surface_repair_lifecycle_obligation_invalid`. Candidate is absent.

## Validation

- BookSurface: 31/31 PASS, including hostile removal/inversion of a
  compiler-owned pre-reveal prohibition and the existing lifecycle-targeted
  effective-reveal negative.
- text-first compiler: 37/37 PASS.
- compiler repair loop: 36/36 PASS.
- source-authority lifecycle: 94/94 PASS.
- Combined: 4 files / 198 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Canonical mixed-route accounting is 37,209 bytes, leaving 22,695 bytes below
  the 59,904-byte route envelope.

BookSurface/page schemas and prompts, all artifact versions, policy, model,
reasoning, calls/repairs, output caps, retry/fallback, hard `$5`, Candidate v9,
Wizard and renderer are unchanged.

No credential, provider, Fresh Readiness, live authoring, image, render,
storage, deployment or production operation occurred during implementation.
