# R1D Set Board Ambient Dressing — Decision Gate

**Date:** 2026-08-20

**Owner:** Guy (product acceptance) / Codex (technical implementation)

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`
**Base:** `a346e652ccc66597129a259773756c9510cf16d6`

## 1. Proposed change

Add a versioned, structured ambient-dressing policy to every projected Set Definition. The policy authorizes only
spoiler-neutral, non-narrative visual dressing appropriate to the already-declared physical set, while the existing
locations, openings, geometry, fixed recurring props, blocked cast, and blocked/page-conditioned props remain exact.

The board prompt will distinguish three layers:

1. exact set geometry and built-in furnishings;
2. exact recurring fixed-set facts;
3. bounded ambient dressing selected from a closed category list and locked by the eventual human-approved board
   asset SHA.

Vision QA will treat clearly inanimate toys/dolls as decor rather than living characters, and it will fail a board
that is materially sparse or generic instead of visually dressed as a lived-in space.

## 2. Why now?

The first real Chameleon home Board passed technical QA but failed Guy's visual/product review. It depicts only a bed,
bedside table, window, and floor, reading as a guest room or rental rather than a child's bedroom. This blocks the
new-story Wizard proof before Town Board minting, Visual Package assembly, or page rendering.

The image provider did not ignore the contract. The current `SetDefinition` projected exactly four geometry nodes,
no fixed set facts, and a prompt rule saying only declared fixed objects belong. The system therefore authorized a
sparse room and had no automated product-quality gate for set personality.

## 3. Scope

This is a general Set Identity Board policy/prompt/QA change. It is not a Chameleon-, bedroom-, page-, or child-name
special case. It applies to every future board and lets the image model select only space-appropriate ambient detail
inside a closed, versioned policy.

The immutable Chameleon Candidate, reconciliation, Blueprint, story source, page contracts, and action semantics do
not change.

## 4. Risk of hardcoding

The implementation must not branch on `chameleon_koko_bedtime`, `set_child_home_night`, a child name, or a literal
page number. Bedroom-oriented examples may appear only as a generic conditional example within a closed ambient
policy; non-bedroom sets must select only categories appropriate to their declared geometry.

The exact ambient objects are not story facts. The approved Set Board bytes become their visual identity for all
downstream pages, while the contract continues to own story props and hard spatial topology.

## 5. Files likely affected

- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/setDefinition.ts`
- `lib/set-identity-board/boardPrompt.ts`
- `lib/set-identity-board/boardQa.ts`
- `lib/set-identity-board/positiveAuthoritySpoilerGuard.ts`
- `scripts/mint-set-identity-board.ts`
- focused Set Board / Visual Package tests and fixtures
- `CURRENT.md`

No Visual Contract authoring schema/prompt, Candidate, Blueprint, Wizard UI, page renderer, model, quality, retry, or
cost policy is expected to change.

## 6. Expected behavior after change

- The same Chameleon home contract projects a new board/content-policy identity.
- The positive prompt still requires the exact bed/table/window/floor geometry and exact opening topology.
- It additionally requires a rich, lived-in layer of generic, inanimate, text-free, spoiler-neutral ambient dressing.
- For sleeping-room geometry, the prompt prioritizes a fixed night light, picture books without readable text, a
  rug, toy storage/blocks, a clearly inanimate cloth doll, storage, and non-text wall decoration.
- The prompt may not mention or authorize any blocked cast identity, recurring prop, page-conditioned prop, action,
  portable light, or story event.
- QA does not misclassify a clearly manufactured inert toy/doll as a living person/animal/character.
- QA flags a materially sparse or generic board as `ambient-dressing-too-sparse`.
- A freshly minted replacement remains unapproved until Guy accepts its exact bytes.

## 7. Validation plan

Provider-free first:

1. exact policy shape/version/hash tests;
2. prompt tests for density, closed categories, conditional sleeping-space priorities, and unchanged hard geometry;
3. spoiler/cast/blocked-prop leak tests;
4. QA tests for sparse-board classification instructions and the inanimate-toy distinction;
5. registry/version invalidation and Visual Package unresolved-board behavior;
6. focused Set Board + Visual Package suites, `npx tsc --noEmit`, `git diff --check`, and one literal `npm run check`;
7. independent Claude Code adversarial review and re-gate.

Only after PASS and push: mint one replacement Chameleon home Board at `gpt-image-2` LOW, run its ordinary same-byte
Vision QA, inspect the exact PNG, and stop for Guy's visual approval. Town remains unminted until the home board passes.

## 8. Cost impact

Implementation and tests cost $0. The next external allowance is exactly one replacement Home Board LOW generation
plus its ordinary Vision QA after independent QA PASS. No retry or second replacement is implied.

## 9. Rollback plan

Revert the focused implementation commit. Older v4 Board/Registry artifacts remain immutable and are rejected by the
new current-version identity; no approved production board or Candidate is overwritten. The currently rejected Home
Board remains recoverable by its content-addressed storage key and local PNG.

## 10. Review assignment

Guy has already supplied the product direction: the current room is rejected; a child's room needs toys/dolls, a
night light, richer detail, and distinct personality.

Claude Code should try to falsify:

- ambient policy is genuinely general and version/hash-bound;
- blocked story props/cast/action cannot leak through the new positive section;
- outdoor/non-bedroom sets are not forced to contain bedroom objects;
- exact geometry/opening/fixed-prop authority remains unchanged;
- inanimate-toy QA wording cannot excuse a living character;
- sparse-board QA cannot auto-pass a hotel-like room;
- old v4 entries cannot satisfy the new current identity;
- no provider/render/approval authority is broadened.

## 11. Do not do

- Do not approve the existing sparse Home Board.
- Do not edit the immutable Candidate, reconciliation, Blueprint, or Story Source.
- Do not hardcode the Chameleon story/set/page.
- Do not weaken cast, animal, action, text, opening, excluded-prop, or human-approval gates.
- Do not mint the Town Board or render any page/book in this milestone.
- Do not run another image before offline green + Claude Code PASS + push.
