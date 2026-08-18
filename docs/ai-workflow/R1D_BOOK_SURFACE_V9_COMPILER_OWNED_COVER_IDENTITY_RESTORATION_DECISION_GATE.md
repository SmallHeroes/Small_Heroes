# R1D Book Surface v9 — Compiler-Owned Cover Identity Restoration Decision Gate

**Date:** 2026-08-18
**Owner:** Guy (product intent and spend/render approval), Codex (technical design and implementation)
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `cf0c9534ed7fe4f56c94c0f784bb5fc984bb25f5`

## Decision

Keep semantic cover content provider-writable, but make the compiler-normalized
`worldType`, `locationId`, `zoneId` and ordered `castIds` non-provider output
authority. A well-shaped Book Surface response may return different values for
those four fields, but the compiler restores its exact current authority before
atomic validation/application. Malformed identity shape, stale authority,
unauthorized surface drift and final validation still reject.

Book Surface schema remains v6. System/user prompt authority advances v8 to v9
to state this contract. The authoring and canonical Fresh chain advances because
it binds those prompt versions and digests. Model, pricing, budgets, calls,
retries, fallback, Candidate and renderer behavior do not change.

## Evidence and root cause

The sole canonical attempt under
`outputs/r1d-terminal-cleanup-rebalance-fresh-cf0c9534-20260818T103956579Z`
failed closed after two completed provider calls. Receipt v39
`aad6ec681d14711db78a7e7801a35847ce4486f4fa8ddcb4128e944514fe0577`
records `initial -> book_surface_patch` and terminal identity
`book_surface_repair_cover_reference_invalid`. No Candidate or render authority
exists.

Before Book Surface selection, the compiler has already resolved the cover zone,
derived location from that zone, copied top-level world type and supplied/checked
cover cast. Asking the provider to echo those identity bytes adds failure surface
without creative authority.

## Scope and invariants

- General across stories/pages; no Dini-specific value is hardcoded.
- Only four normalized cover identity fields are restored.
- `timeOfDay`, `mustShow` and `mustNotShow` remain semantic repair output.
- Raw identity fields must still be well-shaped and nonblank; malformed output
  remains terminal.
- Existing exact source-draft digest, authority digest, non-target mask, atomic
  application and full-template validation remain mandatory.
- No additional provider call, retry, fallback or cost allowance is introduced.
- The hard cost fence remains `$5`; terminal cleanup remains 12K/1K and optional
  only for its existing closed residual.

## Validation and execution gate

1. Direct applier proves hostile but well-shaped identity replacement is restored,
   semantic cover content applies, and input remains immutable.
2. Malformed identity shapes remain rejected.
3. Full compiler regression proves a hostile cover identity response produces a
   valid Candidate using exact compiler authority.
4. Lifecycle and canonical authority-chain tests remain green; immediate prior
   authoring versions become legacy immutable.
5. TypeScript and `git diff --check` pass.
6. A focused independent read-only adversarial check targets this authority
   boundary before a new Fresh/live attempt.
7. Only a valid Candidate authorizes the already-approved full-book LOW render.

## Versions

- Book Surface schema v6 unchanged; system/user prompts v9.
- Authoring request/receipt/readiness v36/v40/v38.
- B0 input/manifest/verification v25/v34/v34.
- Execution materialization input/result v24/v28.
- Supervisor request/readiness/result v33/v33/v26.
- Fresh v33.
- Policy v13, Candidate v9 and all provider/model/cost authorities unchanged.

## Rollback

Revert the focused implementation commit. Historical v8 and older artifacts
remain immutable and cannot be promoted as current authority.
