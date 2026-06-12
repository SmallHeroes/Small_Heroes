# AGENTS.md — operating instructions for AI agents in this repo

This file is auto-loaded as project context. Read it before doing anything non-trivial.

## Roles (see `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`)
- **Codex** — CTO / implementation planner / code reader / technical executor.
- **ChatGPT** — Product / UX / QA / creative / story / visual / business reviewer; challenges assumptions, guards against hardcoding.
- **Cursor** — code executor.
- **Guy** — product owner & final approver.

**Rule of thumb: Codex proposes → ChatGPT challenges → Guy approves → Cursor executes.**

## Decision Gate — required before any non-trivial change
Before changing image generation, prompt assembly, anchors (child/companion/family), story bank, reader/layout, production flow, QA gates, fallbacks, style references, or anything that spends more than 1–2 test images:
1. Fill `docs/ai-workflow/DECISION_GATE_TEMPLATE.md` as a short brief (what / why now / general-vs-patch / hardcoding risk / files / minimal validation / cost / rollback / what ChatGPT should review / what not to do).
2. Run the stop-check in `docs/ai-workflow/STOP_BEFORE_MAJOR_ACTIONS.md`. If anything is unclear — **stop and ask Guy**, don't run ahead.
3. Guy routes the brief to ChatGPT; only implement after approval.

Do NOT run a full book render without explicit approval. Default to a page-only / 5-page sample first, eyeballed.

## Engineering principles
- **Fix general systems, not story/child/companion-specific patches.** If a fix only helps one story, it's wrong — generalize it.
- Validate with the smallest run that proves it (page-only). The per-page resemblance gate is **0.70** — do not change it without approval.
- Be cost-aware: gpt-image-2 LOW for auditions, HIGH only for production.

## Repo landmines (current)
- **EOL/CRLF churn**: `git status` shows ~800 files modified that are line-ending only (no `.gitattributes`, `core.autocrlf` unset). Until fixed (see task to add `.gitattributes` + renormalize), **stage with explicit pathspecs only — NEVER `git add -A`.**
- **`docs/` is gitignored**: new files under `docs/` need `git add -f` (or a carve-out for `docs/ai-workflow/`).
- **Always run `npx tsc --noEmit` before committing** — `tsx` runtime does not type-check; broken types will fail the Vercel build. Commit only when tsc is clean.
- Standalone scripts import `server-only`; run them with `--require ./scripts/shims/register-server-only.cjs`.
- Commit per green milestone — don't let work accumulate uncommitted on one branch.

## Source of truth
- Live state & open questions: latest handoff doc + `SMALL_HEROES_PROJECT_BIBLE.md`.
- Workflow protocol: `docs/ai-workflow/`.
