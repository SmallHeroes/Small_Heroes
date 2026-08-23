# R1D Wizard Book Continuity And Composition — Decision Gate

**Date:** 2026-08-23
**Owner:** Guy (product) / Codex (technical)
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Make three visual promises enforceable on the approved Blueprint path:

1. one exact child outfit remains unchanged across every page unless a page carries an explicit, typed wardrobe transition;
2. a companion's canonical accessory remains present whenever that companion is visibly present;
3. an eight-page Blueprint must contain materially different subject scales and camera treatments, including an authored close-up, rather than merely different camera labels over near-identical small-character layouts.

## 2. Why now?

The first new Wizard full-book proof completed, but Guy found visible product defects: Bar's clothing and colours changed across the book, Kim's mustard shoulder satchel disappeared on some pages, and most pages used the same distant two-character composition. These defects block visual/product acceptance of the Wizard book path.

## 3. Scope

General system change. The Chameleon/Bar book is the measured regression case, not a hardcoded implementation target.

## 4. Risk of hardcoding

The implementation must not special-case Bar, Kim, page 8, `chameleon_koko_bedtime`, or bedtime stories. Page-specific clothing changes must be explicit contract data. Companion accessories must come from the existing canonical companion profile. Composition rules apply by book length and measured frame geometry.

## 5. Files likely affected

- Visual Contract types, validators, deterministic page projection, and prompt facts.
- Runtime Blueprint projection/provider boundary and Style01 prompt assembly.
- Pre-render Blueprint composition policy and validator.
- Focused regression tests and `CURRENT.md`.

Approved package bytes, current locator, Story Source, Boards, payment/order state, reader, and generated images are excluded from this code milestone.

## 6. Expected behavior after change

- The runtime prompt receives one concrete page-resolved child wardrobe. Pages without an override use the exact book wardrobe; an explicit page override changes it once and is carried in the frozen page authority.
- The PVB branch no longer suppresses the existing canonical companion identity/accessory lock. A visibly present companion receives both package-scoped appearance constraints and the canonical accessory requirement.
- Blueprint validation measures actual cast-region scale. For an eight-page book it rejects a plan without a close-up, without meaningful scale contrast, or with camera labels whose placements do not match their shot size.
- Legacy packages remain readable. New strict composition authority is opt-in and content-addressed so an existing approved package is never silently reinterpreted.

## 7. Validation plan

Zero-spend offline proof:

- reproduce the current vague-wardrobe, missing-accessory, no-close-up, and near-constant-scale trajectories;
- prove a typed final-page wardrobe transition does not leak backward;
- prove visible canonical companions retain their required accessory and absent/partial cases stay bounded;
- prove hostile close-up labels with tiny placements and eight-page low-scale plans fail;
- prove a genuinely varied plan passes;
- run focused Visual Contract, Blueprint/runtime-authority, prompt-assembly, and Wizard qualification suites;
- run `npx --no-install tsc --noEmit` and `git diff --check`.

No image is needed to prove this milestone. A later LOW visual audition requires a separate explicit render allowance.

## 8. Cost impact

This milestone spends $0: no provider, image, audio, database, payment, deployment, or storage call.

The final implementation should not add image calls or retries. It improves the first-call authority.

## 9. Rollback plan

Revert the focused commit. The new Visual Contract field and strict Blueprint policy are additive/opt-in; legacy package bytes and locators remain unchanged.

## 10. Review assignment

Guy has decided the product behavior: stable non-gender-coded clothing, an explicit bedtime pajama transition where authored, Kim's bag always present when Kim is visible, and materially varied framing including close-ups.

Claude Code should falsify:

- a wardrobe override leaking to adjacent pages or allowing silent arbitrary changes;
- the authoritative PVB branch still bypassing canonical accessory locks;
- a companion contract/registry contradiction being hidden rather than rejected or visibly constrained;
- a `close_up` label passing with distant/tiny cast geometry;
- diversity checks that can be satisfied by coordinate nudges while subject scale remains effectively constant;
- legacy package incompatibility or any unreviewed mutation of approved artifacts.

Claude Cowork is not needed for the engineering gate; Guy already supplied the visual/product direction.

## 11. Do not do

- no Bar-, Kim-, story-, or page-number-specific runtime branch;
- no prompt-only claim without structured/frozen authority;
- no retry, regeneration, best-of-N, budget increase, or model change;
- no provider call, paid render, fake payment, package promotion, locator update, deploy, release, or approval in this milestone;
- do not touch or stage the four pre-existing untracked Board artifacts.
