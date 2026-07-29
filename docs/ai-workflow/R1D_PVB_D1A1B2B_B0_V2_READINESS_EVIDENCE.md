# R1D-PVB-D1A1B2B — Canonical B0 v2 Rematerialization and Attempt-6 Readiness Evidence

**Date:** 2026-07-29
**Worktree:** `C:\Users\guyna\.codex\worktrees\02a0\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b2b-b0-v2-readiness`
**Exact base:** `f0405df526642f029d782674415445cdefe8c171`
**Cost:** `$0.00`
**Images/renders:** `0`

This record is sanitized local execution evidence. The four generated B0 files and their v2 control input remain ignored, same-worktree artifacts. This document does not make them tracked release artifacts and does not authorize Attempt 6.

## Decision Gate and stop-check

### Proposed change and reason

Rematerialize the canonical B0 input bundle through the current generic production materializer because B2A intentionally advanced materialization/verification authority to v2, authoring request authority to v4, compiler draft schema to v7, prompt authority to v4, and Action Semantic Catalog/Coverage authority to v1. The old Attempt-5 v1/v3 bundle is immutable legacy evidence and cannot authorize a current live attempt.

### Scope

- one ignored `canonical-live-request-materialization-input/v2` control input;
- exactly four ignored content-addressed B0 artifacts under a fresh contained output root;
- read-only verification, idempotence, current-source rebuild, current-authority binding, and legacy rejection evidence;
- this durable sanitized record and `CURRENT.md`.

There is no code, schema, test, package, lockfile, Story Source, prompt, pricing, policy, provider, or downstream-artifact change.

### General-system and hardcoding check

The production path is the existing path/data-driven `source-authoring-live-request-materialize` and `source-authoring-live-request-verify` surface. `fox_uri_adventure` appears only in the ignored calibration input and resulting data artifacts. No story, child, companion, page, prop, or calibration literal was added to shared code.

### Expected behavior and smallest validation

The current source plus adjacent authored-cover authority rebuilds one current snapshot; the materializer emits one source-authority request, one source snapshot, one v4 live request, and one v2 manifest; the verifier returns v2 / `verified` / `zeroWrite:true`; identical replay reports `created:false` for all four. Current authority rejects the old bundle before any provider boundary.

### Risk and rollback

Risks were wrong digest domain, accidental legacy mutation, overwrite/collision, stale source/cover identity, wrong request policy, incomplete authority binding, or downstream category creation. Every boundary is fail-closed. Rollback is removal of only the contained ignored `outputs/r1d-pvb-d1a1b2b` tree plus revert of the focused documentation commit; no external or production state exists.

### Owner decisions and exclusions

Guy approved this artifact/evidence-only milestone through the delegated brief. No unresolved product or creative question required Claude Cowork. Claude Code must independently try to falsify the digest domains, current-source rebuild, current authority bindings, replay/no-overwrite claim, Attempt-5 preservation/rejection, exact four-file boundary, and zero-external/downstream claims.

Forbidden actions remained: code/tool/schema/test changes; canonical import preflight; credential read or existence check; pricing/docs/network lookup; provider/model/live authoring; render/image/Vision/audio; storage/database/Supabase; Board; Semantic Reconciliation or real approval; post-live readiness v2; rejected request; candidate; Blueprint; package; promotion; activation; deployment; external action; push.

## Topology and dependency gate

Before any write:

- target worktree was clean and detached at exact `f0405df526642f029d782674415445cdefe8c171`;
- local B2A branch and local `origin/codex/r1d-pvb-d1a1b2a-action-semantic-coverage` both resolved to that SHA at `0/0` parity;
- B2A, Attempt-5, and B0 source worktrees were clean and read-only;
- the target branch did not exist locally or in local origin tracking.

The target attached only to `codex/r1d-pvb-d1a1b2b-b0-v2-readiness`.

Dependency inputs:

| File | SHA-256 |
| --- | --- |
| `package.json` | `19ac6d7a01d5ac8c8f4ff16d0d7b57c5781a125d2d3ec3af43b6983fff082f7d` |
| `package-lock.json` | `bf7932428ac1bc2cb8885e83a21f231486f35ea36820381b7d1763a77ba03d59` |

`node_modules` was absent. The one exact install was:

```text
npm ci --offline --ignore-scripts
```

It exited `0`, added 200 packages from the local cache, audited 201, and reported zero vulnerabilities. There was no network fallback or alternate dependency source. The resulting `node_modules` is a real non-reparse directory. Exact local versions are Node `v22.19.0`, npm `10.9.3`, TypeScript `6.0.3`, tsx `4.22.2`, Vitest `3.2.4`, and Prisma/Prisma Client `6.19.3`.

