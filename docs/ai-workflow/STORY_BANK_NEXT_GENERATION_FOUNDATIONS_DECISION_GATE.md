# Story Bank Next Generation — Foundations Decision Gate

**Status:** approved by Guy on 2026-08-12

**Milestone:** foundations only — creative contract, six companion story bibles, and a three-finalist `chameleon_koko` bedtime premise gate

**Implementation branch:** `codex/story-bank-next-generation-foundations`

**Exact base:** `22857995df578d366809226a5d693cd783a10ed7`

## 1. Proposed change

Create the non-runtime creative foundation for a new, versioned generation of the story bank:

- replace the old therapeutic-first writing brief with an entertainment-first story contract;
- standardize the six active MVP companion story bibles around desire, flaw, wrong help, comic engine, voice, child-agency handoff, direction modulation, and swap test;
- redefine `bedtime` as an energy curve and landing, not a bed/bedroom/sleep location requirement;
- run a premise tournament for one pilot slot, `chameleon_koko` × `bedtime`, and stop with three complete finalists before prose;
- mark existing `story-pipeline` drafts as historical inputs only, not creative seeds or approval authority for the new generation.

This milestone does **not** edit or import a bank story and does not change runtime selection.

## 2. Why now?

The active 18-story bank is structurally valid but repeatedly produces the same experience: the emotional problem is stated, the companion demonstrates a coping action, the child imitates it, and the story ends contained. The result is safe but often static, single-location, low-humor, adult-therapeutic in Hebrew, and weak on page-turn value and rereadability.

The problem begins before prose. Polishing sentences cannot repair a premise without a concrete child want, escalating play, companion-caused complications, location dramaturgy, or a child-owned climax.

## 3. Observed behavior and root cause

- `story-bank/v3-approved` is the current canonical bank under the approved-bank path. It contains 18 slots at 8/12/16 beats.
- Every current bedtime story is principally organized around a bedroom/bed and a sleep landing.
- The old direction DNA explicitly starts bedtime with bed resistance and ends with sleep residue.
- Existing import validation proves structure, page count, chips, companion identity, and image-direction presence. It does not prove humor, oral Hebrew, location change, page turns, companion specificity, or reread desire.
- Existing companion authority is split between the product registry, extended deep profiles, and pipeline sheets. Only some MVP companions have extended code profiles; some registry copy contradicts the richer profile.
- The experimental premise and craft systems already contain strong principles, but they are advisory, include stale/story-specific assumptions, and do not authorize bank writes.
- Existing pipeline tracking is stale: it still describes ten missing slots and treats old V5 material as a possible source, while the active V3 bank is already 18/18 product-sellable.

## 4. Scope

This is a **general story-system foundation**, with one story-specific premise pilot used only to falsify the general contract.

In scope:

- durable Decision Gate and story contract;
- one standardized staging bible for each of the six active MVP companions;
- a revised Premise Lab contract;
- twelve independently shaped Koko/bedtime premise candidates and three complete finalists;
- deterministic repository checks and documentation evidence.

Out of scope:

- full prose or page beats;
- edits to `story-bank/v3-approved` or any other approved bank;
- loader, matrix, import, database, order, candidate, Blueprint, Wizard, reader, layout, render, or production changes;
- provider/model calls, credentials, network, pricing, images, audio, storage, deployment, or push;
- renaming a bank version before the migration contract is designed;
- asserting product or independent technical PASS.

## 5. Risk of hardcoding

The main hardcoding risks are:

- solving only Koko/transition rather than defining a reusable story contract;
- mandating arbitrary location counts that create travel without drama;
- turning every companion signature into a repeated catchphrase or prop checklist;
- preserving the old stories indirectly by using them as premise seeds;
- allowing a craft score to replace child/parent response.

Mitigation:

- general requirements are defined separately from the Koko pilot;
- location variety is judged by meaningful set pieces and changed dramatic state, not labels alone;
- a signature must cause choices or consequences and may not be inserted decoratively;
- old story prose and premises are explicitly forbidden as creative seeds;
- machine scoring is advisory; Guy and later read-aloud evidence remain required.

