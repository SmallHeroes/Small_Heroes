# R1D Time-Authority Set Board Rebind — Implementation Evidence

**Status:** initial independent HOLD corrected locally; focused validation
green; Claude Code micro re-gate required before any real rebind artifact is
materialized

**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`

## Problem proved

The exact approved time migration and Blueprint close Chameleon's Town
`timeOfDay` from `evening into night` to `mixed`. Set Definition identity is
render-relevant, so the current v6 Board Registry correctly changes from:

- source hash `5b1917ceec616cd9c8613f8075f2a7b3426c96e9549eaeef40f2381eb550b9dc`;
- target hash `fd15ad19983952607f118282aa05d9e8f6931697453994ee4d8516ece78f7651`.

The approved source image SHA-256 remains
`41580dfa9ea11a8dd5c6027ffd5cc5a46f5afe0bfc6eae62c047d00cd05a751e`.
Content policy, declared props, storage key, prompt hash, model, quality and QA
evidence also remain exact. Generic Visual Package assembly therefore fails
closed on the missing target identity; it neither reuses the old approval nor
requests a needless image rerender.

## Implementation

`timeAuthorityMigrationSetBoardLifecycle.ts` adds three exact-key,
content-addressed artifacts:

- `time-authority-set-board-rebind-candidate/v1`;
- `time-authority-set-board-rebind-review/v1`;
- `time-authority-set-board-rebind-approval/v1`.

Prepare reloads and replays the exact approved migration manifest. It derives
the source Board only from the exact approved source Visual Package, verifies
the source Registry bytes and approval, derives the target identity from the
migrated template, and accepts only an exact time-only identity change. The
proposed Registry entry is QA-passed but has null approval fields and therefore
cannot satisfy the live Board resolver.

Approval reconstructs the same Candidate and Review, requires their canonical
paths and bytes, requires exact approver `Guy` and a strict canonical UTC
timestamp, builds the one exact approved target entry, and writes only
immutable local artifacts. Before recording approval it compares the intended
Registry bytes with any existing target, so a conflicting approval timestamp
cannot leave an orphan approval artifact. Replays are byte-identical no-ops. The independent
approval validator binds the full target Registry entry to the Candidate, not
merely to a caller-supplied redigest.

The offline CLI `time-authority-set-board-rebind` exposes only `prepare` and
`approve`. Set Board imports bypass the public barrel and use only the pure
`types`, `setDefinition`, `registry` and `registryPath` submodules. The CLI
therefore imports no provider, image, Vision, network, storage, database,
Wizard, publication, locator, render or deployment path and reports all such
boundary counters as zero. An import sentinel fails the CLI if Supabase,
`image-storage` or `liveResolverDeps` enters its runtime graph; an independent
esbuild metafile reports none of those inputs (the only `node_modules` input is
the intentional `server-only` shim).

The approved migration loader now returns a cloned, typed source-package
authority alongside the reconstructed context. It does not change any
existing artifact or validation semantics.

## Real-artifact offline proof

The artifact-conditioned test uses:

- approved migration manifest
  `a57c3cffd9cd7e2ee43c3a62380f890025c050830ecc8fde378fe21e7936184a`;
- approved Blueprint
  `c6f753eabdb278842c3d8e686bd844752c849a930d15970f06ddf3f918e91208`;
- approved Review
  `137be727f154a03ee97f43afb2c2a46ed41b59f81bb18c196c7c11c30605da57`;
- approval
  `aeff01b6f77599b59fc4ed5e462b78192129bc61ec753dd6c8622d59e9e2c7ed`;
- unchanged approved Home Board hash
  `803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172`.

Inside a disposable repository-contained Registry, prepare writes only the
pending Candidate/Review. Invalid approver and invalid calendar timestamp
create no target Board. Exact test-only Guy approval creates the target entry;
replay creates nothing. The migrated Blueprint then assembles a current Visual
Package using the unchanged Home Board and preserved Town image. Offline
qualification reports `candidateValid: true`, `reviewReady: true`, and exactly
`package_approval_missing`; there is no hidden Board, Blueprint, source,
layout, world, reconciliation or prop blocker.

## Falsification coverage

Tests reject:

- extra Candidate keys;
- redigested asset drift;
- redigested target-hash review drift;
- redigested approval plus target-entry drift;
- non-`Guy` approval;
- invalid calendar timestamps;
- a second validly signed timestamp against already-approved differing
  Registry bytes, before a second approval artifact is written;
- transitive Supabase, image-storage or live-resolver imports in the CLI;
- missing, stale, conflicting or non-time-only source/target identity through
  the production builders;
- writes before the exact approval boundary.

The source Registry and image are never modified. Test approvals and Registry
entries exist only in contained temporary output roots and are deleted after
each test.

## Independent HOLD and correction

Claude Code's first read-only audit found two valid defects in the initial
commit. The lifecycle used the broad Set Board barrel and therefore loaded the
Supabase/image-storage dependency graph despite making no external call. It
also wrote an approval artifact before discovering that a second approval
timestamp conflicted with the already-written immutable Registry entry.

The correction imports only the four pure Set Board submodules named above,
adds both a runtime forbidden-import sentinel and an independent esbuild graph
check, and preflights any existing target Registry bytes before writing the
approval artifact. The second-timestamp regression proves that both the
Registry bytes and approval-file inventory remain unchanged on conflict.

## Validation

- dedicated rebind lifecycle: **4/4 PASS**, including the real public CLI
  preview with every external counter at zero;
- Set Board plus migration/Blueprint/package/Wizard seams:
  **20 files / 417 tests PASS**;
- `npx --no-install tsc --noEmit`: PASS;
- CLI help and rejected-request boundary: PASS with zero external counters;
- `git diff --check`: PASS.
- literal `npm run check`: TypeScript and Story autonomous typecheck PASS;
  ordinary **3,407 tests PASS** with only the same five missing ignored-output
  fixture assertions in four unchanged specs; resource **610 assertions PASS**
  but the two-worker Vitest process reports two `onTaskUpdate` RPC timeouts and
  therefore exits nonzero;
- direct single-worker replay of the exact 20-file resource partition:
  **610/610 PASS**, exit zero.

## Boundaries and next action

External cost is `$0`. No provider, image generation, Vision, credential,
network, storage/database, Wizard promotion, Visual Package approval,
publication, locator mutation, render, deployment or production activation
occurred.

Independent Claude Code must first falsify the committed immutable range. On
PASS, Codex may materialize the real pending Candidate/Review only. Guy's exact
digest approval is then required before the target Town Registry identity is
written. A fresh Visual Package Candidate/Review and separate package approval
follow; the first paid action remains the already-authorized smallest LOW page.
