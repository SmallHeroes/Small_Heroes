# BRIEF (CC) — Contract v2 PROOF: hand-author fox structured contract (authoring only, NO render)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target branch:** `feat/chunked-generation` (HEAD = `e9f84fa2`, Stage 4).
- **Gate status:** NON-[CODEX-GATE] — data/authoring + validation only. No money/safety code, no engine code, **no render**. Commit locally; Guy pushes.
- **Parallelism:** the SINGLE CC session in `sh-wt-style01`. Do NOT start a second concurrent CC session.
- **⚠️ BRANCH PRE-CHECK (FIRST, before any edit):** `git branch --show-current` MUST be `feat/chunked-generation`; confirm HEAD is `e9f84fa2`. If not → `git checkout feat/chunked-generation` first.
- **⚠️ This is a HAND-authoring pass by design.** Stage 9 will make v2 fields LLM-authorable; until then structure is authored by hand. Do NOT wire this into the wizard / auto-gen path — it's a proof of the mechanism on one slot.

## 2. SCOPE
Prove the Contract-v2 mechanism on ONE slot (fox) by hand-authoring its structured fields so the **compiler-derived prose** fixes the 4 visual defects from the first fox render — **without changing any engine code**. Output = a fox `.visual-contract-template.json` whose Stage-3 structures are Stage-4-valid and whose Tier-A/B projections encode the fixes. No render here (that's Guy's operator step). No engine / QA / schema changes.

**Defects to encode as TYPED structure (map to the actual fox pages you hold):**
- **window↔door:** page-1 opening = `SpatialNode.kind = window` at a realistic sill height (relation to floor/child); page-2 opening = `kind = balcony_door` (or `doorway`/vitrine per the text) — a per-node kind, NEVER "window or door".
- **bucket drift:** the bucket = a prop with a STABLE `SpatialRelation` (`on`/`above`/`below` a fixed `ledge`/anchor) repeated identically on every page it appears; one `PagePropConstraint` + a single `firstRevealPage`.
- **wrong-actor notebooks:** the notebook beat = a `PageActionRequirement` with ONE `actorId` (child OR Uri per the story — not both), polarity set so only that actor holds it.
- **railing safety:** `SafetyConstraint` `must_not_sit_on`(child, railing) (or `must_remain_behind`) on the relevant page(s) — this also exercises the certified Stage-1 safety gate end-to-end.

Then: rewrite fox's `stableGeometry` to BE the structure's derived projection (**Tier A**), and ensure `mustShow`/`mustNotShow` **contain** the projections (**Tier B**).

## 3. FILES / AREAS
- The fox `.visual-contract-template.json` (hand-edit the structured fields + the Tier-A/B projections).
- **NO engine code.** If validation forces a compiler/validator change → **STOP and report** (that means Stage 3/4 missed a case — a finding, not a fix to make here).

## 4. ACCEPTANCE CRITERIA
- Fox template **VALIDATES** under Stage-3 + Stage-4 rules (structures resolve; relations coherent; checkIds unique; source-evidence quotes occur on their page; mustShow containment holds).
- Each of the 4 defects is encoded as **typed structure, not prose**: per-node window/door kind, stable bucket relation, single-actor notebook action, railing `SafetyConstraint`.
- **Tier A:** `stableGeometry` == the derived projection. **Tier B:** projections ⊆ `mustShow`/`mustNotShow`.
- **Do NOT re-compile fox** — `assembleTemplateFromDraft` passes `draft.zones` verbatim, so a re-run silently DROPS the hand-authored structure. Edit the template artifact directly; verify by validation, not by recompile.
- Fox template re-hashes (expected — a template is not pinned to a paid order). The bunny canary (`1ecfdcb2…`) stays green.

## 5. TESTS
- A test that loads the edited fox template and asserts it validates (Stage 3+4) and that the 4 structures are present + resolve (per-node opening kind; stable bucket relation; single notebook actor; railing SafetyConstraint).
- `npm run check` green (baseline 1656).

## 6. WHAT NOT TO TOUCH
- Stage-1 safety track (`quality-*`, `readiness-manifest`, `page-visual-qa`, `package-delivery`, `chunk-runner`) — no edits.
- No engine / compiler / validator / schema changes (authoring only). No render. No wizard wiring. No `VISUAL_CONTRACT_SCHEMA_VERSION` bump.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; **Guy pushes**.

## 8. FINAL VERIFICATION
- `npm run check` green; report the fox template diff, the 4 encoded structures, Tier-A/B confirmation, and that fox was **NOT** recompiled. Then STOP.
- **NEXT (Guy operator step, NOT CC):** render a 5-page fox sample (the defect pages) on staging with flags ON (freeze + steering + enforcement + readiness), LOW quality, and eyeball window↔door + bucket + notebook actor + railing. If the railing image is unsafe, the certified safety gate HOLDS delivery (correct) — the images stay viewable in the QA console for the eyeball.
