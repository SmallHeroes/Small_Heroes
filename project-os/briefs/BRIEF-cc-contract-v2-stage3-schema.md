# BRIEF (CC) — Contract v2, Stage 3: structured schema (Codex-reviewed)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC).
- **Target branch:** `feat/chunked-generation` (consolidated target; engine already merged here).
- **Gate status:** NON-[CODEX-GATE] (schema/types + validator integrity only — SEMANTIC enforcement is Stages 4/5). Commit locally; Guy pushes.
- **Parallelism:** the SINGLE CC session in `sh-wt-style01` — do NOT start a second concurrent CC session there.

## 2. SCOPE
Replace prose-as-authority with a typed, machine-checkable Contract-v2 schema — the foundation that fixes the fox visual defects (window↔door ambiguity, bucket drift, wrong-actor action). Two non-negotiables (Codex): (a) the typed fields become the **single source of truth**, and the LLM no longer independently authors the prose/projection fields — prose is **compiler-derived** from the structure; (b) the structures live on BOTH the template AND the render-resolved contract, so materialize/freeze/QA have the structured source. Schema + validator-integrity only; compiler REJECTIONS (Stage 4) and QA enforcement (Stage 5) come after. Source spec: `BRIEF-cc-contract-v2-qa-enforcement.md` (Stage 3).

## 3. FILES / AREAS
Add these typed structures on the **template AND the resolved/vNext** types (both — not template-only):
- `SpatialNode { id, kind, locationId, zoneId? }` — opening `kind` ∈ `window | balcony_door | doorway` (a SINGLE kind — never "window or door").
- `SpatialRelation { subjectId, relation (closed enum), objectId }`.
- `PagePropConstraint { propId, visibility: required|forbidden|optional, stateId?, anchorId? }` + a prop `firstRevealPage` lifecycle.
- `PageActionRequirement { checkId (stable), actorId, predicate, objectId?, anchorId?, polarity }`.
- `SafetyConstraint { subjectId, relation (must_not_sit_on | must_remain_behind | must_be_supported_by | …), targetId, origin }` — hazard relations, NOT crude booleans (no `feetOnFloor`).

Files:
- `lib/visual-contract-compiler/types.ts` (~line 40) + `contractTemplateTypes.ts` (~line 116; note it reuses `VisualLocation/VisualZone/CoverContract/PageVisualContract` at ~123–130 → the new structures must reach the **resolved/vNext** shape too).
- `templateDraftSchema.ts` — add the typed fields to the draft schema.
- **`compileBookVisualContractTemplate.ts` (~line 149 + 186)** — the compiler currently asks the LLM to draft `stableGeometry / mustShow / mustNotShow / propState / camera / transition`. **Remove the LLM's independent authority over these projection fields**; the LLM authors the TYPED fields, and the compiler DERIVES the prose projections from them.
- **`validateTemplateContract.ts` (~line 149 + 165)** — it validates via a vNext shadow; the new Contract-v2 fields need **real template validation there**, not just TypeScript interfaces. Also `validateBookVisualContract.ts`.
- `stableGeometry / mustShow / mustNotShow / action prose` → deterministic **derived projections** of the structure (single source of truth).

## 4. ACCEPTANCE CRITERIA
- Typed structures exist on **template AND resolved/vNext**; prose fields are **compiler-derived** — the LLM no longer authors them independently.
- Opening is always ONE typed `SpatialNode.kind`; the **validator rejects an impossible enum** (e.g. "window or door") — schema integrity (NOT Stage-4 semantic enforcement).
- `SafetyConstraint` uses hazard relations, not `feetOnFloor`-style booleans.
- **Version rule (Codex):** new render-contract fields are **additive/optional** so `VISUAL_CONTRACT_SCHEMA_VERSION` stays unchanged here (coordinated bump owned by Stage 9); BUT **bump `TEMPLATE_DRAFT_SCHEMA_VERSION`** since the draft shape changes (else provenance lies).
- Backward-compatible: existing templates still validate/materialize.

## 5. TESTS
- Projection tests: `mustShow` / `stableGeometry` are **derived outputs** of the structure (not independently authored).
- Validator rejects an impossible opening enum; a prop `firstRevealPage` and a hazard `SafetyConstraint` round-trip on both template and resolved.
- The resolved/vNext contract carries the structures (materialize path sees them).
- Existing template/compiler/materialize/validate specs stay green.

## 6. WHAT NOT TO TOUCH
- The Stage-1 safety/delivery track — explicitly **no edits** under `lib/generation-pipeline/quality-*`, `readiness-manifest.ts`, `page-visual-qa.ts`, `package-delivery.ts`, or `chunk-runner.ts` — **EXCEPT** if `npm run check` exposes an import-only compile failure, in which case **STOP and report** rather than expanding scope.
- Do NOT implement compiler REJECTIONS (Stage 4) or QA enforcement (Stage 5) — schema + enum-integrity only.
- Do NOT bump `VISUAL_CONTRACT_SCHEMA_VERSION` (Stage 9 owns the coordinated bump + migration). (The `TEMPLATE_DRAFT_SCHEMA_VERSION` bump IS in scope — see Acceptance.)

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; **Guy pushes**.

## 8. FINAL VERIFICATION
- `npm run check` green (tsc --noEmit + full vitest), no regressions.
- Report: the new types (template + resolved), the projection derivation (LLM no longer authors prose), the vNext-shadow validation, the `TEMPLATE_DRAFT_SCHEMA_VERSION` bump, the file diff, and confirm ZERO edits to the Stage-1 track. Then STOP — Stage 4 (compiler rejections) is the next brief.