Install scripts were disabled and the repository import graph required the generated Prisma client. The exact installed local CLI ran once:

```text
node node_modules/prisma/build/index.js generate --schema backend/schema.prisma
```

It exited `0` and generated Prisma Client `6.19.3` locally without database access.

## Control input and canonical artifacts

Ignored v2 control input:

`outputs/r1d-pvb-d1a1b2b/b0-v2/materialization-inputs/calibration-live-request-v2.json`

- version: `canonical-live-request-materialization-input/v2`;
- request ID: `r1d-pvb-d1a1b2b-b0-v2-calibration-001`;
- requested at: `2026-07-29T18:16:46.164Z`;
- raw bytes/SHA-256: `338` / `ba3bbcd6561421344e23519178719d700a578178d7d26a5bb7d1d7c95e23ae0c`.

The sole production materialization command was:

```text
node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-materialize --repo-root C:\Users\guyna\.codex\worktrees\02a0\Small_Heroes --request outputs/r1d-pvb-d1a1b2b/b0-v2/materialization-inputs/calibration-live-request-v2.json --out outputs/r1d-pvb-d1a1b2b/b0-v2/live-request
```

It returned `canonical_live_request_materialization / materialized_inputs_only` and created exactly four files:

| Artifact | Schema | Payload-domain digest and filename | Bytes | Non-authoritative raw SHA-256 |
| --- | --- | --- | ---: | --- |
| Source authority request | `story-source-authority-request/v1` | `d2dfb366e9623dd3e24d284b7c1c46a7b1cef4c6fcf08137910dcdc1536358c6` | 349 | `784c46fe12e6101125b3c6bd6c4b12cccf0234626ceaa34abc52c21573952f36` |
| Source snapshot | `story-source-authority-snapshot/v1` | `d8a6bed426a3ea571242915dcd63851bd59de4f148c52fbf28d0cb49429123d9` | 29,125 | `bdedc40c645c949bece8278ecf45e515e242eb957d1e85b9882605628216def0` |
| Live authoring request | `visual-contract-authoring-request/v4` | `c047401a14ab14cf8766aa7eadd0b32a084ddf29f66c67fc06af2f1bc5a01390` | 2,665 | `17b27d0ed557c0400abae906756652bf831d91438752af33ff754785ceba3699` |
| Materialization manifest | `canonical-live-request-materialization/v2` | `a18d8644f4565abba881d162554d0c6260e78a7c45db09501bfe82fedaeee55a` | 3,358 | `30a883e0d8f2901e63fcdf0309e4cd3fdb788e1b438ddc9e4b317358c87d9602` |

For every artifact, an independent current canonical-hash audit removed only top-level `digestAlgorithm` and `digest`, recomputed canonical JSON SHA-256 over that payload domain, and matched the claimed digest and filename. Whole-file SHA-256 values above are transport evidence only.

The worktree-bound source-authority request and manifest identities are new. The source snapshot retained historical portable digest `d8a6bed...23d9` only after the current source and adjacent authored-cover authority rebuilt exactly. The v4 live request has new digest `c047401a...1390`.

Current source evidence is `story-source/v1`, normalized digest `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`, exactly pages 1–12, with authored-cover authority present.

## Current verification and binding evidence

The exact production verifier command was:

```text
node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs scripts/production-visual-lifecycle.ts source-authoring-live-request-verify --repo-root C:\Users\guyna\.codex\worktrees\02a0\Small_Heroes --manifest outputs/r1d-pvb-d1a1b2b/b0-v2/live-request/live-request-materializations/a18d8644f4565abba881d162554d0c6260e78a7c45db09501bfe82fedaeee55a.json
```

Result:

- version `canonical-live-request-verification/v2`;
- status `verified`;
- `zeroWrite: true`;
- exact manifest/source-request/snapshot/normalized-source/live-request identities above;
- exact request ID and story key;
- OpenAI Responses / `gpt-5.6-sol` / `default` / `medium`;
- `maxCalls:3`, `maxRepairCount:2`, `transportRetries:0`, `noFallback:true`;
- `projectedMaxUsd:4.884`, `hardCeilingUsd:5`;
- credential read/check, provider reachability, pricing lookup, provider calls, and model calls all explicitly false/zero.

The verifier rebuilt current Story Source plus adjacent cover authority, rebuilt the v4 request, and checked canonical equality, schemas, cross-links, repository containment, content addresses, common output root, request/timestamp/source revision, and future live command.

An independent binding audit matched the request to current exports:

