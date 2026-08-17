# R1D Book-Surface Admission Compact Fallback — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation green; independent Claude Code technical QA pending; unpushed; no new Fresh Readiness, provider, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-book-surface-admission-compact-fallback`
- Exact pushed base: `e983eaaaf92dbc2fc8b8ec88aea6428b803879ab`
- Decision Gate commit: `9cc59d60b841f9b84293723658ff8e2e1d4d1b28`
- Implementation commit: `a7ee6422029f605140e3efa64f9510b8e14a6df0`
- Production: untouched
- Implementation/test provider cost: `$0`

## Consumed live evidence

The predecessor attempt is immutable and will not be retried:

`C:\GNart\Work\sh-wt-r1d-output-budget\outputs\r1d-post-causal-compact-readiness-e983eaaa-20260817T125438642Z`

Its key artifacts are:

- canonical pre-live readiness v26: `35c37b61144b50885557206a4705afbdd4c85a55c0fff88a7e109003ffd438b7`
- canonical Execution Request v26: `7c0635378addce272f5a3a7bb2c7178dc27576f9a4aba833fac696ebffa787ed`
- authoring request v29: `405846c3f8e821753a4d29b990b5458e4a3fa6b935d875245dade38348503508`
- authoring receipt v32: `a64f7144e8caa38b085653b827cd22a04ec65632818904e006e4c3fd88bf1f0b`
- readiness v30: `5a13ca00bc2b7b9e93b5e960c14d4e62abd18b7cf676dbac6b5442cceff141d5`
- source snapshot: `f8ac1292d5e225a8ff90c462416a44fe61f89b2c47f1529a1e43dd8025f1a079`

The attempt completed three logical provider calls and consumed two repairs,
with zero transport retries and no fallback. Aggregate usage was 26,736 input,
26,460 cache-write input, 52,593 output, 6,128 reasoning and 79,329 total
tokens. Nominal cost was `$1.744545`; conservative accounting was `$1.919380`;
the projected maximum remained `$4.99125` under the frozen `$5` ceiling.

Attempt 1 produced 25 unique current issues: eleven exact
`closed_catalog_capability_gap` presentation failures, cover projection, all
twelve page final-structure failures, and recurring-props lifecycle. Routing
selected `full_draft`. That repair resolved those 25 issues but introduced one
`out_of_scope_reference`, so the final bounded call correctly selected
`page_spatial_reference_patch`. It repaired only that spatial target; full
validation then exposed twenty latent presentation and structural failures.
The standard three-call/two-repair budget was exhausted.

Receipt status is `failed` with
`draft_validation_repair_exhausted / draft_validation_budget_exhausted`.
Supervisor v19 recorded `child_failed / child_nonzero_exit`, exit `1`, and null
output authority. Candidate, reconciliation, Blueprint, Wizard and render
authority are absent.

## Root cause

The compiler's mixed Presentation Structural catch already produced the exact
presentation targets and a semantically valid combined Book Surface authority.
It then unconditionally cleared the standalone presentation targets.

Later, provider admission correctly rejected the combined Book Surface prompt
when it exceeded the immutable input ceiling. The compiler cleared that
authority too. Because the exact presentation targets had already been
discarded, routing fell through to destructive `full_draft`.

The historical receipt does not persist the rejected combined prompt's byte
count, so that branch cannot be byte-proved from the consumed artifact alone.
The deterministic live-shaped regression reproduces the same typed family and
proves the combined request is rejected while the split requests are admitted.

## Implementation

The compiler now temporarily preserves the exact presentation targets only
after it has successfully constructed a valid combined Book Surface authority.

An admissible combined `book_surface_patch` remains the first choice and is
unchanged. If that combined request fails the existing admission predicate, the
compiler rebuilds the existing presentation-repair prompt and checks it
independently with the existing schema and input ceiling. Only when that compact
request is admissible are the preserved targets restored, allowing the existing
router to select `presentation_requirement_patch`.

Full compilation and validation then run again. If the residual family is the
existing closed pure structural surface, the existing `book_surface_patch`
route handles it. Unsafe or absent combined authority, or an independently
oversized presentation request, retains the existing conservative
`full_draft` behavior.

