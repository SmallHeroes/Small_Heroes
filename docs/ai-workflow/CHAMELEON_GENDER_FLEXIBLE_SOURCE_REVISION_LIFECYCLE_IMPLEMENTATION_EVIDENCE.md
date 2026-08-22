# Chameleon gender-flexible Story Source revision lifecycle — implementation evidence

**Date:** 2026-08-22

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Decision Gate:** `CHAMELEON_GENDER_FLEXIBLE_SOURCE_AUTHORITY_DECISION_GATE.md`

## Outcome

The pending gender-flexible Chameleon source now has a bounded, provider-free
review and acceptance lifecycle. The lifecycle does not approve or promote the
revision by itself. It prepares a content-addressed product-review bundle,
validates an exact Guy acceptance artifact, and can then atomically publish one
immutable nested accepted revision.

The lifecycle is deliberately separate from Story Source reconciliation,
Blueprint/package construction, current-locator publication, Wizard execution,
provider calls and rendering. Those remain later gates.

## Current authorities

- pending source revision manifest: v4;
- product review bundle: v2;
- product acceptance: v2;
- revision identity: v2;
- accepted revision manifest: v2.

The revision identity and product review both expose the closed
`sourceGenderMode: neutral` and the exact metadata delta
`gender: female -> gender: neutral`. The product review includes the complete
resolved boy and girl texts, their byte counts and SHA-256 identities, plus the
female-prose equivalence evidence from pending v4.

## Fail-closed boundaries

- pending v3 and review v1 cannot enter the current lifecycle;
- the parent accepted manifest is re-read through the same contained,
  regular-file and single-link fence as other inputs and must match its pending
  descriptor;
- technical review bytes are canonical and named by their digest;
- output directories must be fresh children of the allowed root;
- junctions, symbolic links, reparse escapes and hard-linked input/replay files
  are rejected;
- review and accepted-revision writes use a fresh staging directory followed by
  one atomic directory rename;
- an existing accepted revision is reusable only when its exact inventory and
  every byte match the requested publication;
- `acceptedBy` is exact `Guy`, the timestamp is canonical UTC with millisecond
  precision and calendar-valid, and the acceptance binds the exact review,
  pending manifest, migration, source mode and metadata changes;
- provider, render, storage, database and deployment modules are absent from
  the lifecycle import path.

## Accepted revision contents

An authorized promotion writes only:

1. `story.md`;
2. `visual-directions.json`;
3. `integrated.md`;
4. `direction-migration.json`;
5. `source-revision-manifest.json`;
6. `review-bundle.json`;
7. `revision-identity.json`;
8. `manifest.json`.

The accepted manifest binds every file by bytes and SHA-256, the review and
revision identities by digest, and the exact external Guy acceptance by path,
bytes and SHA-256.

## Validation

- dedicated lifecycle suite: 6/6 pass;
- materializer, lifecycle, source-authority and workload-classifier matrix:
  4 files / 126 tests pass;
- `npx --no-install tsc --noEmit`: pass;
- `npm run story:autonomous-typecheck`: pass;
- tracked and untracked-file diff checks: pass.

Literal `npm run check` ran once and was not retried. Its ordinary phase passed
3,459 assertions and reported six failures: the same five missing ignored-output
fixtures plus one inventory-count expectation exposed by this new spec. The
inventory expectation is now corrected and passes in the 126-test replacement.
The resource phase passed 611/611 assertions and exited nonzero only for the
three already-documented Vitest worker `onTaskUpdate` RPC timeouts. The full
repository gate is therefore not represented as green.

No provider, image, render, storage, database, deployment, promotion or product
acceptance occurred while producing this evidence.

## Next gate

Commit the lifecycle implementation and evidence, freeze the exact range and
send it to Claude Code for independent read-only review. Only after Claude PASS
may Codex mint a technical-review artifact and the exact product-review bundle
for Guy. Promotion still requires Guy's explicit acceptance of those future
identities.
