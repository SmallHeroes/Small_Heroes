# R1D Compound Page Authority Compact Routing — Decision Gate

## Observed behavior

The immutable Leo v12 live attempt under `outputs/r1d-leo-v12-compound-page-authority-routing` completed three logical provider calls and produced no candidate. The first full-draft repair resolved all 38 original action-semantic and structural issues. The repaired draft then exposed 20 page-local issues: three action-binding cardinality failures and seventeen page-spatial reference failures across nine pages. The current compound router sent those two closed page-local families through a second full-draft repair. That response reached the exact 36,000-token output ceiling and ended `completion_status_invalid`.

## Expected behavior

When every remaining issue belongs to the already-approved action-binding-cardinality or page-spatial-reference families, the repair must replace only the complete affected page contracts. The response must not regenerate global world, cast, topology, cover, location, zone, Set Board or recurring-prop authority.

## Root cause

The previous Decision Gate correctly required co-observation but selected `full_draft` as the common repair representation. Live evidence now falsifies that representation: both issue families share one smaller mutable surface, `pageContracts`, and the full-draft response can exceed the existing output ceiling even though a bounded complete-page patch is sufficient.

## Nine architectural decisions

1. Keep independent co-observation of action-binding and page-spatial failures unchanged.
2. For the exact closed union of repairable action-binding-cardinality and repairable page-spatial-reference issues, derive one deterministic complete-page repair plan.
3. The affected-page set is the sorted union of both families; every affected page is returned exactly once.
4. Each page repair carries the existing full page contract plus typed repair targets, validation hints and the exact spatial IDs permitted by that page's zone.
5. Reuse the existing strict `PageContractRepairPatches` output schema and `page_contract_patch` lifecycle. Advance only the page-repair system/user prompt authorities to v11 so the typed spatial target and its permitted values are explicit. Do not add a provider call, repair, schema version or authority family.
6. Existing page-contract application guards remain authoritative: exact page set, unique pages and compiler-owned topology preservation. The combined lane additionally rejects duplicate spatial targets and every returned spatial ID outside the exact target authority; full draft validation still runs before candidate persistence.
7. Spatial authority is fail-closed: absent, duplicate or mismatched page/zone authority makes the mixed plan ineligible; no fallback to guessed IDs is allowed.
8. A third issue family remains terminal. Homogeneous page-spatial and homogeneous action-binding routes remain unchanged.
9. The consumed v12 artifacts remain immutable. A future live attempt requires a new pushed head, Fresh Readiness, preflight and Supervisor verification.

## Tests and acceptance criteria

- Directly prove a mixed action-binding plus page-spatial failure selects one `page_contract_patch`, not `full_draft`.
- Decode the real repair prompt and prove the exact affected-page union, exact typed targets and per-zone permitted spatial values.
- Prove a valid patch updates only affected page contracts and reaches a candidate.
- Prove missing spatial authority, duplicate authority, a third issue family, unexpected/duplicate/missing pages, duplicate spatial targets and unpermitted spatial IDs remain fail-closed.
- Preserve homogeneous route tests, lifecycle evidence, TypeScript and repository-gate behavior.

## Unchanged behavior and exclusions

No prompt budget, 64K input ceiling, 36K output ceiling, model, service tier, call/repair count, timeout, retry, fallback, pricing, candidate semantics, render policy or downstream authority changes. No story-, child-, companion- or page-specific literal is permitted.

## Rollback

Revert the focused implementation commit. The prior fail-closed `full_draft` route returns, and all already-persisted artifacts remain byte-immutable.
