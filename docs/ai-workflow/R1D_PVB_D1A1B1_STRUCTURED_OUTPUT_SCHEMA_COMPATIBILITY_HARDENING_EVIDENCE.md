# R1D-PVB-D1A1B1 Structured Output Schema Compatibility Hardening — Implementation Evidence

**Status:** IMPLEMENTATION COMPLETE LOCALLY — AWAITING INDEPENDENT CLAUDE CODE QA
**Review range:** `d18412c3635511935771771dbd2b6ad271731095..HEAD`
**Branch:** `codex/r1d-pvb-d1a1b1-structured-output-schema-compatibility-hardening`
**Worktree:** `C:\Users\guyna\.codex\worktrees\3862\Small_Heroes`
**Push:** none
**Cost:** `$0`

The implementation commit is the commit containing this evidence. The exact immutable head is supplied in the Task handoff after the commit exists. Codex does not award independent technical PASS.

## Verified starting state and diagnosis

- Dedicated branch/worktree began clean at exact immutable base `d18412c3635511935771771dbd2b6ad271731095`; no other worktree was modified.
- The base Visual Contract schema had five action-semantic `const` nodes without `type`. The Blueprint schema had analogous string literals and one boolean literal without `type`.
- Both schemas were inside the documented limits after correction: Visual Contract metrics were 141 object properties, depth 8, 1,932 named/enum/const string characters, and 80 enum values; Blueprint metrics were 251, depth 10, 3,602, and 150 respectively.
- `openai@6.35.0` with `zod@3.25.76` serializes `z.literal('x')` as typed string `const` and `z.literal(true)` as typed boolean `const`, with the SDK Draft-07 marker.
- The base did not retain the later provider's raw HTTP 400 message or rejected schema body. The const-only cause is therefore still the strongest reconstruction, not a proven exact rejected node.

## Implemented evidence

- A versioned profile/validator serializes the actual schema first, then traverses deterministically. It enforces root/object/required/additional-properties rules, supported types/keywords/formats/constraints, `anyOf`/definitions/local-reference rules, explicit typed `const`/enum policy, and documented property/depth/string/enum limits.
- Issues contain only stable rule IDs and structural index paths. Tests prove property names and literal values—including hostile Story Source-shaped strings—are absent from issue evidence.
- Visual Contract and Blueprint schemas use explicit typed `const` without loosening enums.
- Current request, B0, verifier, Execution Request/readiness, and pre-live evidence versions are bumped only where their shapes changed. The compatibility profile/evidence/schema digests are materialized and reverified through the chain.
- The canonical OpenAI Responses adapter validates `body.text.format.schema` before credential read and transport/SDK reachability. A local incompatibility carries sanitized deterministic compatibility evidence.
- The legacy Visual Contract compiler and Blueprint compiler validate before their injected callers. Adapter schema incompatibility terminates after one attempted call record with `repairCount: 0`; semantic repair behavior for provider outputs is unchanged.

## Validation results

- Compatibility profile: **1 file / 27 tests PASS**.
- Canonical adapter, lifecycle, source authority, and legacy Visual Contract paths: **131 + 29 + 16 tests PASS** in their latest focused runs; the adapter suite includes zero-credential/zero-transport incompatibility and terminal zero-repair controls.
- B0 verifier plus Execution Request materialization: **2 files / 62 tests PASS**.
- Execution Supervisor: **1 file / 34 tests PASS**.
- Canonical pre-live readiness plus Blueprint authoring/lifecycle: **3 files / 30 tests PASS**.
- Broader compiler/package/materialization regression sweep: **7 files / 148 tests PASS**.
- Deterministic repository-local TypeScript (`node node_modules/typescript/lib/tsc.js --noEmit --project tsconfig.json`): **PASS** after local Prisma client generation.
- `git diff --check`: **PASS** before documentation/commit; final staged and committed checks are recorded in the Task handoff.
- Exactly one `npm run check` was run and was not rerun. TypeScript passed. Vitest reproduced only the documented six missing ignored-fixture baseline failures across the same five files: `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two cases in `story-read-back-validation.spec.ts`. No milestone test failed.
- Task-created ignored test scratch was moved intact to `C:\Users\guyna\AppData\Local\Temp\small-heroes-r1d-structured-output-check-scratch-20260801-3862`.

## Limitations and exclusions

No live/provider replay was authorized, so this milestone proves local compatibility with current official documentation and SDK serialization behavior; it does not retroactively prove the exact raw provider rejection. No credential loading/check, `.env` access, pricing/network lookup, provider/model call, canonical live preflight, live authoring, render/image/Vision/audio, storage/database, Board action, real Semantic Reconciliation, approval, publication, promotion, activation, deployment, or push occurred. Prompts, model, timeout, service tier, budgets, retries, fallback, cost ceilings, Story Source semantics, and downstream product behavior are unchanged.
