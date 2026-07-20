# WS0b — Codex-HOLD fix set — RE-REVIEW (round 4) for activation-readiness

**Branch:** `feat/chunked-generation`. **HEAD:** `b846c47b`. **Fix range:** `f8c0e21f..b846c47b` = round-1 (9 commits) + round-2 (6 commits) + round-3 (1 commit: **P1-2c**, below), on top of the WS0a+WS0b foundation you reviewed.
**Gate:** `npm run check` green at HEAD and per-commit — **tsc clean, 1245 passed / 11 skipped** (6 skipped files = DB staging specs). **Renders:** 0 (unit/integration only). **Nothing pushed.**
**Flags — ALL default OFF, ALL hard-off on Vercel Production** (`lib/visual-contract-compiler/contractRenderGuards.ts`): `VISUAL_CONTRACT_FREEZE`, `VISUAL_CONTRACT_STEERING`, `VISUAL_CONTRACT_ENFORCEMENT`. With all off, the pipeline is byte-identical to pre-WS0b. **B3 (below) now couples steering→enforcement in code**, so steering cannot drive live output without the gate even by misconfiguration.

## What this is
Round 1: you reviewed WS0b (the frozen `BookVisualContract vNext` PRODUCED / FROZEN / BOUND behind the flags above) and found the slice SAFE/inert — but **HELD it because activation (WS0c/WS1) would expose 5 P1s** (2 efficacy — the headline fixes didn't reach the live path; 3 safety — money-code races/coupling) **plus a Group C** (3 pre-WS0c items). These 9 commits close all of them under a per-SHA discipline: plan-mode-approved decomposition, each commit `npm run check`-green with an explicit **flag-OFF byte-identity** test, stop-at-SHA, Guy re-verified before the next. **Request:** confirm the whole set is activation-ready, and specifically that the two efficacy fixes (A1/A2) now reach the **ACTIVE** live path — the exact miss that HELD round 1 (round-1 tests validated fallback/test-only blocks).

**Round 2:** you re-reviewed those 9 and found **4 P1 + 1 P2** before activation (2 efficacy — the A2a location leak was not fully closed on a REAL multi-zone story; 2 money — recovery convergence + receipt fence-coverage). The **6 round-2 commits** below close them under the same discipline: **P1-1/P1-2 proven against a MULTI-ZONE clinic canary** (waiting_room → exam_room) with a block-level leak-closed proof; **P1-3/P1-4 (money) tested against the PRODUCTION functions**.

**Round 3:** you re-reviewed the 15 and confirmed **P1-1 / P1-3 / P1-4 / P2 closed**, but found **1 P1 still open** — P1-2's `stableGeometry` is **not dormant, it leaks through scene-memory**. The **1 round-3 commit (P1-2c)** below closes it with a **FULL-PATH proof** (through `resolveSceneMemoryPlan` — the path the round-2 block-level test bypassed). **Request (round 4):** confirm P1-2c closes the leak and the whole **16-commit** set is activation-ready.

---

## The 9 fixes (each: Codex P1 → seam → ACTIVE-consumer validation → flag-off invariant)

### Group A — EFFICACY (the two headline fixes now reach the live path)

**`09e68ba4` A1 — human-cast reaches the ACTIVE Style-01 Phase-2 prompt** (closes **P1 #5**).
- **Seam:** e4b set `page.supportingCharacters`, but the ACTIVE assembler `assembleStyle01Phase2Prompt` (`lib/style01-prompt-assembly.ts`) had **no field** to read it → the value was dropped at the active call `generateWithGPTImageStyle01Phase2Once` (`backend/providers/image.ts:3226`). Round-1's test validated the **dead, test-only** `buildCharacterConsistencyBlock` (a different path).
- **Fix:** `supportingCharacters` added to `Style01PromptAssemblyInput`; a `SUPPORTING CHARACTER LOCK` block (sibling of `companionTextLock`) threaded through `buildStyle01BookPagePrompt` (`lib/style01-gptimage.ts`, slot after `companionTextLock`) and forwarded at the active call. Content is the adapter's composed `{gender} {role}; …; wearing {wardrobe}; must never appear: …`.
- **ACTIVE-consumer validation:** the test asserts on the **output of `assembleStyle01Phase2Prompt`** (contains `SUPPORTING CHARACTER` / `male` [gender not flipped] / `white coat` / `must never appear`) — the string that becomes `finalPrompt` → the model — **not** the fallback block. (Note: a *different* live consumer `buildGPTImagePrompt` reads the field but only on the plain gpt-image provider, not Style-01 Phase-2 — so the field was not globally dead, just off the active path.)
- **Flag-off:** the field is spread onto the page only under `VISUAL_CONTRACT_STEERING`; `[]` → `?.length` falsy → no block → prompt byte-identical. Explicit flag-off test.

**`6a440951` A2a — location adapter projects FULL contract authority** (closes **P1 #4**, adapter half).
- **Seam:** `contractToLocationPlanBundle` (`lib/visual-contract-compiler/adapters.ts`) dropped `transitionRules` (`[]`), per-zone `stableGeometry` (`[]`), `bible.setTopology` (unset → every steered book lost its SET TOPOLOGY LOCK), the page-0 cover plan, and collapsed multi-location `primarySetting` to `locations[0]`.
- **Fix:** projects `transitionRules` (from non-steady page transitions), per-zone `stableGeometry` (from location `topology` — **later emptied by P1-2c / round-3, which proved it was a live scene-memory leak, not dormant**), `setTopology` (single-location, from anchors+topology+forbidden), a **page-0 cover plan from `coverContract`** (so `resolvePageLocationPlan(bundle,0)` returns the contract's cover authority, closing the legacy **home-night** synthesis at `resolve.ts`), and a multi-location `primarySetting`. Unknown → neutral (never fabricated).
- **ACTIVE-consumer validation:** asserted against the **real** consumers — `resolvePageLocationPlan(0)` (no `home-night`), `buildSetTopologyLockBlock`/`promptContainsSetTopologyLock`, and the live `buildLocationContinuityPromptBlock` — plus a neutral-fallback test (single-location/no-topology/all-steady → all empty, no page-0 leak). **See correction (1) below** re: which consumer is live.
- **Flag-off:** the projection is consumed only under `VISUAL_CONTRACT_STEERING` (`ensureStoryLocationPlan` gate, unchanged) → byte-identical.

**`cd69155d` A2b — contract-aware `COVER_MYSTERY_LOCK` suppression** (closes **P1 #4**, cover-lock half).
- **Seam:** the hardcoded bedtime `COVER_MYSTERY_LOCK` is injected on `isCover` inside the **LIVE** `buildLocationContinuityPromptBlock` (`lib/story-location-bible/compose.ts`), **independent of the page-0 plan** — so A2a's page-0 plan alone did not remove it from a non-bedtime (e.g. clinic) cover.
- **Fix:** `PageLocationPlan.contractCover` marker (set by the adapter's `coverPageLocationPlan`) rides on the page-0 plan through `buildResolvedLocationEnvironmentBlock → buildLocationContinuityPromptBlock`; the injection is gated `isCover && !pagePlan.contractCover`. A contract cover's own no-spoiler intent comes from `coverContract.mustNotShow` (already emitted via the forbidden-drift line).
- **ACTIVE-consumer validation:** on the cover prompt output — contract cover → no bedtime `NO bucket` text but keeps `coverContract.mustNotShow` (`exam instruments`); **flag-off byte-identity** test → a legacy cover plan (no marker) still emits `COVER_MYSTERY_LOCK` verbatim.
- **Flag-off:** only steering-on + a contract cover suppresses it; legacy/steering-off unchanged.

### Group B — SAFETY (money-code races/coupling)

**`4029a624` B1 — bind quality evidence to the PRE-render contract hash + fingerprint it** (closes **P1 #1**, contract-evidence TOCTOU).
- **Seam:** the delivered-evidence producer re-read `Order.visualContractHash` **after render** (3 sites), so a concurrent re-freeze could stamp v2 onto v1-rendered bytes (stale PASS); and `row.contractHash` drove the readiness decision but was **excluded** from `qualityEvidenceFingerprint`, so a late stale restamp didn't drift the TOCTOU fingerprint.
- **Fix:** capture **one** render-time hash from the **local** cache (`renderedContractHashOf(cache)` — immune to a concurrent re-freeze), thread it into `persistQualityContext` + `persistDeliveredQualityEvidence` + the observability payload, and **delete the render-seam re-reads**; add `contractHash` as the 6th `qualityEvidenceFingerprint` element. **Recovery keeps its read** (`readActiveVisualContractHash`) — it deliberately re-QAs stored bytes against the CURRENT contract (a re-bind, not the render-time race).
- **ACTIVE-consumer validation:** the producer binding tests assert the **threaded** hash is bound AND `Order.findUnique` is **never re-read**; the invariance test was flipped to "contractHash IS in the fingerprint"; a **stale-v1-row race test** proves a superseded restamp drifts the fingerprint → TOCTOU abort. `contractHash` is a **required** producer arg (compile-time enforcement; no Prisma undefined-vs-null ambiguity).
- **Flag-off:** null everywhere (freeze off) → a constant → byte-identical eval-vs-commit.

**`8b981356` B2 — freeze writes only its protected key (jsonb_set) + fast-path hash-verify** (closes **P1 #2**).
- **Seam:** the freeze callback replaced the **whole** `GenerationJob.pipelineCache` from an in-memory snapshot while its receipt `mutationPayload` covered only `{visualContractHash, visualContract}` → a lost-lease late freeze could clobber newer unrelated cache fields; and the resume fast-path returned early on mere presence, not a hash match.
- **Barrier-lock verification (per the ruling):** `runFenced` (`atomic-operation.ts`) locks only the `AtomicOperationReceipt` row (the operationKey), **not** `GenerationJob`, and a Prisma `findUnique` inside the callback emits no `FOR UPDATE` — so an in-tx read-merge would have a read-window race. Therefore the write is an atomic **single-key `jsonb_set`** on `{visualContract}` (no read; one row-locked UPDATE) → the write now covers **exactly** the `mutationPayload`. Fast-path short-circuits only when `computeVisualContractHash(readFrozenVisualContract(cache.visualContract)) === order.visualContractHash`, else re-freezes.
- **Validation:** matching stamp+cache → no `withMutation`; mismatch → re-freeze; a pre-existing unrelated `pipelineCache` field survives (the mock **throws** on any whole-cache `generationJob.update`; a real vNext fixture so `readFrozenVisualContract` accepts it). **Caveat:** the unit test *simulates* `jsonb_set`'s merge — the real Postgres primitive is confirmable in the WS0c/WS1 staging proof.
- **Flag-off:** freeze off → the freeze is a no-op.

**`55763a76` B3 — steering fail-closed-coupled to enforcement in code** (closes **P1 #3**).
- **Seam:** `isVisualContractSteeringEnabled()` returned true on `VISUAL_CONTRACT_STEERING=true` even with enforcement off — "flip both together" was operational intent only.
- **Fix:** returns false unless `isVisualContractEnforcementEnabled()` is also on. Strictly more restrictive (needs enforcement + steering + non-prod) → can only make steering harder to enable; today's all-off state is byte-identical. Freeze/enforcement guards untouched.
- **Validation:** steering-on + enforcement-off → **still false**; both-on → true; default-off unchanged.

### Group C — pre-WS0c

**`577f936d` C1 — dynamic (non-bank) stories skip the freeze; compiler kept dormant** (Codex additional P1).
- **Seam:** `defaultProduceContract` compiled a contract for dynamic (non-bank) stories on the live freeze path, but that compile supplies no companion ("No companion in this story"), no per-page image directions, and isn't crash-safe compile-once.
- **Fix:** dynamic → null (legacy path, byte-identical). The dynamic compiler is **retained but dormant** behind `ENABLE_DYNAMIC_CONTRACT_COMPILE = false as boolean`; the compiler module (`compileBookVisualContract`) is untouched. **Deviation note:** the literal `if (!bankKey) return null` + a dead dynamic branch **fails tsc** — tsc still type-checks unreachable code and won't narrow `finalized` there ("possibly null") — so the `false as boolean` gate keeps the branch reachable/type-checked while runtime-off (same effect, dynamic → legacy).
- **Validation:** a dynamic (no `selectionFilename`) story via the **default** producer → null → no fence.
- **See C1 note below** re: env-read on revival.

**`c0db75e9` C2 — validator rejects a non-steady OPENING page** (Codex C2).
- **Seam:** rule-3b's per-page continuity body is gated by `previousZone !== undefined`, so the first page (undefined) skipped the departure check — a `threshold`/`after_transition` opening page slipped through with no established origin.
- **Fix:** a first-iteration guard rejects **only** `threshold`/`after_transition` on page 1 (`steady` and `before_transition` stay valid). Every non-first-page path — incl. 19749078's threshold-then-`after_transition` continuation — is untouched.
- **Validation:** 4 tests (threshold-first → fail, after_transition-first → fail, steady-first → pass, before_transition-first → pass). Verified repo-wide that no golden fixture has a non-steady opening page, so none regress.

**`e83af94d` C3 — reconcile a resume-path freeze outcome-unknown** (Codex C3, money-adjacent).
- **Seam:** the resume-path `ensureFrozenVisualContract` call sat **outside** the main `try` in `processGenerationChunk` (`chunk-runner.ts`), but the freeze barrier CAN throw `AtomicOperationOutcomeUnknownError` (the module wraps only the *produce* step, not the `withDeliveryInputMutation` barrier) → on a resume it would escape the `isOutcomeUnknown` handler and bubble to the caller, risking inconsistent Order/Job state.
- **Fix (pure relocation, handler structure UNCHANGED):** moved the call to the first statement **inside** the `try` (before the `while`). Both freeze sites (resume + fresh dna→cover) now share the `isOutcomeUnknown` reconciliation: leaves Order/Job intact, opens an `infra_transient` recovery case (flag-on) for a fence-reconciling redrive, returns `{ stage: 'outcome_unknown' }`. **No `inputVersion` double-bump** — the freeze operationKey embeds `contractHash`, so a redrive replays the receipt exactly-once (the single `inputVersion++` never re-runs). **No refund** — `infra_transient` is a reconcilable non-terminal (redrive), not a refund. **Normal-path order unchanged** (freeze still runs before the loop / any paid image); **flag-off** → no-op.
- **Validation:** no dedicated unit test (the chunk-runner main loop is staging-driven; the outcome-unknown reconciliation itself is covered by `atomic-operation` / `atomic-barrier-wiring` tests). Diff is the relocation only.

---

## Round-2 fixes (6 commits, `e83af94d..9c7c0c26`) — you re-reviewed the 9 and found these before activation
Every P1-1/P1-2 test uses the **MULTI-ZONE clinic canary** (one story, waiting_room → exam_room), not a single-zone toy; P1-3/P1-4 test the **PRODUCTION** functions.

**`82f1ec3e` P1-1 — per-page transitions (the A2a location leak was NOT fully closed)** (efficacy).
- **Seam:** `transitionRulesOf` flattened ALL non-steady page transitions into `bible.transitionRules`, which the consumer emitted as a global `TRANSITION RULES:` block on **every** page (`story-location-bible/compose.ts`) — so an early waiting-room page saw "enter exam room" cues.
- **Fix:** `PageLocationPlan` gains a per-page `transition`; `toPageLocationPlan` projects `pc.transition`; `contractToLocationPlanBundle` sets `transitionRules: []` (retires `transitionRulesOf`). The consumer emits ONLY the current page's transition (`describePageTransition`): a `steady` page emits none; a `before_transition` page signals the PENDING move WITHOUT revealing the destination; `threshold`/`after` name it. Legacy books keep their global block (contract books now empty).
- **Validation (multi-zone clinic):** page 1 (waiting, steady) block free of all later pages' cues + no `PAGE TRANSITION`/`TRANSITION RULES`; page 2 (before) keeps origin geometry, its transition line reveals no destination; page 3 (threshold) carries its own doorway move; page 4 (after) is in the exam room.
- **Flag-off:** consumed only under `VISUAL_CONTRACT_STEERING`; legacy plans have no `transition` → byte-identical.

**`5767239c` P1-2 — single-room SET TOPOLOGY LOCK only for a genuine one-room story** (efficacy).
- **Seam:** `setTopologyOf` (`adapters.ts`) fired for ANY `locations.length === 1`, so a one-location/multi-zone story got "SET TOPOLOGY LOCK (same room every page …)" + "Do not add furniture or props not listed here" — contradicting the zone change and banning the destination furniture; its `layout` element also leaked the location adjacency ("waiting room adjoins the exam room").
- **Fix:** fire ONLY when `locations.length === 1 && zones.length === 1`. Multi-zone geometry rides on the zone's own `description`. (The leaky per-zone `stableGeometry` — the location adjacency — was left populated here and marked "dormant/unconsumed" by P1-2b. **That was WRONG: round-3 / P1-2c proved it IS consumed via scene-memory and set it empty — see the Round-3 fix.**)
- **Validation (multi-zone clinic) — block-level end-state:** the waiting page's ENTIRE assembled block is free of `SET TOPOLOGY LOCK` / "same room" / "no unlisted props" / "adjoins the exam room" / `/exam[_ ]?room/i`; the exam page carries its own geometry and doesn't forbid exam furniture; a true 1-loc/1-zone story still gets the lock. **⚠ This proof was BLOCK-LEVEL only — it called `buildLocationContinuityPromptBlock` WITHOUT threading `sceneMemory`, so it never exercised the scene-memory path where the adjacency actually leaked. Round-3 / P1-2c closes that gap (FULL-PATH proof).**
- **Flag-off:** contract-projection only; legacy `deriveBookLocationBible` books untouched.

**`07680cad` P1-2b — mark the (believed-dormant) `stableGeometry` re-leak trap** (docs only). An in-code warning at `toLocationZone`'s `stableGeometry` line + a "Known dormant defects" note. No behavior change. **⚠ The "dormant/unconsumed" premise was WRONG — corrected by P1-2c below (it was a live scene-memory leak).**

**`f92a9eef` P1-3 — contract-stale recovery CONVERGES** (💰 MONEY — **your specific attention**).
- **Seam:** `reQaUnknownQualityEvidence` (`quality-recovery.ts`) read `activeContractHash` but did NOT `select` `contractHash` and its `admissible` test did NOT check it → a v1-`passed` row on the current bytes was judged admissible while the order was now v2 → never re-QA'd → never rebound → readiness loops on `contract_stale` → `QUALITY_REGEN_BUDGET` exhaust → refund.
- **Fix:** `select` `contractHash`; add `!isQualityEvidenceContractStale(row.contractHash, activeContractHash)` to `admissible`, so a contract-stale row is INADMISSIBLE → falls through to re-QA, which rebinds it to the active hash (`persistDeliveredQualityEvidence` already passes `contractHash: activeContractHash`) → converges. Existing admissible criteria kept as additional necessary conditions; `null/null` not stale → legacy/flag-off unchanged.
- **Validation — the PRODUCTION function** `reQaUnknownQualityEvidence` end to end (NOT a hand-simulated already-rebound row, which is what hid the bug): a stored v1-`passed` row on current bytes + order at v2 → re-QA runs, rebinds to v2, becomes admissible, converges; a matching v1/v1 row stays admissible with no needless re-QA.

**`9156b51c` P1-4 — asset receipt key+payload bind the contract hash** (💰 MONEY — **your specific attention**).
- **Seam:** the cover/page asset callbacks write `contractHash` via `persistQualityContext` (atomic with the asset, #6-fix-3), but the `mutationPayload` and URL-based `operationKey` OMITTED it → receipt replay (ON CONFLICT DO NOTHING) never re-runs the callback → a same-URL redrive under a NEW contract replayed the OLD binding (compounding P1-3).
- **Fix (Option A):** include `contractHash` in BOTH `mutationPayload`s AND append `:${renderedContractHash}` to each `operationKey` ONLY when non-null. Same-URL/new-hash → a NEW fenced operation re-runs the idempotent asset write + the fresh binding; same-URL/same-hash → replay; freeze-off (null) → suffix omitted, no `contractHash` → operationKey + payload byte-identical. The atomic asset+context binding from #6-fix-3 is preserved (NOT split); the asset write stays idempotent on its URL.
- **Validation:** pure helpers `lib/generation-pipeline/contract-hash-binding.ts` (`coverAssetOperationKey`/`pageAssetOperationKey`/`contractHashPayloadFragment`) unit-tested — freeze-off byte-identity, freeze-on binding, new-hash → different key (cover AND page), same-hash → same key. **Real fence behavior (a new op actually re-running the callback) is staging-confirmable.**

**`9c7c0c26` P2 — capture the render-time contract hash BEFORE the paid image call** (hardening). Moved `renderedContractHashOf(cache)` to before `generateBookCover` / `generateAllPageImages` at both sites (one book-level page capture ahead of the loop), so "the contract that rendered these bytes" is structural, not incidental. Pure relocation — the value is identical (local cache not mutated by render); the same value threads into the operationKey, payload fragment, `persistQualityContext`, delivered-evidence, and observability at each site.

---

## Round-3 fix (1 commit, `9c7c0c26..b846c47b`) — you re-reviewed the 15 and found P1-2 STILL leaked
You confirmed P1-1 / P1-3 / P1-4 / P2 closed, but flagged **P1-2 as still open**: `stableGeometry` is NOT dormant — it is consumed. Verified chain: a multi-zone book with **no `setTopology`** (exactly the P1-2 end-state) makes `resolveSceneMemoryPlan → seedSceneMemoryPlan` fall through (`lib/scene-memory/seed.ts:244-249`) to **`stableFactsFromZoneGeometry`** (`:143`), which reads `zone.stableGeometry` and manufactures a SCENE MEMORY LOCK stable fact — the location adjacency ("waiting room adjoins the exam room") — emitted on **every** page. The round-2 block-level proof passed ONLY because it never threaded `sceneMemory` into `buildLocationContinuityPromptBlock`, bypassing this path.

**`b846c47b` P1-2c — empty the per-zone `stableGeometry` (close the scene-memory leak)** (efficacy).
- **Seam:** `toLocationZone` (`adapters.ts`) set `stableGeometry: topology ? [topology] : []`, projecting the location's inter-zone ADJACENCY onto every zone. Not read by the prompt directly, but **consumed by scene-memory** (`stableFactsFromZoneGeometry`) → SCENE MEMORY LOCK on every page. **Audited all three readers:** `scene-memory/seed.ts:143` (the leak), `zone-object-reference-sheet.ts:49` (`STABLE GEOMETRY:` line), `style02-gptimage.ts:168` (scene-classifier haystack).
- **Fix:** `stableGeometry: []` **unconditionally** (the topology is adjacency, not the zone's OWN geometry). A genuine 1-loc/1-zone story keeps its geometry via the SET TOPOLOGY LOCK (`bible.setTopology`, independent of this). Removed the now-dead `topologyByLocation()` / `topologyFor` plumbing; replaced the wrong "UNCONSUMED" comment with the correct rationale. All three readers now get `[]` → none re-leaks.
- **Validation — the FULL PATH (the gap the block-level proof missed):** a new test runs `contractToLocationPlanBundle → resolveSceneMemoryPlan → buildLocationContinuityPromptBlock` on the multi-zone clinic — the waiting page carries NEITHER the exam-room adjacency NOR a cross-zone `SCENE MEMORY LOCK` (empty `stableFacts` → `buildSceneMemoryLockBlock` returns null → no block). The 1-loc/1-zone no-regression test now ALSO runs the full scene-memory path and proves geometry still arrives (via `setTopology`). The two round-2 tests that asserted the old projected adjacency were corrected. This test is a true regression guard: re-populating `stableGeometry` fails it.
- **Flag-off:** contract-projection only; legacy `deriveBookLocationBible` books untouched → byte-identical.

---

## Two precision corrections carried from WS0b (round-1 agent claims that were WRONG)
1. **`buildLocationContinuityPromptBlock` is LIVE, not test-only.** It is called by `buildResolvedLocationEnvironmentBlock` (`story-location-bible/index.ts`), which the Style-01 assembler calls. So A2a's `transitionRules`/`setTopology` genuinely reach the prompt through it — and `COVER_MYSTERY_LOCK` injects there on `isCover` independent of the page-0 plan, which is precisely why A2b was needed.
2. **The `C:\Users\guyna\source\repos\Small_Heroes` checkout is a STALE MIRROR.** The canonical tree is **`C:\GNart\Work\Small_Heroes`** — scope all greps/edits there.

## WS0c authoring requirement (record now — it's load-bearing for A2b)
Because A2b suppresses `COVER_MYSTERY_LOCK` and relies on `coverContract.mustNotShow` to carry the cover's no-spoiler/forbidden-reveal intent, **each of the 18 authored cover contracts MUST populate `coverContract.mustNotShow` with that story's forbidden reveals** — else a contract cover could start spoiling the payoff. The general procedure's **first-slot instance** is drafted at `outputs/cc-brief-WS0c-clinic-cover-contract-FIRST.md` (clinic/medical canary; DRAFT, not to execute until this set passes) — it is the FIRST of a GENERAL 18-artifact procedure (nothing story-specific).

**(P1-2c precision note — record for WS0c authoring):** the per-page transition `cue` string is reproduced **verbatim** by `describePageTransition` into the prompt (a `before_transition` page prints its cue while still in the origin zone). So **authored `cue` text MUST NOT contain destination spoilers** — a waiting-room "pending" cue must read e.g. "the nurse calls their name", never "time to go into the exam room". This is the authoring-side counterpart to P1-1: P1-1 stopped the ENGINE from leaking the destination, but the `cue` is the one field that passes author text straight through, so the no-spoiler burden there is on the author.

## C1 note (for the dynamic revival)
When dynamic-story compilation is revived (WS0c+ with a safe design), **`ENABLE_DYNAMIC_CONTRACT_COMPILE` should become a real env read (default OFF)**, not a hardcoded const flip.

---

## What we're asking Codex to confirm (round 4)
0. **(Round-4 focus) P1-2c closes the last leak** — `stableGeometry` emptied; the FULL-PATH proof (`resolveSceneMemoryPlan → buildLocationContinuityPromptBlock`) shows the multi-zone waiting page has NO exam-room adjacency and NO cross-zone SCENE MEMORY LOCK, while a 1-loc/1-zone story still gets its geometry via `setTopology`. **This is the ONLY new commit since round 3**; P1-1 / P1-3 / P1-4 / P2 you already confirmed closed.
1. **Activation-readiness of the whole 16-commit set** (round-1 9 + round-2 6 + round-3 1) — with all three flags off it's byte-identical today; turning them on (WS0c freeze; WS1 steering+enforcement) is now safe from the round-1 5 P1 + Group C AND the round-2 4 P1 + P2 AND the round-3 P1-2c leak.
2. **The efficacy fixes reach the ACTIVE live path on a REAL multi-zone story** (the round-1/round-2 miss): A1 → `assembleStyle01Phase2Prompt` output; A2a + **P1-1 + P1-2** → the location leak is closed with the **block-level** proof on the multi-zone clinic (waiting page free of any exam adjacency/contents; per-page transitions; no contradictory single-room lock); A2b → the live cover injection.
3. **💰 The money fixes — your SPECIFIC attention (round 2):** **P1-3** (contract-stale recovery converges — inadmissible → re-QA → rebind, tested via the production `reQaUnknownQualityEvidence`) and **P1-4** (asset receipt key+payload bind the contract hash — Option A, same-URL/new-hash → new fenced op runs the binding, freeze-off byte-identical). Plus round-1 B1 (no post-render re-read + contractHash in the fingerprint), B2 (single-key `jsonb_set`, no `GenerationJob` row-lock), B3 (steering⇒enforcement), C3 (resume freeze reconciled exactly-once).
4. Any residual to close **before** WS0c/WS1, notably the staging-confirmable items: B2's + **P1-4's** real Postgres `jsonb_set` / receipt-fence behavior, and B1/persist byte-binding under a real render.

## Posture / order
Flag OFF, nothing pushed, no renders, tree clean. **Order: Codex PASS → push WS0b → WS0c (author the 18 bank artifacts incl. `coverContract.mustNotShow`; turn `VISUAL_CONTRACT_FREEZE` on in a non-prod runtime) → WS1 (steering + enforcement ON together).** Nothing proceeds to WS0c/WS1 until this set passes re-review.

## Known defects — status
- **[RESOLVED in P1-2c / `b846c47b`] `toLocationZone` per-zone `stableGeometry` leak.** Round-2 (P1-2b) recorded this as a *dormant/unconsumed* trap — **that premise was WRONG.** `stableGeometry` was **consumed** by scene-memory (`stableFactsFromZoneGeometry` → SCENE MEMORY LOCK on every page) whenever a multi-zone book had no `setTopology`, re-leaking the location adjacency ("waiting room adjoins the exam room") onto every page. P1-2c empties it unconditionally and adds a FULL-PATH regression test. All three readers audited (`scene-memory/seed.ts:143`, `zone-object-reference-sheet.ts:49`, `style02-gptimage.ts:168`) — none re-leaks with an empty array. **No remaining known dormant defects in this set.**
