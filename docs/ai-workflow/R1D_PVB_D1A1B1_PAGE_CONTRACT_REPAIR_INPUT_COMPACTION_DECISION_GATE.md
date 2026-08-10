# R1D-PVB-D1A1B1-PAGE-CONTRACT-REPAIR-INPUT-COMPACTION — Decision Gate

**Decision:** approved by Guy's standing authority to continue to the first Wizard-connected LOW page without additional operational approval pauses.

## Observed behavior and root cause

At immutable `48e9e29cafdfee8906ce0855dfde182e6109e538`, Fresh Readiness passed and one bounded live invocation completed two provider calls. The first repair resolved all four page-spatial reference failures. Whole-book validation then emitted the closed homogeneous identity set `draft_contract / final_structural_invariant_invalid / page / final_structure` for pages 1–12. The remaining repair was correctly restricted to `page_contract_patch`, but its input duplicated verbose JSON object keys across every complete affected page and exceeded the unchanged conservative 64K admission ceiling before a third provider call.

The failure is input representation overhead, not a request for a larger model context, higher call budget, or weaker validation. Candidate, reconciliation, Blueprint, Wizard, and render authority remained absent.

## Nine architectural decisions

1. Keep the current closed `page_contract_patch` eligibility, complete affected-page set, output schema, parser, apply guards, and full post-repair validation unchanged.
2. Compact only the repair **input** by losslessly encoding its existing JSON value domain; do not omit, summarize, infer, or alter a semantic value.
3. Use a repository-owned deterministic codec with explicit version, sorted object-shape dictionaries, a repeated-string dictionary, and unambiguous tagged tuples for objects, arrays, and string references.
4. The model receives exact decoding instructions and must still return the existing strict `PageContractRepairPatches` object containing complete page contracts. No encoded response is accepted.
5. Dictionary membership, shape order, affected-page order, target order, and canonical bytes are deterministic. Encoding the same value twice must be byte-identical, and local decode must reproduce canonical equality with the original payload.
6. Compaction is general for every Story Source and every valid page-contract repair payload; production code contains no Fox, page, character, phrase, or provider-response literal.
7. Malformed, non-JSON, non-finite, unsupported, ambiguous, or round-trip-divergent input fails closed before provider reachability. Existing stale/duplicate/incomplete/unexpected response and non-target guards remain unchanged.
8. `gpt-5.6-sol`, Responses API, default tier, medium reasoning, 64K input ceiling, 36K output ceiling, one initial plus at most two repairs, zero transport retries, no fallback, timeout, `$4.884` conservative reservation, and `$5.00` hard ceiling remain unchanged.
9. Cut over the repair prompt/input encoding versions and all authority digests that derive from them. Historical artifacts remain immutable and non-authoritative. After independent QA, create new Fresh Readiness and run one bounded attempt; only a real candidate may proceed through Semantic Reconciliation, Blueprint/Wizard qualification, image pricing, and one local `gpt-image-2` LOW portrait-page render.

## Acceptance criteria

- Direct codec tests prove deterministic, lossless round-trip and fail-closed rejection.
- Existing response schema/parser/application behavior and non-target containment remain byte-for-byte or behaviorally unchanged.
- A 12-page Fox-shaped repair fixture stays below 64K with at least 4,096 conservative units of headroom; the corpus and oversized negative control remain fail-closed.
- Focused compiler/lifecycle/canonical authority tests, deterministic TypeScript, and `git diff --check` pass.
- Literal `npm run check` is run once; only the six established ignored-fixture failures may remain.
- Claude Code independently reviews the immutable implementation range before any new Fresh Readiness.

## Rollback

Revert the implementation commit(s). All pre-change artifacts remain immutable; no migration rewrites them. A rollback invalidates any readiness produced from the compacted prompt authority and requires fresh materialization on the rollback head.

## Exclusions

No credential access, provider call, Fresh Readiness, preflight, live authoring, candidate, reconciliation, Blueprint/Wizard execution, render, storage/database, publication, deployment, or production activation is authorized inside implementation and QA.
