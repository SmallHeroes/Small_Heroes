# R1D Compiler-Owned Transition Endpoint Normalization — Implementation Evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `a957d18e34a5c8554720cfa273746150a51d4551`
**Decision Gate:** `R1D_COMPILER_OWNED_TRANSITION_ENDPOINT_NORMALIZATION_DECISION_GATE.md`

## Outcome

The compiler now normalizes only transition endpoint IDs that are uniquely implied by an existing provider-authored transition kind and the canonical current/adjacent page zones. It preserves `kind` and `cue`, never creates a transition, leaves ambiguous or incomplete topology fail-closed, and still subjects the resulting template to the complete existing validation boundary.

## Evidence that motivated the change

The sole canonical live attempt from pushed base `a957d18e` used:

- output root `outputs/r1d-five-standard-call-fresh-a957d18e-20260818T154552524Z`;
- Fresh Readiness digest `5bed2f15959f93ae71e2ec54de6802231a300ed4c385fd8a68c612a28a9103cf`;
- Execution Request digest `be700f3593747871369c61bf315a423fdf660037d159a61d7558e17e7c018b41`;
- authoring receipt digest `21419ded44f1ef4e7960fe8bce55f42cce4086769ea26f39adb79c599ea4c3e9`.

It ended fail-closed after exactly five completed provider calls, four repairs, zero transport retries and no fallback. Its typed progression was:

1. initial: one page-6 `action_binding_cardinality_invalid`;
2. PageContract repair: 26 unique issues (15 presentation/capability gaps and 11 page action-requirement issues);
3. BookSurface repair: eight page action-requirement issues persisted;
4. BookSurface repair: one page-3 `page_transition_invalid` remained;
5. BookSurface repair: the same one page-3 transition issue remained.

No Candidate, Wizard, render, deployment or production authority resulted from that attempt. The consumed Fresh/Execution Request is not reused.

## Implementation invariants

- `steady`: clear endpoint IDs; preserve kind/cue.
- `before_transition`: bind origin to the current canonical page zone; use an existing distinct resolved destination, or the unique distinct next-page zone.
- `after_transition`: bind destination to the current canonical page zone; use an existing distinct resolved origin, the unique distinct previous-page zone, or an exact preceding threshold edge ending at the current zone.
- `threshold`: preserve an existing valid distinct edge containing the current page zone. Otherwise derive an edge only when exactly one adjacent page supplies a distinct zone. If both previous and next pages imply different edges, do not choose between them.
- Missing pages, duplicate page numbers, unknown kinds, unresolved references and underdetermined endpoints remain in the existing fail-closed repair/validation path.
- The provider draft is not mutated.
- No story text, page-specific constant, cast identity, location name or zone ID is embedded in production logic.
- No prompt, schema, model, reasoning, service tier, timeout, input/output budget, hard cost fence, retry, fallback, Candidate, Wizard, style or renderer version changed.

## Changed files

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/visual-contract-s2b.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `CURRENT.md`
- Decision Gate and this implementation evidence

## Validation

Focused post-hardening validation:

- `visual-contract-s2b.spec.ts` + `visual-contract-repair-loop.spec.ts`: **55/55 PASS**.
- The preceding broader focused run across S2b, vNext, BookSurface, repair loop, source-authority lifecycle and canonical live boundary passed every assertion; the only subsequent code change narrowed ambiguous threshold normalization and is covered by the 55/55 post-hardening run.
- `npx --no-install tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS**.

The literal repository gate ran exactly once after the initial implementation:

- ordinary assertions: **3,278 PASS, 65 skipped, 5 failed**;
- resource-intensive assertions: **607/607 PASS**;
- the five ordinary failures are exactly the established missing ignored-output fixture HOLD in four unchanged specs (`child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa`, and two `story-read-back-validation` cases);
- the resource process reported the two established post-assertion Vitest `onTaskUpdate` RPC timeouts;
- no new implementation assertion, TypeScript check, diagnostic protocol, provider, transport or runtime test failed.

## Cost and execution exclusions

Implementation cost: USD 0. No credential was accessed, no provider/network/Fresh/live/image/render call was made during implementation, and no storage, database, deployment, production or payment operation occurred.

The Product Owner explicitly authorized one new Fresh Readiness, one bounded live authoring attempt, Wizard reconciliation only after a valid Candidate, and one 12-page QA/non-production `gpt-image-2` LOW render only after Wizard authority. HIGH, production, deployment and release remain excluded.

## Independent QA status

This evidence establishes the implementation and repository gates only. It does not self-award Independent QA PASS. The immutable-range review should try to falsify semantic preservation, ambiguity handling, input non-mutation, idempotence, unchanged authority versions/budgets and the Candidate gate. Product acceptance remains Guy's authority.
