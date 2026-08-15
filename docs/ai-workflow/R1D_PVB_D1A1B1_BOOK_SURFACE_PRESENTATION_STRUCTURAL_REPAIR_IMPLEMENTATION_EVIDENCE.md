# R1D Book-Surface Presentation/Structural Repair — Implementation Evidence

## Objective and provenance

Implement the approved closed compact route for the exact mixed book-surface
failure proven by the immutable Leo v14 authoring artifacts. The base is
`e28ab0becb6eb883de3ce08dad9527196a09a748` on
`codex/r1d-book-surface-presentation-structural-repair`.

The consumed attempt's initial response had two page-3
`action_binding_cardinality_invalid` identities. Its first
`page_contract_patch` resolved both. Complete validation then reported 42
current issues: 29 `closed_catalog_capability_gap` presentation targets, one
cover `cover_projection_invalid`, and one
`final_structural_invariant_invalid` on each page 1–12. The old page-only lane
could not replace the cover and the selected `full_draft` response reached the
exact 36,000 output-token ceiling. Receipt v21 digest
`89d8b8585ad737003952f5dc6db6dee5b5deefd160ddfc96d723f2236fb8a001`
records three calls, two repairs, zero fallback, terminal
`completion_status_invalid`, input/cache-write/output/reasoning/total usage
`38,261/38,252/67,727/6,189/105,988`, and nominal/conservative accounting
`$2.270930/$2.498037`. It contains no candidate authority.

Focused implementation commit: `cf391de7`.

## Implementation

- Added strict `book-surface-repair-schema/v1` /
  `BookSurfaceRepairPatch`, carrying exactly one cover contract and the exact
  affected complete page-contract set.
- Added one closed authority derivation for presentation targets plus only
  cover projection/final-structure and page final-structure identities. Every
  other family remains on the existing fail-closed path.
- Reused the canonical lossless compact page-repair codec for provider input
  and prove decode/canonical roundtrip before dispatch.
- Added exact world/location/zone/cast and page topology guards, complete exact
  page-set application, input nonmutation, and canonical masked equality for
  every non-target draft field.
- Routed the lane as `book_surface_patch` through compiler provenance,
  provider-schema selection, receipt attempts, prompt authority, canonical
  parser/materializer, B0, Supervisor, and Fresh Readiness.
- Exported the existing strict cover member schema so the repair and original
  draft use one authority rather than duplicated shapes.
- Updated the canonical Vitest inventory from 299/280/19 to 300/281/19 after
  the new direct specification was added. Workload policy and worker limits are
  unchanged.

There is no story, child, companion, page, phrase, or authored-ID literal in
the implementation. Model, service tier, prompt/schema authority outside this
lane, 64K/36K ceilings, three-call/two-repair budget, timeout, retries,
fallback, candidate semantics, Blueprint v4, Wizard, Reader, image generation,
payment, storage/database, and Production behavior are unchanged.

## Authority migration

- Visual Contract request/receipt/readiness: `v19/v22/v20`.
- Live-request materialization/verification: `v17/v17`.
- Execution materialization input/result: `v7/v11`.
- Supervisor request/readiness/result: `v16/v16/v8`.
- Fresh Readiness evidence: `v16`.

Immediate prior Visual Contract request v18, receipt v21, and readiness v19 are
classified `legacy_immutable`. Existing artifacts were not edited or
redigested and cannot authorize a new attempt.

## Validation

- Direct book-surface contract: **1 file / 11 tests PASS**.
- Complete affected compiler/lifecycle/canonical set: **9 files / 406 tests
  PASS**, deterministic single worker, no timeout or RPC/IPC failure.
- `npx --no-install tsc --noEmit`: PASS.
- Focused workload classifier after inventory correction: **1 file / 7 tests
  PASS**.
- `git diff --check`: PASS.
- First literal `npm run check`:
  - TypeScript contracts: PASS;
  - resource-intensive: **19 files / 568 tests PASS**, valid diagnostics;
  - ordinary: the six established missing ignored-output fixture failures plus
    one stale inventory assertion caused solely by the new spec.
- Authorized replacement after the two-number test-only correction:
  - TypeScript contracts: PASS;
  - ordinary: **281 files / 3,232 tests**, exactly the six established fixture
    failures, no seventh assertion or infrastructure failure;
  - resource-intensive: **19 files / 568 tests PASS**, valid diagnostics and no
    timeout, RPC/IPC, reporter, launch, signal, or teardown failure.

The six ignored-output fixtures remain a separate Production/release HOLD.
They are not implementation findings and do not authorize release.

## Acceptance, risk, and rollback

The decisive fake-provider regression proves the bounded sequence: an initial
draft exposes page-cardinality issues, call 2 uses `page_contract_patch`, the
repaired draft exposes the mixed book-surface family, call 3 uses
`book_surface_patch`, and complete validation emits a candidate. Direct tests
also reject malformed schemas, unsafe references, duplicates, incomplete or
unexpected page sets, invalid cover authority, input mutation, and non-target
drift.

Implementation cost was `$0`; no credential, pricing/network/provider call,
real B0/Fresh Readiness, preflight, live authoring, render, storage/database,
deployment, or Production action occurred. Revert the focused implementation
commit to restore the previous full-draft fallback; new-version artifacts then
fail closed and all historical evidence stays immutable.

Independent Claude Code QA remains required before push and a new operational
attempt. This document is Codex implementation evidence, not a self-awarded
technical PASS.
