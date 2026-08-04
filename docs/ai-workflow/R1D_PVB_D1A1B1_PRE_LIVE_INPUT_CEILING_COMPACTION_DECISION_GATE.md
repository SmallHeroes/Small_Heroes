# Decision Gate — R1D-PVB-D1A1B1-PRE-LIVE-INPUT-CEILING-COMPACTION

**Status:** APPROVED by Guy; implementation and the narrow validation resume are authorized.
**Date:** 2026-08-04
**Owner:** Guy — Product Owner
**Technical owner:** Codex
**Exact base:** `b6155df9b3e142c9e667bba7f1dc395b50f45a82`
**Branch:** `codex/r1d-pvb-d1a1b1-pre-live-input-ceiling-compaction`
**Worktree:** `C:\Users\guyna\.codex\worktrees\c327\Small_Heroes`
**Cost allowance:** `$0`

## 1. Problem and verified root cause

The current Fox Visual Contract authoring request has a conservative UTF-8-byte input upper bound of `64,098`, exceeding the immutable `64,000` ceiling by `98`. The exact pre-change components are system prompt `10,313`, user prompt `36,627`, serialized schema `13,060`, protocol/framing allowance `4,096`, and separators `2`. This is a conservative estimator result, not actual tokenizer usage. No credential, provider, preflight, live-authoring, or render boundary was reached. Historical Fresh Readiness failure evidence is not implementation authority for this milestone.

The excess comes from repeated field labels in the Source Evidence Catalog and Action Semantic Catalog prompt projections. The canonical values themselves are required and must remain lossless.

## 2. Expected behavior

Prompt authority must project both catalogs as deterministic JSON tuple tables with one explicit ordered header per table. Every canonical value, ordering rule, Unicode character, punctuation mark, duplicate excerpt, and JSON escape must survive round-trip reconstruction. The same general serializers must work for every approved Story Source and for relevant full-draft repair prompts.

## 3. Approved decisions

1. Keep the model, Responses API, service tier, `64,000` ceiling, conservative estimator, `4,096` protocol allowance, output/call/repair budgets, timeout, retries, fallback, and `$4.884` / `$5.00` ceilings byte-for-byte and behaviorally unchanged.
2. Replace Source Evidence prompt rows with a deterministic JSON tuple table headed exactly by `[pageNumber, excerptOrdinal, startOffsetUtf8, endOffsetUtf8, sourceEvidenceId, excerpt]`; omit or infer no field.
3. Replace Action Semantic prompt rows with a deterministic JSON tuple table headed exactly by `[predicate, subjectKinds, objectRule, objectKinds, spatialEffectRule, spatialConstraintRule, spatialConstraintRelations, lateralityAllowed, proseProjection]`; preserve exact catalog ordering and every value.
4. Reuse the Source Evidence serializer for relevant full-draft repair catalog entries; permit no divergent repair-only format.
5. Bump only `TEMPLATE_PROMPT_VERSION`, `TEMPLATE_USER_PROMPT_VERSION`, and `REPAIR_USER_PROMPT_VERSION` from v8 to v9. Keep `REPAIR_PROMPT_VERSION` at v8.
6. Keep `vc-draft-schema/v12`, serialized schema bytes, schema digest, request shapes, and evidence shapes unchanged. A prompt digest change alone does not authorize shape versioning.
7. Bind current-authority validators to the new prompt versions/digests and reject stale authority fail-closed. Historical artifacts remain immutable evidence and are not authority for a future attempt.
8. Production logic must contain no story-, page-, character-, or excerpt-specific literal or special case.
9. Acceptance requires lossless round trips, provider-unreachable controls, a genuinely over-budget synthetic fail-closed case, all 18 approved v3 Story Sources at or below `64,000`, and minimum corpus headroom greater than `1,024`, at `$0` and without any live boundary.

## 4. Scope

