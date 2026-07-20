# BRIEF (CC) — Contract v2, Stage 4: compiler rejections + projection containment

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target branch:** `feat/chunked-generation` (Stage 3 = `23948ab7`).
- **Gate status:** NON-[CODEX-GATE] (deterministic compile-time rejections; enforcement-at-render is Stage 5). Commit locally; Guy pushes.
- **Parallelism:** the **SINGLE** CC session in `sh-wt-style01`. Do NOT start a second concurrent CC session — the 2026-07-15 double-Stage-3 overlap must not repeat.
- **⚠️ BRANCH PRE-CHECK (do FIRST, before any edit):** run `git branch --show-current` — it MUST be `feat/chunked-generation`. If it shows `feat/live-authoring-fix` (merged + superseded via Phase 1) or anything else → `git checkout feat/chunked-generation` first. ALL Contract-v2 stages + Stage 1 safety + reader/niqqud/payment live on this ONE branch — nothing may be stranded on another branch. Confirm HEAD is `23948ab7` (Stage 3) before starting.

## 2. SCOPE
On top of Stage 3's structured schema, make the compiler **reject deterministically** at authoring time, and wire the `mustShow`/`mustNotShow` **containment** rule TIER-B deferred from Stage 3. No render/QA enforcement (Stage 5), no version bumps beyond the draft schema, no re-mint (Stage 9). Source: `BRIEF-cc-contract-v2-qa-enforcement.md` (Stage 4) + Codex compiler ruling.

## 3. FILES / AREAS
- `compileBookVisualContractTemplate.ts` — the deterministic reject list (feeds the existing bounded repair loop with precise errors).
- `validateBookVisualContract.ts` / `validateTemplateContract.ts` — the rejection rules + the containment check.
- `projectContractProse.ts` — wire TIER-B containment (projection ⊆ stored) now that Stage 3 shipped it pure+unwired.

Reject (fail-closed) when:
- any node / actor / target / prop / transition reference does not resolve;
- a relation is self-contradictory, incompatibly duplicated, or violates zone connectivity;
- an actor is absent from that page's `castIds`;
- a prop is allowed before its `firstRevealPage`, or required AND forbidden on the same page;
- a required action conflicts with a visibility or safety constraint;
- a source-evidence quote does not occur on its claimed page;
- any enforcement-relevant page lacks a resolved `checkId`.
Do NOT phrase-lint "not required" — compile explicit source negatives into structured **polarity + exact source citation**.

TIER-B: `mustShow` / `mustNotShow` are multi-source — enforce **containment** (the structured projection ⊆ the stored prose), NOT equality (equality would drop zone exclusions / style guards / spoiler prose).

## 4. ACCEPTANCE CRITERIA
- Each reject rule fires on a crafted bad input and produces a precise, repair-loop-consumable error; a valid contract passes untouched.
- `mustShow` containment holds (projection ⊆ stored); a projected requirement missing from stored is rejected; extra stored steering is allowed.
- **Stage-3 flags resolved:** decide `visibility:'optional'` (drop it if it emits no steering yet moves the hash, per Codex) — document the decision; tighten `mustShow`/`coverContract.mustShow`/`mustNotShow` validation (currently `[]`/`['']` pass; cover validated nowhere) — but a contract-load throw is silently swallowed by freeze, so gate carefully / flag if risky.
- The 3 committed contract artifacts still validate + hash unchanged (the Stage-3 canary stays green).

## 5. TESTS
- One negative test per reject rule (reference-unresolved, actor∉castIds, prop-before-firstReveal, required+forbidden, source-quote-not-on-page, missing checkId, contradictory relation).
- Containment tests: projection⊆stored passes; a dropped projected requirement is rejected; extra stored steering passes.
- `visibility:'optional'` decision test; the mustShow/cover validation tightening tests.
- Existing compiler/validate/materialize + the Stage-3 canary stay green.

## 6. WHAT NOT TO TOUCH
- The Stage-1 safety/delivery track (`quality-*`, `readiness-manifest.ts`, `page-visual-qa.ts`, `package-delivery.ts`, `chunk-runner.ts`) — EXCEPT an import-only compile failure → STOP and report.
- Do NOT implement Stage-5 render/QA enforcement or Stage-9 re-mint here.
- Do NOT bump `VISUAL_CONTRACT_SCHEMA_VERSION` (Stage 9).

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; **Guy pushes**.

## 8. FINAL VERIFICATION
- `npm run check` green (tsc + full vitest), zero regressions (baseline 1627).
- Report: each reject rule + its test, the containment wiring, the `visibility:'optional'` decision, and confirm zero edits to the Stage-1 track. Then STOP.
- **After this stage:** Cowork's recommendation is to hand-author structured fields on ONE slot (fox) and render a 5-page sample to PROVE the window↔door / bucket-drift defects are fixed, BEFORE building Stages 5-9. Flag readiness for that proof in the report.
