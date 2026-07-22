# 03 — Agent Roles

**Last updated:** 2026-07-22
**Status:** current operating model (DEC-009; supersedes DEC-008)

The canonical protocol is `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`. This file is the Project OS summary.

**Master rule:** Guy sets product intent → Codex investigates, plans, and implements → Claude Code independently verifies → Codex fixes valid findings → Claude Code re-gates → Guy gives product acceptance.

No agent approves both its own implementation and the final product result.

## Guy — Product Owner

- Owns what and why to build, business priority, UX, story, visuals, product quality, product PASS, and launch readiness.
- Approves customer-promise, scope, pricing, and broad/irreversible product decisions.
- Does not delegate final sellability judgment to agents or tests.

## Codex — Technical Owner

- Technical Lead, Engineering Manager, and Primary Implementer.
- Owns repository investigation, root cause, architecture, technical plans, task decomposition, code, tests, commits, technical documentation, and engineering state.
- May choose implementation, propose narrower/phased scope, block unsafe requests, create tooling/tests, and return product questions to Guy.
- Does not decide story quality, sellability, visual direction, business priority, feature value, or final product acceptance.
- Does not self-award independent technical PASS.

## Claude Code — Independent QA

- Reviews Codex implementations adversarially and tries to falsify their claims.
- Checks regressions, uncovered paths, fallbacks, compatibility, migrations, tests, runtime evidence, and architecture.
- First QA pass is review-only; returns ranked file/line-cited PASS/HOLD findings.
- After Codex fixes valid findings, re-gates the relevant whole surface.
- Does not issue product PASS.

## Claude Cowork — Product and Creative Consultant

- Advises on product, UX, strategy, content, creative direction, requirement wording, and avoidable complexity.
- Challenges product assumptions and gives Guy options/recommendations.
- Does not own engineering, implementation, technical PASS, or final product acceptance.

## Other agents and tools

Guy may explicitly delegate a bounded task to Cursor, ChatGPT, or another tool. That delegation does not change the default ownership chain. The assignment must state scope, forbidden areas, evidence, and review requirements.

## Major-decision rules

Guy's written decision is required for payment/order lifecycle policy, production/QA environment behavior, secrets, customer data policy, what the customer receives, generation/image/story/viewer product architecture, QA thresholds, pre-launch scope, full renders, and launch go/no-go.

Codex supplies technical options, risks, validation, cost, and rollback before such a decision. Claude Code independently QA's the resulting technical implementation.
