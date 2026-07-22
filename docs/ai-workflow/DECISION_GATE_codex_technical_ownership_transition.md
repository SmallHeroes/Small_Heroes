# Decision Gate — Codex technical ownership transition

**Date:** 2026-07-22
**Owner decision:** Guy
**Mode:** Documentation and engineering-governance only

## 1. Proposed change

Reconcile the repository's operating instructions to Guy's new team model:

- Codex is Technical Lead, Engineering Manager, and Primary Implementer.
- Guy owns product direction, priorities, product quality, and final product acceptance.
- Claude Code is the independent technical QA and re-gate reviewer.
- Claude Cowork is a product and creative consultant.
- Create the four minimal canonical state documents: `PROJECT.md`, `ROADMAP.md`, `CURRENT.md`, and `QUALITY_GATES.md`.

## 2. Why now?

The auto-loaded instructions and Project OS currently contradict each other. They assign technical ownership variously to Claude, Codex, and Cursor. This makes authority, execution, and approval ambiguous on every future task.

## 3. Scope

General repository-governance and documentation change. No product behavior, application code, content, generation path, or production configuration changes.

## 4. Risk of hardcoding

No story, child, companion, page, or style is involved. The main risk is encoding tool names as authority without clearly separating product ownership, technical ownership, execution, and independent QA.

## 5. Files likely affected

- Auto-loaded instructions: `AGENTS.md`, `CLAUDE.md`
- Workflow: `docs/ai-workflow/AI_ROLES_AND_PROTOCOL.md`, the Decision Gate template, and the stop-check
- Canonical state: `PROJECT.md`, `ROADMAP.md`, `CURRENT.md`, `QUALITY_GATES.md`
- Existing governance references: selected `project-os/` files and the workflow section of `SMALL_HEROES_PROJECT_BIBLE.md`

Historical handoffs and implementation briefs remain historical and will not be rewritten.

## 6. Expected behavior after change

A new agent can read the repository and identify one current authority chain: Guy decides product; Codex owns and executes engineering; Claude Code independently tries to falsify the implementation; Guy gives product acceptance. Current state and gates are discoverable without relying on a conversation transcript.

## 7. Validation plan

- Search active instruction and governance files for obsolete role assignments.
- Review the diff for focused documentation-only changes and accidental EOL churn.
- Check Markdown links and named source-of-truth files.
- Run `npx tsc --noEmit` before committing, as required by repository policy, even though no TypeScript changes are planned.
- Prepare an adversarial handoff for Claude Code; do not self-award technical PASS.

## 8. Cost impact

No image, audio, LLM generation, deployment, database, or paid API cost.

## 9. Rollback plan

Revert the single documentation milestone commit. No runtime or data migration is involved.

## 10. Review assignment

- Guy has supplied the binding role and product-boundary decision in the attached directive.
- Claude Code should independently verify that no active instruction file still assigns primary technical ownership or implementation to another agent, and that product acceptance remains with Guy.
- Claude Cowork may challenge product/creative boundaries if Guy asks; no product or creative decision is being made in this change.

## 11. Do not do

- Do not change application code, generation behavior, prompts, QA thresholds, fallbacks, payments, or production state.
- Do not run any render or generation.
- Do not rewrite historical handoffs as though they described the present.
- Do not touch unrelated untracked files.
- Do not claim independent QA PASS on Codex's own work.

## Stop-check

1. **General or story-specific?** General governance only.
2. **Could it break another story/child/companion/style?** No runtime path changes.
3. **Production behavior?** No.
4. **Spend money?** No.
5. **Smallest safe validation?** Diff/search/link review plus TypeScript no-emit check.
6. **Independent review?** Claude Code receives the handoff after implementation.
7. **What must Guy eyeball?** The authority split and the canonical-source hierarchy.

All stop-check answers are clear. The attached directive is the explicit owner decision authorizing this documentation transition.
