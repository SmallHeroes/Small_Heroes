# R1D — Five-standard-call / $10 authoring policy Decision Gate

Status: approved by Guy on 2026-08-18.

## 1. Proposed change

Permit five standard Visual Contract authoring calls / four standard repairs.
For a 12-page story the ordered output caps become
`[40000, 32000, 36000, 36000, 36000]`. Preserve the existing optional compact
terminal-reference cleanup as the only possible sixth call. The hard spend
ceiling remains USD 10.

## 2. Why now?

The canonical Dini attempt at pushed HEAD `84a3de81` completed all four
standard provider calls without transport retry or fallback. Its exact route
was `initial -> page_spatial_reference_patch -> book_surface_patch ->
page_spatial_reference_patch`. The fourth call resolved the sole reference
residual and full validation then exposed eleven page-scoped
`page_action_requirements_invalid` structural issues. No Candidate was written
only because the four-call standard budget was exhausted.

## 3. Scope

General bounded-authoring policy and persisted authority version cutover. No
Dini-, page-, child- or companion-specific production branch.

## 4. Risk of hardcoding

The scheduler applies to every admitted story up to the existing 12-page
limit. Eligibility, routing, atomic application and full validation remain
generic and typed.

## 5. Files likely affected

- authoring policy and compiler loop tests
- authoring request/receipt/readiness lifecycle
- B0, execution materialization, Supervisor and Fresh version bindings
- focused canonical-boundary tests and current/evidence documentation

## 6. Expected behavior after change

A draft may use one additional standard repair when the first four calls have
not converged. A fifth standard BookSurface repair can close the exact live
progression. If it leaves only the already-authorized reference residual after
BookSurface/full-draft, the existing compact sixth cleanup may run. No seventh
call exists.

## 7. Validation plan

- Prove exact 5/4 standard and 6/5 absolute budgets.
- Prove the 12-page schedule and canonical conservative USD 8.255501 maximum.
- Add a compiler regression for
  `spatial -> BookSurface -> spatial -> BookSurface -> candidate`.
- Preserve the closed compact reference-cleanup eligibility and no-seventh-call
  boundary.
- Run focused suites, TypeScript, diff-check and the literal repository gate.
- After commit/push, create new Fresh authority and run one canonical live
  attempt. Render only if it produces a valid Candidate.

## 8. Cost impact

The fifth standard call adds at most 64K reserved input and 36K reserved output.
Five standard calls plus the alternative compact 12K-input/1K-output cleanup,
including 1.1 uplift, canonically reserve USD 8.255501 after six-decimal
rounding, below the unchanged USD 10 fence.
One new authoring live attempt is authorized. On Candidate success, one
12-page QA/non-production `gpt-image-2` LOW render is authorized.

## 9. Rollback plan

Revert the focused policy/version commit. Previously persisted artifacts remain
immutable and cannot become current authority.

## 10. Review assignment

Guy approved the additional bounded call, the new canonical live attempt and
the Candidate-gated LOW render. Claude Code should falsify schedule/cost math,
budget-sequence persistence, version propagation, cleanup exclusivity,
no-seventh-call behavior and regression coverage. No creative decision is
required from Claude Cowork.

## 11. Do not do

- Do not bypass Candidate, reconciliation, Wizard or render qualification.
- Do not add retry, fallback, a larger input ceiling, a different model/tier or
  HIGH rendering.
- Do not deploy, publish production authority, modify payments or weaken
  validation.
- Do not rerun a consumed Fresh request in place.
