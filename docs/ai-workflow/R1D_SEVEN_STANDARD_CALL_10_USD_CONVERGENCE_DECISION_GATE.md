# R1D Seven Standard Call / USD 10 Convergence — Decision Gate

Date: 2026-08-18

Owner decision: approved by Guy's standing instruction to continue through the
complete Wizard-connected LOW render without stopping for further questions.

## Observed behavior

The sole six-standard-call attempt on pushed `2f3a08ac` completed all six
provider calls with zero transport retries and no fallback. Its exact route was
`initial -> book_surface_patch -> book_surface_patch ->
page_spatial_reference_patch -> book_surface_patch ->
page_spatial_reference_patch`. The final spatial patch resolved all three
reference issues; full validation then exposed eleven page-scoped
`page_action_requirements_invalid` structural issues. Receipt
`5adc2ac5797b28889b000a74f72e8a1072548d1d7216d3fe139e7a54055233ca`
is terminal, cost USD 1.911785 conservative, and contains no Candidate.

The progression proves an alternating validation frontier: structural repair
can expose reference-only residuals, and compact reference repair can expose
the next structural layer. Six standard calls are one bounded BookSurface
repair short of the proven frontier. A following exact reference-only residual
must retain the existing compact cleanup authority.

## Decision

1. Admit seven standard calls / six standard repairs.
2. Keep the existing exact terminal-reference cleanup as the only possible
   eighth call. No ninth call exists.
3. Keep the hard USD 10 fence. Do not reserve a seventh legacy 36K output
   response. Use the exact 12-page schedule
   `[40000, 32000, 36000, 24000, 24000, 24000, 24000]`.
4. The late 24K caps are above every observed compact BookSurface response in
   the consumed chain (9,849 / 6,865 / 6,658 output tokens) and preserve the
   full 40K/32K/36K initial frontier.
5. The complete worst-case conservative reservation including the compact
   cleanup is USD 9.9275, below the unchanged USD 10 fence.
6. Provider, model, tier, medium reasoning, 64K input ceiling, timeout, zero
   retries, no fallback, tools, prompts, schemas and Candidate semantics do
   not change.
7. Current authority versions advance. Immediate authoring predecessors remain
   immutable legacy evidence; no historical artifact is rewritten.
8. One new Fresh and one new live attempt are required. The consumed attempt
   is never retried.
9. Wizard reconciliation and render remain forbidden until a valid Candidate
   exists. After Wizard approval/advance, one 12-page QA/non-production
   `gpt-image-2` LOW render is authorized. HIGH, production and deploy remain
   excluded.

## Rejected alternatives

- A generic unbounded retry: violates deterministic budgets and observability.
- Raising the USD 10 fence again: unnecessary; the bounded schedule fits.
- Reusing the 36K cap for all seven calls: worst-case reservation exceeds USD
  10.
- Bypassing the Candidate/Wizard gates or rendering an old approved contract:
  does not prove the new story-to-Wizard system.

## Acceptance proof

- exact seven-value schedule and USD 9.9275 reservation;
- candidate success on call seven;
- exhaustion after seven standard calls;
- exact reference-only eighth cleanup and no ninth call;
- current/legacy version and digest propagation through B0, execution,
  Supervisor and Fresh;
- relevant suites, TypeScript, one literal repository gate and diff-check;
- new committed/pushed HEAD before Fresh or provider access.
