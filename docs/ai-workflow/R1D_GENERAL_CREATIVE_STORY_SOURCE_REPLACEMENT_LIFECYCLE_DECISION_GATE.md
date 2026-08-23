# R1D General Creative Story Source Replacement Lifecycle — Decision Gate

**Date:** 2026-08-23

**Status:** APPROVED BY GUY; zero-cost implementation authorized

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Add a general immutable lifecycle for a product-accepted Story Source creative
replacement whose story text is approved but whose new visual directions do
not exist yet. The lifecycle binds one slot, its exact predecessor revision,
one Creative Brief, one canonical gender-flexible story, one passing Editorial
Review and Guy's exact product acceptance into a content-addressed revision.

The first use is `chameleon_koko_bedtime`, using Story Revision
`b18e824c96bf43a3d3f5b9dfe6457b2ad8a19112b73e89fcfbb55417a02afd09`
and Editorial Review
`bd1bf219cd3e0361a2875a00604ae9ac8e66fe69694ee96fa8d1064c8cc4fce6`.

## 2. Why now?

The current revision lifecycle is intentionally specialized to an exact
`female` to `neutral` metadata correction while preserving the previous prose
and visual directions. A full creative rewrite cannot truthfully use it: doing
so would either reject the changed story or attach the old bus-stop visual
directions to the new kindergarten story.

This missing intermediate authority blocks the safe route from accepted story
text to new visual directions, package, Wizard and later render.

## 3. Scope

- General system change plus the first immutable Chameleon replacement data.
- New revision authority is `story_text_only`.
- The previous accepted revision remains immutable and remains the Wizard's
  frozen runtime source until later visual authority is complete.
- No catalog relabel, package move, Wizard change or render.

## 4. Risk of hardcoding

Production code must not mention Bar, Kim, kindergarten, lantern, a page number
or the Chameleon story key. All identity comes from validated request data and
content-addressed artifacts. Story-specific facts live only in the first data
instance.

## 5. Files likely affected

- `scripts/story-source-creative-replacement-lifecycle.cjs`
- `lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts`
- one new immutable revision below
  `story-pipeline/04_approved_story_sources/accepted/<storyKey>/revisions/`
- `CURRENT.md` and implementation evidence

The specialized v2 gender-correction materializer/lifecycle, accepted
predecessor, live catalog, historical review corpus, Visual Package locator and
four untracked Board artifacts are preservation surfaces.

## 6. Expected behavior after change

- Preview validates and derives the exact revision without writing.
- Publish atomically creates one complete immutable revision directory.
- Identical replay is a no-op; different bytes at the same identity fail.
- A second replacement cannot fork from a predecessor that already has a
  different accepted creative successor.
- The manifest explicitly says runtime-ineligible because visual directions
  are pending. It contains no `integrated.md` and cannot be selected by the
  current accepted-revision runtime path.
- Both boy and girl projections are complete and deterministic.

## 7. Validation plan

- Hermetic preview, publish, replay, collision, stale-predecessor and hostile
  input/path tests.
- Validate exact Brief/story/Editorial Review bindings and both gender
  projections.
- Materialize the approved Chameleon replacement locally and prove all prior
  accepted/package/locator/Board bytes are unchanged.
- Run the focused suites, `npx --no-install tsc --noEmit`, `git diff --check`
  and the repository check contract.
- Give Guy a digest-bound Claude Code adversarial QA brief.

## 8. Cost impact

`$0`. No provider, image, audio, Vision, network, database, storage or render
operation is authorized.

## 9. Rollback plan

Revert the focused commit. The new revision is additive and no current runtime
locator moves, so the prior Wizard behavior remains intact throughout.

## 10. Review assignment

Guy has approved the exact story and Editorial Review and authorized this
general creative replacement route. Claude Code must independently falsify
the path/byte authority, predecessor and fork protection, gender projections,
atomicity, replay/collision behavior, runtime ineligibility and preservation
claims. Codex does not self-award that PASS.

## 11. Do not do

- Do not alter or delete predecessor revision `20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb`.
- Do not copy its visual directions into the new story.
- Do not create `integrated.md`, a Visual Contract, Blueprint or Visual
  Package for the replacement in this milestone.
- Do not move any current locator or enable the replacement in the Wizard.
- Do not call a provider, render, deploy, touch remote state or spend money.