- Compact deterministic catalog serializers and prompt projections.
- The three approved prompt-authority version bumps and current lifecycle binding.
- Direct round-trip, escaping, duplicate, corpus, schema-invariance, provider-unreachable, synthetic-over-budget, lifecycle, materialization, verifier, and readiness regression tests.
- The two-count validation-resume correction in `vitest-workload-classifier.spec.ts`, reflecting the newly added canonical spec: inventory `283 -> 284`, ordinary `264 -> 265`; resource-intensive remains `19`.
- Current-state and durable implementation evidence.

## 5. Explicit exclusions

No real B0 materialization, Fresh Readiness, canonical preflight, credential existence check/read/load, pricing, network/provider/model call, live authoring, render, image/Vision/audio, storage/database/Supabase, Board, Semantic Reconciliation, approval, candidate/Blueprint/package publication, promotion, production activation, deployment, PR, push, branch cleanup, dependency/lockfile change, budget/policy change, worker/timeout/retry/skip change, or Story Source edit.

## 6. Acceptance criteria

- Fox Source Evidence compaction saves exactly `4,361` upper-bound units.
- Action Semantic compaction saves exactly `2,060` upper-bound units.
- Fox total is at most `57,677`, providing at least `6,323` headroom.
- All 18 approved v3 Story Sources traverse the same production request path, remain at or below `64,000`, and have minimum headroom greater than `1,024`.
- Both table types round-trip to their complete canonical projections with deterministic order, Unicode/punctuation, duplicate excerpts, and JSON escaping preserved.
- `TEMPLATE_DRAFT_JSON_SCHEMA` serialized bytes and digest are unchanged.
- Provider reachability remains zero in tests, and a genuinely over-budget synthetic request still fails closed.
- Initial and repair prompt builders share the Source Evidence serializer; no divergent manual row formatter remains.
- Current authority accepts v9/v9 initial and v8/v9 repair authority and rejects the prior prompt versions even when content-addressed digests are recomputed.

## 7. Validation plan

Run focused compaction and compiler tests, all 18 approved Story Sources, lifecycle/materialization/verifier/readiness tests, the focused workload-classifier test, and deterministic repository-local TypeScript. Then run one literal `npm run check`. Only the exact six established missing ignored-fixture assertions in their five documented files may remain. Any seventh assertion or timeout/RPC/IPC/reporter/launch/teardown failure stops fail-closed.

The first full check stopped as required when the new canonical spec exposed stale hard-coded inventory counts. Guy then explicitly authorized a narrow validation resume changing only `283 -> 284` and `264 -> 265`, plus exactly one fresh full check after the focused classifier and TypeScript passed.

## 8. Risks and mitigations

- **Projection loss:** reconstruct the complete canonical objects in tests rather than checking size alone.
- **Escaping or duplicate collapse:** include explicit Unicode, punctuation, quotes, backslashes, tabs/newlines, and duplicate excerpt cases.
- **Repair divergence:** assert the exact shared serializer projection in both initial and full-draft repair prompts.
- **Authority drift:** assert exact version tuples and fail-closed stale-authority rejection through lifecycle and verifier paths.
- **Policy drift:** prove schema bytes/digest and request shapes are unchanged; inspect package and lockfile parity.
- **Story-specific optimization:** traverse the full approved corpus through the same production path and scan production changes for special cases.

## 9. Rollback

Revert the two focused local commits. No external state, remote branch, provider usage, artifact publication, deployment, or spend should exist.

## 10. Stop-before-major-actions check

- Product owner approval: **explicit**.
- Exact base and sole-writer topology: **verified before implementation and validation resume**.
- Cost/render allowance: **`$0`; no image or render work**.
- Schema/policy change required: **no**.
- Lossless projection demonstrated: **required before closure**.
- Full corpus headroom greater than `1,024`: **required before closure**.
- Credential/provider/live boundary: **excluded**.
- Push/deployment/publication: **not authorized**.

This Decision Gate authorizes only the bounded local implementation and validation described above. It grants no technical PASS, Fresh Readiness, provider, live-authoring, render, product, visual, publication, release, deployment, or push authority.
