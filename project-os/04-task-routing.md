# 04 — Task Routing

**Last updated:** 2026-07-06
ClickUp is the tracker; this file defines **who gets which kind of work**. Every assignment needs a brief (format at bottom). ⚠️ ClickUp connector is not authorized in this session — ClickUp list/task IDs are **NEEDS_REVIEW**.

---

## Routing matrix

| Work type | Route to | Gate before merge |
|---|---|---|
| Planning, state mapping, task briefs, decision proposals, ClickUp alignment, blocker triage | **Claude Cowork (Operator)** | Guy |
| Deep architecture / generation / content review + planning; complex implementation under narrow scope | **Claude Code** | Codex review → Guy |
| Independent code review, root-cause, money/concurrency/security audit, implementation verification | **Codex** | (Codex IS the gate) → Guy |
| Frontend/UI implementation under narrow spec, wizard/reader UI, design-token work | **Cursor** | `npm run check` → Codex if money/gen touched → Guy |
| Product strategy, prompt/creative design, UX/story/visual/business judgment, decision review | **ChatGPT** | Guy routes |
| Final approval, merge, push, launch-readiness sign-off | **Guy** | — |

## Routing principles
- **Money / order / payment / refund code → Codex is mandatory gate.** Cowork/Claude "clean" is not sufficient.
- **Generation / image / story-architecture changes → Decision Gate brief first** (`docs/ai-workflow/DECISION_GATE_TEMPLATE.md`) → ChatGPT challenge → Guy → execute. Page-only / 5-page eyeballed sample before any full render.
- **UI-only, no money/gen impact → Cursor** directly under a narrow brief.
- **Ambiguous scope or "review everything" → Operator** breaks it into scoped briefs first. No open-ended work.
- **Never** let Claude Code / Codex / Cursor start without a brief. Never self-merge. Never `git add -A`.

## Do-not-route (owner-only decisions)
Payment lifecycle, QA/PROD env, secrets, DB/data model, what-the-user-receives, pre-MVP scope changes → these need a written proposal + Guy approval before any agent touches them.

---

## Task brief format (use before assigning any agent)
```
Task title:
Why now:
MVP category: launch blocker / pre-launch polish / post-MVP / technical debt / research
Assigned agent:
Context:
Allowed files/areas:
Forbidden files/areas:
Expected output:
Do not:
Definition of done:
QA required: yes/no
Codex review required: yes/no
Owner approval required: yes/no
```
