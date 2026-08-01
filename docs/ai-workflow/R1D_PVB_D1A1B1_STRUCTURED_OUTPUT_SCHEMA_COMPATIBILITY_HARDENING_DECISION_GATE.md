# R1D-PVB-D1A1B1 Structured Output Schema Compatibility Hardening — Decision Gate

**Status:** APPROVED by Guy in the delegated implementation brief before implementation
**Implementation base:** `d18412c3635511935771771dbd2b6ad271731095`
**Branch:** `codex/r1d-pvb-d1a1b1-structured-output-schema-compatibility-hardening`
**Worktree:** `C:\Users\guyna\.codex\worktrees\3862\Small_Heroes`
**Independent QA:** Claude Code **PASS** for exact implementation range `d18412c3635511935771771dbd2b6ad271731095..dd1104259176e6951fe81f87c6db406e8939b00a`

This file is the durable transcription of the Decision Gate that Guy approved in the implementation Task. It does not create new authority.

## 1. Proposed change

Add a deterministic, repository-owned compatibility profile and validator for the strict JSON Schema subset accepted by OpenAI Responses Structured Outputs. Correct the Visual Contract and Blueprint draft schemas so every `const` has an explicit matching `type`; version the changed schemas and every current authority envelope whose shape changes; bind the compatibility authority into B0 materialization, the canonical B0 verifier, the Execution Request/Supervisor readiness chain, canonical pre-live readiness, and the OpenAI Responses adapter. Reject an incompatible serialized schema before credential access, SDK construction, transport dispatch, or a semantic repair.

The official compatibility source is the current [OpenAI Structured Outputs supported-schemas guide](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas). The installed `openai@6.35.0` Zod helper is a positive implementation control for typed string/boolean literals and its Draft-07 `$schema` marker.

## 2. Why now?

Lead supplied evidence that a latest live call authenticated and reached OpenAI but returned HTTP 400 / `provider_bad_request` at `structured_output_schema`. The immutable base does not contain the later raw provider response or rejected schema body, and the provider evidence intentionally did not persist them. Therefore the five const-only Visual Contract action-semantic nodes remain a best-supported reconstruction, not a proven provider diagnosis. The Blueprint schema contains analogous const-only nodes, including a boolean literal. The system lacked a pre-provider compatibility gate and did not bind compatibility authority into B0/readiness.

## 3. Scope

This is a general system change. It applies the same profile and traversal to any supplied schema, positive-controls both current production schemas, and contains no Story Source, child, companion, page, prop, or story-specific literal.

## 4. Risk of hardcoding

The validator traverses serialized JSON Schema structurally, uses index-only sanitized paths and stable rule identifiers, and enforces explicit profile limits. It does not recognize the names or literal values of the current stories or schemas. Typed `const` is retained; it is not weakened into a looser enum.

## 5. Files and authority chain

The implementation changes the schema builders, compatibility module, Visual Contract request boundary, Blueprint authoring boundary, canonical adapter, B0 materializer/verifier, Execution Request/Supervisor, pre-live readiness, focused tests, `CURRENT.md`, and this Gate/evidence pair.

Smallest fail-closed version chain:

- Visual Contract draft schema: `vc-draft-schema/v7` → `v8`.
- Blueprint draft schema: `pre-render-blueprint-draft-schema/v2` → `v3`.
- Visual Contract authoring request: `visual-contract-authoring-request/v4` → `v5`.
- B0 manifest and verifier: `canonical-live-request-materialization/v2` → `v3`; `canonical-live-request-verification/v2` → `v3`.
- Execution Request and readiness: `canonical-live-execution-request/v1` → `v2`; `canonical-live-execution-readiness/v1` → `v2`.
- Canonical pre-live readiness evidence: `canonical-pre-live-readiness-evidence/v1` → `v2`.
- New compatibility profile/evidence: `openai-responses-structured-output-compatibility-profile/v1` and `openai-responses-structured-output-compatibility-evidence/v1`.

Unchanged because their shapes and meanings do not change: B0 materialization input, authoring receipt/readiness/candidate, provider response evidence, provider failure evidence, execution materialization input/result, pre-live failure evidence, prompts, model, service tier, timeout, token/call/repair/cost budgets, retries, fallback, Story Source semantics, Board/render/storage/approval/promotion/deployment behavior.

Historical versions remain immutable evidence. Exact current validators reject them for a new attempt; they cannot become current authority by recomputing an outer digest.

## 6. Expected behavior

- Both fully serialized current schemas pass one deterministic compatibility profile.
- Unsupported keywords/shapes, missing explicit literal types, type mismatches, and quantitative-limit violations fail with stable sanitized issues.
- B0 and every downstream current authority carry or verify the current compatibility profile/evidence/schema identity.
- A stale or incompatible B0/readiness chain cannot arm a future attempt.
- The canonical adapter rejects incompatible body schema before credential read, SDK construction, transport dispatch, HTTP response, or provider access.
- Request/provider schema incompatibility is terminal. Only a well-formed provider output that fails structural/semantic compilation may consume a semantic repair.

## 7. Validation plan

Use repository-local unit/integration/subprocess tests only: profile positive/negative controls, typed string/boolean const controls, deterministic/sanitized issues, limits, migration/redigest fences, B0 materialize/verify, Execution Request/Supervisor, pre-live readiness, legacy compiler, Blueprint compiler, adapter pre-credential rejection, and repair lifecycle. Then run deterministic TypeScript, `git diff --check`, and exactly one `npm run check`. No full book or provider call.

Post-implementation QA measured Blueprint v3 at nesting depth **10**, exactly the current official maximum of 10 and therefore with zero headroom; Visual Contract v8 is depth 8. This is an explicit future-change fence: every Blueprint schema edit must rerun the serialized-schema compatibility profile before authority versioning/materialization, and no additional nesting level may be accepted. The passing schema is not redesigned or loosened merely to create headroom. After QA, Codex re-fetched the current official guide online and confirmed this limit plus the profile's other supported-subset rules and quantitative constants.

## 8. Cost impact

Exactly `$0`. No credential, provider, model, image, Vision, audio, storage, database, pricing, or other billable/network action is authorized.

## 9. Rollback plan

Revert the focused implementation commit. Do not reinterpret v8/v3/v5/v3/v2 artifacts as older versions. Any future attempt after rollback or reapplication must rematerialize B0 and readiness from current code; historical artifacts remain immutable evidence only.

## 10. Review assignment

Guy already approved the product intent and constraints. Claude Code must review the final immutable base-to-head range read-only first and try to falsify: profile fidelity to official docs/SDK behavior; complete serialized traversal; issue sanitization/determinism; version and digest binding; B0/readiness stale-authority rejection; pre-credential ordering; and repair-budget preservation. No product/creative/UX question requires Claude Cowork.

## 11. Stop-check and do not do

- General system fix: yes.
- Production behavior affected: only fail-closed compatibility/authority checks before a future live attempt.
- Story/child/companion/style risk: bounded by structural generic validation and existing regressions.
- Spend: none.
- Smallest validation: local schemas and authority/subprocess tests; no render.
- Guy eyeball: no visual output exists; inspect the profile, version chain, and QA findings.

Do not access credentials or `.env`; perform pricing/network/provider/model calls; author live; run canonical live preflight; render; use image/Vision/audio; access storage/database; act on Board; run real Semantic Reconciliation; approve; publish; promote; activate production; deploy; push; or alter prompt/model/budget/retry/fallback/policy behavior.
