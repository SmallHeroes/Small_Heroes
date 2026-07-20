# BRIEF (CC) — consolidation Phase 1: foundation (preserve dirty → reconcile main → merge engine)

**⚠️ TARGET BRANCH: `feat/chunked-generation`** (worktree `sh-wt-style01`, tip `7093f890`). CC performs the merges + conflict resolution locally, `npm run check` green after EACH step, commits locally. **Guy pushes** (CC can't git-auth).
**Source:** Codex consolidation audit (`PLAN-consolidation-to-main.md`). This is Phase 1 only. **No money merges here** (those are Phase 4, Codex-gated).
**Hard rules:** `fetch` first; **NEVER `git add -A`** — explicit pathspecs only; never force-push; if any conflict is NOT an obvious "keep target", **STOP and ask Guy** — do not guess. Record a **ledger** line per merged feature (feature → replacement target SHA) in `project-os/02-decision-log.md` or a new `project-os/CONSOLIDATION-LEDGER.md`.

## Step 1 — preserve dirty work FIRST (do not lose anything)
- `git status` in BOTH worktrees (`sh-wt-style01` and the primary). Identify untracked/modified assets: `_review/` visual-contract candidates, OTP mockup, READY mockups, `project-os/` docs.
- Confirm what is gitignored (scratch, safe) vs genuinely-uncommitted work that must survive the merges. **Do NOT `git add -A`.** If anything real is uncommitted, commit it with an explicit pathspec on its correct branch OR copy it aside first. Report the disposition before proceeding.

## Step 2 — reconcile `origin/main` into target
- `git fetch origin`.
- Merge `origin/main@fdfd2469` into `feat/chunked-generation`. Trial merge = **13 conflict regions**; the main-only squash is already functionally represented on target, so the rule is **retain newer TARGET behavior** on each conflict. For any conflict where "keep target" is not clearly correct → STOP, ask Guy.
- Record the target SHA that represents each main feature (ledger).
- `npm run check` green (tsc + full vitest). **Checkpoint — report before Step 3.**

## Step 3 — merge the engine `feat/live-authoring-fix@37299b3c` into target `--no-ff`
- 8 valuable compiler commits (pipeline, parser, schema, appearance, topology, `assertSourceProse`, `templateDraftSchema`, companion-presence).
- Trial merge = **1 textual conflict in `contractTemplateTypes.ts`** → **keep `parent` in `RELATIVE_ROLES`** while accepting the engine's changes to: `backend/providers/pipeline.ts`, `lib/story-validators/parser.ts`, `lib/visual-contract-compiler/{contractTemplateTypes,validateTemplateContract,appearancePalette,appearanceBindingCoherence}.ts`, and the new `assertSourceProse.ts` / `templateDraftSchema.ts` / companion-presence validation.
- `npm run check` green. **This lands the engine on the render branch = the prerequisite for Contract v2.**
- Record ledger: `feat/live-authoring-fix → <merge SHA>`.

## Acceptance / handoff
- After each step: `npm run check` green (tsc --noEmit + full vitest), no regressions.
- Ledger updated (main features + engine → their target SHAs).
- Nothing deleted yet (archive/delete is later, only after replacement SHAs recorded).
- Explicit pathspecs throughout; commits local on `feat/chunked-generation`; **Guy pushes**.
- Report: the conflict resolutions taken (esp. the 13 main conflicts + the `parent` one), the ledger lines, and confirmation the engine merged clean. Then Phase 2 (reader/narration) + Contract v2 can proceed on the consolidated target.
