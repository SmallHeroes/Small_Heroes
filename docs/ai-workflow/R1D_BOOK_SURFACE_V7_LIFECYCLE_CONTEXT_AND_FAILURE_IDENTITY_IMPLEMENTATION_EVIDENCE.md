# R1D Book Surface v7 Lifecycle Context and Failure Identity — Implementation Evidence

**Date:** 2026-08-18
**Owner:** Codex
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `bbb8afd7f9ebdd7f24c61bbd19a3c2f18afd7e9a`
**Decision Gate:** `R1D_BOOK_SURFACE_V7_LIFECYCLE_CONTEXT_AND_FAILURE_IDENTITY_DECISION_GATE.md`

## Outcome

The v7 Book Surface prompt now supplies exact prose-free recurring-prop
lifecycle context: current reveal plus every required and forbidden page for
each prop. The compiler recomputes and binds that context before application,
keeps the existing full-book lifecycle validator, and explicitly instructs the
provider to preserve any existing Source Evidence IDs in writable action
requirements. The response schema and atomic action/coverage authority are
unchanged.

Three Book Surface application guards that were previously sanitized as
`unclassified` are now closed diagnostic identities. Binding changed/stale map
to `target_identity_invalid`; lifecycle obligation failure maps to
`recurring_prop_invalid`. Diagnostics v3 retains exact read-only validation for
legacy v2 and v1 without widening either historical identity domain.

## Authority cutover

- Book Surface schema/system/user: v6/v7/v7.
- Repair-output diagnostics: v3; v2/v1 legacy immutable.
- Authoring request/receipt/readiness: v33/v37/v35.
- B0 input/manifest/verification: v22/v31/v31.
- Execution materialization input/result: v21/v25.
- Supervisor request/readiness/result: v30/v30/v23.
- Fresh Readiness: v30.
- Unchanged: draft v15, Page Contract v2, Structural Bundle v3, policy v12,
  budget v2, Candidate v9, OpenAI evidence v6, child authority v1 and bridge v2.

Current writers require the new versions and exact prompt/schema digests.
Immediate authoring predecessors v32/v36/v34 are registered immutable, and
direct predecessor tests cover B0 v30, Supervisor v29 and Fresh v29 envelopes.

## Validation

- Core lifecycle, Book Surface and diagnostics: **4 files / 192 tests PASS**.
- Canonical materialization/Supervisor/Fresh/boundary: **6 files / 327 tests
  PASS**. The combined run reported two known Vitest `onTaskUpdate` RPC timeouts
  after all assertions passed.
- The affected materialization suite rerun alone: **1 file / 35 tests PASS**
  with exit 0.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The literal repository gate was not repeated. It already ran exactly once for
the immediately preceding v6 milestone and recorded only the five established
missing ignored-output fixture assertions plus known resource-runner timeout
artifacts; every production/test surface touched by this focused correction is
covered above.

## Execution exclusions

Implementation and validation cost `$0`. No credential, provider, network,
Fresh, live authoring, image, render, storage/database, deployment or production
action occurred during this correction. Independent QA remains pending and
this evidence does not itself authorize the next spend or render.
