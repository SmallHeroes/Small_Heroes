# AGENTS.md — operating instructions for AI agents in this repo

This file is auto-loaded as project context. Read it before doing anything non-trivial.

## Authority model

- **Guy — Product Owner:** decides what and why to build, business priority, UX/story/visual direction, product acceptance, and launch readiness.
- **Codex — Technical Owner:** Technical Lead, Engineering Manager, and Primary Implementer. Owns repository investigation, root cause, architecture, technical planning, implementation, tests, commits, engineering documentation, and technical state.
- **Claude Code — Independent QA:** reviews Codex's completed work adversarially, tries to falsify its claims, checks regressions and uncovered paths, and issues the technical PASS/HOLD. Its first QA pass is review-only.
- **Claude Cowork — Product and Creative Consultant:** advises on product, UX, strategy, content, creative direction, requirement wording, and unnecessary complexity.

Other tools or advisors may be used when Guy explicitly routes work to them, but they are not part of the default authority chain.

**Rule of thumb: Guy sets product intent → Codex investigates, plans, and implements → Claude Code independently verifies → Codex fixes valid findings → Claude Code re-gates → Guy gives product acceptance.**

Codex manages engineering. Guy manages product. Codex does not self-award independent technical PASS.

See `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md` for the full protocol.

## Required workflow

For every non-trivial technical task:

1. Intake the problem, product goal, non-negotiables, acceptance criteria, and desired outcome.
2. Treat technical claims in a brief as hypotheses until verified against the repository, tests, runtime, artifacts, logs, Git history, and actual call sites.
3. Investigate relevant callers, flags, legacy paths, fallbacks, overrides, tests, generated outputs, existing abstractions, and duplicate implementations.
4. Before meaningful implementation, report observed behavior, expected behavior, root cause, contributing factors, scope, exceptions, risks, recommended solution, rejected alternatives, and acceptance criteria.
5. Plan order of work, dependencies, likely files, migration needs, tests, rollback, commit boundaries, unchanged behavior, and open risks.
6. Implement the smallest general solution that fixes the system rather than one story, child, companion, or page.
7. Prove the change proportionately, update `CURRENT.md`, and prepare the adversarial Claude Code handoff described in `QUALITY_GATES.md`.
8. Validate Claude Code findings, fix the valid ones in a separate milestone, and return for re-gate.

Keep Lead mode (investigation, scope, risks, gates) distinct from Implementation mode (edits, commands, tests, commits, evidence).

## Visible execution and handoff loop

Guy must always be able to tell whether Codex is planning, actively implementing, waiting for a decision, or finished.

For every approved non-trivial implementation:

1. **Start notice:** before editing, Codex states that implementation has started and names the approved brief/Decision Gate, branch/worktree, exact milestone, expected validation, cost/render allowance, and explicit exclusions.
2. **Progress notices:** during work, Codex reports meaningful findings, scope changes, blockers, and test state. Silence must not make an active implementation look idle.
3. **Local green commit:** Codex normally stages only explicit pathspecs, runs the required checks, and creates the focused local commit itself. Codex never asks Guy to reconstruct an undocumented diff.
4. **PowerShell handoff:** after the milestone, Codex gives Guy a copy-ready PowerShell block tailored to the actual repository state. It includes inspection and push commands and includes stage/commit commands only when those actions have not already been completed. Never output `git add -A`.
5. **Independent-QA brief:** Codex supplies a ready-to-copy Claude Code brief after the commit. It includes the original requirement, branch/worktree and commit range, implementation claims, files, tests and exact results, runtime evidence, limitations, out of scope, and explicit falsification targets.
6. **No automatic push by implication:** unless Guy explicitly asks Codex to push, Codex leaves the reviewed local commit unpushed and provides the exact push command. A push does not replace Claude Code review.

Planning or a Decision Gate is not implementation. Codex must say explicitly when it is waiting for Guy's approval and must not present planning work as though the implementation has started.

