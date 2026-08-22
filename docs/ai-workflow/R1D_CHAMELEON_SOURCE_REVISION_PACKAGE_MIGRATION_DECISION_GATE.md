# R1D Chameleon Story Source revision package migration — Decision Gate

**Owner decision already supplied:** Guy accepted Story Source Revision
`20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb`,
accepted its Product Review Bundle, and instructed Codex to complete the new-engine
Wizard path without additional routine approvals. Provider/render work remains
fail-closed until the offline authority chain is rebuilt and independently gated.

## 1. Proposed change

Add a general, zero-spend lifecycle that migrates one current approved Visual
Package to one product-accepted immutable Story Source revision. Phase 1 builds
an exact old-to-new Source Evidence bijection, projects the Visual Contract and
Action Semantic Coverage, and emits a fresh pending reconciliation review.

## 2. Why now?

The current Chameleon package still binds the historical female Story Source.
The accepted neutral revision is runtime-loadable, but the immutable package
cannot be relabeled or edited in place. A fresh package authority is required
before a new Bar-boy Wizard order can prove the new engine.

## 3. Scope

- General deterministic migration lifecycle and CLI.
- One real Chameleon migration artifact as the first proof.
- No story-specific prose rewrite in production code.

## 4. Hardcoding risk

The lifecycle derives evidence mappings from exact `(pageNumber,
excerptOrdinal)` topology and rejects missing, duplicate, cross-story or stale
authority. Chameleon identities and expected counts live only in the focused
real-artifact regression and invocation evidence.

## 5. Expected files

- `lib/visual-package/storySourceRevisionPackageMigrationLifecycle.ts`
- `scripts/story-source-revision-package-migration.ts`
- one focused spec
- this Decision Gate, implementation evidence and `CURRENT.md`
- ignored content-addressed artifacts under a fresh `outputs/` root

## 6. Expected behavior

The lifecycle must:

1. load the exact current approved package and exact product-accepted revision;
2. prove an exhaustive bijection between old and new Source Evidence catalogs;
3. replace every mapped ID and its exact source phrase without changing other
   Visual Contract fields;
4. validate the migrated template and complete Action Semantic Coverage;
5. rebuild source text, directions, citations and presentation obligations in a
   pending reconciliation;
6. require fresh human review before any downstream Blueprint/package action.

## 7. Validation

- Real current-package preview with zero writes.
- Exact evidence/cardinality, projection and replay tests.
- Hostile cross-story/noncanonical/stale binding tests.
- Reconciliation, Visual Package and source-authority regression suites.
- TypeScript, autonomous Story typecheck, diff check and import-graph audit.
- Independent Claude Code falsification before approval or downstream advance.

## 8. Cost impact

`$0`. No provider, image, audio, database, storage, deployment or locator call.

## 9. Rollback

Revert the focused commit and remove only the new ignored output root after
verifying its resolved path. Historical package, revision, locator and Boards
remain byte-identical.

## 10. Sequential approvals

Phase 1 stops at pending reconciliation. After independent PASS, Guy approves
the exact reconciliation and review identities. Blueprint replay, package
assembly and package publication remain later independently gated stages.

## 11. Do not do

- Do not call a model or image/audio provider.
- Do not mutate the accepted revision, current package, locator or Boards.
- Do not claim Blueprint/package/runtime approval from a pending reconciliation.
- Do not render or deploy in this milestone.
