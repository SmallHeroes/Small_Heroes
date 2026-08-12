# Story Bank Next Generation — Creative Briefs Decision Gate

**Status:** approved in principle by Guy on 2026-08-12: “ChatGPT can write the stories according to the structure you give it; write a brief for every story.”

**Milestone:** one general ChatGPT writer contract plus one structured creative brief for every MVP story slot

**Implementation branch:** `codex/story-bank-next-generation-creative-briefs`

**Exact base:** `5368bce73978e159fe1d64ab2662e8e734cfa29b`

## 1. Proposed change

Replace the rejected manual-spine-per-story workflow with a brief-driven authoring workflow:

- one versioned, slot-neutral writer contract tells ChatGPT how to turn a brief into a complete personalized Hebrew story in the current 8/12/16-page bank shape;
- one structured creative brief is authored for each of the 18 MVP combinations: six companions × bedtime/adventure/fantasy;
- the brief owns the distinctive premise, visible child want, physical play system, meaningful set pieces, companion-caused wrong help, comic escalation, child discovery/climax, payoff, energy shape, reread hooks, and anti-copy exclusions;
- ChatGPT owns prose, dialogue, exact scene wording, and page-level realization inside those constraints;
- the produced draft remains non-authoritative until deterministic format/content gates, read-aloud editing, Guy content acceptance, a separate versioned-bank migration, and independent technical review.

The selected Koko/bedtime idea “תחנת האוטובוס שקמה והלכה” may survive as that slot's brief. Its manually authored eight-page spine is abandoned and is not an input.

## 2. Why now?

The foundation milestone proved that the existing plots are too often static, bedroom-bound, therapeutic-first, low-humor, and weak on replay value. It then overcorrected by proposing a hand-authored page spine before every story. Guy rejected that production method because a capable language model can perform page composition when the creative brief and output contract are sufficiently precise.

The goal is to spend human judgment on the 18 decisions that matter—what each story uniquely is—while delegating the repetitive page-by-page drafting work to ChatGPT.

## 3. Observed behavior, expected behavior, and root cause

Observed:

- the product matrix contains exactly 18 active MVP slots: six category-bound companions across three directions;
- all 18 current V3 stories are valid production artifacts, but their plot quality is not a suitable creative source for this generation;
- the experimental v3 generator already has one optional `premiseCreativeBrief` string, used by only one Sprint 11 spec;
- no complete structured catalog binds a distinct creative premise to every slot;
- the foundation contract still requires a 12-premise tournament and manual spine approval before prose;
- the rejected Koko B work showed that manually specifying every page duplicates work ChatGPT can do.

Expected:

- selecting one slot yields one complete, human-reviewable brief and one shared writer contract;
- ChatGPT can draft the full story without access to old bank prose and without a hand-authored page spine;
- every brief is materially different, mobile across meaningful locations, funny through the chosen companion's flaw, and child-led at the climax;
- direction controls length and energy, not recycled locations or therapeutic plot templates.

Root cause:

Creative authority currently lives either in old finished prose or in broad companion/category guidance. The missing layer is a compact, structured slot brief: specific enough to prevent generic output, but not so prescriptive that humans rewrite all 18 stories before the model starts.

## 4. Scope

This is a **general non-runtime story-authoring system plus 18 story-specific data records**.

In scope:

- durable brief schema and authority rules;
- one general ChatGPT writer contract;
- exactly 18 structured briefs matching the current MVP matrix;
- explicit old-story fingerprints used only as anti-copy exclusions;
- deterministic tests for completeness, uniqueness, direction structure, companion fit, child agency, location variety, and forbidden therapeutic/old-plot residue;
- update the staging workflow to replace the mandatory tournament/manual-spine route with brief → model draft → review.

Out of scope:

- generating any full story in this milestone;
- model/provider/network/pricing calls;
- editing or replacing `story-bank/v3-approved/` or `story-bank/v5-fixed-v2/`;
- runtime prompt assembly, loader, matrix, imports, database, orders, candidates, Blueprint, Wizard, reader, render, or release behavior;
- image, audio, storage, publication, promotion, deployment, or push.

## 5. Risk of hardcoding

The briefs are deliberately story-specific data; the writer contract and validation rules must remain slot-neutral.

Risks and mitigations:

