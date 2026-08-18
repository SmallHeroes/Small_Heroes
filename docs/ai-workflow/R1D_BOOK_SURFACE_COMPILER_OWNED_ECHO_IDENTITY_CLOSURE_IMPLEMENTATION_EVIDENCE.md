# R1D BookSurface compiler-owned echo identity closure — implementation evidence

**Date:** 2026-08-18
**Base:** `260c48aaf7c0bb773fab985c2c48687de6038064`
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

## Runtime evidence that motivated the change

The consumed v9 root is
`outputs/r1d-cover-identity-v9-fresh-260c48aa-20260818T110925212Z`.
Receipt v40 `e89d17cd85da4524eb02e08fd704b639e1d98eb9193f8347c3a42413804d861e`
contains three completed calls, two repairs and no transport retry/fallback.
Attempt 3 was a parsed BookSurface response and failed local application with
`book_surface_repair_authority_mismatch`. No Candidate exists. This happened
before Wizard or render and does not authorize replay.

## Implemented invariant

- Exact array cardinality and ordered compiler authority remain mandatory.
- Presentation response records are normalized by ordered authority before
  validation: `pageNumber`, `coverageIndex`, `beatId` and `sourceEvidenceId`
  are compiler-owned. `presentationClass` and one permitted pointer remain the
  model's semantic output.
- Authorized recurring-prop response records are normalized by ordered
  authority: all fields except `firstRevealPage` are compiler-owned.
- Existing action-binding and cover-reference restoration remain unchanged.
- Null/non-null authorization mismatch, missing/extra records, stale authority,
  unpermitted pointers, malformed response shape, non-target drift and final
  template validation still reject atomically.

No prompt or schema bytes changed, so BookSurface stays v6/v9/v9 and no
authority-version cascade was created. The new Git HEAD is independently bound
by the next Fresh package.

## Validation

- `npx --no-install vitest run lib/__tests__/book-surface-repair.spec.ts lib/__tests__/visual-contract-repair-loop.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts --maxWorkers=1 --no-file-parallelism` — **3 files / 158 tests PASS**.
- `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.

The direct suite covers hostile presentation identity, hostile recurring-prop
immutable fields, missing cardinality, unauthorized nulls, stale authority,
pointer rejection and input immutability. The compiler-loop fixture returns
hostile presentation identities through the real response boundary and reaches
a Candidate in exactly three calls.

## Boundaries

Implementation used no credential, provider, Fresh Readiness, live authoring,
image, render, storage, deployment or production operation. A future live
attempt must use a new Fresh package and exactly one Supervisor invocation.
