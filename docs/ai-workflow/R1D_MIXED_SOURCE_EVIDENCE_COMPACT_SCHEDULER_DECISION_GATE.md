# R1D Mixed Source-Evidence Compact Scheduler — Decision Gate

Status: approved for offline implementation by Guy's standing instruction to
finish the canonical authoring pipeline, avoid speculative paid calls, prove
every repair change in the offline harness first, and consult Claude before and
after implementation.

## 1. Proposed change

When a complete validation census contains one or more invalid Source Evidence
IDs together with unrelated repairable failures, select the existing atomic
`source_evidence_id_patch` before any broad `full_draft` repair, but only when
the complete affected-record set forms one closed compact authority.

The change does not alter validation rules, the Source Evidence schema or
prompt, BookSurface, PageContract, the complete-census regression guard, the
stagnation guard, provider/model/tier, retry/fallback policy, output budgets, or
the hard cost ceiling.

## 2. Why now?

The consumed eight-page canonical attempt at pushed HEAD `1df7fc41` produced a
complete issue census of `22 -> 18 -> 22` on the route
`initial -> page_contract_patch -> full_draft`. The PageContract response
resolved four exact action-binding issues. The remaining complete frontier
contained one malformed Source Evidence ID, twelve closed-catalog presentation
gaps and five page-action structural failures.

The malformed Source Evidence ID had two contradictory scheduling effects:

1. it was mixed with unrelated failures, so the compiler intentionally omitted
   `sourceEvidenceAffectedRecords` and could not select the compact repair;
2. it set `hasBlockingNonSurfaceFailure`, so the compiler also could not select
   BookSurface for the independent presentation/structural subset.

The compiler therefore selected `full_draft`. That response resolved eight
issues but introduced twelve, including eight new cross-page
`represented_elsewhere_pointer_out_of_scope` identities. The complete-census
guard correctly stopped the run at `22` before calls 4–8. No Candidate exists.

This is a general scheduling defect between two already-existing fail-closed
authorities. It is not a request to weaken the regression guard or to retry the
consumed live attempt.

## 3. Scope

General compiler scheduling change plus offline regression coverage.

No story, child, companion, page number, authored phrase, Source Evidence ID,
or provider response from the consumed attempt is hard-coded.

## 4. Risk of hardcoding

The implementation must derive eligibility exclusively from the current
Source Evidence catalog, the current draft and the complete typed affected
records. A story key, page count, fixed page, fixed beat, excerpt, or diagnostic
count is forbidden in production code.

## 5. Files likely affected

- `lib/visual-contract-compiler/sourceEvidenceIdRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/source-evidence-id-repair.spec.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`
- `lib/__tests__/visual-contract-repair-loop.spec.ts`
- `lib/visual-package/__tests__/source-authority-lifecycle.spec.ts`
- `CURRENT.md`
- one implementation-evidence document

Files are included only when their contract is exercised; the smallest green
scope wins.

## 6. Expected behavior after change

The compact route is eligible only when all of these are true:

1. the affected-record list is non-empty;
2. every record has one closed failure code already supported by the existing
   repair (`malformed`, `unknown`, or `wrong_page`);
3. every record has a positive safe page number, non-negative safe coverage
   index and non-empty beat ID;
4. `(pageNumber, beatId)` is unique across the full affected set;
5. the current draft contains exactly one matching page and exactly one matching
   coverage beat, and that coverage index/beat identity is current rather than
   stale;
6. every affected page has at least one current same-page catalog entry that the
   provider may select;
7. for an `action_requirement` disposition, the current page has exactly one
   same-beat action, matching the atomic applier's existing identity boundary.

If any invariant fails, the scheduler preserves the existing fail-closed route.
No partial source authority is dispatched.

When eligible, the exact existing compact patch runs first. Full validation is
then repeated. Independent surface failures may enter BookSurface; independent
reference/action-binding failures remain for their existing compact lane. A
non-improving or worsening complete census is still stopped by the unchanged
guards.

## 7. Validation plan

All validation is offline and provider-free before any future Fresh or live:

1. pure eligibility tests for every positive failure code and negatives for
   empty, duplicate, stale page/coverage/beat, missing same-page catalog entry,
   and ambiguous action binding;
2. production offline harness fixture with simultaneous malformed Source
   Evidence, BookSurface structural failure and PageContract action-binding
   failure; injected responses must yield the compact source route first, then
   preserve the compiler's existing PageContract-before-BookSurface precedence:
   `source_evidence_id_patch -> page_contract_patch -> book_surface_patch -> Candidate`;
3. complete issue census must be monotonic with every delta `<= 0`, final count
   `0`, `providerCalls: 0`, no input mutation and no hidden full-draft call;
4. a repair-loop test must prove the exact prompt/schema authorities and output
   caps are the existing ones;
5. lifecycle coverage must prove the receipt trail, call/repair counts and
   Candidate binding without network/provider access;
6. focused suites, `npx tsc --noEmit`, one literal `npm run check`, and
   `git diff --check`;
7. focused commit followed by first-pass read-only Claude QA and a separate
   re-gate for any valid finding.

The consumed output root is evidence only and is never replayed or modified.

## 8. Cost impact

Implementation and validation cost: `$0` provider/image/audio/render spend.

The scheduler may replace a broad full-draft call with an already-reserved
compact repair call. It adds no call, retry, fallback or budget. A future live
attempt requires a new pushed HEAD, new Fresh authority and a separate explicit
pre-spend gate; it is outside this milestone.

## 9. Rollback plan

Revert the focused scheduler commit. Historical requests, receipts, readiness
evidence and the consumed output root remain immutable. No migration or artifact
rewrite is allowed.

## 10. Review assignment

Guy has already decided the product intent: finish the pipeline without
speculative spending, use the offline harness as the repair gate, do not use
best-of-N, and do not weaken model/retry/fallback/budget controls.

Claude Code must try to falsify:

- partial/ambiguous Source Evidence authorities entering the compact route;
- provider authority widening or draft mutation outside exact source IDs;
- masking reported as improvement;
- a hidden `full_draft`, extra provider call, retry or fallback;
- prompt/schema/version/policy drift;
- receipt/Candidate authority without complete monotonic census;
- story/page-specific logic.

No product/creative decision is involved, so Claude Cowork review is not
required.

## 11. Do not do

- Do not rerun the consumed live request.
- Do not run Fresh, live, Wizard, image generation or render in this milestone.
- Do not weaken or bypass complete validation, the regression guard or the
  stagnation guard.
- Do not add best-of-N, resampling, retry, fallback, model/tier changes, calls,
  output budget or cost ceiling.
- Do not create a composite provider schema unless the existing atomic route is
  proven insufficient offline.
- Do not persist raw drafts, prompts, responses, source phrases, authored IDs,
  credentials or stacks as new diagnostics.
