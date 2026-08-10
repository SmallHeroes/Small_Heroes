# R1D-PVB-D1A1B1-CROSS-FAMILY-PAGE-REPAIR-INPUT-COMPACTION-V2 — Decision Gate

**Base:** `f4cf27ea64494ec7a8697c013dff705797552f3a`
**Date:** 2026-08-11
**Owner decision:** Guy's standing authorization is to continue through one local LOW portrait-page render without routine approval pauses, while production remains blocked.

## Observed blocker

The second bounded post-routing attempt proved the first two calls work: the initial OpenAI response completed and one field-scoped spatial repair resolved all three initial reference failures. The closed cross-family planner then selected one `page_contract_patch` for seven presentation gaps plus twelve final-structure page failures. That third call never reached OpenAI because the lossless provider input exceeded the unchanged 64,000-token conservative admission ceiling.

The blocker is transport size, not repair eligibility, model behavior, provider transport, budget, candidate persistence, Blueprint, Wizard or renderer behavior. The existing v1 codec removes repeated whole strings and object keys, but not repeated composite values or repeated fragments inside otherwise-unique IDs, pointers and descriptions.

## Nine architectural decisions

1. **General lossless codec only.** Implement `page-contract-repair-input-encoding/v2` for every Story Source; no Fox/page/story literals.
2. **Closed representation.** Add only canonical `fragmentDictionary` and `valueDictionary` tables to the existing tagged representation. No arbitrary executable, expression, compression program or provider-supplied decoder exists.
3. **Exact roundtrip.** Prompt construction locally decodes v2 and proves canonical equality with the complete original repair authority before provider reachability.
4. **Canonical determinism.** Dictionaries and object-shape tables are unique, sorted and content-derived; input object-key order cannot affect bytes.
5. **Fail closed.** Unknown tags, malformed/out-of-range references, duplicate/unsorted/unused dictionaries, nested value references, non-JSON values and cycles are rejected locally.
6. **Prompt-only cutover.** Page-contract system/user authority advances from v9 to v10. Output schema v1, exact complete-page set, parser, application and full revalidation do not change.
7. **Budgets unchanged.** Model, Responses API, service tier, 64K input ceiling, 36K output ceiling, one initial plus two repairs, zero transport retries, no fallback, timeout and `$4.884/$5.00` ceilings remain unchanged.
8. **Admission proof.** A provider-sized twelve-page fixture with fifteen actions per page and the exact mixed structural/presentation family must roundtrip and retain at least 4,096 units of conservative admission headroom.
9. **Operational route.** After focused/full validation and independent Claude Code PASS, push the exact head, create Fresh Readiness, run one bounded live attempt, and continue only on a real candidate through Semantic Reconciliation, Blueprint/Visual Package, Wizard dry-run and one local `gpt-image-2` LOW portrait render.

## Rejected alternatives

- Raising the 64K ceiling, model context, call count or spend ceiling.
- Splitting the twelve pages across extra calls.
- Omitting or summarizing page authority.
- Parsing validator prose into new field patches during this milestone.
- Gzip/base64 or an opaque representation the model cannot deterministically reconstruct.
- Bypassing canonical preflight, Fresh Readiness, Supervisor or Wizard gates.

## Acceptance and rollback

Focused compiler/lifecycle and canonical authority tests, deterministic TypeScript and `git diff --check` must pass. The one repository gate may contain only the six established missing ignored-output fixtures; every other assertion or infrastructure failure blocks. Rollback is a clean revert to the exact base: no persisted historical artifact is rewritten and no database/deployment/production state is touched.

Production remains blocked. This gate authorizes only the path to one local LOW measurement.