## 6. Expected behavior after change

A future writer can begin with a companion and direction and produce premise candidates where:

- the visible story is a funny, concrete quest rather than a lesson;
- the child wants something before the emotional theme is visible;
- the companion's lovable flaw produces wrong help and escalating trouble;
- the child performs the discovery and decisive action;
- each page changes the situation and earns the next page;
- Hebrew is designed for oral reading, with a child layer and a quiet parent layer;
- bedtime can travel through multiple locations while the final quarter lowers energy and closes safely;
- existing V3 stories and frozen orders remain untouched.

## 7. Validation plan

Smallest safe validation for this milestone:

1. Review the six bibles against product registry visual locks and existing deep-profile canon.
2. Check that all six use the same required sections and each has a distinct wrong-help/comic/agency contract.
3. Check that the Koko tournament does not reuse current Koko story premises, beds, bedrooms, sleepovers, home-token-as-solution, or therapeutic headlines.
4. Check that every finalist contains a concrete child want, physical play system, two failures, three comic escalations, at least three meaningful set pieces, child-owned climax, visible payoff, and bedtime energy landing.
5. Run focused repository tests that do not require ignored outputs, then `npx tsc --noEmit`.
6. Run literal `npm run check` only if this milestone introduces executable validation code; otherwise record why documentation-only foundations do not justify invoking the known fixture-sensitive full suite.
7. Hand the committed range to Claude Code for review-only adversarial QA. Creative/product acceptance remains Guy's.

No image or full-book validation is authorized.

## 8. Cost impact

Expected external cost: **$0**.

- no provider/model calls;
- no image or audio generation;
- no render allowance;
- no credential access.

## 9. Rollback plan

The milestone is isolated on a new branch and does not modify runtime or approved story sources. Rollback is deletion/revert of the new foundation commit before integration. Existing V3 authority remains unchanged throughout.

## 10. Review assignment

Guy approved:

- create stories from blank rather than polish the current plots;
- make entertainment the visible layer and resilience the underlayer;
- preserve companion identity and give the child the climax;
- treat bedtime as an energy curve rather than a bed requirement;
- begin with foundations and a Koko bedtime premise pilot, not full prose.

Guy must next decide which of the three Koko finalists advances to page beats.

Claude Code should try to falsify:

- that no active/approved story or runtime authority changed;
- that the new contract is genuinely general rather than Koko-specific;
- that all six companion bibles are complete, mutually distinctive, and consistent with immutable visual/product identity;
- that old V3/V5 story residue did not become a new premise seed;
- that the three finalists meet the stated hard gates and are meaningfully different;
- that bedtime is decoupled from bedroom/sleep without becoming high-arousal at the landing;
- that repository and Git claims match the exact committed range.

Claude Cowork is a useful later product/creative critic for the three finalists, but no external handoff is performed in this milestone without Guy routing it.

## 11. Rejected alternatives

- **Polish all 18 existing stories:** preserves weak premise architecture.
- **Prompt “make it funnier/more creative”:** creates uncontrolled style drift and generic companions.
- **Rewrite all 18 before calibration:** maximizes rework before the quality bar is proven.
- **Force a new location every N pages:** produces arbitrary travel and visual-continuity cost.
- **Ban bedrooms from bedtime:** replaces one brittle rule with another; the requirement is an energy curve, not a location ban.
- **Overwrite V3 in place:** breaks source/version authority and risks frozen downstream artifacts.
- **Accept by model score alone:** a score cannot prove that a child asks for another reading or that a parent enjoys rereading.

## 12. Do not do

- Do not edit, import, replace, delete, or rehash any approved story.
- Do not use old story prose, authored IDs, or current plots as seeds.
- Do not write the full Koko story before Guy selects a finalist and approves page-beat work.
- Do not alter companions' canonical IDs, display names, genders, accessories, sizes, or visual locks.
- Do not invoke providers, networks, credentials, images, renders, storage, databases, deployment, or push.
- Do not claim independent technical PASS or product acceptance.
