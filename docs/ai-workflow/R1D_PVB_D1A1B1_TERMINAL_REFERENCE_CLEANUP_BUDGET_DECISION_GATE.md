# R1D-PVB-D1A1B1 — Terminal Reference Cleanup Budget Decision Gate

## 1. Proposed change

Add one closed, low-cost terminal cleanup allowance after the existing
initial-plus-two-repair authoring sequence. The additional call is permitted
only when the third completed response followed a `full_draft` repair and the
remaining validation set consists exclusively of repairable page-spatial
reference issues. That call must use the existing
`page_spatial_reference_patch` schema and authority.

## 2. Why now?

Leo v16 completed the existing three-call sequence. Call two exposed 21 Action
Semantic issues plus fourteen structural issues. Call three `full_draft`
resolved all 35 and introduced only 22 `out_of_scope_reference` issues. The
existing compact page-spatial repair already closed the same class on call two,
but no repair budget remained. No candidate, Blueprint, Wizard, or render
authority was produced.

## 3. Scope

This is a general authoring lifecycle and authority change for every Story
Source. It is not a Leo, companion, child, page, or story special case.

## 4. Risk of hardcoding

Eligibility is derived only from typed repair mode, attempt position, closed
diagnostic identity, and compiler-owned page-zone reference authority. No story
key, prose, authored ID value, page literal, child, or companion identity may
participate.

## 5. Files likely affected

- `lib/visual-contract-compiler/authoringPolicy.ts`
- `lib/visual-contract-compiler/compileBookVisualContract.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- canonical materialization, verification, Supervisor, and Fresh Readiness
  version/binding surfaces
- focused lifecycle, verifier, materialization, Supervisor, and readiness tests
- `CURRENT.md` and implementation evidence

## 6. Nine architectural decisions

1. The normal budget remains three logical calls: one initial plus two repairs.
2. A fourth call is a separate terminal-reference-cleanup budget class, not a
   general third repair.
3. Eligibility requires attempt three, an immediately preceding `full_draft`,
   and a non-empty residual set made exclusively of repairable
   `page_spatial_reference_outside_zone` issues.
4. The fourth call uses the existing strict
   `PageSpatialReferenceRepairPatches` schema, exact targets, page-zone
   authority, duplicate rejection, masked equality, and input nonmutation.
5. The cleanup call is capped at 6,000 input tokens and 2,000 output tokens.
   The three-call standard reservation plus this compact reservation is
   `$4.99125`; the hard ceiling remains `$5.00` and is rechecked immediately
   before dispatch using completed conservative cost.
6. Every other attempt-three residual remains terminal. A failed or invalid
   fourth response is terminal; there is no fifth call, retry, or fallback.
7. Request, receipt, readiness, materialization, Supervisor, and Fresh
   Readiness authorities advance together. Prior artifacts remain historical,
   immutable, and non-authoritative for a new attempt.
8. Evidence records the per-attempt budget class, repair mode, logical provider
   calls, transport retries, fallback, usage, cost, and typed diagnostic trail.
   Raw prompt, response, provider message, stack, and secret remain forbidden.
9. Model, Responses API/default tier, reasoning, standard 64K/36K ceilings,
   timeout, zero transport retries, no fallback, candidate semantics,
   Blueprint, Wizard, renderer, resemblance threshold, QA/Production boundary,
   and Production state remain unchanged.

## 7. Validation and acceptance

- Direct compiler regression for the exact sequence: initial spatial failure,
  compact spatial repair, mixed failure, full-draft repair, reference-only
  residual, terminal compact cleanup, candidate.
- Negative matrices prove no fourth call for a non-reference residual, a prior
  repair other than `full_draft`, mixed residuals, empty authority, malformed
  output, input/output ceiling breach, or cost-ceiling breach.
- Receipt/readiness tamper tests cover budget class, counts, ordering, typed
  diagnostics, digests, and exhaustion at both the standard and terminal
  cleanup boundaries.
- Canonical materialization, verification, Supervisor, and Fresh Readiness
  tests prove version/digest cutover and reject predecessors for new authority.
- Focused tests, deterministic TypeScript, `git diff --check`, and one
  repository `npm run check`. The known six ignored-fixture failures remain a
  separate release HOLD; any seventh or infrastructure failure stops.
- No provider, credential, Fresh Readiness, live authoring, image, render,
  storage/database, deployment, or Production action during implementation.

## 8. Cost impact

Implementation and tests cost `$0`. A later separately materialized live
attempt may use at most one additional compact provider call, but the canonical
worst-case reservation remains below the unchanged `$5.00` hard ceiling.

## 9. Rollback

Revert the implementation commits before any new authority is consumed. After
cutover, preserve all new-version artifacts as historical evidence and place
live authoring on HOLD rather than reclassifying them under an older budget.

## 10. Independent review

Claude Code must falsify the closed eligibility sequence, budget-class
isolation, worst-case arithmetic, exact call options, no-fifth-call behavior,
receipt/readiness tamper rejection, complete authority cutover, historical
immutability, and absence of story-specific literals.

## 11. Do not do

Do not change model, service tier, reasoning, standard token ceilings, timeout,
transport retry, fallback, hard cost ceiling, prompts, response schemas,
candidate semantics, Blueprint/Wizard/render behavior, credentials, provider
state, storage/database, QA deployment, Production, or historical artifacts.
