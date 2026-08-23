# R1D Typed Companion Appearance State Authority — Decision Gate

**Date:** 2026-08-23
**Owner:** Guy (product) / Codex (technical)
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`
**Approved by Guy:** 2026-08-23

## 1. Proposed change

Add one general, closed, page-resolved companion appearance-state authority. A companion may declare an optional state vocabulary. An opted-in Visual Contract freezes the complete vocabulary and each authored page transition references one closed `stateId` plus typed evidence. Runtime prompt assembly receives the resolved state together with the invariant companion identity and canonical accessory.

Kim's declaration is the first data instance. It preserves her species, proportions, face, eyes, silhouette, tail and mustard satchel while allowing bounded, gradual changes in one harmonious body hue, pattern and body-language cue. The declaration includes an explicit `mismatched` state for a failed camouflage attempt.

## 2. Why now?

The first complete Wizard book rendered Kim in the same green tone on every page. Repository evidence shows the cause is systemic: `lib/companions.ts` supplies one fixed-colour `visualDescription` to every page, while Kim's deep profile defines colour attunement, stress stripes and environmental blending but no structured per-page authority carries those facts to rendering. Loose prose can also compete with the fixed lock.

This removes Kim's differentiating story mechanism and makes the companion interchangeable. The defect blocks the revised Bar/Kim story and its next Visual Contract.

## 3. Scope

General system change with one first declared vocabulary. It includes:

- a pure companion-state authority type and declared-vocabulary registry;
- an optional frozen authority on the companion cast member;
- page transition references with typed origin;
- validation of shape, closed values, presence, no-ops, source evidence, prose ownership and gradual continuity;
- deterministic page resolution and carry-forward;
- Blueprint/runtime/provider prompt projection;
- authoring schema/prompt support without a companion-specific runtime branch;
- focused regression and compatibility tests.

The later Bar/Kim Story Source revision is a separate content milestone after independent technical PASS.

## 4. Risk of hardcoding

The runtime must never branch on Kim, Chameleon, Bar, bedtime, a page number or a story key. It reads only an optional authority embedded in the frozen Visual Contract. Most companions declare no vocabulary and preserve existing behavior. Kim-specific colours and cues live only in declared data.

## 5. Files likely affected

- pure companion appearance-state authority module and `lib/companions.ts` declaration;
- Visual Contract types, validation, source-evidence validation, derivation and prompt facts;
- template authoring schema/prompt/assembly;
- pre-render Blueprint validation;
- runtime Blueprint projection, Style01 lock builder and prompt assembly;
- focused tests, canonical documentation and evidence.

Approved packages, current locators, Story Sources, Boards, orders, payments, images and deployments are excluded.

## 6. Expected behavior after change

- A contract without `companionAppearanceStateAuthority` is interpreted exactly as before.
- An opted-in contract contains the full immutable vocabulary; runtime never consults mutable registry data to interpret approved page state.
- The default state begins at the cover and page sequence. A page override changes the state; later pages inherit it until another explicit transition.
- A transition is legal only while the companion is present, cites typed evidence, selects a declared state, differs from the current state and moves at most one declared continuity step.
- Companion-specific appearance vocabulary cannot be re-authored in `mustShow`, `mustNotShow` or Blueprint narrative prose when it would compete with the typed authority.
- Prompt assembly keeps invariant identity and accessory locks while substituting only the resolved hue, pattern and body-language state.
- The state is carried through frozen contract facts, Blueprint projection, runtime authority and the provider input without inference.

## 7. Validation plan

Zero-spend offline proof:

- malformed, undeclared, absent-companion, default/no-op and multi-step transitions reject;
- valid one-step transitions, persistence across pages and an explicit mismatch-to-attunement sequence pass;
- false/free prose appearance authority rejects at contract and Blueprint boundaries;
- the exact resolved state reaches facts, Blueprint projection and the final Style01 PVB prompt;
- identity and mustard satchel remain mandatory while only state-owned appearance changes;
- a non-capable companion and every historical package remain behaviorally compatible;
- strict authoring schema and deterministic injection are exercised without provider calls;
- focused suites, `npx --no-install tsc --noEmit`, `git diff --check`, and the proportionate repository check run before commit.

## 8. Cost impact

$0. No provider, image, audio, storage, database, payment, deployment or network call. The implementation adds no generation, retry, repair or model budget.

## 9. Rollback plan

Revert the focused commit. The authority is additive and opt-in. No approved artifact or locator is rewritten, so historical packages retain their exact semantics.

## 10. Review assignment

Guy approved the product behavior: general closed state authority, gradual colour/pattern/body-language transitions, an explicit mismatch state, and invariant identity/accessory.

Claude Code should falsify:

- registry edits silently reinterpreting an approved package;
- a page or prompt selecting undeclared/free-text appearance;
- a state jump, no-op or absent-companion override passing;
- state failing to persist deterministically across omitted pages;
- loose `mustShow`, `mustNotShow` or Blueprint narrative competing with typed state;
- fixed colour remaining inside the invariant prompt lock;
- the state disappearing between contract, Blueprint, runtime and provider seams;
- historical/non-capable companion behavior changing;
- any Kim/story/page-specific runtime branch.

Claude Cowork may later review the rewritten story's emotional arc and swap/remove tests. It is not a substitute for this engineering gate.

## 11. Do not do

- no prompt-only state without structured/frozen authority;
- no mutable runtime lookup for interpreting an approved contract;
- no arbitrary page colour strings or unrestricted state ids;
- no Kim-, Bar-, story- or page-specific runtime branch;
- no Story Source rewrite in this technical milestone;
- no provider call, image, audio, fake payment, package/locator mutation, deployment, promotion, approval or render;
- do not touch or stage the four pre-existing untracked Board artifacts.
