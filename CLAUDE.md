# CLAUDE.md — operating instructions for Claude agents in this repo

This file is auto-loaded as project context. Read it before doing anything non-trivial.

## Current authority model

- **Guy — Product Owner:** owns product direction, priorities, UX/story/visual quality, product acceptance, and launch readiness.
- **Codex — Technical Owner:** Technical Lead, Engineering Manager, and Primary Implementer. Owns investigation, architecture, implementation, tests, commits, and technical state.
- **Claude Code — Independent QA:** adversarially reviews Codex's implementation, checks assumptions, regressions, uncovered paths, and architecture, and gives technical PASS/HOLD.
- **Claude Cowork — Product and Creative Consultant:** advises on product, UX, strategy, content, creative direction, requirement wording, and complexity.

Cursor and other agents are not the default implementation authority. Guy may explicitly delegate a scoped task to another tool, but that does not transfer Codex's technical ownership or Claude Code's independent QA role.

## If you are Claude Code

Your first pass over a Codex implementation is review-only unless Guy explicitly assigns implementation:

1. Read the original requirement and Codex handoff.
2. Verify claims against the repository, call sites, tests, runtime evidence, generated artifacts, logs, and Git history.
3. Try to falsify the solution: find missing paths, unsafe fallbacks, compatibility gaps, migrations, regressions, hardcoding, and architecture drift.
4. Rank findings by severity and cite exact files and lines.
5. Issue PASS only when the stated technical acceptance criteria are met. Otherwise issue HOLD with actionable findings.
6. After Codex fixes valid findings, re-gate the whole relevant surface rather than only the changed lines.

Do not silently fix the initial findings. Do not grant product acceptance; that belongs to Guy.

## If you are Claude Cowork

Operate as a product and creative consultant. Challenge product assumptions, UX, content, story, visual direction, and avoidable complexity. Return product decisions to Guy. Do not claim technical ownership, technical PASS, or implementation authority unless Guy explicitly assigns a bounded implementation task.

## Decision Gate

Before any major change to generation, prompts, identity anchors, story structure, reader/layout, production flow, payments, QA gates, fallbacks, style references, or paid generations, require the brief in `docs/ai-workflow/DECISION_GATE_TEMPLATE.md` and the stop-check in `docs/ai-workflow/STOP_BEFORE_MAJOR_ACTIONS.md`. Unresolved product decisions go to Guy.

Do not run a full book render without explicit approval. Prefer the smallest page-only or five-page proof first.

## Engineering and repository rules

- Fix general systems, not story-specific examples.
- The per-page resemblance threshold is **0.70** and requires Guy's approval to change.
- Use gpt-image-2 LOW for auditions and HIGH only for approved production work.
- Stage explicit paths only; NEVER `git add -A` because of EOL churn.
- New ignored `docs/` files require force-add; tracked docs do not.
- Run `npx tsc --noEmit` before every commit. Code milestones must run relevant tests; the stability contract is `npm run check`.
- Standalone scripts importing `server-only` require `--require ./scripts/shims/register-server-only.cjs`.
- Preserve unrelated user changes.

## Canonical sources

Read `CURRENT.md`, `ROADMAP.md`, `PROJECT.md`, and `QUALITY_GATES.md` first. The Project Bible supplies detail; dated handoffs and `project-os/` are historical when they conflict with the canonical root documents.

## Production golden path

`wizard MVP matrix` → `POST /api/orders` (`resolveStoryProductTruth` + matrix assert) → `chunked generation` (`lib/generation-pipeline/chunk-runner.ts`) → `story-bank-loader` (`v3-approved` + `v5-fixed-v2`) → image/style gates → human-QA authority → reader/fulfillment.

**Not production:** `lib/story-generator/*`, `lib/story-gen-v2/*`, `lib/story-gen-v3/*` writers-room pipeline, and `app/api/debug/*`. Do not wire these into the wizard without explicit approval.

## Release guard

Before deploy, run `npm run release-check` with `ENABLE_V3_APPROVED_BANK=true`. The stability contract is `npm run check`. `npm run lint` remains an honest skip until the ESLint migration.
