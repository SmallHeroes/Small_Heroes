# R1D Deferred-Represented BookSurface Scheduler — Decision Gate

**Approved by:** Guy
**Approved:** 2026-08-24
**Branch:** `codex/r1d-chameleon-v3-live-authoring`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`

## 1. Proposed change

Remove the standalone `capabilityGapPages.size > 0` prerequisite from
`semanticCoverageIssuesAllowIndependentBookSurfaceRepair`. Keep the existing
per-issue rule that admits `coverage_missing` only on a capability-gap page,
while allowing the three deferred `represented_elsewhere` identities to
coexist with an independently closed BookSurface structural repair.

Add offline production-compiler regressions for the live-shaped zero-gap
frontier and its fail-closed counterexamples.

## 2. Why now?

The bounded paid attempt stopped correctly when a `full_draft` repair increased
the complete unique issue census from 11 to 16. The preceding 11-issue draft
contained five deferred represented-elsewhere failures and six BookSurface-
writable structural failures, with no remaining capability gaps. The
standalone prerequisite contradicted the adjacent routing comment, classified
that population as blocking, skipped BookSurface, and forced `full_draft`.

This is the current text-authoring blocker. Another paid attempt is not
justified until the exact route is proven offline.

## 3. Scope

General scheduler correction. It is not specific to Chameleon, Bar, Kim, a
page number, a story, a child, or a companion.

## 4. Risk of hardcoding

The production change is population-based and uses existing typed diagnostic
families. The live `11 -> 5 -> 0` shape is a regression fixture only. No
story-specific runtime identifier or count enters production code.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/__tests__/offline-repair-harness.spec.ts`
- `CURRENT.md`
- this Decision Gate and one implementation-evidence document

## 6. Expected behavior after change

- Five deferred represented failures plus six independently writable
  structural failures route to `book_surface_patch`, not `full_draft`.
- After BookSurface removes the six structural failures without changing
  action-semantic coverage, the five represented failures route through the
  existing compiler-bounded `page_contract_patch` and close.
- Non-gap `coverage_missing`, non-BookSurface structural causes, ambiguous or
  unbound pointer authority, regression, and exact-state stagnation remain
  fail-closed.

## 7. Validation plan

All validation is offline with `providerCalls: 0`:

1. Prove the exact complete census `11 -> 5 -> 0`, route
   `initial -> book_surface_patch -> page_contract_patch`, Candidate outcome,
   and no `full_draft`.
2. Prove the zero-gap BookSurface pass leaves `actionSemanticCoverage`
   byte-identical.
3. Prove non-gap `coverage_missing` blocks BookSurface.
4. Prove deferred represented plus a non-BookSurface structural cause blocks
   BookSurface.
5. Prove an exact repeated BookSurface draft and complete diagnostic
   fingerprint stops after the existing two-call stagnation bound.
6. Preserve the existing BookSurface -> spatial -> PageContract dedicated-lane
   regression and the complete-census regression guard.
7. Run focused compiler/repair suites, `npx --no-install tsc --noEmit`,
   `git diff --check`, and `npm run check` against the recorded baseline.

## 8. Cost impact

`$0`. No credential, provider, network, image, audio, Vision, live authoring,
Candidate persistence, Wizard order, render, or deployment action is allowed.

## 9. Rollback plan

Revert the focused milestone commit. No persisted authority, schema, artifact,
database row, package, locator, or external state is migrated.

## 10. Review assignment

Claude Code receives the immutable base-to-head range and must try to falsify
the live-shaped route, pointer authority, counterexamples, exact-state
stagnation, regression guard, and unchanged policy/version surfaces.

## 11. Do not do

- Do not change model, prompt, schema, provider, budgets, call count, repair
  count, retry, fallback, cost ceiling, receipt/readiness versions, Story
  Source, Visual Package, locator, Board, Wizard, renderer, or deployment.
- Do not persist the general compiler notes array or add receipt telemetry in
  this milestone; doing so would require a separate authority-version gate.
- Do not run live authoring or render.
