# R1D Book-Surface Admission Compact Fallback — Decision Gate

**Date:** 2026-08-17
**Owner decision:** approved under Guy's standing instruction to continue autonomously toward the first QA Wizard render, while preserving every canonical and independent-QA gate
**Base:** `e983eaaaf92dbc2fc8b8ec88aea6428b803879ab`
**Branch:** `codex/r1d-book-surface-admission-compact-fallback`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

## 1. Proposed change

Preserve the existing exact `presentation_requirement_patch` authority as a bounded fallback only when all of the following are true:

1. the compiler has already derived a valid combined Presentation + Book Surface authority;
2. that combined Book Surface request alone fails the immutable local input-admission ceiling; and
3. the existing compact presentation request independently passes the same admission check.

The compiler then applies the exact presentation patch, fully recompiles, and lets the remaining pure structural family use the already-existing `book_surface_patch` route. It never widens either patch authority.

## 2. Why now?

The single consumed live attempt on pushed HEAD `e983eaaaf92dbc2fc8b8ec88aea6428b803879ab` was canonical and fail-closed but produced no candidate. Its receipt `a64f7144e8caa38b085653b827cd22a04ec65632818904e006e4c3fd88bf1f0b` records exactly three completed logical calls, two repairs, zero transport retries, no fallback, `$1.744545` nominal / `$1.919380` conservative cost, and terminal `draft_validation_repair_exhausted`.

The first response exposed the exact closed mixed family: eleven `closed_catalog_capability_gap` issues, cover projection, all twelve page final-structure issues, and recurring-props lifecycle. The compiler selected destructive `full_draft`. That response left latent presentation and structural failures and introduced one spatial-reference issue. The exact spatial patch resolved only its target; full validation then revealed the latent failures and the standard budget exhausted.

Repository tracing found the deterministic local route defect. The mixed catch derives both exact presentation targets and a valid combined Book Surface authority, then unconditionally clears the standalone presentation targets. If the combined Book Surface prompt exceeds input admission, the compiler discards that authority too, leaving only `full_draft`. The rejected prompt byte count is not persisted in the historical receipt, so the consumed artifact cannot byte-prove that particular branch; however, the observed typed family is the exact admitted combined family, and a deterministic live-shaped regression must reproduce both the rejection and the split-route admission before another live call.

## 3. Scope

This is a general compiler routing correction. It is not tied to Dini, a story, child, companion, page number, phrase, or provider response.

Likely files:

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler/lifecycle tests
- `CURRENT.md` and implementation evidence

## 4. Risk of hardcoding

Eligibility comes only from the already-typed Presentation Structural error, the already-validated combined Book Surface authority, and deterministic provider-admission checks. No prose, story key, observed page, companion, or receipt digest may participate in production logic.

## 5. Architectural decisions

1. The consumed live attempt is immutable and will never be retried.
2. An admissible combined `book_surface_patch` remains the first choice and retains current behavior.
3. The split fallback exists only after a successfully constructed combined Book Surface authority fails local input admission; unsafe, incomplete, ambiguous, or unrelated mixed families never gain compact authority.
4. The exact existing presentation targets are retained only for that condition, and only if their existing prompt/schema passes the same input-admission ceiling. Otherwise routing remains `full_draft` or fail-closed.
5. After the presentation patch, full compilation and validation run again. The remaining pure structural closed family may then use the existing `book_surface_patch`; no issue is waived or relabeled.
6. The route remains within the unchanged standard `3 / 2 / 0` calls / repairs / transport retries and `[40000, 32000, 36000]` output schedule. No general fourth call is added or widened.
7. No prompt text, prompt version, JSON schema, repair authority shape, model, service tier, reasoning, timeout, retry, fallback, candidate semantics, or `$5` fence changes.
8. No persisted envelope shape changes, so current versions remain unchanged. Exact Git HEAD and brand-new Fresh Readiness provide the execution cutover; historical artifacts remain immutable and readable.
9. Independent Claude Code QA must PASS the immutable implementation range before push, new Fresh Readiness, credential access, or another bounded live attempt. Any new live failure stops without retry.

## 6. Expected behavior after change

When a valid combined surface repair is too large but both split prompts independently fit, the bounded sequence is:

`initial mixed failure -> presentation_requirement_patch -> pure book_surface_patch -> candidate`

An admissible combined request remains:

`initial mixed failure -> book_surface_patch -> candidate`

Pure structural input admission failure, unsafe mixed issues, or an oversized presentation prompt retains the current conservative `full_draft` / terminal behavior.

## 7. Validation plan

- Deterministic 12-page live-shaped regression proving the combined Book Surface prompt is rejected by input admission while both split prompts are admitted.
- End-to-end route assertion: `[initial, presentation_requirement_patch, book_surface_patch]`, exactly three calls/two repairs, unchanged caps, candidate produced, no fourth call, and input draft unchanged.
- Existing admissible combined route remains one `book_surface_patch`.
- Existing pure structural route remains one `book_surface_patch`.
- Negative cases: combined authority absent or unsafe, presentation prompt also oversized, pure structural prompt oversized, malformed/duplicate/non-target patch output, and mixed residual after budget exhaustion all remain fail-closed.
- Focused tests, deterministic `npx --no-install tsc --noEmit`, `git diff --check`, then one literal `npm run check` only after focused green.
- Independent Claude Code read-only adversarial QA and correction re-gate if needed.

No image or render is part of implementation validation.

## 8. Cost impact

Implementation, tests, and independent source review cost `$0` in provider/image usage. No credential/provider/image/Vision/render call is authorized during implementation. After push and brand-new Fresh Readiness, one bounded live authoring attempt may run under its frozen `$5` ceiling; failure stops without retry.

## 9. Rollback

Revert the focused implementation and documentation commits. No artifact rewrite, data migration, storage/database change, production change, or historical cleanup is required.

## 10. Review assignment

Claude Code must try to falsify the exact admission predicate, preservation of the combined route, compact-presentation admission, full revalidation, pure-structural follow-up, unchanged call/cost/prompt/schema policy, rejection of unsafe/oversized alternatives, no fourth-call widening, input immutability, and historical readability.

Guy retains product/visual acceptance. Claude Cowork is not needed because this is a typed technical routing correction rather than a creative or UX decision.

## 11. Do not do

- Do not rerun either consumed attempt.
- Do not add retries, fallback, a fourth general repair, larger provider input/output budgets, a new model, prose parsing, or story-specific logic.
- Do not touch credentials during implementation/QA.
- Do not run Fresh Readiness, preflight, live authoring, Blueprint, Wizard, image, Vision, render, storage/database, deployment, or production before independent PASS.
- Do not rewrite or delete historical artifacts.
