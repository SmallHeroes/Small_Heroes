# R1D — Six-standard-call / $10 authoring policy Decision Gate

Status: approved by Guy on 2026-08-18.

## 1. Proposed change

Permit six standard Visual Contract authoring calls / five standard repairs.
For a 12-page story the ordered output caps become
`[40000, 32000, 36000, 36000, 36000, 36000]`. Preserve the existing optional
compact terminal-reference cleanup as the only possible seventh call. The hard
spend ceiling remains USD 10.

## 2. Why now?

The canonical Dini attempt at pushed HEAD `19e463c5` completed all five
standard provider calls without transport retry or fallback. Its exact route
was `initial -> book_surface_patch -> page_spatial_reference_patch ->
book_surface_patch -> page_spatial_reference_patch`. Every compact repair
resolved its closed target family. Full validation after call five exposed only
seven page-scoped `page_action_requirements_invalid` issues. No Candidate was
written only because call six was reserved exclusively for a reference-only
residual.

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

A draft may use one additional standard repair when the first five calls have
not converged. A sixth standard BookSurface repair can close the exact live
progression. If it leaves only the already-authorized reference residual after
BookSurface/full-draft, the existing compact seventh cleanup may run. No eighth
call exists.

## 7. Validation plan

- Prove exact 6/5 standard and 7/6 absolute budgets.
- Prove the 12-page schedule and canonical conservative maximum below USD 10.
- Add a compiler regression for
  `BookSurface -> spatial -> BookSurface -> spatial -> BookSurface -> candidate`.
- Preserve the closed compact reference-cleanup eligibility and no-eighth-call
  boundary.
- Run focused suites, TypeScript, diff-check and the literal repository gate.
- After commit/push, create new Fresh authority and run one canonical live
  attempt. Render only if it produces a valid Candidate.

## 8. Cost impact

The sixth standard call adds at most 64K reserved input and 36K reserved output.
Six standard calls plus the alternative compact 12K-input/1K-output cleanup,
including 1.1 uplift, canonically reserve USD 9.883501 after six-decimal
rounding, below the unchanged USD 10 fence.
One new authoring live attempt is authorized. On Candidate success, one
12-page QA/non-production `gpt-image-2` LOW render is authorized.

## 9. Rollback plan

Revert the focused policy/version commit. Previously persisted artifacts remain
immutable and cannot become current authority.

## 10. Review assignment

Guy approved autonomous implementation, the additional bounded call, the new
canonical live attempt and the Candidate-gated LOW render. Independent QA
should falsify schedule/cost math, budget-sequence persistence, version
propagation, cleanup exclusivity, no-eighth-call behavior and regression
coverage.

## 11. Do not do

- Do not bypass Candidate, reconciliation, Wizard or render qualification.
- Do not add retry, fallback, a larger input ceiling, a different model/tier or
  HIGH rendering.
- Do not deploy, publish production authority, modify payments or weaken
  validation.
- Do not rerun a consumed Fresh request in place.
