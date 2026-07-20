# BRIEF (CC) — Contract v2 + QA enforcement (Codex-reviewed, staged)

**⚠️ TARGET BRANCH: `feat/chunked-generation`** (consolidated target — engine already merged via Phase 1). Every commit here.
**Origin:** Codex spec review = ADJUST→GO. This is the #1 sellability work (safety + consistency + QA enforcement). **Large — execute in STAGES, `npm run check` green after each, commit per stage, no push.** Stages marked **[CODEX-GATE]** are money/lifecycle/hold changes — Guy routes to Codex before merge; do NOT self-certify.

Do NOT delete/soften the existing `contract_world:` hard-hold (`quality-evidence.ts:155`, `readiness-manifest.ts:359`) — build on it.

---

## Stage 1 — P0 universal SAFETY evaluator (ships FIRST, standalone, NOT a Contract-v2 field) [CODEX-GATE]
Extend the existing high-detail page visual-QA call (`page-visual-qa.ts:365`) with required **safety booleans + explicit hazard flags** (e.g. child-on-railing / unsupported-at-height). This protects **contract-less stories too** (no extra vision call).
- Bump `QUALITY_EVALUATOR_CONTRACT_VERSION` from `qa-v2`.
- Classify safety failures as **non-soft-deliver HARD HOLDS**; require `READINESS_MANIFEST_ENABLED`.
- Result: the railing pose (and hazards generally) BLOCK before delivery, for every story. This alone closes the P0 launch-blocker.

## Stage 2 — close the two render bypasses [CODEX-GATE]
2a. **Activation invariant.** `isVisualContractSteeringEnabled()` (`contractRenderGuards.ts:64`) requires enforcement but NOT readiness; the evidence producer no-ops when readiness is off (`quality-evidence-producer.ts:228`). Add ONE code-level invariant: freeze + steering + enforcement + readiness must all be on together — a half-enabled render **blocks before any paid image**.
2b. **Contract-aware paid-asset reuse.** Reuse today keys on `pageId OR idempotencyKey` and any valid URL skips paid gen (`paid-artifact-guard.ts:5`); the idempotency key has no contract hash (`artifact-keys.ts:5`). Add an **immutable `ImageAsset.renderContractHash`** (aka renderInputHash); **reuse ONLY when it matches** the current resolved contract hash. (Putting the hash only in the later write-receipt does not protect the earlier skip decision.)

## Stage 3 — Contract v2 structured schema
Replace prose-as-authority with typed structure:
- `SpatialNode { id, kind, locationId, zoneId? }` — opening kinds `window | balcony_door | doorway` (NOT one `openingType` field on a whole scene).
- `SpatialRelation { subjectId, relation (closed enum), objectId }`.
- `PagePropConstraint { propId, visibility: required|forbidden|optional, stateId?, anchorId? }`.
- `PageActionRequirement { checkId, actorId, predicate, objectId?, anchorId?, polarity }`.
- `SafetyConstraint { subjectId, relation (must_not_sit_on | must_remain_behind | must_be_supported_by | …), targetId, origin }` — **hazard relations, NOT crude booleans** like `feetOnFloor` (which wrongly rejects sitting/bed/carried-child).
- `stableGeometry` / `mustShow` / `mustNotShow` / action prose remain **deterministic human-readable PROJECTIONS of the structure — NOT independently-editable gate authorities** (today free strings: `types.ts:73`, `types.ts:180`; validator only checks non-empty array: `validateBookVisualContract.ts:86`).

## Stage 4 — Compiler deterministic rejections
Reject (fail-closed) when: any node/actor/target/prop/transition reference doesn't resolve; a relation is self-contradictory, incompatibly duplicated, or violates zone connectivity; an actor is absent from that page's `castIds`; a prop is allowed before `firstRevealPage`, or required+forbidden on the same page; a required action conflicts with a visibility/safety constraint; a source-evidence quote does not occur on its claimed page; any enforcement-relevant page lacks a resolved `checkId`.
**Do NOT phrase-lint "not required"** — compile explicit source negatives into structured **polarity + exact source citation**. The bounded repair loop (`compileBookVisualContractTemplate.ts:595`) consumes these precise validator errors.

## Stage 5 — QA enforcement = page-relevant projection [CODEX-GATE]
Pass the **complete page-relevant projection** (NOT every page/prop in the book) to the QA adapter — stop dropping fields at `adapters.ts:466`. Each check carries a **stable `checkId`**; the QA response must contain **exactly one result per required ID** — no missing / duplicate / unknown (missing → `evidence_unknown`). Fix the weak completeness gate (`page-world-qa.ts:71`) and the pose/out-of-frame leniency (`page-world-qa.ts:50`). Expand failure codes: **safety, wrong-actor, lifecycle-visibility, required-missing, forbidden-present, topology-relation** — all retaining `contract_world:` hard-hold.

## Stage 6 — cross-page continuity (NOT pure-pixel-deterministic)
1. Deterministic static-graph validation; 2. per-page vision observations keyed by **relation ID**; 3. a deterministic aggregator comparing observations across pages, allowing **only declared transitions**.

## Stage 7 — Set BOARD (Section E — board, NOT composed plate)
- Make the approved board a **durable Supabase artifact** (today DEV/QA-only local: `board.ts:13`). Keep the character-free isolated-studies design that forbids room composition (`board.ts:99`).
- Fixed non-spoiler structural studies on the base board; attach **prop cards only when the lifecycle permits visibility**.
- Replace the story/page-specific bucket gating (`zone-sheets.ts:117`) with Contract-v2 lifecycle data; deprecated scene-set refs stay off page-gen (`zone-sheets.ts:24`).
- Attach the board **selectively** to establishing/wide/risk pages; the **structured graph steers every page**.

## Stage 8 — human-hold release workflow
Full enforcement creates more `needs_human_qa` books. Prisma has review columns but no writing endpoint yet (`schema.prisma:709`). Add **review / re-render / re-QA actions bound to `assetSha256 + contractHash`** so held books can be resolved.

## Stage 9 — hash + re-mint migration [CODEX-GATE]
- Bump `BOOK_VISUAL_CONTRACT_VERSION`, `VISUAL_CONTRACT_SCHEMA_VERSION`, `TEMPLATE_DRAFT_SCHEMA_VERSION`, `MATERIALIZER_VERSION` (**NOT `PALETTE_VERSION`** unless palette behavior changes). Canonical hash covers the resolved object (`contractHash.ts:16`); a new hash correctly invalidates old QA evidence (`quality-check-result.ts:100`).
- Migration policy: **re-mint + human-approve all 18 templates offline as ONE bank release**; new orders use v2; **existing paid/in-flight orders stay PINNED to their frozen v1 contract**; **never silently re-freeze an order after its first paid image**; a deliberate migration uses a new generation revision + the Stage-2b contract-aware reuse/re-QA policy.

---

## Validation gate (after Stages 1–9)
A **5-page LOW sample** (opening / window→balcony transition / counting / page-before-bucket-reveal / reveal). Only after it passes contract + safety + continuity + narration → a full render is justified. Do NOT run a full book before the 5-page sample passes.

## Hygiene
`npm run check` green after EACH stage; explicit pathspecs; commit per stage on **`feat/chunked-generation`**; no push. Report each stage; for the **[CODEX-GATE]** stages (1, 2, 5, 9) stop for Guy→Codex re-gate before they're considered done. Record any version bumps + the migration plan in the consolidation ledger.
