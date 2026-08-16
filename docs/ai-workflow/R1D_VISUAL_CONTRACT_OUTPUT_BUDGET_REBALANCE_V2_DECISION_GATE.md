# R1D Visual Contract Output Budget Rebalance v2 — Decision Gate

**Date:** 2026-08-17

**Status:** implemented under Guy's standing instruction to continue toward a
full-book Wizard proof without further approval prompts; independent technical
QA remains required before any new Fresh Readiness or paid attempt

**Base:** `a1dd2e263b90ac90258ed77d45e472e5ccd70094`

## Product outcome

Restore a credible path to one complete 12-page Visual Contract candidate for
the approved Dini adventure without raising total exposure or weakening any
validation, retry, fallback, candidate, Wizard or render gate.

## Observed failure and root cause

The consumed live attempt used the approved 4:3:2 schedule
`[48,000, 36,000, 24,000]`. Calls one and two completed at 27,646 and 27,287
output tokens. The first repair resolved all action-semantic and lifecycle
issues, leaving 13 structural issues. The third call reached its exact 24,000
token cap and ended `completion_status_invalid`, so the terminal failure was
provider-completion rather than an invalid repair payload. No candidate was
created.

The total standard pool was sufficient, but its last-call allocation was not.
The failure is general to any full-book request that needs a second substantial
repair; it is not tied to Dini, the child, a story literal or a page number.

## Nine architectural decisions

1. **One schedule authority.** A single pure base-derived function owns the
   schedule. Producers and persisted-budget validators call it; duplicate
   formulas are forbidden.
2. **Same total exposure.** For legacy per-call base `B`, the standard pool
   remains exactly `3B`. No actual-spend recycling is permitted.
3. **Empirical 10:8:9 allocation.** The schedule is
   `[ceil(10B/9), floor(8B/9), 3B - first - second]`. For 12 pages it is
   `[40,000, 32,000, 36,000]`; for the 8-page floor it is
   `[35,556, 28,444, 32,000]`.
4. **Provider ceiling remains closed.** Every entry must be a positive safe
   integer at or below 64K. The derived base remains at least 32K, the pool must
   divide exactly into three bases and the stored tuple must exactly equal the
   canonical derivation.
5. **Explicit nested cutover.** Policy advances to
   `visual-contract-authoring-policy/v12` and the nested schedule to
   `visual-contract-authoring-standard-attempt-output-budget/v2`. Outer JSON
   shapes do not change; their content digests bind the new nested authority.
   Re-digested v1 schedules remain invalid.
6. **No lifecycle widening.** Model `gpt-5.6-sol`, Responses/default tier,
   medium reasoning, 64K input ceiling, three standard calls, two standard
   repairs, cleanup allowance, 20-minute timeout, zero transport retries,
   no fallback and the hard `$5.00` ceiling remain unchanged.
7. **Terminal semantics remain fail-closed.** Incomplete or failed provider
   completion is still terminal and cannot be reclassified as a semantic
   repair. Candidate acceptance and all downstream gates remain unchanged.
8. **Fresh authority only.** The consumed v1 readiness/request and every
   artifact from the failed attempt remain immutable historical evidence. A
   future attempt requires a pushed immutable v2 implementation, new Git probe,
   Fresh Readiness, Execution Request, pricing check, preflight and Supervisor
   verification.
9. **Smallest operational proof.** After independent QA, prove the new schedule
   with one bounded full-story authoring attempt. Only a valid candidate may
   advance through Reconciliation, Blueprint and Wizard qualification; image
   dispatch starts with the smallest LOW proof before a complete book render.

## Acceptance criteria

- 12-page and 8-page schedules equal the approved tuples and sum to `3B`.
- Every compiler repair route applies the attempt-indexed v2 cap.
- Receipt, readiness, materialization, verification and Supervisor boundaries
  reject tampered order, values, pool, digest or the legacy v1 authority.
- Runtime exposure reservation uses the exact remaining v2 entries and remains
  at or below `$5.00`.
- Focused compiler/lifecycle/boundary tests, TypeScript and `git diff --check`
  pass with no credential, provider, network or render activity.

## Rejected alternatives

- raising the total pool, hard ceiling or provider maximum;
- adding calls, repairs, retries or fallback;
- treating incomplete output as repairable;
- story-specific prompt compaction or validator weakening;
- replaying the consumed readiness or mutating its artifacts;
- proceeding directly to render without a candidate and Wizard qualification.

## Migration and rollback

Historical v1 artifacts stay byte-immutable and non-current. Before any v2
authority is materialized, rollback is a focused revert of the implementation
commit. After v2 artifacts exist, preserve them and use a reviewed forward fix;
never reinterpret them as v1. No storage or database migration is involved.
