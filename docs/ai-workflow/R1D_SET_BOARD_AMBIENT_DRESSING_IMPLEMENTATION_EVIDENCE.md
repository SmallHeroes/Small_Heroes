# R1D Set Board Ambient Dressing — Implementation Evidence

**Date:** 2026-08-20

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Base:** `a346e652ccc66597129a259773756c9510cf16d6`
**Decision Gate:** `R1D_SET_BOARD_AMBIENT_DRESSING_DECISION_GATE.md`

## Outcome

The first LOW Chameleon home Board remains rejected and unapproved. Its sparse
guest-room appearance was the expected consequence of a Set Definition that
authorized only exact geometry/fixed story props and a prompt that excluded
all other objects. The correction adds a bounded, versioned ambient-dressing
layer so a set can be visually rich without inventing story facts.

No replacement image was generated in this milestone. The exact Chameleon
home contract now produces a current v5 dry preview whose prompt requires at
least four distinct, space-appropriate ambient details and, for sleeping-room
geometry, prioritizes a night light, unreadable-cover picture books, a soft
furnishing, toy storage/blocks, an inert cloth doll and non-text wall decor.

## Production changes

1. `SetBoardContentPolicy` carries a canonical
   `set-board-ambient-dressing/v1` policy. It is a closed nine-category range
   with density `rich_lived_in`, minimum four distinct details, and explicit
   inanimate/text-free/spoiler-neutral constraints.
2. Prompt and Vision projections validate the exact canonical policy before
   producing provider text. They filter every ambient label through the same
   structured blocked-cast/action/recurring-prop vocabulary guard already used
   for direct positive authority. Fewer than four safe categories fails before
   provider reachability.
3. The image prompt distinguishes exact set geometry, exact recurring fixed
   story props, and bounded non-narrative ambient dressing. Ambient detail may
   not create a new opening, imitate a blocked/page-conditioned prop, or alter
   authored geometry.
4. Vision QA distinguishes a clearly manufactured inert toy/doll from a living
   character, while still flagging it if it is alive, acting or posing. It also
   fails a materially sparse, hotel-like room as
   `ambient-dressing-too-sparse`.
5. Board, Registry and content-policy identities advance to `set-board/v5`,
   `set-registry/v5` and `set-board-content/v4`. The ordinary Vision
   instruction advances to `set-board-qa-instruction/v2`. Immediate v4
   Board/Registry evidence cannot satisfy current authority.

## Provider-free Chameleon proof

The exact command ran without `--render`, so render, upload, Vision and spend
were unreachable:

```powershell
node scripts/mint-set-identity-board.cjs `
  --story chameleon_koko_bedtime `
  --identity set_child_home_night `
  --style soft_hand_drawn_storybook `
  --contract outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/candidate-template-projections/4e945dc0aeec47f21339cc780cfa6d86d87055f60a75685e8f1a25ab7b35cf31.json `
  --out outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/set-board-previews/set_child_home_night.v5.json
```

Result:

- Registry `set-registry/v5`
- Board `set-board/v5`
- Set Definition hash
  `8ab05aa8518b40d483e128184ae772da8b80b73c47b2c5a9edf82d6623046f0d`
- Content-policy digest
  `26d37114006e132cbf54ffac599d47fabfd3bb142923f126a07ec27383de3fb8`
- Prompt hash
  `b6888865317b6014a3a903a8bb839c4c5a7d94855fcc48eaf21561d3f9f711c4`
- Model/quality `(unrendered)` and QA `pending`

The inspected positive prompt contains the bounded ambient section and the
sleeping-room priorities. `Backpack`, `Neighborhood cat`, `Flashlight`, `Last
bus`, `Striped sock` and `Walking bus stop` remain exclusively in negative
authority and are explicitly forbidden.

## Test evidence

- Entire Set Board suite: **13 files / 327 tests PASS**.
- Focused Set Board + Visual Package seam: **8 files / 176 tests PASS**.
- `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- One final literal `npm run check`:
  - TypeScript — PASS.
  - Autonomous Story typecheck — PASS.
  - ordinary: **3,367 tests PASS**, 65 skipped;
  - resource-intensive: **20 files / 610 tests PASS**;
  - overall exit remains nonzero only for the same five unchanged tests whose
    ignored historical `outputs/` fixtures are absent from this worktree:
    `momentum-gate-koko`, `page-entity-qa`, two
    `story-read-back-validation` cases and `child-lexicon-ages-5-8`.

## Runtime evidence and exclusions

No provider, image, Vision, upload, database, approval, Town Board, Wizard
promotion, page render, full-book render, deployment or production action
occurred. The old v4 Home Registry/QA receipt and its exact sparse PNG remain
recoverable and unapproved; they are not rewritten or staged.

After a focused commit, independent Claude Code PASS and push, the only next
external action is one canonical replacement Home Board at `gpt-image-2` LOW
plus its ordinary Vision QA. The exact resulting PNG then stops for Guy's
visual/product decision. Town Board and page/book rendering remain out of
scope until that approval.
