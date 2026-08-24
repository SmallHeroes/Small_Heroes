# R1D Initial/Full-Draft Same-Page Disposition Binding — Decision Gate

**Owner decision:** Guy approved this offline-only Decision Gate on 2026-08-24.

## 1. Proposed change

Separate the initial/full-draft provider wire disposition from the canonical
internal Action Semantic Coverage disposition. The provider will no longer
author a raw same-page JSON pointer or its compiler-verifiable value:

- `presentation_requirement` returns a zero-based `mustShowIndex`;
- `represented_elsewhere` returns one exact `representedValue` copied from a
  structured, non-action, non-prose string on that same authored page.

Before validation or repair routing, the compiler resolves those selections
against the just-authored page. Presentation resolves directly through the
page's `mustShow` array. Represented-elsewhere resolves only when exactly one
permitted same-page pointer has the exact returned value. The compiler then
materializes the canonical internal `contractPointer` and `contractValue`.

## 2. Why now?

The BookSurface target-association correction passed independent QA, but the
same paid attempt's initial draft carried 21 complete-census issues. Nine were
`represented_elsewhere_pointer_out_of_scope` or
`represented_elsewhere_pointer_unresolved`; one more was
`represented_elsewhere_value_mismatch`. The initial/full-draft wire schema
still asks the provider to author free-form JSON pointers, even though pointer
ownership belongs to the compiler.

Another paid live attempt is not justified while this measured, offline-
repairable source remains.

## 3. Scope

General authoring-system correction for every story. It applies only to the
initial and full-draft provider wire boundary and the deterministic conversion
into the existing canonical draft. Narrow repair lanes that already receive
closed compiler-owned target authority retain their current contracts.

## 4. Risk of hardcoding

No story key, child, companion, page number, field name from one story, raw
pointer or fixed page count is hardcoded. Resolution is derived from each
returned page and the existing same-page pointer-permission predicates.

## 5. Files likely affected

- initial/full-draft provider schema and prompt assembly;
- deterministic provider-wire-to-canonical normalization;
- compiler initial/full-draft response handling;
- focused schema, compiler, harness, lifecycle and compatibility tests;
- authoring/canonical authority versions whose bytes bind the changed schema;
- `CURRENT.md` and implementation evidence.

No Story Source, visual package, Board, locator, Wizard, renderer, model,
budget, retry, fallback, catalog, payment or package dependency is in scope.

## 6. Expected behavior after change

- Initial/full-draft provider output contains no raw `contractPointer` or
  provider-authored `contractValue` for these two dispositions.
- A valid `mustShowIndex` becomes the exact same-page canonical pointer/value.
- A represented value binds only when it has exactly one permitted same-page
  structured occurrence.
- Missing, ambiguous, invalid or out-of-range selections become compiler-owned
  non-resolving canonical sentinels and fail through ordinary validation before
  repair routing or Candidate minting.
- Canonical drafts and downstream validators retain their existing
  pointer/value representation.
- Narrow repair lanes remain behaviorally unchanged.

## 7. Validation plan

1. Hostile unit cases for negative, non-integer and out-of-range must-show
   indices.
2. Zero-match and duplicate-value ambiguity cases for represented-elsewhere.
3. Multi-page cases proving no cross-page binding.
4. Round-trip cases proving exact canonical pointer/value materialization.
5. Offline harness replay of the historical pointer failure family with
   `providerCalls: 0` and complete-census reduction.
6. Provider schema compatibility and a census proving zero raw pointer fields
   in the initial/full-draft wire disposition.
7. Full approved/QA input-ceiling census after the schema/prompt change.
8. Focused compiler/lifecycle tests, TypeScript and repository check.

## 8. Cost impact

`$0`. No credential, provider, image, audio, render or other paid generation is
authorized.

Model, call count, repair count, token budgets, cost ceiling, retry count and
no-fallback policy remain unchanged.

## 9. Rollback plan

Revert the focused local milestone commit before promotion. Existing immutable
requests and receipts remain legacy authority and are never rewritten.

## 10. Review assignment

Guy approved this exact offline milestone. Claude Code must independently
falsify cross-page binding, duplicate-value ambiguity, ordinal bounds,
canonical conversion timing, downstream canonical compatibility, schema
separation, version bindings, input ceilings and policy non-drift. No creative
or product review is needed.

## 11. Do not do

- no credential, provider or network access;
- no Fresh Readiness or live attempt;
- no Candidate, Wizard or runtime product mutation;
- no image, audio or render;
- no deployment;
- no budget, model, retry, fallback or policy change;
- no story-specific normalization;
- no rewriting existing evidence;
- no raw provider response persistence.

## Stop-check result

This is a general production authoring-boundary fix that can affect every
story, so schema/prompt and regression coverage are required. It spends no
money. The smallest proof is provider-free hostile fixtures plus the existing
offline harness and input census. Guy has made the only required product
decision. Claude Code should review the completed immutable range; Guy has
nothing visual to eyeball before that review.