- **Prompt prose treated as safety authority:** model output remains untrusted and must pass downstream validators and human review.
- **Eighteen variants of one plot:** each brief has a unique mechanic key, world rule, set-piece chain, climax action, and anti-copy record.
- **Companion decoration:** each brief must state why replacing the companion breaks causality, jokes, and climax handoff.
- **Manual spine hidden inside the brief:** briefs define movement and non-negotiable causal turns, not per-page scene text.
- **Old-bank leakage:** old stories are inspected only to record exclusions; no old prose, scene order, payoff object, or authored ID enters the positive creative fields.
- **Model invents unsafe or unrenderable material:** the shared contract limits cast/props, requires English image directions, and preserves existing import/personalization validation as later gates.

## 6. Expected behavior after change

For any MVP slot, a writer can supply ChatGPT with:

1. the shared writer contract;
2. the selected companion bible;
3. exactly one structured slot brief;
4. no old story prose.

ChatGPT then returns one complete draft with exactly 8, 12, or 16 numbered pages, personalized Hebrew chips, oral story language, an English `imageDirection` per page, a visible opening hook, causal comic escalation, meaningful set-piece movement, child-owned discovery and climax, and an earned direction-appropriate ending.

The draft is still staging-only. No artifact receives bank, sellability, render, approval, or migration authority automatically.

## 7. Validation plan

Smallest safe validation:

1. Prove the catalog has exactly the 18 matrix keys and no duplicates.
2. Prove every brief has the complete typed field set, correct category/companion/direction/page count, concrete child want, two causal attempts, three different comic escalations, child discovery/action, and visible payoff.
3. Prove bedtime briefs have at least two meaningful set pieces, adventure/fantasy at least three, and every brief changes dramatic use between locations.
4. Prove unique mechanic keys, hooks, climaxes, and payoff objects across the catalog.
5. Prove companion-specific causal markers and swap-test explanations.
6. Scan positive creative fields—not anti-copy disclosures—for bedroom/default-sleep, old-token, direct-therapy, abstract-symbol, moral, and known old-plot residue.
7. Prove the writer contract requires exact page shape, current personalization chips, per-page state change/page turn, word bands, lean English image directions, and staging-only output.
8. Run focused tests, deterministic TypeScript, `git diff --check`, and literal `npm run check` once. Existing unrelated ignored-output fixture assertions remain repository HOLD; any new failure stops the milestone.
9. Commit locally and hand exact base..HEAD to Claude Code for read-only adversarial review.

No story generation, provider call, or render is required to validate the brief catalog itself.

## 8. Cost impact

External cost for this milestone: **$0**.

- no credentials;
- no provider/model/network call;
- no images, audio, or renders.

Future story drafting will incur model cost only after a separate approved execution decision. No cost is authorized here.

## 9. Rollback plan

The work is isolated on a local branch based on the already reviewed foundation commit. Rollback is a clean revert/deletion of the new brief-contract commit before integration. Current V3/V5 stories, imports, frozen orders, and runtime selection remain byte-identical.

## 10. Review assignment

Guy must review the 18 premises as product/creative authority and may approve, replace, or refine any individual brief before story generation.

Claude Code should try to falsify:

- that there are exactly 18 complete and correctly mapped briefs;
- that the shared contract is genuinely general and no manual Koko spine remains;
- that old story content appears only in negative anti-copy fields;
- that different briefs are truly different rather than renamed copies;
- that each companion is mechanically indispensable;
- that the child owns the decisive external action;
- that bedtime is an energy curve rather than a bedroom template;
- that nothing changed in approved banks, runtime, dependencies, package identity, or cost-bearing paths.

## 11. Rejected alternatives

- **Hand-author an eight-page spine for every story:** duplicates model drafting work and slows the catalog before prose quality is tested.
- **Give ChatGPT only the category and companion:** produces generic therapy stories and interchangeable mascots.
- **Use the current V3 stories as examples:** creates plot and sentence leakage from the material being replaced.
- **One giant prose prompt with 18 embedded stories:** mixes authority, increases cross-story contamination, and is hard to review or version.
- **Generate all 18 immediately:** spends model budget before Guy accepts the creative premises.
- **Write directly into the approved bank:** bypasses content, technical, migration, and render-qualification gates.

## 12. Do not do

- Do not write or generate the full stories in this milestone.
- Do not access credentials or call ChatGPT/OpenAI/another provider.
- Do not edit, import, replace, delete, or rehash approved story files.
- Do not use old prose or old page order as a positive seed.
- Do not revive the rejected hand-authored Koko page spine.
- Do not change models, budgets, pricing, retries, timeouts, fallbacks, dependencies, lockfiles, runtime behavior, candidate semantics, Blueprint, Wizard, reader, or render behavior.
- Do not publish, promote, activate, deploy, push, or claim independent technical or product PASS.
