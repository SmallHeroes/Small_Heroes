# R1D Deferred-Represented BookSurface Scheduler — Implementation Evidence

**Date:** 2026-08-24
**Branch:** `codex/r1d-chameleon-v3-live-authoring`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Base:** `22730b30e0a2d08fbe4e56bd4da0e24c6ef98d3c`

## Result

The approved provider-free scheduler correction is implemented and locally
green. The production change removes only the unconditional requirement that
`capabilityGapPages` be non-empty before deferred represented-elsewhere
diagnostics may coexist with an independently closed BookSurface repair.

The adjacent per-issue guard is unchanged: `coverage_missing` remains
admissible only when its own page is in `capabilityGapPages`. All BookSurface
structural causes still have to be in the existing closed writable-cause set.
No prompt, schema, provider, policy, budget, call-count, receipt, readiness,
Candidate, Wizard, render, package, locator, database or deployment surface
changed.

## Load-bearing red/green proof

Before the production deletion, the new live-shaped harness fixture selected
`full_draft` after the initial call and could not consume the injected
BookSurface response. After the deletion, the same fixture reaches Candidate
through exactly:

```text
initial (11) -> book_surface_patch (5) -> page_contract_patch (0)
```

The fixture has five deferred represented-elsewhere issues, six independently
BookSurface-writable `page_steering_invalid` issues, and zero capability-gap
pages. It asserts:

- complete and surfaced counts `11 -> 5 -> 0`;
- deltas `null, -6, -5`;
- `monotonicCompleteIssueDelta: true`;
- `maxPositiveCompleteIssueDelta: 0`;
- `providerCalls: 0` and Candidate outcome;
- no `full_draft` call;
- the BookSurface response contains no `actionSemanticCoverage` field; and
- all five represented diagnostic identities, including their closed
  locators, persist exactly through BookSurface until the dedicated
  compiler-bounded PageContract repair closes them.

The focused suite also retains the direct BookSurface boundary assertion that
the applied page's `actionSemanticCoverage` is byte-for-byte structurally
equal to its pre-patch value.

## Fail-closed counterexamples

The same production-compiler harness proves:

1. zero-gap `coverage_missing` plus a BookSurface structural issue routes to
   `full_draft`, never BookSurface;
2. deferred represented coverage plus `world_type_missing`, a non-BookSurface
   root cause, routes to `full_draft`, never BookSurface; and
3. an exact zero-gap BookSurface fixed point repeats the same canonical draft
   and complete diagnostic fingerprint once, then terminates as
   `repair_stagnated` after two offline calls with count `2 -> 2`.

These are counterexamples to accidental broadening. Existing regression,
complete-census, pointer-authority and dedicated-lane tests remain unchanged
and green.

## Validation

- `lib/__tests__/offline-repair-harness.spec.ts`: **15/15 PASS**.
- Nine focused compiler/repair files: **9 files / 245 tests PASS**.
- `npx --no-install tsc --noEmit`: exit **0**.
- `git diff --check`: exit **0**.
- `npm run check`: the repository gate remains non-zero on the recorded
  infrastructure/historical baseline. The ordinary partition reports
  **285 files / 3,583 tests PASS**, 17 files / 70 tests skipped and the same
  10 failures: nine absent ignored historical-output assertions across five
  unchanged fixture-reading files, plus the unchanged Blueprint-migration
  assertion exceeding the ordinary five-second limit. The resource-intensive
  partition completes **20 files / 611 tests PASS** and Vitest then emits two
  known `onTaskUpdate` RPC timeout errors. No changed production or test file
  fails. The four new harness tests account exactly for the rise from the
  recorded 3,579-pass ordinary baseline to 3,583.
- The ordinary partition's unchanged five-second Blueprint timeout passes
  **8/8** in **16.62 seconds** with the established 30-second diagnostic
  allowance.

## Cost and external-state proof

Cost is `$0`. No credential was read and no provider, network, live authoring,
Candidate persistence, Wizard order, image, audio, Vision, render, database,
deployment or other external write occurred.

## Independent gate

This is Codex implementation evidence, not an independent PASS. Claude Code
must review the immutable base-to-head range read-only and attempt to falsify
the route, unchanged semantic surface, fail-closed counterexamples,
stagnation bound, regression guard and version/policy preservation before any
new paid attempt.
