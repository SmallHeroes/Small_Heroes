# R1D-PVB-D1A1B1 Structured Output Schema Compatibility Hardening — Implementation Evidence

**Status:** INDEPENDENT CLAUDE CODE TECHNICAL PASS
**Review range:** `d18412c3635511935771771dbd2b6ad271731095..dd1104259176e6951fe81f87c6db406e8939b00a`
**Branch:** `codex/r1d-pvb-d1a1b1-structured-output-schema-compatibility-hardening`
**Worktree:** `C:\Users\guyna\.codex\worktrees\3862\Small_Heroes`
**Push:** none
**Cost:** `$0`

The reviewed implementation commit is `dd1104259176e6951fe81f87c6db406e8939b00a`. Claude Code awarded the independent technical PASS; Codex only transcribes that verdict here.

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

## Independent QA closeout

- Topology **PASS**: exact `HEAD` `dd1104259176e6951fe81f87c6db406e8939b00a`, merge-base `d18412c3635511935771771dbd2b6ad271731095`, clean worktree including untracked state, one commit / exactly 31 files, no configured upstream or same-name remote ref, and clean `git diff --check`.
- Claims **8/8 confirmed**. Claude independently reproduced TypeScript **PASS**, the profile at **27/27 PASS**, and affected authority suites at **8 files / 293 tests PASS**. It did not rerun `npm run check`; the recorded six established ignored-fixture failures remain the only full-gate limitation.
- Verdict: **PASS** with one accepted non-gating MINOR and three notes. MINOR-1 records that Blueprint v3 is compatible at nesting depth 10 but has zero headroom against the official maximum 10; future Blueprint schema changes must rerun the serialized-schema profile, and any extra nesting must fail locally. No schema redesign is required by this finding.
- Claude's offline NOTE-1 was resolved after review by re-fetching the current official [OpenAI Structured Outputs supported-schemas guide](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas). The guide confirms the supported types/constraints/formats, root-object/no-root-`anyOf`, all-fields-required, `additionalProperties: false`, definition/reference/recursive-schema rules, unsupported composition keywords, and all encoded quantitative limits: 5,000 properties, 10 nesting levels, 120,000 aggregate named/enum/const characters, 1,000 enum values, and the 15,000-character cap for a string enum with more than 250 values.
- NOTE-2 records that the untyped-const defect originated in the earlier independently passed D1A1B2A milestone, whose semantic claim set did not include provider-schema compatibility and predated this profile. NOTE-3 preserves the limitation that the raw HTTP 400 body and rejected schema were not retained, so typed const remains the best-supported reconstruction rather than exact causal proof.

This documentation-only closeout is outside the immutable reviewed range and changes no implementation claim. No further Claude round is required unless this transcription's fidelity is disputed.

## Limitations and exclusions

No live/provider replay was authorized, so this milestone proves local compatibility with current official documentation and SDK serialization behavior; it does not retroactively prove the exact raw provider rejection. No credential loading/check, `.env` access, pricing/network lookup, provider/model call, canonical live preflight, live authoring, render/image/Vision/audio, storage/database, Board action, real Semantic Reconciliation, approval, publication, promotion, activation, deployment, or push occurred. Prompts, model, timeout, service tier, budgets, retries, fallback, cost ceilings, Story Source semantics, and downstream product behavior are unchanged.
