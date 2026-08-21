# R1D Visual Time-of-Day Authority Closure — Decision Gate

**Status:** approved by Guy; provider-free rebuild lifecycle independently PASSed; exact-content reconciliation pending Guy approval
**Date:** 2026-08-21
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Rebuild lifecycle base:** `f810fa5a6f2e2d9d68d46c92491b690ee42c2db6`

Guy approved this Decision Gate on 2026-08-21 with: “מאשר את Decision
Gate לסגירת time-of-day ולהרכבה מחדש.” The approval covers the closed
five-value contract, deterministic rebuild, and the later one-page LOW proof
only after code QA and fresh immutable approvals. It does not itself authorize
a provider call, publication, locator mutation, or full-book render.

## 1. Proposed change

Close `location.timeOfDay` and `coverContract.timeOfDay` to the existing runtime
domain `day | night | dusk | dawn | mixed` at the Visual Contract authoring
boundary. Future structured drafts must emit only that domain. A shared,
deterministic canonicalizer may migrate already-authored prose before a new
immutable authority is minted:

- exact enum values remain byte-equivalent;
- one unambiguous cue maps to its enum (`night`, `day`, `dusk`, or `dawn`);
- `evening` is a dusk cue;
- cues from more than one time family map to `mixed`;
- blank, absent, or unmappable prose is not guessed and fails the
  render-qualified authority gate.

The same milestone also makes Visual Package qualification at least as strict
as finalization for world authority, so a candidate cannot be reported
`readyForPublication=true` when finalization will reject it.

For Chameleon, create a new offline, content-addressed authority chain from the
existing approved source and coverage authority. Do not mutate or reinterpret
the current Visual Contract, Blueprint, package candidate, review, or approvals.

## 2. Why now?

The exact approved Chameleon Visual Package candidate
`c3e28ae1c22ab2bfcea53dddd0e802b71d97b4adbaf6a395313a1a6445df4e82`
passed `qualify-v4` with no reasons, but finalization rejected cover and pages
1–7. All eight frames share `loc_town`; its `environmentClass` and `lighting`
are valid, while its `timeOfDay` is the open prose `evening into night`.
Runtime accepts only the closed enum. Page 8 uses exact `night` and passes.

No publication, locator change, provider call, render, storage/database action,
deployment, or release occurred. The defect was caught before mutation.

## 3. Scope

This is a general system correction, not a Chameleon, page, child, companion,
or Board patch. It affects:

1. Visual Contract time-of-day typing/schema/prompt and deterministic
   normalization;
2. Visual Package qualification/finalization parity;
3. one offline migration/rebuild of the current Chameleon QA authority chain.

The five-value runtime domain, model, provider, budgets, retries, fallback,
style, Board assets, story text, action semantics, text layout, and renderer
remain unchanged.

## 4. Risk of hardcoding

The correction must not add `evening into night` as a runtime alias or special
case Chameleon. Cue classification is shared and closed. Ambiguous multi-family
phrases become `mixed`; unknown prose fails closed. Existing exact values never
change.

## 5. Files likely affected

- `lib/story-time-of-day.ts`
- `lib/visual-contract-compiler/types.ts`
- `lib/visual-contract-compiler/templateDraftSchema.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/setBoardStableAuthority.ts`
- `lib/visual-package/visualPackageV4Lifecycle.ts`
- relevant compiler, lifecycle, runtime, compatibility, and version tests
- dependent current authoring authority versions/digests required by the schema
  and prompt cutover
- `CURRENT.md` and implementation evidence
- ignored, content-addressed Chameleon migration artifacts only after code QA

Exact downstream version scope must be derived from current call sites and
tests before editing; prior versions remain immutable legacy authority.

## 6. Expected behavior after change

- Provider drafts cannot author arbitrary time prose in the closed field.
- Deterministic migration turns Chameleon's town span into `mixed` because it
  contains dusk/evening and night phases; exact per-page lighting prose remains
  available to the renderer.
- Cover `evening` becomes `dusk`.
- Home remains exact `night`.
- Unknown time prose is rejected before approval, never silently defaulted.
- Qualification reports world-authority reasons before Guy package approval.
- If qualification says publication-ready, finalization succeeds on the same
  immutable inputs.
- Old digests and approvals remain historical and cannot authorize the rebuilt
  chain.

## 7. Validation plan

Minimum offline proof before any paid image:

1. exhaustive canonicalizer tests for all five exact values, single-family
   prose, evening/dusk, multi-family `mixed`, Hebrew night cues, blank and
   unmappable input;
2. schema/prompt compatibility and exact-version tests;
3. compiler proof that no emitted referenced location carries prose time;
4. qualify/finalize parity regression using the historical
   `evening into night` trajectory;
5. runtime world-authority and Blueprint projection tests;
6. focused suites, `npx tsc --noEmit`, `npm run check`, and `git diff --check`;
7. independent Claude Code review and re-gate;
8. offline rebuilt Chameleon template → Blueprint → Visual Package, with new
   exact Guy approvals and no reuse of old approvals;
9. only after full local qualification, one Wizard-connected
   `gpt-image-2` LOW portrait-page proof. Full-book render remains a later
   explicit product/visual decision after the page is inspected.

## 8. Cost impact

Implementation, migration, and all authority validation cost `$0` externally.
The first paid action is one LOW page image only after every offline gate passes.
No authoring provider call is planned for the migration.

## 9. Rollback plan

Revert the focused code commits and do not move the mutable package locator.
All old content-addressed artifacts remain unchanged. New unapproved migration
artifacts can remain ignored evidence; they cannot become runtime authority
without their exact approval and locator publication.

## 10. Review assignment

Guy must approve:

- the closed five-value contract;
- `evening` → `dusk`;
- multiple distinct time families → `mixed`;
- a fresh approval chain after deterministic migration;
- one LOW page proof after local qualification.

Claude Code must falsify:

- cue ambiguity/defaulting;
- schema/prompt/version drift;
- qualification weaker than finalization;
- in-place mutation or stale approval reuse;
- runtime enum widening;
- any provider/render/network effect before the LOW proof gate.

No Claude Cowork creative review is required for the contract fix. Guy will
inspect the eventual LOW page for product and visual acceptance.

## 11. Do not do

- Do not widen runtime to arbitrary prose.
- Do not add a one-literal Chameleon alias.
- Do not canonicalize only at render time.
- Do not mutate an approved artifact in place.
- Do not reuse Blueprint or package approvals after a digest change.
- Do not call the authoring provider for this deterministic migration.
- Do not publish, update the current locator, render, deploy, or release before
  the corresponding gates pass.

## Stop-check

1. **General fix?** Yes.
2. **Cross-story risk?** Bounded by closed cue tests and fail-closed unknowns.
3. **Production behavior?** Yes: authoring authority and qualification become
   stricter; runtime enum semantics do not change.
4. **Spend?** `$0` until one separately gated LOW page.
5. **Smallest proof?** Offline parity suite, then one LOW page.
6. **Guy decision?** The mapping policy and rebuild authorization above.
7. **Claude target?** Authority closure, parity, immutability, versioning.
8. **Cowork needed?** No.
9. **Guy eyeball?** The first LOW page before any full-book render.
