# SmallHeroes — Current Technical State

**Updated:** 2026-07-22
**Maintainer:** Codex
**Working branch:** `main`; workflow milestone committed at `980560a2`

## Active task

Adopt Guy's new operating model and establish the minimal canonical documentation set before beginning the next implementation task.

## Pre-change observed behavior

- `AGENTS.md` named Codex as a planner/reviewer but sent default execution to Cursor.
- `CLAUDE.md` and `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md` named Claude as CTO and Cursor as executor.
- `project-os/03-agent-roles.md` and `project-os/04-task-routing.md` used a later model in which Claude Cowork operated the project and Codex was review-only.
- Root `PROJECT.md`, `ROADMAP.md`, `CURRENT.md`, and `QUALITY_GATES.md` did not exist.
- Dated handoffs and Project OS state snapshots disagree on current branch and workstream status.

## Expected behavior

One current authority chain and one discoverable source hierarchy:

1. Guy owns product and final product acceptance.
2. Codex owns and executes engineering.
3. Claude Code independently QA's Codex work and issues technical PASS/HOLD.
4. Codex fixes valid findings; Claude Code re-gates.
5. Claude Cowork consults on product and creative questions.

## Verified root cause

Role decisions accumulated over time without reconciling all auto-loaded and “current state” documents. Historical snapshots continued to present their old workflow as current. There was no minimal canonical root-document hierarchy to resolve conflicts.

## Decisions

- Guy's 2026-07-22 directive is the binding owner decision and supersedes DEC-008's review-only Codex model.
- The role transition is documentation/governance only. It does not authorize a product, runtime, generation, payment, QA-threshold, or production change.
- Historical handoffs remain unchanged as history.
- `project-os/NOW.md` and unrelated `_review/` and script files are pre-existing untracked user work and remain untouched.
- The local `feat/chunked-generation` branch is a separate implementation workstream and remains untouched by this milestone.

## Repository state verified before edits

- `main`: `b4813c04`, equal to `origin/main` and `origin/feat/chunked-generation`.
- Local `feat/chunked-generation`: `ef543312`, four commits ahead of `main`, with a 10-file render-loop Phase 1 diff.
- Tracked working tree: clean before this milestone.
- Pre-existing untracked files: `_review/*`, `project-os/NOW.md`, and `scripts/check-order-anchor-readiness.ts`.

## Files in this milestone

- Auto-loaded role instructions and workflow protocol
- Decision Gate/stop-check wording
- `PROJECT.md`, `ROADMAP.md`, `CURRENT.md`, `QUALITY_GATES.md`
- Active governance references in `project-os/`
- Workflow/source-of-truth notes in the Project Bible

## Commits

- `980560a2` — authority model, workflow protocol, Decision Gate, DEC-009, and active role/routing summaries.
- `02102a84` — canonical `PROJECT`, `ROADMAP`, `CURRENT`, and `QUALITY_GATES` documents plus historical-snapshot markers.
- This state checkpoint records the post-milestone branch graph and validation evidence.

## Current branch graph

- `main` contains the documentation transition and is ahead of `origin/main`; it has not been pushed.
- Local `feat/chunked-generation` remains at `ef543312` and contains four implementation commits absent from `main`.
- The feature branch does not contain the new canonical docs, so future integration must preserve both sides deliberately.

## Tests and validation

- `npx tsc --noEmit` — PASS (exit 0, 2026-07-22).
- Active-role cross-check — the four current role summaries agree; remaining old assignments are inside DEC-008 or explicitly historical descriptions.
- Named architecture/source paths — all checked paths exist.
- `git diff --check` / staged diff check — PASS; no whitespace error or broad EOL churn.
- Diff scope — documentation/governance only; no application, migration, generation, payment, or production file changed.
- Independent Claude Code review — pending by design.

## Blockers

No implementation blocker for the documentation transition. Independent QA PASS is intentionally pending Claude Code review.

## Next action

Send the adversarial handoff to Claude Code. After independent review and any required re-gate, investigate and gate the four-commit render-loop Phase 1 slice before any merge or further implementation.
