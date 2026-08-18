# R1D Six Standard Call / USD 10 Authoring Policy — Implementation Evidence

Date: 2026-08-18

Status: implementation evidence only. This is not independent QA, product
acceptance, production authorization, or render authority.

## Trigger evidence

The consumed canonical attempt rooted at
`outputs/r1d-action-cardinality-fresh-19e463c5-20260818T164449917Z`
completed five provider calls with zero transport retries and no fallback.
After four bounded repairs, only seven page-scoped
`page_action_requirements_invalid` structural issues remained. Receipt
`9d6bd72756c69a3f46c6ecb6324dab506a34c4ada01dee9fdd6573809c089566`
contains no Candidate and grants no Wizard or render authority.

## Implemented policy

- Six standard calls and five standard repairs.
- One additional call is possible only through the pre-existing closed
  `terminal_reference_cleanup` lane for an exact spatial-reference-only
  residual after `book_surface_patch` or `full_draft`.
- Exact 12-page standard output limits:
  `[40000, 32000, 36000, 36000, 36000, 36000]`.
- Compact cleanup limits remain 12,000 input / 1,000 output tokens.
- Conservative projected maximum: USD 9.883501.
- Hard cost fence: USD 10.
- Provider `openai`, endpoint `responses`, model `gpt-5.6-sol`, default tier,
  medium reasoning, 20-minute timeout, zero transport retries, no fallback,
  tools disabled and the 64K input ceiling are unchanged.

## Authority cutover

- policy v16; standard output-budget v5;
- authoring request/receipt/readiness v40/v44/v42;
- B0 materialization input/manifest/verification v29/v38/v38;
- execution materialization input/result v28/v32;
- Supervisor request/readiness/result v37/v37/v30;
- Fresh Readiness v37.

Candidate v9, child-output authority v1, QA Wizard bridge v2, all structured
output schemas and prompt versions remain unchanged. Authoring predecessors
v39/v43/v41 are immutable legacy evidence and cannot be current authority.

## Proofs

- Compiler tests prove a candidate on standard call six and fail-closed
  exhaustion after exactly six calls/five repairs.
- The terminal reference cleanup remains a seventh-call-only, exact-residual
  exception; no eighth call exists.
- Canonical request, receipt, readiness, B0, execution materialization,
  Supervisor and Fresh validators bind the six-value schedule and USD 10
  reservation.
- Current Wizard bridge validation remains unchanged and consumes only the
  current nested authority chain.
- Relevant focused suites, TypeScript and `git diff --check` pass.
- The literal `npm run check` ran once. Ordinary tests recorded 3,282 PASS,
  65 skipped and only the five established missing ignored-output fixture
  failures. Resource-intensive tests recorded 608/608 assertions PASS and one
  established post-assertion `onTaskUpdate` RPC timeout. No implementation
  assertion failed.

## Exclusions

No credential, provider, Fresh, live authoring, image, render, storage,
database, deployment or production action was performed while implementing
this change. Those actions require the new committed/pushed HEAD and a new
canonical Fresh chain. A render remains forbidden unless that chain produces
a valid Candidate and the Wizard reconciliation/approval/advance sequence
completes.
