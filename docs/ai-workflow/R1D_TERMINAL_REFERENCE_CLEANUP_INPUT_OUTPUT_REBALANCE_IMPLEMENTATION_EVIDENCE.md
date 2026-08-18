# R1D Terminal Reference Cleanup Input/Output Rebalance — Implementation Evidence

**Date:** 2026-08-18

**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Base:** `006782079eed049ecac7b024c06162d60ae4e0f3`

**Decision Gate:** `R1D_TERMINAL_REFERENCE_CLEANUP_INPUT_OUTPUT_REBALANCE_DECISION_GATE.md`

## Outcome

The already-authorized terminal page-spatial reference cleanup now reserves
12,000 input tokens and 1,000 output tokens instead of 6,000 / 2,000. It is
still one optional fourth call, available only after `book_surface_patch` or
`full_draft` leaves the exact typed `out_of_scope_reference` residual. No fifth
call, mixed-residual repair, retry, fallback or general repair-budget increase
was added.

## Runtime evidence that motivated the correction

The consumed v8 root
`outputs/r1d-booksurface-v8-action-identity-fresh-00678207-20260818T094340492Z`
contains receipt v38
`06825c473b10e02ae0d1f0ba5d5783996295051f43b62128972185242481b65a`.
It records three completed provider calls and route
`initial -> page_spatial_reference_patch -> full_draft`. Seven exact
`out_of_scope_reference` identities remained. The terminal cleanup was selected
but stopped before provider reachability because its canonical input was 9,719
against the old 6,000 ceiling. The earlier 11-target spatial repair used only
618 total output tokens, including 292 reasoning tokens.

## Cost fence

At the frozen GPT-5.6 Sol Standard pricing authority, with existing 1.1 uplift:

- old cleanup reserve: `(6000 * 6.25 + 2000 * 30) / 1e6 * 1.1 = $0.10725`;
- new cleanup reserve: `(12000 * 6.25 + 1000 * 30) / 1e6 * 1.1 = $0.1155`;
- unchanged three-standard-call reserve: `$4.884`;
- new maximum: `$4.9995`, leaving `$0.0005` below the unchanged hard `$5` fence.

The maximum remains conditional: the standard three-call path and the terminal
cleanup are not independently duplicated. Model, service tier, reasoning,
standard caps `[40000, 32000, 36000]`, transport retries and no-fallback policy
are unchanged.

## Authority cutover

- authoring policy v13;
- authoring request / receipt / readiness v35 / v39 / v37;
- B0 materialization input / manifest / verifier v24 / v33 / v33;
- execution materialization input / result v23 / v27;
- Supervisor request / readiness / result v32 / v32 / v25;
- Fresh Readiness v32.

Candidate v9, prompt/schema authorities, provider evidence, image/render code and
QA Wizard bridge shapes are unchanged. Immediate predecessors remain immutable
and fail as current authority.

## Regression evidence

- Core compiler/lifecycle: 3 files, 146/146 PASS.
- Authority chain: 6 files, all 327 assertions PASS across the combined run and
  the isolated predecessor test. The combined run's only failure was the same
  predecessor test exceeding its old 5-second timeout; with a local 15-second
  bound it passed in 5.40 seconds.
- The terminal cleanup test proves a seven-target request above 6,000 and at or
  below 12,000 dispatches exactly once, uses output cap 1,000, closes through
  full revalidation and returns a Candidate.
- The paired oversized request proves input above 12,000 performs no fourth
  provider dispatch and fails closed.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

One literal `npm run check` ran exactly once. Ordinary: 3,257 passed, 65 skipped,
five failed only for the established missing ignored-output fixtures. Resource:
604 passed; one unchanged heavy QA-bridge junction test exceeded its 5-second
parallel timeout and three known `onTaskUpdate` RPC timeouts were reported. The
same current Fresh predecessor test passed in the resource phase under its
focused timeout. No new functional assertion failed.

## Exclusions

Implementation and tests did not access credentials, call a provider, create
Fresh authority, run canonical live authoring, generate images, render, deploy,
touch production storage/database or alter payments. Independent Claude Code
review is required before a new Fresh package and one new bounded live attempt.
A valid Candidate remains mandatory before the separately approved full-book
LOW render.
