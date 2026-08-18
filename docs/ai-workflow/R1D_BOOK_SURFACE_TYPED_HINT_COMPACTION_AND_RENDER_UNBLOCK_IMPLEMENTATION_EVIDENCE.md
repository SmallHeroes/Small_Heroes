# R1D Book Surface Typed-Hint Compaction and Render Unblock — Implementation Evidence

**Date:** 2026-08-18
**Owner:** Codex
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `76686edb6d204afb50c373c100a38386abe76a3a`
**Decision Gate:** `R1D_BOOK_SURFACE_TYPED_HINT_COMPACTION_AND_RENDER_UNBLOCK_DECISION_GATE.md`

## Outcome

Book Surface repair is now a compact, strict causal-delta route. The provider
receives typed page causes, exact writable fields, bounded counts and scrubbed
read-only preservation context, but no duplicated raw validation prose or
unreturnable coverage coordinates. Its response must contain a non-null typed
value for every writable field and `null` for every non-writable field. The
compiler revalidates the full internal authority, applies only authorized
fields to a clone, verifies presentation, lifecycle and action-binding
invariants, and then runs the unchanged complete compiler validation.

The live-shaped 12-page lifecycle fixture that formerly needed a presentation
split now completes through one Book Surface repair in two logical calls. The
repeated pure-structural route is 36,044 estimated bytes, leaving 23,860 bytes
below the canonical 59,904-byte repair-route ceiling. A separate boundary
fixture still proves the safe presentation-first split when the mixed route is
too large and proves pre-dispatch refusal when the final structural route also
does not fit.

## Authority cutover

- Book Surface schema/system/user prompt: v6/v6/v6.
- Visual Contract request/receipt/readiness: v32/v36/v34.
- B0 input/manifest/verification: v21/v30/v30.
- Execution materialization input/result: v20/v24.
- Supervisor request/readiness/result: v29/v29/v22.
- Fresh Readiness: v29.
- Unchanged: draft v15, Page Contract v2, Structural Bundle v3, attempt
  diagnostics v4, policy v12, standard output budget v2, candidate v9,
  OpenAI evidence v6, child-output authority v1 and QA bridge v2.

Immediate Visual Contract predecessors v31/v35/v33 are registered as immutable
legacy authority. Current writers and downstream consumers require the new
versions and exact prompt/schema digests. Immediate-predecessor B0, execution,
Supervisor and Fresh envelopes remain fail-closed.

## Safety proof

- Internal action binding retains action index, beat ID, coverage index and
  Source Evidence ID; the provider receives only ordered action index + beat
  ID. Apply still verifies every full binding and forbids Source Evidence
  rebinding.
- Presentation target source phrases, raw validation messages, Story Source,
  rejected drafts, provider responses, credentials and executable material are
  absent from the prompt projection.
- Full causal writable-field scope is preserved. Non-null non-writable output,
  null writable output, missing/extra/reordered pages, stale authority,
  malformed values and non-target drift reject atomically.
- Cover, recurring-prop lifecycle, pre-reveal constraints, transition topology,
  frozen presentation `mustShow`, exact action count and ordered beat IDs remain
  compiler-owned invariants.
- Model, tier, reasoning, calls/repairs, output caps, timeout, retry/fallback
  policy and hard `$5` fence are unchanged.

## Validation

- Core Book Surface + repair loop + lifecycle: **3 files / 156 tests PASS**.
- Canonical version and downstream authority run: **8 files / 445 assertions
  PASS**; the combined runner reported two pre-existing `onTaskUpdate` RPC
  timeouts after all assertions completed.
- QA Wizard bridge, individual: **1 file / 7 tests PASS**.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Literal `npm run check` ran exactly once:
  - TypeScript and autonomous-story TypeScript: PASS.
  - Ordinary: **3,256 passed / 65 skipped / 5 failed assertions**. All five
    are the established missing ignored-output fixture HOLD across
    `child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa` and two
    `story-read-back-validation` cases; none is in the implementation range.
  - Resource: **604 passed / 1 timed out** plus two runner RPC timeouts. The
    timed test was the unchanged heavy Guy-approval bridge case under parallel
    load; it passed individually 7/7. Its explicit test timeout was raised from
    15s to 25s, matching the adjacent resource test and without changing
    production behavior. The literal repository gate was not retried.

This evidence is implementation evidence, not independent Claude Code PASS,
Fresh Readiness, provider authorization, Candidate authority, render approval,
release readiness or product acceptance. No credential, provider, network,
Fresh, live, image, render, storage/database, deployment or production action
occurred during implementation.
