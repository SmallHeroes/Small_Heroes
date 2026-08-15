# R1D Broad Initial Spatial Repair Escalation — Decision Gate

## Decision

Correct the order in which the unchanged two-repair budget is spent when the
initial authored draft has page-spatial reference failures across most of the
book. This is a general routing change for every Story Source. It is not a Leo,
page, companion, or literal-specific patch.

## Observed failure

The consumed Leo v13 attempt under
`outputs/r1d-leo-v13-compound-page-authority-compact-routing` completed all
three provider calls. Attempt 1 had 24 page-spatial reference failures across
10 of 12 pages. The field-scoped repair resolved all 24, but complete
validation then exposed 21 deeper action-semantic and structural issues. The
final full-draft repair resolved all 21 and introduced only one page-3
action-binding cardinality issue. No repair remained, so the attempt stopped
as `draft_validation_repair_exhausted` without a candidate.

This proves that a spatial failure spanning most of the initial book is a
whole-draft quality signal. Spending repair 1 on isolated substitutions can
consume the only repair that would otherwise close a small residual after
whole-draft regeneration.

## Nine architectural decisions

1. **Closed broadness predicate.** A spatial-only failure is broad only on
   attempt 1, only with at least five distinct affected pages, and only when
   those pages are a strict majority of the declared book page count.
2. **Distinct-page accounting.** Duplicate targets on one page never inflate
   broadness. Invalid or out-of-range page identities are ignored by the
   predicate and remain subject to the existing fail-closed validators.
3. **Repair order only.** A broad initial spatial-only failure selects the
   existing `full_draft` lane. No new repair mode, prompt, schema, model,
   service tier, timeout, retry, fallback, or authored semantic is introduced.
4. **Compact residual preserved.** The broadness rule never applies after
   attempt 1. A later homogeneous spatial residual still uses
   `page_spatial_reference_patch`; action-binding residuals still use
   `page_contract_patch`.
5. **Small failures unchanged.** Four or fewer affected pages, an exact half,
   or a non-initial attempt retains the current compact field-scoped route.
6. **Budget unchanged.** The maximum remains one initial call plus two repairs,
   three logical provider calls, zero transport retries, no fallback, projected
   maximum `$4.884`, and hard ceiling `$5.00`.
7. **Authority compatibility.** Serialized request, receipt, readiness,
   candidate, prompt and schema shapes do not change. Historical artifacts are
   immutable and cannot authorize a new attempt; a pushed corrected HEAD and
   new Fresh Readiness remain mandatory.
8. **Regression proof.** Tests must prove the threshold boundaries, duplicate
   target handling, non-initial compact behavior, and an end-to-end sequence of
   initial broad spatial failure → `full_draft` → one action-binding residual →
   `page_contract_patch` → valid candidate within three calls.
9. **Fail-closed rollback.** Reverting the focused implementation commit
   restores the prior field-first order. No artifact rewrite or migration is
   needed; a failed or exhausted attempt still grants no candidate,
   Reconciliation, Blueprint, Wizard, or render authority.

## Expected behavior

Broad initial corruption spends the first repair on regeneration from source
authority and preserves the final call for an existing compact residual lane.
Small and late spatial errors continue to receive the cheaper exact-field
repair. The system still writes no candidate unless full validation passes.

## Validation and acceptance

- Direct threshold and duplicate-target tests pass.
- Compiler integration proves the exact three-call sequence and candidate.
- Existing compact, compound, repair-loop, lifecycle and materialization tests
  remain green.
- TypeScript and `git diff --check` pass.
- The one repository gate may retain only the six established ignored-fixture
  release failures; any seventh or infrastructure failure stops the milestone.
- Claude Code independently attempts to falsify generality, threshold edges,
  route order, unchanged budgets, and fail-closed behavior before a new live
  attempt.

## Cost, risk, and rollback

Implementation and tests cost `$0`. A later approved operational proof remains
within the existing authoring and three-LOW-page ceilings. The principal risk
is over-escalating a genuinely field-local initial defect; the five-page plus
strict-majority boundary contains that risk and leaves every later compact
route intact. Revert the focused commit to roll back.

## Explicit exclusions

No story-specific literal, prompt text, structured-output schema, model,
service tier, token ceiling, call/repair budget, timeout, retry, fallback,
candidate semantics, image generation logic, Reader, Wizard UI, payment,
storage, database, Production, or deployment change is authorized here.
