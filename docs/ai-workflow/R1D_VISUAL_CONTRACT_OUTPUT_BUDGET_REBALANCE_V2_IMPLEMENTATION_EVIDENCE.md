# R1D Visual Contract Output Budget Rebalance v2 — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation complete; independent Claude Code QA pending;
no Fresh Readiness, live or render authority

**Branch:** `codex/r1d-visual-contract-output-budget-rebalance-v2`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `a1dd2e263b90ac90258ed77d45e472e5ccd70094`

**Implementation commit:** `a0c73841`

**External implementation cost:** `$0`

## Consumed-attempt evidence that motivated v2

The earlier bounded live attempt used Fresh Readiness digest
`c288fde471ebb66526a613ce27f9955df6c5a4a089cc49c0a40bfb7768d763d4`
and Execution Request digest
`7957b823e391d188c653266491cb4f408f2072f07376c6998ce20bd1decbeccf`.
One preflight and one Supervisor verify passed. One Supervisor live invocation
completed three logical provider calls with two repairs, zero transport retries
and no fallback. Credential access occurred only inside the Supervisor child;
authority was cleared and raw output was suppressed.

Receipt `baededeb9e75193c528e66ca2a85d6d279c73f4a49ca92e4bd160a67812ef566`
recorded 39,671 input, 35,054 cache-write, 4,608 cached-input, 78,933
output, 10,363 reasoning and 118,604 total tokens. Nominal cost was
`$2.589427`; conservative accounting was `$2.877529`.

The first two responses completed at 27,646 and 27,287 output tokens. The
third reached the exact 24,000-token cap and ended
`completion_status_invalid` / `provider_completion_failure` in
`provider_response_validation`. Candidate and Reconciliation were null,
Blueprint readiness was false and no Wizard, image or render authority existed.
That readiness is consumed and was not reused.

## Implementation

- Standard schedule authority v2 derives
  `[ceil(10B/9), floor(8B/9), remainder]` from one base helper.
- The page-count producer delegates to that helper, and the persisted-budget
  validator derives the base from the exact `3B` pool and compares the complete
  tuple against the same helper.
- Policy version is v12 and nested schedule authority is v2.
- Twelve pages now bind `[40,000, 32,000, 36,000]`; eight pages bind
  `[35,556, 28,444, 32,000]`. Total pool and `$4.99125` projected maximum are
  unchanged.
- Runtime reservation snapshots now reflect the exact remaining v2 caps.
- A direct regression rejects a re-digested v1 schedule.
- No prompt, Structured Output schema, model, reasoning, input ceiling, call or
  repair count, timeout, retry, fallback, candidate, Blueprint, Wizard or
  render behavior changed.

## Validation

- Primary compiler/lifecycle slice: **132/132 PASS** after the shared validator
  and stale v1 assertions were corrected.
- Direct lifecycle rerun with the legacy-version regression: **82/82 PASS**.
- Canonical live adapter/executable boundary: **162/162 PASS**.
- Adjacent canonical chain: canonical pre-live readiness 13/13, live request
  materialization 35/35, live request verification 50/50 and Supervisor 35/35
  all PASS.
- Unique final focused coverage: **428 tests across 8 files, all PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The first focused runs exposed only stale 4:3:2 assertions and the duplicate
validator formula; no provider, credential, network, timeout, RPC/IPC,
reporter, launch, signal or teardown failure occurred. No `npm run check` was
run in this milestone. The repository's separate known six ignored-output
fixture release HOLD and prior resource-worker advisory remain unchanged.

## Boundaries and next gate

No credential access, pricing lookup, provider/network call, Fresh Readiness,
preflight, live authoring, candidate creation, Reconciliation, Blueprint,
Wizard qualification, image dispatch, render, storage/database operation,
deployment or production change occurred during this implementation.

Independent Claude Code review must falsify the exact implementation range
before push/Fresh Readiness. A technical PASS grants only implementation
authority; it does not itself authorize candidate acceptance or render.
