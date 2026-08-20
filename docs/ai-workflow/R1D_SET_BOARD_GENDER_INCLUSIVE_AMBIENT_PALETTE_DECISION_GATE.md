# R1D Set Board Gender-Inclusive Ambient Palette — Decision Gate

**Date:** 2026-08-21

**Owner:** Guy (product acceptance) / Codex (technical implementation)

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `ddc85b2ad4c752bc163427a4bca880d516bc4e4f`

## 1. Product decision

Guy accepted the richer child-room composition of the first v5 Chameleon Home Board but rejected its combined
gender cue: a large coral-pink blanket together with a cloth doll in pink clothing. A small pink accent remains
allowed. Large soft furnishings, bedding, and toy clothing should instead use a balanced child-friendly palette,
with muted sage, teal, violet, ochre, and natural linen as preferred examples.

## 2. Observed and expected behavior

The v5 policy closed the sparse guest-room defect and correctly produced a night light, books, rug, toy storage,
blocks, a cloth doll, and wall decoration. Its structured authority, however, says only `soft_furnishing` and
`clearly_inanimate_cloth_doll`; it carries no palette intent. The provider therefore complied while producing a
combination that can read as a specifically girl's room.

The expected Set Board is reusable for any child. It may contain any individual color, including pink, but its
large furnishings and toy styling must not combine into a dominant gender-coded presentation.

## 3. General correction

Extend the canonical ambient-dressing policy with a versioned gender-inclusive palette contract:

- intent `balanced_child_friendly`;
- preferred muted color families: sage green, teal, violet, ochre, and natural linen;
- large soft furnishings/bedding and toy clothing are the controlled surfaces;
- isolated pink/coral accents remain allowed;
- only a strongly dominant combined gender cue is rejected.

The prompt projects this structured policy for every set. Ordinary Vision QA receives the same policy and returns
`ambient-palette-strongly-gender-coded` only when the overall combination is materially dominant. This is not a
story, child, set-id, page, or bedroom hardcode. Space appropriateness remains bounded by the existing closed
ambient category range.

## 4. Identity and compatibility

Because prompt semantics, content-policy shape, and ordinary QA semantics change, advance:

- Board `set-board/v5` → `set-board/v6`;
- Registry `set-registry/v5` → `set-registry/v6`;
- content policy `set-board-content/v4` → `set-board-content/v5`;
- ambient policy `set-board-ambient-dressing/v1` → `set-board-ambient-dressing/v2`;
- QA instruction `set-board-qa-instruction/v2` → `set-board-qa-instruction/v3`.

The rejected v4 sparse Board and the richer but product-rejected v5 Board remain immutable, content-addressed,
unapproved evidence. Neither can satisfy current v6 authority.

## 5. Scope and exclusions

Likely production files:

- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/ambientDressing.ts`
- `lib/set-identity-board/boardPrompt.ts`
- `lib/set-identity-board/boardQa.ts`
- `scripts/mint-set-identity-board.ts`
- focused Set Board and Visual Package tests

Unchanged: Candidate, reconciliation, Blueprint, story source, visual-contract page semantics, geometry, openings,
fixed recurring props, blocked cast/props, image model, quality, retries, storage behavior, approval behavior, Town
Board, Wizard promotion, and page/book render policy.

## 6. Validation and stop-check

Provider-free first:

1. exact policy shape/version/hash and clone isolation;
2. prompt projection of balanced palette guidance and explicit allowance for isolated pink accents;
3. no story/set/child hardcoding and no weakening of blocked cast/prop/action or exact geometry;
4. QA instruction coverage for the closed flag and the distinction between a dominant combination and one accent;
5. prior v5 Registry/Board identity rejection under v6;
6. full Set Board suite, focused Visual Package seam, TypeScript, diff hygiene, and literal repository check;
7. independent Claude Code adversarial PASS on the immutable commit range.

Only after PASS and push: one canonical replacement Chameleon Home Board at `gpt-image-2` LOW plus ordinary Vision
QA, followed by inspection of the exact downloaded bytes and a stop for Guy's product approval.

## 7. Cost and rollback

Implementation and tests are `$0`. Guy authorizes exactly one additional LOW Home Board generation after the
provider-free and independent-QA gates. No retry, Town Board, page, or book render is implied.

Rollback is a focused revert. All earlier Registry entries and images remain recoverable by their existing paths,
storage keys, and SHA-256 identities.

## 8. Claude Code falsification targets

- the new policy is canonical, version-bound, and used by prompt and QA;
- the rule allows individual pink accents and does not replace one stereotype with a blue-only stereotype;
- large furnishing/toy-clothing guidance is general and cannot leak a story prop or character;
- v5 evidence cannot validate as current v6 authority even if QA-passed;
- Town/outdoor sets are not forced to acquire bedroom objects or bedroom colors;
- no provider, retry, approval, Wizard, page, or full-book authority is broadened.
