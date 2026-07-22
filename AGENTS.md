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
