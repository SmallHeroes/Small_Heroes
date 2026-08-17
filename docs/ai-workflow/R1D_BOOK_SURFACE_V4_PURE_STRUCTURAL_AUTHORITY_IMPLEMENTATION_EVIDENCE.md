# R1D Book Surface v4 Pure-Structural Authority — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation and repository validation complete; independent Claude Code QA pending; unpushed; no Fresh Readiness, provider, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-book-surface-v4-pure-structural-authority`
- Exact pushed and independently passed base: `c8e2770c2f26044643a57cfb313cf061b9c433ca`
- Implementation commit: this focused local commit; exact hash is supplied in the immutable QA handoff
- Production: untouched
- Implementation and test provider cost: `$0`

## Consumed evidence

The immutable consumed attempt is:

`C:\GNart\Work\sh-wt-r1d-output-budget\outputs\r1d-post-book-surface-v4-readiness-c8e2770c-20260817T173858109Z`

Its authoring receipt v33 is
`d5accaa23b9bd4fcf0d3958dabdc7e79e950d83e9ea79f11441436c1a87e2892`.
All three provider calls completed, two repairs were consumed, transport
retries were zero and fallback was false. Exact nominal/conservative cost was
`$1.921346 / $2.113494`.

The route was:

`initial -> book_surface_patch -> page_contract_patch`

Current unique issues progressed `15 -> 12 -> 48`. The first Book Surface v4
repair resolved exactly the cover projection, recurring-prop lifecycle and the
page-four presentation gap. Twelve page final-structure identities remained.
The final Page Contract repair resolved those twelve but introduced forty-eight
action-binding cardinality identities across pages four through twelve. The
receipt ended in bounded draft-validation exhaustion. Supervisor v20 correctly
recorded child failure and null output authority. Candidate, reconciliation,
Blueprint, Wizard and render authority are absent.

## Root cause

Book Surface v4 deliberately supports nullable cover and recurring-prop
authority. Its strict output schema, compact prompt and atomic applier already
accept `coverContract: null` and preserve the existing cover in that case.

The canonical authority builder retained one pre-v4 eligibility condition:
it required both a cover issue and at least one page issue. After the first
Book Surface repair fixed the cover, the exact pure page-structural residual
therefore returned no Book Surface authority. The compiler selected the wider
Page Contract route, which is allowed to replace complete page contracts and
created the observed action/coverage cardinality failures.

This is a selector mismatch inside the approved v4 contract, not a provider,
transport, input-ceiling, model or computer failure.

## Implementation

`bookSurfaceRepairAuthority` now requires page structural issues but treats the
cover as conditional:

- when a cover issue exists, the prior exact-key cover validation and nonempty
  cover-hint requirements remain unchanged;
- when no cover issue exists, cover authority is exactly `null` and cover hints
  are exactly empty; and
- inconsistent cover object/hint combinations remain rejected.

The returned authority clones a cover only when one is authorized. The v4
prompt emits `coverAuthority: null`, and the existing atomic applier requires a
null cover patch and proves that the draft cover is unchanged.

All existing page, reference, recurring-prop, presentation, source-draft,
admission, ordering and non-target guards remain active. Page structural
projections still exclude `actionSemanticCoverage`. Full compilation and every
validator rerun after each repair.

No Book Surface schema, system prompt, user prompt, model, service tier,
reasoning, authoring policy, persisted version, standard call/repair budget,
output schedule, timeout, retry, fallback, candidate contract or `$5` fence
changed. No migration or historical artifact rewrite is required.

## Regression contract

The focused tests prove:

- a pure page-structural authority is constructible with null cover, empty cover
  hints and empty presentation targets;
- its prompt carries `coverAuthority: null` and no action-semantic coverage;
- a null-cover patch repairs only the exact page structure while preserving the
  cover, input draft and action coverage;
- cover-present authority retains its prior strict guards;
- compiler routing selects `book_surface_patch`, not `page_contract_patch`, for
  a pure page final-structure failure;
- provider attempts to smuggle action-semantic changes through the structural
  patch are excluded and the original coverage remains exact;
- the live-shaped twelve-page route is exactly `initial -> book_surface_patch
  -> book_surface_patch -> candidate`;
- calls/repairs remain `3 / 2`, output caps remain `[40000, 32000, 36000]`, and
  the second Book Surface request carries null cover, null recurring props, no
  presentation targets and pages one through twelve only;
- the post-first-repair residual is exactly twelve
  `final_structural_invariant_invalid` identities, no action-binding
  cardinality identity is introduced, and the final attempt has zero current
  issues; and
- the existing hard input-ceiling and final-slot route-admission paths remain
  fail-closed and preserve sanitized accounting.

## Validation

- Complete focused set: **3 files / 145 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Internal read-only adversarial review: 0 BLOCKER / 0 MAJOR.
- One literal `npm run check`, exactly once and without retry:
  - TypeScript and autonomous-story typecheck: PASS;
  - ordinary: **262 files passed / 16 skipped / 4 failed**;
  - ordinary assertions: **3,236 passed / 65 skipped / 5 failed**;
  - resource-intensive: **20 files / 599 tests PASS**; and
  - both diagnostic protocols valid; no timeout, RPC/IPC, reporter, launch,
    signal, teardown or other infrastructure failure.

The five ordinary failures are the established missing ignored-output fixture
HOLD only:

- `child-lexicon-ages-5-8.spec.ts` — one missing story fixture;
- `momentum-gate-koko.spec.ts` — one missing page-beats fixture;
- `page-entity-qa.spec.ts` — one missing PNG fixture; and
- `story-read-back-validation.spec.ts` — two missing story fixtures.

Those files are unchanged and the release HOLD is not waived.

## Independent QA

Pending. Claude Code must review the exact immutable base-to-head range and try
to falsify nullable-cover eligibility, cover-present strictness, null-cover
immutability, action-coverage exclusion, non-target preservation, route
selection, three-call/two-repair lifecycle, exact residual diagnostics,
input-admission behavior and the unchanged authority/version/budget surface.
Codex does not self-award technical PASS.

## Boundaries and rollback

No credential, network, provider, Fresh Readiness, preflight, live authoring,
image, Vision, render, storage/database, deployment, production or push action
occurred during implementation and validation.

Rollback is a focused revert of the implementation commit and its documentation
closeout. Historical artifacts need no migration or rewrite. Any later paid
boundary requires independent technical PASS, a pushed reviewed head and new
Fresh Readiness authority.