No fourth standard call is added. The successful split remains:

`initial -> presentation_requirement_patch -> book_surface_patch -> candidate`

within the unchanged standard `3 / 2 / 0` call/repair/retry budget and
`[40,000, 32,000, 36,000]` output schedule. The pre-existing optional terminal
reference-only cleanup allowance remains unchanged and is not broadened.

## Regression contract

The compiler regression proves a deterministic twelve-page admission window:

- 2,500 unique padding characters per page make the combined Book Surface request inadmissible while both split requests fit;
- routing is exactly `[initial, presentation_requirement_patch, book_surface_patch]`;
- completion occurs in three calls/two repairs with unchanged output caps;
- the second repair contains no presentation target;
- the candidate is produced on attempt 3.

A negative with 6,000 unique padding characters per page proves that an
oversized compact presentation request retains `full_draft`.

The lifecycle regression adds 14,000 unique padding characters only to pages 4,
9 and 10 of the live-shaped twelve-page fixture. It proves a completed receipt,
candidate digest, exact repair modes and schemas, all twelve structural pages,
unchanged input, and independently admitted repair prompts with at least the
required margin below the 64K ceiling.

## Validation

- Affected and adjacent focused set: **4 files / 151 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Internal read-only adversarial audit: PASS, zero BLOCKER/MAJOR/MINOR.
- One literal `npm run check` ran exactly once and was not retried:
  - TypeScript and autonomous-story typecheck completed before Vitest.
  - The timestamped Vitest cache at `2026-08-17T16:40:13.8529477+03:00` records all **302 canonical files**.
  - Its only failed files are the four established missing-output fixtures; all twenty unchanged resource-intensive files are green.
  - The preceding exact baseline was 3,230 passed / 65 skipped / 5 failed, and this range adds exactly two passing ordinary tests.
  - A focused follow-up of those four fixture files confirmed exactly **5 failed / 7 passed** assertions, all missing ignored-output artifacts.
  - The supervising console stream was not retained across automatic thread compaction, so this evidence does not claim a newly preserved diagnostic-protocol payload for the literal run.

The established fixture assertions remain a separate repository/release HOLD
in `child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa`, and two
`story-read-back-validation` cases. They are not waived.

## Unchanged boundaries and version rationale

No story-, child-, companion-, page-, phrase- or provider-response-specific
literal participates in production routing.

Model, provider, endpoint, service tier, reasoning, timeout, retry/fallback,
input ceiling, output schedule, standard call/repair budget, optional terminal
reference cleanup, `$5` fence, candidate semantics, prompt text, JSON schemas
and authority shapes are unchanged.

No persisted envelope shape or policy contract changed, so no version bump or
migration is warranted. The correction selects between existing typed routes
using the existing admission predicate. Exact Git HEAD plus brand-new Fresh
Readiness provide the execution cutover. Existing receipts persist every
dispatched repair mode and its input accounting. Persisting diagnostics for
rejected, undispatched candidate routes remains a future observability
advisory, not part of this routing correction.

Historical artifacts remain immutable and readable.

After the consumed predecessor attempt, implementation made no credential,
network/provider, Fresh Readiness, preflight, live-authoring, image/Vision,
render, storage/database, deployment, production or push action.

## Rollback

Revert `a7ee6422029f605140e3efa64f9510b8e14a6df0` and its documentation
closeout. No artifact rewrite, data migration, storage/database cleanup or
production rollback is required.

## Independent QA

Claude Code review is pending against the immutable implementation range
`e983eaaaf92dbc2fc8b8ec88aea6428b803879ab..<QA_HEAD>`.

The review must falsify the combined-route precedence, exact fallback
predicate, compact-prompt admission check, full revalidation, pure structural
follow-up, oversized negative, unchanged budget/prompt/schema/version surfaces,
input immutability and absence of a fourth standard call.

Until Claude Code returns technical PASS, this milestone grants no push, Fresh
Readiness, provider, candidate, Wizard, render, deployment or production
authority.
