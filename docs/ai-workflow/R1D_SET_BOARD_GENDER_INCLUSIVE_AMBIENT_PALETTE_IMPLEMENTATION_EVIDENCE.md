# R1D Set Board Gender-Inclusive Ambient Palette — Implementation Evidence

**Date:** 2026-08-21

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Base:** `ddc85b2ad4c752bc163427a4bca880d516bc4e4f`

**Decision Gate:** `R1D_SET_BOARD_GENDER_INCLUSIVE_AMBIENT_PALETTE_DECISION_GATE.md`

## Outcome

The richer v5 Chameleon Home Board solved the sparse guest-room defect but
combined a large coral-pink blanket with a cloth doll in pink clothing. Guy
accepted the composition and rejected that combined gender cue. The correction
is general: every current Set Definition now carries a versioned palette intent
for large soft furnishings/bedding and inanimate-toy clothing.

Pink is not banned. One isolated pink/coral accent remains explicitly allowed.
The policy instead prevents a materially dominant combined cue and does not
replace it with a blue-only stereotype.

## Production changes

1. `SetBoardAmbientDressingPolicy` adds exact palette authority:
   `balanced_child_friendly`, muted sage/teal/violet/ochre/natural-linen color
   families, two controlled surface groups, isolated-pink allowance, and a
   dominant-gender-coding prohibition.
2. The positive image prompt projects the intent through provider-safe prose;
   internal `child_friendly` vocabulary never leaks into positive cast/entity
   authority.
3. Ordinary Vision QA receives the same structured colors and targets. It
   allows one pink/coral accent and may return the closed flag
   `ambient-palette-strongly-gender-coded` only for a materially dominant
   combination.
4. Board, Registry, content policy, ambient policy, and QA instruction advance
   to `set-board/v6`, `set-registry/v6`, `set-board-content/v5`,
   `set-board-ambient-dressing/v2`, and `set-board-qa-instruction/v3`.
5. Geometry, openings, fixed story props, blocked cast/props/actions, model,
   quality, retry, upload, human approval, and downstream render authority are
   unchanged.
6. The public Set Board barrel exports the closed palette color and target
   constants and their types, so consumers cannot depend on a partial policy
   API.

## Provider-free Chameleon proof

The canonical mint command ran without `--render` and wrote only an ignored
preview:

```powershell
node scripts/mint-set-identity-board.cjs `
  --story chameleon_koko_bedtime `
  --identity set_child_home_night `
  --style soft_hand_drawn_storybook `
  --contract outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/candidate-template-projections/4e945dc0aeec47f21339cc780cfa6d86d87055f60a75685e8f1a25ab7b35cf31.json `
  --out outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z/set-board-previews/set_child_home_night.v6.json
```

Result:

- Registry `set-registry/v6`
- Board `set-board/v6`
- Set Definition hash
  `803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172`
- content-policy digest
  `6ba2b1be70c243bc83e67770ed14b8fb227fab5da092a2f290c234254798bd70`
- prompt hash
  `ecda380efcd76e3baa53df1c589cf0039729385bba5f1ac001854ea909d547db`
- model/quality `(unrendered)` and QA `pending`

The prompt requests a balanced mix for bedding/large soft furnishings and toy
clothing, names the five muted preferred families, allows one pink/coral
accent, and rejects a dominant combined cue. All six Chameleon
page-conditioned props remain negative-only. The prior v5 Registry SHA-256
remained `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`
and its byte length remained 981 across the dry run.

## Validation evidence

- Entire Set Board suite plus both board-consuming Visual Package seams:
  **15 files / 367 tests PASS**.
- `npx --no-install tsc --noEmit` — PASS.
- Literal `npm run check`:
  - TypeScript — PASS;
  - autonomous Story typecheck — PASS;
  - ordinary: **3,370 tests PASS**, 65 skipped;
  - resource-intensive: **20 files / 610 tests PASS**;
  - overall exit remains nonzero only for the same five missing ignored-output
    fixture assertions in four unchanged specs: `momentum-gate-koko`,
    `page-entity-qa`, two `story-read-back-validation` cases, and
    `child-lexicon-ages-5-8`.
- `git diff --check` — PASS after documentation finalization.

## Runtime evidence and exclusions

The prior v5 image is preserved under asset SHA-256
`2bd29068802ac18398190408ae3d9d38ddbb8e48c4832a337058f31a7dd062c6`.
Its Registry remains `qaStatus: passed` with `approvedBy` and `approvedAt`
both null. No current v6 provider call, image, Vision request, upload, approval,
Town Board, Wizard promotion, page render, full-book render, database write,
deployment, or production action occurred in this implementation milestone.

After a focused commit, independent Claude Code PASS and push, Guy authorizes
exactly one v6 Chameleon Home Board at `gpt-image-2` LOW plus ordinary Vision
QA. The resulting exact bytes stop for visual/product review. No retry or
downstream render is implied.
