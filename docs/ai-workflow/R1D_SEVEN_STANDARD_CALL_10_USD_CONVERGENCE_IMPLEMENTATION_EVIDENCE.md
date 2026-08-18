# R1D Seven Standard Call / USD 10 Convergence — Implementation Evidence

Date: 2026-08-18

## Scope and authority

Implementation branch:
`codex/r1d-book-surface-typed-hint-compaction-render-unblock`

Implementation base:
`2f3a08acb94661a7a4c38b12f01d49daab4762d9`

Owner approval: Guy explicitly authorized continuing through the bounded live
authoring attempt, Wizard reconciliation, and one full 12-page QA/non-production
`gpt-image-2` LOW render after a valid Candidate. No Candidate, Wizard, render,
deployment, production, or product-acceptance authority is claimed by this
implementation evidence.

## Consumed evidence and root cause

The single six-standard-call live attempt under
`outputs/r1d-six-standard-call-fresh-2f3a08ac-20260818T172627095Z` is terminal
and will not be retried. Receipt
`5adc2ac5797b28889b000a74f72e8a1072548d1d7216d3fe139e7a54055233ca`
records six completed calls and route `initial -> book_surface_patch ->
book_surface_patch -> page_spatial_reference_patch -> book_surface_patch ->
page_spatial_reference_patch`. The final compact spatial patch resolved its
three reference issues and exposed eleven page-scoped
`page_action_requirements_invalid` issues. No Candidate exists. Nominal cost
was USD 1.692723 and conservative accounted cost was USD 1.911785.

This proves the bounded compiler frontier alternates between structural and
reference-only repair. The six-call policy stopped exactly one already-defined
BookSurface repair before the observed frontier could close.

## Implemented contract

- Seven standard calls and six standard repairs are admitted.
- The existing exact reference-only cleanup is the sole possible eighth call;
  no ninth call is possible.
- The exact 12-page standard output schedule is
  `[40000, 32000, 36000, 24000, 24000, 24000, 24000]`.
- The standard output pool is exactly 204,000 tokens and validators bind it to
  the exact sum of all seven caps.
- The conservative standard-plus-cleanup reservation is exactly USD 9.9275,
  beneath the unchanged USD 10 hard fence.
- Provider `openai`, Responses endpoint, `gpt-5.6-sol`, default tier, medium
  reasoning, 64K standard input limit, 20-minute timeout, zero transport
  retries, no fallback, tools disabled, prompt/schema authority, Candidate
  semantics, and promotion gates are unchanged.

## Authority cutover

- policy v17; standard output-budget v6;
- authoring request/receipt/readiness v41/v45/v43;
- B0 input/manifest/verification v30/v39/v39;
- execution materialization input/result v29/v33;
- Supervisor request/readiness/result v38/v38/v31;
- Fresh Readiness v38.

Candidate v9, child-output authority v1, QA Wizard bridge v2, provider evidence,
prompts, and structured-output schemas remain unchanged. Authoring request v40,
receipt v44, and readiness v42 are immutable legacy evidence and cannot be used
as current live authority.

## Validation

- compiler repair loop + reference-domain hardening: 90/90 PASS;
- source-authority lifecycle, including seven-call success/exhaustion,
  eighth-call cleanup, no ninth call, exact reservation, total-pool tamper,
  and legacy cutover: PASS;
- canonical boundary, B0 materialization/verification, execution
  materialization, Supervisor, and Fresh Readiness focused suites: PASS;
- QA Wizard candidate bridge: 7/7 PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The literal `npm run check` ran exactly once. The ordinary phase recorded
3,284 PASS / 65 skipped and only the five established missing ignored-output
fixture failures in four unchanged specs. The resource-intensive phase passed
609/609 with a valid diagnostic protocol and no timeout or assertion failure.

## Exclusions and next authority

No credential was read, no provider/network call was made, and no render was
performed during implementation or test validation. A new committed/pushed
HEAD, new Fresh v38, successful zero-write Supervisor verification, and one
new bounded live invocation are required. Wizard reconciliation may begin only
from the exact resulting Candidate. Rendering may begin only after the current
Wizard approval/advance authority exists.
