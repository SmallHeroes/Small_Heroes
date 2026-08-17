# R1D-PVB-D1A1B1 Pure Page-Spatial Repair Canonical Context — Implementation Evidence

Status: LOCAL GREEN; INDEPENDENT CLAUDE CODE QA PENDING

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-pure-page-spatial-repair-canonical-context`
- Exact pushed base: `f1397b9c798868700d15e982994894b1fd21bc83`
- Implementation commit: `2782ea07`
- Production: untouched

## Predecessor live evidence

The consumed run under output schedule `[40,000, 32,000, 36,000]` completed
three provider responses and exhausted without a candidate. Repair 1 resolved
the initial 22 unique failures and left six unique
`draft_contract:out_of_scope_reference` issues. Repair 2 used `full_draft`,
resolved those six, and reintroduced 27 unique action-semantic and structural
failures.

- Receipt digest: `b6b96f7bb740a8f7412866f37d079b5ccdbf99ec1c40543e78a4dddc3681eaa4`
- Logical provider calls / repairs / transport retries: `3 / 2 / 0`
- Fallback: `false`
- Usage: input `39,679`; cache-write `35,062`; cached `4,608`; output `79,615`; reasoning `9,940`; total `119,294`
- Nominal / conservative accounting: `$2.609937 / $2.90009`
- Candidate / Reconciliation / Blueprint / Wizard / render authority: none

## Root cause and implementation

`DraftAuthorityReferenceDomainError` carries typed issues, page-spatial repair
authority, and compiler-owned canonical page contracts. The compound repair
lane already used those canonical page contracts. The pure page-spatial lane
instead called `pageSpatialReferenceRepairTargets` and
`applyPageSpatialReferenceRepairPatches` with the raw provider draft. Because
the typed locators and authority were produced after topology canonicalization,
raw/canonical zone-ID drift could make exact compact authority derivation return
null and route the next standard repair as `full_draft`.

The implementation stores the canonical page-contract draft for a pure
page-spatial failure and uses it for both target derivation and patch
application. The compact prompt still contains only exact target coordinates,
action context, and permitted spatial values. It excludes raw rejected IDs and
the raw page-contract payload. No fuzzy matching, fallback, retry, extra call,
new schema, migration, or story-specific behavior was added.

## Validation

- Raw topology alias → canonical compact repair regression: PASS, `1/1`.
- Compound, mixed-family, terminal-cleanup and canonical-context focused slice: PASS, `4/4`.
- `page-contract-repair.spec.ts` + `draft-reference-domain-hardening.spec.ts`: PASS, `110/110`.
- Complete `source-authority-lifecycle.spec.ts`: PASS, `82/82`.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS after EOF cleanup in the documentation closeout.
- One literal `npm run check`:
  - TypeScript and story autonomous typecheck: PASS.
  - Ordinary: 3,208 passed, 65 skipped, 5 failed assertions across 4 known missing-output fixture tests; no new implementation assertion.
  - Resource-intensive: 19 files / 586 tests PASS.
  - No timeout, RPC/IPC, reporter, launch, signal, teardown, or diagnostic-protocol failure.

The ordinary fixture failures remain a separate known release HOLD. They do not
grant release authority and are not represented as a green literal repository
gate.

## Preserved boundaries

- No prompt/schema, model, 64K ceiling, output allocation, call/repair budget,
  timeout, retry, fallback, cost ceiling, candidate or downstream change.
- Historical receipts/readiness/output artifacts remain immutable.
- No credentials, provider/network call, Fresh Readiness, preflight, live
  authoring, image/Vision, render, storage/database, deployment or production
  action occurred.

## Rollback

Revert `2782ea07` and this documentation closeout. No data or artifact migration
is required.
