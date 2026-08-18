# R1D — Five-standard-call / $10 authoring policy implementation evidence

Status: implementation evidence; independent QA and product acceptance remain separate.

Date: 2026-08-18

## Scope

This milestone implements the approved
`R1D_FIVE_STANDARD_CALL_10_USD_AUTHORING_POLICY_DECISION_GATE.md` on branch
`codex/r1d-book-surface-typed-hint-compaction-render-unblock` from pushed base
`84a3de815161d86392d726fb87877e1f9bc98d60`.

It changes the general Visual Contract scheduler from four standard calls / three
standard repairs to five standard calls / four standard repairs. The existing
compact reference-only cleanup remains the sole possible sixth call. No seventh
call is admitted.

## Causal evidence

The consumed canonical attempt under
`outputs/r1d-four-call-ten-usd-fresh-84a3de81-20260818T145745291Z` completed all
four provider calls without transport retry or fallback. Receipt v42
`ad70fef8200162dde7bbd5688bbdc61e4cf96b2f20219a06f66fb880a87d33ed`
records route `initial -> page_spatial_reference_patch -> book_surface_patch ->
page_spatial_reference_patch`. The final compact patch resolved its reference
target and full validation exposed eleven page-scoped
`page_action_requirements_invalid` issues. Candidate and downstream authority
were absent only after standard-budget exhaustion.

## Implemented contract

- policy `visual-contract-authoring-policy/v15`
- standard output budget
  `visual-contract-authoring-standard-attempt-output-budget/v4`
- standard calls/repairs `5 / 4`
- absolute calls/repairs `6 / 5`, where call six is only the pre-existing closed
  terminal reference cleanup
- 12-page ordered standard caps
  `[40000, 32000, 36000, 36000, 36000]`
- canonical projected maximum USD `8.255501`
- hard ceiling USD `10`

Unchanged: OpenAI Responses provider, `gpt-5.6-sol`, default service tier,
medium reasoning, 64K input ceiling, 20-minute timeout, zero transport retries,
no fallback, disabled tools, all prompt/schema versions, Candidate v9 and
render/Wizard promotion semantics.

## Persisted authority cutover

- authoring request/receipt/readiness: v39/v43/v41
- B0 input/manifest/verification: v28/v37/v37
- execution materialization input/result: v27/v31
- Supervisor request/readiness/result: v36/v36/v29
- Fresh Readiness: v36

Authoring v38/v42/v40 is registered immutable legacy evidence. Candidate v9,
child-output authority v1 and QA Wizard bridge v2 remain unchanged.

## Regression evidence

The compiler suite contains the exact five-call observed-frontier regression:

`initial -> page_spatial_reference_patch -> book_surface_patch ->
page_spatial_reference_patch -> book_surface_patch -> candidate`.

It proves exact caps, four repair summaries, no sixth call, a completed Candidate,
and preserved page action-coverage beat identity. Separate tests prove five-call
exhaustion, fifth-slot pre-dispatch rejection, compact sixth-call eligibility,
and no seventh call. Lifecycle tests prove current receipt/readiness counters,
cost reservation, terminal diagnostics and immutable predecessor versions.

## Validation

Focused compiler, lifecycle, B0, execution-materialization, Fresh, Supervisor
and QA Wizard bridge suites: 13 files / 567 assertions PASS. The combined
process exited nonzero only after all assertions completed because of one known
Vitest `onTaskUpdate` RPC timeout; the same suites passed in separated focused
runs.

`npx --no-install tsc --noEmit`: PASS.

`git diff --check`: PASS.

Literal `npm run check` ran exactly once. Ordinary: 3,271 passed, 65 skipped,
and only the five established missing ignored-output fixture assertions failed.
Resource-intensive: 20 files / 607 assertions PASS; the process reported two
post-assertion `onTaskUpdate` RPC timeouts. The diagnostic protocol remained
valid and reported no new implementation assertion failure.

## Execution exclusions

During implementation: no credential access, provider/network call, Fresh
Readiness, live authoring, image generation, render, database/storage mutation,
deployment or production operation. A new Fresh/live attempt and Candidate-gated
12-page `gpt-image-2` LOW QA render are separately authorized after the pushed
green commit.

## Authority statement

This evidence does not self-award independent QA PASS, product acceptance,
production authority or deployment permission. A Candidate remains mandatory
before Wizard reconciliation or render.
