# R1D Compiler-Owned Transition Endpoint Normalization — Decision Gate

**Decision owner:** Guy
**Technical owner:** Codex
**Date:** 2026-08-18
**Status:** Approved for implementation, one fresh bounded live authoring attempt, Wizard advancement after Candidate, and one 12-page QA/non-production LOW render.

## 1. Proposed change

Normalize only compiler-owned `fromZoneId` and `toZoneId` values on an existing page transition after the page zone graph has been canonicalized. Preserve the provider-authored transition `kind` and `cue`, never create or remove a transition, and leave any endpoint set that cannot be derived without ambiguity for the existing fail-closed validator and repair loop.

## 2. Why now?

The consumed five-standard-call live attempt completed all five provider calls and converged from 26 typed issues to one. The sole residual was a persistent page-3 `final_structural_invariant_invalid` with cause `page_transition_invalid` after two consecutive BookSurface repairs. The BookSurface schema admits transition combinations that the final topology validator rejects. The compiler already owns zone IDs and canonicalizes transition references, but it currently canonicalizes only present string references and does not repair a missing or self-contradictory endpoint that is uniquely implied by the existing kind, current page zone, and adjacent page zone.

## 3. Scope

This is a general compiler correction. It is not specific to Dini, page 3, a child, companion, style, or renderer.

## 4. Risk of hardcoding

No story text, page number, named location, named zone, or cast identity enters the algorithm. Eligibility is structural only. The normalizer:

- preserves `kind` and `cue` byte-for-byte;
- does not create a transition when none exists;
- uses only already-canonical page zones and already-resolved non-null endpoints;
- derives an endpoint from an adjacent page only when that derivation is unique for the existing kind;
- leaves malformed, unknown-kind, non-contiguous, or ambiguous cases unchanged so validation still fails closed;
- is deterministic and idempotent.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/visual-contract-s2b.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts` only if lifecycle proof needs a direct regression
- `CURRENT.md`
- this Decision Gate and its implementation evidence

No provider adapter, prompt, JSON schema, model, budget, retry, fallback, Candidate, Wizard, style, or render implementation is in scope.

## 6. Expected behavior after change

- `steady`: compiler clears unused endpoint IDs and preserves `cue`.
- `before_transition`: origin is the current page zone; an invalid/missing destination may use the next page zone only when it differs.
- `after_transition`: destination is the current page zone; an invalid/missing origin may use the preceding page zone only when it differs (or the exact preceding threshold edge when applicable).
- `threshold`: an already-valid edge containing the current page zone is preserved; otherwise the unique visible arrival or departure edge is derived from the adjacent zones.
- No `kind` or `cue` changes. No new transition. No ambiguous correction.
- Full existing validation remains the only Candidate boundary.

## 7. Validation plan

1. Direct tests for every kind, idempotence, non-mutation, note emission, preserved valid authority, and ambiguous fail-closed behavior.
2. A compiler repair-loop regression proving a final persistent transition endpoint defect closes locally without another provider call and with unchanged route/call budgets.
3. Existing topology, BookSurface, repair-loop, lifecycle, canonical boundary, materialization, Fresh, Supervisor, and Wizard bridge focused suites.
4. `npx --no-install tsc --noEmit` and `git diff --check`.
5. Literal `npm run check` exactly once if the implementation changes production code after the previous committed gate.
6. Independent read-only Claude Code falsification on an immutable commit range before treating the milestone as technically closed.
7. One new Fresh and one bounded live attempt only after commit/push and exact readiness verification.
8. Wizard reconciliation and the authorized 12-page LOW render only after a valid Candidate exists.

## 8. Cost impact

Implementation and tests cost USD 0. The authorized post-gate authoring attempt remains under the existing hard USD 10 fence. The render is a single 12-page QA/non-production `gpt-image-2` LOW run, explicitly authorized by Guy. No HIGH or production generation is authorized.

## 9. Rollback plan

Revert the focused commit. Historical receipts, readiness evidence, Candidates, Wizard artifacts, and render outputs are content-addressed and are never rewritten.

## 10. Review assignment

Guy has approved continuing through implementation, Fresh/live, Wizard, and LOW render without further pauses. Claude Code should try to falsify semantic preservation, adjacency ambiguity, threshold continuation, opening/last-page behavior, idempotence, non-target drift, unchanged budgets/versions, and the Candidate gate. Claude Cowork review is not required because this is compiler topology integrity rather than a creative decision.

## 11. Do not do

- Do not change transition `kind` or `cue`.
- Do not invent a zone, location, transition, or story fact.
- Do not bypass final validation or Candidate authority.
- Do not broaden call counts, budgets, retries, fallback, model, or the hard USD 10 fence.
- Do not render before Candidate + Wizard authority.
- Do not run HIGH, production, deployment, payment, or release paths.
