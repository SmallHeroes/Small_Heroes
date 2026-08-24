# R1D BookSurface Target Association and Bounded Pointer Selection — Decision Gate

**Owner decision:** Guy approved this offline-only Decision Gate on 2026-08-24.

## 1. Proposed change

Remove positional presentation-target identity restoration from the mixed
`book_surface_patch` lane. Validate the provider-returned identity tuple before
any compiler-owned restoration, require an exact ordered bijection with the
authorized BookSurface targets, and replace provider-authored raw
`contractPointer` strings with a zero-based `pointerChoiceIndex`. The compiler
resolves that bounded choice to the exact authorized pointer and value.

## 2. Why now?

The single post-correction paid live attempt failed closed after its
BookSurface response parsed successfully but could not be applied. Independent
review proved that the current implementation can turn a provider ordering
error into `presentation_requirement_repair_pointer_not_permitted`: it restores
the four target identity fields by array position before comparing those same
fields. The comparison is therefore vacuous. A raw pointer string is also an
unnecessary free-form copy of a finite compiler-owned choice.

This blocks authoring before Candidate creation and makes another paid retry
unjustified.

## 3. Scope

General authoring-system correction. It applies to presentation-requirement
repair authority across all stories. BookSurface receives the target-
association correction; both the mixed and dedicated presentation lanes use
the bounded pointer-choice output contract.

## 4. Risk of hardcoding

No story key, child, companion, page number, pointer, or page count is
hardcoded. Choice indices resolve only inside each request's exact
`permittedPointerValues` authority.

## 5. Files likely affected

- `lib/visual-contract-compiler/presentationRequirementRepair.ts`
- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- focused repair/compiler tests
- authoring request and canonical materialization authority versions/tests
- `CURRENT.md` and implementation evidence

No Story Source, visual package, Wizard, render, model, budget, retry, fallback,
catalog, or policy file is in scope.

## 6. Expected behavior after change

- Provider output never authors a raw contract pointer.
- A valid zero-based choice resolves to the exact compiler-owned pointer/value
  for the returned target identity.
- BookSurface validates the original returned identity tuple before any
  restoration and rejects missing, extra, duplicate, or reordered target
  association distinctly.
- Invalid presentation class and invalid pointer choice have distinct errors.
- No failed application mutates the source draft.
- Dedicated presentation repair retains its safe identity-keyed,
  order-independent application behavior.

## 7. Validation plan

The smallest decisive proof uses two targets on different pages and injected
provider-shaped JSON only:

1. valid choices apply the compiler-owned pointer/value;
2. reversed BookSurface patches, each valid for its own target, reject with
   `presentation_requirement_repair_target_association_invalid`;
3. out-of-range and malformed choices reject before mutation;
4. multi-page choices cannot cross-bind;
5. invalid presentation class has its own error;
6. prompt encode/decode remains lossless;
7. masked-surface non-target drift remains closed;
8. all tests run with zero provider calls.

Run focused repair/compiler/lifecycle suites, `npx tsc --noEmit`, diff hygiene,
and the repository check contract if the established infrastructure baseline
allows it.

## 8. Cost impact

`$0`. No provider, image, audio, render, or other paid generation is authorized
for this milestone.

The runtime call count, repair count, model, token budgets, hard cost ceiling,
retry count and no-fallback policy remain unchanged.

## 9. Rollback plan

Revert the focused local milestone commit before it is promoted. Existing
immutable requests and receipts retain their legacy version status and are not
rewritten.

## 10. Review assignment

Guy approved the exact offline milestone and its exclusions. Claude Code must
independently falsify target association, cross-target/cross-page binding,
choice bounds, error separation, atomicity, prompt/schema version binding,
legacy immutability and policy non-drift. No product/creative review is needed
for this contract-only correction.

## 11. Do not do

- no provider or credential access;
- no Fresh Readiness or live attempt;
- no Candidate, Blueprint or Wizard mutation;
- no image, audio or render;
- no deployment;
- no raw provider-response persistence;
- no budget, model, retry, fallback or policy change;
- no story-specific repair.
