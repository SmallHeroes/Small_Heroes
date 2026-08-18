# R1D BookSurface v10 valid cover identity fallback — implementation evidence

**Date:** 2026-08-18

**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `633affac56b6d9fc38ce324e76fedb5a1b6f8db3`

## Consumed evidence

The sole live attempt rooted at
`outputs/r1d-echo-identity-fresh-633affac-20260818T123615036Z` is terminal and
will not be replayed. Receipt
`0e36ec18ab1ad689e3b62c4601b38b908a4b1524a63fef56cabafa12f74c38b5`
records three completed provider calls, two repairs and no retry/fallback. The
route was `initial -> page_contract_patch -> book_surface_patch`; the final
BookSurface response was rejected locally with exact sanitized identity
`book_surface_repair_cover_reference_invalid`. No Candidate, Wizard approval or
render authority exists from that root.

## Implemented contract

- `worldType` is always restored from the closed compiler reference authority.
- A valid current cover location/zone pair wins over provider output.
- An invalid current pair may be replaced only by a provider pair that resolves
  inside the exact location/zone authority.
- A wholly valid current ordered cast list wins; otherwise a wholly valid
  provider list is accepted.
- When neither list is wholly valid, only a nonempty valid subset already
  present in the current cover may survive. No cast member is invented from a
  partially invalid provider list.
- Empty/malformed/unknown identities reject before mutation. Stale authority,
  unrelated-field drift, exact-key/order checks and full-template validation are
  unchanged.

The response schema remains BookSurface v6. The changed prompt semantics advance
the system/user prompt versions v9 to v10 and the current immutable authority
chain as follows:

- authoring request / receipt / readiness: v37 / v41 / v39;
- B0 input / manifest / verification: v26 / v35 / v35;
- execution materialization input / result: v25 / v29;
- Supervisor request / readiness / result: v34 / v34 / v27;
- Fresh Readiness: v34.

Immediate authoring predecessors are registered as immutable legacy evidence.
Policy v13, schema v6, Candidate v9, provider/model/tier/reasoning, call and
repair counts, output caps, retry/fallback, hard `$5` fence, Wizard behavior and
renderer behavior are unchanged.

## Validation evidence

- BookSurface + compiler loop + source-authority lifecycle: 3 files, 158/158
  PASS.
- Current authority chain: 7 files, 419/419 PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check`, no retry:
  - ordinary: 3,258 passed, 65 skipped, exactly five failed assertions from the
    established missing ignored-output fixture HOLD;
  - resource-intensive: 605/605 assertions passed; process exited nonzero on two
    post-assertion Vitest `onTaskUpdate` RPC timeouts;
  - diagnostic protocol remained valid.

No credential was inspected or copied during implementation. No provider,
network, Fresh, live authoring, image generation, storage/database, deployment
or render action was performed. The implementation evidence is not independent
QA and does not itself authorize Candidate promotion or product acceptance.
