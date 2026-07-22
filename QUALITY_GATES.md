# SmallHeroes — Quality Gates

**Effective:** 2026-07-22
**Technical owner:** Codex
**Independent technical QA:** Claude Code
**Product acceptance:** Guy

No customer-visible work is complete merely because code exists or tests are green. Apply every gate relevant to the task.

## G0 — Intake and authority

- Before implementation begins, Codex gives Guy a visible start notice naming the approved brief/Decision Gate, branch/worktree, milestone, validation plan, cost/render allowance, and exclusions.
- Problem, context, product goal, non-negotiables, acceptance criteria, and desired outcome are explicit.
- Product decisions are made by Guy; technical decisions are owned by Codex.
- Unresolved broad or irreversible assumptions are returned to Guy.
- Required Decision Gate and stop-check are complete before major work.

## G1 — Repository investigation

- Claims are verified against code, tests, runtime, artifacts, logs, Git history, and actual call sites as applicable.
- Callers, flags, legacy paths, fallbacks, overrides, duplicate implementations, migrations, and existing tests are mapped.
- Local symptom and systemic cause are distinguished.

## G2 — Root cause and design

- Observed and expected behavior are stated.
- Root cause, contributing factors, scope, exceptions, risks, and rejected alternatives are documented.
- The solution fixes the general system and avoids story/child/companion/page-specific hardcoding.
- State is structured where continuity or safety is critical; prompt prose is not used as a state contract.
- Migration, compatibility, observability, rollback, and unchanged behavior are explicit.

## G3 — Implementation discipline

- Diff is focused; unrelated refactors are excluded.
- Commits are small, logical green milestones.
- Explicit Git pathspecs only; never `git add -A`.
- Applied migrations are never edited; corrective migrations are additive.
- Unrelated user changes are preserved.
- `CURRENT.md` is updated with decisions, branch, evidence, blockers, and next action.

## G4 — Code and test gate

- `npx tsc --noEmit` passes before every commit.
- Relevant focused tests include positive, negative, fallback, compatibility, and failure-path coverage.
- Existing relevant tests pass; code milestones normally run `npm run check`.
- A new checker or guard is deliberately shown to fail on a representative broken case.
- Tests exercise the production call path, not only a duplicate or dormant implementation.

## G5 — Runtime and migration evidence

- End-to-end defects receive end-to-end evidence.
- Database, payment, order-authority, concurrency, retry, idempotency, and migration claims are tested at the appropriate real database/runtime boundary.
- Generated output is inspected when the changed behavior produces artifacts.
- Fallback and resume behavior are exercised or explicitly documented as a limitation.
- No runtime or production claim is inferred solely from green unit tests.

## G6 — Story and content gate

- The child is the named, active hero and makes a meaningful choice.
- Story has child-native humor, emotional credibility, setup/payoff, companion presence, and an earned ending.
- Hebrew and required niqqud are correct.
- No generic moralizing, worksheet tone, or story-specific technical workaround passes as product quality.
- Guy gives the content/product PASS, consulting Claude Cowork when useful.

## G7 — Visual and book gate

- Product/story sellability and render qualification are separate gates. Before the first paid image, the current story source must be bound to an approved visual-contract template with complete cover/page coverage, explicit world mode, and every required approved Set Identity Board.
- Missing, stale, or contradictory visual authority fails before render. A sellable path may not use generic-world, cover-location, or enforcement-off fallbacks.
- The frozen page contract owns world, location, zone, cast, required/forbidden content, and transitions. Runtime direction/Director prose may only make bounded composition choices inside it.
- QA transport, timeout, skipped, or malformed-evidence outcomes may recheck the same persisted bytes and then hold; only a verified visual defect may consume image-regeneration budget.
- Child, companion, family, clothing, location, objects, geometry, and style remain coherent across the relevant sample/full book.
- Per-page resemblance is at least **0.70**; threshold changes require Guy's approval.
- LOW audition precedes approved HIGH production work.
- No full book render occurs without explicit approval. Use page-only or a five-page sample unless only a full-book proof can answer the approved question.
- Text is legible, the reader feels book-like, and mobile/desktop behavior is checked where affected.
- Guy gives final visual/product PASS; automated QA does not replace it.

## G8 — Delivery, money, and release gate

- Charge, generation, hold, authorized release, fulfillment, failure, cancellation, and refund paths preserve one authoritative lifecycle.
- Unsafe or held books cannot auto-ship; actions are idempotent and auditable.
- Refund and payment behavior has exactly-once/concurrency evidence appropriate to the risk.
- Environment separation, secrets, feature flags, storage, migrations, and deployment protection are verified.
- `npm run release-check` passes with required release flags before deploy.
- Guy gives release/launch go/no-go.

## G9 — Independent technical QA

Codex supplies Claude Code with:

- Original requirement
- Implemented solution
- Architecture impact
- Changed files
- Commits in order
- Tests and exact results
- Manual verification
- Generated artifacts
- Explicit claims to falsify
- Known limitations/uncertainty
- Out of scope
- Exact branch/worktree and base-to-head commit range
- Copy-ready inspection commands

Claude Code reviews adversarially and returns ranked, file/line-cited findings. The first QA pass does not silently fix the implementation. Codex validates and fixes valid findings in a new milestone; Claude Code re-gates the relevant whole surface.

After every completed milestone, Codex also gives Guy a copy-ready PowerShell block matched to the actual Git state. If Codex already committed, the block verifies and pushes that commit; it must not pretend another commit is needed. Codex does not push unless Guy explicitly requests it.

## Definition of Done

A technical task is ready for independent QA only when:

1. The verified root cause is fixed.
2. Relevant call sites and duplicate/legacy paths were checked.
3. Fallback and resume behavior are clear.
4. Backward compatibility is tested or migration is explicit.
5. Appropriate new tests exist and relevant existing tests pass.
6. Runtime/generated evidence is inspected when relevant.
7. No story-specific hack is presented as a general solution.
8. Migrations are applied or documented safely.
9. Diff and commits are focused.
10. Claims are backed by evidence.
11. Canonical state documents are current.
12. The Claude Code handoff is complete.
13. Guy received the exact PowerShell verification/push commands for the actual branch state.

The task is technically complete only after Claude Code PASS/re-gate. It is product complete only after Guy accepts the customer-visible outcome. Launch readiness additionally requires all release gates and Guy's explicit go decision.
