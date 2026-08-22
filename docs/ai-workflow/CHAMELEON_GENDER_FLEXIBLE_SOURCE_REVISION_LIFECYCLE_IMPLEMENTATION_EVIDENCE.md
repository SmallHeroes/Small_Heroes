# Chameleon gender-flexible Story Source revision lifecycle — implementation evidence

**Date:** 2026-08-22

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Decision Gate:** `CHAMELEON_GENDER_FLEXIBLE_SOURCE_AUTHORITY_DECISION_GATE.md`

## Outcome

The gender-flexible Chameleon source completed its bounded, provider-free review,
acceptance and promotion lifecycle. The lifecycle did not self-approve the
revision: it prepared a content-addressed product-review bundle, Claude Code
independently re-gated the implementation, Guy explicitly accepted the exact
review and revision identities, and only then did the canonical writer atomically
publish one immutable nested accepted revision.

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

## Authorized promotion evidence

- technical review digest:
  `b98cf8c541bf41f9fba4d36aa9d56c9dc47d22914c6869192f34db374a3eaae2`;
- Guy-approved product review bundle:
  `2a84d1785e771072b5601e6fe1c85f84bd793b1666c229239ae60b3064d38565`;
- Guy-approved revision identity:
  `20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb`;
- exact acceptance authority: `acceptedBy: Guy`,
  `acceptedAt: 2026-08-22T04:52:27.429Z`;
- product-acceptance bytes: 1,582, SHA-256
  `b64bd26589d9231e209377ebf93652c9a86c46a21ca41b4b3b8b9776bda49ee9`;
- accepted manifest v2 digest:
  `b090505e232dc02c06ff8c3ce7684d2b433a00f9bba9fa907c541066da00dadd`;
- accepted manifest whole-file SHA-256:
  `e53816df057241b09b0841b18d63496c6b3baf9894b5377c1d1da3ff73012d07`.

The canonical `promote --write false` preview returned `created: false` and left
the target absent. The one authorized `promote --write true` invocation returned
`created: true`. Replaying the exact same authorized command returned
`created: false` and preserved every accepted-revision byte. The published path
is:

`story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/`

## Validation

- dedicated lifecycle suite: 6/6 pass;
- materializer, lifecycle, source-authority and workload-classifier matrix:
  4 files / 126 tests pass;
- `npx --no-install tsc --noEmit`: pass;
- `npm run story:autonomous-typecheck`: pass;
- tracked and untracked-file diff checks: pass.

After the real authorized promotion, the lifecycle and materializer suites pass
2 files / 17 tests, `npx --no-install tsc --noEmit` passes,
`npm run story:autonomous-typecheck` passes, and `git diff --check` passes.

Literal `npm run check` ran once and was not retried. Its ordinary phase passed
3,459 assertions and reported six failures: the same five missing ignored-output
fixtures plus one inventory-count expectation exposed by this new spec. The
inventory expectation is now corrected and passes in the 126-test replacement.
The resource phase passed 611/611 assertions and exited nonzero only for the
three already-documented Vitest worker `onTaskUpdate` RPC timeouts. The full
repository gate is therefore not represented as green.

No provider, image, render, storage, database, deployment, package rebuild,
current-locator write or Wizard operation occurred. The only external product
authority was Guy's exact approval recorded above; the only publication was the
local immutable Story Source revision through the canonical lifecycle.

## Next gate

Commit the exact acceptance and accepted-revision inventory, freeze its range and
send it to Claude Code for independent read-only review. After PASS, rebuild the
downstream Story Source reconciliation, Blueprint, Visual Package and locator
authority from this accepted neutral revision. No provider or render call is
authorized by this acceptance milestone itself.
