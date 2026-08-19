# R1D Typed Prop-Constraint Repair Authority — Implementation Evidence

**Date:** 2026-08-19
**Owner:** Codex
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `f191af386eb0f8fe31aa3a7ef20b7aacf3be2a45`
**Boundary:** offline only; no Fresh, credential, provider, Candidate promotion, Wizard mutation, image or render action.

## Outcome

The existing nine deterministic page prop-constraint validations now share one
pure classifier. The classifier returns only closed clause codes and bounded
indexes while retaining the exact last-valid-write visibility map used by
Stage 4. The validator reconstructs its established authored error messages
locally, so message bytes, emission order, count and broad typed diagnostic
identity remain unchanged.

BookSurface pages writable for `propConstraints` now bind a recomputed
`propConstraintViolations` array into their content-addressed authority. The
records contain no authored prop ID, anchor ID, raw error, source phrase,
provider material, path, credential or stack. Collection-level errors contain
only `code`; item-level errors add `constraintIndex`; the contradiction clause
also binds the exact prior valid write through `relatedConstraintIndex`.

Authority creation derives the records from the exact invalid page, current
recurring-prop IDs and exact page-location anchor IDs. Prompt construction and
atomic apply recompute and exact-compare the same records. A re-digested code,
index, related index, recurring-prop authority, anchor context or current-page
drift therefore rejects before provider prompt authority or mutation. The
provider still returns the unchanged strict BookSurface v6 patch shape.

## Preserved semantics

- Undefined `propConstraints` remains valid and emits no issue.
- Present non-array and present empty-array clauses retain their exact legacy
  messages.
- Item evaluation order and short-circuit behavior remain unchanged.
- Unknown prop IDs may still co-emit visibility/state/anchor diagnostics.
- Invalid visibility never writes Stage 4 state.
- Valid visibility is exact last-write-wins, including for unknown prop IDs.
- Contradiction authority binds the exact immediately prior valid write index.
- Stage 4 action/visibility conflict behavior consumes the same map as before.
- The broad page cause remains `page_prop_constraints_invalid`; no route or
  Candidate semantics changed outside the added closed repair input.

## Prompt and version authority

- BookSurface schema remains `book-surface-repair-schema/v6`.
- BookSurface system/user prompt advance v10 -> v11.
- Authoring request/receipt/readiness advance v42/v47/v45 -> v43/v48/v46;
  v42/v47/v45 are immutable legacy.
- B0 input/materialization/verification advance v31/v40/v40 -> v32/v41/v41.
- Execution materialization input/result advance v30/v34 -> v31/v35.
- Supervisor request/readiness/result advance v39/v39/v32 -> v40/v40/v33.
- Fresh Readiness advances v39 -> v40.
- Candidate v9, policy v17, output budget v6, provider evidence, model, tier,
  reasoning, pricing, timeout, call caps, retry and fallback remain unchanged.

## Offline falsification coverage

- Exact nine-code classifier census, exact legacy message bytes/order/count and
  broad diagnostic identity.
- Last-valid-write and exact contradiction related-index behavior.
- Exact-key/index bounds and malformed typed-record rejection.
- BookSurface prompt round-trip and absence of authored/raw validation values
  from the typed record surface.
- Pre-prompt and pre-apply rejection of code/index/related-index tamper with
  input immutability.
- Existing recurring-prop lifecycle and read-only context tamper suites remain
  green against the new recomputation boundary.
- A 12-page prop-heavy authority with 84 item-level violations plus eight
  presentation targets remains canonically admissible with at least 4,096
  bytes headroom.
- The production-backed offline harness closes one `prop_id_unknown` issue via
  `initial -> book_surface_patch -> Candidate`, complete census `1 -> 0`,
  delta `-1`, `providerCalls:0`, and no positive complete delta.

## Validation

- Final targeted surface: all **602** assertions pass. A combined invocation
  recorded 598 passes and four process/Git fixture failures under accumulated
  subprocess load, including Vitest `onTaskUpdate` timeout. The exact affected
  materialization suite then passed **21/21** in isolation with no code change.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check` was run without retry. Ordinary phase: **3,320
  PASS**, with only five established ENOENT failures for ignored historical
  `outputs/` fixtures. Resource-intensive phase: **609/609 PASS**.
- Provider/image spend: **USD 0**.

## Explicit exclusions

No best-of-N, resampling, call-budget increase, retry, fallback, model change,
story-specific repair, Candidate promotion, Wizard mutation, Fresh Readiness,
live authoring, image generation or render is part of this milestone. The next
step is an immutable-range, read-only Claude Code adversarial review. Any valid
finding receives a separate focused QA-fix commit and re-gate before push or
external execution.