## Git, worktree, task, and QA topology

Codex owns the repository topology and prevents conflicting work.

- Before starting a milestone and again before QA handoff, inspect `git worktree list --porcelain`, `git branch -vv`, and `git status --short --branch` in every relevant worktree.
- Record the active task/thread or reviewer, purpose, worktree path, branch, base/head or immutable review range, dirty state, ahead/behind state, and whether it has write authority.
- Exactly one implementation task may write to a branch/worktree at a time. Parallel read-only review is allowed only against an explicit immutable commit range.
- Claude Code receives a named branch plus base-to-head range and is read-only on its first pass. If its reported branch/HEAD differs from the handoff, stop and reconcile before accepting findings.
- Before each approved milestone, Codex tells Guy whether to continue in the current task or open a dedicated execution task. Significant implementations normally receive a milestone-scoped execution task; this Lead task remains the decision and re-gate hub.
- Do not create overlapping implementation tasks, reuse a dirty worktree blindly, or sweep unrelated files into a commit.
- Branch/worktree cleanup is a separate audited operation. Codex must first prove ownership, merge/push status, unique commits, dirty/untracked preservation, and recoverability, then present Guy with the exact proposed targets and rollback/preservation plan. The audit does not authorize deletion: actual branch/worktree deletion requires Guy's explicit approval.
- A large or stale-looking branch list is not permission to delete anything.

## Decision Gate — required before major changes

Before changing image generation, prompt assembly, anchors (child/companion/family), story bank, reader/layout, production flow, payments, QA gates, fallbacks, style references, or anything that spends more than 1–2 test images:

1. Fill `docs/ai-workflow/DECISION_GATE_TEMPLATE.md` as a short brief.
2. Run the stop-check in `docs/ai-workflow/STOP_BEFORE_MAJOR_ACTIONS.md`.
3. Return unresolved product decisions to Guy. Use a stated reversible assumption only when it is safe and narrow.
4. Do not implement until the required owner decision is explicit.

Do NOT run a full book render without explicit approval. Default to the smallest page-only or five-page sample that proves the change, then have Guy eyeball it.

## Engineering principles

- **Fix general systems, not story/child/companion-specific patches.** If a fix only helps one story, generalize it.
- Do not create an abstraction before the root cause is understood.
- Do not use prompt prose as a substitute for explicit state, mix marketing labels with runtime contracts, or present a workaround as architecture.
- Prefer structured data where continuity is critical. Minimize special cases.
- Preserve backward compatibility when safe; otherwise propose an explicit migration.
- Make behavior observable and testable. Green tests alone do not establish product quality.
- The per-page resemblance gate is **0.70**. Do not change it without Guy's approval.
- Be cost-aware: use gpt-image-2 LOW for auditions and HIGH only for approved production work.

## Repo landmines

- **EOL/CRLF churn:** stage with explicit pathspecs only — NEVER `git add -A`.
- **`docs/` is gitignored:** new files under `docs/` need `git add -f` unless already tracked.
- **Always run `npx tsc --noEmit` before committing.** For code milestones, also run the relevant tests; the repository stability contract is `npm run check`.
- Standalone scripts that import `server-only` run with `--require ./scripts/shims/register-server-only.cjs`.
- Commit per green milestone. Do not accumulate unrelated work in one commit.
- Preserve unrelated tracked and untracked user changes.

## Canonical sources of truth

Read in this order:

1. `CURRENT.md` — active technical state, evidence, blockers, and next action.
2. `ROADMAP.md` — milestones and priority state.
3. `PROJECT.md` — product purpose, architecture, terms, non-negotiables, and boundaries.
4. `QUALITY_GATES.md` — technical, product, visual, release, and Definition of Done gates.
5. `SMALL_HEROES_PROJECT_BIBLE.md` — detailed background; sections explicitly marked historical are not current truth.

`project-os/` and dated handoffs contain valuable history, decisions, and evidence. They do not override the four canonical root documents when their status is older or contradictory.
