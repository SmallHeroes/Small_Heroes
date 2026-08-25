# R1D GPT-5.6 Sol Pricing Authority Cutover — Implementation Evidence

**Date:** 2026-08-25

**Branch:** `codex/r1d-represented-elsewhere-narrow-patch`

**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`

**Base:** `f4de883e9918e623c77d1635932de48f1b7678d2`

## Outcome

The checked-in `gpt-5.6-sol` price authority now matches the official current
promotional Standard schedule:

- ordinary input: `$4.00/M`;
- cache write: `$5.00/M`;
- cached input: `$0.40/M`;
- output: `$20.00/M`;
- regional processing uplift: `1.10`, unchanged.

The authoring policy advances from v17 to v18 and the dated pricing authority
advances from `openai-standard-pricing/2026-07-27-v2` to
`openai-standard-pricing/2026-08-25-v3`. The source remains the official OpenAI
pricing page. The implementation retains the conservative rule that reserves
every possible input token at the cache-write rate before applying the regional
uplift.

No outer artifact shape changed. Authoring request/receipt/readiness remain
v51/v53/v51; materialization and verification remain v49; execution
materialization remains v40; execution readiness remains v45; Fresh remains
v45. Their content digests bind the new nested policy and pricing authority, so
predecessor bytes cannot satisfy current exact validation.

## Exact bounds

- Eight-page unchanged output schedule:
  `[35556, 28444, 32000, 21333, 21333, 21333, 21333]`.
- Eight-page projected maximum including the existing cleanup allowance:
  `$6.541304`.
- Twelve-page projected maximum: `$7.04`.
- One 64K-input / 36K-output conservative call: `$1.144`.
- Twelve-page remaining reservation after one such completed call: `$6.952`.
- The hard ceiling remains `$10`.

## Fail-closed evidence

The lifecycle suite now proves both current projections exactly. It also takes
a current outer request (`visual-contract-authoring-request/v51`), substitutes
policy v17 plus the complete July price table, recomputes both nested and outer
digests, and verifies that validation reports both
`authoring_policy_version_mismatch` and `price_assumptions_mismatch` before the
provider is reachable.

Existing exact nominal/conservative receipt tests were updated to the current
rates. Canonical materialization, verification, Supervisor, and Fresh tests
retain their existing outer versions while observing the new `$7.04`
twelve-page bound.

## Validation

- `source-authority-lifecycle.spec.ts`: **1 file / 108 assertions PASS**, exit
  `0`.
- Canonical downstream matrix: **6 files / 333 assertions PASS**. The aggregate
  process then reported one established post-assertion Vitest worker
  `onTaskUpdate` RPC timeout and exited `1`; no assertion or process-under-test
  failed.
- Segmented evidence completed authoring boundary **170/170**, materialization
  **35/35**, verification **51/51**, execution materialization **21/21**, and
  Supervisor **42/42**. The isolated Supervisor process again reported the same
  post-assertion RPC timeout and exited `1`. Per the existing RPC-stability
  boundary, no further retry, pool change, timeout inflation, serialization,
  skip, dependency change, or assertion weakening was attempted. Fresh
  readiness had already passed **14/14** in the aggregate.
- `npx --no-install tsc --noEmit`: exit `0`.
- `git diff --check`: exit `0`.

This is truthful implementation evidence, not a claim that the repository-wide
test-infrastructure HOLD is cleared. Independent Claude Code review must
separate implementation correctness from that pre-existing infrastructure
boundary.

## Scope and cost

The only production change is
`lib/visual-contract-compiler/authoringPolicy.ts`. Five pricing-dependent specs,
this evidence, the Decision Gate, and `CURRENT.md` are the remaining scope.

No prompt, compiler rule, schema, repair route, model, service tier, reasoning
effort, token schedule, call count, retry, fallback, Candidate, Story Source,
Blueprint, Board, Visual Package, Wizard, payment, render, storage, database or
deployment behavior changed.

No plaintext credential was inspected or emitted. No provider, network, paid
authoring, Candidate persistence, image, audio or render operation occurred.

## Next action

Freeze the focused commit range for independent Claude Code falsification. A
new Fresh root may be prepared only after the pricing range is accepted and
pushed; the invalidated pre-cutover Fresh root must never be reused. Before any
paid Candidate attempt, complete the already-approved generic downstream
Candidate-to-Wizard orchestration so a successful Candidate is not stranded at
reconciliation.

## Independent QA

Claude Code independently reviewed immutable range
`f4de883e9918e623c77d1635932de48f1b7678d2..5ac32398a57bafa7393714baeff5184f696ad8f4`
and returned technical **PASS** with zero BLOCKER and zero MAJOR findings. It
recomputed all price and reservation arithmetic from the production formulas,
confirmed the unchanged outer versions and nested digest binding, confirmed the
provider-unreachable v17/July rejection, and found no stale parallel production
price table. The review preserved the Vitest worker RPC event as a distinct
pre-existing infrastructure HOLD. Its only informational note concerned stale
branch-base wording in `CURRENT.md`; that wording is corrected in the separate
documentation closeout commit.
