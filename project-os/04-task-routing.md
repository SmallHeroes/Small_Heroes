# 04 — Task Routing

**Last updated:** 2026-07-22
**Status:** current summary; canonical protocol is `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`

## Default routing

| Work type | Owner/route | Required gate |
|---|---|---|
| Repository investigation, root cause, architecture, planning, implementation, tests, commits, and technical state | **Codex** | Decision Gate when applicable → Claude Code independent QA → Guy product acceptance when customer-visible |
| Independent implementation review, regression/edge-path audit, architecture verification, re-gate | **Claude Code** | PASS/HOLD with file/line evidence; no product PASS |
| Product strategy, UX, story, visual, creative, requirement wording, complexity challenge | **Claude Cowork** | Guy decision |
| Product scope, priority, sellability, visual/story acceptance, launch go/no-go | **Guy** | Owner decision |
| Explicitly delegated bounded work | Cursor, ChatGPT, or another named tool | Scope-specific gate set by Guy/Codex; default ownership does not transfer |

## Routing principles

- Codex starts with repository investigation, not a presumed implementation.
- Generation, image, story, reader, payment, production, fallback, and QA-gate changes require the Decision Gate/stop-check before implementation.
- Money, order authority, concurrency, security, and migrations require proportionate runtime evidence and independent Claude Code review.
- Product/creative uncertainty goes to Guy, optionally with Claude Cowork consultation.
- No story-specific patch may be presented as a system solution.
- No full render runs without Guy's explicit approval.
- Never self-merge broad work, never self-award independent PASS, and never `git add -A`.

## Task brief format

```text
Task title:
Why now:
Product goal:
Non-negotiables:
Acceptance criteria:
Assigned owner/executor:
Independent QA:
Context and verified evidence:
Allowed files/areas:
Forbidden files/areas:
Expected output:
Migration/compatibility needs:
Validation and cost:
Rollback:
Do not:
Definition of Done:
Owner decision required:
```
