# Decision Gate — Chameleon accepted-source Blueprint migration

## 1. Proposed change

Record Guy's exact approval of Source Reconciliation
`601bf27e...` and Migration Review Bundle `dada7113...`, rebuild a complete
approved production-authoring context from the accepted neutral Story Source,
and replay the current approved Blueprint offline into a fresh candidate and
review packet.

## 2. Why now?

The current approved package still binds the historical female Story Source.
The accepted neutral revision and its deterministic Visual Contract projection
are complete, independently re-gated, and product-approved, but the package
cannot advance until reconciliation is recorded and a new Blueprint binds the
new source/template authority.

## 3. Scope

General source-revision migration lifecycle with one explicit reviewed content
projection for this migration. No provider call, image generation, render,
publication, locator update, database or storage write.

## 4. Risk of hardcoding

The approval, artifact loading, production-context rebuilding, immutable
writing and Blueprint replay invariants are general. The page-8 summary change
is represented as an exact pointer-bound migration edit in the manifest, not a
runtime story/child special case. Any additional Blueprint drift rejects.

## 5. Files likely affected

- `lib/visual-package/reconciliationLifecycle.ts`
- `lib/visual-package/productionAuthoringContext.ts`
- one new source-revision Blueprint migration lifecycle and CLI
- focused lifecycle tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

An exact pending phase-1 manifest plus Guy's exact digest approval creates an
immutable approved reconciliation/review/approval record. The lifecycle then
rebuilds a validated production context and creates a fresh Blueprint candidate
and review. Its content equals the previous approved Blueprint except for the
new authoring authority/Visual Contract and the reviewed page-8 neutral summary.
The new Blueprint remains unapproved.

## 7. Validation plan

- exact real-artifact preview, write and byte-identical replay;
- cross-manifest/digest/timestamp/approver/tamper rejection;
- exact Blueprint drift allowlist and page-8 pointer proof;
- current source/template/reconciliation/context validation;
- no-capability dependency graph;
- focused lifecycle/Blueprint/package regressions, TypeScript and diff check;
- preservation hashes for current locator, package and four Boards.

## 8. Cost impact

Zero. Provider, image, audio, database, storage and locator counters remain zero.

## 9. Rollback plan

Revert the focused code commit and ignore/remove only the fresh gitignored
output root. Current approved package/locator/Boards are never changed.

## 10. Review assignment

Guy already approved the exact pending reconciliation and review digests.
Claude Code must independently falsify approval binding, context reconstruction,
the page-8-only drift fence, immutable writes and no-capability claims. Guy must
later approve the exact Blueprint candidate/review before package assembly.

## 11. Do not do

No provider, render, Board mint/rebind, prop lifecycle, package approval,
locator update, deployment, Wizard order, database/storage write or release.
