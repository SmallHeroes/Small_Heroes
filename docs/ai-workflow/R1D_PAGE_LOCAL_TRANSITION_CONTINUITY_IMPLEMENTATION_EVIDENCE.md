# R1D Page-Local Transition Continuity Routing — Implementation Evidence

**Date:** 2026-08-25
**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Correction base:** `e25ae0c0451856791c6f0f60b5c1919a2c9e8212`
**Mode:** offline implementation only; `$0`; no credential/provider/render

## Outcome

Cross-page transition-continuity failures are now reported against the exact
affected page using the existing typed identity
`draft_contract/final_structural_invariant_invalid` with cause
`page_transition_invalid`. Validation semantics and human-readable errors are
unchanged. The existing BookSurface target association can therefore grant
only that page's `transition` field, after which the existing pure
`represented_elsewhere_patch` lane may close a remaining pointer-only
frontier.

No scheduler admission predicate, repair mode, provider schema, prompt,
authoring policy, model, call/output ceiling, retry, fallback, cost ceiling,
Candidate rule, Wizard rule or render rule changed.

## Observed live behavior

The consumed Fresh root was:

`outputs/r1d-chameleon-v3-fresh-readiness-20260825T184449411Z`

Its canonical receipt was:

`b0/authoring-receipts/6b8e150474dab40242e127aa72f8b40414fd0ebdefc7b538b0e7bc27b2c5c4a1.json`

The route was:

1. initial draft: 19 complete unique issues;
2. `book_surface_patch`: 6 complete unique issues;
3. `full_draft`: 16 complete unique issues;
4. `draft_validation_repair_regressed` stopped before another dispatch.

The attempt used three provider calls, no transport retry and no fallback.
Recorded cost was `$1.143956` nominal and `$1.258362` conservative. No
Candidate was minted.

## Root cause

`validateVNextVisualContract` runs after the base contract validator. While
page action requirements were invalid, base validation returned before the
cross-page continuity state machine. The first BookSurface patch closed those
errors without transition authority. Full validation then exposed an existing
opening-page continuity violation.

The continuity state machine previously repeated every new error as one
collection locator:

`draft_contract/topology_malformed/page_contracts/transition`

That identity was too coarse for BookSurface, PageContract and the deliberately
pure represented-elsewhere route. The scheduler therefore had only the broad
`full_draft` route available. This was unmasking followed by overly broad
routing; it was not proof that BookSurface created the transition defect.

## Chosen correction

The validator retains the original page-contract array index while sorting
page entries by numeric `pageNumber`. For each page it snapshots the error
count before cross-page continuity checks, executes the unchanged state
machine, then applies the established `pageFinalStructuralIssue` helper with
cause `page_transition_invalid` to only the errors added for that page.

This was chosen over admitting mixed structural diagnostics into
`represented_elsewhere_patch`. The latter would weaken a prior pure-only
authority gate while still leaving the coarse topology surface unresolved for
other callers. Page-local attribution reuses the existing BookSurface cause to
field mapping, surrounding topology context and non-target preservation.

## Offline causal proof

The production compiler harness starts with a valid general book draft and
injects a live-shaped masked frontier:

- five represented-elsewhere pointer issues;
- six closed-catalog capability gaps;
- eight page steering failures; and
- one opening transition-continuity defect that base validation initially
  masks.

Diagnostic normalization merges the transition cause with the page-one final
structural identity in the independent complete census, so both initial
surfaced and complete counts are 19 even though their member detail differs.
After the first BookSurface repair the transition identity becomes surfaced.

The asserted route and complete census are:

`19 -> 6 -> 5 -> 0`

`initial -> book_surface_patch -> book_surface_patch -> represented_elsewhere_patch`

The harness proves:

- Candidate outcome with `providerCalls: 0`;
- complete-census deltas `-13`, `-1`, `-5` and no positive delta;
- stage one contains exactly five pointer issues plus one page-local transition
  issue;
- the second BookSurface response targets exactly one page and only
  `transition`;
- neither BookSurface response carries `actionSemanticCoverage` authority;
- the final represented route receives a pure five-issue population;
- no `full_draft` is selected.

The historical regression guard remains covered and unchanged, including its
termination before another dispatch or Candidate when a complete unique issue
census increases.

## Files

Production:

- `lib/visual-contract-compiler/validateVNextVisualContract.ts`

Tests:

- `lib/__tests__/visual-contract-vnext-ws0.spec.ts`
- `lib/__tests__/visual-contract-s2b.spec.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`

Documentation:

- `CURRENT.md`
- `docs/ai-workflow/R1D_PAGE_LOCAL_TRANSITION_CONTINUITY_DECISION_GATE.md`
- this evidence document

## Validation

- focused validator/compiler/harness matrix: **4 files, 136/136 PASS**;
- broader relevant compiler/repair matrix: **33 files, 774/774 PASS**;
- `npx --no-install tsc --noEmit`: exit 0;
- `git diff --check`: exit 0;
- full `npm run check`:
  - ordinary: **3,722 PASS**, 70 skipped;
  - resource-intensive: **613/613 PASS**;
  - reproduced only nine missing ignored-output fixture assertions in five
    unchanged test files;
  - reproduced the three known Vitest worker `onTaskUpdate` RPC timeouts;
  - no changed-code assertion failed.

The first attempt to launch the broader dynamic file list through `npx`
failed before tests because npm could not determine an executable. The same
exact list was then run through the repository-local Vitest executable and
passed 774/774. npm wrote only its ordinary external debug log under the user
npm cache; no repository file was created or changed by that launcher failure.

## Preservation and boundaries

No Story Source, accepted Visual Directions, Blueprint, Visual Package, Board,
current locator, package approval, Wizard UI, order, payment, database,
storage, deployment or generated output was modified. No credential was read
and no provider, image, audio, Fresh, live or render operation ran during this
implementation milestone. The prior live root and receipt remain immutable.

## Rollback

Revert the focused correction commit. No data migration or artifact rewrite is
required because only newly computed diagnostic attribution changes.

## Independent review gate

Claude Code must review the exact correction-base-to-head range read-only and
attempt to falsify:

- preservation of every transition validation rule and error message;
- correct page attribution under sorted and out-of-order page arrays;
- absence of duplicate or cross-page diagnostic leakage;
- exact BookSurface transition-only authority;
- purity of `represented_elsewhere_patch`;
- masking/unmasking realism and the `19 -> 6 -> 5 -> 0` census;
- complete-census regression and stagnation behavior;
- unchanged schemas, prompts, policies, budgets and provider boundaries; and
- absence of story-, child-, companion- or page-specific production literals.

No Fresh Readiness, provider call or render is allowed before independent PASS
and an exact push of the reviewed head.
