# R1D-PVB-D1A1B1 Book-Surface Recurring-Prop Aggregation — Implementation Evidence

## Status

- Implementation: complete locally.
- Independent technical QA: pending.
- Base: `95fe597587ad81da43d1aeee8699824fb02da909`.
- Code commit: `61e7a8fa` (`fix(visual-contract): aggregate recurring prop surface repair`).
- Branch: `codex/r1d-book-surface-recurring-prop-aggregation`.
- Worktree: `C:\Users\guyna\.codex\worktrees\booksurface2\Small_Heroes`.
- External cost: `$0`.
- Production: untouched and unauthorized.

## Proven cause

The prior immutable live attempt used all three admitted logical provider calls
and produced no candidate. Its first compact repair resolved eleven exact
spatial-reference failures. The remaining surface mixed cover/page
structural/presentation issues with one exact recurring-prop lifecycle failure.
Book-surface v1 could not carry recurring props, so the closed router rejected
that bounded lane and selected `full_draft`. The large provider response then
failed local response parsing. The failure was representational: the compiler
had a precise local authority but the compact schema could not express it.

## Implemented contract

1. Book-surface schema/system/user prompt advance from v1 to v2.
2. The response has exactly `coverContract`, `recurringProps`, and
   `pageContracts`.
3. Recurring-prop repair eligibility is restricted to the exact typed identity
   `draft_contract/lifecycle_invariant_invalid` at the recurring-props
   collection lifecycle field.
4. The compiler supplies the complete current recurring-prop collection and a
   Boolean repair authority. With no lifecycle authority, canonical equality
   is mandatory.
5. Patch IDs must be non-empty, unique and exactly equal to compiler authority.
   Application matches by ID and restores the original collection order.
6. Cover references remain bound to compiler-owned world/location/zone/cast
   authority. Page writes continue through target-scoped page repair.
7. Non-target fields are canonically masked and compared; input mutation,
   identity drift, unexpected keys and stale targets fail closed.
8. Final Visual Contract validation and all downstream candidate semantics are
   unchanged.

## Authority migration

- Authoring policy: v7.
- Authoring request / receipt / readiness: v24 / v27 / v25.
- Live materialization input / manifest / verification: v13 / v22 / v22.
- Execution materialization input / result: v12 / v16.
- Supervisor request / readiness / result: v21 / v21 / v13.
- Canonical Fresh Readiness evidence: v21.
- Immediate predecessors are retained as historical immutable and are not
  authority for a fresh attempt.

No model, service tier, reasoning, prompt budget, 64K ceiling, call/repair
budget, timeout, transport retry, fallback, cost ceiling, candidate policy,
render policy or downstream contract changed.

## Regression evidence

- Direct schema, parser, authority and application coverage includes:
  lifecycle eligibility; wrong locator rejection; exact keys; prop identity
  tampering; duplicate/missing/unexpected props; input non-mutation; canonical
  no-change control; and preservation of non-target fields.
- End-to-end compiler coverage proves the observed mixed surface reaches
  `book_surface_patch`, carries only bounded authority, and produces a candidate
  after two fake-provider calls without `full_draft`.
- Lifecycle/materialization/pre-live tests prove every new version/digest
  binding and legacy cutover.
- Focused affected surface: 7 files / 338 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Repository gate

The single authorized literal `npm run check` was invoked once.

- TypeScript and autonomous story typecheck: PASS.
- Ordinary phase: 281 files; 3,180 assertions passed. Five assertions failed
  solely because historical ignored output artifacts were absent. The failures
  were in `story-read-back-validation.spec.ts` (2), `page-entity-qa.spec.ts`
  (1), `child-lexicon-ages-5-8.spec.ts` (1), and
  `momentum-gate-koko.spec.ts` (1).
- Resource-intensive phase: 19 files / 577 tests PASS at two workers, with a
  valid diagnostic protocol and no timeout, RPC/IPC, reporter, launch, signal
  or teardown failure.

These observed failures are within the established ignored-output fixture
baseline. The broader six-fixture repository/release HOLD remains separate and
is not waived by this implementation.

## Rollback and boundaries

Rollback is the focused code commit plus its documentation closeout. Historical
artifacts remain immutable; no old artifact is re-digested or promoted. No
credential was accessed, no provider/network/pricing action ran, no Fresh
Readiness or preflight was invoked, and no candidate, Blueprint, Wizard,
image/Vision, render, storage/database, QA deployment or Production operation
occurred.

## Independent QA falsification targets

1. Confirm exact topology and range from `95fe5975` through the documentation
   head with no merge and no unrelated path.
2. Prove v2 admits only the exact recurring-props lifecycle identity and rejects
   every neighboring collection/code/field identity.
3. Prove complete prop identity, order, strict response shape, canonical
   equality when unauthorized, and non-target containment.
4. Prove the observed mixed failure reaches the compact book-surface lane and
   does not send Story Source or a complete prior draft.
5. Prove final validators, model, budgets, timing, retry/fallback, candidate and
   downstream behavior are unchanged.
6. Verify every lifecycle/materialization/Supervisor/Fresh Readiness version and
   predecessor classification.
7. Reconcile the recorded focused and repository-gate results without treating
   the known ignored-output fixture HOLD as a new implementation failure.

Claude Code should return PASS or HOLD. Codex does not self-award independent
technical PASS.
