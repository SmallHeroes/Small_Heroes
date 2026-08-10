# R1D-PVB-D1A1B1 Page Repair Topology Preservation — Decision Gate

## Observed blocker

The bounded live attempt on `28fc4c2f637b633d3a2b4a88e1df43d30b88a777` completed all three provider calls. The final `page_contract_patch` resolved every issue it was authorized to repair but introduced one page-1 `unresolved_reference` with locator field role `topology`. No candidate was persisted.

## Root cause

The complete-page application boundary replaced the entire page object. The prompt instructed the provider to keep authority IDs unchanged, but the application boundary did not enforce that rule. Page topology was never an admitted repair target.

## Nine decisions

1. Preserve the existing page `zoneId` and `locationId` when applying complete-page repairs.
2. Keep every currently admitted typed repair target unchanged.
3. Do not infer, normalize or choose a replacement zone.
4. Keep strict response keys, exact page set and full post-application validation.
5. Do not change prompt or structured-output schema authority.
6. Do not change model, service tier, token, call, repair, timeout or cost budgets.
7. Add a direct non-mutation regression with an invented replacement zone/location.
8. Bind the change through a new immutable HEAD and new Fresh Readiness before any live retry.
9. Continue only toward one local Wizard-connected LOW portrait render; production and all publication/deployment authority remain blocked.

## Acceptance

- Targeted replacement fields apply.
- Original page topology identities survive byte-for-value.
- Input remains unchanged.
- Focused repair/lifecycle tests, TypeScript and `git diff --check` pass.

## Rollback

Revert the focused implementation commit. Historical attempts and artifacts remain immutable.