| Authority | Exact current value |
| --- | --- |
| Request | `visual-contract-authoring-request/v4` |
| Compiler draft schema | `vc-draft-schema/v7` |
| Initial system/user prompts | `vc-template-prompt/v4` / `vc-template-user-prompt/v4` |
| Repair system/user prompts | `vc-repair-prompt/v4` / `vc-repair-user-prompt/v4` |
| Action Semantic Catalog | `action-semantic-catalog/v1` |
| Catalog digest | `29d932d6f689fba8fe74b6b2da4eb0833727fb910a5688b024b36f32b83ac1cc` |
| Action Semantic Coverage | `action-semantic-coverage/v1` |

Two initial read-only inline digest-audit harness invocations failed before evaluating any artifact: the first used static imports in eval mode; the second did not unwrap the tsx CommonJS namespace. Neither invocation wrote or changed authority. No result from them was accepted. The corrected read-only invocation succeeded for all four payload domains as recorded above.

## Idempotence, legacy preservation, and exclusions

The identical materializer replay returned `created:false` for source request, snapshot, live request, and manifest. A raw-hash comparison after replay matched all four pre-replay raw identities exactly. No extra file or authority was created.

The current verifier was also run read-only against the Attempt-5 v1 manifest. It returned exit `1` with:

```json
{
  "version": "canonical-live-request-verification/v2",
  "status": "rejected",
  "zeroWrite": true,
  "reasonCodes": ["manifest_schema_invalid"]
}
```

Focused tests additionally prove legacy v1 control rejection requires explicit v2 rematerialization and that a stale bundle is rejected before provider construction.

Attempt-5 baseline and final raw identities matched:

| Attempt-5 file | Bytes | Raw SHA-256 |
| --- | ---: | --- |
| `materialization-inputs/fox-live-request.json` | 335 | `5f0f823372abe8f49f0ef19aa995a1ee39436ec4eeafcae397bf64999490c997` |
| `live-request/source-authority-requests/d39df40c...7c1c.json` | 349 | `dcc174c07b72e0e886a697d2be13ab3569b73a12265bb68128198e49964d92e0` |
| `live-request/source-snapshots/d8a6bed4...23d9.json` | 29,125 | `bdedc40c645c949bece8278ecf45e515e242eb957d1e85b9882605628216def0` |
| `live-request/authoring-requests/d3038f06...ccff.json` | 2,432 | `73289fcf62fd339aa2fb8a69100fa83333025d4dbc706875ed451b35db0aa505` |
| `live-request/live-request-materializations/8e2cb5c8...7660.json` | 3,376 | `5bb1433a52cc77722420bd72a5af0dc96b5213038f1651ceb0cac5dc6249f3d3` |
| `live-request/authoring-receipts/d41b4092...6ca2.json` | 5,731 | `790d431067b4a5b6920f636b961ff825da60567ff0da04de58b1642cb6209a15` |
| `live-request/readiness-evidence/035dbd72...5fd.json` | 1,302 | `353a2573319601f882470c759a0798c0bba2aa9dc3074e62cfd187d3b68de713` |

The Attempt-5 worktree remained clean at its original branch/HEAD and local origin parity. No old file was copied, rewritten, upgraded, or consumed as current authority.

The milestone output contains only the v2 control input and four B0 files. No authoring receipt, post-live `visual-contract-authoring-readiness/v2`, rejected request, candidate, Blueprint, package, or other downstream category exists.

## Deterministic local validation

```text
node node_modules/typescript/lib/tsc.js --noEmit
```

Result: **PASS**, exit `0`.

```text
node node_modules/vitest/vitest.mjs run lib/__tests__/action-semantic-catalog.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts
```

Result: **4 files / 108 tests PASS**:

- Action Semantic Catalog: 4;
- source authority lifecycle: 29;
- materialization: 34;
- verification: 41.

Per the approved artifact-only scope, `npm run check` was not run. B2A's previously recorded full-gate limitation remains unchanged.

The TypeScript run created ignored `tsconfig.tsbuildinfo`; its creation timestamp matched this run, and the exact generated file was removed after containment inspection. No broad cleanup occurred.

## Outcome and remaining gates

R1D-PVB-D1A1B2B has a locally verified current B0 v2 bundle and sanitized evidence suitable for independent first-pass read-only QA. Codex does not self-award independent technical PASS.

Attempt 6 remains separately gated on:

1. independent Claude Code PASS for the exact B2B range;
2. push and local/origin parity;
3. Guy's explicit Attempt-6 authorization;
4. one separately authorized canonical import preflight;
5. fresh official pricing/cost confirmation;
6. the approved credential gate.

This milestone grants none of those later authorities.
